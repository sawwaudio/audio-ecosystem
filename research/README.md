# research/ — 音源の審査台帳（研究用メタデータ）

- `source_review.json` / `source_review.csv`：探索した音源候補すべて。`verification_status` は APPROVED（権利・文化的条件をすべて確認）／REVIEW（追加確認が必要）／REJECTED（採用不可）。
- このフォルダはアプリ（index.html）から読まれない。公開ライブラリに入るのは APPROVED になり、`build/integrate_v082.py` などで取り込んだ録音だけ。
- 神聖・儀礼の音源（Shipibo-Konibo の ícaros、葬送歌唱、宗教儀礼など）はメタデータだけを置き、音声ファイルは持たない・加工しない・配信しない・AI 学習に使わない。
- `nps_verified.json`：取得した NPS 原本 MP3 の長さ・形式・SHA-256（APPROVED の条件）。
- 作成・更新：`python3 build/review_v082.py`（公開中の録音の verificationStatus も付け直す）。
