# 課金を始める手順（Stripe の月額・無料版と PRO の区別・領収書の自動メール）
v0.57（2026-11-07）。アプリ側とサーバーは作ってテスト済み。ここに書いた**アカウントの作成・ログイン・鍵の入力は、オーナーが行う**（Claude はパスワードや鍵を入力しない）。

## 全体の流れ
```
お客さん ──「PRO にする」──▶ Stripe の支払いリンク（月額）
                                  │ 支払い完了
                                  ▼
          課金の確認サーバー /activate ◀── Stripe の知らせ（Webhook）
          （Cloudflare Workers）          支払い・更新・解約
                                  │ 署名付きの「PRO の証明」
                                  ▼
                     アプリ（公開鍵で証明を確かめて PRO を開放）
領収書・請求書のメール：Stripe が自動で送る（下の 1）
解約・カードの変更：Stripe の顧客ポータル（下の 2）
ほかの端末：購入したメールアドレスにログイン用のリンクを送る（Resend、下の 4）
```

## 1. 領収書を自動でメールする（Stripe の設定だけ）
1. Stripe の Dashboard →「設定」→「ビジネス」→「カスタマーへのメール」（Customer emails）→「決済」の **「支払いの成功」（Successful payments）をオン**。毎月の更新の支払いでも、領収書と請求書の PDF が付いたメールが届く。
2. 「設定」→「ビジネス」→「ビジネスの詳細」の公開情報に、次の4つを入れる。どれも、領収書に必ず載る項目。
   - 正式な事業者名
   - サポートの住所
   - サポートのメールアドレス
   - プライバシーポリシーの URL
3. （任意）「設定」→「Billing」→「サブスクリプションおよびメール」で、次の2つをオン。
   - 「カード決済が失敗した時のメール」
   - 「定期支払いの請求書を送る」
4. （任意）「設定」→「ブランディング」→「メールの領収書」に、ロゴ（正方形の PNG、128px 以上・512KB 以下）を入れる。assets/brand/logo-512.webp を PNG にしたものが使える。
- 注意：**テスト用の支払いでは、領収書のメールは自動で送られない**。確かめる時は、支払いの画面から「領収書を送る」で手動で送る。
- インボイス制度の登録番号がある場合は、請求書の設定に入れる。税の扱いは税理士に確認する。

## 2. 解約・カードの変更（Stripe の顧客ポータル）
1. 「設定」→「Billing」→「カスタマーポータル」で「リンクを有効化」を押す。
2. 設定で次の3つを許可する。
   - 解約
   - 支払い方法の更新
   - 請求書の履歴
3. 出てきたログイン用のリンク（https://billing.stripe.com/p/login/…）を、Claude に渡す。アプリの data/product_tiers.json の checkout.portalLink に入れ、PRO の人に「支払い・領収書・解約の管理」として出す。

## 3. 課金の確認サーバー（Cloudflare Workers、無料枠で足りる）
パソコンの「ターミナル」で、このリポジトリの server フォルダに入ってから行う。
```
cd server
cp wrangler.toml.example wrangler.toml
npx wrangler login                          # ブラウザで Cloudflare にログイン（アカウントがなければ作る）
npx wrangler kv namespace create SAWW_KV    # 出てきた id を wrangler.toml に書く
node keygen.mjs                             # 鍵の組を作る（秘密の鍵と公開鍵が表示される）
npx wrangler secret put ENT_PRIVATE_JWK     # 表示された「秘密の鍵」を貼る
npx wrangler secret put MAGIC_SECRET        # 長い乱数（例：openssl rand -hex 32 の結果）
npx wrangler secret put STRIPE_SECRET_KEY   # 下の「制限付きキー」
npx wrangler secret put STRIPE_WEBHOOK_SECRET   # 下の 3-2 で出る whsec_…
npx wrangler secret put RESEND_API_KEY      # 4 の Resend のキー
npx wrangler secret put MAIL_FROM           # 例：saww audio ecosystem <login@あなたのドメイン>
npx wrangler deploy                         # https://saww-billing.<名前>.workers.dev が出る
```
- **3-1 Stripe の制限付きキー**：「開発者」→「API キー」→「制限付きのキーを作成」。次の3つを「読み取り」だけにする。
  - Checkout Sessions
  - Subscriptions
  - Customers

  秘密の鍵（sk_live_…）そのものは使わない。
- **3-2 Webhook**：「開発者」→「Webhook」→「エンドポイントを追加」。
  - URL：`https://saww-billing.<名前>.workers.dev/stripe/webhook`
  - 受け取るイベント：checkout.session.completed、customer.subscription.created、customer.subscription.updated、customer.subscription.deleted、invoice.paid
  - 作成後に表示される「署名シークレット」（whsec_…）を STRIPE_WEBHOOK_SECRET に入れる。
- **3-3 支払いリンクの「支払い後」**：今の支払いリンク（https://buy.stripe.com/7sY00jfWlfNp9SX8inbZe07）を編集し、「支払い後」→「カスタマーを自分のウェブサイトにリダイレクト」を選んで、次を入れる。
  `https://saww-billing.<名前>.workers.dev/activate?session_id={CHECKOUT_SESSION_ID}`
  （{CHECKOUT_SESSION_ID} はそのまま入力。Stripe が支払いごとの番号に置き換える）
- 公開鍵と workers.dev の URL を Claude に渡せば、Claude が data/product_tiers.json に次を入れて公開する。この時点で無料版と PRO の区別が始まる。
  - checkout.status = "live"
  - apiBase
  - publicKey
  - portalLink

## 4. ほかの端末でのログイン（Resend、無料枠で足りる）
- https://resend.com でアカウントを作り、送り元のドメインを確認する（DNS に記録を足す）。
- API キーを作って RESEND_API_KEY に入れる。
- ドメインがまだない時は、Resend のテスト用の送り元で自分宛てだけ試せる。
- このサーバーが送るメールは「ログイン用のリンク」だけ（20分・1回だけ有効）。会員でないアドレスには送らず、返事は同じにしている（登録の有無を漏らさない）。

## 5. 公開の前に（日本の法律の確認）
- 特定商取引法に基づく表記のページが必要。載せる項目の例は次のとおり。
  - 事業者名・住所・電話番号
  - 価格
  - 支払いの時期と方法
  - 提供の時期
  - 解約の方法
- 定期購入では、最終確認の画面に次の項目が分かるように出ている必要がある。
  - 契約期間
  - 自動更新であること
  - 毎回の金額
  - 解約の方法

  Stripe の支払いリンクには「カスタムテキスト」と「利用規約への同意」を足せるので、解約の方法などをそこに書く。
- Claude は法律の専門家ではないので、文面は消費者庁の資料や専門家で確認する。

## 中身
| ファイル | 内容 |
|---|---|
| worker.js | サーバー本体（Webhook の署名確認・支払いの確認・PRO の証明の発行と更新・ログイン用メール） |
| keygen.mjs | 鍵の組を作る |
| test_worker.mjs | テスト（Stripe と Resend は偽物）。`node server/test_worker.mjs` |
| wrangler.toml.example | 設定のひな形 |

アプリとの通しのテストは build/test_billing_v056.js（支払い → PRO、電波なしでも PRO、改ざんの拒否、ほかの端末でのログイン、解約で FREE、ログアウト）。
