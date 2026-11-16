#!/usr/bin/env python3
"""動画（映像＋音）の終わりを始まりへなめらかにつなぎ、繰り返し再生しても継ぎ目が出ないようにする（2026-11-16 ショートの改善）。
出力は元より L 秒短い：映像・音とも [L, D] の最後の L 秒に、[0, L] を重ねて溶かす。出力の最初のフレーム＝元の L 秒目、最後は元の L 秒目の直前へ戻る。
使い方：python3 tools/loopify.py --video base.mp4 --audio audio.wav --out loop.mkv --sec 30 --xf 1.5
"""
import argparse, subprocess
ap = argparse.ArgumentParser(); ap.add_argument('--video', required=True); ap.add_argument('--audio', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--sec', type=float, required=True); ap.add_argument('--xf', type=float, default=1.5)
a = ap.parse_args(); D, L = a.sec, a.xf
# split/asplit で1つの入力を分けると止まる（acrossfade が片方を待つ）ので、同じファイルを2回入力する
fc = (f"[0:v]trim=start={L}:end={D},setpts=PTS-STARTPTS[v1];[1:v]trim=start=0:end={L},setpts=PTS-STARTPTS[v2];"
      f"[v1][v2]xfade=transition=fade:duration={L}:offset={D-2*L:.3f},format=yuv420p[v];"
      f"[2:a]atrim=start={L}:end={D},asetpts=PTS-STARTPTS[a1];[3:a]atrim=start=0:end={L},asetpts=PTS-STARTPTS[a2];"
      f"[a1][a2]acrossfade=d={L}:c1=qsin:c2=qsin[a]")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.video, '-i', a.video, '-i', a.audio, '-i', a.audio, '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
                '-max_muxing_queue_size', '9999', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'pcm_s16le', a.out], check=True)  # 中間ファイル（.mkv 推奨）
