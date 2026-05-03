# Render へのデプロイ手順

## 前提条件

- このリポジトリが GitHub にプッシュ済みであること
- `.env` に `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET` が設定済みであること

## Step 1: Render アカウント作成

1. [render.com](https://render.com) にアクセス
2. 「Get Started for Free」→ GitHub アカウントでサインアップ

## Step 2: Web Service の作成

1. ダッシュボードの「**New +**」→「**Web Service**」をクリック
2. 「**Connect a repository**」で GitHub と連携し、このリポジトリ（`obsidian-gdrive-sync`）を選択

## Step 3: サービスの設定

以下の通り設定する。

| 項目 | 値 |
|---|---|
| **Name** | `obsidian-gdrive-sync-backend` |
| **Language** | `Node` |
| **Branch** | `master` |
| **Region** | 任意（例: `Oregon (US West)`） |
| **Root Directory** | `backend`（空欄なので手入力が必要） |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js`（`node main.js` と自動入力されるので修正が必要） |
| **Instance Type** | `Free` |

## Step 4: 環境変数の設定

「**Environment Variables**」セクションで以下を追加する。

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | `.env` の値 |
| `GOOGLE_CLIENT_SECRET` | `.env` の値 |
| `REDIRECT_URI` | （後で設定・下記参照） |

「**Create Web Service**」をクリックしてデプロイを開始する。

## Step 5: REDIRECT_URI の設定

デプロイ完了後、Render からサービスの URL が発行される。

```
https://obsidian-gdrive-sync-backend.onrender.com
```

### Google Cloud Console の OAuth クライアントに追加

1. [Google Auth Platform](https://console.cloud.google.com/auth) →「クライアント」→ 作成済みのクライアントを開く
2. 承認済みのリダイレクト URI に以下を追加:
   ```
   https://obsidian-gdrive-sync-backend.onrender.com/auth/obsidian/callback
   ```
3. 保存

### Render の環境変数を更新

Render のダッシュボード →「Environment」→ `REDIRECT_URI` を追加・更新:

```
REDIRECT_URI=https://obsidian-gdrive-sync-backend.onrender.com/auth/obsidian/callback
```

保存すると自動的に再デプロイされる。

## Step 6: 動作確認

ブラウザで以下にアクセスし、Google 認証が完了して refresh_token が表示されれば成功。

```
https://obsidian-gdrive-sync-backend.onrender.com/auth/obsidian
```

## Step 7: プラグインの設定変更

`data.json` を直接編集する必要はない。Obsidian の設定画面から変更できる。

1. Obsidian → 設定 → コミュニティプラグイン → **obsidian-gdrive-sync** の設定を開く
2. 下にスクロールして認証サーバーの URL 入力欄を見つける
3. 以下の2項目を Render の URL に変更する:

| 項目 | 値 |
|---|---|
| fetch refresh token URL | `https://obsidian-gdrive-sync-backend.onrender.com/auth/obsidian` |
| refresh access token URL | `https://obsidian-gdrive-sync-backend.onrender.com/auth/obsidian/refresh-token` |

4. 同じ設定画面の認証リンクから再ログインする

## 注意事項

### スリープについて

Render の無料プランは **15分間アクセスがないとサービスがスリープ**する。
スリープ中に Obsidian がトークン更新を要求すると、初回応答に 30〜50 秒かかる場合がある。

Obsidian を起動したまま使い続けている間はプラグインが定期的にトークン更新を行うため、
通常の使用ではスリープが問題になるケースは少ない。

### スリープを回避したい場合

[UptimeRobot](https://uptimerobot.com)（無料）などの外部監視サービスで
`https://obsidian-gdrive-sync-backend.onrender.com/auth/obsidian` を
5分間隔で定期的に ping するよう設定するとスリープを防止できる。
