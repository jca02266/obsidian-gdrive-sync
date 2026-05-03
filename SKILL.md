# Skills

## release

リリースタグを指定されたら以下の手順を実施する。

### 手順

1. **manifest.json のバージョンを確認・更新**
   - 指定されたタグと `manifest.json` の `version` が一致していなければ更新する

2. **ビルド**
   ```bash
   npm run build
   ```
   生成物: `main.js`, `obsidian-gdrive-sync.zip`

3. **変更をコミット・プッシュ**
   ```bash
   git add main.ts main.js manifest.json obsidian-gdrive-sync.zip
   git commit -m "chore: release <TAG>"
   git push
   ```

4. **タグを作成してプッシュ**
   ```bash
   git tag <TAG>
   git push origin <TAG>
   ```

5. **GitHub Release を作成**
   ```bash
   gh release create <TAG> \
     main.js manifest.json styles.css obsidian-gdrive-sync.zip \
     --title "<TAG>" \
     --notes "<リリースノート>"
   ```

### リリースノートの内容

直前のタグからの `git log` を参照してコミットメッセージをまとめる:

```bash
git log <前のタグ>..<TAG> --oneline
```
