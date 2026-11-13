#!/usr/bin/env python3
"""毎日の縦動画（Instagram リール・YouTube ショート共用：1080×1920・20秒・H.264/AAC）を作る。
1本＝実録音1件。映像は公開アプリと同じシェーダー（tools/render_visual.js）。画面に録音名・録音者・ライセンスを入れ、説明欄用のクレジット（caption.txt）も作る。
- 使うのは CC0・パブリックドメイン・CC BY の録音だけ（BY-SA・NC は使わない）。World Voices は使わない。
- 画面の文字と説明文は英語が既定（2026-11-13 オーナー指示）。説明文には日本語も添える。英語名のない録音は選ばない。
- 使った録音は tools/daily_history.json に記録し、同じ録音・同じ分類・同じ映像が続かないように回す。
使い方：python3 tools/make_daily.py --app ../audio-ecosystem-sounds-1/index.html --out <出力フォルダ> --start 2026-11-14 --days 7
"""
import argparse, datetime, hashlib, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; R = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
URL = 'sawwaudio.github.io/audio-ecosystem-sounds-1'
CATS = ['ambience', 'birds', 'aquatic', 'insects', 'amphibians', 'mammals']
CAT_JA = {'ambience': '環境音', 'birds': '鳥', 'aquatic': '水の生き物', 'insects': '虫', 'amphibians': '両生類', 'mammals': '哺乳類'}
STYLES = ['contour', 'flow', 'geometry']
ap = argparse.ArgumentParser(); ap.add_argument('--app', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--start', required=True); ap.add_argument('--days', type=int, default=7); ap.add_argument('--sec', type=float, default=20)
a = ap.parse_args()
h = open(a.app, encoding='utf-8').read(); appdir = os.path.dirname(os.path.abspath(a.app))
blk = lambda i: json.loads(re.search(r'id="%s">(.*?)</script>' % i, h, re.S).group(1))
recs = {r['id']: r for r in blk('ae-recordings')}; cat = blk('ae-categories')['categories']; man = blk('ae-audio-manifest')['recordings']; meta = blk('ae-wildlife-meta')
HP = os.path.join(ROOT, 'tools', 'daily_history.json'); hist = json.load(open(HP, encoding='utf-8')) if os.path.exists(HP) else []
used = {x['id'] for x in hist}
def allowed(r):
    L = r['license']; return (L.startswith('CC0') or L == 'Public domain' or L.startswith('CC BY ')) and 'SA' not in L and 'NC' not in L
def src(i):
    try: return os.path.normpath(os.path.join(appdir, man[i]['pcm']['parts'][0]['path']))
    except Exception: return None
pool = {c: sorted(i for i, r in recs.items() if cat.get(i, {}).get('cat') == c and allowed(r) and i not in used and (r.get('embeddedDuration') or 0) >= a.sec + 1 and src(i) and os.path.exists(src(i)) and (meta.get(i) or {}).get('en')) for c in CATS}
al = lambda s, e: f"if(lt(t,{s}),0,if(lt(t,{s+0.6}),(t-{s})/0.6,if(lt(t,{e-0.6}),1,if(lt(t,{e}),({e}-t)/0.6,0))))"
def run(cmd): subprocess.run(cmd, check=True)
day0 = datetime.date.fromisoformat(a.start); n0 = len(hist); made = []
for d in range(a.days):
    k = n0 + d; c = next((CATS[(k + j) % len(CATS)] for j in range(len(CATS)) if pool[CATS[(k + j) % len(CATS)]]), None)
    if not c: print('使える録音がもうありません'); break
    i = pool[c].pop(int(hashlib.sha1(f'{k}'.encode()).hexdigest(), 16) % len(pool[c])); r = recs[i]; style = STYLES[k % 3]
    hue = 150 + int(hashlib.sha1(i.encode()).hexdigest(), 16) % 150; date = (day0 + datetime.timedelta(days=d)).isoformat()
    od = os.path.join(a.out, f'{date}_{i}'); os.makedirs(od, exist_ok=True); en = (meta.get(i) or {}).get('en') or ''
    dur = float(r['embeddedDuration']); ss = max(0, min(2.0, dur - a.sec - .2)); wav = os.path.join(od, 'audio.wav')
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(ss), '-t', str(a.sec), '-i', src(i), '-af', f'loudnorm=I=-18:TP=-1.5,afade=t=in:d=0.6,afade=t=out:st={a.sec-1.0}:d=1.0', '-ar', '48000', '-ac', '2', wav])
    base = os.path.join(od, 'base.mp4')
    if not os.path.exists(base): run(['node', os.path.join(ROOT, 'tools', 'render_visual.js'), '--audio', wav, '--app', a.app, '--out', base, '--size', '1080x1920', '--plan', f'{style}:{a.sec}', '--hue', str(hue)])
    fs = ['drawbox=x=0:y=150:w=iw:h=400:color=black@0.28:t=fill', 'drawbox=x=0:y=1500:w=iw:h=420:color=black@0.45:t=fill']; tn = [0]
    def dt(txt, f, sz, x, y, alpha, col='0xf1ece0'):
        p = os.path.join(od, f't{tn[0]}.txt'); tn[0] += 1; open(p, 'w', encoding='utf-8').write(txt)
        fs.append(f"drawtext=fontfile={f}:textfile={p}:fontsize={sz}:fontcolor={col}:x={x}:y={y}:alpha='{alpha}':shadowcolor=black@0.7:shadowx=0:shadowy=2")
    cut = lambda s, n: s if len(s) <= n else s[:n - 1] + '…'
    E = a.sec - .3; jp = r['jp']; sz = 62 if len(jp) <= 14 else 48 if len(jp) <= 19 else 38
    dt('20 SECONDS IN NATURE', R, 34, '(w-text_w)/2', 200, al(.4, 5.2), '0xa9c1b6'); dt('Close your eyes.', B, 66, '(w-text_w)/2', 270, al(.4, 5.2))
    main, sub = (en.split(': ', 1) + [''])[:2] if len(en) > 30 and ': ' in en else (en, '')
    ez = 58 if len(main) <= 22 else 46 if len(main) <= 30 else 36
    dt(cut(main, 46), B, ez, '(w-text_w)/2', 235, al(5.6, 14.2))
    if sub: dt(cut(sub, 52), R, 32, '(w-text_w)/2', 320, al(5.6, 14.2))
    dt(cut(jp, 30), R, 30, '(w-text_w)/2', 380 if sub else 330, al(5.6, 14.2), '0xa9c1b6')
    loc = r.get('location') or ''
    dt('Play this sound yourself.', B, 58, '(w-text_w)/2', 220, al(14.6, E)); dt('saww audio ecosystem', B, 50, '(w-text_w)/2', 315, al(14.6, E)); dt(URL, R, 32, '(w-text_w)/2', 400, al(14.6, E), '0xa9c1b6')
    dt(cut(f'Recording: {r["author"]} · {r["license"]}', 52), R, 30, 60, 1560, al(.4, E), '0xdfe9e3'); dt('Real field recording · full credits in caption', R, 24, 60, 1610, al(.4, E), '0xa9c1b6')
    vf = os.path.join(od, 'vf.txt'); open(vf, 'w').write(','.join(fs) + ',format=yuv420p')
    out = os.path.join(od, f'saww_{date}_{i}.mp4')
    run(['ffmpeg', '-v', 'error', '-y', '-i', base, '-filter_script:v', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-maxrate', '10M', '-bufsize', '20M', '-c:a', 'copy', '-movflags', '+faststart', out])
    name_en = en or r.get('latin') or r['jp']
    cap = f"""[YouTube Shorts title]
{cut(en, 60)} | 20 seconds in nature #Shorts

[Caption — Instagram and YouTube]
Close your eyes. 20 seconds of a real field recording: {en}.
The visual is drawn from the sound itself — its low end, its highs, its onsets.

Play this sound yourself, layer it, and turn it into video. All features are free until Dec 31, 2026 (JST):
https://{URL}/

目を閉じて、20秒。{jp}の実録音です。映像は、この音そのものから描いています。
自分で鳴らして、重ねて、映像にできます（2026年12月31日まで全機能を無料開放中）。

— Recording credit / 録音クレジット —
{r.get('title') or en} — {r['author']} / {r['license']} {r.get('licenseURL') or ''}
Source / 出典: {r.get('url') or ''}
Location / 録音地: {loc or '記載なし'}
Changes / 加工: excerpt ({ss:.1f}–{ss+a.sec:.1f} s), loudness adjusted, fades, visual added / 抜粋・音量の調整・両端のフェード・映像の追加

#saww #sawwaudioecosystem #natureasaninstrument #fieldrecording #soundscape #naturesounds #audiovisual #自然音 #フィールドレコーディング
"""
    open(os.path.join(od, 'caption.txt'), 'w', encoding='utf-8').write(cap)
    for f in os.listdir(od):
        if re.match(r't\d+\.txt|vf\.txt', f): os.remove(os.path.join(od, f))
    hist.append({'date': date, 'id': i, 'cat': c, 'style': style, 'hue': hue, 'license': r['license'], 'author': r['author'], 'file': os.path.basename(out)})
    json.dump(hist, open(HP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); made.append(out); print('made', out, flush=True)
print(len(made), '本')
