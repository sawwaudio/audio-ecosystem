#!/usr/bin/env python3
"""「標本」マスク：黒い背景の中央に、音で育って呼吸する有機的な形を一つだけ置く（2026-11-14 参考リール5本の共通点）。
音（低域の大きさ・オンセット）で輪郭の大きさと揺れが変わる。出力はグレースケールの動画（白＝見える）。
使い方：python3 tools/specimen_mask.py --audio audio.wav --out mask.mp4 --sec 20 --seed 3
"""
import argparse, subprocess, wave
import numpy as np
ap = argparse.ArgumentParser(); ap.add_argument('--audio', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--sec', type=float, default=20); ap.add_argument('--fps', type=int, default=30); ap.add_argument('--seed', type=int, default=0); ap.add_argument('--rim', default='')  # 縁の光る膜と、オンセットで散る粒（白＝光）
a = ap.parse_args()
W, H = 270, 480  # 1/4 の解像度で作り、合成時に拡大する（縁はもともと柔らかい）
N = int(a.sec * a.fps)

# 音の特徴：フレームごとの低域（〜200Hz）と全体の大きさ、オンセット
w = wave.open(a.audio); sr = w.getframerate(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
hop = sr // a.fps; low = np.zeros(N); rms = np.zeros(N)
win = np.hanning(2048)
for f in range(N):
    s = x[f * hop: f * hop + 2048]
    if len(s) < 2048: s = np.pad(s, (0, 2048 - len(s)))
    sp = np.abs(np.fft.rfft(s * win)); fr = np.fft.rfftfreq(2048, 1 / sr)
    low[f] = sp[fr < 200].sum(); rms[f] = np.sqrt((s ** 2).mean())
norm = lambda v: (v - np.percentile(v, 5)) / (np.percentile(v, 95) - np.percentile(v, 5) + 1e-9)
low = np.clip(norm(low), 0, 1.3); rms = np.clip(norm(rms), 0, 1.3)
sm = lambda v, k: np.convolve(v, np.ones(k) / k, mode='same')
lowS = sm(low, 9); onset = np.clip(rms - sm(rms, 15), 0, None) * 3

rng = np.random.default_rng(a.seed)
K = 7; amp = rng.uniform(.05, .16, K) / np.arange(1, K + 1) ** .5; ph = rng.uniform(0, 6.28, K); sp_ = rng.uniform(.08, .3, K) * rng.choice([-1, 1], K)
lob = rng.integers(3, 7)  # 花びら・傘の数
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
cx, cy = W / 2, H * .5
dx, dy = (xx - cx) / W, (yy - cy) / W; r = np.hypot(dx, dy * .92); th = np.arctan2(dy, dx)
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', str(a.fps), '-i', '-',
                      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', a.out], stdin=subprocess.PIPE)
rim = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{W}x{H}', '-r', str(a.fps), '-i', '-',
                        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', a.rim], stdin=subprocess.PIPE) if a.rim else None
pts = []; angs = np.linspace(-np.pi, np.pi, 256)
for f in range(N):
    t = f / a.fps
    grow = 1 - np.exp(-t / 2.2)                         # 最初の数秒で育つ
    R = (.10 + .19 * grow) * (1 + .09 * lowS[f])        # 低域で膨らむ（画面の幅の約6割まで）
    edge = sum(amp[k] * np.sin((k + 1) * th + ph[k] + sp_[k] * t * 6.28 * .2) for k in range(K))
    E = lambda T: sum(amp[k] * np.sin((k + 1) * T + ph[k] + sp_[k] * t * 6.28 * .2) for k in range(K)) + .07 * np.sin(lob * T + .3 * t)
    edgeL = E(angs)
    edge += .07 * np.sin(lob * th + .3 * t) + min(.025, .02 * onset[f]) * np.sin(23 * th + 9 * t)   # オンセットで縁が細かく震える
    rr = np.minimum(R * (1 + edge), .40)
    m = np.clip((rr - r) / (.06 + .02 * lowS[f]), 0, 1) ** 1.6                           # 柔らかい縁
    q = np.clip(r / (rr + 1e-6), 0, 1)
    m *= (.5 + .5 * q ** .7) * (.78 + .22 * np.sin(q * 6.28 * 3.5 - t * .8 - 2 * lowS[f]))     # 縁が明るく、内側に年輪のような層（瑪瑙・菌類の傘）
    if rim:
        g = np.exp(-((r - rr) / (.0028 + .0025 * lowS[f])) ** 2) * (.30 + .40 * lowS[f])      # 膜：低域で太く明るく
        g += .25 * np.exp(-((r - rr * .62) / .003) ** 2) * (.4 + .6 * grow)                  # 内側のもう一本の層
        n = int(onset[f] * 40 + rms[f] * 3)                                                   # オンセットで縁から粒が散る
        if n:
            ang = rng.uniform(-np.pi, np.pi, n)
            pts.extend([[a_, min(R * (1 + np.interp(a_, angs, edgeL)), .40), rng.uniform(.002, .006), 1.0] for a_, in zip(ang)])
        img = np.zeros((H, W), np.float32)
        keep = []
        for pt in pts:
            pt[1] += pt[2]; pt[3] *= .955
            if pt[3] < .05: continue
            px, py = int(cx + np.cos(pt[0]) * pt[1] * W), int(cy + np.sin(pt[0]) * pt[1] * W / .92)
            if 0 <= px < W and 0 <= py < H: img[py, px] += pt[3]
            keep.append(pt)
        pts[:] = keep
        g = np.clip(g * (1 if t >= .5 else t / .5) + img, 0, 1)
        rim.stdin.write((g * 255).astype(np.uint8).tobytes())
    if t < .5: m *= t / .5                                                                   # 冒頭0.5秒は黒から
    p.stdin.write((np.clip(m, 0, 1) * 255).astype(np.uint8).tobytes())
p.stdin.close(); p.wait()
if rim: rim.stdin.close(); rim.wait()
