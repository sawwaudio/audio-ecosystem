# ジオフォニー（大地と空の音）の実録音候補 v0.66
**2026-11-08（チャット）／オーナー要望「今までに無い視点で実録音を」→ 選んだ方向：大地と空の音（ジオフォニー）**

生き物の声（バイオフォニー）でも環境の音（川・雨・波・風）でもない、**大地そのものが鳴る音**：泥火山・噴気孔・間欠泉・凍った湖の鳴き・雷。

## 0. 前提
- このチャットの作業環境からは Freesound・nps.gov に接続できない（ネットワークの許可外。回避はしていない）。**音声ファイルは取得していない**。ライセンスは各ページを読んで確認した。
- 取り込みには、オーナーの Mac でのダウンロードが要る。ファイルを渡してもらえば、build/import_japan_beds.py と同じ手順で取り込む（抜粋はビット単位で原本のまま、互換 MP3、SHA-256、台帳・監査表）。
- 採用するのは CC0 と、米国の国立公園局（NPS）がパブリックドメインと明記したものだけ。CC BY-NC・CC BY-SA・権利の記載がないものは入れない。

## 1. 採用候補（ライセンス確認済み）
| # | 案の ID | 内容 | 録音地（原典の記載） | 原典 | ライセンス | 形式 |
|---|---|---|---|---|---|---|
| 1 | mud-volcano-gryphons | 泥火山（グリフォン）の一つずつの噴き出し | 米国カリフォルニア州ソルトン湖、Davis-Schrimpf Seep Field | Freesound 415609「Mud Volcanos - Salton Sea」RTB45、10分28秒 | CC0 | WAV 44.1kHz/16bit ステレオ |
| 2 | mud-volcano-field | 泥火山の原（全体） | 同上 | Freesound 415608「Mud Volcano Field - Salton Sea」RTB45、4分08秒 | CC0 | WAV 44.1kHz/16bit ステレオ |
| 3 | thunder-meadow | 草原の遠雷と雨（夏の朝） | ベルギー、アルデンヌ（説明文） | Freesound 196125「distant thunders meadow」Yuval、8分27秒 | CC0 | WAV 48kHz/24bit ステレオ |
| 4 | thunder-strike | 雨のほとんどない激しい落雷 | ドイツ、バーデン＝ヴュルテンベルク州ビリヒハイム | Freesound 446753「Heavy Thunder Strike - no Rain - QUADRO」BlueDelta、1分02秒 | CC0 | WAV 48kHz/24bit 4ch（取り込み時にステレオへ。方法を記録する） |
| 5 | yellowstone-singing-lake | 凍ったイエローストーン湖の氷が鳴る音 | 米国イエローストーン国立公園、イエローストーン湖（2013-12-17） | NPS「Singing Lake」NPS/Jennifer Jerrett | パブリックドメイン（NPS） | MP3 のみ |
| 6 | black-growler | 噴気孔ブラック・グラウラーの蒸気の轟き（バイノーラル） | 同公園 ノリス・ガイザー・ベイスン（2015-03-23） | NPS「Black Growler Steam Vent (Binaural)」NPS/Peter Comley | パブリックドメイン（NPS） | MP3 のみ |
| 7 | dragons-mouth | 洞窟の熱水泉ドラゴンズ・マウスのうなり | 同公園 ドラゴンズ・マウス泉（2013-10-29） | NPS「The Dragon's Mouth」NPS/David Restivo | パブリックドメイン（NPS） | MP3 のみ |
| 8 | fountain-paint-pot | 泥の泉（マッドポット）がぼこぼこ鳴る音 | 同公園 ファウンテン・ペイント・ポット（2014-05-01） | NPS「Fountain Paint Pot」NPS/Jennifer Jerrett | パブリックドメイン（NPS） | MP3 のみ |
| 9 | norris-fumaroles | 小さな噴気孔の群れ | 同公園 ノリス、ポーセリン・スプリングスの流れ（2014-01-31） | NPS「Fumaroles (small)」NPS/Jennifer Jerrett | パブリックドメイン（NPS） | MP3 のみ |
| 10 | grand-geyser | グランド・ガイザーの噴出（ステレオ・西側） | 同公園（2015-03-22） | NPS「Grand Geyser」NPS/Jennifer Jerrett | パブリックドメイン（NPS） | MP3 のみ |

- NPS の権利の文言（イエローストーンのサウンドライブラリのページ）：「The files available here were recorded in the park and are in the public domain. They may be downloaded and used without limitation; however, please credit the "National Park Service" where appropriate.」→ 帰属表示は「National Park Service」を入れる。
- NPS のファイルは MP3（非可逆）しか公開されていない。**原本も MP3 として扱い、WAV に変えても高音質とは呼ばない**。画面の音源形式の表示にも「原本 MP3」と出す。
- ダウンロード先（NPS）：https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm から各ページ（sounds-singinglake.htm・sounds-blackgrowler.htm・sounds-dragonsmouth.htm・sounds-fountainpaintpots.htm・sounds-fumaroles.htm・sounds-grandgeyser.htm）。
- ダウンロード先（Freesound）：https://freesound.org/s/415609 ・ /415608 ・ /196125 ・ /446753（ログインが必要。元の WAV を選ぶ）。

## 2. 入れないもの（理由）
| 内容 | 原典 | 理由 |
|---|---|---|
| セント・ヘレンズ山の噴火（1980、240km 先） | Freesound 21432 | CC BY 4.0。採用は可能だが、ラジオ等の再録の可能性があり実録音かを確かめられない。保留 |
| 凍った湖の鳴き（スイス） | Freesound 47201 | CC BY 4.0。保留（CC0 を優先。必要なら次の候補） |
| 氷上のスケート（オランダ） | Freesound 377626 | CC BY 4.0 に加え「ストック素材に使わない」という独自の条件があり、製品に入れられない |
| 遠雷（フィリピン） | Freesound 837620 | CC BY 4.0。保留 |
| 雷雨（ロシア）・夜の雷雨（英国） | Freesound 841358・668716 | CC BY-NC（禁止） |
| 氷河の崩落・氷のはじける音（グレイシャー・ベイ） | NPS グレイシャー・ベイ | ページに権利の記載がない（H. Lentfer / NPS の表記のみ）。確認できるまで入れない |
| 鳴き砂（グレート・サンド・デューンズ） | NPS | ページに権利の記載・録音者の記載がなく、音声は YouTube。入れない |
| 溶岩の流れ（ハワイ） | DVIDS 59519 | 「PUBLIC DOMAIN」の表記はあるが24秒と短く、録音の素性（個人名の記載）を確かめられない。保留 |
| 雷（イエローストーン） | NPS「Thunder」 | パブリックドメインだが、コマツグミの声が混ざる。雷だけの音としては使わない（必要なら生き物の混ざる環境音として） |

## 3. 置き方の案
- 分類：環境音（data/sound_categories.json）に新しいまとまり「大地と空（ジオフォニー）」を足す。生き物の種数には数えない。
- 無料版：環境音は無料版でも全部鳴る（v0.63 の方針）ので、そのまま無料。
- 鳴らし方：泥火山・噴気孔・湖の氷は持続する層（環境層）。落雷・間欠泉の噴出はときどき鳴る出来事として、自律演奏でまれに鳴らす。
- 写真：学名がないため、v0.59 のイメージ写真（Commons の CC0・PD）で付ける。
- 録音地は原典の記載のまま書く（分布ではない）。
