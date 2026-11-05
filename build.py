#!/usr/bin/env python3
"""Build the single-file page.

    python3 build.py            # → dist/nenga2027.html (artifact fragment, no <html>/<head> wrapper)
                                #   dist/preview.html   (full HTML document for local preview / tests)

Order matters: generated assets (images, sound effects, music) → sound.js (NENGA.snd) → app.js (2D demos + device frames) → 3D models → three-demos.js
(3D demos, exports NENGA.fx / NENGA.three) → jp.js → omikuji.js → mochi.js.
"""
import pathlib, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent
SRC, GEN, DIST = ROOT / 'src', ROOT / 'generated', ROOT / 'dist'
DIST.mkdir(exist_ok=True)

# Yuji Syuku (brush font) is loaded with a text= subset: every string drawn in the brush font must be listed here.
BRUSH_TXT = ''.join(sorted(set(
    'あけましておめでとうございます。2027年は未年。「未」は「未来」の「未」です。雪がとけたら、新しいことが芽吹く季節。'
    '今年も皆さまと一緒に、あしたをオモシロク。bravesoft 代表取締役 〇〇羊'
    '大吉未来吉羊吉メェ吉雪のした芽ぶく未来を待つひつじ跳ぶまえの柵はいつでも低く見ゆもこもこと夢ふくらます未の春'
    '群れなせば遠き山へも道ひらく　名人級福々しい大わらいぺったん！いいねおしいすかっメェッ!?はいっよーい…つきたての一年を。'
    '未夢跳福二〇二七年元旦福羊')))

HEAD = '''<title>2027 ひつじ年賀状</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Roboto+Mono:wght@500;700&family=Roboto:ital,wght@1,700&family=Noto+Serif+JP:wght@700;900&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&display=swap&text=''' + urllib.parse.quote(BRUSH_TXT) + '''">
'''
# CDN scripts (the claude.ai artifact CSP only allows cdnjs / jsdelivr / unpkg …)
CDN = '''
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js"></script>
'''
SCRIPTS = [GEN / 'assets.js', GEN / 'sfx.js', GEN / 'bgm.js', SRC / 'sound.js', SRC / 'app.js', GEN / 'gacha_glb.js', GEN / 'snowdome_glb.js', SRC / 'three-demos.js',
           GEN / 'fuku_art.js', SRC / 'jp.js', GEN / 'omikuji_glb.js', SRC / 'omikuji.js', SRC / 'mochi.js']

def main():
    out = HEAD + '<style>\n' + (SRC / 'style.css').read_text() + '\n</style>\n' + (SRC / 'body.html').read_text() + CDN
    out += ''.join('<script>\n' + p.read_text() + '\n</script>\n' for p in SCRIPTS)
    (DIST / 'nenga2027.html').write_text(out)
    doc = ('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
           '<style>[hidden]{display:none!important}</style></head><body>' + out + '</body></html>')
    (DIST / 'preview.html').write_text(doc)
    print(f'dist/nenga2027.html  {len(out.encode()) / 1e6:.2f} MB')

if __name__ == '__main__':
    main()
