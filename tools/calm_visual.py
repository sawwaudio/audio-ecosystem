#!/usr/bin/env python3
"""落ち着いた映像（CALM）：木漏れ日や水面の光のような、ぼけた光の粒がゆっくり漂う縦動画（1080×1920）。
2026-11-14 オーナー指示「もっと自然の落ち着いた雰囲気の動画も出す」。参考リールのうち実写の柔らかい光（花畑・木漏れ日・彩雲）の空気を、実写素材を使わずに作る。
音に合わせて：低域で大きな光がゆっくり明るくなり、高域で小さな光がまたたく。動きはどれも遅く、急な変化は平滑化する。
使い方：python3 tools/calm_visual.py --audio a.wav --out v.mp4 --sec 30 --palette forest --seed 1
"""
import argparse, subprocess, wave
import numpy as np
ap = argparse.ArgumentParser(); ap.add_argument('--audio', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--sec', type=float, default=30); ap.add_argument('--fps', type=int, default=30); ap.add_argument('--seed', type=int, default=0)
ap.add_argument('--palette', default='forest')
a = ap.parse_args()
# 背景（上・下）と光の色。どれも彩度を抑えた自然の色
PAL = {
    'forest': ((0.07, 0.10, 0.04), (0.01, 0.025, 0.015), [(1.0, .76, .34), (.62, .88, .32), (1.0, .90, .62), (.40, .72, .30)]),
    'water':  ((0.03, 0.08, 0.10), (0.00, 0.02, 0.04), [(.70, .92, 1.0), (.85, 1.0, .95), (1.0, 1.0, 1.0), (.45, .75, .85)]),
    'night':  ((0.03, 0.03, 0.08), (0.00, 0.00, 0.02), [(1.0, .78, .45), (.65, .70, 1.0), (.90, .85, 1.0), (1.0, .90, .70)]),
    'rain':   ((0.07, 0.08, 0.10), (0.02, 0.02, 0.03), [(.80, .85, .92), (.95, .95, 1.0), (.70, .78, .85), (1.0, .92, .80)]),
    'dawn':   ((0.12, 0.07, 0.06), (0.02, 0.02, 0.04), [(1.0, .75, .55), (1.0, .88, .70), (.95, .70, .75), (1.0, .97, .88)]),
}
top, bot, cols = PAL[a.palette]
W, H = 360, 640; N = int(a.sec * a.fps); rng = np.random.default_rng(a.seed)

w = wave.open(a.audio); sr = w.getframerate(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
hop = sr // a.fps; win = np.hanning(2048); fr = np.fft.rfftfreq(2048, 1 / sr); B = np.zeros((N, 3))
for f in range(N):
    s = x[f * hop: f * hop + 2048]; s = np.pad(s, (0, 2048 - len(s)))
    sp = np.abs(np.fft.rfft(s * win)); B[f] = [sp[fr < 300].sum(), sp[(fr >= 300) & (fr < 3000)].sum(), sp[fr >= 3000].sum()]
for j in range(3):
    v = B[:, j]; v = (v - np.percentile(v, 10)) / (np.percentile(v, 95) - np.percentile(v, 10) + 1e-9)
    B[:, j] = np.convolve(np.clip(v, 0, 1.2), np.ones(15) / 15, mode='same')   # ゆっくり（0.5秒の平均）

M = 40; F = 6   # 奥〜中の光 M 個と、手前の大きくぼけた光 F 個
o = dict(x=rng.uniform(0, W, M), y=rng.uniform(0, H, M), z=rng.uniform(.2, 1, M), ph=rng.uniform(0, 6.28, M), sp=rng.uniform(.15, .5, M),
         c=rng.integers(0, len(cols), M), dx=rng.normal(0, .06, M), dy=-rng.uniform(.03, .16, M))
o['r'] = 3 + 30 * o['z'] ** 2; o['z'][:F] = 1.0; o['r'][:F] = rng.uniform(70, 120, F); o['dy'][:F] *= .5; o['band'] = np.where(o['z'] > .6, 0, np.where(o['z'] > .35, 1, 2))   # 手前の大きな光＝低域、奥の小さな光＝高域
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
g = (yy / H)[..., None]; bg = (1 - g) * np.array(top) + g * np.array(bot)
cols = np.array(cols)
vig = (1 - .55 * (((xx - W / 2) / (W * .75)) ** 2 + ((yy - H / 2) / (H * .7)) ** 2))[..., None].clip(.25, 1)
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(a.fps), '-i', '-',
                      '-vf', 'scale=1080:1920:flags=bicubic,gblur=sigma=2,noise=alls=5:allf=t,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', a.out], stdin=subprocess.PIPE)
lx, ly = W * rng.uniform(.6, .9), H * rng.uniform(.05, .2)   # 斜め上から差す光
for f in range(N):
    t = f / a.fps; img = bg.copy()
    glow = np.exp(-(((xx - lx) / (W * .7)) ** 2 + ((yy - ly) / (H * .45)) ** 2))[..., None]
    img += glow * cols[0] * (.16 + .10 * B[f, 0])
    for m in range(M):
        cx = (o['x'][m] + o['dx'][m] * f * o['z'][m] + 6 * np.sin(t * .2 + o['ph'][m])) % (W + 80) - 40
        cy = (o['y'][m] + o['dy'][m] * f * o['z'][m]) % (H + 80) - 40
        r = o['r'][m] * (1 + .12 * B[f, o['band'][m]])
        br = (.25 + .2 * np.sin(t * o['sp'][m] + o['ph'][m])) * (.5 + .9 * B[f, o['band'][m]]) * (.45 + .55 * o['z'][m])
        if m < F: br *= .28
        x0, x1, y0, y1 = int(max(0, cx - 2 * r)), int(min(W, cx + 2 * r)), int(max(0, cy - 2 * r)), int(min(H, cy + 2 * r))
        if x1 <= x0 or y1 <= y0: continue
        d = np.hypot(xx[y0:y1, x0:x1] - cx, yy[y0:y1, x0:x1] - cy) / r
        disc = np.clip(1 - d, 0, 1) ** 1.8 if m < F else np.clip(1.15 - d, 0, 1) ** .6 * (1 + .35 * np.exp(-((d - .92) / .07) ** 2))   # ぼけた円（縁が少し明るいレンズのぼけ）
        img[y0:y1, x0:x1] += disc[..., None] * cols[o['c'][m]] * br
    fade = min(1, t / 1.5, (a.sec - t) / 1.5)
    img = 1 - np.exp(-img * 1.5)                     # 白飛びしないトーンカーブ
    lum = img.mean(2, keepdims=True); img = lum + (img - lum) * 1.35   # 色を少し濃く
    img *= vig
    p.stdin.write((np.clip(img * fade, 0, 1) * 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
