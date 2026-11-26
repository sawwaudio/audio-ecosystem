# SAE の版の歴史（要点）

2026-11-26 にプロジェクトの資料を整理した時に作った。詳しい内容は、アプリのリポジトリ sawwaudio/audio-ecosystem の docs/（各版の R&D レポート）、docs/archive/、git log を見る。v0.72 以降は git のコミットと claude/RELEASE_v0xx.md が正本。

| 版 | 主な変更 | 詳細 |
|---|---|---|
| v0.24 | 音源形式の監査、原本から作る PCM WAV の再生経路、音源と本体の分離（INSTRUCTION_01 の Action 1〜3） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_24.md |
| v0.27 | 商用モード 第1段階 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_27.md |
| v0.29 | 商用モードの区分バッジ | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_29.md |
| v0.30 | プリセットの商用モード・区分・帰属情報 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_30.md |
| v0.31 | リールモード 最小版 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_31.md |
| v0.32 | リールの自動レンダリングとキャプション案 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_32.md |
| v0.34 | UI 再設計 第1段階 | docs/archive/AUDIO_ECOSYSTEM_RD_REPORT_v0_34.md |
| v0.35 | DJ ミキサー（第1段階 M1） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_35.md |
| v0.36 | DJ ミキサー（第2段階 M2：拍に同期するエフェクト） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_36.md |
| v0.37 | リールの見た目「動き」 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_37.md |
| v0.39 | DJ ミキサー M2 の残り2種（トランスゲート・ビットクラッシュ） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_39.md |
| v0.40 | DJ ミキサー M2 の仕上げ（効果の選択ボタン・専用つまみ） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_40.md |
| v0.41 | DJ ミキサー M3（チャンネルごとの空間系） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_41.md |
| v0.42 | DJ ミキサー M4（サンプラー／スライサー） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_42.md |
| v0.43 | 引き継ぎ指示書 2026.11.05（TASK 1〜3）、Image-First UI Update、オーナーの要望（全体の LOW/MID/HIGH・リールの区画化・maxim_codex の参考） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_43.md |
| v0.44 | DJ ミキサー・サンプラー M5 第1段階 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_44.md |
| v0.45 | UI 再設計（並び順・重複の解消・説明の畳み込み）と、実録音の楽器層（低音ドローン・打撃） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_45.md |
| v0.46 | DJ ミキサー・サンプラー M5 第2段階：Web MIDI | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_46.md |
| v0.47 | 見た目をポップに：画面全体の配色・書体・動き、リールの「ポップ」テンプレート5配色 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_47.md |
| v0.48 | 自然の美しさを保った上質な見た目（リール「自然」が既定）、生き物と環境音を分ける | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_48.md |
| v0.49 | ロゴ、生き物と環境音のタブ、音ごとの音量と休み、「鳴っている音」の一覧、写真のない生き物のイラスト、楽器（実録音）と合成音の整理、密度のつまみ、旋律の実録音4種 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_49.md |
| v0.50 | DJ ミキサー・サンプラー M5 の残り：MIDI の相対エンコーダー・ソフトテイクオーバー | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_50.md |
| v0.51 | 合成音の置き換えの準備第1段階：「合成音を鳴らさない（楽器は実録音だけ）」 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_51.md |
| v0.52 | 合成音の置き換えの準備の残り②：層の設定（合成音を鳴らさない・密度）をプリセットに保存 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_52.md |
| v0.53 | 軽くする（軽量の音源を既定に・一度鳴らした音を端末に保存）、画面の重複を減らす | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_53.md |
| v0.54 | DJ ミキサー M4 の残り：パッドごとの音量・継ぎ目のゼロ交差合わせ | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_54.md |
| v0.55 | 伝統楽器6種、無料版で出せる楽器を限る | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_55.md |
| v0.56 | DJ ミキサー M4 の残り：サンプラーの区間の拡大表示 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_56.md |
| v0.57 | 課金（Stripe の支払いリンク・月額）と、無料版と PRO の区別、領収書の自動メール | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_57.md |
| v0.58 | 初期設定で鳴らす音を「ディジュリドゥ・低音・鳥」にする | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_58.md |
| v0.59 | 特定商取引法に基づく表記と定期購入の表示、生き物と環境音のイメージ写真 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_59.md |
| v0.60 | DJ ミキサー M5 の残り：MIDI 出力（機器のランプ） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_60.md |
| v0.62 | DJ ミキサー M2 の残り：自律演奏の楽器を BEAT FX のテンポの拍に合わせる | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_62.md |
| v0.63 | 無料版で鳴らせる生き物の声を、分類ごとに4種に絞る | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_63.md |
| v0.65 | リール録画中にタブが裏に回った時の描画停止の対策（バックログ 2④） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_65.md |
| v0.66 | リールの最後に「音のクレジット」を映像の中に出す（帰属テロップ。バックログ 3①） | docs/archive/AUDIO_ECOSYSTEM_RD_REPORT_v0_66.md |
| v0.67 | CC BY-SA を含む書き出しの扱い（バックログ 3③） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_67.md |
| v0.68 | 未反映パッチ4件の合流と、スマートフォンの入力欄（バックログ A） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_68.md |
| v0.70 | A4＝432Hz・5-limit 純正律の音律エンジン（第1段階） | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_70.md |
| v0.71 | 楽器サンプルを基準・音律に合わせる切り替え（既定オフ）と、書き出しのクレジットへの音律の記載 | docs/AUDIO_ECOSYSTEM_RD_REPORT_v0_71.md |

## 前後の版

| 版 | 主な変更 |
|---|---|
| v0.23 | 出発点。自然録音32本・楽器8音色の単一 HTML。非圧縮・原本優先の方針（docs/archive/INSTRUCTION_01_RD_v0_23.md） |
| v0.72〜v0.78 | 配信（?live=auto）の長時間テスト、44px のタッチ領域、和名の典拠、初回ガイド（docs/archive/HANDOFF_PUSH_2026-11.md） |
| v0.79 | 実録音 127→150 |
| v0.80〜v0.82 | 音源の審査台帳と公開ゲート、NPS（パブリックドメイン）の地球の音。150→165 |
| v0.83 | Semi-Pro・書き出しは Pro のみ（リール動画は全プラン）・8言語・AI 利用の禁止・動画から音声を取り出す（claude/RELEASE_v083.md） |
| v0.84 | 録音の買い取り（課金中の人が送り、採用1本 US$1 を差し引き・月 US$5 まで。課金サーバーの更新待ち）、言語は選択欄だけに |
| v0.85 | ペダルボード7種（claude/RELEASE_v085.md） |
| v0.86 | 共有リンク（音の組み合わせを URL で渡す）、ペダルをプリセットに保存（claude/VISION.md） |

## 2026-11-26 にプロジェクトから消した資料と、その置き場
- 開発レポート v0.24〜v0.71 → リポジトリの docs/（v0.34・v0.66 は docs/archive/）。
- 最初の指示書 INSTRUCTION_01〜03、ジオフォニーの候補 → docs/archive/。
- 適用済みのパッチ（claude/patches/）→ 中身は main の git 履歴にある。
- 古い引き継ぎ（HANDOFF_PUSH の4件）→ docs/archive/HANDOFF_PUSH_2026-11.md に要約。HANDOFF_BILLING_v0_64 → docs/HANDOFF_BILLING.md と同じ。
- AUTOMATION_BRIEF・AUTOMATION_LOG（止めた5時間ごとの自動改善）→ docs/ にある。
- 候補表（candidate_master_v0_25R.csv・additional_candidates_v0_25R2.csv・WILDLIFE_SOUND_CANDIDATES_v0_25R.md）→ docs/ にある。wildlife_master_db_v0_24.csv は research/wildlife_master_db.csv（新しい版）に置き換わっている。
