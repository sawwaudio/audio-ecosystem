#!/usr/bin/env python3
"""v0.38 実録音の一括取り込み（build/library_v038.py の台帳 × Mac で作った抜粋 FLAC）。
使い方：python3 build/integrate_library.py <抜粋フォルダ（results.json と <fs>.flac）> <音源リポジトリのフォルダ> <配信パスの接頭辞>
例：python3 build/integrate_library.py /mnt/user-data/uploads/Downloads/ae_excerpts ../audio-ecosystem-sounds-1 ../audio-ecosystem-sounds-1/

- 抜粋 FLAC は Mac 上の build/excerpt_masters.py が原本 PCM から切り出したもの（16/24-bit はビット完全。32-bit・192kHz・多チャンネルは変換内容を記録）。
  ここでは FLAC の SHA-256 を results.json と照合し、音源リポジトリの audio/pcm/<id>.flac にそのまま置く（再エンコードしない）。
- 互換 MP3（44.1kHz・モノラル・128kbps）は抜粋 FLAC から作る（MP3 から戻すことはしない）。
- 音量の基準：環境層は v0.25 以降と同じ（既存の環境層5本の互換MP3の中央値）。生き物は既存の生き物の録音（互換MP3 × performanceGain）の中央値。
- 何度実行しても同じ結果（同じ id は置き換える）。
"""
import csv, hashlib, io, json, os, re, shutil, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from acoustic_features import load, features, classify
from library_v038 import E, LIC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
EX, SND, PREFIX = sys.argv[1], sys.argv[2], sys.argv[3]
TODAY = '2026-11-02'
VER = 'v0.38'
sha = lambda b: hashlib.sha256(b).hexdigest()
RES = json.load(open(os.path.join(EX, 'results.json')))
html = open(P('index.html'), encoding='utf-8').read()


def block(i):
    m = re.search(r'(<script type="application/json" id="' + i + r'">)(.*?)(</script>)', html, re.S)
    return m, json.loads(m.group(2))


def put(i, obj):
    global html
    m, _ = block(i)
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    assert '</' not in s
    html = html[:m.start(2)] + s + html[m.end(2):]


def decode_f(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    ch = int(json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'json', path],
                                       capture_output=True, check=True).stdout)['streams'][0]['channels'])
    return np.frombuffer(raw, '<f4').reshape(-1, ch).astype(np.float64)


def out_ms(x):
    return float((x ** 2).mean()) if x.shape[1] == 2 else 0.5 * float((x ** 2).mean())


_, recs = block('ae-recordings')
_, meta = block('ae-wildlife-meta')
_, man = block('ae-audio-manifest')
_, audit = block('ae-source-audit')
ids = [e['id'] for e in E]
# 既存の生き物の録音の演奏時 RMS（互換MP3 × performanceGain）の中央値を、生き物の基準にする
sp_vals = []
for r in recs:
    if r['id'] in ids or r.get('group') == 'landscape': continue
    c = man['recordings'].get(r['id'], {}).get('compat')
    if not c: continue
    x = decode_f(P(c['path'])); sp_vals.append(np.sqrt(out_ms(x)) * (r.get('performanceGain') or 1))
TGT_SP = float(np.median(sp_vals)); TGT_BED = 0.03464990840950625
print('target species', round(TGT_SP, 4), 'from', len(sp_vals), '/ bed', TGT_BED)

recs = [r for r in recs if r['id'] not in ids]
audit = [a for a in audit if a.get('id') not in ids]
for rid in ids:
    meta.pop(rid, None); man['recordings'].pop(rid, None)
os.makedirs(os.path.join(SND, 'audio', 'pcm'), exist_ok=True); os.makedirs(os.path.join(SND, 'audio', 'compat'), exist_ok=True)
new_recs, new_audit, defs, loc_en = [], [], [], {}
for e in E:
    rid, r0 = e['id'], RES[e['fs']]
    assert r0.get('ok'), e['fs']
    src = os.path.join(EX, e['fs'] + '.flac'); blob = open(src, 'rb').read()
    assert sha(blob) == r0['flacSha256'], ('FLAC SHA 不一致', e['fs'])
    pcm_rel = f'audio/pcm/{rid}.flac'; shutil.copyfile(src, os.path.join(SND, pcm_rel))
    mp3_rel = f'audio/compat/{rid}.mp3'; mp3 = os.path.join(SND, mp3_rel)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-map_metadata', '-1', '-ac', '1', '-ar', '44100', '-b:a', '128k', mp3], check=True)
    mb = open(mp3, 'rb').read()
    xs, xc = decode_f(src), decode_f(mp3)
    tgt = TGT_BED if e['kind'] == 'bed' else TGT_SP
    perf = float(min(16.0, tgt / np.sqrt(out_ms(xc))))
    pcm_gain = float(np.sqrt(out_ms(xc) / out_ms(xs)) * perf)
    peak = float(np.abs(xs).max())
    lic, licURL = LIC[e['lic']]
    url = f"https://freesound.org/people/{e['user']}/sounds/{e['fs']}/"
    info = r0['info']; sr, ch, bits = r0['sr'], r0['ch'], r0['bits']
    st, ln = round(r0['start'], 3), round(r0['sec'], 3)
    excerpt = f'{st:g}秒〜{st + ln:g}秒' if ln < info['dur'] - 0.01 else '全長'
    conv = r0.get('notes') or []
    exact = r0.get('bitExact', False)
    how = '原本のサンプルをそのまま切り出し（ビット完全）' if exact else '切り出し（' + '・'.join(conv) + '）'
    sel = '1秒ごとの音量の揺れが最も小さい区間' if e['kind'] == 'bed' else '鳴いている時間（中央値＋6dB を超える 0.25 秒区間）が最も多い区間'
    srcfmt = f"{info['codec']} {info['bits']}-bit {info['sr']}Hz {info['ch']}ch"
    kind = 'landscape' if e['kind'] == 'bed' else e['kind']
    r = dict(id=rid, file=rid, jp=e['jp'], latin=e['latin'], group=e['group'], title=e['title'], author=e['author'], copyright=e['author'], date=e['date'],
             location=e['loc'], url=url, download=url + 'download/', license=lic, licenseURL=licURL, kind=kind, japanRecording=bool(e['japan']),
             notes=e['note'] + ('' if e['kind'] != 'mixed' else ' 種数KPIに加算しない。'), format=srcfmt, duration=round(info['dur'], 6), size=r0['srcBytes'],
             sampleRate=info['sr'], channels=info['ch'], retrievedDate=TODAY, acquired=True, decoded=True,
             playback=('抜粋の PCM が原本とビット単位で一致（Mac 上で ffmpeg により確認）。' if exact else '抜粋は変換を含む（内容は changes 欄）。') + 'ブラウザでのデコードは回帰テストで確認。聴感と iPhone/Mac 実機は未検証。',
             added=VER, embeddedFormat='flac', embeddedFile=rid + '.flac', embeddedSize=len(blob), embeddedSha256=r0['pcmSha256'], embeddedDuration=ln,
             embeddedSampleRate=sr, embeddedChannels=ch, embeddedOffset=st, embeddedOriginalBytes=False, pcmEquality=exact, performanceGain=round(perf, 6),
             changes=f'原本から {excerpt}（{ln:g}秒）を{how}。区間は{sel}を自動選択（聴感での確認は未実施）。音量・定位・両端フェードは演奏時に適用。原本と同じライセンスを保持。',
             previewFormat='MP3', previewSha256=sha(mb), previewFile=rid + '.mp3', previewGain=round(perf, 6), previewRms=float(np.sqrt((xc ** 2).mean())),
             previewPeak=float(np.abs(xc).max()), masterLocation='オーナーのMac（~/Downloads、原本は無加工）')
    if e['kind'] == 'bed': r['fieldBed'] = True
    if e['extra']: r['attributionExtra'] = e['extra']
    new_recs.append(r)
    f = features(load(src))
    meta[rid] = dict(en=e['en'], nativeRegions=e['native'], japanNative=e['japanNative'], japanEndemic=False if e['japanNative'] is not None else None,
                     distributionBasis=('一般的な分布知識（種名が原典に記載されているもの。出典URL未記録・要確認）' if e['native'] else ('環境音・種を特定しない合唱（分布なし）' if e['kind'] != 'species' else '種名が原典にないため分布を付けない')),
                     recordedCountry=e['country'], recordedArea=e['area'], recordedRegions=e['regions'], recordingEnvironment=e['loc'],
                     wildOrCaptive=e['wild'], habitats=e['habitats'], activity=e['activity'], activityBasis='原典の記載（録音時刻・夜／朝の記述）または鳴く時間帯の一般的な知識',
                     soundRoles=e['roles'], soundRolesBasis='原典の記載と録音の性格による手動分類（自動音響分析値を併記）',
                     acoustic={**{k: (round(x, 4) if isinstance(x, float) else x) for k, x in f.items()}, 'autoRoles': classify(f, 'landscape' if e['kind'] == 'bed' else 'species'), 'analysedFrom': 'pcm'},
                     note=f"{VER} 取り込み。原典確認日 {TODAY}。" + ('録音地の記載なし。' if e['country'] == '不明' else ''))
    parts = [dict(path=PREFIX + pcm_rel, bytes=len(blob), sha256=sha(blob), frames=r0['frames'])]
    man['recordings'][rid] = dict(
        compat=dict(path=PREFIX + mp3_rel, bytes=len(mb), sha256=sha(mb), format='mp3', codec='MP3 128kbps', sampleRate=44100, channels=1,
                    duration=round(len(xc) / 44100, 6), lossless=False, gain=round(perf, 6), provenance=f'{VER}：抜粋 FLAC から作成した互換MP3（44.1kHz・モノラル・128kbps）'),
        pcm=dict(format='flac', codec=f'FLAC {bits}-bit（可逆圧縮）', bitDepth=bits, sampleRate=sr, channels=ch, frames=r0['frames'], duration=ln, parts=parts,
                 pcmDataSha256=r0['pcmSha256'], headroomScale=1.0, decodedPeak=peak, gain=pcm_gain, lossless=exact,
                 provenance=f"原本（{info['sr']}Hz・{info['bits']}-bit・{info['ch']}ch）から{how}した抜粋（{excerpt}）。配信は FLAC（可逆圧縮。復号するとこの PCM とビット単位で同一）。原本全長はオーナーのMacに保管。音源リポジトリ sawwaudio/audio-ecosystem-sounds-1 に置く。"))
    new_audit.append(dict(kind='recording', id=rid, name=e['jp'], latin=e['latin'], japan=bool(e['japan']), sourceFormat=srcfmt, sourceRate=info['sr'], sourceChannels=info['ch'],
                          sourceDuration=round(info['dur'], 3), sourceBytes=r0['srcBytes'], sourceSha256='', compat='MP3 128k / 44100Hz / 1ch',
                          embeddedOriginal='なし（原本はオーナーのMacに保管）', embeddedOriginalBytes=0, pcmPath=f'FLAC {bits}-bit {sr}Hz {ch}ch', pcmBytes=len(blob),
                          decodedPeak=round(peak, 4), masterStatus='A2' if exact else 'B1',
                          note=f"原典は{srcfmt}・{round(info['dur'])}秒。本ファイルは{excerpt}の抜粋（{'ビット完全' if exact else '・'.join(conv)}）。", license=lic, url=url))
    if e['kind'] != 'bed':
        hz = int(min(4000, max(200, f.get('centroidHz') or 700)))
        defs.append(f'speciesDefinitions["{e["group"]}"].push({json.dumps([rid, e["jp"], e["latin"], hz, "call"], ensure_ascii=False)});')
    if re.search('[぀-鿿]', e['loc']): loc_en[e['loc']] = e['locEn']
    print(f"{rid:28s} {e['kind']:7s} {sr}Hz {bits}b {ch}ch {ln:5.1f}s perf {perf:6.3f} pcmGain {pcm_gain:6.3f} peak {peak:.3f}")

recs = recs + new_recs
n_rec = sum(1 for a in audit if a['kind'] == 'recording')
audit = audit[:n_rec] + new_audit + audit[n_rec:]
put('ae-recordings', recs); put('ae-wildlife-meta', meta); put('ae-audio-manifest', man); put('ae-source-audit', audit)


def _tier(l):
    l = l.strip()
    if re.search('BY-SA', l, re.I): return 'C'
    if re.search(r'\b(NC|ND)\b', l, re.I): return 'X'
    if re.match(r'CC BY\b', l, re.I): return 'B'
    if re.match(r'(CC0|Public domain|PD\b|owned)', l, re.I): return 'A'
    return 'X'


open(P('data/recording_licenses.json'), 'w', encoding='utf-8').write(json.dumps([{**r, 'rightsTier': _tier(r['license'])} for r in recs], ensure_ascii=False, indent=1))
json.dump(meta, open(P('data/wildlife_meta.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(man, open(P('data/audio_manifest.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(audit, open(P('data/source_audit.json'), 'w'), ensure_ascii=False, indent=1)
old = open(P('data/source_audit.csv'), encoding='utf-8-sig').read(); cols = next(csv.reader(io.StringIO(old)))
buf = io.StringIO(); w = csv.writer(buf, lineterminator='\r\n'); w.writerow(cols)
for a in audit: w.writerow([a.get(c, '') for c in cols])
open(P('data/source_audit.csv'), 'w', encoding='utf-8-sig', newline='').write(buf.getvalue())

# 種の定義（既に定義がある id は足さない）
existing = set(re.findall(r"\['([a-z0-9-]+)','", html[html.find('const speciesDefinitions='):html.find('const speciesSettings=')])) | set(re.findall(r'push\(\["([a-z0-9-]+)"', html))
defs = [d for d in defs if re.search(r'push\(\["([a-z0-9-]+)"', d).group(1) not in existing]
anchor = 'const speciesSettings={};'
assert html.count(anchor) == 1
html = html.replace(anchor, ' '.join(defs) + ' ' + anchor)
# 環境層の初期音量（新しい層は0）
fd = re.search(r"const fieldDefaults=\{([^}]*)\};", html)
cur = dict(re.findall(r"'([a-z0-9-]+)':(\d+)", fd.group(1)))
for e in E:
    if e['kind'] == 'bed': cur.setdefault(e['id'], '0')
html = html[:fd.start(1)] + ','.join(f"'{k}':{v}" for k, v in cur.items()) + html[fd.end(1):]
# 画面の件数
NR = len(recs); NA = len(audit); NB = sum(1 for r in recs if r.get('fieldBed'))
NS = sum(1 for r in recs if r.get('kind') == 'species'); NM = sum(1 for r in recs if r.get('kind') == 'mixed'); NL = sum(1 for r in recs if r.get('group') == 'landscape')
src = open(P('build/src_i18n.js'), encoding='utf-8').read()
REP = [(r'実録音ライブラリ · \d+録音 / 個別試聴', f'実録音ライブラリ · {NR}録音 / 個別試聴'), (r'Recording library · \d+ recordings / individual preview', f'Recording library · {NR} recordings / individual preview'),
       (r'音源形式監査 · \d+サンプル', f'音源形式監査 · {NA}サンプル'), (r'Source format audit · \d+ samples', f'Source format audit · {NA} samples'),
       (r'\d+素材 · 全素材を同時再生可', f'{NB}素材 · 全素材を同時再生可'), (r'\d+ sources · all can play together', f'{NB} sources · all can play together'),
       (r'\d+ recordings · \d+ species \+ \d+ choruses \+ \d+ environmental recordings', f'{NR} recordings · {NS} species + {NM} choruses + {NL} environmental recordings'),
       (r'(\d+)実録音 / 環境層と自律演奏', f'{NR}実録音 / 環境層と自律演奏'), (r"'\d+ recordings / ambience beds and autonomous play'", f"'{NR} recordings / ambience beds and autonomous play'")]
for pat, rep in REP:
    html, n1 = re.subn(pat, rep, html); src, n2 = re.subn(pat, rep, src); print(f'{n1:2d} {n2:2d}', pat[:46])
# 録音地の英語（i18n 辞書）
anchor = "'原本に記載なし':'Not stated in source',"
add = ''.join(f"{json.dumps(k, ensure_ascii=False)}:{json.dumps(v, ensure_ascii=False)}," for k, v in loc_en.items() if json.dumps(k, ensure_ascii=False) not in src)
if add:
    assert html.count(anchor) == 1 and src.count(anchor) == 1
    html = html.replace(anchor, anchor + add); src = src.replace(anchor, anchor + add)
open(P('build/src_i18n.js'), 'w', encoding='utf-8').write(src)
m = re.search(r'(<script id="ae-i18n">)(.*?)(</script>)', html, re.S)
html = html[:m.start(2)] + src + html[m.end(2):]
open(P('index.html'), 'w', encoding='utf-8').write(html)
# CREDITS.md
cr = open(P('CREDITS.md'), encoding='utf-8').read()
rows = []
for e in E:
    if f"| {e['id']} |" in cr: continue
    lic, licURL = LIC[e['lic']]; url = f"https://freesound.org/people/{e['user']}/sounds/{e['fs']}/"
    rows.append(f"| {e['id']} | {e['jp']}（抜粋） | {e['author']}{'（' + e['extra'] + '）' if e['extra'] else ''} | [{lic}]({licURL}) | [{e['title']}]({url}) |")
anchor_line = [l for l in cr.split('\n') if l.startswith('## 楽器サンプル')][0]
i = cr.index(anchor_line); j = cr.rfind('\n|', 0, i); j = cr.index('\n', j + 1)
cr = cr[:j] + '\n' + '\n'.join(rows) + cr[j:]
open(P('CREDITS.md'), 'w', encoding='utf-8').write(cr)
print('recordings', NR, 'audit', NA, 'beds', NB, 'species', NS, 'mixed', NM, 'landscape', NL, 'new defs', len(defs))
