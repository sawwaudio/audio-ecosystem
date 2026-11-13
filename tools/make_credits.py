#!/usr/bin/env python3
"""公開アプリ（index.html）の実録音の一覧から、クレジットのページ（credits.html）を作る。
YouTube・Instagram の配信や動画の説明欄から、このページへリンクする（説明欄の文字数の上限を超えないため）。
使い方：python3 tools/make_credits.py ../audio-ecosystem-sounds-1/index.html ../audio-ecosystem-sounds-1/credits.html
"""
import html, json, re, sys
src, out = sys.argv[1], sys.argv[2]
h = open(src, encoding='utf-8').read()
blk = lambda i: json.loads(re.search(r'id="%s">(.*?)</script>' % i, h, re.S).group(1))
recs = blk('ae-recordings'); meta = blk('ae-wildlife-meta'); cat = blk('ae-categories')['categories']
CAT = [('ambience', 'Ambience / 環境音'), ('birds', 'Birds / 鳥'), ('insects', 'Insects / 虫'), ('amphibians', 'Amphibians / 両生類'), ('mammals', 'Mammals / 哺乳類'), ('aquatic', 'Aquatic life / 水の生き物')]
e = html.escape
rows = {k: [] for k, _ in CAT}; other = []
for r in recs:
    c = (cat.get(r['id']) or {}).get('cat'); en = (meta.get(r['id']) or {}).get('en') or ''
    lic = r.get('license') or ''; lu = r.get('licenseURL') or ''; url = r.get('url') or ''
    sa = ' <span class="sa">BY-SA: not used in live streams / 配信では使いません</span>' if 'SA' in lic else ''
    li = (f'<li><b>{e(en or r["jp"])}</b> <span class="jp">{e(r["jp"])}</span><br>'
          f'<span class="m">{e(r.get("title") or "")} — {e(r.get("author") or "")} · '
          + (f'<a href="{e(lu)}" rel="noopener">{e(lic)}</a>' if lu else e(lic))
          + (f' · <a href="{e(url)}" rel="noopener">source</a>' if url else '')
          + (f' · {e(r.get("location"))}' if r.get('location') else '') + f'</span>{sa}</li>')
    (rows[c] if c in rows else other).append(li)
body = ''.join(f'<h2>{e(t)}</h2><ul>{"".join(rows[k])}</ul>' for k, t in CAT if rows[k]) + (f'<h2>Other / その他</h2><ul>{"".join(other)}</ul>' if other else '')
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Credits — saww audio ecosystem</title><style>
:root{{--bg:#f6f3ea;--fg:#1d231f;--sub:#5b6158;--line:#d9d3c3;--a:#8a6a24}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#141a16;--fg:#f1ece0;--sub:#b8b6aa;--line:#2f3a33;--a:#e6c27a}}}}
:root[data-theme="dark"]{{--bg:#141a16;--fg:#f1ece0;--sub:#b8b6aa;--line:#2f3a33;--a:#e6c27a}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,"Hiragino Sans",sans-serif}}main{{max-width:820px;margin:0 auto;padding:24px 16px 60px}}
h1{{font-size:1.4rem;margin:0 0 6px}}h2{{font-size:1.05rem;margin:28px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}}
ul{{list-style:none;padding:0;margin:0}}li{{padding:8px 0;border-bottom:1px solid var(--line)}}.jp,.m{{color:var(--sub);font-size:.86rem}}.m{{overflow-wrap:anywhere}}a{{color:var(--a)}}.sa{{font-size:.78rem;color:var(--sub);border:1px solid var(--line);border-radius:6px;padding:0 6px;margin-left:4px}}
</style></head><body><main>
<h1>Credits — saww audio ecosystem</h1>
<p class="m">Every sound in saww audio ecosystem is a real field recording. Recordings are excerpted, looped, mixed and level-adjusted inside the app and in our videos and live streams; visuals are generated from the sound. Licenses: CC0 / public domain / CC BY (and CC BY-SA, which is not used in videos or live streams).</p>
<p class="m">saww audio ecosystem の音はすべて実録音です。アプリ・動画・配信の中で、抜粋・ループ・ミックス・音量の調整をしています。映像は音から描いています。</p>
<p class="m"><a href="./">Open the app / アプリを開く</a></p>
{body}
</main></body></html>
'''
open(out, 'w', encoding='utf-8').write(page)
print('ok', sum(len(v) for v in rows.values()) + len(other), 'recordings')
