#!/usr/bin/env python3
"""v0.64：特定商取引法に基づく表記にオーナーの記入を反映（2026-11-08 11:01）。
販売事業者「篠崎颯太（屋号：saw）」・責任者「篠崎颯太」・月額 9.99 米ドル（税込）、住所と電話は「請求があれば遅滞なく開示」。
メールアドレスはドメイン取得後に記入（それまで記入待ち＝課金は始まらない）。米ドル建ての価格を表記・購入前の確認欄・料金のカードに出す。
何度実行しても同じ結果になる。まず build/integrate_v063.py（その中で v0.61 → v0.59（legal.html と ae-legal を作り直す）→ …）を実行する。
使い方：python3 build/integrate_v064.py
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v063.py')], check=True, stdout=subprocess.DEVNULL)
VER = 'v0.64'
t = open(P('index.html'), encoding='utf-8').read()
t = re.sub(r'<title>saww audio ecosystem v0\.\d+', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.\d+', 'nature as an instrument. · ' + VER, t)
t = re.sub(r"\nconst VER='v0\.\d+';", "\nconst VER='%s';" % VER, t, count=1)
open(P('index.html'), 'w', encoding='utf-8').write(t)
s = open(P('build/src_studio.js'), encoding='utf-8').read()
s2 = re.sub(r"^const VER='v0\.\d+';", "const VER='%s';" % VER, s, count=1, flags=re.M)
if s2 != s:
    open(P('build/src_studio.js'), 'w', encoding='utf-8').write(s2)
print('ok', len(t))
