#!/usr/bin/env python3
"""v0.47：見た目をポップにする（画面全体の配色と書体、リールの「ポップ」テンプレート5種）。何度実行しても同じ結果になる。
- 画面の配色：深い青紫の地に、ひまわりの黄・ピンク・ミント・空色。CSS の色を対応表で置き換える（ライセンス区分の色はそのまま）。
- 書体：見出しは Dela Gothic One、本文とボタンは M PLUS Rounded 1c（Google Fonts。読めない時は端末の書体）。
- リール：テンプレート「ポップ」5配色（build/src_studio.js の drawPop）を先頭に追加し、既定にする。
- ヘッダーに、鳴っている間だけ回る「音の花」のマーク。
使い方：python3 build/integrate_v047_pop.py（v0.46 の index.html に対して。build/src_studio.js・src_studio.css・src_i18n.js も埋め込み直す）
"""
import os, re, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.47'


def die(m):
    sys.exit('integrate_v047_pop: ' + m)


def once(old, new):
    global t
    if new in t:
        return
    if t.count(old) == 0:
        return  # 後の版（v0.48 など）で同じ箇所を書き換え済み
    if t.count(old) != 1:
        die('置き換え対象が %d 件: %r' % (t.count(old), old[:90]))
    t = t.replace(old, new)


# ── 1. 配色の対応表（青緑 → 青紫とポップな色）。ライセンス区分の色（A〜C・U）は意味があるので変えない ──
COLORS = {
    '#0c1718': '#15122b', '#142326': '#1f1a3d', '#31484a': '#3b3468', '#e4eee8': '#fff7e8', '#99b4aa': '#b8aedd', '#b5d6be': '#ffd447',
    '#263b3e': '#332c5e', '#d6efc8': '#ffd447', '#152b23': '#1f1a3d', '#10262a': '#191536', '#1c3433': '#2a2452', '#56746a': '#4c4390',
    '#d4e8c7': '#ffe58a', '#b0cbbb': '#cfc6f2', '#0b1a1b': '#120f26', '#0b1b1e': '#120f26', '#547569': '#5a50a0', '#a3cfb4': '#2fd9a6',
    '#b8d6c4': '#ffd447', '#10221b': '#1f1a3d', '#112224': '#1b1736', '#132a2b': '#241f48', '#0e1d1f': '#1b1736', '#0e1f21': '#1b1736',
    '#2b4544': '#2e2858', '#29413e': '#2e2858', '#55736a': '#4c4390', '#9fd3ae': '#2fd9a6', '#a6e6b8': '#2fd9a6',
    '#b8dcc8': '#e9e3ff', '#e5f3e8': '#fff7e8', '#a9c6b8': '#cfc6f2', '#abc3b7': '#cfc6f2', '#d8e8dd': '#e9e3ff', '#a6c3b5': '#cfc6f2',
    '#809b90': '#a59bd0', '#a9c7b9': '#cfc6f2', '#afc7b8': '#cfc6f2', '#d0ddd6': '#e9e3ff', '#c4d8cf': '#e9e3ff', '#c6d9cf': '#e9e3ff',
    '#b9cec4': '#d8d0f7',
}
RGBA = {'rgba(214,239,200,': 'rgba(255,212,71,', 'rgba(166,230,184,': 'rgba(47,217,166,', 'rgba(12,23,24,': 'rgba(21,18,43,', 'rgba(230,242,234,': 'rgba(255,247,232,'}


def recolor(css):
    css = re.sub(r'#[0-9a-fA-F]{6}\b', lambda m: COLORS.get(m.group(0).lower(), m.group(0)), css)
    for a, b in RGBA.items():
        css = css.replace(a, b)
    return css


# 本体の CSS（最初の <style>）
m = re.search(r'<style>(.*?)</style>', t, re.S)
t = t[:m.start(1)] + recolor(m.group(1)) + t[m.end(1):]
t = t.replace('<meta name="theme-color" content="#0c1718">', '<meta name="theme-color" content="#15122b">')  # v0.48 で別の色に変えた後は何もしない

# ── 2. 書体（Google Fonts。読めない時は端末の書体で表示する）──
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=M+PLUS+Rounded+1c:wght@500;700;800;900&display=swap">')
if 'fonts.googleapis.com/css2' not in t:  # v0.48 で書体を差し替えた後も重ねない
    i = t.index('<style>')
    t = t[:i] + FONTS + t[i:]

# ── 3. 版の表記・ヘッダーの「音の花」 ──
t = re.sub(r'<title>saww audio ecosystem v0\.4\d', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.4\d', 'nature as an instrument. · ' + VER, t)
PETALS = ''.join('<ellipse cx="20" cy="8.5" rx="4.6" ry="8" fill="%s" transform="rotate(%d 20 20)"/>' % (c, a)
                 for a, c in zip(range(0, 360, 45), ['#ffd447', '#ff4f9a', '#2fd9a6', '#5b8cff'] * 2))
MARK = ('<svg class="brandMark" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><g class="petals">' + PETALS +
        '</g><circle cx="20" cy="20" r="6.5" fill="#fff7e8" stroke="#15122b" stroke-width="2"/></svg>')
once('<header class="appHead"><div><h1 class="brand">', '<header class="appHead"><div class="brandRow">' + MARK + '<div><h1 class="brand">')
once('<div class="micro tagline">nature as an instrument. · ' + VER + '</div></div><div class="headTools">',
     '<div class="micro tagline">nature as an instrument. · ' + VER + '</div></div></div><div class="headTools">')

# ── 4. リールのテンプレート「ポップ」5配色（先頭・既定）──
POP_OPTS = ('<option value="pop-sunny" selected>ポップ・ひまわり</option><option value="pop-candy">ポップ・キャンディ</option>'
            '<option value="pop-lagoon">ポップ・ラグーン</option><option value="pop-jungle">ポップ・ジャングル</option><option value="pop-night">ポップ・夜</option>')
if 'value="pop-sunny"' not in t:
    once('<select id="reelStyle" aria-label="リールのテンプレート"><option value="forest" selected>forest（区画パネル）</option>',
         '<select id="reelStyle" aria-label="リールのテンプレート">' + POP_OPTS + '<option value="forest">forest（区画パネル）</option>')
once("const REEL_STYLES=['motion','analysis','panels','wave','minimal'];", "const REEL_STYLES=['motion','analysis','panels','wave','minimal','pop'];")

# ── 5. スクリプト・CSS・辞書を埋め込み直す ──
CSS = recolor(open(P('build/src_studio.css'), encoding='utf-8').read().strip())
m = re.search(r'<style id="ae-studio-css">.*?</style>', t, re.S)
t = t[:m.start()] + '<style id="ae-studio-css">' + CSS + '</style>' + t[m.end():]
studio = open(P('build/src_studio.js'), encoding='utf-8').read()
S0, S1 = '/*<ae-studio>*/', '/*</ae-studio>*/'
a = t.index(S0); b = t.index(S1) + len(S1)
t = t[:a] + S0 + '\n' + studio + S1 + t[b:]
midi = open(P('build/src_midi.js'), encoding='utf-8').read()
a = t.index('/*<ae-midi>*/'); b = t.index('/*</ae-midi>*/') + len('/*</ae-midi>*/\n')
t = t[:a] + '/*<ae-midi>*/\n' + midi.rstrip('\n') + '\n/*</ae-midi>*/\n' + t[b:]
m = re.search(r'<script([^>]*) id="ae-i18n">(.*?)</script>', t, re.S)
t = t[:m.start(2)] + open(P('build/src_i18n.js'), encoding='utf-8').read() + t[m.end(2):]
open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
