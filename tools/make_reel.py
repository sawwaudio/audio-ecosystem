#!/usr/bin/env python3
"""パターンを指定してリールを作る入口（tools/reels/patterns.json の現在の版で作り、品質チェックまで行う）。
使い方：
  python3 tools/make_reel.py --app ../audio-ecosystem-sounds-1/index.html --out <出力> --pattern komorebi --start 2026-11-20 [--days 1]
  python3 tools/make_reel.py --app ... --out ... --plan tools/reels/next_plan.json   # brush.py が作った配分（日付→パターン）で作る
  python3 tools/make_reel.py --list                                                  # パターンの一覧
作った動画は tools/reels/qa.py で確かめ、結果を <動画のフォルダ>/qa.json に書く。履歴（daily_history / calm_history）には pattern と version が入る。
"""
import argparse, json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PJ = os.path.join(ROOT, 'tools', 'reels', 'patterns.json')
ap = argparse.ArgumentParser(); ap.add_argument('--app'); ap.add_argument('--out'); ap.add_argument('--pattern'); ap.add_argument('--start'); ap.add_argument('--days', type=int, default=1)
ap.add_argument('--plan'); ap.add_argument('--list', action='store_true'); ap.add_argument('--theme', nargs='*'); ap.add_argument('--dry', action='store_true'); ap.add_argument('--sec', type=float, help='長さを上書き（試し用）')
a = ap.parse_args()
pats = {p['id']: p for p in json.load(open(PJ, encoding='utf-8'))['patterns']}
if a.list:
    for p in pats.values(): print(f"{p['id']:12s} v{p['version']}  {p['status']:7s} {p['series']:22s} {p['name_ja']}")
    sys.exit()
if not (a.app and a.out): sys.exit('--app と --out が必要')

def cmd_for(p, start, days):
    py = sys.executable; T = lambda n: os.path.join(ROOT, 'tools', n); ar = p['args']; pr = dict(p['params']); sec = str(a.sec or pr.pop('sec', p['sec'])); pr.pop('sec', None)
    if p['maker'] == 'daily':
        return [py, T('make_daily.py'), '--app', a.app, '--out', a.out, '--start', start, '--days', str(days), '--sec', sec, '--look', ar['look'], '--mix', ar['mix'], '--pattern', p['id'], '--version', str(p['version'])]
    if p['maker'] == 'calm':
        c = [py, T('make_calm.py'), '--app', a.app, '--out', a.out, '--start', start, '--days', str(days), '--sec', sec, '--visual', ar['visual'], '--params', json.dumps(pr),
             '--pattern', p['id'], '--version', str(p['version']), '--kicker', ar.get('kicker', ''), '--prefer', ar.get('prefer', '')]
        return c + (['--dry'] if a.dry else [])
    if p['maker'] == 'theme':
        return [py, T('make_theme.py'), '--app', a.app, '--out', a.out, '--sec', sec] + (['--theme'] + a.theme if a.theme else [])
    raise SystemExit('未知の maker: ' + p['maker'])

jobs = []
if a.plan:
    for d in json.load(open(a.plan, encoding='utf-8'))['slots']: jobs.append((pats[d['pattern']], d['date'], 1))
elif a.pattern:
    if a.pattern not in pats: sys.exit('パターンがありません: ' + a.pattern)
    if not a.start and pats[a.pattern]['maker'] != 'theme': sys.exit('--start が必要')
    jobs.append((pats[a.pattern], a.start or '', a.days))
else: sys.exit('--pattern か --plan を指定')
before = set()
for r, _, fs in os.walk(a.out): before |= {os.path.join(r, f) for f in fs if f.endswith('.mp4')}
for p, start, days in jobs:
    if p['status'] == 'paused': print('止めているパターン（status=paused）:', p['id']); continue
    c = cmd_for(p, start, days); print('>', p['id'], f"v{p['version']}", start); subprocess.run(c, check=True)
if a.dry: sys.exit()
for r, _, fs in os.walk(a.out):
    for f in fs:
        q = os.path.join(r, f)
        if f.endswith('.mp4') and q not in before and f not in ('base.mp4', 'mask.mp4', 'rim.mp4'):
            subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'reels', 'qa.py'), q])
