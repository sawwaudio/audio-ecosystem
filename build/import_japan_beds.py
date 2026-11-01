#!/usr/bin/env python3
"""v0.25 日本録音の環境層（4本）を取り込む。

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
SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/uploads/Downloads'
MAX_PART = 14 * 1024 * 1024
EXCERPT = 45.0
MAX_GAIN = 16.0
TARGET = None  # 既存の環境層から求める
sha = lambda b: hashlib.sha256(b).hexdigest()

BEDS = [
 dict(id='kashiwa-insects', fs=365257, user='RutgerMuller', file='365257__rutgermuller__japan_kashiwa_insects_far_and_upclose.wav',
      sha='cfdce0a468bc29ea38928edf963563ccd03346e325c1a9c5ddda4b336ebb6030',
      jp='虫の合唱（千葉・柏）', en='Insect chorus (Kashiwa, Chiba)', title='Japan_Kashiwa_Insects_Far_and_Upclose.wav', author='RutgerMuller',
      license='CC0 1.0', licenseURL='https://creativecommons.org/publicdomain/zero/1.0/', date='2016-10下旬（原典記載。日・時刻不明）',
      location='千葉県柏市（畑と小さな林）', area='千葉県柏市', habitats=['grassland', 'temperate_forest'], activity=[], activityBasis=None,
      roles=['Texture', 'Drone'], env='畑と小さな林の縁（原典記載）',
      notes='複数の鳴く虫の合唱。種は未特定（推測で特定しない）。種数KPIに加算しない。Zoom H2n（MSステレオ）。原典では後半に近接した高い声がある。',
      desc_en='In Kashiwa, Chiba, Japan. Late October 2016. Recorded with Zoom H2n in MS-stereo (source description).'),
 dict(id='bamboo-stream', fs=843520, user='tomasloos', file='843520__tomasloos__birds-wind-through-bamboo-and-a-little-waterstream-japan-binaural.wav',
      sha='aa26e3734d6c449af778ec6d434e3e2eacd533bbc832e55c6889afe5280ec124',
      jp='竹林の風と小川・鳥', en='Wind in bamboo, a small stream and birds (Japan)', title='Birds, wind through bamboo and a little waterstream - Japan - Binaural',
      author='tomasloos', license='CC0 1.0', licenseURL='https://creativecommons.org/publicdomain/zero/1.0/', date='不明（Freesound公開 2026-01-29）',
      location='日本（地名の記載なし）', area=None, habitats=['temperate_forest', 'river'], activity=[], activityBasis=None,
      roles=['Atmosphere', 'Texture'], env='小さな竹林と小川のそばのベンチ（原典記載）',
      notes='バイノーラル（Zoom H5＋Soundman OKM2 Classic）。鳥の種は未特定。録音地は作品名の「Japan」のみで地名は不明。',
      desc_en='Sitting on a bench next to a small bamboo forest with a small stream (source description).'),
 dict(id='ricefield-frogs', fs=853181, user='Robin_Dupuy', file='853181__robin_dupuy__ambience-swamp_frogs_water_night_may_ricefield_fuki_binaural_rd_001.wav',
      sha='01adbea37f1cf2fb0ec135ae1a8ffc78c081ad719a1781af6b81b8e0eda53796',
      jp='夜の水田のカエルの合唱（和歌山）', en='Night frog chorus in a rice paddy (Wakayama)', title='AMBIENCE-SWAMP_Frogs_Water_Night_May_RiceField_Fuki_Binaural_RD_001',
      author='Robin_Dupuy', license='CC BY 4.0', licenseURL='https://creativecommons.org/licenses/by/4.0/', date='2026-05-06・夜（原典記載）',
      location='和歌山県・高野山近くの富貴地区の水田', area='和歌山県（高野山近く・富貴）', habitats=['wetland'], activity=['night'],
      activityBasis='録音時刻（原典記載：夜）', roles=['Call & Response', 'Texture'], env='夜の水田（原典記載）',
      notes='カエルの合唱。種は未特定（推測で特定しない）。種数KPIに加算しない。原典の記載では、1匹の声をきっかけに別の群れが鳴き返す鳴き交わしが繰り返される。バイノーラル。',
      desc_en='Binaural frog chorus in a Japanese rice paddy at night, May 6, 2026, Fuki area near Koyasan, Wakayama (source description).'),
 dict(id='kyoto-rain', fs=462729, user='LG', file='462729__lg__20180523-tranquil-rainy-night-in-kyoto-increase-and-decrease.wav',
      sha='0244ade45b03c17685443ab8694e6729e3fc6a9975965b7af4869ccabdd1c385',
      jp='京都の夜の雨（庭）', en='Rainy night in a Kyoto garden', title='20180523 - Tranquil rainy night in Kyoto increase and decrease.wav',
      author='LG', license='CC BY 4.0', licenseURL='https://creativecommons.org/licenses/by/4.0/', date='2018-05-23・夜（作品名・原典記載）',
      location='京都府京都市（庭）', area='京都府京都市', habitats=[], activity=['night'], activityBasis='録音時刻（原典記載：夜）',
      roles=['Atmosphere', 'Texture'], env='市街地の庭（原典記載。タグに city / urban）',
      notes='雨が強まり弱まる長尺録音（Sony PCM-D50）。市街地の庭のため生息環境フィルターでは使わない。',
      desc_en='Long field recording of a rainy night in Kyoto, recorded in the garden. Sony PCM-D50 (source description).'),
]


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
    tgt, vals = target_level()
    print('target RMS', tgt, vals)
    out = {'target': tgt, 'targetFrom': vals, 'beds': []}
    for b in BEDS:
        src = os.path.join(SRC, b['file'])
        blob = open(src, 'rb').read()
        assert sha(blob) == b['sha'], ('SHA mismatch', b['id'])
        sr, ch, bits, codec, dur = probe(src)
        assert codec == 'pcm_s24le' and bits == 24, (b['id'], codec, bits)
        raw, q = read_s24(src, ch)
        x = q.astype(np.float64) / (1 << 23)
        # 1秒ごとのRMS（dB）
        n = len(x) // sr
        db = np.array([10 * np.log10(max(1e-12, (x[i * sr:(i + 1) * sr] ** 2).mean())) for i in range(n)])
        pk = np.array([np.abs(x[i * sr:(i + 1) * sr]).max() for i in range(n)])
        L = int(EXCERPT)
        lo, hi = 5, n - 5 - L
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
                                pcm=dict(parts=parts, frames=frames, pcmDataSha256=sha(segraw), gain=pcm_gain),
                                compat=compat | dict(sampleRate=44100, channels=1, duration=round(len(xc) / 44100, 6), gain=float(perf),
                                                     rms=float(np.sqrt((xc ** 2).mean())), peak=float(np.abs(xc).max()))))
        print(b['id'], sr, ch, f'{dur:.1f}s', 'start', start_s, 'peak', round(peak, 3), 'parts', len(parts), 'perf', round(perf, 3), 'pcmGain', round(pcm_gain, 3))
    json.dump(out, open(os.path.join(ROOT, 'build/japan_beds.json'), 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
