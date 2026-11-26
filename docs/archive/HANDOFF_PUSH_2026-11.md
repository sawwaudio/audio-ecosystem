# Mac の Claude Code に渡したプッシュ手順（2026-11-16〜11-20）— すべて実行済み

プロジェクトの claude/HANDOFF_PUSH_20261116.md・HANDOFF_PUSH_20261119.md・HANDOFF_PUSH_v080.md・HANDOFF_PUSH_v082.md の要約。いずれも実行済みで、中身は v0.83 以降の main にすべて入っている。2026-11-26 にプロジェクトから削除した。

- **20261116（完了）：** 4件を main にプッシュ済み（0f99206..0dee77a）。
  - 内容：44px のタッチ領域、配信の長時間テスト、トノサマバッタの和名の典拠、初回ガイド。
  - テスト 58本すべて終了コード0。プッシュは旧名の URL（ss2d5sgg-tech/audio-ecosystem）経由でだけ通った。
- **20261119（v0.79）：** バンドルで本体5コミットと音源1コミットを渡す手順。実録音 127→150。音源を先にプッシュする。
- **v080：** v0.79＋v0.80 を作業ブランチ review-v080 へ。音源の審査台帳と公開ゲート、NPS の地球の音7本（150→157）。
- **v082：** dev/sound-review へ。
  - 中身：審査台帳（APPROVED/REVIEW/REJECTED）、イエローストーン（NPS・PD）15本（150→165）、Codex の reels-engine と billing（Python のサンドボックス）。
  - 追記：dev/ai-guard-video-import（v0.83）と rebase でまとめる。
- **共通の決まり：**
  - force push・origin のコミットの書き換えはしない。
  - 音源リポジトリを先にプッシュする。
  - test_integrate_v072 は負荷で落ちることがあるので、単独で再実行する。
  - 認証情報をファイルに書かない。
