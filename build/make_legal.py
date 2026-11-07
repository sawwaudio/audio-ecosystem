#!/usr/bin/env python3
"""v0.59：data/legal.json から「特定商取引法に基づく表記」のページ（legal.html）と、アプリに埋め込む表示用データを作る。
- legal.html：公開ページ（本体と同じ場所に置く。Stripe の「ビジネスの詳細」→「特定商取引法に基づく表記」にこの URL を入れる）。
- アプリ（index.html の ae-legal）：購入ボタンの前に出す「お申し込みの前に（定期購入）」の確認欄に使う。
null の項目は「記入待ち」と表示し、ready=false になる（アプリは ready になるまで課金を始めない）。
使い方：python3 build/make_legal.py（integrate_v059.py からも呼ぶ）
"""
import html, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
REQUEST = '請求があれば遅滞なく開示します（下のメールアドレスへご連絡ください）。'
MISSING = '記入待ち（販売開始の前に記入します）'


def load():
    d = json.load(open(P('data/legal.json'), encoding='utf-8'))
    pol, pr = d['policy'], d['price']
    missing = [k for k in ('seller', 'manager', 'address', 'phone', 'email') if not d.get(k)]
    if not pr.get('monthly'):
        missing.append('price')
    m = pr.get('monthly')
    price = (f'PRO：月額 {m:,}円（{"税込" if pr.get("taxIncluded", True) else "税別"}）。毎月同じ金額です。1年間（12回）の目安：{m * 12:,}円。'
             if m else None)
    v = lambda k: (REQUEST if d.get(k) == 'request' else d.get(k)) or None
    rows = [
        ('販売事業者', v('seller')),
        ('屋号・サービス名', d.get('tradeName')),
        ('運営統括責任者', v('manager')),
        ('所在地', v('address')),
        ('電話番号', v('phone')),
        ('メールアドレス', v('email')),
    ]
    if d.get('hours'):
        rows.append(('お問い合わせの受付時間', d['hours']))
    rows += [
        ('販売価格', price),
        ('商品代金以外の必要料金', pol['extraFees_ja']),
        ('お支払いの方法', pol['payment_ja']),
        ('お支払いの時期', pol['timing_ja']),
        ('提供の時期', pol['delivery_ja']),
        ('定期購入の契約期間・自動更新', pol['term_ja']),
        ('解約の方法', pol['cancel_ja']),
        ('返品・返金', pol['refund_ja']),
        ('お申し込みの撤回', pol['withdraw_ja']),
        ('販売数量・お申し込みの期間', pol['quantity_ja']),
        ('動作環境', pol['environment_ja']),
    ]
    # 購入ボタンの前に出す確認欄（定期購入の最終確認で求められる事項＋動作環境）
    terms = [
        ('内容', 'saww audio ecosystem PRO（すべての楽器とスタジオ：ミキサー・サンプラー・トラック）の月額の定期購読'),
        ('価格', price),
        ('契約期間・自動更新', pol['term_ja']),
        ('お支払いの時期と方法', pol['timing_ja'] + pol['payment_ja']),
        ('提供の時期', pol['delivery_ja']),
        ('解約の方法', pol['cancel_ja']),
        ('返品・返金', pol['refund_ja']),
        ('動作環境', pol['environment_ja']),
    ]
    return d, rows, terms, missing


def page(d, rows, missing):
    tr = '\n'.join(f'<tr><th scope="row">{html.escape(k)}</th><td{" class=\"missing\"" if not val else ""}>{html.escape(val or MISSING)}</td></tr>' for k, val in rows)
    note = ('<p class="notice" role="note">この表記は販売開始の前の準備中です。「記入待ち」の項目が埋まるまで、PRO の販売（課金）は始まりません。</p>' if missing else '')
    return f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>特定商取引法に基づく表記 — saww audio ecosystem</title>
<meta name="robots" content="index,follow">
<style>
:root{{--bg:#f6f3ea;--fg:#1d231f;--sub:#5b6158;--line:#d9d3c3;--accent:#8a6a24;--card:#fffdf7;--warn:#9a4b2b}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#141a16;--fg:#f1ece0;--sub:#b8b6aa;--line:#2f3a33;--accent:#e6c27a;--card:#1b231e;--warn:#e9a07f}}}}
:root[data-theme="dark"]{{--bg:#141a16;--fg:#f1ece0;--sub:#b8b6aa;--line:#2f3a33;--accent:#e6c27a;--card:#1b231e;--warn:#e9a07f}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.75 "Hiragino Sans","Zen Kaku Gothic New","Noto Sans JP",system-ui,sans-serif}}
main{{max-width:760px;margin:0 auto;padding:28px 16px 64px}}
h1{{font-size:1.45rem;line-height:1.4;margin:0 0 6px}}h2{{font-size:1.1rem;margin:32px 0 8px}}
.sub{{color:var(--sub);font-size:.88rem;margin:0 0 18px}}a{{color:var(--accent)}}
table{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}}
th,td{{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}}
th{{width:34%;font-weight:600;color:var(--sub);font-size:.92rem}}tr:last-child th,tr:last-child td{{border-bottom:0}}
td.missing{{color:var(--warn)}}.notice{{border:1px solid var(--warn);color:var(--warn);border-radius:10px;padding:10px 12px;font-size:.92rem}}
.box{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}}.box p{{margin:.3em 0}}
@media (max-width:560px){{th,td{{display:block;width:100%}}th{{border-bottom:0;padding-bottom:2px}}td{{padding-top:0}}}}
</style></head><body><main>
<h1>特定商取引法に基づく表記</h1>
<p class="sub">通信販売に関する表示事項 · saww audio ecosystem · 最終更新 {html.escape(d.get("updated", ""))}</p>
{note}
<div class="box"><p><strong>PRO は月額の定期購読です。</strong>毎月自動で更新され、解約の手続きをするまで続きます。</p><p>解約はいつでも、アプリの「支払い・領収書・解約の管理」からできます。次の更新日の前日までに解約すると、次回以降は請求されません。</p></div>
<h2>表示事項</h2>
<table><tbody>
{tr}
</tbody></table>
<p class="sub" style="margin-top:22px"><a href="./">アプリに戻る</a></p>
</main></body></html>
'''


def build():
    d, rows, terms, missing = load()
    open(P('legal.html'), 'w', encoding='utf-8').write(page(d, rows, missing))
    return {'ready': not missing, 'missing': missing, 'url': 'legal.html', 'updated': d.get('updated'),
            'terms': [[k, val] for k, val in terms], 'monthly': d['price'].get('monthly'),
            'taxIncluded': d['price'].get('taxIncluded', True)}


if __name__ == '__main__':
    e = build()
    print('legal.html ok · ready', e['ready'], '· missing', ','.join(e['missing']) or '-')
