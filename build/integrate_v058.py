#!/usr/bin/env python3
"""v0.58：初期設定で鳴らす音を「ディジュリドゥ・低音・鳥」にする（オーナー要望 2026-11-07 16:59「プリセットで鳴らすのはディジュリドゥと低音と鳥にする」）。
何度実行しても同じ結果になる。まず build/integrate_v057.py（その中で v0.55 → v0.53 → v0.49 → v0.48 → v0.47）を実行する。
- 楽器・合成音の層（groups の low・music・rhythm）：初期値はディジュリドゥ 45・パイプオルガンのペダル（実録音の低音）30 だけ。ほかは 0。
  どちらも無料版で鳴らせる楽器（data/product_tiers.json の instruments.free）なので、無料版でも初期設定のまま全部鳴る。
- 環境音（fieldDefaults）：初期値はすべて 0（川・森の葉を止める）。
- 生き物：初期の参加は鳥4種（CC0。商用モード「BY-SAを除く」「CC0のみ」でもそのまま鳴る）。以前のセミ2種は外す。
- 初期設定（最初に開いた時・「初期設定に戻す」）だけを変える。保存したプリセットや端末に保存した設定は変えない。
使い方：python3 build/integrate_v058.py
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v057.py')], check=True, stdout=subprocess.DEVNULL)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.58'
DEFAULT_LAYERS = {'didge': 45, 'organPedal': 30}
DEFAULT_BIRDS = ['uguisu-yokohama', 'song-thrush', 'eurasian-wren', 'nightingale-russia']


def die(m):
    sys.exit('integrate_v058: ' + m)


t = re.sub(r'<title>saww audio ecosystem v0\.\d+', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.\d+', 'nature as an instrument. · ' + VER, t)

# ── 1. 楽器・合成音の層の初期値 ──
for g in ('low', 'music', 'rhythm'):
    m = re.search(r'"%s": \[(\[.*?\])\]' % g, t)
    if not m:
        die('groups.' + g)
    body = re.sub(r'\["(\w+)", ("[^"]*"), \d+\]', lambda x: '["%s", %s, %d]' % (x.group(1), x.group(2), DEFAULT_LAYERS.get(x.group(1), 0)), m.group(1))
    t = t[:m.start(1)] + body + t[m.end(1):]

# ── 2. 環境音の初期値 ──
m = re.search(r"const fieldDefaults=\{(.*?)\};", t, re.S)
if not m:
    die('fieldDefaults')
t = t[:m.start(1)] + re.sub(r"('[\w-]+'):\d+", r"\1:0", m.group(1)) + t[m.end(1):]

# ── 3. 生き物の初期の参加：鳥4種 ──
old = "speciesSettings[r.id].enabled=['cicada','tsukutsukuboshi'].includes(r.id);"
new = "speciesSettings[r.id].enabled=" + repr(DEFAULT_BIRDS).replace(' ', '') + ".includes(r.id);"
if new not in t:
    if t.count(old) != 1:
        die('初期の参加')
    t = t.replace(old, new)

open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
