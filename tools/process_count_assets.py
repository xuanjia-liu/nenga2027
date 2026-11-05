#!/usr/bin/env python3
"""Prepare the 「ひつじを数えて」 painted assets: crop to content, grade the sheep parts, export WebP and the hill ridge profile.

Inputs  assets/source/{sky,hill,moon,fence,p_body,p_head,p_leg}.png  (transparent PNGs, 1536×1024 / 1586×992)
Outputs assets/count/*.webp + meta.json      → then run tools/embed_assets.py
Requires Pillow + numpy.
"""
import json, math, pathlib
import numpy as np
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC, OUT = ROOT / 'assets' / 'source', ROOT / 'assets' / 'count'

def bbox(im, thr=8, pad=3):
    a = np.array(im)[..., 3]; ys, xs = np.where(a > thr)
    return (max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad + 1), min(im.height, ys.max() + pad + 1))

def grade(im, warm=0., cool=0.):
    """cool moonlit shading + a warm rim light from the left (matches the reference scene)"""
    a = np.array(im).astype(np.float32); w = a.shape[1]
    a[..., 0] *= 1 - cool * .9; a[..., 1] *= 1 - cool * .5
    xs = np.linspace(1, 0, w)[None, :] ** 3 * warm
    a[..., 0] = np.minimum(255, a[..., 0] + xs * 90); a[..., 1] = np.minimum(255, a[..., 1] + xs * 60); a[..., 2] = np.maximum(0, a[..., 2] - xs * 20)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')

def fit(im, w=None, h=None):
    if w: return im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    return im.resize((round(h * im.width / im.height), h), Image.LANCZOS)

def main():
    meta = {}
    Image.open(SRC / 'sky.png').convert('RGB').save(OUT / 'sky.webp', quality=82, method=6)
    fence = Image.open(SRC / 'fence.png').convert('RGBA'); fit(fence.crop(bbox(fence)), 520).save(OUT / 'fence.webp', quality=86, method=6)
    moon = Image.open(SRC / 'moon.png').convert('RGBA'); fit(moon.crop(bbox(moon, 3)), 360).save(OUT / 'moon.webp', quality=86, method=6)
    # hill: keep the full frame width (positions matter), crop the empty top, sample the ridge line
    hill = Image.open(SRC / 'hill.png').convert('RGBA'); ha = np.array(hill)[..., 3]
    top = max(0, int(np.where(ha.max(axis=1) > 6)[0].min()) - 4)
    hill.crop((0, top, hill.width, hill.height)).save(OUT / 'hill.webp', quality=84, method=6)
    prof = []
    for x in np.linspace(0, hill.width - 1, 81):
        r = np.where(ha[:, int(x)] > 200)[0]; prof.append(int(r.min()) if len(r) else hill.height)
    meta.update(hill_top=top, prof=prof)
    # sheep rig parts
    b = Image.open(SRC / 'p_body.png').convert('RGBA'); fit(grade(b.crop(bbox(b)), .55, .06), 560).save(OUT / 's_body.webp', quality=86, method=6)
    h = Image.open(SRC / 'p_head.png').convert('RGBA'); fit(grade(h.crop(bbox(h)), .15, .04), 320).save(OUT / 's_head.webp', quality=86, method=6)
    l = Image.open(SRC / 'p_leg.png').convert('RGBA'); a = np.array(l)[..., 3]
    ys, xs = np.where(a > 128); cx, cy = xs.mean(), ys.mean()
    ev, evec = np.linalg.eigh(np.cov(np.vstack([xs - cx, ys - cy]))); v = evec[:, 1]
    ang = math.degrees(math.atan2(v[1], v[0]))                       # rotate the leg so its long axis is vertical
    l = l.rotate(ang - 90, resample=Image.BICUBIC, expand=True, center=(cx, cy)); l = l.crop(bbox(l))
    fit(grade(l, .1, .03), h=240).save(OUT / 's_leg.webp', quality=86, method=6)
    (OUT / 'meta.json').write_text(json.dumps(meta))
    print('assets/count updated')

if __name__ == '__main__':
    main()
