# bravesoft 2027 ひつじ年賀状

社外向けデジタル年賀状（2027年・未年）の企画ページと、10案ぶんの動くデモ（スマホ版・PC版）。
1枚の HTML にすべてを埋め込んで claude.ai の Artifact として公開しています。

## はじめかた

```bash
python3 build.py          # dist/nenga2027.html と dist/preview.html を生成
npm install               # Playwright（テスト用）
npm test                  # ビルド + 全デモのスクリーンショット確認（tests/out/）
npm run serve             # http://localhost:8027/preview.html で確認
```

Python 3.10+ / Node 18+。アセット加工には Pillow と numpy、モデルの書き出しには Blender（または `pip install bpy`）が必要です。

## 構成

| パス | 内容 |
|---|---|
| `src/` | マークアップ・CSS・各デモの JS |
| `generated/` | base64 埋め込みアセット（`tools/embed_assets.py` で再生成） |
| `assets/` | 「ひつじを数えて」用の素材（元 PNG と加工済み WebP） |
| `blender/` | ガチャ・おみくじ筒・スノードーム小物の bpy スクリプトと .glb |
| `vendor/` | テスト用の three.js r128 / GLTFLoader / matter-js |
| `docs/` | bravesoft デザインシステム（DESIGN.md）と参考画像 |
| `dist/` | ビルド結果（公開用） |

詳しい仕様・制約・デモごとのメモは [CLAUDE.md](CLAUDE.md) を参照してください。

## デモ

A 社長のメェ〜ッセージ／B ひつじを数えて、2027匹（本命）／C 「羊＋大＝美」漢字ガチャ／D 未来ポスト／
E 群れで描く「2027」／F 飛び出すひつじカード／G ひつじスノードーム／H ひつじみくじ／I ひつじ福笑い／J ぺったん餅つき
