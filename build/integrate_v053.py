#!/usr/bin/env python3
"""v0.53：軽くする（軽量の音源を既定に・一度鳴らした音を端末に保存）と、画面の重複を減らす。何度実行しても同じ結果になる。
オーナー要望（2026-11-07 10:13）「ちょっと重すぎ。ネットが弱いとすごい重い。UI の重複を減らして使いやすく」。
- まず build/integrate_v049.py（その中で v0.48・v0.47）を実行し、その上に重ねる。
- 軽量の音源は build/make_lite_audio.py が作る（音源リポジトリの audio/lite/）。ここではアプリの既定を「軽量」にする。
- 端末への保存は Service Worker（build/src_sw.js → リポジトリ直下の sw.js）。登録は src_studio.js。
- 画面：設定の中を「音質と通信 → 商用モード → 設定の保存 → クレジット → 詳しい情報（確認・開発用）」の順にまとめ、
  英語だけのボタン名を日本語に（英語表示は辞書で従来どおり）。
使い方：python3 build/integrate_v053.py
"""
import os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
subprocess.run([sys.executable, P('build/integrate_v049.py')], check=True, stdout=subprocess.DEVNULL)
t = open(P('index.html'), encoding='utf-8').read()
VER = 'v0.53'


def die(m):
    sys.exit('integrate_v053: ' + m)


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

# ── 2. 軽量の音源を既定に（FLAC は「高音質」として選べる）──
once("const SOURCE_LABEL={pcm:'FLAC',original:'原本ファイル',compat:'互換MP3'};",
     "const SOURCE_LABEL={lite:'軽量',pcm:'高音質 FLAC',original:'原本ファイル',compat:'互換MP3'};")
once("let sourceMode='pcm';try{", "let sourceMode='lite';try{")
once("const order=sourceMode==='pcm'?['pcm','compat']:",
     "const order=sourceMode==='lite'?(kind==='instruments'?['compat','pcm']:['lite','compat','pcm']):sourceMode==='pcm'?['pcm','compat']:")
once("  :'互換MP3：v0.23と同じ 44.1kHz / モノラル / 128kbps。比較・互換確認用。';",
     "  :sourceMode==='lite'?'軽量：自然録音 '+Object.values(audioManifest.recordings).filter(m=>m.lite).length+'/'+c.rec+' は MP3（約175kbps・ステレオはステレオのまま）、楽器は MP3。FLAC の約1/10 の通信量です。'\n"
     "  :'互換MP3：v0.23と同じ 44.1kHz / モノラル / 128kbps。比較・互換確認用。';")
once('<select id="sourceMode" aria-label="再生に使う音源"><option value="pcm">FLAC — 可逆圧縮（原本と同じ音）</option>',
     '<select id="sourceMode" aria-label="再生に使う音源"><option value="lite">軽量 — MP3（既定・通信が少ない）</option><option value="pcm">高音質 — FLAC（原本と同じ音・通信が多い）</option>')
once('<span class="badge" id="sourceBadge">FLAC</span>', '<span class="badge" id="sourceBadge">軽量</span>')

# ── 3. 英語だけのボタン名を日本語に（英語表示では辞書で英語に戻る）──
once('<button id="change">✧ CHANGE HARMONY</button><button id="auto" class="primary">AUTO COMPOSE ON</button><button id="quality">QUALITY: HIGH</button>',
     '<button id="change">✧ 和音を変える</button><button id="auto" class="primary">自動作曲 オン</button><button id="quality">音の細かさ：高</button>')
once("$('auto').textContent='AUTO COMPOSE '+(auto?'ON':'OFF');", "$('auto').textContent='自動作曲 '+(auto?'オン':'オフ');")
once("$('quality').textContent='QUALITY: '+quality.toUpperCase()}", "$('quality').textContent='音の細かさ：'+(quality==='high'?'高':'省電力')}")
once('<span class="title">プリセット — 保存・読み込み</span>', '<span class="title">設定の保存と読み込み（プリセット）</span>')
once('<div class="buttons three"><button id="save">SAVE</button><button id="restore">RESTORE</button><button id="reset">DEFAULT</button></div><div class="buttons"><button id="exportPreset">↓ EXPORT PRESET JSON</button><button id="importPreset">↑ IMPORT PRESET JSON</button></div>',
     '<div class="buttons three"><button id="save">この端末に保存</button><button id="restore">保存した設定に戻す</button><button id="reset">初期設定に戻す</button></div><div class="buttons"><button id="exportPreset">↓ ファイルに書き出す</button><button id="importPreset">↑ ファイルから読み込む</button></div>')
once('<span class="title">AUDIO SOURCE / 再生音源</span>', '<span class="title">音源の形式</span>')
once('<span>ENGINE DIAGNOSTICS</span><span class="micro">LIVE ▾</span>', '<span>エンジンの状態</span><span class="micro">LIVE ▾</span>')

# ── 4. 設定の並び：音質と通信を先頭に、確認・開発用の欄（音源の形式・監査・DB・診断）を1つに畳む ──
NET = ('<section id="netPanel" class="sub"><div class="between"><span class="title">音質と通信</span><span class="micro" id="netBadge"></span></div>'
       '<div class="segRow" role="radiogroup" aria-label="音質"><button type="button" role="radio" data-q="lite">軽量<small>既定 · 通信が少ない</small></button>'
       '<button type="button" role="radio" data-q="pcm">高音質<small>FLAC · 原本と同じ音</small></button></div>'
       '<p class="micro" id="netStatus" role="status" aria-live="polite"></p><div class="buttons"><button id="netClear" type="button">端末に保存した音を消す</button></div>'
       '<details class="help"><summary>ⓘ 詳しく</summary><p class="micro">軽量は MP3（約175kbps）で、高音質（FLAC）の約1/10の通信量です。左右の広がりはそのままです。'
       '一度鳴らした音・写真・書体はこの端末に保存され、次からは通信なしで使えます（電波が弱い場所・機内でも、前に鳴らした音は鳴ります）。'
       'リールや録音の書き出しには、いま選んでいる音質の音が使われます。</p></details></section>')
once('<h2 class="stepTitle">設定と権利</h2></div></div><details class="scenePresets" id="rightsPanel" open>',
     '<h2 class="stepTitle">設定と権利</h2></div></div>' + NET + '<details class="scenePresets" id="rightsPanel" open>')
if 'id="devPanel"' not in t:
    a = t.index('<section id="sourceSection" class="sub">')
    b = t.index('</details></div>\n<div class="footer">', a) + len('</details>')
    t = (t[:a] + '<details id="devPanel" class="sub"><summary><span>詳しい情報（確認・開発用）</span><span class="micro">音源の形式 · 監査 · DB · 診断 ▾</span></summary>'
         + t[a:b] + '</details>' + t[b:])

# ── 5. プランの比較表は畳む（料金のカードは見せたまま）── src_studio.js の buildPlans 側で行う

# ── 6. 端末に保存する仕組み（Service Worker）──
shutil.copyfile(P('build/src_sw.js'), P('sw.js'))

open(P('index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t))
