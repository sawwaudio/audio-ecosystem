#!/usr/bin/env python3
"""v0.63：無料版で鳴らせる生き物の声を、分類ごとに4種に絞る（オーナー要望 2026-11-08 10:34「無料版生き物の声出せすぎ。各3〜4種類に絞って、残りはプロにする」）。
何度実行しても同じ結果になる。まず build/integrate_v061.py（その中で v0.59 → v0.58 → …）を実行する。
- data/product_tiers.json の recordings.free（鳥・虫・両生類・哺乳類・水の生き物で各4種、計20種）を ae-tiers に埋め込み直す。
- 本体の自律演奏（candidatePool）・playSpecies・試聴（previewSpecies）が window.__recAllowed（build/src_studio.js）を見るようにする。
- 画面（build/src_studio.js）：PRO の生き物のタイルに PRO の印、無料版では鍵（暗く）・タップすると案内・無料の生き物を先に並べる。
- 環境音と自分の音は無料版でも全部鳴る。課金が始まるまで（テスト公開中）は全部鳴る（「無料版の見え方を試す」で確かめられる）。
使い方：python3 build/integrate_v063.py
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v061.py')], check=True, stdout=subprocess.DEVNULL)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.63'


def die(m):
    sys.exit('integrate_v063: ' + m)


def once(old, new):
    global t
    if new in t:
        return
    if t.count(old) != 1:
        die('置き換え対象が %d 件：%s' % (t.count(old), old[:60]))
    t = t.replace(old, new)


t = re.sub(r'<title>saww audio ecosystem v0\.\d+', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.\d+', 'nature as an instrument. · ' + VER, t)
t = re.sub(r"\nconst VER='v0\.\d+';", "\nconst VER='%s';" % VER, t, count=1)

# 1. ae-tiers を data/product_tiers.json から埋め込み直す
tiers = json.load(open(P('data/product_tiers.json'), encoding='utf-8'))
js = json.dumps(tiers, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
m = re.search(r'(<script type="application/json" id="ae-tiers">)(.*?)(</script>)', t, re.S)
if not m:
    die('ae-tiers')
t = t[:m.start(2)] + js + t[m.end(2):]

# 2. 本体：自律演奏の候補・playSpecies・試聴
once("&&rightsAllowed(id)&&hasRealVoice(id))",
     "&&rightsAllowed(id)&&(!window.__recAllowed||window.__recAllowed(id))&&hasRealVoice(id))")
once("\n if(!rightsAllowed(id))return false;\n if(!hasRealVoice(id))return false;",
     "\n if(!rightsAllowed(id))return false;\n if(window.__recAllowed&&!window.__recAllowed(id))return false;\n if(!hasRealVoice(id))return false;")
once("function previewSpecies(id){\n stopPreview();",
     "function previewSpecies(id){\n stopPreview();if(window.__recAllowed&&!window.__recAllowed(id)){previewMessage('この生き物は PRO で鳴らせます（無料版は分類ごとに4種まで）。');return false}")

open(P('index.html'), 'w', encoding='utf-8').write(t)
s = open(P('build/src_studio.js'), encoding='utf-8').read()
s2 = re.sub(r"^const VER='v0\.\d+';", "const VER='%s';" % VER, s, count=1, flags=re.M)
if s2 != s:
    open(P('build/src_studio.js'), 'w', encoding='utf-8').write(s2)
print('ok', len(t), '· free creatures', sum(len(v) for v in tiers['recordings']['free'].values()))
