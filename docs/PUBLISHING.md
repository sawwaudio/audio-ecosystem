# 公開とプッシュの決まり（2026-11-15〜）

## 1. 正本は1つ
- **アプリの正本は本体リポジトリ sawwaudio/audio-ecosystem の main の `index.html`**。公開 URL は **https://sawwaudio.github.io/audio-ecosystem/**（GitHub Pages：main の直下）。
- 音源リポジトリ sawwaudio/audio-ecosystem-sounds-1 は**音源の置き場所だけ**（`audio/`・`instruments/`）。アプリは同じ sawwaudio.github.io の `../audio-ecosystem-sounds-1/…` として読む。
  - 音源リポジトリの `index.html` は本体への転送（URL の ?… と #… をそのまま渡す）。**ここにアプリを置かない・直接編集しない**。
  - 旧 URL（…/audio-ecosystem-sounds-1/）は、YouTube・Instagram の説明欄、OBS の配信、Stripe の支払い後の移動先、管理者の端末登録で使われているため、転送で動かし続ける。
- `legal.html`・`credits.html`・`sw.js`・`diag.html` も本体に置く。`build/deploy_sounds_site.py` は使わない（v0.43〜v0.71 の間の、本体に書き込めなかった時の回避策）。

## 2. なぜ 11/10〜11/14 に2つに分かれたか
- 本体に書き込めない間、公開版は音源リポジトリの `index.html` に置いていた（deploy_sounds_site.py）。
- その後、別のチャット（課金の公開・年末の無料開放・SEMI-PRO・配信用の画面・英語が既定・楽器の試聴の削除）は音源リポジトリの `index.html` を直接直し、自動実行とこのチャット（キー・音律・BY-SA の警告・スマホの入力欄・リールのテンプレートの並び）は本体の `index.html` を直した。
- 2026-11-15 に3方向で合流した（共通の祖先＝本体 31957e5＝音源リポジトリ 2fec13a）。v0.72。

## 3. プッシュできなかった理由と直し方
| 経路 | 症状 | 原因 | 直し方 |
|---|---|---|---|
| クラウドのセッション（自動実行・チャット） | `403 … sawwaudio/audio-ecosystem is not in this session's authorized repository set` | リポジトリを ss2d5sgg-tech から sawwaudio へ移した後も、セッション・定期実行に登録されているのは**旧い名前 ss2d5sgg-tech/audio-ecosystem**。git の中継（プロキシ）は名前で許可を判断するので、新しい名前の URL には認証を付けない | ①（根本）claude.ai の定期実行・環境の「リポジトリ」に **sawwaudio/audio-ecosystem** を追加する（旧い名前は外してよい）。②（それまで）remote を `https://github.com/ss2d5sgg-tech/audio-ecosystem` にする（GitHub が新しい名前へ転送する。2026-11-15 のこのチャットはこの方法で push できている） |
| オーナーの Mac（Cowork の device_bash） | `403 Cowork blocked this request` | Cowork のデスクトップ側の通信の制限で、Mac の仮想環境から github.com への書き込み（git push）が止められている | Mac からの push に頼らない。クラウドから push する（上の①②）。Mac のクローン（v0.34 のまま・未コミットの変更あり）は作業に使わない |

確かめ方：`git push --dry-run origin HEAD:refs/heads/main` が `To https://github.com/…` を返せば push できる。

## 4. 公開の手順（毎回）
1. 本体の main（または作業ブランチ）で直す → `python3 -m http.server 8765` → `node build/test_*.js`（ALL PASS）。
2. main に push すると、数分で https://sawwaudio.github.io/audio-ecosystem/ に出る。
3. 音源を足した時だけ、音源リポジトリにも push する（`index.html` は転送のまま）。
