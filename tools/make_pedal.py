#!/usr/bin/env python3
"""ペダルで遊ぶ縦動画（リール・ショート共用：1080×1920・約22秒・H.264/AAC）を作る。シリーズ名 NATURE × PEDALS。
2026-11-28 オーナー「リール、ショート動画類はエフェクター、ルーパー類使って音色変えて遊ぶ動画欲しい。どのエフェクター使ってるか、うるさすぎないかなどに配慮して組み合わせてみて」。
- 1本＝実録音1件。最初の約2.5秒は元の音だけ → ペダル（とルーパー）を1台ずつ足していく。画面に、いま鳴っているペダルの名前とつまみの値を出す。
- 音は公開アプリのペダルそのもの（tools/render_pedal.js が index.html の window.__pedals.makePedal を OfflineAudioContext で鳴らす）。
- うるささへの配慮：
  - 組み合わせは耳に痛くなりにくいもの（残響・ディレイ・テープ・コーラス・フィルター・オクターブ）だけ。歪み・ファズ・ビットクラッシャー・リングモジュレーターは使わない。
  - ペダルを足した区間は、元の録音の音量にそろえる（±6 dB まで。render_pedal.js）。最後に −16 LUFS・トゥルーピーク −1.5 dB にそろえる。
  - 区間ごとの音量の差を qa に残す（pedal_qa.json）。元の音だけの区間より 4 dB 以上大きい区間があれば作り直しの対象。
- 使う録音は CC0・パブリックドメイン・CC BY だけ（BY-SA・NC は使わない）。英語名のない録音は使わない。画面と説明欄に帰属表示を入れる。
- 効能はうたわない。メーカーの名前・見た目は使わない（ペダルは種類の名前だけ。絵も汎用の箱）。
使い方（アプリ本体 sawwaudio/audio-ecosystem のフォルダで python3 -m http.server 8765 を起動し、直下に audio-ecosystem-sounds-1 をリンクしてから）：
  python3 tools/make_pedal.py --app ../audio-ecosystem/index.html --out <出力フォルダ> --start 2026-12-03 --days 3 [--recipe loop-echo] [--rec <録音id>]
"""
import argparse, datetime, json, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; FR = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
URL = 'sawwaudio.github.io/audio-ecosystem'
W, H, FPS = 1080, 1920, 30
# 組み合わせ（耳に痛くなりにくいものだけ）。t＝足す時刻（秒）。show＝画面に出すつまみ
RECIPES = {
    'echo-garden': {'cats': ['birds'], 'title': 'Echo garden', 'steps': [
        {'t': 2.5, 'id': 'memorydelay', 'v': {'mode': 1, 'mix': 40, 'repeats': 35}, 'show': ['repeats', 'mix']},
        {'t': 8.0, 'id': 'reverb', 'v': {'type': 4, 'decay': 6, 'mix': 38}, 'show': ['type', 'decay', 'mix']},
        {'t': 13.5, 'id': 'tape', 'v': {'wow': 35, 'flutter': 20, 'age': 30, 'drop': 5}, 'show': ['wow', 'age']}]},
    'low-choir': {'cats': ['amphibians', 'insects'], 'title': 'Low choir', 'steps': [
        {'t': 2.5, 'id': 'octave', 'v': {'sub': 55, 'up': 0, 'dry': 85}, 'show': ['sub', 'dry']},
        {'t': 8.0, 'id': 'chorus', 'v': {'type': 2, 'rate': 0.5, 'mix': 45}, 'show': ['type', 'rate', 'mix']},
        {'t': 13.5, 'id': 'reverb', 'v': {'type': 1, 'decay': 5, 'mix': 35}, 'show': ['type', 'decay', 'mix']}]},
    'loop-echo': {'cats': ['birds', 'insects', 'amphibians', 'mammals'], 'title': 'Loop & echo', 'looper': {'at': 2.5, 'len': 2.0, 'bed': 0.35}, 'steps': [
        {'t': 8.0, 'id': 'pitchdelay', 'v': {'interval': 7, 'time': 380, 'repeats': 35, 'mix': 35}, 'show': ['interval', 'time', 'mix']},
        {'t': 13.5, 'id': 'reverb', 'v': {'type': 6, 'decay': 7, 'mix': 35}, 'show': ['type', 'decay', 'mix']}]},
    'tide-sweep': {'cats': ['ambience', 'aquatic'], 'title': 'Slow sweep', 'steps': [
        {'t': 2.5, 'id': 'filter', 'v': {'type': 0, 'cutoff': 1400, 'reso': 3, 'rate': 0.12, 'depth': 60}, 'show': ['cutoff', 'rate']},
        {'t': 8.0, 'id': 'tremolo', 'v': {'shape': 2, 'rate': 2.5, 'depth': 40}, 'show': ['shape', 'rate', 'depth']},
        {'t': 13.5, 'id': 'reverb', 'v': {'type': 2, 'decay': 4, 'mix': 30}, 'show': ['type', 'decay', 'mix']}]},
    'tape-memory': {'cats': ['ambience', 'birds', 'aquatic'], 'title': 'Tape memory', 'looper': {'at': 3.0, 'len': 2.5, 'bed': 0.4}, 'steps': [
        {'t': 8.0, 'id': 'reversedelay', 'v': {'len': 0.8, 'fb': 30, 'mix': 35}, 'show': ['len', 'mix']},
        {'t': 13.5, 'id': 'tape', 'v': {'wow': 40, 'flutter': 25, 'age': 45, 'drop': 8}, 'show': ['wow', 'age']}]},
}
HARSH = {'distortion', 'fuzz', 'bitcrush', 'ringmod', 'overdrive', 'dualdrive', 'glitch', 'stutter'}
ap = argparse.ArgumentParser(); ap.add_argument('--app', required=True); ap.add_argument('--out', required=True); ap.add_argument('--start', required=True)
ap.add_argument('--days', type=int, default=1); ap.add_argument('--sec', type=float, default=22); ap.add_argument('--url', default='http://localhost:8765/index.html?lang=en')
ap.add_argument('--recipe', default=''); ap.add_argument('--rec', default=''); ap.add_argument('--version', type=int, default=1)
a = ap.parse_args()
h = open(a.app, encoding='utf-8').read(); appdir = os.path.dirname(os.path.abspath(a.app))
blk = lambda i: json.loads(re.search(r'id="%s">(.*?)</script>' % i, h, re.S).group(1))
recs = {r['id']: r for r in blk('ae-recordings')}; cat = blk('ae-categories')['categories']; man = blk('ae-audio-manifest')['recordings']; meta = blk('ae-wildlife-meta')
DEF = json.load(open(os.path.join(appdir, 'build', 'pedals_def.json'), encoding='utf-8'))['pedals']
for R_ in RECIPES.values(): assert not ({s['id'] for s in R_['steps']} & HARSH)
HP = os.path.join(ROOT, 'tools', 'pedal_history.json'); hist = json.load(open(HP, encoding='utf-8')) if os.path.exists(HP) else []
used = {x['id'] for x in hist}
for f in ('daily_history.json', 'calm_history.json'):
    p = os.path.join(ROOT, 'tools', f); used |= {x['id'] for x in (json.load(open(p, encoding='utf-8')) if os.path.exists(p) else [])[-14:]}  # 直近2週間の毎日動画・CALM と同じ音は避ける
def allowed(r):
    L = r['license']; return (L.startswith('CC0') or L == 'Public domain' or L.startswith('CC BY ')) and 'SA' not in L and 'NC' not in L
def src(i):
    try: e = man[i]; return os.path.normpath(os.path.join(appdir, (e.get('pcm') or e['compat'])['parts'][0]['path']))
    except Exception: return None
WATERY = re.compile(r'rain|stream|river|brook|creek|wave|sea|ocean|surf|tide|water|forest|wind|bamboo|waterfall|lake|pond', re.I)  # 環境音は自然の水・森・風だけ（街の音は使わない）
def cand(c): return sorted(i for i, r in recs.items() if cat.get(i, {}).get('cat') == c and (c != 'ambience' or WATERY.search((meta.get(i) or {}).get('en') or '')) and allowed(r) and i not in used and (r.get('embeddedDuration') or 0) >= a.sec + 2 and src(i) and os.path.exists(src(i)) and (meta.get(i) or {}).get('en'))
def decode(p, sr=16000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout; return np.frombuffer(raw, np.float32)
def pick_start(i):
    # 最初の 2.5 秒（元の音だけの区間）で何の音か分かるように、出だしが静かすぎない位置を選ぶ
    x = decode(src(i)); sr = 16000; dur = len(x) / sr; best, bs = 0.0, -1
    for s in np.arange(0, max(0.01, dur - a.sec - 0.5), 0.5):
        h1 = x[int(s * sr):int((s + 2.5) * sr)]; w = x[int(s * sr):int((s + a.sec) * sr)]
        if len(w) < a.sec * sr * 0.95: break
        sc = min(np.sqrt((h1 ** 2).mean()), np.sqrt((w ** 2).mean()) * 1.2)
        if sc > bs: bs, best = sc, float(s)
    return best
fb = lambda n: ImageFont.truetype(FB, n); fr = lambda n: ImageFont.truetype(FR, n)
def fmt(pid, k, v):
    d = DEF[pid]
    if d.get('steps') and d['steps']['k'] == k:
        st = d['steps']; labs = st.get('labels')
        if labs: return st['l'][1], labs[st['opts'].index(v)][1]
        return st['l'][1], (f'+{v}' if v > 0 else str(v)) + ' st'
    kn = next(x for x in d['knobs'] if x['k'] == k); u = kn.get('u', '')
    val = (f'{v:.2f}'.rstrip('0').rstrip('.') if isinstance(v, float) else str(v)) + ('' if not u else (' ' + u if u not in ('%',) else u))
    return kn['l'][1], val
def frac(pid, k, v):
    d = DEF[pid]
    if d.get('steps') and d['steps']['k'] == k: o = d['steps']['opts']; return o.index(v) / max(1, len(o) - 1)
    kn = next(x for x in d['knobs'] if x['k'] == k)
    if kn.get('log'): return math.log(v / kn['min']) / math.log(kn['max'] / kn['min'])
    return (v - kn['min']) / (kn['max'] - kn['min'])
def wrap(d, text, font, maxw):
    out, line = [], ''
    for w in text.split(' '):
        t = (line + ' ' + w).strip()
        if d.textlength(t, font=font) <= maxw: line = t
        else: out.append(line); line = w
    out.append(line); return out
HUE = {'birds': (232, 196, 122), 'insects': (170, 214, 120), 'amphibians': (120, 210, 170), 'mammals': (214, 160, 120), 'aquatic': (110, 180, 230), 'ambience': (160, 190, 220)}
def build(day, rid, rk):
    r = recs[rid]; m = meta.get(rid) or {}; en = re.sub(r'\s+\d+$', '', m.get('en') or rid); jp = r['jp']; c = cat[rid]['cat']; rc = RECIPES[rk]; acc = HUE.get(c, (230, 200, 130))
    od = os.path.join(a.out, f'{day}_pedal_{rid}'); os.makedirs(od, exist_ok=True)
    st = pick_start(rid)
    job = {'url': a.url, 'rec': rid, 'start': st, 'sec': a.sec, 'fade': 1.5, 'looper': rc.get('looper'), 'steps': [{'t': s['t'], 'id': s['id'], 'v': s['v']} for s in rc['steps']]}
    jp_ = os.path.join(od, 'job.json'); json.dump(job, open(jp_, 'w'), ensure_ascii=False)
    env = dict(os.environ, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip())
    res = json.loads(subprocess.run(['node', os.path.join(ROOT, 'tools', 'render_pedal.js'), jp_, os.path.join(od, 'raw.wav')], capture_output=True, text=True, check=True, env=env).stdout.strip().splitlines()[-1])
    if res.get('errors'): raise SystemExit('page errors: ' + '; '.join(res['errors']))
    # 2回のラウドネス合わせ（−16 LUFS・TP −1.5）
    m1 = subprocess.run(['ffmpeg', '-hide_banner', '-i', os.path.join(od, 'raw.wav'), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(m1[m1.rindex('{'):m1.rindex('}') + 1]); wav = os.path.join(od, 'audio.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(od, 'raw.wav'), '-af', f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true", '-ar', '48000', wav], check=True)
    x = decode(wav, 48000); sr = 48000
    # 区間ごとの音量（元の音だけの区間との差）
    mk = res['marks']; segdb = []
    for i in range(len(mk) - 1):
        w = x[int((mk[i] + (0.6 if i else 0.2)) * sr):int(mk[i + 1] * sr)]; segdb.append(round(20 * math.log10(max(1e-6, float(np.sqrt((w ** 2).mean())))), 1))
    louder = max(segdb[1:]) - segdb[0] if len(segdb) > 1 else 0
    # 画面に出すペダル（ルーパーを先頭に）
    st_list = ([{'t': rc['looper']['at'], 'id': 'looper', 'len': rc['looper']['len']}] if rc.get('looper') else []) + rc['steps']
    # 音の解析（コマごとの音量とスペクトル）
    nb = 40; edges = np.geomspace(60, 12000, nb + 1); N = 2048; fq = np.fft.rfftfreq(N, 1 / sr); win = np.hanning(N)
    nfr = int(a.sec * FPS); lv = np.zeros(nfr); sp = np.zeros((nfr, nb))
    for f in range(nfr):
        c0 = int(f / FPS * sr); seg = x[max(0, c0 - N // 2):c0 + N // 2]
        if len(seg) < N: seg = np.pad(seg, (0, N - len(seg)))
        lv[f] = np.sqrt((seg ** 2).mean()); S = np.abs(np.fft.rfft(seg * win))
        sp[f] = [S[(fq >= edges[k]) & (fq < edges[k + 1])].mean() if ((fq >= edges[k]) & (fq < edges[k + 1])).any() else 0 for k in range(nb)]
    sp = np.log10(1 + sp * 40); sp /= max(1e-6, np.percentile(sp, 99)); sp = np.clip(sp, 0, 1)
    for f in range(1, nfr): sp[f] = np.maximum(sp[f], sp[f - 1] * 0.82); lv[f] = max(lv[f], lv[f - 1] * 0.9)
    lv = lv / max(1e-6, np.percentile(lv, 98))
    # 動かない部分（背景・見出し・クレジット）は1枚だけ描く
    base = Image.new('RGB', (W, H), (13, 19, 16)); bd = ImageDraw.Draw(base)
    glow = Image.new('RGB', (W, H), (0, 0, 0)); gd = ImageDraw.Draw(glow); gd.ellipse((-200, 380, W + 200, 1500), fill=tuple(int(v * .22) for v in acc)); glow = glow.filter(ImageFilter.GaussianBlur(160))
    base = Image.blend(base, Image.new('RGB', (W, H), (0, 0, 0)), 0); base = Image.fromarray(np.clip(np.asarray(base, np.int16) + np.asarray(glow, np.int16), 0, 255).astype(np.uint8)); bd = ImageDraw.Draw(base)
    bd.text((W // 2, 150), 'NATURE × PEDALS', font=fb(34), fill=(169, 193, 182), anchor='mm')
    y = 205
    for ln in wrap(bd, en, fb(62), 900)[:2]: bd.text((W // 2, y), ln, font=fb(62), fill=(255, 255, 255), anchor='ma'); y += 76
    bd.text((W // 2, y + 6), jp, font=fr(32), fill=(200, 214, 206), anchor='ma')
    bd.text((W // 2, y + 64), 'A real field recording, played through the pedals in the SAE app', font=fr(28), fill=(169, 193, 182), anchor='ma')
    cred = f'Recording: {r["author"]} · {r["license"]}'
    bd.text((60, 1560), cred if bd.textlength(cred, font=fr(30)) < 940 else cred[:52] + '…', font=fr(30), fill=(223, 233, 227))
    bd.text((60, 1606), f'Pedals: SAE app (Web Audio) · {URL}', font=fr(24), fill=(169, 193, 182))
    top = y + 140; n = len(st_list); ch = 160; gap = 24; x0, x1 = 110, 970
    def card(d, i, s, on, fade, t):
        yy = top + i * (ch + gap); col = tuple(int(30 + (v - 30) * .9 * fade) if on else 34 for v in (40, 52, 46))
        bc = tuple(int(70 + (v - 70) * fade) for v in acc) if on else (70, 84, 78)
        d.rounded_rectangle((x0, yy, x1, yy + ch), 22, fill=col, outline=bc, width=3)
        led = (x0 + 44, yy + 44); lc = tuple(int(50 + (v - 50) * fade) for v in (255, 92, 72)) if on else (60, 44, 42)
        d.ellipse((led[0] - 13, led[1] - 13, led[0] + 13, led[1] + 13), fill=lc)
        if s['id'] == 'looper':
            name, jn = 'Looper', 'ルーパー'; knobs = [('Loop', f"{s['len']:.1f} s", None)]
        else:
            name, jn = DEF[s['id']]['name'][1], DEF[s['id']]['name'][0]; knobs = [fmt(s['id'], k, s['v'][k]) + (frac(s['id'], k, s['v'][k]),) for k in s['show']]
        d.text((x0 + 76, yy + 22), name, font=fb(40), fill=(255, 255, 255) if on else (150, 166, 158)); d.text((x0 + 78, yy + 76), jn, font=fr(26), fill=(190, 204, 196) if on else (120, 134, 128))
        kx = x1 - 30 - 130 * len(knobs)
        for j_, (lab, val, fr_) in enumerate(knobs):
            cx, cy = kx + j_ * 130 + 65, yy + 58; d.ellipse((cx - 30, cy - 30, cx + 30, cy + 30), fill=(24, 30, 27), outline=(120, 136, 128) if not on else bc, width=3)
            if fr_ is None:  # ルーパー：一周の進み具合
                ph = ((t - s['t']) % s['len']) / s['len'] if on else 0; d.arc((cx - 30, cy - 30, cx + 30, cy + 30), -90, -90 + 360 * ph, fill=bc, width=6)
            else:
                ang = math.radians(225 - 270 * max(0, min(1, fr_))); d.line((cx, cy, cx + 22 * math.cos(ang), cy - 22 * math.sin(ang)), fill=(255, 255, 255) if on else (150, 160, 155), width=5)
            d.text((cx, cy + 38), val, font=fb(25), fill=(235, 240, 237) if on else (140, 150, 145), anchor='ma'); d.text((cx, cy + 68), lab, font=fr(19), fill=(170, 186, 178) if on else (110, 122, 116), anchor='ma')
        if i < n - 1: d.line((W // 2, yy + ch, W // 2, yy + ch + gap), fill=(90, 104, 98), width=4)
    tmpv = os.path.join(od, 'video.mp4')
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', wav, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', tmpv], stdin=subprocess.PIPE)
    by = top + n * (ch + gap) + 20; bh = 1530 - by
    for f in range(nfr):
        t = f / FPS; im = base.copy(); d = ImageDraw.Draw(im)
        for i, s in enumerate(st_list):
            on = t >= s['t']; card(d, i, s, on, min(1, (t - s['t']) / 0.35) if on else 0, t)
        # いま足したペダル（1.6 秒だけ）
        for s in st_list:
            if 0 <= t - s['t'] < 1.6:
                al_ = min(1, (t - s['t']) / .25, (1.6 - (t - s['t'])) / .3); nm = 'Looper' if s['id'] == 'looper' else DEF[s['id']]['name'][1]
                d.text((W // 2, by + 10), '+ ' + nm, font=fb(44), fill=tuple(int(v * al_ + 13 * (1 - al_)) for v in acc), anchor='ma')
        if t < 2.5: d.text((W // 2, by + 10), 'Dry — the recording alone', font=fr(34), fill=(200, 214, 206), anchor='ma')
        # スペクトルのバー（光の急な変化を作らない：バーの明るさは一定、高さだけ動く）
        bw = (x1 - x0) / nb; yb = 1520
        for k in range(nb):
            hh = 8 + sp[f, k] * (bh - 90); d.rounded_rectangle((x0 + k * bw + 3, yb - hh, x0 + (k + 1) * bw - 3, yb), 4, fill=acc)
        p.stdin.write(im.tobytes())
    p.stdin.close(); p.wait()
    q = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'reels', 'qa.py'), tmpv], capture_output=True, text=True); qa = json.load(open(os.path.join(od, 'qa.json'))) if os.path.exists(os.path.join(od, 'qa.json')) else {'out': q.stdout[-400:]}
    pq = {'segments_db': segdb, 'loudest_vs_dry_db': round(louder, 1), 'ok_loudness': louder < 4.0, 'render': res, 'start': st}
    json.dump(pq, open(os.path.join(od, 'pedal_qa.json'), 'w'), ensure_ascii=False, indent=1)
    used_names = ['Looper (2 s)' if s['id'] == 'looper' else DEF[s['id']]['name'][1] for s in st_list]
    def setting(s):
        if s['id'] == 'looper': return f"Looper — loop {s['len']:.1f} s / ルーパー（{s['len']:.1f}秒をすくって繰り返し）"
        return DEF[s['id']]['name'][1] + ' — ' + ', '.join(' '.join(fmt(s['id'], k, s['v'][k])) for k in s['show']) + ' / ' + DEF[s['id']]['name'][0]
    loc = ' · '.join(x_ for x_ in [m.get('recordedArea'), m.get('recordedCountry')] if x_) or r.get('location') or ''
    cap = f"""[YouTube Shorts title]
{en} through {len(st_list)} pedals | Nature × Pedals #Shorts

[Caption — Instagram and YouTube]
A real field recording of {en}, then played through the pedals in the SAE app, one at a time: {' → '.join(used_names)}.
The first seconds are the recording alone. Levels are matched, so it never jumps out louder than the original.

Pedal settings:
""" + '\n'.join('• ' + setting(s) for s in st_list) + f"""

Try the same pedals on any of the real recordings:
https://{URL}/

{jp}の実録音を、SAE アプリのペダルに1台ずつ通しました（{' → '.join('ルーパー' if s['id'] == 'looper' else DEF[s['id']]['name'][0] for s in st_list)}）。最初の数秒は録音そのままの音です。ペダルを足しても、元の音より大きくならないように音量をそろえています。

— Recording credit / 録音クレジット —
{r.get('title') or en} — {r['author']} / {r['license']} {r.get('licenseURL') or ''}
Source / 出典: {r.get('url') or ''}
Location / 録音地: {loc or '記載なし'}
Changes / 加工: excerpt ({st:.1f}–{st + a.sec:.1f} s), looped and processed with the SAE app's pedals (settings above), loudness matched, fades, visual added / 抜粋・ルーパーとペダルによる加工（上の設定）・音量の調整・フェード・映像の追加
All credits / 全クレジット: https://{URL}/credits.html

#saww #sawwaudioecosystem #natureasaninstrument #fieldrecording #guitarpedals #effectspedal #looper #ambient #soundscape #自然音 #エフェクター
"""
    open(os.path.join(od, 'caption.txt'), 'w', encoding='utf-8').write(cap)
    for f_ in ('raw.wav',): os.remove(os.path.join(od, f_))
    out = os.path.join(od, f'saww_pedal_{day}_{rid}.mp4'); os.replace(tmpv, out)
    hist.append({'date': day, 'id': rid, 'series': 'pedal', 'pattern': 'pedal-' + rk, 'version': a.version, 'recipe': rk, 'pedals': [s['id'] for s in st_list], 'cat': c, 'sec': a.sec, 'start': st,
                 'loudest_vs_dry_db': round(louder, 1), 'license': r['license'], 'author': r['author'], 'file': os.path.basename(out)})
    json.dump(hist, open(HP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('made', out, 'qa', qa.get('ok'), qa.get('problems'), 'louder_vs_dry', round(louder, 1), flush=True)
d0 = datetime.date.fromisoformat(a.start); keys = list(RECIPES)
for n in range(a.days):
    day = (d0 + datetime.timedelta(days=n)).isoformat()
    rk = a.recipe or keys[(len(hist)) % len(keys)]
    if a.rec: rid = a.rec
    else:
        pool = [i for c in RECIPES[rk]['cats'] for i in cand(c)]
        if not pool: print('no recording for', rk); continue
        rid = pool[int(__import__('hashlib').md5(day.encode()).hexdigest(), 16) % len(pool)]
    build(day, rid, rk); used.add(rid)
