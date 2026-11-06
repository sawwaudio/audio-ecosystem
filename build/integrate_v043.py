#!/usr/bin/env python3
"""v0.43 を index.html に組み込む（何度実行しても同じ結果になる）。
- 本体スクリプトへの小さな差し込み（マスター EQ の経路、リールのテンプレート・写真・共有、写真のタイルとの接続）
- 画面の追加（写真のタイル・詳細シート・マルチトラック・プラン）と CSS
- データ（data/species_photos.json → ae-photos、data/product_tiers.json → ae-tiers）
- build/src_studio.js → <script id="ae-studio">、build/src_i18n.js → <script id="ae-i18n">
- 名称を saww audio ecosystem（すべて小文字）に統一
使い方：python3 build/integrate_v043.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
t = open(P('index.html'), encoding='utf-8').read()


def once(old, new, where=None):
    """old を new に1回だけ置き換える。すでに new なら何もしない。"""
    global t
    if new in t:
        return
    n = t.count(old)
    if n != 1:
        sys.exit(f'置き換え対象が {n} 件: {old[:80]!r}')
    t = t.replace(old, new)


def once_html(old, new):
    """画面（最初の <script> より前）だけで1回置き換える。辞書（ae-i18n）の同じ文言には触れない。"""
    global t
    h = t.index('<script')
    head, rest = t[:h], t[h:]
    if new in head:
        return
    if head.count(old) != 1:
        sys.exit(f'置き換え対象（画面）が {head.count(old)} 件: {old[:80]!r}')
    t = head.replace(old, new) + rest


def block(tag_id, content, before):
    """<script id=tag_id> を content で置き換える（なければ before の直前に作る）。"""
    global t
    m = re.search(r'<script([^>]*) id="%s">(.*?)</script>' % re.escape(tag_id), t, re.S)
    if m:
        t = t[:m.start(2)] + content + t[m.end(2):]
    else:
        i = t.index(before)
        attr = ' type="application/json"' if content.lstrip().startswith(('{', '[')) else ''
        t = t[:i] + '<script%s id="%s">%s</script>\n' % (attr, tag_id, content) + t[i:]


# ── 1. 本体スクリプトへの差し込み ──
# マスター EQ：コンプレッサーの後・リミッターの前に、チャンネルと同じ3バンド・アイソレーターを1本入れる
once("const preLim=G(1);comp.connect(preLim);preLim.connect(lim);",
     "const preLim=G(1);comp.connect(preLim);const mEq=makeMixLane(ctx);preLim.connect(mEq.input);mEq.out.connect(lim);")
once("master._lim=preLim;master._limNode=lim;",
     "master._lim=preLim;master._limNode=lim;master._eq=mEq;applyMixLane(mEq,mixMasterState(),ctx,false);")
once("const mixer={cfx:'space',ch:Object.fromEntries(MIX_CH.map(k=>[k,{...MIX_DEFAULT}]))}",
     "const mixer={cfx:'space',ch:Object.fromEntries(MIX_CH.map(k=>[k,{...MIX_DEFAULT}])),master:{hi:.5,mid:.5,low:.5}}")
once("function mixEqGain(v){return v>=.5?10**((v-.5)*12/20):(v/.5)**2}",
     "function mixEqGain(v){return v>=.5?10**((v-.5)*12/20):(v/.5)**2}\n"
     "// v0.43 マスター EQ：'master' はチャンネルではなく全体の LOW・MID・HI（mixer.master）\n"
     "function mixSt(ch){return ch==='master'?mixer.master:mixer.ch[ch]}function mixMasterState(){return {...MIX_DEFAULT,...mixer.master}}")
once("function mixSet(ch,key,v){const c=MIX_CTRL[key];if(c)v=clamp(+v,c.min,c.max);mixer.ch[ch][key]=key==='mute'?!!v:v;",
     "function mixSet(ch,key,v){const c=MIX_CTRL[key];if(c)v=clamp(+v,c.min,c.max);mixSt(ch)[key]=key==='mute'?!!v:v;")
once("""const el=document.querySelector('#mixGrid [data-ch="'+ch+'"] [data-k="'+key+'"]');if(!el)return;const v=mixer.ch[ch][key];""",
     """const el=document.querySelector((ch==='master'?'#mixMasterEq':'#mixGrid [data-ch="'+ch+'"]')+' [data-k="'+key+'"]');if(!el)return;const v=mixSt(ch)[key];""")
once("start={y:e.clientY,v:mixer.ch[ch][key]}", "start={y:e.clientY,v:mixSt(ch)[key]}")
once("mixSet(ch,key,mixer.ch[ch][key]+d*c.step)", "mixSet(ch,key,mixSt(ch)[key]+d*c.step)")
once("function applyMix(name,now){if(!ctx)return;for(",
     "function applyMix(name,now){if(!ctx)return;if(name==='master'){if(master&&master._eq)applyMixLane(master._eq,mixMasterState(),ctx,!now);return}for(")
once("return [['master',master._lim,master._limNode]]",
     "return [['master',master._eq?master._eq.out:master._lim,master._limNode]]")
# リール：テンプレート（区画パネル・波形の稜線・最小限）、背景画像、写真のクレジット、書き出し後の共有
once("if(reelStyle==='analysis')reelDrawAnalysis(c);else reelDrawMotion(c)",
     "if(reelStyle==='analysis')reelDrawAnalysis(c);else if(reelStyle==='motion')reelDrawMotion(c);else if(window.reelDrawStudio)reelDrawStudio(c,reelStyle)")
once("function reelSetStyle(v){if(v!=='motion'&&v!=='analysis')return false;reelStyle=v;const sel=$('reelStyle');if(sel&&sel.value!==v)sel.value=v;",
     "const REEL_STYLES=['motion','analysis','panels','wave','minimal'];\nfunction reelSetStyle(v){if(!REEL_STYLES.includes(v))return false;reelStyle=v;")
once("c.drawImage(m.bg,0,0);", "c.drawImage(m.bg,0,0);if(window.reelBgDraw)reelBgDraw(c,.3);")
once("attributionText(entries,{date:now})].join('\\r\\n');",
     "attributionText(entries,{date:now}),...(window.reelPhotoCredits?reelPhotoCredits(st):[])].join('\\r\\n');")
once("text,caption:caption.join('\\n'),sa};",
     "text,caption:caption.join('\\n'),sa};if(window.reelAfterExport)try{reelAfterExport(st,blob)}catch(e){}")
once("if(!playing)await start();\n // 対象外の声", "if(!playing&&!(window.studioActive&&studioActive()))await start();\n // 対象外の声")
once("if(recording||recordStopPending)return;\n if(!playing)await start();", "if(recording||recordStopPending)return;\n if(!playing&&!(window.studioActive&&studioActive()))await start();")
once("for(const v of sampleVoices)reelNote('instrument',v.sid);\n rec.ondataavailable",
     "for(const v of sampleVoices)reelNote('instrument',v.sid);if(window.studioSeed)studioSeed(reelNote);\n rec.ondataavailable")
once("for(const v of sampleVoices)noteRecUse('instrument',v.sid)}",
     "for(const v of sampleVoices)noteRecUse('instrument',v.sid);if(window.studioSeed)studioSeed(noteRecUse)}")
once("for(const id of activeBio.keys())add(id,'bio');for(const v of fieldVoices)add(v.id,'field');return out}",
     "for(const id of (window.studioNow?studioNow():[]))add(id,recordings.find(x=>x.id===id)?.kind==='landscape'?'field':'bio');for(const id of activeBio.keys())add(id,'bio');for(const v of fieldVoices)add(v.id,'field');return out}")
once("'#自然音 #環境音 #フィールドレコーディング #アンビエント #AUDIOECOSYSTEM'", "'#自然音 #環境音 #フィールドレコーディング #アンビエント #sawwaudioecosystem'")
once("'#fieldrecording #naturesounds #ambient #soundscape #AUDIOECOSYSTEM']", "'#fieldrecording #naturesounds #ambient #soundscape #sawwaudioecosystem']")
# 名称（すべて小文字）とファイル名
t = t.replace("'audio_ecosystem_", "'saww_audio_ecosystem_")
main_s = t.index('<script>\n') if '<script>\n' in t else t.index('<script>', t.index('id="ae-source-audit"'))
main_e = t.index('</script>', main_s)
main = t[main_s:main_e].replace('AUDIO ECOSYSTEM', 'saww audio ecosystem')
t = t[:main_s] + main + t[main_e:]

# ── 2. 画面 ──
once('<title>AUDIO ECOSYSTEM v0.42 — Bioacoustic Atlas</title>', '<title>saww audio ecosystem v0.43 — nature as an instrument.</title>')
once('<div class="micro">SAW SOUND LAB / GENERATIVE INSTRUMENT</div><h1>AUDIO ECOSYSTEM</h1><div class="micro">v0.42 · REAL RECORDINGS · FLAC · MIXER · BEAT FX ×10 · CHANNEL FX · SAMPLER</div>',
     '<div class="micro">nature as an instrument.</div><h1 class="brand">saww audio ecosystem</h1><div class="micro">v0.43 · SEE IT. TAP IT. HEAR IT. · REELS · MIXER · TRACKS · <a href="#plansSection">FREE / PRO</a></div>')
TILES = ('<section id="tileSection" aria-labelledby="tileTitle"><div class="between"><h2 id="tileTitle" class="title">SOUNDS — See it. Tap it. Hear it.</h2><span class="micro" id="tileCount" role="status"></span></div>'
         '<p class="micro">写真をタップすると実録音が鳴り、もう一度タップで止まります。いくつでも重ねられます。長押しか i で音量・ループ・録音情報。写真は学名が一致する種だけに付け、写真のない音は同じ型の図で表します。</p>'
         '<div class="tileFilters" id="tileFilters" role="group" aria-label="絞り込み"></div><div class="tileGrid" id="tileGrid"></div>'
         '<div class="buttons three"><button id="tileStopAll" type="button">■ すべて止める</button><button id="tileAddUser" type="button">＋ 自分の音を追加</button><button id="tileToReel" type="button">● リールを作る</button></div>'
         '<input id="tileUserFile" type="file" accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac" multiple hidden aria-label="自分の音声ファイルを選択"><input id="tileUserImage" type="file" accept="image/*" hidden aria-label="画像を選択">'
         '<p class="micro" id="tileStatus" role="status" aria-live="polite"></p></section>\n'
         '<dialog id="tileSheet" aria-labelledby="sheetName"><div class="sheetTop"><button id="sheetClose" type="button" class="sheetClose" aria-label="閉じる">×</button></div>'
         '<div class="sheetPhoto" id="sheetPhoto"></div><p class="micro" id="sheetPhotoCredit"></p><h3 id="sheetName"></h3><p class="sheetLatin" id="sheetLatin" data-i18n-skip></p>'
         '<div class="buttons"><button id="sheetPlay" type="button" aria-pressed="false">▶ 再生</button></div>'
         '<div class="control"><div><label for="sheetVol">音量</label><input id="sheetVol" type="range" min="0" max="100" step="1" value="70"></div><output class="value" id="sheetVolVal">70</output></div>'
         '<div class="control"><div><label for="sheetPan">定位</label><input id="sheetPan" type="range" min="-100" max="100" step="1" value="0"></div><output class="value" id="sheetPanVal">C</output></div>'
         '<label class="sheetCheck"><input id="sheetLoop" type="checkbox" checked> ループ（切れ目はクロスフェード）</label>'
         '<div class="buttons" id="sheetUser" hidden><button id="sheetSetImage" type="button">画像を設定</button><button id="sheetRemoveUser" type="button">この音を削除</button></div>'
         '<dl class="sheetInfo" id="sheetInfo" data-i18n-skip></dl></dialog>\n')
once('</header>\n<section id="sourceSection">', '</header>\n' + TILES + '<section id="sourceSection">')
# リール：テンプレート8種と画像
once('<label for="reelStyle">見た目</label><select id="reelStyle" aria-label="リールの見た目"><option value="motion" selected>動き（リール向け）</option><option value="analysis">分析（スペクトログラム）</option></select>',
     '<label for="reelStyle">テンプレート</label><select id="reelStyle" aria-label="リールのテンプレート"><option value="forest" selected>forest（区画パネル）</option><option value="ocean">ocean（区画パネル）</option><option value="night">night（区画パネル）</option><option value="wildlife">wildlife（区画パネル）</option><option value="minimal">minimal</option><option value="waveform">waveform</option><option value="spectrum">spectrum（分析）</option><option value="abstract">abstract（動き）</option></select>'
     '<label for="reelImage">画像</label><select id="reelImage" aria-label="リールの画像"><option value="auto" selected>鳴いている生き物の写真</option><option value="mine">自分の画像</option><option value="none">なし</option></select><input id="reelImageFile" type="file" accept="image/*" hidden aria-label="リールに使う画像を選択">')
once('<canvas id="reelCanvas" width="1080" height="1920" aria-label="リール映像のプレビュー"></canvas>',
     '<canvas id="reelCanvas" width="1080" height="1920" aria-label="リール映像のプレビュー"></canvas>'
     '<div id="reelDone" hidden><video id="reelVideo" controls playsinline muted aria-label="書き出したリールの再生"></video><p class="micro" id="reelDoneInfo" role="status" aria-live="polite"></p>'
     '<div class="buttons"><button id="reelSave" type="button">export video</button><button id="reelCopy" type="button">copy credits</button><button id="reelShare" type="button">share</button><button id="reelTry" type="button">try saww audio ecosystem</button></div></div>')
once_html('いまの演奏を縦長の動画として録画します。見た目は「動き」（音に反応する光の輪・立ちのぼる音の霧・光の粒・鳴き始めた生き物の名前と録音地のカード）か「分析」（スペクトログラム・波形）から選べます。',
     'いまの演奏を縦長の動画として録画します。上の写真をタップして音を重ねるだけでも作れます。テンプレートの forest・ocean・night・wildlife は、生き物の写真・スペクトラム・ステレオ・レベル・声の輪・スペクトログラム・データ・波形を区画に並べます。写真は学名が一致するライセンス確認済みの実写（CC0・パブリックドメイン・CC BY）だけで、撮影者とライセンスを映像と説明欄の両方に入れます。「自分の画像」を選ぶと端末の画像を使います（外へ送りません）。')
# マスター EQ
once('<div class="mixMasterRow"><span class="title">MASTER</span>',
     '<div class="mixMasterRow"><span class="title">MASTER</span><div class="mixMasterEq" id="mixMasterEq" role="group" aria-label="マスター EQ（全体のロー・ミドル・ハイ）"></div>')
once('<div class="djGrid" id="mixGrid"></div>',
     '<div class="djGrid" id="mixGrid"></div><p class="micro">MASTER の LOW・MID・HI で、出音全体のロー・ミドル・ハイを調整します（リミッターの手前。中央で 0dB、右いっぱいで +6dB、左いっぱいでその帯域が消えます）。</p>')
# マルチトラック・プラン
TRACKS = ('<details id="tracksSection" data-tier="pro"><summary><span>トラック / TRACKS</span><span class="micro">マルチトラック · 録音 · 書き出し</span></summary>'
          '<p class="micro">音をトラックに並べて、同じ時刻に揃えて再生・ループします。マイクで重ね録りするか、いまの出音を録れます。トラックはミキサーのサンプラーチャンネル（EQ・FX がかかる）かマスターへ直接送れます。録った音は「自分の音」にも入ります。</p>'
          '<div class="buttons"><button id="trkPlay" type="button" aria-pressed="false">▶ 全トラック再生</button><button id="trkMic" type="button" aria-pressed="false">● マイクで録音</button><button id="trkBounce" type="button" aria-pressed="false">● いまの出音を録る</button><label class="sheetCheck"><input id="trkLoop" type="checkbox" checked> ループ · <span id="trkLen">0.0 s</span></label></div>'
          '<div id="trkList" class="trkList"></div>'
          '<div class="fxRow"><label for="trkAddSrc">音</label><select id="trkAddSrc"></select><button id="trkAdd" type="button">＋ トラックに追加</button></div>'
          '<div class="buttons"><button id="trkWav" type="button">↓ WAV 24-bit で書き出し</button><button id="trkAiff" type="button">↓ AIFF 24-bit で書き出し</button></div>'
          '<p class="micro" id="trkStatus" role="status" aria-live="polite"></p>'
          '<p class="micro">書き出しはトラックの素の和です（ミキサーの EQ・FX は含みません。ピークが 0dBFS を超える時は全体を下げます）。マイクの録音はブラウザの入出力の遅れを補正しないため、重ね録りは少しずれることがあります。録音と読み込んだ音は端末の中だけで扱い、外へ送りません。</p></details>\n')
once('<section id="touchSection">', TRACKS + '<section id="touchSection">')
PLANS = ('<section id="plansSection" aria-labelledby="plansTitle"><div class="between"><h2 id="plansTitle" class="title">PLANS — FREE / PRO</h2><span class="micro">USD</span></div>'
         '<div id="plansBody"></div><p class="micro">テスト公開中はすべての機能を無料で使えます。料金は提案中で、正式に決まるまで請求はしません。決済情報をこの画面に入力することはありません。音源の利用条件は料金とは別で、PRO に加入しても各録音のライセンス（帰属表示など）はそのまま守る必要があります。</p></section>\n')
once('</section>\n<div class="buttons three"><button id="save">', '</section>\n' + PLANS + '<div class="buttons three"><button id="save">')
for sid in ('mixerSection', 'samplerSection'):
    once('<details id="%s">' % sid, '<details id="%s" data-tier="pro">' % sid)
once('<section><div class="between"><span class="title">LIVE CAPTURE / 16-BIT WAV</span>', '<section data-tier="pro"><div class="between"><span class="title">LIVE CAPTURE / 16-BIT WAV</span>')
once('Standalone Web Audio instrument', 'saww audio ecosystem — standalone Web Audio instrument')

# ── 3. CSS ──
CSS = open(P('build/src_studio.css'), encoding='utf-8').read().strip()
m = re.search(r'<style id="ae-studio-css">.*?</style>', t, re.S)
if m:
    t = t[:m.start()] + '<style id="ae-studio-css">' + CSS + '</style>' + t[m.end():]
else:
    i = t.index('</style></head>') + len('</style>')
    t = t[:i] + '<style id="ae-studio-css">' + CSS + '</style>' + t[i:]

# ── 4. データとスクリプト ──
photos = json.load(open(P('data/species_photos.json'), encoding='utf-8'))
tiers = json.load(open(P('data/product_tiers.json'), encoding='utf-8'))
dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
block('ae-photos', dump(photos), '<script>\n' if '<script>\n' in t else '<script>')
block('ae-tiers', dump(tiers), '<script>\n' if '<script>\n' in t else '<script>')
# 本体は1つの即時関数なので、v0.43 の層はその末尾（同じスコープ）に埋め込む。目印のコメントの間を毎回差し替える。
studio = open(P('build/src_studio.js'), encoding='utf-8').read()
S0, S1 = '/*<ae-studio>*/', '/*</ae-studio>*/'
if S0 in t:
    a = t.index(S0); b = t.index(S1) + len(S1)
    t = t[:a] + S0 + '\n' + studio + S1 + t[b:]
else:
    ms = t.index('<script>\n'); me = t.index('</script>', ms); tail = t.rindex('})();', ms, me)
    t = t[:tail] + S0 + '\n' + studio + S1 + '\n' + t[tail:]
block('ae-i18n', open(P('build/src_i18n.js'), encoding='utf-8').read(), '</body>')
open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
