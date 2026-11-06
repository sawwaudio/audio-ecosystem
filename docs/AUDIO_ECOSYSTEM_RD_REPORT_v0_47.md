# saww audio ecosystem R&D レポート v0.47
**2026-11-06（チャット）／見た目をポップに：画面全体の配色・書体・動き、リールの「ポップ」テンプレート5配色**

## 0. 前提と公開
- v0.46（自動実行・Web MIDI）を取り込んでから作業した。
- 公開先：https://sawwaudio.github.io/audio-ecosystem-sounds-1/（音源リポジトリの index.html）。
- 方針と理由は `docs/VISUAL_STYLE_v0_47.md` にまとめた。

## 1. 変更したファイル
| ファイル | 内容 |
|---|---|
| build/integrate_v047_pop.py（新規） | 色の対応表での置き換え、書体の読み込み、ヘッダーの「音の花」、リールの選択肢、スクリプト・CSS・辞書の埋め込み |
| build/src_studio.js | リール「ポップ」（drawPop・5配色・書体の読み込み）、タイルの波形をグループの色に、鳴っている間の `body.live` |
| build/src_studio.css | 新しい色・書体・番号の丸・グループの色・押した時の弾み・下のバー |
| build/src_midi.js | 色を新しい配色に合わせた |
| build/src_i18n.js | テンプレート名の英語 |
| build/photo_fixture.js | Google Fonts を外へ出さない（AE_FONT_DIR で本物の書体） |
| build/test_reel_pop_v047.js（新規）、build/test_reel_motion.js | テスト |
| docs/VISUAL_STYLE_v0_47.md（新規）、AUTOMATION_LOG.md | 方針と記録 |

## 2. テスト
- 新規 `build/test_reel_pop_v047.js`：ALL PASS。確認した項目は次のとおり。
  - 既定がポップ（ひまわり）で、テンプレートの先頭に5配色があること。書体の読み込みがあること。
  - 5配色の地の色。
  - 音で絵が動くこと（縮小画像のフレーム差 7.5）。
  - 描画 約0.4ms。
  - 鳴いている生き物と写真。
  - 画面の色（地・主ボタン・タイルの枠がグループの色）、音の花のマーク。
  - ポップで15秒の録画を書き出せて、写真のクレジットが入ること。
  - 英語表示（未翻訳0）、390px で横はみ出しなし、エラー0。
- 既存23本：すべて合格。期待値を変えたのは test_reel_motion のテンプレートの選択肢だけ。
  - リール系（reel・reel_motion・studio_v043・reel_pop）は単独実行で合格。4本の並列実行では、録画のフレーム数が負荷で足りずに落ちることがある（従来どおり）。

## 3. 未検証・既知の制限
- iPhone 実機（書体の読み込みの速さ、録画中の滑らかさ）。
- Google Fonts を読めない環境では、端末の書体で表示する。リールの1枚目だけ、書体が切り替わる前に描かれることがある。
- 写真は、この環境では Wikimedia に出られないため試験画像で確認した。公開サイトでは本物の写真が入る。
