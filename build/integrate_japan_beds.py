#!/usr/bin/env python3
"""v0.25：import_japan_beds.py の出力（build/japan_beds.json）を index.html と data/ に組み込む。
何度実行しても同じ結果になる（既に入っている id は置き換える）。"""
import csv, io, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from acoustic_features import load, features, classify

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
J = json.load(open(P('build/japan_beds.json')))
TODAY = '2026-11-01'
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


_, recs = block('ae-recordings')
_, meta = block('ae-wildlife-meta')
_, man = block('ae-audio-manifest')
_, audit = block('ae-source-audit')
ids = [b['meta']['id'] for b in J['beds']]
recs = [r for r in recs if r['id'] not in ids]
audit = [a for a in audit if a.get('id') not in ids]
for rid in ids:
    meta.pop(rid, None); man['recordings'].pop(rid, None)

new_recs, new_audit = [], []
for b in J['beds']:
    m, rid = b['meta'], b['meta']['id']
    url = f"https://freesound.org/people/{m['user']}/sounds/{m['fs']}/"
    pc = b['pcm']; cp = b['compat']
    excerpt = f"{b['start']}秒〜{b['start'] + b['excerpt']}秒"
    r = dict(id=rid, file=rid, jp=m['jp'], latin='該当なし（種を特定しない合唱・環境録音）' if rid in ('kashiwa-insects', 'ricefield-frogs') else '該当なし',
             group='landscape', title=m['title'], author=m['author'], copyright=m['author'], date=m['date'], location=m['location'],
             url=url, download=url + 'download/', license=m['license'], licenseURL=m['licenseURL'], kind='landscape', fieldBed=True,
             japanRecording=True, notes=m['notes'], format='wav / pcm_s24le', duration=b['srcDuration'], size=b['srcBytes'],
             sha256=m['sha'], sampleRate=b['sr'], channels=b['ch'], retrievedDate=TODAY, acquired=True, decoded=True,
             playback='原本SHA-256照合、抜粋PCMが原本サンプルとビット完全一致（ffmpeg独立抽出で確認）。ブラウザ再生は回帰テストで確認。聴感（区間の人工音・ノイズ）と iPhone/Mac 実機は未検証。',
             added='v0.25', embeddedFormat='wav', embeddedFile=rid + '.wav', embeddedSize=sum(p['bytes'] for p in pc['parts']),
             embeddedSha256=pc['pcmDataSha256'], embeddedDuration=float(b['excerpt']), embeddedSampleRate=b['sr'], embeddedChannels=b['ch'],
             embeddedOffset=float(b['start']), embeddedOriginalBytes=False, pcmEquality=True,
             performanceGain=round(cp['gain'], 6),
             changes=f"原本WAV（24-bit）から {excerpt}（45秒）をサンプル単位でそのまま切り出し（再量子化・リサンプルなし）。区間は1秒ごとのRMSの揺れが最小の区間を自動選択。音量・定位・両端フェードは演奏時に適用。原本と同じライセンスを保持。",
             validationV025='PASS: 原本SHA-256、抜粋のビット完全一致、Chromiumでのデコードと環境層の発音。聴感と実機は未検証。',
             previewFormat='MP3', previewSha256=cp['sha256'], previewFile=rid + '.mp3', previewGain=round(cp['gain'], 6),
             previewRms=cp['rms'], previewPeak=cp['peak'], masterLocation='オーナーのMac（~/Downloads、原本は無加工）')
    new_recs.append(r)
    f = features(load(P(pc['parts'][0]['path'])))
    roles = m['roles']
    meta[rid] = dict(en=m['en'], nativeRegions=[], japanNative=None, japanEndemic=None, distributionBasis='環境音・種を特定しない合唱（分布なし）',
                     recordedCountry='日本', recordedArea=m['area'], recordedRegions=['asia', 'japan'], recordingEnvironment=m['env'],
                     wildOrCaptive='野外', habitats=m['habitats'], activity=m['activity'], activityBasis=m['activityBasis'],
                     soundRoles=roles, soundRolesBasis='原典の記載と録音の性格による手動分類（自動音響分析値を併記）',
                     acoustic={**{k: (round(x, 4) if isinstance(x, float) else x) for k, x in f.items()}, 'autoRoles': classify(f, 'landscape'), 'analysedFrom': 'pcm'},
                     note='日本録音の環境層（v0.25）。' + ('録音地の地名は原典に記載なし。' if not m['area'] else '') + ('生息環境が市街地の庭のため、生息環境フィルターには使わない。' if not m['habitats'] else ''))
    man['recordings'][rid] = dict(
        compat=dict(path=cp['path'], bytes=cp['bytes'], sha256=cp['sha256'], format='mp3', codec='MP3 128kbps', sampleRate=44100, channels=1,
                    duration=cp['duration'], lossless=False, gain=round(cp['gain'], 6), provenance='v0.25：原本WAVの抜粋から作成した互換MP3（44.1kHz・モノラル・128kbps）'),
        pcm=dict(format='wav', codec='Linear PCM 24-bit', bitDepth=24, sampleRate=b['sr'], channels=b['ch'], frames=pc['frames'],
                 duration=float(b['excerpt']), parts=pc['parts'], pcmDataSha256=pc['pcmDataSha256'], headroomScale=1.0, decodedPeak=b['peak'],
                 gain=pc['gain'], lossless=True, provenance=f"原本WAV（24-bit・{b['sr']}Hz）のサンプルをそのまま切り出した抜粋（{excerpt}）。ビット完全。原本全長はオーナーのMacに保管。"))
    new_audit.append(dict(kind='recording', id=rid, name=m['jp'], latin=r['latin'], japan=True, sourceFormat='wav / pcm_s24le', sourceRate=b['sr'],
                          sourceChannels=b['ch'], sourceDuration=b['srcDuration'], sourceBytes=b['srcBytes'], sourceSha256=m['sha'],
                          compat='MP3 128k / 44100Hz / 1ch', embeddedOriginal='なし（原本は100MB超のためMacに保管）', embeddedOriginalBytes=0,
                          pcmPath=f"PCM 24-bit {b['sr']}Hz {b['ch']}ch ({len(pc['parts'])} file{'s' if len(pc['parts']) > 1 else ''})",
                          pcmBytes=sum(p['bytes'] for p in pc['parts']), decodedPeak=round(b['peak'], 4), masterStatus='A2',
                          note=f"原典は{b['sr'] // 1000}kHz/24-bit/2ch WAV {round(b['srcDuration'])}秒（非圧縮マスター）。本ファイルは{excerpt}のビット完全な抜粋。原典全長はオーナーのMacに保管。",
                          license=m['license'], url=url))

recs = recs + new_recs
n_rec = sum(1 for a in audit if a['kind'] == 'recording')
audit = audit[:n_rec] + new_audit + audit[n_rec:]
man['version'] = 'v0.25'
put('ae-recordings', recs); put('ae-wildlife-meta', meta); put('ae-audio-manifest', man); put('ae-source-audit', audit)
json.dump(recs, open(P('data/recording_licenses.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(meta, open(P('data/wildlife_meta.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(man, open(P('data/audio_manifest.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(audit, open(P('data/source_audit.json'), 'w'), ensure_ascii=False, indent=1)
# CSV（BOM付き・CRLF）
old = open(P('data/source_audit.csv'), encoding='utf-8-sig').read()
cols = next(csv.reader(io.StringIO(old)))
buf = io.StringIO(); w = csv.writer(buf, lineterminator='\r\n'); w.writerow(cols)
for a in audit: w.writerow([a.get(c, '') for c in cols])
open(P('data/source_audit.csv'), 'w', encoding='utf-8-sig', newline='').write(buf.getvalue())

NR = len(recs); NA = len(audit); NB = sum(1 for r in recs if r.get('fieldBed'))
# 画面文言（日本語・英語辞書の両方）
REP = [
 (r'(\d+)実録音 / 環境層と自律演奏', f'{NR}実録音 / 環境層と自律演奏'), (r"'\d+ recordings / ambience beds and autonomous play'", f"'{NR} recordings / ambience beds and autonomous play'"),
 (r'実録音ライブラリ · \d+録音 / 個別試聴', f'実録音ライブラリ · {NR}録音 / 個別試聴'), (r'Recording library · \d+ recordings / individual preview', f'Recording library · {NR} recordings / individual preview'),
 (r'音源形式監査 · \d+サンプル', f'音源形式監査 · {NA}サンプル'), (r'Source format audit · \d+ samples', f'Source format audit · {NA} samples'),
 (r'\d+素材 · 全素材を同時再生可', f'{NB}素材 · 全素材を同時再生可'), (r'\d+ sources · all can play together', f'{NB} sources · all can play together'),
 (r'\d+ recordings · 23 species \+ \d+ choruses \+ \d+ environmental recordings', f'{NR} recordings · 23 species + 4 choruses + {NR - 27} environmental recordings'),
 (r"'\d+録音 / 必要な音だけ", "recordings.length+'録音 / 必要な音だけ"),
 (r'川・森の葉・風・雨・火(と日本録音の4素材（柏の虫・竹林と小川・水田のカエル・京都の雨）)?を独立して重ねます。', '川・森の葉・風・雨・火と日本録音の4素材（柏の虫・竹林と小川・水田のカエル・京都の雨）を独立して重ねます。'),
 (r"River, forest leaves, wind, rain and fire( plus four Japanese recordings \(Kashiwa insects, bamboo & stream, rice-paddy frogs, Kyoto rain\))? layer independently\.",
  'River, forest leaves, wind, rain and fire plus four Japanese recordings (Kashiwa insects, bamboo & stream, rice-paddy frogs, Kyoto rain) layer independently.'),
]
src = open(P('build/src_i18n.js'), encoding='utf-8').read()
for pat, rep in REP:
    html, n1 = re.subn(pat, rep, html)
    src, n2 = re.subn(pat, rep, src)
    print(f'{n1:2d} {n2:2d}', pat[:50])
# fieldDefaults（新しい層は初期音量0）
fd = re.search(r"const fieldDefaults=\{([^}]*)\};", html)
cur = dict(re.findall(r"'([a-z-]+)':(\d+)", fd.group(1)))
for rid in ids: cur.setdefault(rid, '0')
html = html[:fd.start(1)] + ','.join(f"'{k}':{v}" for k, v in cur.items()) + html[fd.end(1):]
# 録音地の英語表記（i18n 辞書）
LOC = {'千葉県柏市（畑と小さな林）': 'Kashiwa, Chiba, Japan (field and small wood)', '日本（地名の記載なし）': 'Japan (no place name given)',
       '和歌山県・高野山近くの富貴地区の水田': 'Rice paddy in the Fuki area near Kōyasan, Wakayama, Japan', '京都府京都市（庭）': 'Kyoto, Japan (garden)',
       'CC0 1.0': 'CC0 1.0'}
anchor = "'原本に記載なし':'Not stated in source',"
add = ''.join(f"'{k}':'{v}'," for k, v in LOC.items() if k not in src and re.search('[぀-鿿]', k))
if add:
    assert html.count(anchor) == 1 and src.count(anchor) == 1
    html = html.replace(anchor, anchor + add); src = src.replace(anchor, anchor + add)
open(P('build/src_i18n.js'), 'w', encoding='utf-8').write(src)
html = html.replace('v0.24 · REAL RECORDINGS · PCM WAV · 25 CORE LAYERS', 'v0.25 · REAL RECORDINGS · PCM WAV · 25 CORE LAYERS')
html = re.sub(r'<title>AUDIO ECOSYSTEM v0\.2[45]', '<title>AUDIO ECOSYSTEM v0.25', html)
open(P('index.html'), 'w', encoding='utf-8').write(html)
print('recordings', NR, 'audit', NA, 'beds', NB)
