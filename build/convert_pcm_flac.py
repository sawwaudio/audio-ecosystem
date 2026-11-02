#!/usr/bin/env python3
"""配信用の PCM WAV を FLAC（可逆圧縮）に置き換える。何度実行してもよい（WAV のものだけ変換する）。

- 対象：data/audio_manifest.json の recordings[*].pcm と instruments[*].pcm のうち format が wav のもの。
- 分割された WAV（.partN）は data 部をつないで1本の FLAC にする（GitHub は1ファイル100MBまでなので分割不要）。
- 検証：FLAC を ffmpeg で元と同じビット深度の PCM に戻し、元の WAV の data 部と SHA-256 が一致することを確認する
  （自然録音は台帳の pcmDataSha256 とも一致すること）。一致しなければ中止する。
- index.html の ae-audio-manifest / ae-source-audit、data/*.json・csv を更新し、元の WAV を削除する（git の履歴には残る）。
"""
import csv, hashlib, io, json, os, re, struct, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
sha = lambda b: hashlib.sha256(b).hexdigest()


def wav_data(path):
    b = open(P(path), 'rb').read()
    o, fmt, data = 12, None, None
    while o + 8 <= len(b):
        tag, n = b[o:o + 4], struct.unpack('<I', b[o + 4:o + 8])[0]
        if tag == b'fmt ': fmt = b[o + 8:o + 8 + n]
        if tag == b'data': data = b[o + 8:o + 8 + n]; break
        o += 8 + n + (n & 1)
    afmt, ch, sr, _, _, bits = struct.unpack('<HHIIHH', fmt[:16])
    assert afmt == 1, (path, 'PCM以外', afmt)
    return ch, sr, bits, data


def make_wav(data, sr, ch, bits):
    bps = bits // 8
    return (b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVE' + b'fmt ' +
            struct.pack('<IHHIIHH', 16, 1, ch, sr, sr * ch * bps, ch * bps, bits) + b'data' + struct.pack('<I', len(data)) + data)


def to_flac(entry, out_rel, expect_sha=None):
    parts = entry['parts'] if entry.get('parts') else [{'path': entry['path']}]
    datas, fmt = [], None
    for p in parts:
        ch, sr, bits, d = wav_data(p['path'])
        assert fmt in (None, (ch, sr, bits)), ('分割の形式不一致', p['path'])
        fmt = (ch, sr, bits); datas.append(d)
    ch, sr, bits = fmt; data = b''.join(datas)
    if expect_sha: assert sha(data) == expect_sha, ('元のPCMが台帳と不一致', out_rel)
    tmp = '/tmp/_conv.wav'; open(tmp, 'wb').write(make_wav(data, sr, ch, bits))
    os.makedirs(os.path.dirname(P(out_rel)), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-map_metadata', '-1', '-c:a', 'flac', '-compression_level', '8',
                    '-bits_per_raw_sample', str(bits)] + (['-sample_fmt', 's16'] if bits == 16 else ['-sample_fmt', 's32']) + [P(out_rel)], check=True)
    back = subprocess.run(['ffmpeg', '-v', 'error', '-i', P(out_rel), '-f', 's16le' if bits == 16 else 's24le',
                           '-acodec', 'pcm_s16le' if bits == 16 else 'pcm_s24le', '-'], capture_output=True, check=True).stdout
    assert sha(back) == sha(data), ('FLAC がビット完全でない', out_rel)
    fb = open(P(out_rel), 'rb').read()
    return dict(ch=ch, sr=sr, bits=bits, frames=len(data) // (ch * bits // 8), bytes=len(fb), sha256=sha(fb), dataSha=sha(data), src=[p['path'] for p in parts], wavBytes=sum(os.path.getsize(P(p['path'])) for p in parts))


def main():
    man = json.load(open(P('data/audio_manifest.json'), encoding='utf-8'))
    done, removed, saved = [], [], 0
    for kind in ('recordings', 'instruments'):
        for id_, m in man[kind].items():
            e = m.get('pcm')
            if not e or e.get('format') != 'wav': continue
            base = e['parts'][0]['path'] if e.get('parts') else e['path']
            out = re.sub(r'(\.part\d+)?\.wav$', '.flac', base)
            r = to_flac(e, out, e.get('pcmDataSha256') if kind == 'recordings' else None)
            note = ' 配信はFLAC（可逆圧縮。復号するとこのPCMとビット単位で同一）。'
            e.update(format='flac', codec=f"FLAC {r['bits']}-bit（可逆圧縮）", parts=[{'path': out, 'bytes': r['bytes'], 'sha256': r['sha256'], 'frames': r['frames']}],
                     pcmDataSha256=r['dataSha'], provenance=(e.get('provenance') or '').rstrip() + note)
            if 'path' in e: e.update(path=out, bytes=r['bytes'], sha256=r['sha256'])
            done.append((kind, id_, r['wavBytes'], r['bytes'])); removed += r['src']; saved += r['wavBytes'] - r['bytes']
            print(f"{kind[:4]} {id_:28s} {r['bits']}bit {r['sr']}Hz {r['ch']}ch  WAV {r['wavBytes']/1e6:6.2f}MB → FLAC {r['bytes']/1e6:6.2f}MB  ビット完全")
    if not done: print('変換対象なし'); return
    man['version'] = man.get('version')
    json.dump(man, open(P('data/audio_manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 監査表（pcmPath・pcmBytes）
    audit = json.load(open(P('data/source_audit.json'), encoding='utf-8'))
    for a in audit:
        k = 'recordings' if a['kind'] == 'recording' else 'instruments'
        e = man[k].get(a['id'], {}).get('pcm')
        if e and e.get('format') == 'flac' and a.get('pcmPath'):
            a['pcmPath'] = f"FLAC {e.get('bitDepth', '')}-bit {e.get('sampleRate', '')}Hz {e.get('channels', '')}ch".replace(' -bit', '').strip()
            a['pcmBytes'] = sum(p['bytes'] for p in e['parts'])
    json.dump(audit, open(P('data/source_audit.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    old = open(P('data/source_audit.csv'), encoding='utf-8-sig').read(); cols = next(csv.reader(io.StringIO(old)))
    buf = io.StringIO(); w = csv.writer(buf, lineterminator='\r\n'); w.writerow(cols)
    for a in audit: w.writerow([a.get(c, '') for c in cols])
    open(P('data/source_audit.csv'), 'w', encoding='utf-8-sig', newline='').write(buf.getvalue())
    # 録音台帳：v0.25 以降の環境層は embeddedFile が WAV を指しているので合わせる
    recs = json.load(open(P('data/recording_licenses.json'), encoding='utf-8'))
    for r in recs:
        e = man['recordings'].get(r['id'], {}).get('pcm')
        if e and e.get('format') == 'flac' and str(r.get('embeddedFile', '')).endswith('.wav') and r.get('embeddedFormat') == 'wav':
            r.update(embeddedFormat='flac', embeddedFile=os.path.basename(e['parts'][0]['path']), embeddedSize=e['parts'][0]['bytes'])
    open(P('data/recording_licenses.json'), 'w', encoding='utf-8').write(json.dumps(recs, ensure_ascii=False, indent=1))
    # index.html に埋め込み
    html = open(P('index.html'), encoding='utf-8').read()
    def put(i, obj):
        nonlocal html
        m = re.search(r'(<script type="application/json" id="' + i + r'">)(.*?)(</script>)', html, re.S)
        html = html[:m.start(2)] + json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + html[m.end(2):]
    put('ae-audio-manifest', man); put('ae-source-audit', audit)
    m = re.search(r'(<script type="application/json" id="ae-recordings">)(.*?)(</script>)', html, re.S)
    emb = json.loads(m.group(2)); by = {r['id']: r for r in recs}
    for r in emb:
        if r['id'] in by:
            for k in ('embeddedFormat', 'embeddedFile', 'embeddedSize'): r[k] = by[r['id']].get(k, r.get(k))
    put('ae-recordings', emb)
    open(P('index.html'), 'w', encoding='utf-8').write(html)
    for f in removed: os.remove(P(f))
    print(f'変換 {len(done)} 本、削除した WAV {len(removed)} ファイル、削減 {saved/1e6:.1f}MB')


if __name__ == '__main__':
    main()
