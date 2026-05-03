# 自前バックエンドの構築手順

プラグインはデフォルトで `drive.file` スコープ（アプリが作成したファイルのみアクセス可能）を使用する。
自前バックエンドを構築し `drive` スコープに変更することで、Google Drive に手動追加したファイルも同期できるようになる。

## 全体構成

```
[プラグイン] ──(1) 認証開始──→ [自前サーバー] ──→ [Google OAuth]
                                                    ↓
[プラグイン] ←─(2) refresh_token ──────────────────
     ↓
[プラグイン] ──(3) refresh_token 送信──→ [自前サーバー] ──→ [Google]
[プラグイン] ←─(4) access_token ────────────────────
```

## Step 1: Google Cloud Console の設定

### プロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新規プロジェクトを作成

### OAuth 同意画面の設定

Google Cloud Console の UI は「Google Auth Platform」に変わっている。左メニューの各項目を順に設定する。

#### ブランディング（アプリ情報）

1. 左メニュー「Google Auth Platform」→「ブランディング」
2. **アプリ名**: `obsidian-gdrive-sync-backend`
3. **ユーザーサポートメール**: ドロップダウンから自分のGoogleアカウントを選択
4. 「次へ」をクリック

#### 対象

1. ユーザーの種類: **外部** を選択して「次へ」
   - 「外部」を選ぶとアプリは自動的にテストモードで起動する（Google審査不要、テストユーザーのみ使用可能）
   - テストユーザーの追加はプロジェクト構成完了後に左メニュー「対象」→「テストユーザー」→「ADD USERS」から行う
   - テストユーザーに追加されていないアカウントは「アクセスをブロック: Googleの審査プロセスを完了していません」と表示されて認証できない

#### 連絡先情報

1. **メールアドレス**: 自分のメールアドレスを入力
2. 「次へ」→「作成」をクリックしてプロジェクト構成を完了

### データアクセス（スコープ）

1. 左メニュー「データアクセス」→「スコープを追加または削除」
2. 以下を追加:
   - `https://www.googleapis.com/auth/drive`
3. 保存

### OAuth 2.0 クライアント ID の発行

1. 左メニュー「クライアント」→「クライアントを作成」
2. アプリケーションの種類: **ウェブアプリケーション**
3. 承認済みのリダイレクト URI に以下を追加:
   ```
   http://localhost:3000/auth/obsidian/callback
   ```
   サーバーがまだない段階では `localhost` で問題ない。本番サーバーをデプロイした後に同画面から URI を追加できる。
4. クライアント ID とクライアントシークレットを控えておく

### Google Drive API の有効化

1. 左メニュー「APIとサービス」→「ライブラリ」
2. 「Google Drive API」を検索して有効化

## Step 2: サーバーの実装

`backend/` ディレクトリに実装済みのファイルが含まれている。

### 環境変数の設定

`.env.example` をコピーして `.env` を作成し、値を埋める。

```bash
cp .env.example .env
```

```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3000/auth/obsidian/callback
```

### ローカルでの動作確認

```bash
cd backend
npm install
node --env-file=.env server.js
```

ブラウザで `http://localhost:3000/auth/obsidian` を開き、Google 認証が完了して refresh_token が表示されれば成功。

## Step 3: Google Cloud Run へのデプロイ

### 前提条件

- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) がインストール済み
- `gcloud auth login` でログイン済み
- Cloud Run API が有効化されていること

### デプロイ手順

```bash
cd backend

# プロジェクトを設定（プロジェクトIDは `gcloud projects list` で確認）
gcloud config set project YOUR_PROJECT_ID

# .env を読み込む
source .env

# ビルドとデプロイを一括実行
gcloud run deploy obsidian-gdrive-sync-backend \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET,REDIRECT_URI=$REDIRECT_URI
```

> **注意**: デプロイ前に `.env` の `REDIRECT_URI` を Cloud Run の URL に更新しておく必要がある。
> Cloud Run の URL は初回デプロイ後に確定するため、下記「REDIRECT_URI の更新」の手順で2段階で設定する。

デプロイ完了後、Cloud Run の URL（例: `https://obsidian-gdrive-sync-backend-xxxx-an.a.run.app`）が表示される。

### REDIRECT_URI の更新

Cloud Run の URL が確定したら:

1. `.env` の `REDIRECT_URI` を本番 URL に更新
2. Google Cloud Console の OAuth クライアント ID に本番 URL のリダイレクト URI を追加:
   ```
   https://obsidian-gdrive-sync-backend-xxxx-an.a.run.app/auth/obsidian/callback
   ```
3. `.env` の `REDIRECT_URI` を本番 URL に更新した上で再デプロイ:
   ```bash
   source .env
   gcloud run services update obsidian-gdrive-sync-backend \
     --region asia-northeast1 \
     --set-env-vars GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET,REDIRECT_URI=$REDIRECT_URI
   ```

## Step 4: プラグインの設定変更

Obsidian の vault 内にある `.obsidian/plugins/obsidian-gdrive-sync/data.json` を開き、
以下の2項目を自前サーバーの URL に変更する。

```json
{
  "fetchRefreshTokenURL": "https://your-server.example.com/auth/obsidian",
  "refreshAccessTokenURL": "https://your-server.example.com/auth/obsidian/refresh-token"
}
```

変更後、Obsidian でプラグインを再読み込みして認証をやり直す。

## 注意事項

- クライアントシークレットはサーバー側の環境変数で管理し、コードに直接書かない
- テストモードのままでは100ユーザーまでの制限があるが、個人利用では問題ない
- `drive` スコープは Drive 全体へのアクセス権限を持つため、信頼できる環境でのみ使用すること
