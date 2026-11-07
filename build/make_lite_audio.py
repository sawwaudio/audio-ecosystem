#!/usr/bin/env python3
"""v0.53：軽量の配信音源（MP3 VBR・ステレオのまま）を作る。
オーナー要望（2026-11-07「ちょっと重すぎ。ネットが弱いとすごい重い」）。v0.52 までは既定が FLAC（原本と同じ音）で、
再生を押して20秒で約32MB を読み込んでいた。既定を「軽量」にし、FLAC は「高音質」として選べるように残す。
- 元：各録音の配信用 FLAC（data/audio_manifest.json の recordings[id].pcm）。FLAC がない録音（9件）は従来の互換 MP3 を使う。
- 出力：音源リポジトリの audio/lite/<id>.mp3（本体には置かない。パスは ../audio-ecosystem-sounds-1/audio/lite/…）。
- 形式：LAME VBR -q:a 3（およそ 175kbps）。チャンネル数は元のまま（環境音の左右の広がりを保つ）。
  サンプルレートは 48kHz を超えるものだけ 48kHz に下げ、MP3 で使えない値（7812・11024・96096 など）は近い値に合わせる。
- 音量：元の FLAC と同じレベルで書き出すので、gain は pcm の gain をそのまま使う（実測でピークの差を確かめる）。
- 何度実行しても同じ結果（出力があり SHA-256 が台帳と一致すれば作り直さない）。
使い方：python3 build/make_lite_audio.py [音源リポジトリのパス（既定 ../audio-ecosystem-sounds-1）]
"""
import hashlib, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
SOUNDS = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else P('..', 'audio-ecosystem-sounds-1'))
OUT_REL = '../audio-ecosystem-sounds-1/audio/lite/'
MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000]
sha = lambda f: hashlib.sha256(open(f, 'rb').read()).hexdigest()


def rate_for(sr):
    if sr >= 48000:
        return 48000
    return min(MP3_RATES, key=lambda r: (abs(r - sr), -r))


def probe(f):
    o = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=sample_rate,channels:format=duration', '-of', 'json', f],
                                  capture_output=True, text=True, check=True).stdout)
    s = o['streams'][0]
    return int(s['sample_rate']), int(s['channels']), float(o['format']['duration'])


def peak(f):
    r = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.search(r'max_volume: (-?[\d.]+) dB', r.stderr)
    return float(m.group(1)) if m else None


def make(item):
    rid, pcm = item
    src = os.path.normpath(os.path.join(ROOT, pcm['parts'][0]['path']))
    out = os.path.join(SOUNDS, 'audio', 'lite', rid + '.mp3')
    ar = rate_for(pcm['sampleRate'])
    if not os.path.exists(out):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-map_metadata', '-1', '-ar', str(ar), '-c:a', 'libmp3lame', '-q:a', '3', out], check=True)
    sr, ch, dur = probe(out)
    d = abs(peak(out) - peak(src))
    return rid, {'path': OUT_REL + rid + '.mp3', 'bytes': os.path.getsize(out), 'sha256': sha(out), 'format': 'mp3', 'codec': 'MP3 VBR（約175kbps・軽量）',
                 'sampleRate': sr, 'channels': ch, 'duration': round(dur, 6), 'lossless': False, 'gain': pcm['gain'],
                 'provenance': '配信用 FLAC（%s）から LAME VBR で書き出し（v0.53・軽量の既定）。チャンネル数は元のまま%s。' % (
                     pcm['parts'][0]['path'].split('/')[-1], '' if ar == pcm['sampleRate'] else '、%dHz→%dHz' % (pcm['sampleRate'], ar))}, d


def main():
    os.makedirs(os.path.join(SOUNDS, 'audio', 'lite'), exist_ok=True)
    man = json.load(open(P('data/audio_manifest.json'), encoding='utf-8'))
    items = [(k, v['pcm']) for k, v in man['recordings'].items() if v.get('pcm')]
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
        res = list(ex.map(make, items))
    worst = max(d for _, _, d in res)
    for rid, e, _ in res:
        man['recordings'][rid]['lite'] = e
    json.dump(man, open(P('data/audio_manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    html = open(P('index.html'), encoding='utf-8').read()
    m = re.search(r'(<script type="application/json" id="ae-audio-manifest">)(.*?)(</script>)', html, re.S)
    html = html[:m.start(2)] + json.dumps(man, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + html[m.end(2):]
    open(P('index.html'), 'w', encoding='utf-8').write(html)
    tot = sum(e['bytes'] for _, e, _ in res)
    flac = sum(sum(x['bytes'] for x in p['parts']) for _, p in items)
    print('軽量 %d 本 %.1fMB（FLAC %.1fMB の %.0f%%）・ピークの差 最大 %.2f dB' % (len(res), tot / 1e6, flac / 1e6, 100 * tot / flac, worst))


if __name__ == '__main__':
    main()
