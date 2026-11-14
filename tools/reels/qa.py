#!/usr/bin/env python3
"""書き出したリールの品質チェック（動画全体を磨くための、毎回の最低線）。結果は動画と同じフォルダの qa.json。
- 形式：1080×1920・H.264・AAC・長さ
- 音量：統合ラウドネス −20〜−13 LUFS、トゥルーピーク −1 dBTP 以下
- 最初の1秒：真っ黒でない（平均輝度 0.04 以上）＝フィードで止まってもらう最初の絵があるか
- 点滅：明るさの急な変化（前のコマとの差 0.10 以上）が1秒に3回を超えない（光過敏への配慮）
- 文字の安全域：YouTube ショートの右下のボタン・下の説明欄に重なる帯（下 280px・右 120px）の明るい文字は目視の項目として残す
使い方：python3 tools/reels/qa.py <動画.mp4>
"""
import json, os, re, subprocess, sys
import numpy as np
f = sys.argv[1]; R = {'file': os.path.basename(f)}; bad = []
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', f], capture_output=True, text=True).stdout)
v = next(s for s in pr['streams'] if s['codec_type'] == 'video'); au = [s for s in pr['streams'] if s['codec_type'] == 'audio']
R['size'] = f"{v['width']}x{v['height']}"; R['codec'] = v['codec_name']; R['audio'] = au[0]['codec_name'] if au else None; R['sec'] = round(float(pr['format']['duration']), 2)
if R['size'] != '1080x1920': bad.append('size')
if R['codec'] != 'h264' or R['audio'] != 'aac': bad.append('codec')
el = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = re.findall(r'I:\s+(-?[\d.]+) LUFS', el); pk = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', el)
R['lufs'] = float(m[-1]) if m else None; R['true_peak'] = float(pk[-1]) if pk else None
if R['lufs'] is None or not (-20 <= R['lufs'] <= -13): bad.append('loudness')
if R['true_peak'] is not None and R['true_peak'] > -1.0: bad.append('peak')
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', 'scale=54:96,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, 96, 54).astype(np.float32) / 255; lum = fr.mean((1, 2)); fps = len(lum) / max(R['sec'], .1)
R['first_sec_luma'] = round(float(lum[:max(1, int(fps))].mean()), 3)
if R['first_sec_luma'] < .04: bad.append('dark_start')
jumps = np.where(np.abs(np.diff(lum)) >= .10)[0] / fps; R['flash_max_per_sec'] = int(max([((jumps >= t) & (jumps < t + 1)).sum() for t in np.arange(0, R['sec'], .5)] or [0]))
if R['flash_max_per_sec'] > 3: bad.append('flash')
R['motion'] = round(float(np.abs(np.diff(fr, axis=0)).mean()), 4)   # コマ間の平均の変化（動きの量の目安。磨く時の記録用）
R['ok'] = not bad; R['problems'] = bad; R['manual'] = ['文字が下 280px・右 120px（YouTube の説明欄・ボタン）に重ならないか', '最初の1秒で何の音か分かるか']
json.dump(R, open(os.path.join(os.path.dirname(f), 'qa.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(('QA OK ' if R['ok'] else 'QA NG ' + ','.join(bad) + ' ') + json.dumps(R, ensure_ascii=False))
