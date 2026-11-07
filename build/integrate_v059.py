#!/usr/bin/env python3
"""v0.59：特定商取引法に基づく表記と定期購入の表示（オーナー要望 2026-11-07 18:37「特定商取引の表示と定期購入の表示をうめこむ／購入時に見れるようにする」）。
何度実行しても同じ結果になる。まず build/integrate_v058.py（その中で v0.57 → v0.55 → …）を実行する。
- build/make_legal.py：data/legal.json から legal.html（公開ページ）を作り、表示用データを index.html の ae-legal に埋め込む。
- アプリ（build/src_studio.js）：購入ボタンの前に「お申し込みの前に（定期購入の内容）」と確認のチェック。チェックを入れるまで購入ボタンは押せない。
  プランの欄に legal.html へのリンク。data/legal.json の月額があれば料金のカードに出す。記入待ちの項目が残る間は課金を始めない（LIVE にならない）。
- 生き物と環境音のイメージ写真（オーナー要望 18:46）：data/scene_photos.json を ae-scenes に埋め込む。種が特定できる録音は従来どおり学名の写真が優先。
使い方：python3 build/integrate_v059.py
"""
import importlib.util, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v058.py')], check=True, stdout=subprocess.DEVNULL)
spec = importlib.util.spec_from_file_location('make_legal', P('build/make_legal.py'))
ml = importlib.util.module_from_spec(spec); spec.loader.exec_module(ml)
emb = ml.build()
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.59'
t = re.sub(r'<title>saww audio ecosystem v0\.\d+', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.\d+', 'nature as an instrument. · ' + VER, t)

js = json.dumps(emb, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
block = '<script type="application/json" id="ae-legal">' + js + '</script>'
m = re.search(r'<script type="application/json" id="ae-legal">.*?</script>', t, re.S)
if m:
    t = t[:m.start()] + block + t[m.end():]
else:
    m = re.search(r'<script type="application/json" id="ae-tiers">.*?</script>', t, re.S)
    if not m:
        sys.exit('integrate_v059: ae-tiers')
    t = t[:m.end()] + block + t[m.end():]

# イメージ写真（data/scene_photos.json → ae-scenes）。ae-photos のすぐ後ろに置く
def embed(bid, data, after):
    global t
    js = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    block = '<script type="application/json" id="%s">' % bid + js + '</script>'
    m = re.search(r'<script type="application/json" id="%s">.*?</script>' % bid, t, re.S)
    if m:
        t = t[:m.start()] + block + t[m.end():]
    else:
        m = re.search(r'<script type="application/json" id="%s">.*?</script>' % after, t, re.S)
        t = t[:m.end()] + block + t[m.end():]
embed('ae-scenes', json.load(open(P('data/scene_photos.json'), encoding='utf-8')), 'ae-photos')

open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t), '· legal ready', emb['ready'], '· missing', ','.join(emb['missing']) or '-')
