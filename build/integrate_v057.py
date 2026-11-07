#!/usr/bin/env python3
"""v0.57：課金（Stripe の支払いリンク・月額）と、無料版と PRO の区別。何度実行しても同じ結果になる。
- まず build/integrate_v055.py（その中で v0.53 → v0.49 → v0.48 → v0.47）を実行する。プランの定義（data/product_tiers.json の checkout）はそこで埋め込まれる。
- アプリ側の処理は src_studio.js（証明の確認・購入とログインの欄・PRO の欄の鍵）。サーバーは server/worker.js（Cloudflare Workers）。
使い方：python3 build/integrate_v056.py
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v055.py')], check=True, stdout=subprocess.DEVNULL)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.57'
t = re.sub(r'<title>saww audio ecosystem v0\.\d+', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.\d+', 'nature as an instrument. · ' + VER, t)
open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
