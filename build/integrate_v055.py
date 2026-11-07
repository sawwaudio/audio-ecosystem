#!/usr/bin/env python3
"""v0.55：伝統楽器（ムビラ・バラフォン・ダン・チャン・弓で弾くプサルテリー・ネパールのハンドベル・ディジュリドゥのフレーズ）と、
無料版で出せる楽器を限る仕組み（オーナー要望 2026-11-07 14:17「伝統楽器を中心に追加。口琴など倍音が素晴らしい楽器」「無料版では出せる楽器を限る」）。
何度実行しても同じ結果になる。
- まず build/integrate_v053.py（その中で v0.49 → v0.48 → v0.47）を実行し、その上に重ねる。
- 録音は build/import_vcsl_v055.py（VCSL・CC0）。鳴らし方は src_studio.js の REAL_DEF。
- 無料版の楽器は data/product_tiers.json の instruments.free（ここで ae-tiers に埋め込み直す）。課金は無効のままなので、
  テスト公開中は全部使える。「無料版の見え方を試す」で制限を確かめられる（src_studio.js）。
使い方：python3 build/integrate_v055.py
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v053.py')], check=True, stdout=subprocess.DEVNULL)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.55'


def die(m):
    sys.exit('integrate_v055: ' + m)


def once(old, new):
    global t
    if new in t:
        return
    if t.count(old) != 1:
        die('置き換え対象が %d 件: %r' % (t.count(old), old[:90]))
    t = t.replace(old, new)


# ── 1. 版の表記 ──
t = re.sub(r'<title>saww audio ecosystem v0\.\d+', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.\d+', 'nature as an instrument. · ' + VER, t)

# ── 2. 伝統楽器の層（群・自律演奏の間隔・プリセットで読む任意の層）。初期値は 0（選んだ人だけ鳴る）──
NEW = {'low': [('didgePhrase', 'ディジュリドゥ（フレーズ・実録音）', 22, 55)],
       'music': [('mbira', 'ムビラ（ジンバブエ・実録音）', 6, 16), ('balafon', 'バラフォン（西アフリカ・実録音）', 6, 15),
                 ('danTranh', 'ダン・チャン（ベトナムの箏・実録音）', 8, 22), ('bowedPsaltery', '弓で弾くプサルテリー（実録音）', 14, 36)],
       'rhythm': [('handBells', 'ハンドベル（ネパール・実録音）', 14, 40)]}
ANCHOR = {'low': '["natureLow", "自然の低音（波の実録音・低域）", 16]]', 'music': '["glockenspiel", "グロッケンシュピール（実録音）", 0]]',
          'rhythm': None}
for g, items in NEW.items():
    add = ', '.join('["%s", "%s", 0]' % (k, l) for k, l, _, _ in items)
    if '["%s",' % items[0][0] in t:
        continue
    if ANCHOR[g]:
        once(ANCHOR[g], ANCHOR[g][:-1] + ', ' + add + ']')
    else:
        m = re.search(r'"rhythm": \[(.*?)\]\]', t)
        once(m.group(0), m.group(0)[:-1] + ', ' + add + ']')
ALL = [x for v in NEW.values() for x in v]
once("['glockenspiel',9,24]];", "['glockenspiel',9,24]," + ','.join("['%s',%d,%d]" % (k, a, b) for k, _, a, b in ALL) + "];")
OPT = "'kalimba','marimba','tubularBells','glockenspiel'"
if OPT + ",'didgePhrase'" not in t:
    if t.count(OPT + "]") != 2:
        die('任意の層の一覧')
    t = t.replace(OPT + "]", OPT + "," + ','.join("'%s'" % k for k, _, _, _ in ALL) + "]")

# ── 3. 無料版の楽器を限る：本体の発音の入口（trigger）で、使えない楽器は鳴らさない（判定は src_studio.js の __instrAllowed）──
once("function trigger(k,t,gesture=null){", "function trigger(k,t,gesture=null){if(window.__instrAllowed&&!__instrAllowed(k))return false;")

# ── 4. プランの定義（data/product_tiers.json）を埋め込み直す ──
tiers = json.dumps(json.load(open(P('data/product_tiers.json'), encoding='utf-8')), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
m = re.search(r'(<script type="application/json" id="ae-tiers">)(.*?)(</script>)', t, re.S)
t = t[:m.start(2)] + tiers + t[m.end(2):]

open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
