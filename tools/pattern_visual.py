#!/usr/bin/env python3
"""参考リールごとの映像パターン（実写素材を使わず、音から描く縦動画 1080×1920）。
2026-11-14 オーナー指示「1種類に統合せず、それぞれの動画を参考にしたそれぞれのパターンを作る」。
パターンの定義（参考・パラメーター・版）は tools/reels/patterns.json。ここは描画だけ。

モード：
  meadow   … 花畑：画面の下半分に浅いピントの花、上に淡い空と日の光。中域で風に揺れ、高域で花の縁が光る
  komorebi … 木漏れ日：暗い葉の重なりの隙間から光の筋と、地面にゆらぐ光の斑点。低域で光の筋が明るく、高域で斑点がまたたく
  saiun    … 彩雲：太陽の近くの薄い雲の縁が、虹色に淡く色づいてゆっくり流れる。低域で明るさ、中域で色の移り
音との対応はどれも 0.5 秒の平均でなめらかにし、点滅は起こさない（光過敏への配慮）。

使い方：python3 tools/pattern_visual.py --mode komorebi --audio a.wav --out v.mp4 --sec 30 --seed 1 [--params '{"sway":1.2}']
"""
import argparse, json, subprocess, wave
import numpy as np, cv2

ap = argparse.ArgumentParser(); ap.add_argument('--mode', required=True, choices=['meadow', 'komorebi', 'saiun'])
ap.add_argument('--audio', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--sec', type=float, default=30); ap.add_argument('--fps', type=int, default=30); ap.add_argument('--seed', type=int, default=0)
ap.add_argument('--params', default='{}', help='patterns.json の visual.params（JSON）')
a = ap.parse_args(); P = json.loads(a.params)
W, H = 360, 640; N = int(a.sec * a.fps); rng = np.random.default_rng(a.seed)
pr = lambda k, d: float(P.get(k, d))

# ---- 音の特徴：低域・中域・高域（0.5秒の平均） ----
w = wave.open(a.audio); sr = w.getframerate(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
hop = sr // a.fps; win = np.hanning(2048); fr = np.fft.rfftfreq(2048, 1 / sr); B = np.zeros((N, 3))
for f in range(N):
    s = x[f * hop: f * hop + 2048]; s = np.pad(s, (0, 2048 - len(s)))
    sp = np.abs(np.fft.rfft(s * win)); B[f] = [sp[fr < 300].sum(), sp[(fr >= 300) & (fr < 3000)].sum(), sp[fr >= 3000].sum()]
for j in range(3):
    v = B[:, j]; v = (v - np.percentile(v, 10)) / (np.percentile(v, 95) - np.percentile(v, 10) + 1e-9)
    B[:, j] = np.convolve(np.clip(v, 0, 1.2), np.ones(15) / 15, mode='same')

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
def noise(h, w_, cells, oct_=3, seed=0):
    """なめらかなノイズ（値ノイズを拡大して重ねる）。0〜1"""
    r = np.random.default_rng(seed); out = np.zeros((h, w_), np.float32); amp = 1; tot = 0
    for o in range(oct_):
        c = cells * 2 ** o; g = r.random((int(c * h / w_) + 3, c + 3)).astype(np.float32)
        out += amp * cv2.resize(g, (w_ + int(w_ * 3 / c), h + int(h * 3 / (c * h / w_))), interpolation=cv2.INTER_CUBIC)[:h, :w_]; tot += amp; amp *= .5
    out /= tot; return (out - out.min()) / (out.max() - out.min() + 1e-9)
def tone(img, sat=1.25):
    img = 1 - np.exp(-np.maximum(img, 0) * 1.4); lum = img.mean(2, keepdims=True); return lum + (img - lum) * sat
vig = (1 - .5 * (((xx - W / 2) / (W * .8)) ** 2 + ((yy - H / 2) / (H * .72)) ** 2))[..., None].clip(.3, 1)

def disc(img, cx, cy, r, col, br, soft=False):
    x0, x1, y0, y1 = int(max(0, cx - 2 * r)), int(min(W, cx + 2 * r)), int(max(0, cy - 2 * r)), int(min(H, cy + 2 * r))
    if x1 <= x0 or y1 <= y0: return
    d = np.hypot(xx[y0:y1, x0:x1] - cx, yy[y0:y1, x0:x1] - cy) / r
    k = np.clip(1 - d, 0, 1) ** 1.6 if soft else np.clip(1.12 - d, 0, 1) ** .7
    img[y0:y1, x0:x1] += k[..., None] * col * br

# ---- 花畑 ----
if a.mode == 'meadow':
    PAL = {'spring': [(1., .62, .74), (1., .86, .45), (1., .97, .92), (.86, .58, 1.)], 'summer': [(1., .80, .30), (1., .52, .32), (1., .95, .80), (.95, .40, .55)],
           'white': [(1., .98, .94), (1., .93, .75), (.92, .95, 1.), (1., .88, .90)]}
    cols = np.array(PAL.get(P.get('palette', 'spring'), PAL['spring'])); hz = pr('horizon', .52)
    sky = np.zeros((H, W, 3), np.float32); g = (yy / H)[..., None]
    sky += (1 - g) * np.array((.30, .42, .62)) + g * np.array((.95, .70, .45)); sky *= .8   # 夕方前の澄んだ空
    grass = np.clip((yy - H * (hz - .05)) / (H * .25), 0, 1)[..., None]
    base = sky * (1 - grass) + grass * np.array((.22, .36, .12)) * (1 - .4 * (yy / H))[..., None]
    M = int(pr('flowers', 110)); fz = rng.uniform(0, 1, M) ** .7   # 奥（0）〜手前（1）
    fx = rng.uniform(-20, W + 20, M); fy = H * hz + (H * (1 - hz) + 60) * fz + rng.normal(0, 8, M); fy[fz > .92] -= rng.uniform(0, 160, (fz > .92).sum())
    fr_ = 2 + 34 * fz ** 2.2; fc = rng.integers(0, len(cols), M); ph = rng.uniform(0, 6.28, M); order = np.argsort(fz)
    sunx, suny = W * rng.uniform(.2, .8), H * rng.uniform(.12, .28)
    def frame(f, t):
        img = base.copy(); b0, b1, b2 = B[f]
        img += np.exp(-(((xx - sunx) / (W * .30)) ** 2 + ((yy - suny) / (H * .16)) ** 2))[..., None] * np.array((1., .88, .62)) * (.30 + .15 * b0)
        sway = pr('sway', 1.0) * (3 + 7 * b1)
        for m in order:
            z = fz[m]; dx = sway * z * np.sin(t * .7 + ph[m] + fx[m] * .01); dofv = abs(z - pr('focus', .55))   # ピントからの距離でぼかす
            r = fr_[m] * (1 + 1.6 * dofv); br = (.9 + .45 * b2 * (z > .3)) * (1 - .5 * dofv)
            disc(img, fx[m] + dx, fy[m], r, cols[fc[m]], br, soft=dofv > .25)
        return img

# ---- 木漏れ日 ----
elif a.mode == 'komorebi':
    leaf = [noise(H + 200, W + 200, 11, 4, a.seed + k) for k in range(2)]
    ang = np.deg2rad(pr('angle', 62)); dirx, diry = np.cos(ang), np.sin(ang)
    proj = (xx * dirx + yy * diry); perp = (xx * -diry + yy * dirx)
    shafts = noise(1, 2000, 40, 3, a.seed + 9)[0]
    warm = np.array((1., .86, .55)); green = np.array((.10, .20, .07))
    def frame(f, t):
        b0, b1, b2 = B[f]; ox = int(60 + 40 * np.sin(t * .05)); oy = int(60 + 30 * np.cos(t * .04))
        l1 = leaf[0][oy:oy + H, ox:ox + W]; l2 = leaf[1][100 - oy // 2:100 - oy // 2 + H, 100 - ox // 2:100 - ox // 2 + W]
        sway = .03 * pr('sway', 1.0) * (1 + 2 * b1) * np.sin(t * .9)
        gap = np.clip((l1 * .6 + l2 * .4 + sway - pr('density', .68)) * 9, 0, 1)   # 葉の隙間（1＝空）
        glow = cv2.GaussianBlur(gap, (0, 0), 6)                                 # 隙間の光のにじみ（レンズのぼけ）
        img = green[None, None] * (1 - gap[..., None]) * (.45 + .5 * l2[..., None]) + glow[..., None] * np.array((.45, .75, .20)) * 1.2   # 光を透かす葉
        img = img * (1 - gap[..., None]) + gap[..., None] * np.array((1., .93, .72)) * 1.6 + glow[..., None] * warm * 1.4
        idx = ((perp - perp.min()) * .9 + t * 2).astype(int) % len(shafts)
        ray = shafts[idx] ** 3 * np.clip(1 - proj / (H * 1.15), 0, 1)
        img += ray[..., None] * warm * (.25 + .45 * b0) * pr('rays', 1.0)
        spot = cv2.GaussianBlur(gap, (0, 0), 3) ** 2 * (yy / H > .55)          # 地面の光の斑点
        img += spot[..., None] * warm * (.3 + .35 * b2) * np.clip((yy / H - .55) * 4, 0, 1)[..., None]
        return img

# ---- 彩雲 ----
else:
    cl = [noise(H + 300, W + 300, 3, 5, a.seed + k) for k in range(2)]
    sunx, suny = W * rng.uniform(.3, .7), H * rng.uniform(.18, .32)
    def hue(hh):  # 淡い虹色（0〜1 → RGB）
        return np.stack([.5 + .5 * np.cos(6.283 * (hh + o)) for o in (0, .33, .67)], -1)
    def frame(f, t):
        b0, b1, b2 = B[f]; ox = int(150 + 120 * np.sin(t * .02)); oy = int(150 + t * 1.5) % 140
        c = cl[0][oy:oy + H, ox:ox + W] * .65 + cl[1][oy // 2:oy // 2 + H, 300 - ox:300 - ox + W] * .35
        th = np.clip((c - pr('cover', .45)) * 3, 0, 1)                              # 雲の厚み
        d = np.hypot(xx - sunx, yy - suny) / W
        sky = (1 - (yy / H))[..., None] * np.array((.30, .48, .72)) + (yy / H)[..., None] * np.array((.62, .70, .80))
        edge = th * (1 - th) * 4 * np.exp(-d * 1.6)                                  # 太陽に近い雲の縁ほど色づく
        iri = hue(.15 + th * .55 + d * .7 + t * .01 * (1 + b1) * pr('drift', 1.0)) * .45 + .55   # 淡い色（白に寄せる）
        img = sky * (1 - th[..., None] * .7) + th[..., None] * np.array((.92, .92, .95)) * (.55 + .3 * b0)
        img += (cv2.GaussianBlur(edge, (0, 0), 4) * 2.0)[..., None] * (iri - .55) * (.9 + .4 * b0) * pr('iris', 1.0)
        img += np.exp(-(d / .18) ** 2)[..., None] * np.array((1., .97, .9)) * (.55 + .2 * b0)
        return img

proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(a.fps), '-i', '-',
                         '-vf', 'scale=1080:1920:flags=bicubic,gblur=sigma=1.6,noise=alls=4:allf=t,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', a.out], stdin=subprocess.PIPE)
fin, fout = pr('fade_in', 1.2), pr('fade_out', 1.5)
# 文字の下だけ、なだらかに暗くする（明るい光の上でも題名・クレジットが読めるように。title_y は 1080×1920 の座標）
ty = pr('title_y', 820) / 3 + 30; scrim = (1 - pr('scrim', .5) * np.exp(-((yy - ty) / 62) ** 2) - .45 * np.exp(-((yy - 573) / 26) ** 2))[..., None]
for f in range(N):
    t = f / a.fps; img = tone(frame(f, t)) * vig * scrim
    fade = min(1, t / fin if fin > 0 else 1, (a.sec - t) / fout if fout > 0 else 1)
    proc.stdin.write((np.clip(img * fade, 0, 1) * 255).astype(np.uint8).tobytes())
proc.stdin.close(); proc.wait()
