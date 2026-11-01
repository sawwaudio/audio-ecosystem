#!/usr/bin/env python3
"""環境層（fieldBed）の取り込み（汎用）。使い方：python3 -I build/import_beds.py <spec.json> <out.json> [原本フォルダ]
spec.json は {"beds":[{id,fs,user,file,sha,jp,en,title,author,license,licenseURL,date,location,area,habitats,activity,activityBasis,roles,env,notes,defaultLevel?}]}。
v0.25 の import_japan_beds.py を一般化したもの（24-bit 以外の原本は24-bitへ変換し、その旨を記録する）。


入力：オーナーのMacからステージングした原本WAV（Freesound・24-bit）。
出力：audio/pcm/<id>[.partN].wav（原本と同じビット深度・サンプルレートの抜粋）、
      audio/compat/<id>.mp3（v0.23互換：44.1kHz・モノラル・128kbps）、
      build/japan_beds.json（録音データ・メタデータ・マニフェスト・監査行の素材）。
原則：
- 原本は無加工でMacに保管（リポジトリには入れない。100MB超のため）。
- 抜粋は原本PCMのサンプルをそのまま切り出す（再量子化・リサンプルなし＝ビット完全）。
- 区間は1秒ごとのRMSの揺れが最小の45秒を自動選択（冒頭・末尾5秒は除外）。聴感確認は未実施。
"""
import hashlib, json, os, struct, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC, OUT = sys.argv[1], sys.argv[2]
SRC = sys.argv[3] if len(sys.argv) > 3 else '/mnt/user-data/uploads/Downloads'
MAX_PART = 14 * 1024 * 1024
EXCERPT = 45.0
MAX_GAIN = 16.0
TARGET = None  # 既存の環境層から求める
sha = lambda b: hashlib.sha256(b).hexdigest()

BEDS = json.load(open(SPEC, encoding='utf-8'))['beds']


def probe(path):
    s = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
                                   'stream=sample_rate,channels,bits_per_sample,codec_name:format=duration', '-of', 'json', path],
                                  capture_output=True, check=True).stdout)
    st = s['streams'][0]
    return int(st['sample_rate']), int(st['channels']), int(st['bits_per_sample']), st['codec_name'], float(s['format']['duration'])


def read_s24(path, ch):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-f', 's24le', '-acodec', 'pcm_s24le', '-'],
                         capture_output=True, check=True).stdout
    b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
    v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
    v = np.where(v >= 1 << 23, v - (1 << 24), v)
    return raw, v.reshape(-1, ch)


def make_wav(data, sr, ch, bits):
    bps = bits // 8
    return (b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVE' + b'fmt ' +
            struct.pack('<IHHIIHH', 16, 1, ch, sr, sr * ch * bps, ch * bps, bits) + b'data' + struct.pack('<I', len(data)) + data)


def write(rel, data):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb').write(data)
    return {'path': rel, 'bytes': len(data), 'sha256': sha(data)}


def out_ms(x):
    return float((x ** 2).mean()) if x.shape[1] == 2 else 0.5 * float((x ** 2).mean())


def decode_f(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    ch = probe(path)[1]
    return np.frombuffer(raw, '<f4').reshape(-1, ch).astype(np.float64)


def target_level():
    """既存の環境層（fieldBed）の互換MP3での演奏時RMS（gain込み）の中央値。"""
    man = json.load(open(os.path.join(ROOT, 'data/audio_manifest.json')))
    recs = {r['id']: r for r in json.load(open(os.path.join(ROOT, 'data/recording_licenses.json')))} if os.path.exists(os.path.join(ROOT, 'data/recording_licenses.json')) else {}
    vals = []
    for rid in ['river-esk', 'forest-leaves', 'forest-wind', 'rain-field', 'fire-field']:
        c = man['recordings'][rid]['compat']
        x = decode_f(os.path.join(ROOT, c['path']))
        vals.append(np.sqrt(out_ms(x)) * c['gain'])
    return float(np.median(vals)), [round(v, 4) for v in vals]


def main():
    tgt, vals = 0.03464990840950625, 'v0.25 と同じ基準（既存の環境層5本の中央値）'
    print('target RMS', tgt, vals)
    out = {'target': tgt, 'targetFrom': vals, 'beds': []}
    for b in BEDS:
        src = os.path.join(SRC, b['file'])
        blob = open(src, 'rb').read()
        assert sha(blob) == b['sha'], ('SHA mismatch', b['id'])
        sr, ch, bits, codec, dur = probe(src)
        assert ch <= 2, (b['id'], 'チャンネル数', ch)
        exact = codec == 'pcm_s24le' and bits == 24  # それ以外（32-bit・float・AIFF）は24-bitへ変換
        raw, q = read_s24(src, ch)
        x = q.astype(np.float64) / (1 << 23)
        # 1秒ごとのRMS（dB）
        n = len(x) // sr
        db = np.array([10 * np.log10(max(1e-12, (x[i * sr:(i + 1) * sr] ** 2).mean())) for i in range(n)])
        pk = np.array([np.abs(x[i * sr:(i + 1) * sr]).max() for i in range(n)])
        L = int(min(EXCERPT, n - 2))  # 原本が短い場合は全長に近い長さ
        lo = min(5, max(0, (n - L) // 2)); hi = n - lo - L
        med = float(np.median(db))
        best = None
        for s in range(lo, hi + 1):
            w = db[s:s + L]
            if w.mean() < med - 3:  # 静かすぎる区間は避ける
                continue
            score = float(w.std()) + 0.5 * float(np.log10(pk[s:s + L].max() / max(1e-9, np.median(pk[s:s + L]))) * 20) / 6
            if best is None or score < best[0]:
                best = (score, s)
        start_s = best[1]
        a, z = start_s * sr, (start_s + L) * sr
        seg = q[a:z]
        segraw = raw[a * ch * 3:z * ch * 3]
        # ビット完全の確認：切り出しバイト列が原本のPCMそのもの
        assert np.array_equal(np.frombuffer(segraw, np.uint8).reshape(-1, 3)[:5].tobytes(), segraw[:15])
        xs = seg.astype(np.float64) / (1 << 23)
        peak = float(np.abs(xs).max())
        per = max(1, MAX_PART // (ch * 3))
        parts = []
        frames = len(seg)
        for i, s in enumerate(range(0, frames, per)):
            e = min(frames, s + per)
            suffix = '' if frames <= per else f'.part{i + 1}'
            parts.append(write(f"audio/pcm/{b['id']}{suffix}.wav", make_wav(segraw[s * ch * 3:e * ch * 3], sr, ch, 24)) | {'frames': e - s})
        # 互換MP3（v0.23と同じ 44.1kHz・モノラル・128kbps）。切り出しPCMから作る（MP3→WAVはしない）。
        tmp = f'/tmp/{b["id"]}_excerpt.wav'
        open(tmp, 'wb').write(make_wav(segraw, sr, ch, 24))
        mp3 = f'/tmp/{b["id"]}.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-ac', '1', '-ar', '44100', '-b:a', '128k', mp3], check=True)
        mb = open(mp3, 'rb').read()
        compat = write(f"audio/compat/{b['id']}.mp3", mb)
        xc = decode_f(mp3)
        perf = min(MAX_GAIN, tgt / np.sqrt(out_ms(xc)))  # 小さい録音のノイズを持ち上げすぎない
        pcm_gain = float(np.sqrt(out_ms(xc) / out_ms(xs)) * perf)
        out['beds'].append(dict(meta=b, sr=sr, ch=ch, srcDuration=round(dur, 6), srcBytes=len(blob), start=start_s, excerpt=L,
                                peak=peak, rmsDb=round(float(10 * np.log10((xs ** 2).mean())), 2), score=round(best[0], 3),
                                pcm=dict(parts=parts, frames=frames, pcmDataSha256=sha(segraw), gain=pcm_gain, exact=exact, srcCodec=codec, srcBits=bits),
                                compat=compat | dict(sampleRate=44100, channels=1, duration=round(len(xc) / 44100, 6), gain=float(perf),
                                                     rms=float(np.sqrt((xc ** 2).mean())), peak=float(np.abs(xc).max()))))
        print(b['id'], sr, ch, f'{dur:.1f}s', 'start', start_s, 'peak', round(peak, 3), 'parts', len(parts), 'perf', round(perf, 3), 'pcmGain', round(pcm_gain, 3))
    json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
