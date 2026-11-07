#!/usr/bin/env python3
"""v0.61：「リールを作る」を3番目に（オーナー要望 2026-11-07 22:18「リールを作るは3番目に持ってくる」）。
並び：01 音を選ぶ → 02 演奏する（楽器・合成音の層）→ 03 リールを作る → 04 スタジオ → プラン → 設定と権利。
何度実行しても同じ結果になる。まず build/integrate_v059.py（その中で v0.58 → v0.57 → …）を実行してから、index.html の中で、リールの欄（#reelSection）と演奏の欄（#playGroup）を入れ替え、番号とページ内の移動を直す。
v0.60（自動実行の MIDI 出力）は index.html と build/src_midi.js に直接入っていて、組み込みの順で消えない。build/src_studio.js の版表記も v0.61。
使い方：python3 build/integrate_v061.py
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v059.py')], check=True, stdout=subprocess.DEVNULL)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.61'


def die(m):
    sys.exit('integrate_v061: ' + m)


t = re.sub(r'<title>saww audio ecosystem v0\.\d+', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.\d+', 'nature as an instrument. · ' + VER, t)

# ── 1. 欄の入れ替え（リールが演奏の前にある時だけ） ──
a, b, c = t.find('<section id="reelSection"'), t.find('<div id="playGroup"'), t.find('<div id="studioGroup"')
if min(a, b, c) < 0:
    die('欄が見つかりません')
if a < b < c:
    reel, play = t[a:b], t[b:c]
    if not reel.rstrip().endswith('</section>') or not play.rstrip().endswith('</div>'):
        die('欄の境目')
    t = t[:a] + play + reel + t[c:]
elif not (b < a < c):
    die('並びが想定と違います')

# ── 2. 番号：演奏 02・リール 03 ──
def renum(sec_open, no):
    global t
    i = t.find(sec_open)
    m = re.compile(r'(<span class="stepNo" aria-hidden="true">)\d\d(</span>)').search(t, i)
    if not m or m.start() - i > 400:
        die('番号：' + sec_open)
    t = t[:m.start()] + m.group(1) + no + m.group(2) + t[m.end():]


renum('<section id="reelSection"', '03')
renum('<section id="performance"', '02')

# ── 3. ページ内の移動 ──
old = '<a href="#reelSection"><b>02</b>リール</a><a href="#playGroup"><b>03</b>演奏</a>'
new = '<a href="#playGroup"><b>02</b>演奏</a><a href="#reelSection"><b>03</b>リール</a>'
if new not in t:
    if t.count(old) != 1:
        die('ページ内の移動')
    t = t.replace(old, new)

open(P('index.html'), 'w', encoding='utf-8').write(t)

# 版表記（src_studio.js）
s = open(P('build/src_studio.js'), encoding='utf-8').read()
s2 = re.sub(r"^const VER='v0\.\d+';", "const VER='%s';" % VER, s, count=1, flags=re.M)
if s2 != s:
    open(P('build/src_studio.js'), 'w', encoding='utf-8').write(s2)
t = open(P('index.html'), encoding='utf-8').read()
t2 = re.sub(r"\nconst VER='v0\.\d+';", "\nconst VER='%s';" % VER, t, count=1)
if t2 != t:
    open(P('index.html'), 'w', encoding='utf-8').write(t2)
print('ok', len(t2))
