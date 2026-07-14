# Websites

GitHub Pages に置きやすい、複数サイト用の静的プロジェクトです。

## 構成

- `index.html`: サイト一覧のトップページ
- `sites.json`: トップページに表示するサイト情報
- `sites/`: 個別サイトを置くフォルダ
- `assets/`: トップページ用の CSS と JavaScript
- `tools/`: ローカル確認用スクリプト

## ローカルで見る

```bash
npm run dev
```

表示された URL をブラウザで開きます。

## 新しいサイトを追加する

1. `sites/new-site/index.html` のようにフォルダを作ります。
2. `sites.json` に次のような項目を追加します。

```json
{
  "title": "New Site",
  "slug": "new-site",
  "description": "短い説明を入れます。",
  "path": "sites/new-site/",
  "status": "draft",
  "tags": ["static"],
  "accent": "#3f6fb5",
  "secondary": "#d89b2b"
}
```

3. `npm run check` で `sites.json` とリンク先を確認します。

## GitHub Pages

GitHub にリポジトリを作成したあと、Settings -> Pages で Source を `Deploy from a branch`、Branch を `main`、Folder を `/ (root)` にすると公開できます。
