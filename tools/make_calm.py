#!/usr/bin/env python3
"""落ち着いた自然の縦動画（CALM シリーズ：1080×1920・30秒）。2026-11-14 オーナー指示「もっと自然の落ち着いた雰囲気の動画も出したほうが良い」。
- 音は実録音1件だけ（楽器を足さない）。長めのフェードで静かに始まり静かに終わる。
- 映像は tools/calm_visual.py（ぼけた光がゆっくり漂う）。色は録音の場所・時間帯から選ぶ（雨・水・夜・夜明け・森）。
- 文字は少なく、遅く出す。録音者・ライセンスは画面の下に常に小さく出す。説明欄に全クレジット。
- 録音は CC0・PD・CC BY だけ。環境音（雨・水・風・森）を中心に選ぶ。tools/calm_history.json に記録し、毎日動画（daily_history.json）の直近14本とも重ならないようにする。
使い方：python3 tools/make_calm.py --app ../audio-ecosystem-sounds-1/index.html --out <出力> --start 2026-11-15 --days 7
"""
import argparse, datetime, hashlib, json, os, re, subprocess, sys, textwrap
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; R = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'; L = '/usr/share/fonts/opentype/noto/NotoSansCJK-Light.ttc'
URL = 'sawwaudio.github.io/audio-ecosystem-sounds-1'
ap = argparse.ArgumentParser(); ap.add_argument('--app', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--start', required=True); ap.add_argument('--days', type=int, default=7); ap.add_argument('--sec', type=float, default=30)
ap.add_argument('--ids', nargs='*', help='録音IDを直接指定（順番どおり）')
# 2026-11-14 パターン化：映像（bokeh＝従来のぼけた光／meadow・komorebi・saiun＝tools/pattern_visual.py）、パラメーター、文字、録音の好みを patterns.json から渡す（tools/make_reel.py）
ap.add_argument('--visual', default='bokeh', choices=['bokeh', 'meadow', 'komorebi', 'saiun']); ap.add_argument('--params', default='{}')
ap.add_argument('--pattern', default='calm-bokeh'); ap.add_argument('--version', type=int, default=1); ap.add_argument('--kicker', default='BREATHE  ·  30 SECONDS')
ap.add_argument('--prefer', default='', help='録音の好み（カンマ区切りの語。名前・生息環境に含む録音を優先）'); ap.add_argument('--dry', action='store_true', help='録音の選択だけ表示')
a = ap.parse_args()
if not os.path.exists(L): L = R
h = open(a.app, encoding='utf-8').read(); appdir = os.path.dirname(os.path.abspath(a.app))
blk = lambda i: json.loads(re.search(r'id="%s">(.*?)</script>' % i, h, re.S).group(1))
recs = {r['id']: r for r in blk('ae-recordings')}; cat = blk('ae-categories')['categories']; man = blk('ae-audio-manifest')['recordings']; meta = blk('ae-wildlife-meta')
HP = os.path.join(ROOT, 'tools', 'calm_history.json'); hist = json.load(open(HP, encoding='utf-8')) if os.path.exists(HP) else []
DH = os.path.join(ROOT, 'tools', 'daily_history.json'); dh = json.load(open(DH, encoding='utf-8')) if os.path.exists(DH) else []
used = {x['id'] for x in hist} | {x['id'] for x in dh[-14:]}
def allowed(r):
    L_ = r['license']; return (L_.startswith('CC0') or L_ == 'Public domain' or L_.startswith('CC BY ')) and 'SA' not in L_ and 'NC' not in L_
def src(i):
    try: return os.path.normpath(os.path.join(appdir, man[i]['pcm']['parts'][0]['path']))
    except Exception: return None
def calm_ok(i):
    m = meta.get(i) or {}; roles = set(m.get('soundRoles') or []); ac = m.get('acoustic') or {}
    return bool(roles & {'Atmosphere', 'Texture', 'Drone'}) and (ac.get('envCV') or 1) < 0.6   # 大きな音の跳ねが少ない録音
def palette(i):
    m = meta.get(i) or {}; t = ' '.join([i, m.get('en') or '', recs[i]['jp'], ' '.join(m.get('habitats') or [])]).lower(); act = m.get('activity') or []
    if 'rain' in t or '雨' in t: return 'rain'
    if 'night' in act or 'night' in t or '夜' in t: return 'night'
    if 'dawn' in t or '夜明け' in t or '朝' in t: return 'dawn'
    if any(k in t for k in ('wave', 'ocean', 'sea', 'river', 'stream', 'creek', 'water', 'lake', 'pond', 'coast', '川', '海', '波')): return 'water'
    return 'forest'
ok = lambda i: allowed(recs[i]) and (recs[i].get('embeddedDuration') or 0) >= a.sec + 1 and src(i) and os.path.exists(src(i)) and (meta.get(i) or {}).get('en')
pool = sorted(i for i in recs if ok(i) and i not in used and calm_ok(i))
PREF = [k.strip().lower() for k in a.prefer.split(',') if k.strip()]
def liked(i):
    m = meta.get(i) or {}; t = ' '.join([i, m.get('en') or '', recs[i]['jp'], ' '.join(m.get('habitats') or []), ' '.join(m.get('activity') or [])]).lower(); return any(k in t for k in PREF)
if PREF and any(liked(i) for i in pool): pool = [i for i in pool if liked(i)] + [i for i in pool if not liked(i)]
# 日本の録音を少し優先し、色（雨・水・夜・夜明け・森）が続かないように並べる
al = lambda s, e: f"if(lt(t,{s}),0,if(lt(t,{s+1.0}),(t-{s})/1.0,if(lt(t,{e-1.0}),1,if(lt(t,{e}),({e}-t)/1.0,0))))"
def run(cmd): subprocess.run(cmd, check=True)
day0 = datetime.date.fromisoformat(a.start); made = []; last = hist[-1]['palette'] if hist else ''
for d in range(a.days):
    if a.ids:
        if d >= len(a.ids): break
        i = a.ids[d]
        if not (ok(i) and allowed(recs[i])): sys.exit(f'{i}: 使えない録音')
    else:
        cand = [x for x in pool if palette(x) != last] or pool
        if PREF and any(liked(x) for x in cand): cand = [x for x in cand if liked(x)]
        if not cand: print('使える録音がもうありません'); break
        jpn = [x for x in cand if 'japan' in ((meta.get(x) or {}).get('recordedRegions') or [])]
        k = len(hist); src_list = jpn if (jpn and k % 2 == 0) else cand
        i = src_list[int(hashlib.sha1(f'calm{k}'.encode()).hexdigest(), 16) % len(src_list)]
    if i in pool: pool.remove(i)
    r = recs[i]; m = meta.get(i) or {}; en = m['en']; jp = r['jp']; pal = palette(i); last = pal
    if a.dry: print(a.pattern, i, en, pal); continue
    date = (day0 + datetime.timedelta(days=d)).isoformat(); od = os.path.join(a.out, f'{date}_calm_{i}'); os.makedirs(od, exist_ok=True)
    dur = float(r['embeddedDuration']); ss = max(0, min(3.0, dur - a.sec - .2)); wav = os.path.join(od, 'audio.wav')
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(ss), '-t', str(a.sec), '-i', src(i), '-af',
         f'highpass=f=35,loudnorm=I=-17:TP=-2,afade=t=in:d=2.5,afade=t=out:st={a.sec-3}:d=3', '-ar', '48000', '-ac', '2', wav])
    base = os.path.join(od, 'base.mp4')
    if not os.path.exists(base):
        seed = str(int(hashlib.sha1(i.encode()).hexdigest(), 16) % 9973)
        if a.visual == 'bokeh': run([sys.executable, os.path.join(ROOT, 'tools', 'calm_visual.py'), '--audio', wav, '--out', base, '--sec', str(a.sec), '--palette', pal, '--seed', seed])
        else: run([sys.executable, os.path.join(ROOT, 'tools', 'pattern_visual.py'), '--mode', a.visual, '--audio', wav, '--out', base, '--sec', str(a.sec), '--seed', seed, '--params', a.params])
    fs = []; tn = [0]
    def dt(txt, f, sz, x, y, alpha, col='0xf3efe6'):
        p = os.path.join(od, f't{tn[0]}.txt'); tn[0] += 1; open(p, 'w', encoding='utf-8').write(txt)
        fs.append(f"drawtext=fontfile={f}:textfile={p}:fontsize={sz}:fontcolor={col}:x={x}:y={y}:alpha='{alpha}':shadowcolor=black@0.45:shadowx=0:shadowy=1")
    cut = lambda s, n: s if len(s) <= n else s[:n - 1] + '…'
    S = a.sec; E = S - .4
    main = re.sub(r'\s*\([^)]*\)\s*$', '', en) if len(en) > 30 else en
    lines = textwrap.wrap(main, 24)[:2]; y = 820
    TP = json.loads(a.params); ti = float(TP.get('title_in', 2.0)); to = float(TP.get('title_out', 11.5)); ci = float(TP.get('cta_in', S - 7.5)); ty = int(TP.get('title_y', 820))  # 文字の出入り（磨く対象）
    to = min(to, ci - .6)   # 短い版でも題名とおしまいの文字が重ならない
    y = ty; dt(a.kicker.format(sec=int(round(S))), R, 28, '(w-text_w)/2', y - 70, al(ti, to), '0xd9d2bf')
    for ln in lines: dt(ln, L, 58, '(w-text_w)/2', y, al(ti + .4, to)); y += 74
    dt(cut(jp, 26), L, 32, '(w-text_w)/2', y + 10, al(ti + .8, to), '0xd9d2bf')
    loc = r.get('location') or ''
    dt('Real sound. Nothing added.', L, 46, '(w-text_w)/2', 860, al(ci, E)); dt('saww audio ecosystem', R, 34, '(w-text_w)/2', 940, al(ci + .5, E), '0xd9d2bf'); dt(URL, R, 26, '(w-text_w)/2', 990, al(ci + .5, E), '0xbfb8a5')
    dt(cut(f'Recording: {r["author"]} · {r["license"]}', 52), R, 26, '(w-text_w)/2', 1700, al(1.0, E), '0xcfc8b5')
    vf = os.path.join(od, 'vf.txt'); open(vf, 'w').write(','.join(fs) + ',format=yuv420p')
    out = os.path.join(od, f'saww_calm_{date}_{i}.mp4')
    run(['ffmpeg', '-v', 'error', '-y', '-i', base, '-i', wav, '-filter_script:v', vf, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
         '-maxrate', '10M', '-bufsize', '20M', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out])
    cap = f"""[YouTube Shorts title]
{cut(main, 62)} — 30 seconds to breathe #Shorts

[Caption — Instagram and YouTube]
30 seconds of {en}. A real field recording — nothing added.
Put your phone down for a moment and just listen.

Make your own soundscape from real nature recordings (free until Dec 31, 2026 JST):
https://{URL}/

{jp}の30秒。実際の録音だけで、何も足していません。少しだけ手を止めて、聴いてみてください。

— Recording credit / 録音クレジット —
{r.get('title') or en} — {r['author']} / {r['license']} {r.get('licenseURL') or ''}
Source / 出典: {r.get('url') or ''}
Location / 録音地: {loc or '記載なし'}
Changes / 加工: excerpt ({ss:.1f}–{ss+S:.1f} s), loudness adjusted, fades, visual added / 抜粋・音量の調整・フェード・映像の追加
All credits / 全クレジット: https://sawwaudio.github.io/audio-ecosystem-sounds-1/credits.html

#naturesounds #relaxingsounds #calm #fieldrecording #soundscape #mindfulness #saww #自然音 #癒し
"""
    open(os.path.join(od, 'caption.txt'), 'w', encoding='utf-8').write(cap)
    for f in os.listdir(od):
        if re.match(r't\d+\.txt|vf\.txt', f): os.remove(os.path.join(od, f))
    hist.append({'date': date, 'id': i, 'series': 'calm', 'pattern': a.pattern, 'version': a.version, 'visual': a.visual, 'palette': pal, 'license': r['license'], 'author': r['author'], 'file': os.path.basename(out)})
    json.dump(hist, open(HP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); made.append(out); print('made', out, flush=True)
print(len(made), '本')
