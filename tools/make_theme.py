#!/usr/bin/env python3
"""テーマのリール（Instagram リール・YouTube ショート共用：1080×1920・24秒）。
テーマ（日本の夏・海など）に沿って、複数の実録音と実録音の楽器（VCSL・CC0）を重ねて鳴らし、音から映像を描く。2026-11-14 オーナー指示。
- 録音は CC0・パブリックドメイン・CC BY だけ（BY-SA・NC・World Voices は使わない）。使う録音はテーマ表に ID で固定し、推測で差し替えない。
- 楽器はすべて C#（ディジュリドゥの基音 約69Hz）に合わせる。C の楽器は半音上げる。
- 映像は毎日動画と同じ（render_visual.js のシェーダー＋specimen_mask.py の標本）。
使い方：python3 tools/make_theme.py --app ../audio-ecosystem-sounds-1/index.html --out <出力フォルダ> [--theme japan-summer ...]
"""
import argparse, hashlib, json, os, re, subprocess, sys, textwrap
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; R = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
URL = 'sawwaudio.github.io/audio-ecosystem-sounds-1'
SEMI = 2 ** (1 / 12)
# 楽器：(ファイル, 半音) — 半音 1 は C→C#
INST = {
    'glock': ('Glockenspiel', [('vcsl_glock_medium_C5_01.flac', 1), ('vcsl_glock_medium_G5_01.flac', 1), ('vcsl_glock_medium_C6_01.flac', 1), ('vcsl_glock_medium_G4_01.flac', 1)]),
    'bells': ('Tubular bells', [('vcsl_TB_hit_C4_v2_1.flac', 1), ('vcsl_TB_hit_G4_v2_1.flac', 1), ('vcsl_TB_hit_E4_v2_1.flac', 1), ('vcsl_TB_hit_C5_v2_1.flac', 1)]),
    'psaltery': ('Bowed psaltery', [('vcsl_BowedPsaltery_C4_Main_LongBow_rr1.flac', 1), ('vcsl_BowedPsaltery_E4_Main_LongBow_rr2.flac', 1), ('vcsl_BowedPsaltery_C5_Main_LongBow_rr1.flac', 1)]),
    'marimba': ('Marimba', [('vcsl_Marimba_hit_Outrigger_C4_med_01.flac', 1), ('vcsl_Marimba_hit_Outrigger_F3_med_01.flac', 1), ('vcsl_Marimba_hit_Outrigger_C6_med_01.flac', 1), ('vcsl_Marimba_hit_Outrigger_F5_med_01.flac', 1)]),
    'mbira': ('Mbira', [('vcsl_Mbira6_Normal_MainSpirit_Cs4_k2_vl3_rr2.flac', 0), ('vcsl_Mbira6_Normal_MainSpirit_Fs4_k14_vl3_rr2.flac', 0), ('vcsl_Mbira6_Normal_MainSpirit_Ds4_k13_vl3_rr2.flac', 0), ('vcsl_Mbira6_Normal_MainSpirit_B3_k3_vl3_rr2.flac', 0)]),
    'gong': ('Gong', [('vcsl_gong_p.flac', 0)]),
}
THEMES = {
    'japan-summer': dict(en='Japanese summer', jp='日本の夏', fields=['tokyo-park-cicadas', 'higurashi', 'bamboo-stream', 'yukinoura-bamboo'], inst='glock', style='contour', hue=40),
    'the-sea': dict(en='The sea', jp='海', fields=['waves-big-lagoon', 'rock-tide-northumberland', 'humpback', 'snapping-shrimp'], inst='bells', style='flow', hue=200, gong=True),
    'rain-night-japan': dict(en='A rainy night in Japan', jp='日本の雨の夜', fields=['kyoto-rain', 'ricefield-frogs', 'kashiwa-insects'], inst='psaltery', style='flow', hue=230),
    'rivers-of-japan': dict(en='Rivers of Japan', jp='日本の川', fields=['takayama-river', 'yamanushi-river', 'fujinomiya-forest-birds', 'uguisu-yokohama'], inst='marimba', style='geometry', hue=150),
    'frog-night': dict(en='Frog night, around the world', jp='世界のカエルの夜', fields=['ricefield-frogs', 'malaysian-frogs', 'brazil-frog-chorus', 'pacific-treefrog-chorus'], inst='mbira', style='geometry', hue=110),
    'dawn-chorus': dict(en='Dawn chorus', jp='夜明けの合唱', fields=['dawn-chorus-ashdown', 'fujinomiya-forest-birds', 'dawn-chorus-provence', 'birds-stream-paris'], inst='bells', style='contour', hue=30),
    'amazon-night': dict(en='Amazon night', jp='アマゾンの夜', fields=['amazon-night-jungle', 'titi-monkeys-tefe', 'amazon-river-dolphins'], inst='mbira', style='flow', hue=170),
}
ap = argparse.ArgumentParser(); ap.add_argument('--app', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--theme', nargs='*', default=list(THEMES)); ap.add_argument('--sec', type=float, default=24); ap.add_argument('--audio-only', action='store_true')
a = ap.parse_args()
h = open(a.app, encoding='utf-8').read(); appdir = os.path.dirname(os.path.abspath(a.app))
blk = lambda i: json.loads(re.search(r'id="%s">(.*?)</script>' % i, h, re.S).group(1))
recs = {r['id']: r for r in blk('ae-recordings')}; man = blk('ae-audio-manifest')['recordings']; meta = blk('ae-wildlife-meta')
def allowed(r):
    L = r['license']; return (L.startswith('CC0') or L == 'Public domain' or L.startswith('CC BY ')) and 'SA' not in L and 'NC' not in L
def src(i): return os.path.normpath(os.path.join(appdir, man[i]['pcm']['parts'][0]['path']))
def run(cmd): subprocess.run(cmd, check=True)
al = lambda s, e: f"if(lt(t,{s}),0,if(lt(t,{s+0.6}),(t-{s})/0.6,if(lt(t,{e-0.6}),1,if(lt(t,{e}),({e}-t)/0.6,0))))"
cut = lambda s, n: s if len(s) <= n else s[:n - 1] + '…'
P = lambda n: os.path.join(appdir, 'instruments', 'pcm', n)
S = a.sec
for key in a.theme:
    T = THEMES[key]; od = os.path.join(a.out, key); os.makedirs(od, exist_ok=True)
    for i in T['fields']:
        r = recs[i]
        if not allowed(r): sys.exit(f'{i}: ライセンス {r["license"]} は使えない')
        if not os.path.exists(src(i)): sys.exit(f'{i}: 音源ファイルがない')
    seed = int(hashlib.sha1(key.encode()).hexdigest(), 16)
    # ── 音 ──
    fc, labs, files = [], [], []
    def add(path, ss=None, loop=False):
        files.append((path, ss, loop)); return len(files) - 1
    n = len(T['fields']); entry = [0, 3.5, 7, 10.5][:n]
    for k, i in enumerate(T['fields']):
        dur = float(recs[i].get('embeddedDuration') or 0); ss = max(0, min(2.0, dur - (S - entry[k]) - .2))
        x = add(src(i), ss, loop=dur < S - entry[k] + 1)
        pan = [0, -.35, .35, -.15][k]
        fc.append(f'[{x}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{S-entry[k]},asetpts=PTS-STARTPTS,highpass=f=90,loudnorm=I={-24 if k == 0 else -26}:TP=-4,'
                  f'stereotools=balance_out={pan},afade=t=in:d=2.5,adelay={int(entry[k]*1000)}|{int(entry[k]*1000)},apad,atrim=0:{S}[f{k}]'); labs.append(f'[f{k}]')
    # ディジュリドゥ（持続音を2つつなぐ）とオルガンのペダル（C#1）
    d1 = add(P('vcsl_Didgeridoo1_Sus2_Main.flac')); d2 = add(P('vcsl_Didgeridoo1_Sus8_Main.flac')); org = add(P('vcsl_NT5_PedalQuiet_C1_rr1.flac')); org2 = add(P('vcsl_NT5_PedalQuiet_C1_rr1.flac'))
    fc.append(f'[{d1}:a]aresample=48000,aformat=channel_layouts=stereo[da];[{d2}:a]aresample=48000,aformat=channel_layouts=stereo[db];'
              f'[da][db]acrossfade=d=2:c1=tri:c2=tri,loudnorm=I=-20:TP=-3,afade=t=in:d=3,adelay=2000|2000,apad,atrim=0:{S}[dg]'); labs.append('[dg]')
    fc.append(f'[{org}:a]asetrate={44100*SEMI:.1f},aresample=48000,aformat=channel_layouts=stereo[oa];[{org2}:a]asetrate={44100*SEMI:.1f},aresample=48000,aformat=channel_layouts=stereo[ob];'
              f'[oa][ob]acrossfade=d=3:c1=tri:c2=tri,lowpass=f=220,loudnorm=I=-26:TP=-6,afade=t=in:d=3,adelay=5000|5000,apad,atrim=0:{S}[og]'); labs.append('[og]')
    # 旋律の楽器：まばらに（5〜19秒）
    name, notes = INST[T['inst']]
    times = [5.0, 7.5, 9.0, 11.5, 13.0, 15.5, 17.0, 19.0]; pat = [0, 1, 2, 1, 3 % len(notes), 0, 2 % len(notes), 1]
    for j, tt in enumerate(times):
        f_, st = notes[(pat[j] + seed) % len(notes)]; x = add(P(f_))
        rate = f'asetrate={44100*SEMI**st:.1f},' if st else ''
        pan = [-.4, .3, -.1, .45, -.3, .2, -.45, .1][j]
        fc.append(f'[{x}:a]{rate}aresample=48000,aformat=channel_layouts=stereo,atrim=0:6,loudnorm=I=-27:TP=-6,stereotools=balance_out={pan},afade=t=out:st=4:d=2,'
                  f'adelay={int(tt*1000)}|{int(tt*1000)},apad,atrim=0:{S}[n{j}]'); labs.append(f'[n{j}]')
    if T.get('gong'):
        x = add(P('vcsl_gong_p.flac')); fc.append(f'[{x}:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-28:TP=-8,adelay=1500|1500,apad,atrim=0:{S}[gg]'); labs.append('[gg]')
    fc.append(f'{"".join(labs)}amix=inputs={len(labs)}:normalize=0:duration=longest,atrim=0:{S},loudnorm=I=-15:TP=-1.5,afade=t=in:d=0.5,afade=t=out:st={S-1.5}:d=1.5[out]')
    cmd = ['ffmpeg', '-v', 'error', '-y']
    for path, ss, loop in files: cmd += (['-stream_loop', '-1'] if loop else []) + (['-ss', str(ss)] if ss else []) + ['-i', path]
    wav = os.path.join(od, 'audio.wav'); fcp = os.path.join(od, 'af.txt'); open(fcp, 'w').write(';'.join(fc))
    run(cmd + ['-filter_complex_script', fcp, '-map', '[out]', '-ar', '48000', '-ac', '2', wav])
    if a.audio_only: print('audio', wav, flush=True); continue
    # ── 映像 ──
    base = os.path.join(od, 'base.mp4')
    if not os.path.exists(base): run(['node', os.path.join(ROOT, 'tools', 'render_visual.js'), '--audio', wav, '--app', a.app, '--out', base, '--size', '1080x1920', '--plan', f'{T["style"]}:{S}', '--hue', str(T['hue'])])
    mask = os.path.join(od, 'mask.mp4'); rim = os.path.join(od, 'rim.mp4')
    if not os.path.exists(mask): run([sys.executable, os.path.join(ROOT, 'tools', 'specimen_mask.py'), '--audio', wav, '--out', mask, '--rim', rim, '--sec', str(S), '--seed', str(seed % 9973)])
    fs = []; tn = [0]
    def dt(txt, f, sz, x, y, alpha, col='0xf1ece0'):
        p = os.path.join(od, f't{tn[0]}.txt'); tn[0] += 1; open(p, 'w', encoding='utf-8').write(txt)
        fs.append(f"drawtext=fontfile={f}:textfile={p}:fontsize={sz}:fontcolor={col}:x={x}:y={y}:alpha='{alpha}':shadowcolor=black@0.7:shadowx=0:shadowy=2")
    E = S - .3
    dt('A SOUND JOURNEY · REAL RECORDINGS', R, 30, '(w-text_w)/2', 205, al(.4, E), '0xa9c1b6')
    dt(T['en'], B, 64 if len(T['en']) <= 18 else 50, '(w-text_w)/2', 255, al(.6, 16.6)); dt(T['jp'], R, 34, '(w-text_w)/2', 345, al(.6, 16.6), '0xa9c1b6')
    # 録音が入ってくるたびに、その録音名を小さく出す
    for k, i in enumerate(T['fields']):
        en = (meta.get(i) or {}).get('en') or recs[i]['jp']; t0 = entry[k] + .8
        dt(cut(en, 46), R, 30, '(w-text_w)/2', 1440, al(t0, min(t0 + 3.2, 16.4)), '0xdfe9e3')
    dt('Play these sounds yourself.', B, 56, '(w-text_w)/2', 225, al(17.0, E)); dt('saww audio ecosystem', B, 48, '(w-text_w)/2', 315, al(17.0, E)); dt(URL, R, 30, '(w-text_w)/2', 395, al(17.0, E), '0xa9c1b6')
    lic = sorted({recs[i]['license'] for i in T['fields']})
    dt(f'{n} field recordings · {" / ".join(lic)} · credits in caption', R, 26, 60, 1580, al(.4, E), '0xdfe9e3')
    dt(f'Didgeridoo, organ pedal, {name.lower()}: VCSL (Versilian Studios) · CC0 1.0', R, 24, 60, 1620, al(.4, E), '0xa9c1b6')
    vf = os.path.join(od, 'vf.txt'); out = os.path.join(od, f'saww_theme_{key}.mp4')
    open(vf, 'w').write(f'[0:v]eq=contrast=1.12:brightness=0.03,format=yuva420p[b];[1:v]scale=1080:1920:flags=bicubic,format=gray[m];[b][m]alphamerge[bm];'
                        f'[4:v]scale=1080:1920:flags=bicubic,gblur=sigma=1.1,format=gray[rm];[5:v]format=yuva420p[rc];[rc][rm]alphamerge[rg];'
                        f'[2:v][bm]overlay=shortest=1[x];[x][rg]overlay=shortest=1,' + ','.join(fs) + ',format=yuv420p[v]')
    run(['ffmpeg', '-v', 'error', '-y', '-i', base, '-i', mask, '-f', 'lavfi', '-i', f'color=black:s=1080x1920:r=30:d={S}', '-i', wav, '-i', rim,
         '-f', 'lavfi', '-i', f'color=0xf3e6d2:s=1080x1920:r=30:d={S}', '-filter_complex_script', vf, '-map', '[v]', '-map', '3:a', '-c:a', 'aac', '-b:a', '192k',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-maxrate', '10M', '-bufsize', '20M', '-movflags', '+faststart', out])
    # ── 説明文 ──
    cred = []
    for i in T['fields']:
        r = recs[i]; en = (meta.get(i) or {}).get('en') or ''
        cred.append(f"• {en} / {r['jp']} — {r.get('title') or en} — {r['author']} / {r['license']} {r.get('licenseURL') or ''}\n  Source / 出典: {r.get('url') or ''}  Location / 録音地: {r.get('location') or '記載なし'}")
    names = ', '.join((meta.get(i) or {}).get('en') or recs[i]['jp'] for i in T['fields'])
    cap = f"""[YouTube Shorts title]
{T['en']} — {n} real recordings, didgeridoo and {name.lower()} #Shorts

[Caption — Instagram and YouTube]
{T['en']}, made only from real sound: {names}.
Didgeridoo, a deep organ pedal and {name.lower()} — real instrument recordings — tuned together in C#. The visual is drawn from the sound itself.

Layer these sounds yourself and turn them into video. All features are free until Dec 31, 2026 (JST):
https://{URL}/

{T['jp']}。{n}つの実録音に、ディジュリドゥと低いオルガン、{ {'glock': 'グロッケンシュピール', 'bells': 'チューブラーベル', 'psaltery': 'ボウド・プサルタリー', 'marimba': 'マリンバ', 'mbira': 'ムビラ'}[T['inst']] }の実録音を重ねました（C#にそろえています）。映像は、この音そのものから描いています。
自分で重ねて、映像にできます（2026年12月31日まで全機能を無料開放中）。

— Recording credits / 録音クレジット —
""" + '\n'.join(cred) + f"""
Changes / 加工: excerpts, loudness adjusted, fades, panning, layered with each other and with instruments, visual added / 抜粋・音量の調整・フェード・定位・重ね合わせ・楽器とのミックス・映像の追加

Instruments / 楽器: Versilian Community Sample Library (VCSL) — Versilian Studios LLC / VCSL contributors / CC0 1.0 https://github.com/sgossner/VCSL (pitch-shifted to C#, layered / 音程の調整・重ね合わせ)
All credits / 全クレジット: https://sawwaudio.github.io/audio-ecosystem-sounds-1/credits.html

#saww #sawwaudioecosystem #natureasaninstrument #fieldrecording #soundscape #didgeridoo #ambientmusic #audiovisual #自然音 #フィールドレコーディング
"""
    open(os.path.join(od, 'caption.txt'), 'w', encoding='utf-8').write(cap)
    for f in os.listdir(od):
        if re.match(r't\d+\.txt|vf\.txt|af\.txt', f): os.remove(os.path.join(od, f))
    print('made', out, flush=True)
