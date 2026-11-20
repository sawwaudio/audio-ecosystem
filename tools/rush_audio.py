#!/usr/bin/env python3
"""「脳汁」系ショートの音：実録音の一番目立つ瞬間を切り出して、キック・低音・ハイハットの上に刻む（2026-11-20 オーナー指示
「ショートやリールはもっと脳汁出るコンテンツじゃないと勝てない。見る人は文章を読んでいない。視覚・聴覚の刺激が欲しい」→ 音は「自然音×ビート」）。
- 0秒目から録音の一番強い一打が鳴る（フェードインなし）。1小節目は一打のスタッター、2小節目でせり上がり、3小節目からドロップ。
- 5小節目でブレイク（キックを抜く）、6小節目から2回目のドロップ。最後の小節は頭の一打へ戻るようにして、ループ再生でつながる。
- キック・低音・ハイハット・せり上がりのノイズはここで合成する（他人の素材を使わない）。自然音は抜粋・音程の変更・逆再生・切り貼り。
出力：48kHz ステレオ wav と、映像用のイベント表（拍・小節・キック・自然音の一打の時刻と強さ）の JSON。
使い方：python3 tools/rush_audio.py --src rec.wav --out a.wav --events ev.json [--bpm 124] [--bars 8] [--seed 0]
"""
import argparse, json, subprocess
import numpy as np

SR = 48000
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()

def onsets(x, hop=256, n=1024):
    """スペクトルの立ち上がり（flux）と、その位置の音の強さ。強い順に、0.35秒以上離れたものを返す"""
    m = x.mean(1); w = np.hanning(n); fr = (len(m) - n) // hop
    if fr < 4: return []
    S = np.abs(np.fft.rfft(np.lib.stride_tricks.sliding_window_view(m, n)[::hop][:fr] * w, axis=1))
    fl = np.maximum(0, np.diff(np.log1p(S * 50), axis=0)).sum(1); fl = np.convolve(fl, np.ones(3) / 3, 'same')
    rms = np.sqrt((np.lib.stride_tricks.sliding_window_view(m, n)[::hop][:fr] ** 2).mean(1))[1:]
    sc = fl / (np.median(fl) + 1e-9) * (rms / (rms.max() + 1e-9)) ** .5
    out = []
    for i in np.argsort(-sc):
        t = (i + 1) * hop / SR
        if t < .05 or t > len(m) / SR - .6: continue
        if all(abs(t - o[0]) > .35 for o in out): out.append((t, float(sc[i])))
        if len(out) >= 16: break
    return out

def score(path, sec_max=90):
    """録音が「刻める」か：はっきりした一打がいくつあるか（雨・風のように一様な音は低い）"""
    x = load(path)[:SR * sec_max]; o = onsets(x)
    return (float(np.mean([s for _, s in o[:8]])) if len(o) >= 6 else 0.0), o

def env(n, a=.002, d=None):
    t = np.arange(n) / SR; e = np.minimum(1, t / a) if a else np.ones(n)
    return e * (np.exp(-t / d) if d else 1)

def kick(n=int(SR * .42)):
    t = np.arange(n) / SR; f = 46 + 110 * np.exp(-t / .035); ph = 2 * np.pi * np.cumsum(f) / SR
    k = np.sin(ph) * np.exp(-t / .17) + .35 * np.random.default_rng(1).standard_normal(n) * np.exp(-t / .004)
    return np.tanh(k * 1.6) * .9

def hat(rng, n=int(SR * .06)):
    w = rng.standard_normal(n); w = np.diff(np.concatenate([[0], w]))  # 高い方へ
    return w * env(n, .0005, .012) * .22

def sub(freq, n):
    t = np.arange(n) / SR; s = np.sin(2 * np.pi * freq * t) + .25 * np.sin(4 * np.pi * freq * t)
    return np.tanh(s * 1.3) * env(n, .004, .16) * .55

def pitch(x, semi):
    """音程を変える（再生速度ごと。短い一打なのでこれで十分）"""
    r = 2 ** (semi / 12); idx = np.arange(0, len(x) - 1, r); i0 = idx.astype(int)
    fr = (idx - i0)[:, None]; return x[i0] * (1 - fr) + x[i0 + 1] * fr

def place(buf, s, t, g=1.0):
    i = int(round(t * SR))
    if i >= len(buf) or i + len(s) <= 0: return
    a = max(0, -i); b = min(len(s), len(buf) - i); buf[i + a:i + b] += s[a:b] * g

def st(m): return np.stack([m, m], 1) if m.ndim == 1 else m

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--src', required=True); ap.add_argument('--out', required=True); ap.add_argument('--events', required=True)
    ap.add_argument('--bpm', type=float, default=124); ap.add_argument('--bars', type=int, default=8); ap.add_argument('--seed', type=int, default=0)
    a = ap.parse_args(); rng = np.random.default_rng(a.seed)
    src = load(a.src)[:SR * 120]; src /= (np.abs(src).max() + 1e-9)
    hits = onsets(src)
    if len(hits) < 6: raise SystemExit('はっきりした一打が足りない録音です（6未満）')
    beat = 60 / a.bpm; bar = beat * 4; T = bar * a.bars; N = int(T * SR)
    def chop(t0, L):
        i = max(0, int((t0 - .012) * SR)); s = src[i:i + int(L * SR)].copy(); n = len(s)
        f = np.ones(n); fo = min(n, int(.04 * SR)); f[-fo:] = np.linspace(1, 0, fo); f[:48] = np.linspace(0, 1, 48); return s * f[:, None]
    H = [chop(t, .3) for t, _ in hits[:8]]; big = chop(hits[0][0], beat * 2)   # 一番強い一打（長め）
    H = [h / (np.abs(h).max() + 1e-9) for h in H]; big /= np.abs(big).max() + 1e-9
    drums = np.zeros((N, 2)); bass = np.zeros((N, 2)); fx = np.zeros((N, 2)); bed = np.zeros((N, 2))
    ev = {'bpm': a.bpm, 'beat': beat, 'bar': bar, 'sec': T, 'bars': [i * bar for i in range(a.bars)], 'kicks': [], 'hits': [], 'drops': [], 'breaks': []}
    DROP1, BREAK, DROP2 = 2, 4, 5   # 小節番号（0始まり）
    ev['drops'] = [DROP1 * bar, DROP2 * bar]; ev['breaks'] = [BREAK * bar]
    K = kick(); root = 55 * 2 ** (rng.integers(-2, 3) / 12)
    prog = [0, 0, 3, -2]   # 小節ごとの低音の動き（半音）
    def hit(s, t, g, semi=0, rev=False):
        s2 = pitch(s, semi) if semi else s
        if rev: s2 = s2[::-1]
        place(fx, s2, t, g); ev['hits'].append({'t': round(t, 3), 'g': round(g, 2), 'semi': semi, 'rev': rev})
    # 0小節目：一打 → 16分のスタッター（だんだん短く）
    hit(big, 0, 1.0)
    for k, q in enumerate([2.0, 2.5, 3.0, 3.25, 3.5, 3.75]):
        hit(H[0][:int(SR * beat / 4)], q * beat, .55 + .06 * k, semi=[0, 0, 5, 7, 12, 12][k])
    # 自然音の地（全体に薄く。キックで沈む）
    bi = int(max(0, hits[0][0] - 1) * SR); b0 = src[bi:bi + N]
    if len(b0) < N: b0 = np.concatenate([b0, src[:N - len(b0)]])
    bed[:len(b0)] = b0[:N] * .22
    # 1小節目：せり上がり（ノイズのスイープ）と加速する一打
    nb = int(bar * SR); nz = rng.standard_normal(nb); tt = np.arange(nb) / nb
    from numpy.fft import rfft, irfft
    L = 2400; hw = np.hanning(2 * L); rise = np.zeros(nb + 2 * L)   # 窓を重ねて段差なくスイープ
    for i in range(0, nb, L):
        c = nz[i:i + 2 * L]
        if len(c) < 2 * L: break
        F = np.linspace(0, 1, L + 1); rise[i:i + 2 * L] += irfft(rfft(c * hw) * np.clip((F - (.62 - .57 * tt[i])) * 12, 0, 1))
    rise = rise[:nb] * tt ** 2.5 * .16; place(fx, st(rise), bar, 1)
    for k in range(8): hit(H[1 + k % 3], bar + k * beat / 2, .45 + .05 * k, semi=k % 4 * 2)
    for k in range(8): hit(H[1][:int(SR * beat / 8)], bar * 2 - beat + k * beat / 8, .3 + .07 * k, semi=k)
    hit(H[0], bar * 2 - beat / 2, .7, rev=True)
    # ドロップ：4つ打ち・裏の低音・ハイハット・8分の一打
    def groove(b0, b1, dense):
        for b in range(b0, b1):
            t0 = b * bar; r = root * 2 ** (prog[(b - b0) % 4] / 12)
            for q in range(4):
                place(drums, st(K), t0 + q * beat, 1); ev['kicks'].append(round(t0 + q * beat, 3))
                place(bass, st(sub(r, int(beat * .45 * SR))), t0 + q * beat + beat / 2, 1)
                place(drums, st(hat(rng)), t0 + q * beat + beat / 2, 1)
                if dense: place(drums, st(hat(rng) * .5), t0 + q * beat + beat / 4 * 3, 1)
            pat = [0, 3, 5, 7] if dense else [0, 6]
            for j, s16 in enumerate(pat):
                hit(H[(b * 3 + j) % len(H)], t0 + s16 * beat / 2, .62, semi=[0, 7, 12, 5][(b + j) % 4])
            if b == b1 - 1: hit(H[0], t0 + bar - beat / 2, .6, rev=True)
    groove(DROP1, BREAK, False)
    # ブレイク：キックを抜いて一打を伸ばす
    t0 = BREAK * bar; hit(big, t0, .9); hit(pitch(big, -5), t0 + beat * 2, .7)
    place(fx, st(rise), t0, .8)
    groove(DROP2, a.bars - 1, True)
    # 最後の小節：キックはそのまま、後半で一打へ戻る（ループ）
    b = a.bars - 1; t0 = b * bar
    for q in range(2): place(drums, st(K), t0 + q * beat, 1); ev['kicks'].append(round(t0 + q * beat, 3))
    hit(H[0], t0 + beat * 2, .55, semi=12)
    rb = big[:int(beat * 2 * SR)][::-1].copy(); rb *= np.linspace(.15, 1, len(rb))[:, None] ** 2   # 頭の一打の逆再生で頭へ吸い込む（ループのつなぎ）
    place(fx, rb, T - len(rb) / SR, .9); ev['hits'].append({'t': round(T - len(rb) / SR, 3), 'g': .9, 'semi': 0, 'rev': True})
    # サイドチェイン（キックで地と一打を少し沈める）
    sc = np.ones(N)
    for k in ev['kicks']:
        i = int(k * SR); n = min(N - i, int(beat * SR)); sc[i:i + n] = np.minimum(sc[i:i + n], 1 - .55 * np.exp(-np.arange(n) / SR / .09))
    mix = drums * .62 + bass * .7 + (fx * 1.05 + bed) * sc[:, None]   # 主役は自然音の一打
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    tmp = a.out + '.raw.wav'
    import wave
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32000).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', 'loudnorm=I=-14.5:TP=-1.6:LRA=7', '-ar', str(SR), '-ac', '2', a.out], check=True)
    import os; os.remove(tmp)
    ev['hits'].sort(key=lambda h: h['t']); json.dump(ev, open(a.events, 'w'), indent=0)
    print(a.out, f'{T:.2f}秒', len(ev['kicks']), 'キック', len(ev['hits']), '一打')
