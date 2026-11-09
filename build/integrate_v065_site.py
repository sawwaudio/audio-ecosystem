#!/usr/bin/env python3
"""v0.65：並びを変える（オーナー要望 2026-11-09 17:27「リールは04番に持ってくる、05にサイトを表示する」）。
並び：01 音を選ぶ → 02 演奏する → 03 スタジオ → 04 リールを作る → 05 公式サイト（https://saw-saww-official.com/）→ プラン → 設定と権利。
- 公式サイトは枠（iframe）で表示し、開けない時のために「公式サイトを開く」のボタンも出す。
  サイト側が枠への表示を許していないと、枠は空のままになる。その時は下のボタンで開く。
v0.64 の index.html の上で動く（v0.61 の並べ替えは、この版で済んでいるため、再度は実行しない）。何度実行しても同じ結果になる。
使い方：python3 build/integrate_v065_site.py
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
VER = 'v0.65'
SITE_URL = 'https://saw-saww-official.com/'


def die(m):
    sys.exit('integrate_v065_site: ' + m)


def rep(t, old, new, count=1):
    n = t.count(old)
    if n != count:
        die(f'置き換えの対象が {n} 件（期待 {count}）: {old[:60]}')
    return t.replace(old, new)


SITE = (
    '<section id="siteSection" class="step" aria-labelledby="siteTitle"><div class="stepHead">'
    '<span class="stepNo" aria-hidden="true">05</span><h2 class="stepTitle" id="siteTitle">公式サイト</h2>'
    '<span class="micro stepMeta">saw-saww-official.com</span></div>'
    '<p class="micro">公式サイトを下に表示します。表示されない時は、下のボタンから開いてください。</p>'
    f'<div class="buttons"><a class="siteOpen" href="{SITE_URL}" target="_blank" rel="noopener">公式サイトを開く</a></div>'
    f'<iframe class="siteFrame" src="{SITE_URL}" title="saww 公式サイト" loading="lazy" '
    'referrerpolicy="strict-origin-when-cross-origin"></iframe></section>'
)
CSS = (
    '.siteFrame{display:block;width:100%;height:min(72vh,640px);min-height:420px;border:1px solid var(--line);'
    'border-radius:12px;background:var(--card)}'
    '.siteOpen{display:inline-block;padding:8px 14px;border-radius:999px;border:1px solid var(--line);'
    'color:inherit;text-decoration:none}'
    '#siteSection .stepNo,.jump a[href="#siteSection"] b{background:var(--mint)}'
)
I18N = {
    '公式サイトを下に表示します。表示されない時は、下のボタンから開いてください。':
        'The official site is shown below. If it does not appear, open it with the button.',
    '公式サイトを開く': 'Open the official site',
    '公式サイト': 'Official site',
    'サイト': 'Site',
    'saww 公式サイト': 'saww official site',
}

# ── index.html ──
t = open(P('index.html'), encoding='utf-8').read()
t = re.sub(r'<title>saww audio ecosystem v0\.\d+', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.\d+', 'nature as an instrument. · ' + VER, t)

if 'id="siteSection"' not in t:
    a = t.find('<section id="reelSection"')
    s = t.find('<div id="studioGroup"')
    p = t.find('<section id="plansSection"')
    if min(a, s, p) < 0:
        die('欄が見つかりません')
    if not (a < s < p):
        die('並びが想定と違います（リール → スタジオ の順を期待）')
    reel, studio = t[a:s], t[s:p]
    if not reel.rstrip().endswith('</section>') or not studio.rstrip().endswith('</div>'):
        die('欄の境目')
    t = t[:a] + studio + reel + SITE + t[p:]

# 番号：スタジオ 03・リール 04（2回目以降は、すでに直っているので何もしない）
t = t.replace('<span class="stepNo" aria-hidden="true">04</span><h2 class="stepTitle">スタジオ',
              '<span class="stepNo" aria-hidden="true">03</span><h2 class="stepTitle">スタジオ')
t = t.replace('<span class="stepNo" aria-hidden="true">03</span><h2 class="stepTitle">リールを作る',
              '<span class="stepNo" aria-hidden="true">04</span><h2 class="stepTitle">リールを作る')
if '<a href="#siteSection">' not in t:
    t = rep(t, '<a href="#reelSection"><b>03</b>リール</a><a href="#studioGroup"><b>04</b>スタジオ</a>',
            '<a href="#studioGroup"><b>03</b>スタジオ</a><a href="#reelSection"><b>04</b>リール</a>'
            f'<a href="#siteSection"><b>05</b>サイト</a>')
if '.siteFrame{' not in t:
    t = rep(t, '</style></head><body>', CSS + '</style></head><body>')
for ja, en in I18N.items():
    if f"'{ja}':" not in t:
        anchor = "'この生き物は PRO で鳴らせます（無料版は分類ごとに4種まで）。':"
        t = rep(t, anchor, f"'{ja}':'{en}',\n{anchor}")
open(P('index.html'), 'w', encoding='utf-8').write(t)

# ── 元のファイル（次の組み込みで使う） ──
c = open(P('build/src_nature.css'), encoding='utf-8').read()
if '.siteFrame{' not in c:
    open(P('build/src_nature.css'), 'a', encoding='utf-8').write('\n' + CSS + '\n')
si = open(P('build/src_i18n.js'), encoding='utf-8').read()
for ja, en in I18N.items():
    if f"'{ja}'" not in si:
        anchor = "'この生き物は PRO で鳴らせます（無料版は分類ごとに4種まで）。'"
        si = rep(si, anchor, f"'{ja}':'{en}',\n{anchor}")
open(P('build/src_i18n.js'), 'w', encoding='utf-8').write(si)
print('ok', VER)
