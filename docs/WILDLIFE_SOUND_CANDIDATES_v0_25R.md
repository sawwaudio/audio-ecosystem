# AUDIO ECOSYSTEM — 生物音源候補調査 v0.25-R
**調査日：2026年10月31日**
**前提：v0.24（R&Dレポート v0.24）／アプリの改造は行っていない**

**重要：本書の「採用可能」は、出典ページで実在・形式・ライセンスを確認したという意味。この環境からは音声をダウンロードできないため、1本も取得・試聴していない。音響スコアはすべて暫定（ページ記載と種の発声特性からの見積もり）。**

---

## 0. 要約

| 区分 | 対象数（52） |
|---|---|
| 採用可能な候補あり（実在・形式・ライセンス確認済み。うちフクロウ・ヨタカは日本に分布しない近縁種） | 18 |
| 既にアプリ収録済み（ウグイス・ホトトギス・カジカガエル・スズムシ混合のうち新候補なし） | 3 |
| 一部のみ（ミソサザイ：警戒声のみ） | 1 |
| 未確認・未確定（ページ未読・ファイル名のみ・種名に疑義） | 6 |
| 未発見（採用可能なものが見つからない） | 24 |

- 採用条件を満たす録音は **29本**（CC0 14本、CC BY 12本、パブリックドメイン 3本）。うち **WAV/AIFF は25本**（ただし2本は元が圧縮音源）、ロスレス（FLAC）1本、圧縮3本。
- 対象52種の外の追加候補として、**日本（千葉県柏市）録音の鳴く虫の合唱**（96kHz/24-bit・CC0）を確保。v0.24 で「日本録音の環境音が0本」だった穴を埋められる初の候補。
- **商用不可（NC）などで除外：15件**。MBARIのシャチ・マッコウクジラ、ノロジカの長尺録音、ザトウクジラの別アーカイブなど、音質の高いものほどNCが多かった。
- 指示書の15件のうち、個別ページで確認できたのは5件（キツネ、フクロウとキツネ、ゾウ、キツツキ、池のカエル）。残り10件は Freesound 側の読込失敗または検索に出ず未確認（フクロテナガザルは投稿者一覧で動物園録音であることのみ確認）。

---

## A. 生物音源候補マスター（52対象）

全項目（形式・サンプルレート・ビット深度・再生時間・サイズ・ライセンス・録音地・野外/飼育・重複・暫定スコア）は `candidate_master_v0_25R.csv` に収録。以下は対象ごとの結論。

### 鳥類（14）
| # | 対象 | 結論 | 候補 |
|---|---|---|---|
| 1 | ウグイス | 候補あり | 横浜録音 48kHz CC0（既存の岐阜録音 11kHz とは別録音） |
| 2 | ミソサザイ | 一部 | 警戒声のみ（CC BY・48k/24）。さえずりは未発見 |
| 3 | コマドリ | 未発見 | xeno-canto にはあるがライセンス未確認 |
| 4 | オオルリ | 未発見 | 同上 |
| 5 | キビタキ | 未発見 | 同上 |
| 6 | ホトトギス | 収録済み | 新候補なし |
| 7 | アビ類 | 候補あり（圧縮） | USFWS ハシグロアビ（PD・MP3/OGG）。48k/24の高品質録音はNCで除外 |
| 8 | フクロウ | 近縁種のみ | モリフクロウ3件（日本に分布しない種）。日本のフクロウは未発見 |
| 9 | アオバズク | 未発見 | |
| 10 | ヨタカ | 近縁種のみ | ヨーロッパヨタカ（CC BY）。日本のヨタカは未発見 |
| 11 | キツツキ類 | 候補あり | ドラミング（CC0・種名記載なし） |
| 12 | ライチョウ | 未発見 | |
| 13 | カワセミ | 未発見 | 近縁2種の録音はNCで除外 |
| 14 | コトドリ | 候補あり | 野外（CC0）と保護施設（CC0・iPhone）の2件 |

### 哺乳類（12）
| # | 対象 | 結論 | 候補 |
|---|---|---|---|
| 15 | キツネ | 候補あり | Fox Cry（CC0・48k/24・種名記載なし）、フクロウとの混合録音 |
| 16 | ノロジカ | 未確認 | 指示書の候補は未読。見つかった42分の録音はNC |
| 17 | ニホンジカ | 未確認 | British Library の Commons ファイル（ページ未読） |
| 18 | ニホンザル | 未発見 | |
| 19 | フクロテナガザル | 候補あり（動物園） | 香港動物園のペア（CC BY） |
| 20 | ホエザル | 候補あり | クロホエザル・ベリーズ 8分25秒（CC BY・ミニディスク由来） |
| 21 | ゾウ | 候補あり（動物園・短尺） | ベルギーの動物園 7.8秒（CC0） |
| 22 | オオカミ | 候補あり | フランス・ヴェルコールの群れ（CC BY・48k/24） |
| 23 | コヨーテ | 未確定 | 唯一のCC BY候補は中東録音で、コヨーテは中東に分布しないため種名に疑義 |
| 24 | コウモリ | 候補あり | 0.05倍速の可聴化（CC0・96k/24）、裏庭録音（CC BY） |
| 25 | ワオキツネザル | 未発見 | "lemur" 名の候補は画像から合成した音で除外 |
| 26 | オットセイ | 未発見 | オットセイ録音はNC。チリのアシカ（CC0）を「アシカ科」の別枠で登録し、オットセイとしては計上しない |

### 両生類・爬虫類（8）
| # | 対象 | 結論 | 候補 |
|---|---|---|---|
| 27 | アマガエル | 未発見 | フランスのアマガエル類（種不明・CC BY）は日本のアマガエルとして計上しない |
| 28 | モリアオガエル | 未発見 | |
| 29 | カジカガエル | 収録済み | 日本録音の候補は未発見 |
| 30 | シュレーゲルアオガエル | 未発見 | |
| 31 | トノサマガエル | 未発見 | |
| 32 | ウシガエル | 候補あり（圧縮由来） | 香港（CC BY・iPhone AAC 由来） |
| 33 | ヨーロッパヒキガエル | 未確認 | 指示書の Breviceps 録音は存在のみ確認、詳細ページ読込失敗 |
| 34 | トッケイヤモリ | 候補あり（圧縮） | ラオス（PD・73kbps） |

### 水中生物（9）
| # | 対象 | 結論 | 候補 |
|---|---|---|---|
| 35 | ザトウクジラ | 候補あり | MBARI 深海ハイドロフォン 103分 WAV（CC BY）。別に公開データからの空間レンダリング（CC BY・加工素材） |
| 36 | シロイルカ | 未発見 | |
| 37 | シャチ | 候補あり（圧縮） | NPS グレーシャーベイ（PD・74kbps）。MBARI の WAV は NC |
| 38 | マッコウクジラ | 未発見 | MBARI 録音は NC |
| 39 | マイルカ類 | 候補あり（種不明） | カリブ海（CC0・48k/24）。アマゾンカワイルカ（CC0・96k/24）は別科として別枠 |
| 40 | テッポウエビ | 未発見 | |
| 41 | イセエビ類 | 未発見 | |
| 42 | ガマアンコウ科 | 未発見 | URI コレクションは再配布不可 |
| 43 | グチ・ニベ類 | 未発見 | 同上 |

### 昆虫・その他（9）
| # | 対象 | 結論 | 候補 |
|---|---|---|---|
| 44 | スズムシ | 収録済み（混合のみ） | 単独種録音は未発見 |
| 45 | マツムシ | 未発見 | |
| 46 | カンタン | 未発見 | |
| 47 | カネタタキ | 未発見 | |
| 48 | ケラ | 候補あり（ロスレス） | BioAcoustica FLAC 9分24秒（CC BY 3.0・飼育下） |
| 49 | ウマオイ | 未発見 | |
| 50 | コオロギの異なる発声種 | 未確認 | BioAcoustica の FLAC（Teleogryllus sp. など）をファイル名でのみ確認 |
| 51 | キリギリス類の未収録種 | 未確認 | BioAcoustica の FLAC（Phaneroptera falcata など）をファイル名でのみ確認 |
| 52 | 発音する甲虫類 | 未発見 | |

---

## B. 採用候補ランキング（上位20）

順位は、合計点に加えて**音響的な多様性**で決めた（同じ系統の音が続く場合は2本目を下げる）。暫定スコアは9項目×5点＝45点満点（音色独自性・リズム独自性・旋律性・倍音・低音・空間性・ノイズの少なさ・ループ適性・組合せやすさ）。**未試聴の見積もりであり、取得後に聴感評価で更新する。**

| 順位 | 生物 | 録音 | 形式・長さ | ライセンス | 暫定点 | 採用理由 |
|---|---|---|---|---|---|---|
| 1 | ザトウクジラの歌 | [MBARI_MARS 496870](https://freesound.org/people/MBARI_MARS/sounds/496870) | WAV 32k/16/mono · 103分 | CC BY 4.0 | 39 | 既存に無い海洋・低域・旋律。長尺から非反復素材を切り出せる |
| 2 | アマゾンカワイルカ | [felix.blume 408555](https://freesound.org/people/felix.blume/sounds/408555/) | WAV 96k/24/st · 2:48 | CC0 | 36 | クリックと笛が混ざる水中音 |
| 3 | オオカミの群れ | [Sacha.Julien 762242](https://freesound.org/people/Sacha.Julien/sounds/762242/) | WAV 48k/24/st · 0:51 | CC BY 4.0 | 36 | 森林に広がる持続音。ドローン層向き |
| 4 | クロホエザル | [RTB45 148422](https://freesound.org/people/RTB45/sounds/148422/) | WAV 44.1k/16/st · 8:25 | CC BY 4.0 | 33 | 生物音で最も低い部類の唸り（ミニディスク由来） |
| 5 | フクロテナガザル | [RTB45 327443](https://freesound.org/people/RTB45/sounds/327443/) | WAV 44.1k/16/st · 0:48 | CC BY 4.0 | 33 | 強い共鳴の旋律（動物園） |
| 6 | コトドリ | [samarobryn 399796](https://freesound.org/people/samarobryn/sounds/399796/) | WAV 44.1k/16/st · 0:28 | CC0 | 34 | 模倣を含む複雑な旋律 |
| 7 | イルカ（種不明） | [felix.blume 161691](https://freesound.org/people/felix.blume/sounds/161691/) | WAV 48k/24/mono · 0:44 | CC0 | 33 | 海中の笛状発声 |
| 8 | アシカ（種不明） | [felix.blume 498626](https://freesound.org/people/felix.blume/sounds/498626/) | WAV 48k/24/st · 4:47 | CC0 | 30 | 不規則な低音の群れ |
| 9 | コウモリ（可聴化） | [Garuda1982 755275](https://freesound.org/people/Garuda1982/sounds/755275/) | WAV 96k/24/st · 0:51 | CC0 | 30 | 超音波の変換素材（Experimental） |
| 10 | ヨーロッパヨタカ | [Benboncan 75073](https://freesound.org/people/Benboncan/sounds/75073/) | WAV 44.1k/16/st · 0:18 | CC BY 4.0 | 32 | 機械的な連続パルス。ループ向き |
| 11 | 鳴く虫の合唱（日本・柏） | [RutgerMuller 365257](https://freesound.org/people/RutgerMuller/sounds/365257/) | WAV 96k/24/st · 3:23 | CC0 | 31 | 日本録音の環境層として初の候補 |
| 12 | ゾウ | [ikbenraar 819668](https://freesound.org/people/ikbenraar/sounds/819668/) | WAV 48k/16/st · 0:07.8 | CC0 | 29 | 低い唸りと倍音（動物園・短尺） |
| 13 | ウグイス（横浜） | [warukunai 524526](https://freesound.org/people/warukunai/sounds/524526/) | WAV 48k/16/st · 0:56 | CC0 | 28 | 既存より全帯域の日本録音 |
| 14 | キツネ | [Simon Spiers 431302](https://freesound.org/people/Simon%20Spiers/sounds/431302/) | WAV 48k/24/st · 0:46 | CC0 | 29 | 夜間の鋭い間欠発声 |
| 15 | 夜の野原（モリフクロウ＋キツネ） | [bruno.auzet 850410](https://freesound.org/people/bruno.auzet/sounds/850410/) | WAV 48k/24/st · 5:44 | CC0 | 32 | 空間性の高い夜の環境録音（混合1件として計上） |
| 16 | キツツキ類 | [johnaudiotech 347047](https://freesound.org/people/johnaudiotech/sounds/347047/) | WAV 44.1k/16/st · 0:34 | CC0 | 29 | 自然のパーカッション |
| 17 | ケラ | [BioAcoustica 900-6](https://commons.wikimedia.org/wiki/File:BioAcoustica_900_6_Gryllotalpa_orientalis_125.flac) | FLAC · 9:24 | CC BY 3.0 | 29 | 連続的な低い振動音（ロスレス） |
| 18 | 池のカエル群 | [Sandermotions 278871](https://freesound.org/people/Sandermotions/sounds/278871/) | WAV 96k/24/st · 0:35 | CC0 | 30 | 粒状のテクスチャー |
| 19 | トッケイヤモリ | [Commons（Richard Ling）](https://commons.wikimedia.org/wiki/File:Mating_call_of_a_male_Tokay_gecko_(Gekko_gecko).ogg) | Ogg 73kbps · 0:29 | PD | 26 | 爬虫類で唯一の反復発声（圧縮） |
| 20 | シャチ | [Commons（NPS）](https://commons.wikimedia.org/wiki/File:Killer_whale.ogg) | Ogg 74kbps · 0:30 | PD | 30 | パルス状発声（圧縮） |

次点：マレーシアのカエル群（CC0・AIFF 48k/24・3分33秒）、モリフクロウ2羽（CC BY）、ウシガエル（CC BY・AAC由来）、アマガエル類（CC BY・DAT）、コトドリ（保護施設・CC0）。

---

## C. ダウンロード可能な素材（権利・取得方法・原本形式を確認済み）

取得方法：Freesound はログイン後に原本ファイルをダウンロード。Commons は原本ファイルを直接取得。**どちらもこの作業環境のネットワークからは接続できない。**

| 生物 | 投稿者 | 形式・サイズ | ライセンス | 帰属表示 |
|---|---|---|---|---|
| キツネ | [Simon Spiers](https://freesound.org/people/Simon%20Spiers/sounds/431302/) | WAV 48k/24/st · 12.6MB | CC0 | 不要 |
| 夜の野原（フクロウ＋キツネ） | [bruno.auzet](https://freesound.org/people/bruno.auzet/sounds/850410/) | WAV 48k/24/st · 95.1MB | CC0 | 不要 |
| ゾウ | [ikbenraar](https://freesound.org/people/ikbenraar/sounds/819668/) | WAV 48k/16/st · 1.4MB | CC0 | 不要 |
| カエル群（マレーシア） | [ikbenraar](https://freesound.org/people/ikbenraar/sounds/819667/) | AIFF 48k/24/st · 58.5MB | CC0 | 不要 |
| キツツキ類 | [johnaudiotech](https://freesound.org/people/johnaudiotech/sounds/347047/) | WAV 44.1k/16/st · 5.7MB | CC0 | 不要 |
| アマゾンカワイルカ | [felix.blume](https://freesound.org/people/felix.blume/sounds/408555/) | WAV 96k/24/st · 92.3MB | CC0 | 不要 |
| イルカ（カリブ海） | [felix.blume](https://freesound.org/people/felix.blume/sounds/161691/) | WAV 48k/24/mono · 6.0MB | CC0 | 不要 |
| アシカ（チリ） | [felix.blume](https://freesound.org/people/felix.blume/sounds/498626/) | WAV 48k/24/st · 78.8MB | CC0 | 不要 |
| 池のカエル群 | [Sandermotions](https://freesound.org/people/Sandermotions/sounds/278871/) | WAV 96k/24/st · 19.5MB | CC0 | 不要 |
| コトドリ（野外） | [samarobryn](https://freesound.org/people/samarobryn/sounds/399796/) | WAV 44.1k/16/st · 4.8MB | CC0 | 不要 |
| コトドリ（保護施設） | [youthful_implants](https://freesound.org/people/youthful_implants/sounds/203498/) | WAV 48k/16/st · 14.3MB | CC0 | 不要 |
| ウグイス（横浜） | [warukunai](https://freesound.org/people/warukunai/sounds/524526/) | WAV 48k/16/st · 10.3MB | CC0 | 不要 |
| コウモリ（可聴化） | [Garuda1982](https://freesound.org/people/Garuda1982/sounds/755275/) | WAV 96k/24/st · 27.8MB | CC0 | 不要 |
| 鳴く虫の合唱（柏） | [RutgerMuller](https://freesound.org/people/RutgerMuller/sounds/365257/) | WAV 96k/24/st · 111.3MB | CC0 | 不要 |
| オオカミ | [Sacha.Julien](https://freesound.org/people/Sacha.Julien/sounds/762242/) | WAV 48k/24/st · 14.0MB | CC BY 4.0 | 要 |
| クロホエザル | [RTB45](https://freesound.org/people/RTB45/sounds/148422/) | WAV 44.1k/16/st · 84.9MB | CC BY 4.0 | 要 |
| フクロテナガザル | [RTB45](https://freesound.org/people/RTB45/sounds/327443/) | WAV 44.1k/16/st · 8.1MB | CC BY 4.0 | 要 |
| ヨーロッパヨタカ | [Benboncan](https://freesound.org/people/Benboncan/sounds/75073/) | WAV 44.1k/16/st · 3.0MB | CC BY 4.0 | 要 |
| モリフクロウ | [Benboncan](https://freesound.org/people/Benboncan/sounds/63220/) | WAV 44.1k/16/st · 7.7MB | CC BY 4.0 | 要 |
| ウシガエル | [soloan](https://freesound.org/people/soloan/sounds/188723/) | WAV 44.1k/16/mono · 5.2MB | CC BY 4.0 | 要 |
| ミソサザイ（警戒声） | [klankbeeld](https://freesound.org/people/klankbeeld/sounds/260797/) | WAV 48k/24/mono · 5.0MB | CC BY 4.0 | 要 |
| コウモリ（裏庭） | [digifishmusic](https://freesound.org/people/digifishmusic/sounds/43824/) | WAV 44.1k/16/st · 3.3MB | CC BY 4.0 | 要 |
| アマガエル類 | [reinsamba](https://freesound.org/people/reinsamba/sounds/15689/) | WAV 44.1k/16/st · 16.8MB | CC BY 4.0 | 要 |
| ザトウクジラ | [MBARI_MARS](https://freesound.org/people/MBARI_MARS/sounds/496870) | WAV 32k/16/mono · 377.2MB | CC BY 4.0 | 要（MBARI） |
| ザトウクジラ＋シャチ（加工素材） | [raiden04](https://freesound.org/people/raiden04/sounds/797762/) | WAV 48k/32/st · 151.8MB | CC BY 4.0 | 要＋元データの条件確認 |
| ケラ | [BioAcoustica（Commons）](https://commons.wikimedia.org/wiki/File:BioAcoustica_900_6_Gryllotalpa_orientalis_125.flac) | FLAC · 48.6MB | CC BY 3.0 | 要（Natural History Museum） |
| シャチ | [NPS（Commons）](https://commons.wikimedia.org/wiki/File:Killer_whale.ogg) | Ogg 74kbps · 267KB | PD | 不要 |
| トッケイヤモリ | [Richard Ling（Commons）](https://commons.wikimedia.org/wiki/File:Mating_call_of_a_male_Tokay_gecko_(Gekko_gecko).ogg) | Ogg 73kbps · 261KB | PD | 不要 |
| ハシグロアビ | [USFWS](https://publicdomainaudiovideo.blogspot.com/2009/08/common-loon.html) | MP3/OGG | PD | 不要 |

**権利の区別**：CC0・PD は取得・変換・アプリ同梱・再配布・商用のすべてが可能。CC BY は同じ範囲で可能だが、アプリの出典表示（クレジット欄）に作者名・タイトル・ライセンスを載せる必要がある。CC BY-SA（モリフクロウ XC565862・ゾウ Siemens）は、加工した派生音源にも同じライセンスが及ぶため、上の表から外して「条件付き」として別管理する。

**品質上の注意**：WAV でも元が圧縮音源のもの（ホエザル＝ミニディスク、ウシガエル＝iPhone AAC）は「非圧縮マスター」と扱わない。raiden04 は公開データからの空間レンダリングで、直接のフィールド録音ではない。

---

## D. 重複レポート

### 既存（v0.23/v0.24 の32録音）との照合
| 新候補 | 既存 | 判定 |
|---|---|---|
| ウグイス（横浜・warukunai） | ウグイス（岐阜・Commons・11024Hz） | 同種・**別録音**。帯域と収録地が異なるため追加理由あり。二重計上はせず「ウグイス」1種の2素材とする |
| 鳴く虫の合唱（柏） | 秋の虫の合唱 2本（兵庫・16kHz） | 同種群・別録音。収録地・音質が異なる。種数には加算しない |
| その他27件 | — | 既存32録音と種・録音とも重複なし |

### 新候補どうし
- **夜の野原（モリフクロウ＋キツネ）**は混合録音1件として計上。キツネ（Fox Cry）・モリフクロウ（Benboncan）とは別録音。
- **シャチ**：NPS（PD）と raiden04（ザトウクジラとの混合・加工素材）は別。
- **ザトウクジラ**：MBARI（直接録音）と raiden04（加工素材）は別。
- **コトドリ**：野外（samarobryn）と保護施設（youthful_implants）は収録環境が異なる別素材。
- **アマゾンカワイルカ**はマイルカ類（カリブ海）と別科として別枠。

### 照合方法と未実施項目
学名・音源ID・原典URL・録音者・録音地で照合した。**SHA-256・音声フィンガープリント・音響類似度は、ファイルを取得できなかったため未実施**（v0.24 の既存32録音どうしの照合は実施済み：最大類似度 0.587、重複なし）。取得後に同じ手順（64帯域スペクトル包絡の相互相関）で再照合する。

---

## E. 除外リスト（15件）

| 録音 | 理由 |
|---|---|
| MBARI 404314 海洋哺乳類の群集 | CC BY-NC 4.0 |
| MBARI 404318 マッコウクジラ | CC BY-NC 4.0 |
| MBARI 458854 シャチ（WAV 64kHz） | CC BY-NC 4.0 |
| listeningtowhales ザトウクジラ（AIFF） | CC BY-NC 3.0 |
| Philip_Goddard ノロジカ（FLAC 42分） | CC BY-NC 4.0 |
| Robinhood76 オットセイ | CC BY-NC 4.0 |
| KevinSonger アメリカヤマセミ | CC BY-NC 4.0 |
| KevinSonger アメリカアマガエル | CC BY-NC 4.0 |
| genghisattenborough アオショウビン | CC BY-NC 4.0 |
| Acoustic Atlas ハシグロアビ（48k/24） | CC BY-NC 4.0 |
| Western Soundscape Archive キツネ | CC BY-NC-ND 3.0 US |
| International Wolf Center オオカミ | All rights reserved |
| URI 魚類音コレクション | 再配布・作品組込・商用不可 |
| NoiseCollector "lemur2b" | 画像から合成した音（実録音ではない） |
| The_Sound_Side "coyotes"（中東録音） | 種名に疑義（コヨーテは中東に分布しない） |

## F. 指示書の候補で未確認のもの（10件）

| 候補 | 状況 |
|---|---|
| Siamang（ikbenraar 819670） | 投稿者一覧で動物園録音と確認。個別ページは読込失敗 |
| Zogzog Monkey（felix.blume 508987） | パック一覧でタイトルのみ確認 |
| Roe Deer（bruno.auzet 850406） | 投稿者一覧に無く未確認 |
| Bat Echolocation（Sacha.Julien 724581） | 投稿者ページに無く未確認 |
| Atlantic Spotted Dolphins（geraldfiebig 385796） | 検索に出ず未確認 |
| Growling Sea Lion（Diim_1 849186） | 検索に出ず未確認 |
| Tree Frogs（knufds 242851）／Small Frog Croaks（clif_creates 802737） | 検索に出ず未確認 |
| Common Toad（Breviceps 462863）／Croaking Frogs（Breviceps 573584） | 462863 は存在のみ確認。573584 は未確認 |

添付ファイル内のURLは、この環境のWeb取得ツールでは直接開けない仕様のため、検索結果に出たページだけを確認した。上の10件は、URLをチャット本文に貼っていただければ確認できる。

---

## G. 次の作業

1. **取得経路**：Freesound（要ログイン）と Commons の原本は、この環境では取得できない。原本ファイルを添付していただくか、Settings → Capabilities で `freesound.org`・`upload.wikimedia.org` を許可していただく必要がある。上位20件の合計は約1.0GB（MBARI 377MB を含む。MBARI は使用範囲を切り出せば大幅に縮む）。
2. **取得後**：SHA-256・フィンガープリント照合、聴感評価で暫定スコアを更新し、v0.25 としてアプリに追加。
3. **日本の生物の不足**：コマドリ・オオルリ・キビタキ・アオバズク・モリアオガエル・シュレーゲルアオガエル・マツムシ・カンタン・カネタタキ・ウマオイは、採用可能な公開録音が見つからなかった。xeno-canto の個別ライセンス確認（CC BY/CC0 のものに限る）、または自前の現地録音（特に伊豆）が必要。
