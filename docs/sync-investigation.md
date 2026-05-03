# Google Drive → Obsidian 同期の仕組みと問題点

## ファイル保存構造

このプラグインは Google Drive にファイルを **フラット構造** で保存する。

```
Obsidian vault 内のパス:  notes/file.md
↓ アップロード時
Google Drive:  vault-folder/ "notes/file.md"
               ↑ スラッシュ込みのファイル名で vault フォルダ直下に配置
```

サブフォルダは作成しない（`uploadFolder` は vault フォルダ自体の作成にのみ使用）。

## Drive → Obsidian の同期フロー

### タイマーによる定期同期 (`refreshAll`)

`main.ts:1499–1503` に設定可能なインターバル（デフォルト 5 秒）でタイマーが動く。

```
refreshAll()
  └─ refreshFilesListInDriveAndStoreInSettings()   # Drive からファイル一覧取得
       └─ getFilesList(accessToken, vaultId)         # actions.js:165
            └─ GET /drive/v3/files?q='vaultId' in parents   # vault 直下のみ
  └─ cloudFiles = filesList.map(f => f.name)
  └─ localFiles = vault.getFiles().map(f => f.path)
  └─ toDownload = cloudFiles.filter(f => !localFiles.includes(f))
  └─ toDownload の各ファイルを getFile() でダウンロードして createBinary()
```

### ファイルを開いたときの個別チェック (`getLatestContent`)

`main.ts:2041` の `file-open` イベントで `.md` ファイルを開くたびに実行。
Drive の `modifiedTime` とローカルの `lastSync` メタデータを比較し、Drive 側が新しければダウンロードする。

**既存ファイルの変更はタイマーでは検出されない。ファイルを開いたときのみ反映される。**

## Drive 側で手動追加したファイルが見えない根本原因

### OAuth スコープの制限

このプラグインは以下のスコープのみで認証している（README.md:94 に明記）:

- `https://www.googleapis.com/auth/drive.file` — **アプリ自身が作成したファイルのみ**アクセス可能
- `https://www.googleapis.com/auth/drive.appdata`

`drive.file` スコープの仕様上、ユーザーが Google Drive の UI や他のアプリで手動追加したファイルは API から参照できない。`getFilesList` を呼び出しても、プラグインが作成していないファイルはレスポンスに含まれない。

**Drive 側でファイルを手動追加しても Obsidian に反映されないのはこれが理由。** コードのバグではなく、意図的なセキュリティ設計。

### ファイル追加方法ごとの挙動

| 追加方法 | 検出されるか | 理由 |
|---|---|---|
| Obsidian から新規作成・アップロード | ✓ 反映される | プラグインが作成したファイルなので `drive.file` スコープでアクセス可能 |
| Drive UI で手動追加 | ✗ 反映されない | `drive.file` スコープ外のファイルは API から不可視 |
| vault フォルダ内にサブフォルダを作って追加 | ✗ 反映されない | スコープ外に加え、`q='vaultId' in parents` は直接の子のみ返す |

## 同期がスキップされる条件

`refreshAll` には以下のガードがある（`main.ts:541–593`）。

| 条件 | 効果 |
|---|---|
| `connectedToInternet == false` | 即時 return |
| `pendingSync == true` | 即時 return（Drive → local の検出も含めて全スキップ） |
| `alreadyRefreshing == true` | 即時 return |
| `haltAllOperations == true` | 即時 return |

`pendingSync` はエラー発生時に `notifyError()` でセットされる。エラー状態が解消されないと以降の全同期がスキップされ続ける。

## エラーログの扱い

`writeToErrorLogFile` (`main.ts:1181`) はエラーをファイルに記録する。

- 通常のエラー: `name - message - stacktrace` を記録
- ネットワークエラー（`UnknownHostException`、`Failed to fetch` 等）: `name - message` のみ記録（スタックトレースなし）

ネットワークエラーの判定は `isNetworkError()` (`main.ts:1171`) で行う。

## 関連コード箇所

| 機能 | ファイル | 行 |
|---|---|---|
| タイマー登録 | main.ts | 1499–1503 |
| `refreshAll` | main.ts | 541–776 |
| Drive ファイル一覧取得 | actions.js | 165–207 |
| ファイルダウンロード | actions.js | 246–271 |
| ファイルを開いたときの更新確認 | main.ts | 849–944 |
| エラーログ書き込み | main.ts | 1181–1216 |
| ネットワークエラー判定 | main.ts | 1171–1179 |
