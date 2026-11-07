#!/usr/bin/env python3
"""v0.55：VCSL（CC0）の伝統楽器を取り込む（ムビラ・バラフォン・ダン・チャン・弓で弾くプサルテリー・ネパールのハンドベル・ディジュリドゥのフレーズ）。v0.45 の取り込みと同じ手順・同じ記録。

- 原本：https://github.com/sgossner/VCSL の固定コミット c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e（README・LICENSE で CC0 1.0 を確認）。
  取得はオーナーの許可（2026-11-06 チャット）を得て git の部分取得で行った。原本 WAV の SHA-256 を台帳に残す。
- 配信：instruments/pcm/vcsl_*.flac（原本と同じビット深度・サンプルレート・ステレオ。復号すると原本 PCM とビット単位で同一＝無加工）
        instruments/compat/<id>.mp3（互換：モノラル 44.1kHz 128kbps。従来の楽器と同じ）
- 音高（midi）は実測（スペクトルの基音、プサルテリーは自己相関）。VCSL の音名は1オクターブ下の表記。ハンドベルは音高なし。
  ゴング・打楽器は音高を持たない（pitched=false）。
- gain：持続音は鳴っている区間の RMS を −20 dBFS、打楽器はピークを −6 dBFS にそろえる係数（再生時に掛ける。ファイルは無加工）。
使い方：python3 build/import_vcsl_v045.py <VCSL を部分取得したフォルダ>
"""
import hashlib, json, os, re, subprocess, sys, csv, io, urllib.parse
import numpy as np, soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
SRC = sys.argv[1]
COMMIT = 'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e'
sha = lambda b: hashlib.sha256(b).hexdigest()

# kind, VCSL のパス, midi（音高のないものは None）
LIST = [
    # 伝統楽器（v0.55、オーナー要望 2026-11-07「伝統楽器を中心に。倍音が素晴らしい楽器」）。音高はすべて実測（VCSL の音名＋1オクターブが実際の基音）。
    # ムビラ・ザヴァジム（ジンバブエ）・バラフォン（西アフリカの木琴）・ダン・チャン（ベトナムの箏）は平均律ではないので、スペクトルで測った基音（小数）を使う。
    # 弓で弾くプサルテリーは自己相関で測った基音。ネパールのハンドベルは音高を持たない扱い（そのまま鳴らす）。
    # ディジュリドゥのフレーズは持続音（Sus、v0.45）と同じ楽器で、基音はおよそ 69Hz（midi 37）。
    ('mbira', 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B/MBira4_pluck_Main_B2_13_50_100_rr3.wav', 59.3),
    ('mbira', 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B/MBira4_pluck_Main_D#3_15_50_100_rr1.wav', 63.08),
    ('mbira', 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B/MBira4_pluck_Main_F#3_11_50_100_rr2.wav', 66.15),
    ('mbira', 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B/MBira4_pluck_Main_G#3_7_50_100_rr2.wav', 68.12),
    ('mbira', 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B/MBira4_pluck_Main_B3_16_50_100_rr2.wav', 71.22),
    ('mbira', 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B/MBira4_pluck_Main_C#4_17_50_100_rr1.wav', 73.02),
    ('mbira', 'Idiophones/Plucked Idiophones/Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B/MBira4_pluck_Main_E4_19_50_100_rr2.wav', 76.1),
    ('balafon', 'Idiophones/Struck Idiophones/Balafon/Traditional Mallet/EthnicXylo_tradM_C#3_vl2_rr1_Mid.wav', 61.1),
    ('balafon', 'Idiophones/Struck Idiophones/Balafon/Traditional Mallet/EthnicXylo_tradM_F3_vl2_rr1_Mid.wav', 65.16),
    ('balafon', 'Idiophones/Struck Idiophones/Balafon/Traditional Mallet/EthnicXylo_tradM_C4_vl2_rr1_Mid.wav', 71.98),
    ('balafon', 'Idiophones/Struck Idiophones/Balafon/Traditional Mallet/EthnicXylo_tradM_F4_vl2_rr1_Mid.wav', 77.02),
    ('balafon', 'Idiophones/Struck Idiophones/Balafon/Traditional Mallet/EthnicXylo_tradM_C5_vl2_rr1_Mid.wav', 83.98),
    ('balafon', 'Idiophones/Struck Idiophones/Balafon/Traditional Mallet/EthnicXylo_tradM_F5_vl2_rr1_Mid.wav', 88.85),
    ('danTranh', 'Chordophones/Zithers/Dan Tranh/Normal/C#3_mf_1.wav', 61.43),
    ('danTranh', 'Chordophones/Zithers/Dan Tranh/Normal/D#3_mf_1.wav', 63.09),
    ('danTranh', 'Chordophones/Zithers/Dan Tranh/Normal/F#3_mf_1.wav', 65.88),
    ('danTranh', 'Chordophones/Zithers/Dan Tranh/Normal/G#3_mf_1.wav', 68.0),
    ('danTranh', 'Chordophones/Zithers/Dan Tranh/Normal/B3_mf_1.wav', 71.0),
    ('danTranh', 'Chordophones/Zithers/Dan Tranh/Normal/C#4_mf_1.wav', 72.91),
    ('bowedPsaltery', 'Chordophones/Zithers/Psaltery, Bowed and Plucked/LongBow/BowedPsaltery_C4_Main_LongBow_rr1.wav', 72.06),
    ('bowedPsaltery', 'Chordophones/Zithers/Psaltery, Bowed and Plucked/LongBow/BowedPsaltery_E4_Main_LongBow_rr2.wav', 75.97),
    ('bowedPsaltery', 'Chordophones/Zithers/Psaltery, Bowed and Plucked/LongBow/BowedPsaltery_G#4_Main_LongBow_rr1.wav', 80.03),
    ('bowedPsaltery', 'Chordophones/Zithers/Psaltery, Bowed and Plucked/LongBow/BowedPsaltery_C5_Main_LongBow_rr1.wav', 84.06),
    ('bowedPsaltery', 'Chordophones/Zithers/Psaltery, Bowed and Plucked/LongBow/BowedPsaltery_E5_Main_LongBow_rr2.wav', 88.23),
    ('handBells', 'Idiophones/Struck Idiophones/Hand Bells, Nepalese/HB_1.wav', None),
    ('handBells', 'Idiophones/Struck Idiophones/Hand Bells, Nepalese/HB_2.wav', None),
    ('handBells', 'Idiophones/Struck Idiophones/Hand Bells, Nepalese/HB_3.wav', None),
    ('didgePhrase', 'Aerophones/Lip Aerophones/Didgeridoo/Didgeridoo1_Phrase1_Main.wav', 37),
    ('didgePhrase', 'Aerophones/Lip Aerophones/Didgeridoo/Didgeridoo1_Phrase3_Main.wav', 37),
    ('didgePhrase', 'Aerophones/Lip Aerophones/Didgeridoo/Didgeridoo1_Phrase5_Main.wav', 37),
    ('didgePhrase', 'Aerophones/Lip Aerophones/Didgeridoo/Didgeridoo1_Phrase6_Main.wav', 37),
    ('didgePhrase', 'Aerophones/Lip Aerophones/Didgeridoo/Didgeridoo1_Phrase8_Main.wav', 37),
]
# 減衰する打音・撥弦はピークをそろえる（フレーズと弓は従来どおり）
HITS = {'mbira', 'balafon', 'danTranh', 'handBells'}
NAME_JA = {'mbira': 'ムビラ・ザヴァジム（ジンバブエ）', 'balafon': 'バラフォン（西アフリカの木琴）', 'danTranh': 'ダン・チャン（ベトナムの箏）', 'bowedPsaltery': '弓で弾くプサルテリー', 'handBells': 'ハンドベル（ネパール）', 'didgePhrase': 'ディジュリドゥ（フレーズ）'}


def level_gain(x, sr, hit):
    m = x.mean(1)
    if hit:
        return float(10 ** (-6 / 20) / max(1e-9, np.abs(x).max()))
    w = int(sr * .1); n = len(m) // w
    rms = np.sqrt((m[:n * w].reshape(n, w) ** 2).mean(1))
    act = rms[rms > rms.max() * 10 ** (-30 / 20)]
    return float(10 ** (-20 / 20) / max(1e-9, np.sqrt((act ** 2).mean())))


def ffmpeg(*a, out=False):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], capture_output=True, check=True)
    return r.stdout


def main():
    insts = json.load(open(P('data/instrument_samples.json'), encoding='utf-8'))
    man = json.load(open(P('data/audio_manifest.json'), encoding='utf-8'))
    audit = json.load(open(P('data/source_audit.json'), encoding='utf-8'))
    have = {i['id'] for i in insts}
    count = {}
    for kind, path, midi in LIST:
        count[kind] = count.get(kind, 0) + 1
        iid = f'{kind}-{count[kind]}'
        src = os.path.join(SRC, path)
        raw = open(src, 'rb').read()
        info = sf.info(src)
        x, sr = sf.read(src, always_2d=True)
        bits = {'PCM_16': 16, 'PCM_24': 24}[info.subtype]
        base = re.sub(r'[^A-Za-z0-9_.-]', '', os.path.basename(path).replace('#', 's'))
        flac_rel = f'instruments/pcm/vcsl_{base[:-4]}.flac'
        os.makedirs(P('instruments/pcm'), exist_ok=True); os.makedirs(P('instruments/compat'), exist_ok=True)
        ffmpeg('-i', src, '-map_metadata', '-1', '-c:a', 'flac', '-compression_level', '8', '-bits_per_raw_sample', str(bits),
               '-sample_fmt', 's16' if bits == 16 else 's32', P(flac_rel))
        fmt = 's16le' if bits == 16 else 's24le'
        a = ffmpeg('-i', src, '-f', fmt, '-acodec', 'pcm_' + fmt, '-')
        b = ffmpeg('-i', P(flac_rel), '-f', fmt, '-acodec', 'pcm_' + fmt, '-')
        assert sha(a) == sha(b), ('FLAC がビット完全でない', iid)
        mp3_rel = f'instruments/compat/{iid}.mp3'
        ffmpeg('-i', src, '-map_metadata', '-1', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', P(mp3_rel))
        xc, src_c = sf.read(P(mp3_rel), always_2d=True)
        hit = kind in HITS
        fb, mb = open(P(flac_rel), 'rb').read(), open(P(mp3_rel), 'rb').read()
        url = 'https://raw.githubusercontent.com/sgossner/VCSL/' + COMMIT + '/' + urllib.parse.quote(path)
        dur = round(len(x) / sr, 6)
        entry = {'id': iid, 'kind': kind, 'midi': midi if midi is not None else 60, 'role': 'traditional', 'pitched': midi is not None, 'file': f'{iid}.mp3',
                 'original': os.path.basename(path), 'url': url, 'sourceURL': 'https://github.com/sgossner/VCSL', 'license': 'CC0 1.0',
                 'licenseURL': 'https://creativecommons.org/publicdomain/zero/1.0/', 'author': 'Versilian Studios LLC / VCSL contributors',
                 'recordist': 'Simon Dalzell（Ivy Audio）' if kind == 'organPedal' else '個別録音者は配布資料で未確認', 'date': '未確認', 'location': '未確認',
                 'duration': dur, 'sha256': sha(raw), 'embeddedSha256': sha(mb), 'nameJa': NAME_JA[kind], 'added': 'v0.55',
                 'changes': '無加工（FLAC は原本 PCM とビット単位で同一）。互換版はモノラル 44.1kHz/128kbps MP3。再生時に音量をそろえ、音高のある楽器は和音の根音へ速度変換。'}
        if kind == 'organPedal':
            entry['note'] = 'VCSL の Pipe Organ（Info.txt：Simon Dalzell / Ivy Audio が 2015-16 年に収録、Versilian Studios による再配布許諾）。VCSL 全体は CC0 1.0。作者・Versilian Studios の表記を推奨と記載。'
        man['instruments'][iid] = {
            'pcm': {'path': flac_rel, 'bytes': len(fb), 'sha256': sha(fb), 'format': 'flac', 'codec': f'FLAC {bits}-bit（可逆圧縮）', 'bitDepth': bits,
                    'sampleRate': sr, 'channels': x.shape[1], 'duration': dur, 'parts': [{'path': flac_rel, 'bytes': len(fb), 'sha256': sha(fb), 'frames': len(x)}],
                    'gain': level_gain(x, sr, hit), 'lossless': True, 'provenance': 'VCSL原本WAV（固定コミット取得・SHA-256記録・無加工） 配信はFLAC（可逆圧縮。復号すると原本PCMとビット単位で同一）。',
                    'pcmDataSha256': sha(a)},
            'compat': {'path': mp3_rel, 'bytes': len(mb), 'sha256': sha(mb), 'format': 'mp3', 'codec': 'MP3 128kbps', 'sampleRate': src_c, 'channels': 1,
                       'gain': level_gain(xc, src_c, hit), 'lossless': False}}
        if iid not in have:
            insts.append(entry)
        else:
            insts[[i['id'] for i in insts].index(iid)] = entry
        audit = [r for r in audit if not (r['kind'] == 'instrument' and r['id'] == iid)]
        audit.append(dict(kind='instrument', id=iid, name=os.path.basename(path), sourceFormat='WAV PCM', sourceRate=sr, sourceChannels=x.shape[1],
                          sourceDuration=dur, sourceBytes=len(raw), sourceSha256=sha(raw), compat=f'MP3 128k / {src_c}Hz / 1ch',
                          embeddedOriginal='v0.55 で VCSL 原本 WAV を取得', embeddedOriginalBytes=0, pcmPath=f'FLAC {bits}-bit {sr}Hz {x.shape[1]}ch',
                          pcmBytes=len(fb), masterStatus='A1', note='非圧縮マスター入手済み（VCSL 原本）。', license='CC0 1.0', url=url))
        print(iid, flac_rel, len(fb), 'gain %.2f' % man['instruments'][iid]['pcm']['gain'])
    json.dump(insts, open(P('data/instrument_samples.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(man, open(P('data/audio_manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(audit, open(P('data/source_audit.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    old = open(P('data/source_audit.csv'), encoding='utf-8-sig').read(); cols = next(csv.reader(io.StringIO(old)))
    buf = io.StringIO(); w = csv.writer(buf, lineterminator='\r\n'); w.writerow(cols)
    for r in audit: w.writerow([r.get(c, '') for c in cols])
    open(P('data/source_audit.csv'), 'w', encoding='utf-8-sig', newline='').write(buf.getvalue())
    # index.html の JSON を差し替え
    html = open(P('index.html'), encoding='utf-8').read()
    for i, obj in (('ae-instruments', insts), ('ae-audio-manifest', man), ('ae-source-audit', audit)):
        m = re.search(r'(<script type="application/json" id="' + i + r'">)(.*?)(</script>)', html, re.S)
        html = html[:m.start(2)] + json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + html[m.end(2):]
    open(P('index.html'), 'w', encoding='utf-8').write(html)
    # CREDITS.md に追記（同じ id の行があれば作り直す）
    cr = open(P('CREDITS.md'), encoding='utf-8').read()
    head = '\n## v0.55 で追加した伝統楽器の実録音（VCSL・CC0 1.0）\n'
    if head in cr:
        cr = cr[:cr.index(head)]
    rows = [head, f'Versilian Community Sample Library (VCSL), CC0 1.0 — https://github.com/sgossner/VCSL (commit {COMMIT})。表記は不要だが、Versilian Studios と各録音者への謝意として記載する。\n',
            '| ID | 楽器 | 原本 |', '|---|---|---|']
    for e in insts:
        if e.get('added') == 'v0.55':
            rows.append(f"| {e['id']} | {e['nameJa']} | [{e['original']}]({e['url']}) |")
    open(P('CREDITS.md'), 'w', encoding='utf-8').write(cr.rstrip('\n') + '\n' + '\n'.join(rows) + '\n')


main()
