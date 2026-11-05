# CLAUDE.md — bravesoft 2027 ひつじ年賀状

Concept page + playable demos for bravesoft's external-facing **digital New Year card for 2027 (未年 / 丁未)**.
Required: a CEO message. Optional: staff group photo. Tone: playful (遊び心強め), digital only.
Owner: Tom (bravesoft, j.liu@bravesoft.co.jp). Copy is Japanese; code comments are English.

The page is a **single self-contained HTML file** published as a claude.ai Artifact
(https://claude.ai/artifact/CY872UEdM4MJmfU41mvcuy). Every demo has a **phone (9:17)** and a **PC (1280×760, scaled)** version.

## Commands

```bash
python3 build.py              # src/ + generated/ → dist/nenga2027.html (artifact fragment) + dist/preview.html (full doc)
npm install && npm test       # build + Playwright smoke test (screenshots → tests/out/, fails on page errors)
npm test -- mochi omikuji     # only some demos (ids: shear count gacha post flock popup dome omikuji fuku mochi)
python3 tools/embed_assets.py # after changing assets/count/*.webp or blender/*.glb
python3 tools/process_sfx.py # picks.json + bgm.json + candidates (audio-studio MCP takes) → assets/sfx/*.mp3, bgm/*.mp3, generated/sfx.js + bgm.js
python3 tools/process_count_assets.py   # re-crop/grade the 「ひつじを数えて」 painted PNGs (Pillow + numpy)
PYBPY=python3 tools/blender_export.sh   # re-export Blender models (bpy module) — or plain `blender` on PATH
npm run serve                 # http://localhost:8027/preview.html
```

`dist/` is a build output but is committed so the current published version is always at hand.

## Layout

```
src/body.html        all markup (nav, hero, ideas, CEO draft, demo sections, memo, footer, logo <symbol>)
src/style.css        DS tokens + every demo's styles (phone first; PC via @container scr (min-width:700px))
src/sound.js         NENGA.snd: effects (random take + pitch/volume jitter), per-demo background loops, shared ON/OFF
src/app.js           device frames (phone/PC toggle), ideas fold, A 毛刈り, B ひつじを数えて (Matter.js finale)
src/three-demos.js   three.js harness `stage()` + C ガチャ, D 未来ポスト, E 群れ, F 飛び出す絵本, G スノードーム;
                     exports window.NENGA.fx (sound/haptics helpers) and window.NENGA.three (stage, canvasTex, …)
src/jp.js            I ひつじ福笑い (DOM)
src/omikuji.js       H ひつじみくじ (3D tube from Blender, shake → flip → stick drop → dark reveal)
src/mochi.js         J ぺったん餅つき (voxel three.js rhythm game)
generated/*.js       base64 assets: NENGA_ASSETS (count images + hill profile), NENGA_SFX (sound effects), NENGA_BGM (loops), *_GLB (Blender models) — do not hand-edit
assets/sfx           Stable Audio 3 takes via the audio-studio MCP; picks.json = effect → take(s) + cut (a list = variants),
                     bgm.json = demo → loop take + bpm/beats; candidates/ and bgm_candidates/ are git-ignored
assets/source        original transparent PNGs supplied by the user (count scene + sheep parts)
assets/count         processed WebP + meta.json (hill ridge profile)
blender/*.py         bpy scripts that build the models; *.glb exports
vendor/              three r128, GLTFLoader r128, matter-js 0.19 — local copies for tests only
docs/DESIGN.md       bravesoft design system (the page must follow it)
docs/references/     reference images the user gave for recent redesigns
```

## Hard constraints

- **Artifact CSP**: scripts only from cdnjs / cdn.jsdelivr.net (three r128 from cdnjs; GLTFLoader + matter-js from jsdelivr,
  exact versions). Stylesheets only from Google Fonts. Everything else (images, models) is inlined as base64.
  Free 3D-asset sites are unreachable → models are procedural or made in Blender.
- three.js is **r128** (non-module `examples/js` GLTFLoader, `THREE.*` globals, no `roundRect` geometry helpers, etc.).
- Keep page size reasonable (currently ~3.1 MB: ~1 MB music loops, ~0.5 MB effects, the rest models/images).
- `dist/nenga2027.html` has no `<html>/<head>` (the artifact host wraps it). `preview.html` is the wrapped copy.
- Yuji Syuku (brush font) is loaded with a `text=` subset in build.py → add any new brush-rendered characters to `BRUSH_TXT`.
- Each demo root is `.scr` inside `.vp` (container `scr`). Pointer coords must be converted with the scale factor
  (`root.clientWidth / root.getBoundingClientRect().width`) because the PC frame is CSS-scaled.
- `stage(sel, setup)` renders only while visible; `setup` returns `{scene, camera, frame(dt,t), resize(w,h), onMode()}`.

## Design rules (from docs/DESIGN.md + the user's feedback)

- Brand blue `#0066FF` is the primary colour (the user explicitly wants brave blue over reference purples).
  Fonts: Noto Sans JP, Roboto Mono (eyebrows), Roboto italic (English sub-heads), Noto Serif JP / Yuji Syuku for 和 parts.
  Pill buttons, hairlines, bilingual section headers, ink-black footer. The bravesoft logo is an SVG `<symbol id="bs-logo">`
  (use `<svg class="bs-logo"><use href="#bs-logo"/></svg>`, colour via `currentColor`).
- The user iterates visually and precisely: when given a reference image, first **list the details you see**, then implement.
- Prefer real interaction feel: physics, springs, hit-stop, haptics (`navigator.vibrate`), sound (off by default, `.js-snd` toggle).
  Sound = sampled one-shots: `NENGA.snd.play(name, {vol, rate, delay, offset, dur, exact})` / `NENGA.snd.sfx.*`; decoded on first sound-ON.
  Every play picks a random take (never the same twice) with ±4% pitch / −15% volume unless `exact` (the mochi metronome).
  Each demo has a background loop, played only for the demo filling the screen; `bgmDuck(id, k)` turns it down (mochi in play).
  Demos without a sound button in their bar get the round `.snd-ico js-snd` toggle (top-right); all toggles share one setting.
- Every interaction needs clear feedback; "tap anywhere" is preferred over tiny buttons, with a subtle cursor follower on PC.
- Text must never overflow (see omikuji `fitSheet()` auto-shrink).

## Demos (current state)

| id | Demo | Notes |
|---|---|---|
| A `#shear` | 社長のメェ〜ッセージ | shear wool tufts (Matter.js), sneeze sequence blows wool off the message |
| B `#count` | ひつじを数えて、2027匹 (本命) | painted assets (sky/moon/hill/fence) + sheep **rig of parts** (body/head/4 legs, CSS-animated, hip pivots); 2022-sheep Matter.js finale on the hill ridge; message paragraphs with navy text-shadow |
| C `#gacha` | 「羊＋大＝美」漢字ガチャ | Blender machine (clear-coat blue, chrome, gold, ram horns); draggable capsules; rarity reveal modal |
| D `#post` | 未来ポスト | Japanese red post box, light-grey envelope, type directly on the 3D letter (ghost textarea) |
| E `#flock` | 群れで描く「2027」 | ~480 instanced sheep form 2027 → bravesoft mark → eventos ロゴ; tap = next shape; green 新春 pasture |
| F `#popup` | 飛び出すひつじカード | 5-spread pop-up book |
| G `#dome` | ひつじスノードーム | Blender base/cottage/pines/gift; procedural sheep with smooth small-curl wool (`makeSheep({smooth:true})`), legs pivot at the hip |
| H `#omikuji` | ひつじみくじ | Blender hex tube; grab & shake (spring + inertia), flip, verlet stick drop; circular dark wipe; notched fortune card |
| I `#fuku` | ひつじ福笑い | blindfold (blue 豆絞り), place parts, reveal + score |
| J `#mochi` | ぺったん餅つき | voxel stage; ring cycle: big red ring = lamb's hand in (あぶない), shrinking blue → white in zone → hit on the beat; judgements PERFECT/GOOD/EARLY・LATE/MISS/DANGER with hit-stop, zoom punch, speed lines, cube springs, floor wave, combo banners, FEVER ×1.5; mochi cubes regroup into 鏡餅 |

Removed at the user's request (don't bring back): 社長から通知が届く, 2027.1.1 アップデート, 全員ひつじ化 集合写真, 返し年賀状メーカー, ひつじ書き初め.

## Testing notes

- Headless Chromium uses SwiftShader: WebGL runs at ~1–5 fps. Screenshots are fine; rhythm timing, physics feel, sound and
  haptics must be checked on a real device. `#mochi` exposes a test hook `root._mc` (`hit(q)`, `setProg(v)`, `beat`).
- Pause WAAPI animations (`document.getAnimations().forEach(a => a.pause())`) before screenshotting transient effects.

## Open ideas / TODO

- Real staff photos for the optional group-photo slots (count 社員の顔, fukuwarai face, mochi completion).
- Static fallback images for old devices (3D demos) and OGP/GIF thumbnails for mail/SNS.
- Phone omikuji fortune text is ~10px (auto-fit); consider a taller card or shorter copy.
