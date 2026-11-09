# 引き継ぎ：課金を始める（Codex 向け）
2026-11-09 時点。基準コミット `50b190d`（v0.64）。公開版の `checkout.status` は **test**（課金は始まっていない）。

## 1. 決まっていること（オーナー確認済み）
- PRO：**月額 US$9.99・自動更新**。`data/legal.json` と `data/product_tiers.json` の表記と一致させる。
- 販売事業者：篠崎颯太（屋号 saw）。問い合わせ先：`info@saw-saww-official.com`（受信確認済み）。
- 住所・電話：「請求があれば遅滞なく開示」（リポジトリに保存しない）。
- 無料版と PRO の分け方は**未確定**。今の実装は「生き物の声を分類ごとに4種まで」。依頼の「無料＝Reels 書き出し中心／PRO＝ライブ演奏・作曲」とは違う。変える前にオーナーに確認する（`recordings.free` と `features` はオーナーの指示なしに変えない）。
- 解約は「期間末まで PRO」。Stripe の顧客ポータルで「請求期間の終了時にキャンセル」にする。

## 2. いまの仕組み（コード・テスト済み）
- アプリ `index.html`：`LIVE = BILL.status==='live' && apiBase && publicKey && LEGAL.ready`。全部そろうまで課金 UI は出ない。
- 購入ボタンは、定期購入の内容を読んで確認チェックを入れるまで押せない。
- サーバー `server/worker.js`（Cloudflare Workers）：
  - `POST /stripe/webhook`：Stripe の署名を確認し、購読の状態を KV に保存。
  - `GET /activate?session_id=…`：支払い後の戻り先。PRO の証明（署名付き）を返す。
  - `POST /login`・`GET /magic`：ほかの端末へのログイン（Resend のメール）。
  - `POST /refresh`：証明の更新。
- テスト：`build/test_billing_v057.js`（支払い→PRO、電波なし PRO、改ざん拒否、ほかの端末、解約→FREE）、`build/test_legal_v059.js`（表記・購入ゲート）、`build/test_free_creatures_v063.js`。すべて ALL PASS。Stripe と Resend は偽物で確認している。
- `server/test_worker.mjs`：サーバーのテスト（`node server/test_worker.mjs`）。

## 3. 残り（順番どおり）
### A. Stripe（テストモード。ログインはオーナー）
1. テストモードで商品「PRO」を作り、価格 US$9.99／月（定期）を追加。Price ID（`price_…`）を控える。
2. テスト用の支払いリンク（`buy.stripe.com/test_…`）を作る。支払い後の行き先は `https://saww-billing.<名前>.workers.dev/activate?session_id={CHECKOUT_SESSION_ID}`。
3. 制限付きキー（rk_test_…）：Checkout Sessions・Subscriptions・Customers を読み取り。
4. 顧客ポータル：有効化。許可は解約・支払い方法の更新・請求書履歴。解約は「期間の終了時」。ログインリンク（`billing.stripe.com/p/login/…`）を控える。
5. 領収書メール：「支払いの成功」をオン。ビジネスの詳細に事業者名・住所（請求で開示）・メール・プライバシー URL。
6. 特定商取引法の URL（`https://sawwaudio.github.io/audio-ecosystem-sounds-1/legal.html`）をビジネスの詳細に入れる。
7. **確認**：既存の支払いリンク `buy.stripe.com/7sY00jfWlfNp9SX8inbZe07` は本番の可能性が高い（テストのリンクは `test_` で始まる）。本番モードで有効なら、いったん無効にするか、本番の準備が整うまで共有しない。

### B. Cloudflare（オーナーのターミナル）
`server/` で `README.md` の③の手順。`wrangler.toml` の KV id、`ENT_PRIVATE_JWK`（keygen の秘密鍵）、`MAGIC_SECRET`、`STRIPE_SECRET_KEY`（rk_test_）、`STRIPE_WEBHOOK_SECRET`（whsec_）、`RESEND_API_KEY`・`MAIL_FROM`（任意・後回し可）。`PRICE_IDS` に A-1 の price ID を入れると、その価格だけを PRO として認める（推奨）。`npx wrangler deploy` で workers.dev の URL を得る。

### C. アプリの設定（オーナーから受け取ったら Codex が行う）
受け取るもの：workers.dev の URL、公開鍵（keygen の2つ目の出力）、顧客ポータルのリンク、テストの支払いリンク。
- テスト時：`data/product_tiers.json` の `checkout` に `apiBase`・`publicKey`・`portalLink`・テスト用 `paymentLink` を入れ、`status` は **live**。ただし公開サイトで試すと一般の人に課金画面が出るので、**テストはローカルで行い**、`localStorage 'saww.billingTest'`（localhost だけで効く）で差し替える。公開版は test のままにする。
- 本番：Stripe を本番モードにし、本番の鍵・価格・Webhook・支払いリンクを同じ手順で作り直して入れる。`status` を live にして公開。

### D. 検証（実機）
1. ローカル（`python3 -m http.server 8765 --bind 127.0.0.1`）で無料版を開く。
2. 「PRO にする」→ Stripe テストの支払い（テストカード 4242 4242 4242 4242）。
3. `/activate` を経て、PRO の機能が即時に使えること。
4. 別の端末（ログインのメール）でも PRO になること。
5. ポータルで解約 → 期間末まで PRO、期間末以降に FREE になること（Webhook の `customer.subscription.updated`／`deleted` で確認）。
6. iPhone 実機：Safari で同じ流れ。画面を閉じると音が止まる仕様（表記に記載済み）を確認。

## 4. 注意
- 秘密の鍵（ENT_PRIVATE_JWK）・rk_…・whsec_… はチャットにもリポジトリにも書かない。Cloudflare の secret にだけ入れる。
- 住所・電話をリポジトリに入れない。
- Stripe は**テストモード**で始める。本番の課金は、D の検証が全部通ってから。
- 解約・返金の文面（`data/legal.json` の policy）を変える時はオーナーに確認する。
- 関連：`server/README.md`（手順の全文）、`docs/PRODUCT_TIERS.md`、`docs/BILLING_SETUP.md`（プロジェクトにもある）。
