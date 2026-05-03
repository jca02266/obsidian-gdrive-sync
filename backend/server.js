const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SCOPE = 'https://www.googleapis.com/auth/drive';
const PORT = process.env.PORT || 3000;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error('Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI');
  process.exit(1);
}

// CORS ヘッダー（Obsidian からのリクエストを許可）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// (1) 認証開始: Google 認証画面へリダイレクト
app.get('/auth/obsidian', (req, res) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent'); // refresh_token を必ず取得するため
  res.redirect(url.toString());
});

// (2) Google からのコールバック: authorization_code → refresh_token
app.get('/auth/obsidian/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`<pre>認証エラー: ${error}</pre>`);
  }
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });
    const { refresh_token } = response.data;
    if (!refresh_token) {
      return res.status(400).send('<pre>refresh_token が取得できませんでした。Google アカウントでこのアプリのアクセス権を一度削除してから再試行してください。</pre>');
    }
    res.send(`<!DOCTYPE html>
<html><body>
<h2>認証成功</h2>
<p>以下の Refresh Token を Obsidian プラグインの設定画面に貼り付けてください。</p>
<textarea rows="4" cols="80" onclick="this.select()">${refresh_token}</textarea>
</body></html>`);
  } catch (err) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.status(500).send('<pre>トークン取得に失敗しました。</pre>');
  }
});

// (3) refresh_token → access_token
app.post('/auth/obsidian/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    });
    res.json({
      access_token: response.data.access_token,
      expiry_date: new Date(Date.now() + response.data.expires_in * 1000).toString(),
    });
  } catch (err) {
    console.error('Refresh token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
