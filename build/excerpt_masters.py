#!/usr/bin/env python3
"""原本（Mac の Downloads）から配信用の抜粋 FLAC を作る（オーナーの Mac 上の Linux VM で実行する）。
使い方：python3 -I excerpt_masters.py <jobs.json> <原本フォルダ> <出力フォルダ>
jobs.json：[{"fs":"431302","file":"431302__...wav","kind":"sp"|"ch"|"amb","sec":30}, ...]

- 区間選び：
  - sp（個体の声）・ch（合唱）：0.25秒ごとの RMS を求め、「全体の中央値 +6dB を超える区間（鳴いている時間）」が最も多い区間。
  - amb（環境音）：1秒ごとの RMS の揺れが最も小さい区間（v0.25 以降の環境層と同じ）。
  - どちらも冒頭・末尾2秒を除き、クリップ（|x|≥0.999）を含む区間は避ける。
- 抜粋は原本の PCM サンプルをそのまま切り出す（16/24-bit 整数はビット完全）。
  10分を超える原本は冒頭8分から選ぶ（解析時間のため）。
  32-bit（整数・浮動小数）は 24-bit に、96kHz を超えるものは 96kHz に変換し、その旨を結果に記録する。
  3ch 以上は扱わない（チャンネルの並びの確認が必要なため、結果に skip と記録）。
- 出力：<出力>/<fs>.flac と <出力>/results.json（区間・形式・SHA-256・変換内容）。
"""
import hashlib, json, os, subprocess, sys
import numpy as np

JOBS, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()


def probe(p):
    s = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
                                   'stream=sample_rate,channels,bits_per_sample,bits_per_raw_sample,codec_name,sample_fmt:format=duration',
                                   '-of', 'json', p], capture_output=True, check=True).stdout)
    st = s['streams'][0]
    bits = int(st.get('bits_per_sample') or 0) or int(st.get('bits_per_raw_sample') or 0)
    return dict(sr=int(st['sample_rate']), ch=int(st['channels']), bits=bits, codec=st['codec_name'], fmt=st.get('sample_fmt'), dur=float(s['format']['duration']))


def decode(p, ch, sr_out, depth, limit=None, pick=None):
    """depth 16→s16le, 24→s24le。sr_out が原本と違えば soxr で変換。"""
    flt = ([f'channelmap=map={pick[0]}|{pick[1]}:channel_layout=stereo'] if pick else []) + ([f'aresample={sr_out}:resampler=soxr:precision=28'] if sr_out else [])
    af = ['-af', ','.join(flt)] if flt else []
    f = 's16le' if depth == 16 else 's24le'
    raw = subprocess.run(['ffmpeg', '-v', 'error'] + (['-t', str(limit)] if limit else []) + ['-i', p, '-map', '0:a:0'] + af + ['-f', f, '-acodec', 'pcm_' + f, '-'],
                         capture_output=True, check=True).stdout
    if depth == 16:
        x = np.frombuffer(raw, '<i2').astype(np.int32)
    else:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32)
        x = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        x = np.where(x & 0x800000, x - 0x1000000, x)
    return raw, x.reshape(-1, ch)


def choose(x, sr, sec, kind, full):
    n = x.shape[0]; L = int(sec * sr)
    if n <= L + 4 * sr:
        return 0, n
    hop = int(sr * (0.25 if kind != 'amb' else 1.0))
    mono = np.abs(x).max(axis=1).astype(np.float64) / full
    frames = n // hop
    m = mono[:frames * hop].reshape(frames, hop)
    rms = np.sqrt((x[:frames * hop].astype(np.float64) ** 2).mean(axis=1).reshape(frames, hop).mean(axis=1)) / full + 1e-9
    db = 20 * np.log10(rms); clip = m.max(axis=1) >= 0.999
    w = L // hop; lo = int(2 * sr / hop); hi = frames - w - int(2 * sr / hop)
    best, bi = None, lo
    if kind == 'amb':
        for i in range(lo, max(lo + 1, hi)):
            if clip[i:i + w].any(): continue
            v = db[i:i + w].std()
            if best is None or v < best: best, bi = v, i
    else:
        thr = np.median(db) + 6
        act = (db > thr).astype(np.int32); cs = np.concatenate([[0], np.cumsum(act)]); cc = np.concatenate([[0], np.cumsum(clip)])
        for i in range(lo, max(lo + 1, hi)):
            if cc[i + w] - cc[i]: continue
            v = cs[i + w] - cs[i]
            if best is None or v > best: best, bi = v, i
    s = bi * hop
    return s, min(n, s + L)


res = {}
rp = os.path.join(OUT, 'results.json')
if os.path.exists(rp): res = json.load(open(rp))
for j in json.load(open(JOBS)):
    fs = str(j['fs'])
    if fs in res and res[fs].get('ok'): continue
    p = os.path.join(SRC, j['file'])
    try:
        info = probe(p); notes = []
        pick = j.get('pick')
        if info['ch'] > 2 and not pick:
            res[fs] = dict(ok=False, skip=f"{info['ch']}ch（チャンネルの並びを確認してから）", info=info); continue
        if pick: notes.append(f"原本 {info['ch']}ch のうち {pick[0]+1}・{pick[1]+1}ch をステレオとして使用（サンプルはそのまま）")
        depth = info['bits'] if info['bits'] in (16, 24) and info['codec'].startswith('pcm_s') else 24
        if depth != info['bits'] or not info['codec'].startswith('pcm_s'):
            notes.append(f"{info['codec']} {info['bits']}-bit → 24-bit 整数に変換")
        sr_out = None
        if info['sr'] > 96000:
            sr_out = 96000; notes.append(f"{info['sr']}Hz → 96000Hz に変換（soxr）")
        limit = 480 if info['dur'] > 600 else None
        if limit: notes.append(f"原本 {info['dur']/60:.0f}分のうち冒頭{limit//60}分から区間を選択")
        nch = 2 if pick else info['ch']
        raw, x = decode(p, nch, sr_out, depth, limit, pick)
        sr = sr_out or info['sr']; full = 2 ** (depth - 1)
        a, b = choose(x, sr, float(j.get('sec', 30)), j['kind'], full)
        bps = depth // 8 * nch
        seg = raw[a * bps:b * bps]
        tmp = os.path.join(OUT, fs + '.tmp.raw'); open(tmp, 'wb').write(seg)
        out = os.path.join(OUT, fs + '.flac')
        f = 's16le' if depth == 16 else 's24le'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', f, '-ar', str(sr), '-ac', str(nch), '-i', tmp, '-map_metadata', '-1',
                        '-c:a', 'flac', '-compression_level', '8', '-sample_fmt', 's16' if depth == 16 else 's32', '-bits_per_raw_sample', str(depth), out], check=True)
        back = subprocess.run(['ffmpeg', '-v', 'error', '-i', out, '-f', f, '-acodec', 'pcm_' + f, '-'], capture_output=True, check=True).stdout
        os.remove(tmp)
        assert sha(back) == sha(seg), 'FLAC がビット完全でない'
        seg_x = x[a:b].astype(np.float64) / full
        peak = float(np.abs(seg_x).max()); rms = float(np.sqrt((seg_x ** 2).mean()))
        fb = open(out, 'rb').read()
        res[fs] = dict(ok=True, kind=j['kind'], src=j['file'], srcBytes=os.path.getsize(p), info=info, sr=sr, ch=nch, bits=depth,
                       start=a / sr, sec=(b - a) / sr, frames=b - a, peakDb=20 * np.log10(peak + 1e-12), rmsDb=20 * np.log10(rms + 1e-12),
                       pcmSha256=sha(seg), flacBytes=len(fb), flacSha256=sha(fb), notes=notes,
                       bitExact=not any('変換' in n for n in notes))
        print(fs, j['kind'], f"{a/sr:7.1f}s +{(b-a)/sr:4.1f}s", info['sr'], depth, nch, f"{len(fb)/1e6:5.2f}MB", ' / '.join(notes), flush=True)
    except Exception as e:
        res[fs] = dict(ok=False, error=repr(e)); print(fs, 'ERROR', e, flush=True)
    json.dump(res, open(rp, 'w'), ensure_ascii=False, indent=1)
json.dump(res, open(rp, 'w'), ensure_ascii=False, indent=1)
print('done', sum(1 for v in res.values() if v.get('ok')), 'ok /', len(res))
