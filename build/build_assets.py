#!/usr/bin/env python3
"""AUDIO ECOSYSTEM v0.24 asset build.

Inputs : v0.23 decoded assets (assets/*.bin), VCSL masters (vcsl/*.wav),
         recordings.json / instruments.json extracted from v0.23.
Outputs: dist/audio/{original,compat,pcm}, dist/instruments/{pcm,compat},
         dist/data/*.json, audit tables.

Principles (R&D report 2.2): original bytes are copied untouched; PCM for
lossy originals is a decode of the ORIGINAL (never of the MP3); MP3-only
items get no WAV.
"""
import hashlib, json, os, struct, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(ROOT, 'assets')
D = os.path.join(ROOT, 'dist')
MAX_PART = 14 * 1024 * 1024  # artifact per-file limit is 15 MB
sha = lambda b: hashlib.sha256(b).hexdigest()


def decode_f32(path, mono=False):
    info = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
                                      'stream=sample_rate,channels', '-of', 'json', path],
                                     capture_output=True, check=True).stdout)['streams'][0]
    sr, ch = int(info['sample_rate']), int(info['channels'])
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-f', 'f32le']
    if mono:
        cmd += ['-ac', '1']; ch = 1
    cmd += ['-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return sr, np.frombuffer(raw, '<f4').reshape(-1, ch).astype(np.float64)


def out_ms(x):
    """Mean square per output channel after a centred StereoPannerNode."""
    return float((x ** 2).mean()) if x.shape[1] == 2 else 0.5 * float((x ** 2).mean())


def pcm_bytes(frames_i32, bits):
    a = frames_i32.astype('<i4').reshape(-1)
    if bits == 16:
        return a.astype('<i2').tobytes()
    return a.view(np.uint8).reshape(-1, 4)[:, :3].tobytes()


def make_wav(frames_i32, sr, ch, bits):
    data = pcm_bytes(frames_i32, bits); bps = bits // 8
    hdr = b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVE' + b'fmt ' + struct.pack(
        '<IHHIIHH', 16, 1, ch, sr, sr * ch * bps, ch * bps, bits) + b'data' + struct.pack('<I', len(data))
    return hdr + data


def write(rel, data):
    p = os.path.join(D, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'wb') as f:
        f.write(data)
    return {'path': rel, 'bytes': len(data), 'sha256': sha(data)}


def main():
    recs = json.load(open(os.path.join(ROOT, 'recordings.json')))
    insts = json.load(open(os.path.join(ROOT, 'instruments.json')))
    manifest = {'schema': 'ae-audio-manifest/1', 'version': 'v0.24', 'recordings': {}, 'instruments': {}}
    audit = []
    for r in recs:
        rid = r['id']
        orig_b = open(os.path.join(A, f'asset-{rid}.bin'), 'rb').read()
        prev_b = open(os.path.join(A, f'preview-{rid}.bin'), 'rb').read()
        assert sha(prev_b) == r['previewSha256'], rid
        m = {}
        compat = write(f"audio/compat/{r['previewFile']}", prev_b)
        sr_c, xc = decode_f32(os.path.join(A, f'preview-{rid}.bin'))
        compat.update(format='mp3', codec='MP3 128kbps', sampleRate=sr_c, channels=xc.shape[1],
                      duration=round(len(xc) / sr_c, 6), lossless=False, gain=r['performanceGain'],
                      provenance='v0.23互換音源（原本または原本相当からの再エンコード・モノラル化）')
        m['compat'] = compat
        has_original = r['embeddedFormat'] != 'mp3'
        row = dict(kind='recording', id=rid, name=r['jp'], latin=r.get('latin'), japan=bool(r.get('japanRecording')),
                   sourceFormat=r['format'], sourceRate=r['sampleRate'], sourceChannels=r['channels'],
                   sourceDuration=r['duration'], sourceBytes=r['size'], sourceSha256=r['sha256'],
                   compat=f"MP3 128k / {sr_c}Hz / {xc.shape[1]}ch")
        if has_original:
            assert sha(orig_b) == r['embeddedSha256'], rid
            o = write(f"audio/original/{r['embeddedFile']}", orig_b)
            sr, x = decode_f32(os.path.join(A, f'asset-{rid}.bin'))
            lossless = r['embeddedFormat'] == 'flac'
            o.update(format=r['embeddedFormat'], sampleRate=sr, channels=x.shape[1],
                     duration=round(len(x) / sr, 6), lossless=lossless)
            ms_c = out_ms(xc)
            match = float(np.sqrt(ms_c / out_ms(x))) * r['performanceGain']
            o['gain'] = match
            m['original'] = o
            peak = float(np.abs(x).max())
            headroom = 1.0 if peak <= 1.0 else 1.0 / (peak * 1.0001)
            bits = 16 if lossless else 24  # lossless source keeps its own 16-bit depth
            full = 2 ** (bits - 1)
            q = np.clip(np.round(x * headroom * full), -full, full - 1).astype(np.int32)
            ch = x.shape[1]
            per = max(1, MAX_PART // (ch * bits // 8))
            parts = []
            for i, s in enumerate(range(0, len(q), per)):
                seg = q[s:s + per]
                suffix = '' if len(q) <= per else f'.part{i + 1}'
                parts.append(write(f"audio/pcm/{rid}{suffix}.wav", make_wav(seg, sr, ch, bits)) | {'frames': int(len(seg))})
            pcm_data_sha = sha(pcm_bytes(q, bits))
            m['pcm'] = dict(format='wav', codec=f'Linear PCM {bits}-bit', bitDepth=bits, sampleRate=sr, channels=ch,
                            frames=int(len(q)), duration=round(len(q) / sr, 6), parts=parts,
                            pcmDataSha256=pcm_data_sha, headroomScale=headroom, decodedPeak=peak,
                            gain=match / headroom, lossless=lossless,
                            provenance=('FLAC原本の可逆復号（ビット完全）' if lossless else
                                        f"{r['embeddedFormat']}原本の復号PCM。原本と同等の情報量で、非圧縮マスターではない。"
                                        + ('' if headroom == 1 else f' 復号ピーク{peak:.4f}>0dBFSのため係数{headroom:.6f}で格納し再生ゲインで相殺。')))
            if lossless:  # bit-exactness check for FLAC → 24-bit
                ref = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(A, f'asset-{rid}.bin'), '-f', 's16le', '-'],
                                     capture_output=True, check=True).stdout
                assert ref == pcm_bytes(q, 16), 'FLAC decode not bit-exact'
                print('FLAC bit-exact OK', rid)
            row.update(embeddedOriginal=f"{r['embeddedFormat']} {sr}Hz {ch}ch", embeddedOriginalBytes=len(orig_b),
                       pcmPath=f"PCM {bits}-bit {sr}Hz {ch}ch ({len(parts)} file{'s' if len(parts) > 1 else ''})",
                       pcmBytes=sum(p['bytes'] for p in parts), decodedPeak=round(peak, 4))
        else:
            row.update(embeddedOriginal='なし（v0.23にはMP3のみ）', embeddedOriginalBytes=0, pcmPath='なし（MP3からのWAV化は行わない）')
        # master availability classification
        if rid == 'forest-leaves':
            status = 'A2'; note = '原典は96kHz/32-bit/2ch WAV 158秒（真の非圧縮マスター）。本ファイルは冒頭18秒の44.1kHz/16-bit抜粋。原典全長はこの環境に未保持。'
        elif has_original:
            status = 'B1'; note = f"原典自体が非可逆（{r['format']}）。非圧縮マスターは録音者への照会が必要。"
        else:
            status = 'C1'; note = f"原典は{r['format']} {r['sampleRate']}Hz/{r['channels']}ch（Commons）。v0.23には原典bytesが無くモノラルMP3のみ。原典の再取得が必要。"
        if r['sampleRate'] and r['sampleRate'] < 22050:
            note += f" 原典サンプルレート{r['sampleRate']}Hz：高域情報は原典時点で欠落。互換MP3は44.1kHzへ補間されているが情報は増えていない。"
        row.update(masterStatus=status, note=note, license=r['license'], url=r['url'])
        audit.append(row)
        manifest['recordings'][rid] = m

    for i in insts:
        iid = i['id']
        mp3 = open(os.path.join(A, f'instrument-{iid}.bin'), 'rb').read()
        assert sha(mp3) == i['embeddedSha256'], iid
        wav = open(os.path.join(ROOT, 'vcsl', f'{iid}.wav'), 'rb').read()
        assert sha(wav) == i['sha256'], iid
        c = write(f"instruments/compat/{i['file']}", mp3)
        sr_c, xc = decode_f32(os.path.join(A, f'instrument-{iid}.bin'))
        c.update(format='mp3', codec='MP3 128kbps', sampleRate=sr_c, channels=xc.shape[1], gain=1.0, lossless=False)
        p = write(f"instruments/pcm/{i['original']}", wav)
        sr, x = decode_f32(os.path.join(ROOT, 'vcsl', f'{iid}.wav'))
        g = float(np.sqrt(out_ms(xc) / out_ms(x)))
        p.update(format='wav', codec='Linear PCM 16-bit', bitDepth=16, sampleRate=sr, channels=x.shape[1],
                 duration=round(len(x) / sr, 6), parts=[{'path': p['path'], 'bytes': p['bytes'], 'sha256': p['sha256'], 'frames': len(x)}],
                 gain=g, lossless=True, provenance='VCSL原本WAV（固定コミット取得・SHA-256一致・無加工）')
        manifest['instruments'][iid] = {'pcm': p, 'compat': c}
        audit.append(dict(kind='instrument', id=iid, name=i['original'], sourceFormat='WAV PCM', sourceRate=sr,
                          sourceChannels=x.shape[1], sourceDuration=round(len(x) / sr, 6), sourceBytes=len(wav),
                          sourceSha256=i['sha256'], compat=f"MP3 128k / {sr_c}Hz / {xc.shape[1]}ch",
                          embeddedOriginal='なし（v0.23にはMP3のみ）→ v0.24でVCSL原本WAVを再取得', embeddedOriginalBytes=0,
                          pcmPath=f'PCM 16-bit {sr}Hz {x.shape[1]}ch（原本そのもの）', pcmBytes=len(wav),
                          masterStatus='A1', note='非圧縮マスター入手済み。v0.23はモノラル化MP3だったため、ステレオ原本へ復帰。',
                          license=i['license'], url=i['url']))

    os.makedirs(os.path.join(D, 'data'), exist_ok=True)
    json.dump(manifest, open(os.path.join(D, 'data/audio_manifest.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(recs, open(os.path.join(D, 'data/recording_licenses.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(insts, open(os.path.join(D, 'data/instrument_samples.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(audit, open(os.path.join(D, 'data/source_audit.json'), 'w'), ensure_ascii=False, indent=1)
    import csv
    keys = list(dict.fromkeys(k for r in audit for k in r))
    with open(os.path.join(D, 'data/source_audit.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, keys); w.writeheader(); w.writerows(audit)
    tot = lambda k: sum(e['bytes'] for m in manifest[k].values() for kind, e in m.items() for e in ([e] if 'parts' not in e else e['parts']))
    print('files written; recordings bytes', tot('recordings'), 'instruments bytes', tot('instruments'))


if __name__ == '__main__':
    main()
