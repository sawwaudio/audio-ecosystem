#!/usr/bin/env python3
"""v0.49：ロゴ・生き物と環境音の切り替え・音ごとの音量と休み・「鳴っている音」の一覧・写真のない生き物のイラスト・タッチ演奏を外す・
楽器（実録音）と合成音（シンセ）の整理・合成音の密度。何度実行しても同じ結果になる。
- まず build/integrate_v048_nature.py（その中で v0.47）を実行し、その上に重ねる。
- スクリプトは build/src_illust.js（イラスト）＋ build/src_studio.js を同じ区間に埋め込む。CSS は build/src_nature.css（ae-nature-css）。
- ロゴ：assets/brand/ の縮小版を data URI で埋め込む（本体・音源リポジトリのどちらの公開でも同じに表示するため）。
使い方：python3 build/integrate_v049.py
"""
import base64, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v048_nature.py')], check=True, stdout=subprocess.DEVNULL)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.49'


def die(m):
    sys.exit('integrate_v049: ' + m)


def once(old, new):
    global t
    if new in t:
        return
    if t.count(old) != 1:
        die('置き換え対象が %d 件: %r' % (t.count(old), old[:90]))
    t = t.replace(old, new)


def elem_end(s, i):
    tag = re.match(r'<([a-z0-9]+)', s[i:]).group(1)
    depth, j = 0, i
    pat = re.compile(r'<(/?)%s\b[^>]*>' % tag)
    while True:
        m = pat.search(s, j)
        depth += -1 if m.group(1) else 1
        j = m.end()
        if depth == 0:
            return j


b64 = lambda f: base64.b64encode(open(P('assets/brand', f), 'rb').read()).decode()

# ── 1. 版の表記 ──
t = re.sub(r'<title>saww audio ecosystem v0\.4\d', '<title>saww audio ecosystem ' + VER, t)
t = re.sub(r'nature as an instrument\. · v0\.4\d', 'nature as an instrument. · ' + VER, t)

# ── 2. ロゴ（ヘッダー・タブのアイコン・ホーム画面のアイコン）──
LOGO = '<img class="brandLogo" src="data:image/webp;base64,%s" alt="" width="44" height="44">' % b64('logo-192.webp')
t = re.sub(r'<svg class="brandMark".*?</svg>', LOGO, t, count=1, flags=re.S)
if 'rel="icon"' not in t:
    once('<meta name="theme-color" content="#141a16">',
         '<meta name="theme-color" content="#141a16"><link rel="icon" type="image/png" href="data:image/png;base64,%s"><link rel="apple-touch-icon" href="data:image/jpeg;base64,%s">' % (b64('favicon-32.png'), b64('apple-touch-180.jpg')))

# ── 3. 生き物と環境音の切り替え（タブ）──
once('<div class="tileFilters" id="tileFilters" role="group" aria-label="絞り込み"></div><div class="tileGrid" id="tileGrid"></div><div id="ambSection" class="ambSection">',
     '<div class="soundTabs" role="tablist" aria-label="音の種類"><button id="tabCreatures" type="button" role="tab" aria-selected="true"><span>生き物</span><span id="tabCreaturesN" class="tabN"></span></button>'
     '<button id="tabAmbience" type="button" role="tab" aria-selected="false"><span>環境音</span><small>川・雨・波・風</small><span id="tabAmbienceN" class="tabN"></span></button></div>'
     '<div id="creaturePane"><div class="tileFilters" id="tileFilters" role="group" aria-label="絞り込み"></div><div class="tileGrid" id="tileGrid"></div></div><div id="ambSection" class="ambSection" hidden>')

# ── 4. 詳細シート：音量はループ・自律演奏で共通、休みは選ぶ ──
i = t.find('<div id="sheetAuto" class="sheetAuto" hidden>')
if i >= 0:
    j = elem_end(t, i)
    t = t[:i] + '<div class="control restRow" id="sheetRestRow"><div><label>休み（鳴き終わってから次まで）</label><div id="sheetRestBox"></div></div></div>' + t[j:]

# ── 5. 下のバー：「鳴っている音」の一覧 ──
once('<div id="dock" class="dock" role="region" aria-label="再生中の音" hidden><div class="dockIn">',
     '<div id="dock" class="dock" role="region" aria-label="再生中の音" hidden><div id="dockPanel" class="dockPanel" hidden><div class="dpHead"><span class="dpTitle">鳴っている音</span><button id="dockPanelClose" type="button" class="dpClose" aria-label="閉じる">×</button></div><div id="dockPanelList" class="dpList"></div></div><div class="dockIn">')
once('<button id="tileStopAll" type="button">■ 止める</button><button id="tileToReel" type="button">● リール</button></div></div>',
     '<button id="dockList" type="button" aria-expanded="false" aria-controls="dockPanel" aria-label="鳴っている音の一覧">♪ <span id="dockListN">0</span></button><button id="tileStopAll" type="button">■ 止める</button><button id="tileToReel" type="button">● リール</button></div></div>')

# ── 6. タッチ演奏を画面から外す（オーナー要望 2026-11-06 20:03。処理は隠した領域で残す）──
i = t.index('<section id="touchSection"')
if t.rfind('<div id="legacyLists" hidden>', 0, i) < 0:
    j = elem_end(t, i)
    sec = t[i:j]
    t = t[:i] + t[j:]
    once('<div id="legacyLists" hidden>', '<div id="legacyLists" hidden>' + sec)

# ── 7. 密度（重なり）：合成音・楽器それぞれの発音の頻度と同時発音の上限を、つまみ（50〜400%）で増やせるようにする ──
#    層ごとの倍率は src_studio.js の window.__boostOf(key)、同時発音の上限の倍率は window.__boostCap()（1〜2.2倍）。
def swap(cands, new):
    """new が既にあれば何もしない。cands のうち 1 件だけ見つかったものを new に置き換える（途中の版の書き方も受け付ける）。"""
    global t
    if new in t:
        return
    for c in cands:
        if t.count(c) == 1:
            t = t.replace(c, new)
            return
    die('置き換え対象が見つからない: %r' % cands[0][:90])


CAP = "(window.__boostCap?__boostCap():1)"
swap(["const density=cycleDensity(elapsed)*(.45+.7*p.density/100)*(window.__synthBoost||1);"], "const density=cycleDensity(elapsed)*(.45+.7*p.density/100);")
swap(["if(!auditionKey&&Math.random()<(.16+.72*p[key]/100)*density)trigger(key,at);scheduled[key]=at+R(a,b)*Math.max(.22,1.55-density*.45)}}",
      "if(!auditionKey&&Math.random()<(.16+.72*p[key]/100)*density)trigger(key,at);scheduled[key]=at+R(a,b)*(1.55-density*.45)}}"],
     "const bd=density*(window.__boostOf?__boostOf(key):1);if(!auditionKey&&Math.random()<(.16+.72*p[key]/100)*bd)trigger(key,at);scheduled[key]=at+R(a,b)*Math.max(.22,1.55-bd*.45)}}")
swap(["transientSources>=(quality==='high'?68:34)*Math.min(2.2,Math.max(1,window.__synthBoost||1)))return;", "transientSources>=(quality==='high'?68:34))return;"],
     "transientSources>=(quality==='high'?68:34)*" + CAP + ")return;")
swap(["if(transientSources>=(quality==='high'?72:38)*Math.min(2.2,Math.max(1,window.__synthBoost||1))){voiceLimitHits++;return null}",
      "if(transientSources>=(quality==='high'?72:38)){voiceLimitHits++;return null}"],
     "if(transientSources>=(quality==='high'?72:38)*" + CAP + "){voiceLimitHits++;return null}")
once("if(sampleVoices.size>=8){", "if(sampleVoices.size>=8*" + CAP + "){")

# ── 7b. 旋律の実録音楽器（v0.49 追加：カリンバ・マリンバ・チューブラーベル・グロッケンシュピール。build/import_vcsl_v049.py）──
#    鳴らし方は src_studio.js の REAL_DEF（mode:'melody'：いまの和音の音を楽器の音域へ移して短いフレーズ）。初期値は 0（選んだ人だけ鳴る）。
NEW_MEL = [('kalimba', 'カリンバ（実録音）', 7, 19), ('marimba', 'マリンバ（実録音）', 6, 17), ('tubularBells', 'チューブラーベル（実録音）', 16, 42),
           ('glockenspiel', 'グロッケンシュピール（実録音）', 9, 24)]
once('["vibes", "実録音ヴィブラフォン", 0]]', '["vibes", "実録音ヴィブラフォン", 0], ' + ', '.join('["%s", "%s", 0]' % (k, l) for k, l, _, _ in NEW_MEL) + ']')
once("['avalanche',65,155]];", "['avalanche',65,155]," + ','.join("['%s',%d,%d]" % (k, a, b) for k, _, a, b in NEW_MEL) + "];")
OPT = "'harp','didge','organPedal','timpaniRoll','gong','pianoLow','natureLow','frameDrum','cajon','darbuka','slitDrum','conga'"
if OPT + ",'kalimba'" not in t:
    assert t.count(OPT + "]") == 2, '任意の層の一覧'
    t = t.replace(OPT + "]", OPT + "," + ','.join("'%s'" % k for k, _, _, _ in NEW_MEL) + "]")

# ── 8. スクリプト（イラスト＋本体）を埋め込み直す ──
studio = open(P('build/src_illust.js'), encoding='utf-8').read() + '\n' + open(P('build/src_studio.js'), encoding='utf-8').read()
S0, S1 = '/*<ae-studio>*/', '/*</ae-studio>*/'
a = t.index(S0); b = t.index(S1) + len(S1)
# src_studio.js は即時関数で始まるので、イラストの関数をその中に入れる
studio = open(P('build/src_studio.js'), encoding='utf-8').read().replace("(()=>{'use strict';", "(()=>{'use strict';\n" + open(P('build/src_illust.js'), encoding='utf-8').read(), 1)
t = t[:a] + S0 + '\n' + studio + S1 + t[b:]
m = re.search(r'<style id="ae-nature-css">.*?</style>', t, re.S)
t = t[:m.start()] + '<style id="ae-nature-css">' + open(P('build/src_nature.css'), encoding='utf-8').read().strip() + '</style>' + t[m.end():]
open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
