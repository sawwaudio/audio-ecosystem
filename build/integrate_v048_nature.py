#!/usr/bin/env python3
"""v0.48：自然の美しさを保った上質な見た目（オーナー要望 2026-11-06 19:22「ポップだけどカラフルすぎ。自然な雰囲気と高級感、生き物の姿が見えるように」）。
- まず build/integrate_v047_pop.py を実行し（スクリプト・CSS・辞書の埋め込みを含む）、その上に v0.48 の変更を重ねる。何度実行しても同じ結果になる。
- 画面の配色：夕方の森の深い緑灰の地、紙の色の文字、差し色は琥珀色1つ。生き物の種類の色は彩度を落とした自然の色。
- 書体：見出しは Shippori Mincho B1（明朝）、本文は Zen Kaku Gothic New、学名は Cormorant Garamond のイタリック。
- リール：テンプレート「自然」（暗い地・写真から色を取る）と「自然・紙」（明るい紙の図版）を先頭・既定に。ポップの5配色は残す。
使い方：python3 build/integrate_v048_nature.py
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v047_pop.py')], check=True, stdout=subprocess.DEVNULL)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.48'


def die(m):
    sys.exit('integrate_v048_nature: ' + m)


def once(old, new):
    global t
    if new in t:
        return
    if t.count(old) != 1:
        die('置き換え対象が %d 件: %r' % (t.count(old), old[:90]))
    t = t.replace(old, new)


# ── 1. 配色（v0.47 の青紫とポップな色 → 夕方の森と琥珀色）──
COLORS = {
    '#15122b': '#141a16', '#1f1a3d': '#1b2420', '#3b3468': '#2f3c35', '#fff7e8': '#f1ece0', '#b8aedd': '#a9b3a6', '#ffd447': '#e6c27a',
    '#332c5e': '#2a352f', '#191536': '#18201c', '#2a2452': '#24302a', '#4c4390': '#4a5a50', '#ffe58a': '#efd9a0', '#cfc6f2': '#c5ccbf',
    '#120f26': '#101512', '#5a50a0': '#566a5e', '#2fd9a6': '#8ec3a0', '#1b1736': '#18201c', '#241f48': '#1f2a24', '#2e2858': '#2a352f',
    '#e9e3ff': '#e4e2d6', '#a59bd0': '#98a395', '#d8d0f7': '#d3d6c8', '#ff4f9a': '#d79a8c', '#5b8cff': '#8fb3d6', '#ff8a3d': '#cf8e6a',
    '#a98bff': '#b5a6d6',
}
RGBA = {'rgba(255,212,71,': 'rgba(230,194,122,', 'rgba(47,217,166,': 'rgba(142,195,160,', 'rgba(21,18,43,': 'rgba(20,26,22,',
        'rgba(255,247,232,': 'rgba(241,236,224,', 'rgba(255,79,154,': 'rgba(215,154,140,'}
assert not set(COLORS.values()) & set(COLORS), '色の対応が連鎖する'


def recolor(css):
    css = re.sub(r'#[0-9a-fA-F]{6}\b', lambda m: COLORS.get(m.group(0).lower(), m.group(0)), css)
    for a, b in RGBA.items():
        css = css.replace(a, b)
    return css


for m in reversed(list(re.finditer(r'<style( id="ae-studio-css")?>(.*?)</style>', t, re.S))):
    t = t[:m.start(2)] + recolor(m.group(2)) + t[m.end(2):]
t = t.replace('<meta name="theme-color" content="#15122b">', '<meta name="theme-color" content="#141a16">')
# MIDI 欄の CSS は build/src_midi.js 側で同じ色にしてある（埋め込みとソースを同一に保つため、ここでは触らない）

# ── 2. 書体 ──
NEW_FONTS = ('https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700'
             '&family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Dela+Gothic+One&family=M+PLUS+Rounded+1c:wght@500;700;800;900&display=swap')
t = re.sub(r'https://fonts\.googleapis\.com/css2\?[^"]+', NEW_FONTS, t, count=1)

# ── 3. 版の表記 ──
t = re.sub(r'<title>saww audio ecosystem v0\.4\d', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.4\d', 'nature as an instrument. · ' + VER, t)

# ── 4. リール：自然（既定）と自然・紙を先頭に ──
once('<select id="reelStyle" aria-label="リールのテンプレート"><option value="pop-sunny" selected>',
     '<select id="reelStyle" aria-label="リールのテンプレート"><option value="nature" selected>自然（写真の色）</option><option value="nature-paper">自然・紙（図版）</option><option value="pop-sunny">')
once("const REEL_STYLES=['motion','analysis','panels','wave','minimal','pop'];", "const REEL_STYLES=['motion','analysis','panels','wave','minimal','pop','nature'];")

# ── 4b. 生き物と環境音を分ける（data/sound_categories.json を埋め込み、環境音の欄を足す）──
import json
cats = json.dumps(json.load(open(P('data/sound_categories.json'), encoding='utf-8')), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
m = re.search(r'<script type="application/json" id="ae-categories">.*?</script>', t, re.S)
blk = '<script type="application/json" id="ae-categories">' + cats + '</script>'
if m:
    t = t[:m.start()] + blk + t[m.end():]
else:
    i = t.index('<script type="application/json" id="ae-photos">')
    t = t[:i] + blk + '\n' + t[i:]
once('<div class="tileGrid" id="tileGrid"></div>',
     '<div class="tileGrid" id="tileGrid"></div><div id="ambSection" class="ambSection"><div class="ambHead"><h3 class="ambTitle">環境音</h3><span class="micro">雨・川・波・風・森</span></div><div id="ambGrid" class="ambGrid" role="group" aria-label="環境音"></div></div>')

# ── 5. v0.48 の CSS を足す（src_studio.css の末尾は v0.47 の上書き。ここでさらに書体などを上書きする）──
EXTRA = open(P('build/src_nature.css'), encoding='utf-8').read().strip()
m = re.search(r'<style id="ae-nature-css">.*?</style>', t, re.S)
blk = '<style id="ae-nature-css">' + EXTRA + '</style>'
if m:
    t = t[:m.start()] + blk + t[m.end():]
else:
    i = t.index('</head>')
    t = t[:i] + blk + t[i:]
open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
