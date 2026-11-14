#!/usr/bin/env python3
"""リールを磨き続ける：数値（tools/perf/youtube.json）から、パターンごと・版ごとに受けを比べ、
①試している版の判定（残す／戻す）②次に動かすつまみ（1回に1つ）③来週の配分（tools/reels/next_plan.json）を決める。
2026-11-14 オーナー指示「1種類に統合せず、参考動画ごとのパターン。動画全体をブラッシュし続ける構造」。

決まり（推測で結論を出さないための下限）：
- 比べる値は公開24時間の「視聴を継続」（stayed_24h）。無い動画は最新の値（stayed_pct）で、表に「暫定」と出す。
- 版の判定は、新旧どちらも3本以上たまってから。差が ±3 ポイント未満は「差なし」（新しい版のまま、次のつまみへ）。
- つまみは patterns.json の knobs の順に1つずつ。範囲（min・max）を超えるつまみは飛ばす。
- 配分：本数が3本未満のパターンを先に（週1本以上）。残りは継続の平均が高いほど多く。止めた（paused）パターンは配らない。
- 停止の提案：6本以上で、一番良いパターンより10ポイント以上低い時。--apply の時だけ status を paused にする。
使い方：python3 tools/perf/brush.py [--apply] [--start 2026-11-20] [--days 7]
  --apply なし：判定と提案を表示するだけ（patterns.json は変えない）。結果は tools/perf/BRUSH.md にも書く。
"""
import argparse, datetime, json, math, os, collections
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
J = lambda *p: os.path.join(ROOT, *p)
ap = argparse.ArgumentParser(); ap.add_argument('--apply', action='store_true'); ap.add_argument('--start'); ap.add_argument('--days', type=int, default=7)
ap.add_argument('--slots', default='21:00,23:00', help='1日の公開枠（JST）'); a = ap.parse_args()
load = lambda p, d: json.load(open(p, encoding='utf-8')) if os.path.exists(p) else d
PJ = J('tools', 'reels', 'patterns.json'); reg = load(PJ, {'patterns': []}); pats = {p['id']: p for p in reg['patterns']}
rows = load(J('tools', 'perf', 'youtube.json'), [])
hist = load(J('tools', 'daily_history.json'), []) + load(J('tools', 'calm_history.json'), [])
MIN_N, DIFF, RETIRE = 3, 3.0, 10.0
today = datetime.date.today()

# 1. 動画にパターンと版を付ける（無ければ履歴の録音IDと公開日から。旧い動画は look から）
for r in rows:
    if r.get('pattern'): continue
    h = [x for x in hist if x['id'] == r.get('recording') and x['date'] <= (r.get('published') or '')[:10]]
    if h and h[-1].get('pattern'): r['pattern'], r['pattern_version'] = h[-1]['pattern'], h[-1].get('version', 1)
    elif str(r.get('look', '')).startswith('full'): r['pattern'], r['pattern_version'] = 'full', 1
    elif str(r.get('look', '')).startswith('specimen'): r['pattern'], r['pattern_version'] = 'specimen', 1
    elif r.get('series') == 'CALM': r['pattern'], r['pattern_version'] = 'calm-bokeh', 1
tagged = [r for r in rows if r.get('pattern')]
if tagged:   # 付けたパターンは youtube.json にも残す（1行1動画の形を保つ）
    YP = J('tools', 'perf', 'youtube.json'); open(YP, 'w', encoding='utf-8').write('[\n' + ',\n'.join(' ' + json.dumps(r, ensure_ascii=False) for r in rows) + '\n]\n')
def val(r):
    if r.get('stayed_24h') is not None: return r['stayed_24h'], False
    return (r.get('stayed_pct'), True) if r.get('stayed_pct') is not None else (None, None)
def secv(r):
    v = r.get('views_24h') or r.get('views'); return r['watch_hours'] * 3600 / v if v and r.get('watch_hours') is not None else None
by = collections.defaultdict(list); byv = collections.defaultdict(list)
for r in rows:
    s, prov = val(r)
    if s is None or not r.get('pattern'): continue
    by[r['pattern']].append((s, prov, r)); byv[(r['pattern'], r.get('pattern_version', 1))].append((s, prov, r))
mean = lambda xs: sum(x[0] for x in xs) / len(xs) if xs else None
log = []; changed = False

# 2. 試している版の判定
for p in pats.values():
    open_ = [h for h in p['history'] if h.get('verdict') is None]
    if not open_: continue
    h = open_[-1]; new, old = byv[(p['id'], p['version'])], byv[(p['id'], h['version'])]
    if len(new) < MIN_N or len(old) < MIN_N:
        log.append(f"- {p['id']} v{p['version']}（{h['changed']}: {h['from']}→{h['to']}）：判定保留（新 {len(new)}本・旧 {len(old)}本。各{MIN_N}本で判定）"); continue
    d = mean(new) - mean(old)
    if d <= -DIFF:
        log.append(f"- {p['id']} v{p['version']}：継続が {d:+.1f} ポイント → 戻す（v{h['version']} の {h['changed']}={h['from']}）")
        if a.apply: h['verdict'] = 'reverted'; h['delta'] = round(d, 1); p['params'] = dict(h['params']); p['version'] += 1; p['history'].append({'version': p['version'] - 1, 'params': dict(h['params']), 'changed': 'revert', 'from': h['to'], 'to': h['from'], 'verdict': 'base', 'date': today.isoformat()}); changed = True
    else:
        verdict = 'kept' if d >= DIFF else 'no_diff'
        log.append(f"- {p['id']} v{p['version']}：継続が {d:+.1f} ポイント → {'残す' if verdict == 'kept' else '差なし（このまま、次のつまみへ）'}")
        if a.apply: h['verdict'] = verdict; h['delta'] = round(d, 1); changed = True

# 3. 次のつまみ（試している版が無く、今の版が3本以上たまったパターン）
for p in pats.values():
    if p['status'] == 'paused' or not p['knobs'] or any(h.get('verdict') is None for h in p['history']): continue
    cur = byv[(p['id'], p['version'])]
    if len(cur) < MIN_N: continue
    tried = sum(1 for h in p['history'] if h['changed'] not in ('revert',))
    for k in range(len(p['knobs'])):
        kn = p['knobs'][(tried + k) % len(p['knobs'])]; key = kn['key']
        now = p['params'].get(key, p['sec'] if key == 'sec' else None)
        if now is None: continue
        to = round(now + kn['step'], 3)
        if not (kn['min'] <= to <= kn['max']):
            to = round(now - kn['step'], 3)
            if not (kn['min'] <= to <= kn['max']): continue
        log.append(f"- {p['id']}：次は {key} を {now} → {to}（{kn['why']}）で v{p['version'] + 1} を試す")
        if a.apply:
            p['history'].append({'version': p['version'], 'params': dict(p['params'], **({'sec': p['sec']} if key == 'sec' else {})), 'changed': key, 'from': now, 'to': to, 'why': kn['why'], 'verdict': None, 'date': today.isoformat()})
            if key == 'sec': p['sec'] = to
            else: p['params'][key] = to
            p['version'] += 1; changed = True
        break

# 4. 停止の提案
scores = {k: mean(v) for k, v in by.items() if len(v) >= MIN_N}
best = max(scores.values()) if scores else None
for k, v in by.items():
    if k in pats and len(v) >= 6 and best is not None and scores[k] <= best - RETIRE and pats[k]['status'] != 'paused':
        log.append(f"- {k}：継続 {scores[k]:.1f}%（最良より {best - scores[k]:.1f} ポイント低い・{len(v)}本）→ 止める提案")
        if a.apply: pats[k]['status'] = 'paused'; changed = True

# 5. 来週の配分（next_plan.json）
live = [p for p in pats.values() if p['status'] != 'paused' and p['maker'] != 'theme']
slots = a.slots.split(','); start = datetime.date.fromisoformat(a.start) if a.start else today + datetime.timedelta(days=1)
n_slots = a.days * len(slots); need = sorted([p for p in live if len(by[p['id']]) < MIN_N], key=lambda p: len(by[p['id']]))
plan = [p['id'] for p in need][:n_slots]
w = {p['id']: math.exp((scores.get(p['id'], best or 50) - (best or 50)) / 5) for p in live}
while len(plan) < n_slots:   # 重みに比例（残りの枠で一番足りないものを足す）
    tot = sum(w.values()); cnt = collections.Counter(plan)
    plan.append(max(w, key=lambda k: w[k] / tot * (len(plan) + 1) - cnt[k]))
calm = [x for x in plan if pats[x]['series'] == 'CALM']; other = [x for x in plan if pats[x]['series'] != 'CALM']
out = []
for d in range(a.days):   # CALM は遅い枠（寝る前）、ほかは早い枠。足りない側は残りで埋める
    for si, s in enumerate(slots):
        q = calm if (si == len(slots) - 1 and calm) or not other else other
        out.append({'date': (start + datetime.timedelta(days=d)).isoformat(), 'time': s, 'pattern': q.pop(0)})
NP = J('tools', 'reels', 'next_plan.json')
json.dump({'made': today.isoformat(), 'note': 'brush.py の配分。make_reel.py --plan で作る。公開の予約は手で（または巡回で）。', 'slots': out}, open(NP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
if a.apply and changed: json.dump(reg, open(PJ, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(PJ, 'a').write('\n')

# 6. 表示と BRUSH.md
L = [f'# リールを磨く記録（{today.isoformat()}・tools/perf/brush.py{" --apply" if a.apply else ""}）', '',
     '比べる値：公開24時間の「視聴を継続」。（暫定）は24時間の値がまだ無く、最新の値で代用。3本未満は判断しない。', '',
     '| パターン | 版 | 状態 | 本数 | 継続 | 1再生の視聴秒 |', '|---|---|---|---|---|---|']
for p in pats.values():
    xs = by[p['id']]; m = mean(xs); ss = [secv(x[2]) for x in xs if secv(x[2])]
    L.append(f"| {p['id']}（{p['name_ja']}） | v{p['version']} | {p['status']} | {len(xs)} | {'—' if m is None else f'{m:.1f}%'}{'（暫定）' if any(x[1] for x in xs) else ''}{'' if len(xs) >= MIN_N else ' 判断保留'} | {f'{sum(ss)/len(ss):.1f}秒' if ss else '—'} |")
L += ['', '## 判定と次の一手', ''] + (log or ['- まだ判定できる本数がない（各パターン3本から）']) + ['', '## 来週の配分（tools/reels/next_plan.json）', '']
L += [f"- {s['date']} {s['time']}：{s['pattern']}（{pats[s['pattern']]['name_ja']}）" for s in out]
L += ['', '## 毎回のチェック（tools/reels/qa.py）', '', '- 形式（1080×1920・H.264/AAC）、音量（−20〜−13 LUFS・ピーク −1dBTP 以下）、最初の1秒が暗すぎない、点滅が1秒3回以下。', '- 目視：文字が YouTube のボタン・説明欄に重ならない、最初の1秒で何の音か分かる。']
open(J('tools', 'perf', 'BRUSH.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n'); print('\n'.join(L))
