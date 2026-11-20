#!/usr/bin/env python3
"""「脳汁」系ショート（RUSH）を作る：実録音の一打×ビート、文字なしの刺激的な映像、15.5秒（8小節・124BPM）でループする。
2026-11-20 オーナー指示「ショートやリールはもっと脳汁出るコンテンツじゃないと勝てない。見る人は文章を読んでいない。視覚・聴覚の刺激物を欲している」。
- 音：tools/rush_audio.py（自然音×ビート）。映像：tools/rush_visual.py の burst（音に同期して爆発）／satisfy（気持ちいい液体の玉）を A/B。
- 画面の文字はゼロ。録音者・ライセンス・加工内容は説明欄（caption.txt）に必ず書く（CC BY の表示）。
- 録音は「はっきりした一打が多い」ものを選ぶ（雨・風のような一様な音は外す）。CC0・PD・CC BY だけ。使った録音は tools/rush_history.json。
使い方：python3 tools/make_rush.py --app index.html --out <出力> --start 2026-11-21 [--days 2] [--look auto|burst|satisfy]
"""
import argparse, datetime, hashlib, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import rush_audio as ra
URL = 'sawwaudio.github.io/audio-ecosystem'
ap = argparse.ArgumentParser(); ap.add_argument('--app', required=True); ap.add_argument('--out', required=True); ap.add_argument('--start', required=True)
ap.add_argument('--days', type=int, default=2); ap.add_argument('--look', default='auto', choices=['auto', 'burst', 'satisfy']); ap.add_argument('--version', type=int, default=1)
ap.add_argument('--id', help='録音を指定（試し用）')
a = ap.parse_args()
h = open(a.app, encoding='utf-8').read(); appdir = os.path.dirname(os.path.abspath(a.app))
blk = lambda i: json.loads(re.search(r'id="%s">(.*?)</script>' % i, h, re.S).group(1))
recs = {r['id']: r for r in blk('ae-recordings')}; cat = blk('ae-categories')['categories']; man = blk('ae-audio-manifest')['recordings']; meta = blk('ae-wildlife-meta')
HP = os.path.join(ROOT, 'tools', 'rush_history.json'); hist = json.load(open(HP, encoding='utf-8')) if os.path.exists(HP) else []
used = {x['id'] for x in hist}
def allowed(r):
    L = r['license']; return (L.startswith('CC0') or L == 'Public domain' or L.startswith('CC BY ')) and 'SA' not in L and 'NC' not in L
def src(i):
    try: return os.path.normpath(os.path.join(appdir, man[i]['pcm']['parts'][0]['path']))
    except Exception: return None
cands = [a.id] if a.id else [i for i, r in recs.items() if allowed(r) and i not in used and src(i) and os.path.exists(src(i)) and (meta.get(i) or {}).get('en')]
scored = []
for i in cands:
    try: s, _ = ra.score(src(i))
    except Exception: continue
    if s >= 1.2 or a.id: scored.append((s, i))
scored.sort(reverse=True); print('刻める録音', len(scored), '本', flush=True)
PP = os.path.join(ROOT, 'tools', 'perf', 'prefs.json'); W = (json.load(open(PP, encoding='utf-8')) if os.path.exists(PP) else {}).get('rush_look') or {}
def look_for(k):
    if a.look != 'auto': return a.look
    ws = [float(W.get('burst', 1)), float(W.get('satisfy', 1))]; prev = hist[-1]['look'] if hist else 'satisfy'
    ws[0 if prev == 'burst' else 1] *= .35   # 交互寄り
    return 'burst' if int(hashlib.sha1(f'rush{k}'.encode()).hexdigest(), 16) % 10000 / 10000 * sum(ws) < ws[0] else 'satisfy'
T = lambda n: os.path.join(ROOT, 'tools', n); day0 = datetime.date.fromisoformat(a.start)
for d in range(a.days):
    if not scored: print('使える録音がもうありません'); break
    k = len(hist); _, i = scored.pop(0); r = recs[i]; look = look_for(k); date = (day0 + datetime.timedelta(days=d)).isoformat(); en = meta[i]['en'] if i in meta else r.get('title', i)
    od = os.path.join(a.out, f'rush_{date}_{i}'); os.makedirs(od, exist_ok=True); seed = int(hashlib.sha1(i.encode()).hexdigest(), 16) % 9973
    wav, evp, out = os.path.join(od, 'audio.wav'), os.path.join(od, 'events.json'), os.path.join(od, f'saww_rush_{date}_{i}.mp4')
    subprocess.run([sys.executable, T('rush_audio.py'), '--src', src(i), '--out', wav, '--events', evp, '--seed', str(seed)], check=True)
    subprocess.run([sys.executable, T('rush_visual.py'), '--look', look, '--audio', wav, '--events', evp, '--out', out, '--seed', str(seed)], check=True)
    subprocess.run([sys.executable, T('reels/qa.py'), out], check=True)
    jp = re.sub(r'\s*（[^）]*）\s*$', '', r['jp']); short = re.sub(r'\s*\([^)]*\)\s*$', '', en)
    cap = f"""[YouTube Shorts title]
{short[:48]} × beat 🔊 #Shorts

[Caption — Instagram and YouTube]
🔊 {en} — a real field recording, chopped into a beat. Sound on.
{jp}の実録音を刻んで、ビートにしました。音を出して。

Make your own from real nature sounds (free until Dec 31, 2026 JST): https://{URL}/

— Recording credit / 録音クレジット —
{r.get('title') or en} — {r['author']} / {r['license']} {r.get('licenseURL') or ''}
Source / 出典: {r.get('url') or ''}
Location / 録音地: {r.get('location') or '記載なし'}
Changes / 加工: excerpts chopped, pitch-shifted, reversed and rearranged over a synthesized kick, bass and hi-hat (made by saww); loudness adjusted; visual added / 抜粋の切り貼り・音程の変更・逆再生・並べ替え、合成したキック・低音・ハイハット（saww 制作）との合成、音量の調整、映像の追加
All credits / 全クレジット: https://{URL}/credits.html

#saww #naturesounds #fieldrecording #beat #satisfying #asmr #audiovisual #自然音
"""
    open(os.path.join(od, 'caption.txt'), 'w', encoding='utf-8').write(cap)
    hist.append({'date': date, 'id': i, 'series': 'rush', 'pattern': f'rush-{look}', 'look': look, 'mix': 'field×beat', 'version': a.version, 'cat': (cat.get(i) or {}).get('cat'),
                 'sec': 15.5, 'bpm': 124, 'license': r['license'], 'author': r['author'], 'file': os.path.basename(out)})
    json.dump(hist, open(HP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('made', out, flush=True)
