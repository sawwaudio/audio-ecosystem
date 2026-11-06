#!/usr/bin/env python3
"""v0.45 UI 再設計を index.html に組み込む（何度実行しても同じ結果になる）。

方針（docs/UI_LAYOUT_v0_45.md）
- 音を選ぶ場所は写真のタイルの1か所だけ。自律演奏の「この音場に加える」一覧・環境音の音量一覧・実録音の個別試聴は、
  画面から外して隠し領域（#legacyLists）に移す（本体の処理はそのまま動かす。機能はタイルと詳細シートに移した）。
- 並び順：01 音を選ぶ → 02 リールを作る → 03 演奏する → 04 スタジオ（PRO）→ プラン → 設定と権利。
- 説明文は1行（.lead）だけを見せ、残りは各欄の「ⓘ 詳しく」に畳む（文言は消さない）。
- 下に「いま鳴っている音」のバー（#dock）。止める・リールへ、を指の届く位置に置く。
使い方：python3 build/integrate_v045_ui.py（v0.44 の index.html に対して。2回目以降は区画の組み替えを飛ばし、
       build/src_studio.js・build/src_studio.css・build/src_i18n.js の中身だけを差し替える）
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.45'


def die(m):
    sys.exit('integrate_v045_ui: ' + m)


def elem_end(s, i):
    """s[i] が '<tag' の要素の、対応する閉じタグの直後の位置（同じ名前の入れ子を数える）。"""
    m = re.match(r'<([a-z0-9]+)', s[i:])
    if not m:
        die('要素の先頭ではありません: ' + s[i:i + 40])
    tag = m.group(1)
    if tag in ('input', 'img', 'br', 'hr', 'meta', 'link'):
        return s.index('>', i) + 1
    depth, j = 0, i
    pat = re.compile(r'<(/?)%s\b[^>]*>' % tag)
    while True:
        m = pat.search(s, j)
        if not m:
            die('閉じタグが見つかりません: ' + tag)
        depth += -1 if m.group(1) else 1
        j = m.end()
        if depth == 0:
            return j


def take(s, start_str):
    """s から start_str で始まる要素を切り出す → (要素, 残り)。"""
    if s.count(start_str) != 1:
        die('%d 件: %r' % (s.count(start_str), start_str[:70]))
    i = s.index(start_str)
    j = elem_end(s, i)
    return s[i:j], s[:i] + s[j:]


def by_id(s, id_):
    m = re.search(r'<[a-z]+[^>]*\bid="%s"' % re.escape(id_), s)
    if not m:
        die('id がありません: ' + id_)
    return take(s, s[m.start():m.end()])


def rep(s, old, new, n=1):
    if s.count(old) != n:
        die('置き換え対象が %d 件: %r' % (s.count(old), old[:70]))
    return s.replace(old, new)


HELP = '<details class="help"><summary>ⓘ 詳しく</summary>%s</details>'
MICRO_P = re.compile(r'<p class="micro"(?: style="[^"]*")?>(.*?)</p>', re.S)


def helpify(frag, extra_first=''):
    """欄の中の説明文（id のない <p class="micro">）を集めて、末尾の「ⓘ 詳しく」に畳む。"""
    ps = [m.group(1) for m in MICRO_P.finditer(frag)]
    frag = MICRO_P.sub('', frag)
    body = (('<p class="micro">%s</p>' % extra_first) if extra_first else '') + ''.join('<p class="micro">%s</p>' % p for p in ps)
    if not body:
        return frag
    k = frag.rindex('</')
    return frag[:k] + HELP % body + frag[k:]


def step_head(no, title, extra='', tag='h2', tid=None):
    return ('<div class="stepHead">' + ('<span class="stepNo" aria-hidden="true">%s</span>' % no if no else '') + '<%s class="stepTitle"%s>%s</%s>%s</div>'
            % (tag, (' id="%s"' % tid) if tid else '', title, tag, extra))


# ───────── 1. 区画の組み替え（1回だけ） ─────────
if 'id="dock"' not in t:
    b0 = t.index('<main>') + len('<main>')
    b1 = t.index('</main>')
    body = t[b0:b1]

    old_ids = set(re.findall(r'\bid="([^"]+)"', body))

    # 部品を切り出す
    hdr, body = take(body, '<header>')
    tools, _ = take(hdr, '<div class="headTools">')
    tiles, body = by_id(body, 'tileSection')
    sheet, body = by_id(body, 'tileSheet')
    source, body = by_id(body, 'sourceSection')
    perf, body = by_id(body, 'performance')
    harmony, body = take(body, '<section class="harmony">')
    hbuttons, body = take(body, '<div class="buttons"><button id="change">')
    capture, body = take(body, '<section data-tier="pro"><div class="between"><span class="title">LIVE CAPTURE')
    reel, body = by_id(body, 'reelSection')
    audition, body = by_id(body, 'auditionPanel')
    menv, body = take(body, '<section><div class="between"><span class="title">MASTER ENVIRONMENT')
    drones, body = take(body, '<details><summary><span>持続音・低音 / DRONES')
    instr, body = take(body, '<details><summary><span>音程のある楽器')
    perc, body = take(body, '<details><summary><span>打撃・脈動')
    field, body = by_id(body, 'fieldSection')
    bio, body = by_id(body, 'bioSection')
    diag, body = take(body, '<details><summary><span>05 / ENGINE DIAGNOSTICS')
    mixer, body = by_id(body, 'mixerSection')
    sampler, body = by_id(body, 'samplerSection')
    tracks, body = by_id(body, 'tracksSection')
    touch, body = by_id(body, 'touchSection')
    plans, body = by_id(body, 'plansSection')
    saverow, body = take(body, '<div class="buttons three"><button id="save">')
    exprow, body = take(body, '<div class="buttons"><button id="exportPreset">')
    pfile, body = take(body, '<input id="presetFile"')
    message, body = take(body, '<div class="status" id="message"')
    footer, body = take(body, '<div class="footer">')
    if body.strip():
        die('残った部品があります: ' + body.strip()[:200])

    # 生き物の一覧（自律演奏の「この音場に加える」）から、残す部品を取り出す
    rights, bio = by_id(bio, 'rightsPanel')
    geo, bio = by_id(bio, 'geoPanel')
    scene, bio = take(bio, '<details class="scenePresets"><summary>シーン設定')
    credits, bio = take(bio, '<details><summary>録音者・出典・利用条件')
    legacy_synth, field = take(field, '<details><summary>旧合成音・抽象音を使う')
    mixdet, perf = take(perf, '<details><summary>全体の音量・活動量・同時発音数')
    play_btn, perf = by_id(perf, 'play')
    resh_btn, perf = by_id(perf, 'reshuffle')
    pool, perf = by_id(perf, 'poolCount')
    live, perf = by_id(perf, 'liveSpecies')
    ens, perf = by_id(perf, 'ensembleStatus')
    rstat, perf = by_id(perf, 'realStatus')

    # ── ヘッダーとページ内の移動 ──
    header = ('<header class="appHead"><div><h1 class="brand">saww audio ecosystem</h1>'
              '<div class="micro tagline">nature as an instrument. · %s</div></div>%s</header>' % (VER, tools))
    nav = ('<nav class="jump" aria-label="ページ内の移動">'
           '<a href="#tileSection"><b>01</b>音を選ぶ</a><a href="#reelSection"><b>02</b>リール</a>'
           '<a href="#playGroup"><b>03</b>演奏</a><a href="#studioGroup"><b>04</b>スタジオ</a>'
           '<a href="#settingsGroup">設定</a></nav>')

    # ── 01 音を選ぶ（写真のタイル）──
    tiles_old_p = '<p class="micro">写真をタップすると実録音が鳴り、もう一度タップで止まります。いくつでも重ねられます。長押しか i で音量・ループ・録音情報。写真は学名が一致する種だけに付け、写真のない音は同じ型の図で表します。</p>'
    tiles = rep(tiles, tiles_old_p, '')
    btnrow, tiles = take(tiles, '<div class="buttons three">')
    stopall, _ = by_id(btnrow, 'tileStopAll')
    toreel, _ = by_id(btnrow, 'tileToReel')
    tiles = rep(tiles, '<div class="between"><h2 id="tileTitle" class="title">SOUNDS — See it. Tap it. Hear it.</h2><span class="micro" id="tileCount" role="status"></span></div>',
                step_head('01', '音を選ぶ', '<span class="micro stepMeta" id="tileCount" role="status"></span>', tid='tileTitle')
                + '<p class="lead">写真をタップすると鳴ります。<span class="leadSub">See it. Tap it. Hear it.</span></p>'
                + '<div class="tileBar">' + play_btn.replace('class="primary"', 'class="autoBtn" aria-pressed="false"')
                + '<button id="tileAddUser" type="button">＋ 自分の音</button></div>')
    k = tiles.rindex('</section>')
    tiles = (tiles[:k] + HELP % ('<p class="micro">「▶ 自律演奏をはじめる」を押すと、選んでいる写真の生き物が、それぞれ休みを挟みながら鳴き、和音もゆっくり流れます。止めている間は、タップした音がループで鳴り続けます。</p>' + tiles_old_p) + tiles[k:])
    tiles = tiles.replace('<section id="tileSection"', '<section id="tileSection" class="step"', 1)

    # 詳細シート：自律演奏のときの音量・休息（生き物の一覧にあった設定をここへ）
    sheet = rep(sheet, '<div class="buttons" id="sheetUser" hidden>',
                '<div id="sheetAuto" class="sheetAuto" hidden><p class="micro sheetSub">自律演奏のとき</p>'
                '<div class="control"><div><label for="sheetAutoLvl">音量</label><input id="sheetAutoLvl" type="range" min="0" max="100" step="1" value="20"></div><output class="value" id="sheetAutoLvlVal">20</output></div>'
                '<div class="control" id="sheetRestRow"><div><label for="sheetRest">鳴き終わってからの休息（秒）</label><input id="sheetRest" type="range" min="1" max="90" step="1" value="12"></div><output class="value" id="sheetRestVal">12</output></div></div>'
                '<div class="buttons" id="sheetUser" hidden>')

    # ── 02 リールを作る ──
    reel = rep(reel, '<div class="between"><span class="title">REEL / 縦動画 1080×1920</span><span class="micro" id="reelStatus">READY</span></div>',
               step_head('02', 'リールを作る', '<span class="micro stepMeta" id="reelStatus">READY</span>')
               + '<p class="lead">いま鳴っている音を、写真と波形の縦動画（1080×1920）に。</p>')
    reel = helpify(reel)
    reel = reel.replace('<section id="reelSection"', '<section id="reelSection" class="step"', 1)

    # ── 03 演奏する ──
    hinner = harmony[len('<section class="harmony">'):-len('</section>')]
    hbuttons = hbuttons.replace('<div class="buttons">', '<div class="buttons three">', 1)
    scene = rep(scene, '<p class="micro">適用すると現在の参加メンバーを置き換えます。下の分類から一匹ずつ追加・解除できます。</p>',
                '<p class="micro">適用すると、いま選んでいる生き物の組み合わせを置き換えます。写真のタイルで1つずつ足したり外したりできます。</p>')
    scene = helpify(scene)
    geo = helpify(geo.replace('<details class="scenePresets" id="geoPanel" open>', '<details class="scenePresets" id="geoPanel">', 1))
    combo = ('<details id="comboPanel" class="sub"><summary><span>組み合わせを選ぶ</span><span class="micro">シーン · 地域 ▾</span></summary>'
             + scene.replace('<details class="scenePresets">', '<div class="scenePresets" id="scenePanel">', 1)[:-len('</details>')].replace('<summary>シーン設定 — 生き物の組み合わせをまとめて選ぶ</summary>', '<div class="title subTitle">シーン設定 — 生き物の組み合わせをまとめて選ぶ</div>', 1) + '</div>'
             + geo + '</details>')
    mixdet = mixdet.replace('<details>', '<details class="sub">', 1)
    perf_new = ('<section id="performance" class="step">'
                + step_head('03', '演奏する', pool.replace('class="pill"', 'class="pill stepMeta"'))
                + '<p class="lead">自律演奏の和音と、生き物の鳴く量を整えます。</p>'
                + '<div class="harmony">' + hinner + '</div>'
                + '<div class="liveRow"><div class="liveLabel micro">いま鳴っている実録音</div>' + live + '</div>'
                + hbuttons + '<div class="buttons">' + resh_btn + '</div>'
                + mixdet + combo
                + HELP % ('<p class="micro">選んだ生き物が、それぞれ独立して鳴き、休みます。録音は最後まで再生し、両端をフェードします。</p>' + ens + rstat)
                + '</section>')
    touch = touch.replace('<section id="touchSection">', '<section id="touchSection" class="sub">', 1)
    menv = menv.replace('<section>', '<div class="synthBlock">', 1)[:-len('</section>')] + '</div>'
    legacy_synth = legacy_synth.replace('<details>', '<details class="sub">', 1)
    synth = ('<details id="synthPanel" class="sub"><summary><span>シンセの層</span><span class="micro">環境 · 持続音 · 楽器 · 打撃 · 試聴 ▾</span></summary>'
             + menv + drones + instr + perc + helpify(rep(audition, '<span>00 / SOUND AUDITION — 25 LAYERS</span>', '<span>SOUND AUDITION</span>')) + legacy_synth + '</details>')
    play_group = '<div id="playGroup" class="group">' + perf_new + touch + synth + '</div>'

    # ── 04 スタジオ（PRO）──
    mixer = helpify(mixer)
    sampler = helpify(sampler)
    capture = rep(capture, '<section data-tier="pro">', '<div class="captureBlock" id="captureBlock">')
    capture = helpify(capture[:-len('</section>')] + '</div>')
    tracks = rep(tracks, '<span>トラック / TRACKS</span>', '<span>トラックと録音 / TRACKS</span>')
    tracks = helpify(tracks)
    k = tracks.rindex('<details class="help">')
    tracks = tracks[:k] + capture + tracks[k:]
    studio_group = ('<div id="studioGroup" class="group">'
                    + '<div class="groupHead">' + step_head('04', 'スタジオ', '', tag='h2') + '</div>'
                    + '<p class="lead groupLead">鳴っている音を整える → 切り取る → 重ねて書き出す、の順に並べています。</p>'
                    + mixer + sampler + tracks + '</div>')

    # ── プラン ──
    plans = helpify(plans)
    plans = rep(plans, '<div class="between"><h2 id="plansTitle" class="title">PLANS — FREE / PRO</h2><span class="micro">USD</span></div>',
                step_head('', 'プラン — FREE / PRO', '<span class="micro stepMeta">USD</span>', tid='plansTitle'))
    plans = rep(plans, '<div id="plansBody"></div>', '<p class="lead">テスト公開中は、すべての機能を無料で使えます。</p><div id="plansBody"></div>')
    plans = plans.replace('<section id="plansSection"', '<section id="plansSection" class="step"', 1)

    # ── 設定と権利 ──
    rights = helpify(rights)
    source = source.replace('<section id="sourceSection">', '<section id="sourceSection" class="sub">', 1)
    cov, source = by_id(source, 'sourceCoverage')
    k = source.index('<details id="auditPanel">')
    source = source[:k] + HELP % cov + source[k:]
    preset = ('<section id="presetSection" class="sub"><div class="between"><span class="title">プリセット — 保存・読み込み</span></div>'
              + saverow + exprow + pfile + message + '</section>')
    credits = credits.replace('<details><summary>録音者・出典・利用条件</summary>', '<details id="creditsPanel" class="sub"><summary><span>録音者・出典・利用条件</span><span class="micro">CREDITS ▾</span></summary>', 1)
    diag = diag.replace('<details>', '<details id="diagPanel" class="sub">', 1)
    diag = rep(diag, '<span>05 / ENGINE DIAGNOSTICS</span>', '<span>ENGINE DIAGNOSTICS</span>')
    foot_long = footer[len('<div class="footer">'):-len('</div>')]
    diag = diag[:-len('</details>')] + '<p class="micro">' + foot_long + '</p></details>'
    settings_group = ('<div id="settingsGroup" class="group">'
                      + '<div class="groupHead"><div class="stepHead"><h2 class="stepTitle">設定と権利</h2></div></div>'
                      + rights + preset + credits + source + diag + '</div>')

    # ── 下のバー（いま鳴っている音）──
    stopall = rep(stopall, '>■ すべて止める<', '>■ 止める<')
    toreel = rep(toreel, '>● リールを作る<', '>● リール<')
    dock = ('<div id="dock" class="dock" role="region" aria-label="再生中の音" hidden><div class="dockIn">'
            '<div class="dockInfo"><span class="dockDot" aria-hidden="true"></span><span id="dockText" class="dockText" role="status"></span></div>'
            + stopall + toreel + '</div></div>')

    # ── 画面から外す一覧（本体の処理は動かしたまま）──
    legacy = ('<div id="legacyLists" hidden>' + bio + field + '</div>')

    footer_new = '<div class="footer">saww audio ecosystem — nature as an instrument.</div>'
    new_body = '\n'.join([header, nav, tiles, sheet, reel, play_group, studio_group, plans, settings_group, footer_new, legacy, dock]) + '\n'
    new_ids = set(re.findall(r'\bid="([^"]+)"', new_body))
    lost = old_ids - new_ids
    if lost:
        die('なくなった id: ' + ', '.join(sorted(lost)))
    for tag in ('button', 'select', 'input', 'canvas', 'output'):
        a, z = len(re.findall('<' + tag + r'\b', t[b0:b1])), len(re.findall('<' + tag + r'\b', new_body))
        if z < a:
            die('%s が減りました（%d → %d）' % (tag, a, z))
    t = t[:b0] + '\n' + new_body + t[b1:]
    t = re.sub(r'<title>saww audio ecosystem v0\.4\d', '<title>saww audio ecosystem ' + VER, t)

# ───────── 2. 本体スクリプトの小さな変更 ─────────
def once(old, new):
    global t
    if new in t:
        return
    if t.count(old) != 1:
        die('置き換え対象が %d 件: %r' % (t.count(old), old[:80]))
    t = t.replace(old, new)

# 自律演奏ボタンの押下状態（スクリーンリーダー向け）。文言は従来どおり。
# 起動時に生き物の一覧・環境音の一覧を「自律演奏」欄の下へ動かす処理（v0.2x）は、隠し領域の中で並べるだけにする
once("$('performance').after($('bioSection'));$('bioSection').after($('fieldSection'));", "$('legacyLists').append($('bioSection'),$('fieldSection'));")
once("$('play').textContent='■ 演奏を一時停止';", "$('play').textContent='■ 演奏を一時停止';$('play').setAttribute('aria-pressed','true');")
once("$('play').textContent='▶ 自律演奏を再開';", "$('play').textContent='▶ 自律演奏を再開';$('play').setAttribute('aria-pressed','false');")

# ── 楽器の層（v0.45 オーナー要望）：音程のある楽器からフルート・弦のハーモニクス（合成）を外し、
#    低音ドローンに実録音5種（ディジュリドゥ・パイプオルガンのペダル・ティンパニのロール・ゴング・ピアノ最低音域）＋自然の低音（波の実録音の低域）、
#    打撃・脈動に実録音5種（フレームドラム・カホン・ダルブッカ・スリットドラム・コンガ）を足す。鳴らし方は build/src_studio.js の「実録音の楽器層」。
NEW_LOW = '["didge", "ディジュリドゥ（実録音）", 0], ["organPedal", "パイプオルガンのペダル（実録音）", 20], ["timpaniRoll", "ティンパニのロール（実録音）", 0], ["gong", "ゴングの余韻（実録音）", 12], ["pianoLow", "ピアノの最低音域（実録音）", 0], ["natureLow", "自然の低音（波の実録音・低域）", 16]'
NEW_RHY = '["frameDrum", "フレームドラム（実録音）", 12], ["cajon", "カホン（実録音）", 0], ["darbuka", "ダルブッカ（実録音）", 0], ["slitDrum", "スリットドラム（実録音）", 10], ["conga", "コンガ（実録音）", 0]'
NEW_KEYS = "'didge','organPedal','timpaniRoll','gong','pianoLow','natureLow','frameDrum','cajon','darbuka','slitDrum','conga'"
once('["bowed", "擦弦持続音", 26]], "music":', '["bowed", "擦弦持続音", 26], ' + NEW_LOW + '], "music":')
once('["bells", "柔らかなベル", 22], ["harmonics", "弦のハーモニクス", 24], ["flute", "息のあるフルート", 18], ["harp", "実録音ハープ", 28]', '["bells", "柔らかなベル", 22], ["harp", "実録音ハープ", 28]')
once('["stones", "石の打撃（合成）", 13]], "nature":', '["stones", "石の打撃（合成）", 13], ' + NEW_RHY + '], "nature":')
once("const seq=[['vibes',9,20],['harp',7,18],['harmonics',9,23],['flute',14,32],",
     "const seq=[['vibes',9,20],['harp',7,18],['timpaniRoll',24,60],['gong',28,75],['pianoLow',14,36],['frameDrum',6,18],['cajon',7,20],['darbuka',6,17],['slitDrum',8,22],['conga',7,19],")
if "['harp',"+NEW_KEYS+"]" not in t:
    if t.count("['harmonics','flute','harp']") != 2:
        die('プリセットの任意レイヤー一覧が見つかりません')
    t = t.replace("['harmonics','flute','harp']", "['harp'," + NEW_KEYS + "]")
once("function trigger(k,t,gesture=null){", "function trigger(k,t,gesture=null){if(window.__real&&__real.is(k))return __real.hit(k,t,gesture);")
once("residentTick();fieldTick();updateDiagnostics()}", "residentTick();fieldTick();if(window.__real)__real.tick();updateDiagnostics()}")
once("stopBioVoices();clearInterval(timer)", "stopBioVoices();if(window.__real)__real.stopAll();clearInterval(timer)")
once("const isBed=continuous.some(x=>x.key===key),isDrone=['sub','organDrone','bowed'].includes(key);", "const isBed=continuous.some(x=>x.key===key),isDrone=['sub','organDrone','bowed'].includes(key)||!!(window.__real&&__real.isLoop(key));")

# ───────── 3. CSS・スクリプト・辞書の差し替え（毎回）─────────
CSS = open(P('build/src_studio.css'), encoding='utf-8').read().strip()
m = re.search(r'<style id="ae-studio-css">.*?</style>', t, re.S)
if not m:
    die('ae-studio-css がありません')
t = t[:m.start()] + '<style id="ae-studio-css">' + CSS + '</style>' + t[m.end():]
studio = open(P('build/src_studio.js'), encoding='utf-8').read()
S0, S1 = '/*<ae-studio>*/', '/*</ae-studio>*/'
a = t.index(S0); b = t.index(S1) + len(S1)
t = t[:a] + S0 + '\n' + studio + S1 + t[b:]
m = re.search(r'<script([^>]*) id="ae-i18n">(.*?)</script>', t, re.S)
t = t[:m.start(2)] + open(P('build/src_i18n.js'), encoding='utf-8').read() + t[m.end(2):]
# 楽器・音源の台帳（data/*.json）を埋め込む（build/import_vcsl_v045.py が更新する）
import json
for i, f in (('ae-instruments', 'data/instrument_samples.json'), ('ae-audio-manifest', 'data/audio_manifest.json'), ('ae-source-audit', 'data/source_audit.json')):
    m = re.search(r'(<script type="application/json" id="' + i + r'">)(.*?)(</script>)', t, re.S)
    t = t[:m.start(2)] + json.dumps(json.load(open(P(f), encoding='utf-8')), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + t[m.end(2):]
open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
