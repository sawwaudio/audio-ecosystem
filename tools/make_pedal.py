#!/usr/bin/env python3
"""NATURE × PEDALS：実録音を、アプリのペダルとルーパーで音色を変えて遊ぶ縦動画（リール・ショート共用：1080×1920・22秒・H.264/AAC）。
2026-11-28 オーナー「リール、ショート動画類はエフェクター、ルーパー類使って音色変えて遊ぶ動画欲しい。どのエフェクター使ってるか、うるさすぎないかなどに配慮して組み合わせてみて」。
v2（同日「俯瞰して神改善できるか？」）で、ショートとして見られる形に作り直した：
- 台本（22秒）：0〜1.8 秒 AFTER（全部オン＝完成形を最初に聴かせる）→ 1.8 BEFORE（元の録音だけ）→ 4.4・8.8・13.2 秒で1台ずつ足す
  → 17.6 BYPASS（オフにして聴き比べ）→ 18.6 ON → 22 秒で全部オンのまま終わる（繰り返し再生で頭につながる）。
- 映像：背景はアプリの新しいリールテンプレート（Visual Engine 2.0。TEMPLATE LAB で継続が高かった life-earth・life-particle）を、加工後の音で動かす。
  手前に、つないだ順のペダル（汎用の箱。名前・つまみの値・ランプ・フットスイッチ）と、いまの状態（AFTER / BEFORE / + ペダル名 / BYPASS）。
- 説明欄の最初に、同じ録音を同じペダルでアプリで鳴らす共有リンク（#p=…）。聴く人 → 作る人 をつなぐ（Vision）。ルーパーはリンクに入らない。
- うるささへの配慮：
  - 組み合わせは耳に痛くなりにくいもの（残響・ディレイ・テープ・コーラス・フィルター・オクターブ・ルーパー）だけ。歪み・ファズ・ビットクラッシャー・リングモジュレーター・グリッチ・スタッターは使わない。
  - ペダルが入っている区間は、元の録音の音量にそろえる（render_pedal.js）。最後に −16 LUFS・トゥルーピーク −1.5 dB。
  - 区間ごとの音量を pedal_qa.json に残す。元の録音だけの区間より 4 dB 以上大きい区間があれば ok_loudness=false（作り直す）。
- 録音は CC0・パブリックドメイン・CC BY だけ（BY-SA・NC は使わない）。英語名のない録音は使わない。環境音は自然の水・森・風だけ。画面と説明欄に帰属表示。
- 効能はうたわない。メーカーの名前・見た目は使わない（ペダルは種類の名前、絵は汎用の箱）。
使い方（アプリ本体 sawwaudio/audio-ecosystem のフォルダで python3 -m http.server 8765 を起動し、直下に audio-ecosystem-sounds-1 をリンクしてから）：
  python3 tools/make_pedal.py --app ../audio-ecosystem/index.html --out <出力フォルダ> --start 2026-12-04 --days 7 [--recipe loop-echo] [--rec <録音id>] [--no-history]
"""
import argparse, datetime, hashlib, json, math, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; FR = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
URL = 'sawwaudio.github.io/audio-ecosystem'
W, H, FPS, SEC = 1080, 1920, 30, 22.0
# 組み合わせ（耳に痛くなりにくいものだけ。最大3台）。show＝画面に出すつまみ
RECIPES = {
    'echo-garden': {'cats': ['birds'], 'st': [
        {'id': 'memorydelay', 'v': {'mode': 1, 'mix': 40, 'repeats': 35}, 'show': ['repeats', 'mix']},
        {'id': 'reverb', 'v': {'type': 4, 'decay': 6, 'mix': 38}, 'show': ['type', 'decay']},
        {'id': 'tape', 'v': {'wow': 35, 'flutter': 20, 'age': 30, 'drop': 5}, 'show': ['wow', 'age']}]},
    'low-choir': {'cats': ['amphibians', 'insects'], 'st': [
        {'id': 'octave', 'v': {'sub': 55, 'up': 0, 'dry': 85}, 'show': ['sub', 'dry']},
        {'id': 'chorus', 'v': {'type': 2, 'rate': 0.5, 'mix': 45}, 'show': ['type', 'mix']},
        {'id': 'reverb', 'v': {'type': 1, 'decay': 5, 'mix': 35}, 'show': ['type', 'decay']}]},
    'loop-echo': {'cats': ['birds', 'insects', 'amphibians', 'mammals'], 'st': [
        {'id': 'looper', 'len': 2.0, 'bed': 0.35},
        {'id': 'pitchdelay', 'v': {'interval': 7, 'time': 380, 'repeats': 35, 'mix': 35}, 'show': ['interval', 'mix']},
        {'id': 'reverb', 'v': {'type': 6, 'decay': 7, 'mix': 35}, 'show': ['type', 'decay']}]},
    'tide-sweep': {'cats': ['ambience', 'aquatic'], 'st': [
        {'id': 'filter', 'v': {'type': 0, 'cutoff': 1400, 'reso': 3, 'rate': 0.12, 'depth': 60}, 'show': ['cutoff', 'rate']},
        {'id': 'tremolo', 'v': {'shape': 2, 'rate': 2.5, 'depth': 40}, 'show': ['shape', 'depth']},
        {'id': 'reverb', 'v': {'type': 2, 'decay': 4, 'mix': 30}, 'show': ['type', 'decay']}]},
    'tape-memory': {'cats': ['ambience', 'birds', 'aquatic'], 'st': [
        {'id': 'looper', 'len': 2.5, 'bed': 0.4},
        {'id': 'reversedelay', 'v': {'len': 0.8, 'fb': 30, 'mix': 35}, 'show': ['len', 'mix']},
        {'id': 'tape', 'v': {'wow': 40, 'flutter': 25, 'age': 45, 'drop': 8}, 'show': ['wow', 'age']}]},
}
HARSH = {'distortion', 'fuzz', 'bitcrush', 'ringmod', 'overdrive', 'dualdrive', 'glitch', 'stutter'}
# 台本：(時刻, オンにしておく台の数 or 'all' / 0)、画面の状態
SCRIPT = [(0.0, 'all', 'AFTER'), (1.8, 0, 'BEFORE'), (4.4, 1, '+'), (8.8, 2, '+'), (13.2, 3, '+'), (17.6, 0, 'BYPASS'), (18.6, 'all', 'ON')]
ap = argparse.ArgumentParser(); ap.add_argument('--app', required=True); ap.add_argument('--out', required=True); ap.add_argument('--start', required=True)
ap.add_argument('--days', type=int, default=1); ap.add_argument('--url', default='http://localhost:8765/index.html?lang=en')
ap.add_argument('--recipe', default=''); ap.add_argument('--rec', default=''); ap.add_argument('--version', type=int, default=2); ap.add_argument('--no-history', action='store_true')
a = ap.parse_args()
h = open(a.app, encoding='utf-8').read(); appdir = os.path.dirname(os.path.abspath(a.app))
blk = lambda i: json.loads(re.search(r'id="%s">(.*?)</script>' % i, h, re.S).group(1))
recs = {r['id']: r for r in blk('ae-recordings')}; cat = blk('ae-categories')['categories']; man = blk('ae-audio-manifest')['recordings']; meta = blk('ae-wildlife-meta')
DEF = json.load(open(os.path.join(appdir, 'build', 'pedals_def.json'), encoding='utf-8'))['pedals']
for R_ in RECIPES.values(): assert not ({s['id'] for s in R_['st']} & HARSH) and len(R_['st']) <= 3
HP = os.path.join(ROOT, 'tools', 'pedal_history.json'); hist = json.load(open(HP, encoding='utf-8')) if os.path.exists(HP) else []
used = {x['id'] for x in hist}
for f in ('daily_history.json', 'calm_history.json'):
    p = os.path.join(ROOT, 'tools', f); used |= {x['id'] for x in (json.load(open(p, encoding='utf-8')) if os.path.exists(p) else [])[-14:]}
def allowed(r):
    L = r['license']; return (L.startswith('CC0') or L == 'Public domain' or L.startswith('CC BY ')) and 'SA' not in L and 'NC' not in L
def src(i):
    try: e = man[i]; return os.path.normpath(os.path.join(appdir, (e.get('pcm') or e['compat'])['parts'][0]['path']))
    except Exception: return None
WATERY = re.compile(r'rain|stream|river|brook|creek|wave|sea|ocean|surf|tide|water|forest|wind|bamboo|waterfall|lake|pond|woods', re.I)  # 環境音は自然の水・森・風だけ
def cand(c): return sorted(i for i, r in recs.items() if cat.get(i, {}).get('cat') == c and (c != 'ambience' or WATERY.search((meta.get(i) or {}).get('en') or '')) and allowed(r) and i not in used and (r.get('embeddedDuration') or 0) >= SEC + 2 and src(i) and os.path.exists(src(i)) and (meta.get(i) or {}).get('en'))
def decode(p, sr=16000):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True, check=True).stdout; return np.frombuffer(raw, np.float32)
rms = lambda w: float(np.sqrt((w ** 2).mean())) if len(w) else 0.0
def pick(i, loop_len):
    # 元の録音だけの区間（1.8〜4.4 秒）で何の音か分かる位置を選ぶ。ルーパーは最初の4秒のうち一番はっきりした所をすくう
    x = decode(src(i)); sr = 16000; dur = len(x) / sr; best, bs = 0.0, -1
    for s in np.arange(0, max(0.01, dur - SEC - 0.5), 0.5):
        if (s + SEC) * sr > len(x): break
        # 最初の1.8秒（AFTER）・元の録音の区間（BEFORE）・聴き比べ（BYPASS）がどれも静かすぎないこと
        sc = min(rms(x[int(s * sr):int((s + 1.8) * sr)]) * 1.3, rms(x[int((s + 1.8) * sr):int((s + 4.4) * sr)]), rms(x[int((s + 17.6) * sr):int((s + 18.6) * sr)]) * 1.3, rms(x[int(s * sr):int((s + SEC) * sr)]) * 1.2)
        if sc > bs: bs, best = sc, float(s)
    if bs < 0.35 * rms(x): raise ValueError('sparse')  # 鳴いていない時間が長い録音（つかみ・聴き比べが無音になる）は使わない
    fr_ = 0.0
    if loop_len:
        fr_ = max(np.arange(0, 4.0 - loop_len + 0.01, 0.1), key=lambda o: rms(x[int((best + o) * sr):int((best + o + loop_len) * sr)]))
    return best, float(round(fr_, 2))
F = {}
def font(b, n):
    k = (b, n)
    if k not in F: F[k] = ImageFont.truetype(FB if b else FR, n)
    return F[k]
def fmt(pid, k, v):
    d = DEF[pid]
    if d.get('steps') and d['steps']['k'] == k:
        st = d['steps']; labs = st.get('labels')
        if labs: return st['l'][1], labs[st['opts'].index(v)][1]
        return st['l'][1], (f'+{v}' if v > 0 else str(v)) + ' st'
    kn = next(x for x in d['knobs'] if x['k'] == k); u = kn.get('u', '')
    val = (f'{v:.2f}'.rstrip('0').rstrip('.') if isinstance(v, float) else str(v)) + ('' if not u else (u if u == '%' else ' ' + u))
    return kn['l'][1], val
def frac(pid, k, v):
    d = DEF[pid]
    if d.get('steps') and d['steps']['k'] == k: o = d['steps']['opts']; return o.index(v) / max(1, len(o) - 1)
    kn = next(x for x in d['knobs'] if x['k'] == k)
    if kn.get('log'): return math.log(v / kn['min']) / math.log(kn['max'] / kn['min'])
    return (v - kn['min']) / (kn['max'] - kn['min'])
def wrap(d, text, f, maxw):
    out, line = [], ''
    for w in text.split(' '):
        t = (line + ' ' + w).strip()
        if d.textlength(t, font=f) <= maxw: line = t
        else: out.append(line); line = w
    out.append(line); return out
def hexrgb(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def state_at(t):
    cur = SCRIPT[0]
    for x in SCRIPT:
        if x[0] <= t: cur = x
    return cur
def build(day, rid, rk, n_made):
    r = recs[rid]; m = meta.get(rid) or {}; en = re.sub(r'\s+\d+$', '', m.get('en') or rid); jp = re.sub(r'\s*\d+$', '', r['jp']); c = cat[rid]['cat']; rc = RECIPES[rk]
    sts = rc['st']; n = len(sts); lp = next((s for s in sts if s['id'] == 'looper'), None)
    od = os.path.join(a.out, f'{day}_pedal_{rid}'); os.makedirs(od, exist_ok=True)
    start, lfrom = pick(rid, lp['len'] if lp else 0)
    keys = ['looper' if s['id'] == 'looper' else None for s in sts]; pedals = [s for s in sts if s['id'] != 'looper']
    pi = 0
    for i, s in enumerate(sts):
        if s['id'] != 'looper': keys[i] = pi; pi += 1
    on_for = lambda k: keys[:n] if k == 'all' else keys[:k]
    events = [{'t': t, 'on': on_for(k)} for t, k, _ in SCRIPT]
    group = 'field' if c == 'ambience' else 'species'
    job = {'url': a.url, 'rec': rid, 'group': group, 'start': start, 'sec': SEC, 'preroll': 3, 'looper': {'from': lfrom, 'len': lp['len'], 'bed': lp.get('bed', 0.35)} if lp else None,
           'pedals': [{'id': s['id'], 'v': s['v']} for s in pedals], 'events': events}
    jp_ = os.path.join(od, 'job.json'); json.dump(job, open(jp_, 'w'), ensure_ascii=False)
    env = dict(os.environ, NODE_PATH=subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip())
    res = json.loads(subprocess.run(['node', os.path.join(ROOT, 'tools', 'render_pedal.js'), jp_, os.path.join(od, 'raw.wav')], capture_output=True, text=True, check=True, env=env).stdout.strip().splitlines()[-1])
    if res.get('errors'): raise SystemExit('page errors: ' + '; '.join(res['errors']))
    link = res.get('link') or ''
    link = link.replace('http://localhost:8765/', f'https://{URL}/') if link.startswith('http') else ''
    m1 = subprocess.run(['ffmpeg', '-hide_banner', '-i', os.path.join(od, 'raw.wav'), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(m1[m1.rindex('{'):m1.rindex('}') + 1]); wav = os.path.join(od, 'audio.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(od, 'raw.wav'), '-af', f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true", '-ar', '48000', wav], check=True)
    x = decode(wav, 48000); sr = 48000
    mk = [e['t'] for e in events] + [SEC - 0.35]; segdb = []
    for i in range(len(events)):
        segdb.append(round(20 * math.log10(max(1e-6, rms(x[int((mk[i] + (0.35 if i else 0.05)) * sr):int(mk[i + 1] * sr)]))), 1))
    dry = [segdb[i] for i, e in enumerate(events) if not e['on']]; wet = [segdb[i] for i, e in enumerate(events) if e['on']]
    louder = round(max(wet) - max(dry), 1); quiet = min(segdb) < max(segdb) - 12  # どこかの区間がほぼ無音（つかみが弱い）
    # 背景：アプリの Visual Engine 2.0（加工後の音で動かす）。TEMPLATE LAB で継続が高かった2種を交互に
    style = ['life-earth', 'life-particle'][datetime.date.fromisoformat(day).toordinal() % 2]; bg = os.path.join(od, 'bg.mp4')
    subprocess.run(['node', os.path.join(ROOT, 'tools', 'render_v2.js'), '--audio', wav, '--app', a.app, '--out', bg, '--style', style, '--seed', str(int(hashlib.sha1(rid.encode()).hexdigest(), 16) % 99991)], check=True, env=env, capture_output=True)
    # 手前の文字とペダル（毎コマ RGBA で描いて重ねる）
    acc = (232, 196, 122)
    tl_y = 150; titl = Image.new('RGBA', (W, H)); td = ImageDraw.Draw(titl)
    td.text((W // 2, tl_y), 'NATURE × PEDALS', font=font(1, 34), fill=(232, 238, 234, 235), anchor='mm', stroke_width=3, stroke_fill=(0, 0, 0, 150))
    y = tl_y + 50
    for ln in wrap(td, en, font(1, 66), 920)[:2]: td.text((W // 2, y), ln, font=font(1, 66), fill=(255, 255, 255, 255), anchor='ma', stroke_width=4, stroke_fill=(0, 0, 0, 170)); y += 80
    td.text((W // 2, y + 8), jp, font=font(0, 34), fill=(235, 240, 237, 245), anchor='ma', stroke_width=3, stroke_fill=(0, 0, 0, 150))
    # 下の帰属表示（YouTube の説明欄・ボタンに重ならない高さ）
    td.rounded_rectangle((40, 1478, W - 140, 1630), 18, fill=(0, 0, 0, 120))
    cred = f'Recording: {r["author"]} · {r["license"]}'
    td.text((64, 1494), cred if td.textlength(cred, font=font(0, 30)) < 860 else cred[:48] + '…', font=font(0, 30), fill=(238, 242, 240, 255))
    td.text((64, 1540), 'Pedals: the SAE app (free, in the browser)', font=font(0, 26), fill=(214, 224, 218, 255))
    td.text((64, 1580), '▶ Same sound, same pedals: link in description', font=font(1, 26), fill=(*acc, 255))
    bw, gap, bh, by0 = 286, 24, 370, 1060; x0 = (W - (n * bw + (n - 1) * gap)) // 2
    def stomp(d, i, s, on, k_on, t):
        bx = x0 + i * (bw + gap); col = hexrgb(DEF[s['id']]['color']) if s['id'] != 'looper' else (200, 210, 225)
        body = tuple(int(c_ * (0.92 if on else 0.42)) for c_ in col)
        d.rounded_rectangle((bx, by0, bx + bw, by0 + bh), 26, fill=(*body, 238), outline=(255, 255, 255, 200 if on else 70), width=3)
        ink = (20, 24, 22, 255) if on else (230, 236, 232, 200)
        nm = 'Looper' if s['id'] == 'looper' else DEF[s['id']]['name'][1]
        lines = wrap(d, nm, font(1, 34), bw - 36)[:2]
        for li, ln in enumerate(lines): d.text((bx + bw // 2, by0 + 22 + li * 40), ln, font=font(1, 34), fill=ink, anchor='ma')
        ky = by0 + 150
        if s['id'] == 'looper':
            cx, cy = bx + bw // 2, ky + 10; d.ellipse((cx - 44, cy - 44, cx + 44, cy + 44), fill=(28, 32, 30, 255), outline=(255, 255, 255, 120), width=3)
            if on: ph = (t % s['len']) / s['len']; d.arc((cx - 44, cy - 44, cx + 44, cy + 44), -90, -90 + 360 * ph, fill=(255, 120, 90, 255), width=9)
            d.text((cx, cy + 56), f"{s['len']:.1f} s loop", font=font(1, 24), fill=ink, anchor='ma')
        else:
            kn = s['show'][:2]
            for j_, k in enumerate(kn):
                lab, val = fmt(s['id'], k, s['v'][k]); fr_ = frac(s['id'], k, s['v'][k]); cx = bx + (bw // (len(kn) + 1)) * (j_ + 1); cy = ky
                d.ellipse((cx - 36, cy - 36, cx + 36, cy + 36), fill=(30, 34, 32, 255), outline=(255, 255, 255, 110), width=2)
                ang = math.radians(225 - 270 * max(0, min(1, fr_))); d.line((cx, cy, cx + 27 * math.cos(ang), cy - 27 * math.sin(ang)), fill=(255, 255, 255, 255), width=6)
                d.text((cx, cy + 44), val, font=font(1, 24), fill=ink, anchor='ma'); d.text((cx, cy + 74), lab, font=font(0, 19), fill=ink, anchor='ma')
        # ランプとフットスイッチ（切り替えの瞬間に 0.15 秒沈む）
        lx, ly = bx + bw // 2, by0 + bh - 96; d.ellipse((lx - 12, ly - 12, lx + 12, ly + 12), fill=(255, 70, 50, 255) if on else (70, 40, 36, 255), outline=(0, 0, 0, 120), width=2)
        press = 1 if k_on < 0.15 else 0; fy = by0 + bh - 48 + press * 4; rr = 30 - press * 3
        d.ellipse((lx - rr, fy - rr, lx + rr, fy + rr), fill=(200, 204, 202, 255), outline=(60, 64, 62, 255), width=4)
    last = [-9] * n
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-i', bg, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', wav,
                           '-filter_complex', '[0:v]scale=1080:1920,format=rgba,colorchannelmixer=rr=.78:gg=.78:bb=.78[b];[b][1:v]overlay=0:0:format=auto,format=yuv420p[v]', '-map', '[v]', '-map', '2:a',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-profile:v', 'high', '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', str(SEC), '-movflags', '+faststart', os.path.join(od, 'video.mp4')], stdin=subprocess.PIPE)
    nfr = int(SEC * FPS); prev_on = [None] * n
    for f in range(nfr):
        t = f / FPS; im = titl.copy(); d = ImageDraw.Draw(im); stt = state_at(t); ev_on = on_for(stt[1])
        for i, s in enumerate(sts):
            on = keys[i] in ev_on
            if prev_on[i] is not None and on != prev_on[i]: last[i] = t
            prev_on[i] = on; stomp(d, i, s, on, t - last[i], t - (last[i] if on else 0))
        # いまの状態（大きく。切り替えから 0.25 秒で現れる）
        k = t - stt[0]; al = min(1, k / 0.25)
        if stt[2] == '+':
            idx = stt[1] - 1; s = sts[idx]; label = '+ ' + ('Looper' if s['id'] == 'looper' else DEF[s['id']]['name'][1]); sub = None
            if k > 2.2: al = max(0, 1 - (k - 2.2) / 0.4)
        else:
            label = {'AFTER': 'AFTER', 'BEFORE': 'BEFORE', 'BYPASS': 'BYPASS', 'ON': 'ON'}[stt[2]]
            sub = {'AFTER': f'{n} pedals on', 'BEFORE': 'the raw recording', 'BYPASS': 'all pedals off', 'ON': 'back on'}[stt[2]]
        if al > 0:
            tw = d.textlength(label, font=font(1, 78)); py = 760
            d.rounded_rectangle((W // 2 - tw / 2 - 40, py - 20, W // 2 + tw / 2 + 40, py + (150 if sub else 100)), 30, fill=(0, 0, 0, int(140 * al)))
            d.text((W // 2, py), label, font=font(1, 78), fill=(255, 255, 255, int(255 * al)), anchor='ma')
            if sub: d.text((W // 2, py + 96), sub, font=font(0, 34), fill=(230, 236, 232, int(255 * al)), anchor='ma')
        ff.stdin.write(im.tobytes())
    ff.stdin.close(); ff.wait()
    tmpv = os.path.join(od, 'video.mp4')
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'reels', 'qa.py'), tmpv], capture_output=True, text=True)
    qa = json.load(open(os.path.join(od, 'qa.json'))) if os.path.exists(os.path.join(od, 'qa.json')) else {}
    pq = {'segments_db': segdb, 'events': events, 'loudest_wet_vs_dry_db': louder, 'ok_loudness': louder < 4.0, 'quiet_segment': quiet, 'render': res, 'start': start, 'looper_from': lfrom, 'style': style, 'share_link_len': len(link)}
    json.dump(pq, open(os.path.join(od, 'pedal_qa.json'), 'w'), ensure_ascii=False, indent=1)
    names = ['Looper' if s['id'] == 'looper' else DEF[s['id']]['name'][1] for s in sts]; names_ja = ['ルーパー' if s['id'] == 'looper' else DEF[s['id']]['name'][0] for s in sts]
    def setting(s):
        if s['id'] == 'looper': return f"Looper — {s['len']:.1f} s loop / ルーパー（{s['len']:.1f}秒をくり返す）"
        allk = [x['k'] for x in DEF[s['id']]['knobs']] + ([DEF[s['id']]['steps']['k']] if DEF[s['id']].get('steps') else [])
        return DEF[s['id']]['name'][1] + ' — ' + ', '.join(' '.join(fmt(s['id'], k, s['v'][k])) for k in allk if k in s['v']) + ' / ' + DEF[s['id']]['name'][0]
    loc = ' · '.join(x_ for x_ in [m.get('recordedArea'), m.get('recordedCountry')] if x_) or r.get('location') or ''
    play = (f"▶ Play this recording through the same pedals (opens the app, free):\n{link}\n" + ("(The looper part isn't in the link — the app's 6-channel looper is in the Sampler.)\n" if lp else '')) if link else f"▶ Try the pedals: https://{URL}/\n"
    cap = f"""[YouTube Shorts title]
{en} → {n} pedals | Nature × Pedals #Shorts

[Caption — Instagram and YouTube]
{play}
Before / after: a real field recording of {en}, played through {' → '.join(names)} in the SAE app.
Levels are matched, so the pedals never jump out louder than the original.

Pedal settings:
""" + '\n'.join('• ' + setting(s) for s in sts) + f"""

{jp}の実録音を、SAE アプリの {' → '.join(names_ja)} に通しました。最初が加工後、次が元の録音です。ペダルを足しても元の音より大きくならないよう音量をそろえています。上のリンクから、同じ録音・同じペダルをアプリで鳴らせます。

— Recording credit / 録音クレジット —
{r.get('title') or en} — {r['author']} / {r['license']} {r.get('licenseURL') or ''}
Source / 出典: {r.get('url') or ''}
Location / 録音地: {loc or '記載なし'}
Changes / 加工: excerpt ({start:.1f}–{start + SEC:.1f} s), {'looped, ' if lp else ''}processed with the SAE app's pedals (settings above), loudness matched, visual added / 抜粋・{'ループ・' if lp else ''}ペダルによる加工（上の設定）・音量の調整・映像の追加
Visual: SAE app reel template ({style}), driven by this audio / 映像：SAE アプリのリールテンプレート（この音で動かしたもの）
All credits / 全クレジット: https://{URL}/credits.html

#saww #sawwaudioecosystem #natureasaninstrument #fieldrecording #effectspedal #pedalboard #looper #ambient #soundscape #自然音 #エフェクター
"""
    open(os.path.join(od, 'caption.txt'), 'w', encoding='utf-8').write(cap)
    for f_ in ('raw.wav', 'bg.mp4'):
        try: os.remove(os.path.join(od, f_))
        except FileNotFoundError: pass
    out = os.path.join(od, f'saww_pedal_{day}_{rid}.mp4'); os.replace(tmpv, out)
    if not a.no_history:
        hist.append({'date': day, 'id': rid, 'series': 'pedal', 'pattern': 'pedal', 'version': a.version, 'recipe': rk, 'pedals': [s['id'] for s in sts], 'style': style, 'cat': c, 'sec': SEC, 'start': start,
                     'loudest_wet_vs_dry_db': louder, 'share_link': bool(link), 'license': r['license'], 'author': r['author'], 'file': os.path.basename(out)})
        json.dump(hist, open(HP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('made', out, 'qa', qa.get('ok'), qa.get('problems'), 'wet_vs_dry', louder, 'quiet', quiet, 'link', len(link), flush=True)
d0 = datetime.date.fromisoformat(a.start); keys_ = list(RECIPES)
for k in range(a.days):
    day = (d0 + datetime.timedelta(days=k)).isoformat()
    rk = a.recipe or keys_[(len(hist) + k * (1 if a.no_history else 0)) % len(keys_)]
    if a.rec: rid = a.rec
    else:
        pool = [i for c in RECIPES[rk]['cats'] for i in cand(c)]
        if not pool: print('no recording for', rk); continue
        o = int(hashlib.md5(day.encode()).hexdigest(), 16); pool = pool[o % len(pool):] + pool[:o % len(pool)]
    for rid in ([a.rec] if a.rec else pool[:6]):
        try: build(day, rid, rk, len(hist) + k); used.add(rid); break
        except ValueError as e: print('skip', rid, e, flush=True)
