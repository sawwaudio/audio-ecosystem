#!/usr/bin/env python3
"""動画の受け（YouTube Studio の数値）を属性ごとにまとめる。数値は tools/perf/youtube.json に手で（または自動の巡回で）追記する。
指標：視聴を継続した割合（stayed_pct：ショートを最初の数秒で飛ばされなかった割合）を主に、1再生あたりの視聴秒数（watch_hours×3600/views）と高評価率を併記。
使い方：python3 tools/perf/report.py   →  属性ごとの平均と本数。本数が3本未満の属性は「判断保留」。
"""
import json, os, collections
P = os.path.join(os.path.dirname(__file__), 'youtube.json'); rows = json.load(open(P, encoding='utf-8'))
def sec(r): return r['watch_hours'] * 3600 / r['views'] if r.get('views') else None
print(f'動画 {len(rows)} 本')
for key in ['series', 'look', 'mix', 'style', 'category', 'palette']:
    g = collections.defaultdict(list)
    for r in rows:
        if r.get(key) is not None and r.get('stayed_pct') is not None: g[r[key]].append(r)
    if not g: continue
    print(f'\n[{key}]')
    for v, rs in sorted(g.items(), key=lambda kv: -sum(x['stayed_pct'] for x in kv[1]) / len(kv[1])):
        st = sum(x['stayed_pct'] for x in rs) / len(rs); s = [sec(x) for x in rs if sec(x)]
        lk = sum(x.get('likes', 0) for x in rs) / max(1, sum(x.get('views', 0) for x in rs)) * 100
        print(f'  {v[:40]:40s} 継続 {st:5.1f}%  視聴 {sum(s)/len(s) if s else 0:4.1f}秒  高評価 {lk:4.1f}%  {len(rs)}本' + ('' if len(rs) >= 3 else '（判断保留）'))
