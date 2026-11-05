#!/usr/bin/env python3
"""Regenerate generated/*.js (base64-embedded images and Blender models) from assets/ and blender/.

    python3 tools/embed_assets.py
"""
import base64, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
A, B, G = ROOT / 'assets' / 'count', ROOT / 'blender', ROOT / 'generated'
def b64(p): return base64.b64encode(p.read_bytes()).decode()

# 「ひつじを数えて」 painted assets (+ the hill ridge profile used to place the fence, sheep and physics floor)
meta = json.loads((A / 'meta.json').read_text())
img = {k: 'data:image/webp;base64,' + b64(A / f'{v}.webp') for k, v in
       {'sky': 'sky', 'hill': 'hill', 'moon': 'moon', 'fence': 'fence', 'body': 's_body', 'head': 's_head', 'leg': 's_leg'}.items()}
(G / 'assets.js').write_text('window.NENGA_ASSETS = ' + json.dumps({'img': img, 'hillTop': meta['hill_top'], 'prof': meta['prof'], 'hillW': 1586, 'hillH': 992}) + ';\n')
# Blender models
for name, var in [('gacha', 'NENGA_GACHA_GLB'), ('omikuji', 'NENGA_OMIKUJI_GLB'), ('snowdome', 'NENGA_DOME_GLB')]:
    (G / f'{name}_glb.js').write_text(f"window.{var} = '{b64(B / f'{name}.glb')}';\n")
print('generated/ updated')
