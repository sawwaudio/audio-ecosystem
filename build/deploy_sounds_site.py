#!/usr/bin/env python3
"""最新版のアプリを音源リポジトリ（sawwaudio/audio-ecosystem-sounds-1）の GitHub Pages に置くためのページを作る。
本体リポジトリ（sawwaudio/audio-ecosystem）に書き込めない間の公開先。URL は https://sawwaudio.github.io/audio-ecosystem-sounds-1/
- 音源の場所：音源リポジトリの86録音（../audio-ecosystem-sounds-1/…）はそのまま同じ場所に解決される。
  本体リポジトリにある41録音・楽器（audio/…・instruments/…）は ../audio-ecosystem/… に書き換え、本体の公開サイト（同じ sawwaudio.github.io）から読む。
  本体の公開サイトにまだ無いファイル（v0.45 の VCSL の楽器など）は、音源リポジトリの同じパスに複製する。
- ファイルの中身（SHA-256）は変えないので、アプリの照合はそのまま通る。
使い方：python3 build/deploy_sounds_site.py <音源リポジトリのフォルダ>
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = sys.argv[1]
t = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
s = t.index('id="ae-audio-manifest">') + len('id="ae-audio-manifest">'); e = t.index('</script>', s)
m = json.loads(t[s:e]); n = 0; copied = []
# 本体の公開サイトにあるのは、本体 main（306830d）に入っているファイルだけ。それ以降に足した音源（v0.45 の VCSL の楽器など）は
# 音源リポジトリに同じパスで複製し、相対パスのまま読む。
import subprocess, shutil
LIVE = set(subprocess.run(['git', '-C', ROOT, 'ls-tree', '-r', '--name-only', '306830d'], capture_output=True, text=True, check=True).stdout.split())
def fix(p):
    global n
    if p.startswith(('audio/', 'instruments/')):
        if p in LIVE:
            n += 1; return '../audio-ecosystem/' + p
        dst = os.path.join(out_dir, p); os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst) or open(dst, 'rb').read() != open(os.path.join(ROOT, p), 'rb').read():
            shutil.copyfile(os.path.join(ROOT, p), dst)
        copied.append(p)
    return p
for kind in ('recordings', 'instruments'):
    for v in m[kind].values():
        for ent in v.values():
            if isinstance(ent, dict):
                if 'path' in ent: ent['path'] = fix(ent['path'])
                for part in ent.get('parts', []): part['path'] = fix(part['path'])
t = t[:s] + json.dumps(m, ensure_ascii=False, separators=(',', ':')) + t[e:]
open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(t)
# v0.53：端末への保存（Service Worker）。ページと同じ場所に置く
if os.path.exists(os.path.join(ROOT, 'sw.js')):
    shutil.copyfile(os.path.join(ROOT, 'sw.js'), os.path.join(out_dir, 'sw.js'))
print('index.html', len(t.encode()), 'bytes · rewritten paths', n, '· copied to the sounds repo', len(copied))
