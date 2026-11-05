#!/usr/bin/env python3
"""Cut, clean and encode the chosen sound-effect takes and background loops, then embed them.

    python3 tools/process_sfx.py

assets/sfx/candidates/*.wav       raw Stable Audio 3 SFX takes (audio-studio MCP, 44.1 kHz 24-bit; git-ignored)
assets/sfx/bgm_candidates/*.wav   raw music takes (git-ignored)
assets/sfx/picks.json             effect → take + time range; a list = several takes (random variation at play time)
assets/sfx/bgm.json               demo → music take + tempo/length of the loop
→ assets/sfx/<name>[~n].mp3       mono, onset-trimmed, peak-normalised, short fade-out (committed)
→ assets/sfx/bgm/<demo>.mp3       mono 32 kHz loop, crossfaded so it repeats without a seam (committed)
→ generated/sfx.js                window.NENGA_SFX = {name: base64 mp3}   (variants are "name~2", "name~3", …)
→ generated/bgm.js                window.NENGA_BGM = {demo: base64 mp3}
Needs numpy + ffmpeg (with libmp3lame).
"""
import base64, json, pathlib, subprocess, wave
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
SFX, GEN = ROOT / 'assets' / 'sfx', ROOT / 'generated'
CAND, BCAND, BOUT = SFX / 'candidates', SFX / 'bgm_candidates', SFX / 'bgm'


def load(p):
    w = wave.open(str(p)); n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
    raw = np.frombuffer(w.readframes(n), np.uint8).reshape(-1, sw)
    if sw == 3:
        x = raw[:, 0].astype(np.int32) | (raw[:, 1].astype(np.int32) << 8) | (raw[:, 2].astype(np.int32) << 16)
        x = np.where(x >= 1 << 23, x - (1 << 24), x) / float(1 << 23)
    else:
        x = raw.view('<i2').ravel() / 32768.0
    return x.reshape(-1, ch).mean(1), sr


def clean(x, sr, cut, keep_head=False):
    x = x[int(cut[0] * sr):int(cut[1] * sr)].copy()
    if not keep_head:                       # start right on the transient (−36 dB rel. peak, 3 ms pre-roll)
        i = int(np.argmax(np.abs(x) > np.abs(x).max() * 10 ** (-36 / 20)))
        x = x[max(0, i - int(.003 * sr)):]
    fi, fo = int(.002 * sr), min(len(x) // 3, int(.06 * sr))
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo) ** 2
    return x / np.abs(x).max() * 10 ** (-1 / 20)


def loop(x, sr, bpm, beats, xf_ms):
    """Cut a seamless loop: length ≈ beats at bpm, nudged (±60 ms) to where the music best matches its own start;
    the audio just past the loop end is crossfaded (equal power) into the head."""
    L0, xf = int(beats * 60 / bpm * sr), int(xf_ms / 1000 * sr)
    hop = sr // 200                                         # 5 ms envelope
    env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    win = max(.6, min(3, (len(x) - L0 - xf) / sr - .1))       # compare up to 3 s, as much as the take allows
    head = env[:int(win * sr / hop)]; head = (head - head.mean()) / (head.std() + 1e-9)
    best, bestL = -9, L0
    for d in range(-12, 13):
        L = L0 + d * hop; s = L // hop; seg = env[s:s + len(head)]
        if len(seg) < len(head) or L + xf > len(x): continue
        seg = (seg - seg.mean()) / (seg.std() + 1e-9); c = float(np.mean(seg * head))
        if c > best: best, bestL = c, L
    L = bestL; y = x[:L].copy()
    t = np.linspace(0, np.pi / 2, xf)
    y[:xf] = x[:xf] * np.sin(t) + x[L:L + xf] * np.cos(t)
    rms = np.sqrt(np.mean(y ** 2)); y *= 10 ** (-19 / 20) / rms   # even loudness across demos
    pk = np.abs(y).max(); y = y / pk * 10 ** (-1 / 20) if pk > 10 ** (-1 / 20) else y
    return y, L / sr, best


def enc(y, sr, out, rate='48k', ar=None):
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    args = ['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(sr), '-ac', '1', '-i', '-']
    if ar: args += ['-ar', str(ar)]
    subprocess.run(args + ['-c:a', 'libmp3lame', '-b:a', rate, str(out)], input=pcm, check=True)
    return base64.b64encode(out.read_bytes()).decode()


def main():
    picks = {k: v for k, v in json.loads((SFX / 'picks.json').read_text()).items() if not k.startswith('_')}
    out = {}
    for old in SFX.glob('*.mp3'): old.unlink()
    for name, takes in picks.items():
        for i, p in enumerate(takes if isinstance(takes, list) else [takes]):
            key = name if i == 0 else f'{name}~{i + 1}'
            x, sr = load(CAND / f"{p['src']}.wav")
            y = clean(x, sr, p['cut'], p.get('keepHead', False))
            out[key] = enc(y, sr, SFX / f'{key}.mp3')
    (GEN / 'sfx.js').write_text('window.NENGA_SFX = ' + json.dumps(out) + ';\n')
    print(f'{len(out)} effect takes   generated/sfx.js {(GEN / "sfx.js").stat().st_size / 1024:.0f} KB')

    BOUT.mkdir(exist_ok=True); bgm = {}
    for demo, b in {k: v for k, v in json.loads((SFX / 'bgm.json').read_text()).items() if not k.startswith('_')}.items():
        x, sr = load(BCAND / f"{b['src']}.wav")
        y, secs, match = loop(x, sr, b['bpm'], b['beats'], b['xf'])
        bgm[demo] = enc(y, sr, BOUT / f'{demo}.mp3', rate='40k', ar=32000)
        print(f'bgm {demo:8s} {secs:5.2f}s  match {match:.2f}  {(BOUT / f"{demo}.mp3").stat().st_size / 1024:5.1f} KB')
    (GEN / 'bgm.js').write_text('window.NENGA_BGM = ' + json.dumps(bgm) + ';\n')
    print(f'generated/bgm.js {(GEN / "bgm.js").stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main()
