#!/usr/bin/env python3
"""「脳汁」系ショートの映像（1080×1920・文字なし）。tools/rush_audio.py のイベント表（拍・キック・自然音の一打）に合わせて描く。
2026-11-20 オーナー指示「リールを見る人は文章を読んでいない。視覚・聴覚の刺激物を欲している」→ 映像は2種類を A/B。
  burst   … 音に同期して爆発：全面・高彩度。一打ごとに衝撃波の輪と粒が弾け、キックで画面が跳ねる。小節ごとに色と対称の向きが切り替わる
  satisfy … 気持ちいい系：とろみのある液体の玉（メタボール）がゆっくり回り、一打ごとに新しい玉が生まれて合体する。キックで表面に波紋。カットなし
どちらも：最初のコマから明るい絵がある。画面全体の明るさの急な変化は1秒3回以下（光過敏への配慮・tools/reels/qa.py で確認）。
使い方：python3 tools/rush_visual.py --look burst --audio a.wav --events ev.json --out v.mp4 [--seed 0] [--hue 0.6]
"""
import argparse, json, subprocess
import numpy as np, cv2

ap = argparse.ArgumentParser(); ap.add_argument('--look', required=True, choices=['burst', 'satisfy']); ap.add_argument('--audio', required=True)
ap.add_argument('--events', required=True); ap.add_argument('--out', required=True); ap.add_argument('--seed', type=int, default=0); ap.add_argument('--hue', type=float, default=None)
ap.add_argument('--fps', type=int, default=30)
a = ap.parse_args(); ev = json.load(open(a.events)); rng = np.random.default_rng(a.seed); FPS = a.fps
W, H = 540, 960; SEC = ev['sec']; NF = int(SEC * FPS); HUE0 = rng.random() if a.hue is None else a.hue
# 音の大きさ（コマごと・低域）
SR = 24000; raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.audio, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32); hop = SR // FPS
rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(NF)]); rms = np.clip(rms / np.percentile(rms, 95), 0, 1.3)
lowf = np.convolve(x, np.ones(240) / 240, 'same'); low = np.array([np.sqrt(np.mean(lowf[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(NF)]); low = np.clip(low / np.percentile(low, 95), 0, 1.3)
sm = lambda v, k: np.convolve(v, np.ones(k) / k, 'same'); rmsS = sm(rms, 5); lowS = sm(low, 7)

def pal(t, hue, sat=1.0):
    """コサインパレット（iq）。t: 0..1 の配列 → RGB 0..1"""
    c = np.array([1.0, 1.0, 1.0]); d = np.array([0.0, 0.33, 0.67]) + hue
    return np.clip(.5 + .5 * sat * np.cos(2 * np.pi * (c * t[..., None] + d)), 0, 1)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); X = (xx - W / 2) / (W / 2); Y = (yy - H / 2) / (W / 2)   # 横が -1..1
R = np.hypot(X, Y); TH = np.arctan2(Y, X)
kicks = np.array(ev['kicks']); hits = ev['hits']; bars = np.array(ev['bars']); drops = ev['drops']
def since(arr, t):
    p = arr[arr <= t + 1e-6]; return t - p[-1] if len(p) else 9.0

def ff(path):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', a.audio,
                             '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '12M', '-bufsize', '24M',
                             '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path], stdin=subprocess.PIPE)

def burst():
    P = np.zeros((0, 7), np.float32)   # x, y, vx, vy, life, hue, size
    rings = []; layer = np.zeros((H, W, 3), np.float32); hi = 0; p = ff(a.out)
    for f in range(NF):
        t = f / FPS; b = int(np.searchsorted(bars, t, 'right') - 1); hue = HUE0 + .23 * b + (.5 if b >= 5 else 0)
        sym = 6 if b % 2 == 0 else 4; rot = .35 * b + .08 * t
        # 背景：対称に折りたたんだ縞模様（小節ごとに色と折り数が変わる）
        th = np.abs(((TH + rot) % (2 * np.pi / sym)) - np.pi / sym)
        u = R * (2.2 + .8 * lowS[f]) - t * .9; v = th * 3
        fld = np.sin(u * 3 + np.sin(v * 4 + t * 1.3) * 1.6) * .5 + .5
        bg = pal(fld * .35 + R * .15 + t * .05, hue, 1.0) ** 1.8 * (.10 + .55 * fld ** 3)[..., None] * (.75 + .25 * rmsS[f]) * np.exp(-R * .5)[..., None]   # 暗い地に細い光の筋
        # 一打：衝撃波の輪と粒
        while hi < len(hits) and hits[hi]['t'] <= t + 1e-6:
            h = hits[hi]; g = h['g']; big = g >= .85 or any(abs(h['t'] - d) < .02 for d in drops)
            cx, cy = (0, 0) if big else (rng.uniform(-.55, .55), rng.uniform(-.8, .8)); n = int(70 + 160 * g * (2 if big else 1))
            ang = rng.uniform(0, 2 * np.pi, n); sp = rng.uniform(.6, 2.4, n) * (1.6 if big else 1)
            hh = (hue + .5 + h['semi'] / 24 + rng.normal(0, .05, n)) % 1
            P = np.vstack([P, np.stack([np.full(n, cx), np.full(n, cy), np.cos(ang) * sp, np.sin(ang) * sp, np.ones(n), hh, rng.uniform(1.5, 4.5, n) * (1.3 if big else 1)], 1).astype(np.float32)])
            rings.append([cx, cy, t, (hue + .5) % 1, 2.0 if big else 1.0]); hi += 1
        dt = 1 / FPS; P[:, 0] += P[:, 2] * dt; P[:, 1] += P[:, 3] * dt; P[:, 2:4] *= .9; P[:, 4] -= dt / 1.1; P = P[(P[:, 4] > 0) & (np.abs(P[:, 0]) < 1.3) & (np.abs(P[:, 1]) < 2)]
        layer *= .80
        if len(P):
            col = pal(P[:, 5], 0, 1.0) * 1.2
            for (px, py, _, _, life, _, s), c in zip(P, col):
                cv2.circle(layer, (int(W / 2 + px * W / 2), int(H / 2 + py * W / 2)), max(1, int(s * (.5 + life))), (c * life).tolist(), -1, cv2.LINE_AA)
        for rg in rings:
            age = t - rg[2]
            if age > .55: continue
            rr = int((.05 + age * 2.2 * rg[4]) * W / 2); c = pal(np.array(rg[3]), 0) * (1 - age / .55) * 1.1
            cv2.circle(layer, (int(W / 2 + rg[0] * W / 2), int(H / 2 + rg[1] * W / 2)), rr, c.tolist(), max(2, int(10 * (1 - age / .55) * rg[4])), cv2.LINE_AA)
        rings = [r for r in rings if t - r[2] <= .55]
        glow = cv2.GaussianBlur(layer, (0, 0), 9)
        img = bg + layer * .9 + glow * 1.3
        # キックで画面が跳ねる（拡大して戻る）
        k = since(kicks, t); z = 1 + .075 * np.exp(-k / .07) if k < .5 else 1.0
        if z > 1.001:
            M = cv2.getRotationMatrix2D((W / 2, H / 2), 0, z); img = cv2.warpAffine(img, M, (W, H), borderMode=cv2.BORDER_REFLECT)
        img = img / (1 + img * .35)   # トーンマップ（白飛びを抑える）
        p.stdin.write((np.clip(img, 0, 1) * 255).astype(np.uint8).tobytes())
    p.stdin.close(); p.wait()

def satisfy():
    nb0 = 6; B = [dict(r=.25 + .04 * (i % 3), a=i * 2 * np.pi / nb0, w=(.22 + .06 * i) * (1 if i % 2 else -1), d=.35 + .12 * (i % 3), born=-9) for i in range(nb0)]
    hi = 0; p = ff(a.out); L = np.array([-.45, -.65, .62]); L /= np.linalg.norm(L)
    for f in range(NF):
        t = f / FPS
        while hi < len(hits) and hits[hi]['t'] <= t + 1e-6:
            h = hits[hi]; hi += 1
            if h['g'] < .5: continue
            B.append(dict(r=.13 + .12 * h['g'], a=rng.uniform(0, 2 * np.pi), w=rng.uniform(-.5, .5), d=rng.uniform(.6, 1.0), born=t))
            if len(B) > nb0 + 5: B.pop(nb0)
        k = since(kicks, t); fld = np.zeros((H, W), np.float32)
        for bl in B:
            age = t - bl['born']; grow = min(1, (1 - np.exp(-age / .12)) * (1 + .25 * np.exp(-age / .25))) if bl['born'] > -1 else 1   # ぷるっと出てくる
            d = bl['d'] * (1 - .6 * min(1, max(0, age - .8) / 3.5)) if bl['born'] > -1 else bl['d'] * (1 + .15 * np.sin(t * .7 + bl['a']))   # 生まれた玉は真ん中へ寄って合体
            ang = bl['a'] + bl['w'] * t; cx, cy = d * np.cos(ang) * .85, d * np.sin(ang) * 1.55
            fld += (bl['r'] * grow) ** 2 / ((X - cx) ** 2 + (Y - cy) ** 2 + 1e-4)
        if k < .6: fld *= 1 + .05 * np.exp(-k / .18) * np.sin(R * 26 - k * 38)   # キックで波紋
        hgt = np.sqrt(1.4 * np.tanh(np.clip(fld - .9, 0, None) / 1.4)); inside = np.clip((fld - 1.0) * 8, 0, 1)   # 高さは頭打ちにして中心の段差を消す
        gy, gx = np.gradient(hgt * 60); nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1); nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
        dif = np.clip(nrm @ L, 0, 1); hv = 2 * dif[..., None] * nrm - L; spec = np.clip(hv[..., 2], 0, 1) ** 40
        fres = (1 - nrm[..., 2]) ** 2
        base = pal(Y * .18 + X * .05 + t * .04 + HUE0, 0, 1.0) ** 1.4
        col = base * (.25 + .85 * dif)[..., None] + spec[..., None] * 1.1 + fres[..., None] * pal(Y * .18 + HUE0 + .45 + t * .04, 0) * .6
        bgc = pal(np.full((H, W), HUE0 + .5) + Y * .1, 0, .7) ** 2 * (.10 + .05 * lowS[f])
        sh = np.clip((fld - .45) * 1.5, 0, 1)[..., None] * .5   # 玉のまわりの影
        img = bgc * (1 - sh) * (1 - inside[..., None]) + col * (.9 + .2 * rmsS[f]) * inside[..., None]
        p.stdin.write((np.clip(img, 0, 1) * 255).astype(np.uint8).tobytes())
    p.stdin.close(); p.wait()

burst() if a.look == 'burst' else satisfy()
print(a.out, NF, 'コマ')
