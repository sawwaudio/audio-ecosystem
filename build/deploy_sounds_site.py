#!/usr/bin/env python3
"""最新版のアプリを音源リポジトリ（sawwaudio/audio-ecosystem-sounds-1）の GitHub Pages に置くためのページを作る。
本体リポジトリ（sawwaudio/audio-ecosystem）に書き込めない間の公開先。URL は https://sawwaudio.github.io/audio-ecosystem-sounds-1/
- 音源の場所：音源リポジトリの86録音（../audio-ecosystem-sounds-1/…）はそのまま同じ場所に解決される。
  本体リポジトリにある41録音・楽器（audio/…・instruments/…）は ../audio-ecosystem/… に書き換え、本体の公開サイト（同じ sawwaudio.github.io）から読む。
- ファイルの中身（SHA-256）は変えないので、アプリの照合はそのまま通る。
使い方：python3 build/deploy_sounds_site.py <音源リポジトリのフォルダ>
"""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out_dir = sys.argv[1]
t = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
s = t.index('id="ae-audio-manifest">') + len('id="ae-audio-manifest">'); e = t.index('</script>', s)
m = json.loads(t[s:e]); n = 0
def fix(p):
    global n
    if p.startswith(('audio/', 'instruments/')):
        n += 1; return '../audio-ecosystem/' + p
    return p
for kind in ('recordings', 'instruments'):
    for v in m[kind].values():
        for ent in v.values():
            if isinstance(ent, dict):
                if 'path' in ent: ent['path'] = fix(ent['path'])
                for part in ent.get('parts', []): part['path'] = fix(part['path'])
t = t[:s] + json.dumps(m, ensure_ascii=False, separators=(',', ':')) + t[e:]
open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(t)
print('index.html', len(t.encode()), 'bytes · rewritten paths', n)
