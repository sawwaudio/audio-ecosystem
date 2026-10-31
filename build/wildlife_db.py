#!/usr/bin/env python3
"""Wildlife Sound Master Database v0.24 (A).

status:
  in-app        アプリ収録済み（音源を保持）
  verified      候補：形式・ライセンス・録音地をページで確認（未取得）
  partial       候補：存在は確認、ライセンスまたは形式が未確認
  excluded      見つかったがライセンス条件で不採用（NC / 再配布不可 / 権利保留）
  not-found     この調査では採用可能な公開録音が見つからない（削除せず管理）
  pending-list  52対象リスト未受領の枠
licenseOK: yes / no / unverified
Every value below comes from a page fetched on 2026-10-31 unless marked unverified.
"""
import csv, json

C = lambda **k: k  # candidate

T = [
 dict(no=1, group='哺乳類', jp='キツネ（アカギツネ）', en='Red fox', latin='Vulpes vulpes', nativeRegions=['europe','asia','north_america','africa','japan'], japanNative=True, japanEndemic=False, status='partial',
      candidates=[C(title='Red Fox (Vulpes vulpes) (W1CDR0001529 BD12).ogg', source='Wikimedia Commons / British Library', url='https://commons.wikimedia.org/wiki/File:Red_Fox_(Vulpes_vulpes)_(W1CDR0001529_BD12).ogg', format='Ogg Vorbis', license='未確認（同シリーズ2件はCC BY-SA 4.0を確認）', licenseOK='unverified', recordedCountry='未確認（英国コレクション）', note='ファイルページ未取得。'),
                  C(title='NPS audio recording - Grand Teton NP - Red Fox', source='Western Soundscape Archive (Univ. of Utah)', url='https://collections.lib.utah.edu/ark:/87278/s6mw2wjr', format='MP3/MP4配信（元WAV）', license='CC BY-NC-ND 3.0 US', licenseOK='no', recordedCountry='米国', note='NCのため不採用。')]),
 dict(no=2, group='哺乳類', jp='シカ（ニホンジカ）', en='Sika deer', latin='Cervus nippon', nativeRegions=['asia','japan'], japanNative=True, japanEndemic=False, status='partial',
      candidates=[C(title='Sika Deer (Cervus nippon) (W1CDR0001426 BD2).ogg', source='Wikimedia Commons / British Library', url='https://commons.wikimedia.org/wiki/File:Sika_Deer_(Cervus_nippon)_(W1CDR0001426_BD2).ogg', format='Ogg Vorbis', license='未確認（同シリーズはCC BY-SA 4.0）', licenseOK='unverified', recordedCountry='未確認（英国の移入個体群の可能性）', note='英国録音なら「分布：日本を含む／録音地：海外（移入）」。')]),
 dict(no=3, group='哺乳類', jp='サル（ニホンザル）', en='Japanese macaque', latin='Macaca fuscata', nativeRegions=['japan','asia'], japanNative=True, japanEndemic=True, status='not-found', candidates=[], note='Commonsに音声ファイルが見つからず（動画のみ）。研究データは論文付属で利用条件未確認。'),
 dict(no=4, group='哺乳類', jp='テナガザル', en='Gibbons', latin='Hylobatidae (Hylobates lar ほか)', nativeRegions=['asia'], japanNative=False, japanEndemic=False, status='partial',
      candidates=[C(title='Lar Gibbon hoots.ogg', source='Wikimedia Commons', url='https://commons.wikimedia.org/wiki/File:Lar_Gibbon_hoots.ogg', format='Ogg Vorbis', license='未確認', licenseOK='unverified'),
                  C(title='pone.0071432.s006.oga（Koda et al. 2013 付属）', source='Wikimedia Commons / PLOS ONE', url='https://commons.wikimedia.org/wiki/File:Possible-Role-of-Mother-Daughter-Vocal-Interactions-on-the-Development-of-Species-Specific-Song-in-pone.0071432.s006.oga', format='Ogg Vorbis 23kbps 25秒', license='ページに記載なし（PLOS ONEは通常CC BY）', licenseOK='unverified', recordedCountry='未記載', note='低ビットレート。種・飼育/野生とも未記載。'),
                  C(title='White-handed gibbons discriminate context-specific songs', source='figshare', url='https://figshare.com/articles/media/White-handed_gibbons_discriminate_context-specific_songs_compositions/12363050/1', format='未確認', license='未確認', licenseOK='unverified')]),
 dict(no=5, group='哺乳類', jp='ゾウ', en='Elephants', latin='Elephantidae', nativeRegions=['africa','asia'], japanNative=False, japanEndemic=False, status='partial',
      candidates=[C(title='Elephant voice - trumpeting.ogg', source='Wikimedia Commons', url='https://commons.wikimedia.org/wiki/File:Elephant_voice_-_trumpeting.ogg', format='Ogg Vorbis', license='未確認', licenseOK='unverified'),
                  C(title='Elephant trumpeting', source='Siemens Stiftung Medienportal', url='https://medienportal.siemens-stiftung.org/en/elephant-trumpeting-101868', format='音声105.7kB（形式未記載）', license='CC BY-SA 4.0', licenseOK='yes', recordedCountry='未記載', wildOrCaptive='未記載', note='ライセンスは確認済みだが小容量・録音地不明で品質面は低い。')]),
 dict(no=6, group='哺乳類', jp='オオカミ', en='Gray wolf', latin='Canis lupus', nativeRegions=['europe','asia','north_america'], japanNative=False, japanEndemic=False, status='partial', note='ニホンオオカミ・エゾオオカミは絶滅。現生個体の日本での自然分布なし。',
      candidates=[C(title='Wolf howls.ogg', source='Wikimedia Commons', url='https://commons.wikimedia.org/wiki/File:Wolf_howls.ogg', format='Ogg Vorbis', license='未確認', licenseOK='unverified'),
                  C(title='NPS Sound Library - Wolf（Denali）', source='National Park Service', url='https://nps.gov/subjects/sound/sounds-wolf.htm', format='ページ上に形式記載なし', license='記載なし（Credit: NPS）', licenseOK='unverified', recordedCountry='米国（アラスカ・デナリ国立公園）', note='米国政府著作物ならPDの可能性。ページに明記なし。'),
                  C(title='Gray Wolf howl response to adults', source='Western Soundscape Archive', url='https://collections.lib.utah.edu/ark:/87278/s63n2gvr', format='MP4配信（元WAV）', license='All rights reserved（International Wolf Center）', licenseOK='no')]),
 dict(no=7, group='哺乳類', jp='コウモリ', en='Bats', latin='Chiroptera (Pipistrellus pipistrellus ほか)', nativeRegions=['europe','asia','africa','north_america','south_america','oceania','japan'], japanNative=True, japanEndemic=False, status='partial', note='超音波のため、可聴化（タイムエキスパンション）した録音を使う必要がある。',
      candidates=[C(title='Pipistrellus pipistrellus（時間伸長エコーロケーション）', source='Zenodo 10.5281/zenodo.4329598', url='https://doi.org/10.5281/zenodo.4329598', format='未確認', license='未確認', licenseOK='unverified', recordedCountry='アルバニア', date='2003-08-06 / 2004-04-23'),
                  C(title='ChiroVox / Global Bat Acoustic Collection', source='ChiroVox', url='https://ir.unimas.my/id/eprint/38362/', format='WAV想定（未確認）', license='未確認', licenseOK='unverified')]),
 dict(no=8, group='水中生物', jp='クジラ（ザトウクジラ）', en='Humpback whale', latin='Megaptera novaeangliae', nativeRegions=['marine'], japanNative=True, japanEndemic=False, status='verified', note='日本近海（小笠原・沖縄）に回遊。',
      candidates=[C(title='MBARI_MARS_2017_1107h22_HS1P2.wav', source='Freesound / MBARI', url='https://freesound.org/people/MBARI_MARS/sounds/496870', format='WAV 32kHz / 16-bit / mono / 102分59秒 / 377.2MB', license='CC BY 4.0（MBARIの表示）', licenseOK='yes', recordedCountry='米国（カリフォルニア州サンタクルーズ沖 36.71,-122.186 深海）', recordingEnvironment='海洋（MARS海底ハイドロフォン）', wildOrCaptive='野生', date='2017-11-07', note='非圧縮WAVマスター。冒頭にナガスクジラの20Hzパルスを含む。Freesoundはログイン要・この環境から取得不可。')]),
 dict(no=9, group='水中生物', jp='イルカ（ハンドウイルカ）', en='Bottlenose dolphin', latin='Tursiops truncatus / T. aduncus', nativeRegions=['marine'], japanNative=True, japanEndemic=False, status='partial',
      candidates=[C(title='Underwater recordings of the whistles of bottlenose dolphins in Fremantle Inner Harbour', source='figshare 5011637', url='https://figshare.com/articles/Underwater_recordings_of_the_whistles_of_bottlenose_dolphins_in_Fremantle_Inner_Harbour_Western_Australia/5011637', format='WAV ×336（1ホイッスル1ファイル）', license='ページ本文から確認できず', licenseOK='unverified', recordedCountry='オーストラリア（西オーストラリア州フリーマントル）', recordingEnvironment='港湾（自律録音機）')]),
 dict(no=10, group='水中生物', jp='シャチ', en='Killer whale', latin='Orcinus orca', nativeRegions=['marine'], japanNative=True, japanEndemic=False, status='verified', note='北海道・知床沖に出現。',
      candidates=[C(title='Killer whale.ogg', source='Wikimedia Commons / National Park Service', url='https://commons.wikimedia.org/wiki/File:Killer_whale.ogg', format='Ogg Vorbis 74kbps / 30秒 / 267KB', license='Public domain（米国連邦政府著作物）', licenseOK='yes', recordedCountry='米国（アラスカ・グレーシャーベイ湾口）', recordingEnvironment='海洋（固定ハイドロフォン）', wildOrCaptive='記載なし（野生個体群の記述）', note='非可逆・低ビットレート。南アラスカ定住型と推定。'),
                  C(title='Orcasound call catalog', source='Orcasound', url='https://www.orcasound.net/data/processed/SRKW/call-catalog/latest.html', format='未確認', license='未確認', licenseOK='unverified')]),
 dict(no=11, group='水中生物', jp='魚類', en='Fishes (sound-producing)', latin='Opsanus tau ほか', nativeRegions=['marine'], japanNative=None, japanEndemic=None, status='excluded',
      candidates=[C(title='GSO Fish Sounds Collection', source='University of Rhode Island', url='https://web.uri.edu/gso/research/fish-sounds/', format='MP3（デジタル化）', license='URI著作権・再配布/作品組込/商用不可', licenseOK='no', recordedCountry='米国大西洋岸・カリブ', note='研究目的のみ。'),
                  C(title='FishSounds（fishsounds.net）', source='FishSounds', url='https://www.uvic.ca/news/media/2022+fishsounds-online-library+media-release', format='未確認', license='未確認', licenseOK='unverified')]),
 dict(no=12, group='水中生物', jp='テッポウエビ', en='Snapping shrimp', latin='Alpheidae', nativeRegions=['marine'], japanNative=True, japanEndemic=False, status='not-found', note='NOAAサンクチュアリの記事は録音の存在を示すが音声ファイル・利用条件の記載なし。',
      candidates=[C(title='Gray\'s Reef snapping shrimp（記事内の言及のみ）', source='NOAA Sanctuaries', url='https://sanctuaries.noaa.gov/news/dec21/oh-snap.html', format='ファイルなし', license='記載なし', licenseOK='unverified', recordedCountry='米国（グレイズリーフ）')]),
 dict(no=13, group='鳥類', jp='フクロウ類', en='Owls', latin='Strix uralensis（フクロウ）/ Strix aluco', nativeRegions=['europe','asia','japan'], japanNative=True, japanEndemic=False, status='verified', note='採用可能な候補はモリフクロウ（日本に分布しない）。日本のフクロウ S. uralensis は xeno-canto に多数あるがライセンス未確認。',
      candidates=[C(title='Strix aluco - Tawny Owl XC565862.mp3', source='Wikimedia Commons（xeno-canto由来）', url='https://commons.wikimedia.org/wiki/File:Strix_aluco_-_Tawny_Owl_XC565862.mp3', format='MP3 91kbps / 9.5秒', license='CC BY-SA 4.0', licenseOK='yes', recordedCountry='ドイツ（ベルリン）', recordingEnvironment='街路樹（公園から50m）', wildOrCaptive='野生', note='種は S. aluco（日本に分布しない）。'),
                  C(title='XC359120 Ural Owl ほか', source='xeno-canto', url='https://xeno-canto.org/359120', format='未確認', license='未確認（xeno-cantoは自動取得を拒否）', licenseOK='unverified')]),
 dict(no=14, group='鳥類', jp='キツツキ', en='Woodpeckers', latin='Dendrocopos major ほか', nativeRegions=['europe','asia','japan'], japanNative=True, japanEndemic=False, status='partial',
      candidates=[C(title='Great Spotted Woodpecker drumming（xeno-canto多数）', source='xeno-canto', url='https://www.xeno-canto.org/622797', format='未確認', license='未確認', licenseOK='unverified')]),
 dict(no=15, group='鳥類', jp='アビ類（ハシグロアビ）', en='Common loon', latin='Gavia immer', nativeRegions=['north_america','europe'], japanNative=False, japanEndemic=False, status='verified', note='日本のアビ類（アビ・オオハム等）とは別種。',
      candidates=[C(title='Common Loon（USFWS）', source='Public Domain Audio & Video（USFWS素材）', url='https://publicdomainaudiovideo.blogspot.com/2009/08/common-loon.html', format='VBR MP3 377kB / OGG 244kB', license='Public domain（USFWS）', licenseOK='yes', recordedCountry='未記載', note='録音者・録音地不明。'),
                  C(title='Common Loons on Yellowstone Lake', source='Acoustic Atlas (MSU)', url='https://acousticatlas.org/item.php?id=2488', format='録音48kHz/24-bit・配信MP3', license='CC BY-NC 4.0', licenseOK='no', recordedCountry='米国（イエローストーン湖）', note='高品質だがNCのため不採用。')]),
 dict(no=16, group='鳥類', jp='コトドリ', en='Superb lyrebird', latin='Menura novaehollandiae', nativeRegions=['oceania'], japanNative=False, japanEndemic=False, status='partial',
      candidates=[C(title='xeno-canto Menura novaehollandiae（多数）', source='xeno-canto', url='https://www.xeno-canto.org/148568', format='未確認', license='未確認', licenseOK='unverified')]),
 dict(no=17, group='鳥類', jp='日本の鳴禽類（オオルリ・コマドリ・キビタキ・クロツグミ）', en='Japanese songbirds', latin='Cyanoptila cyanomelana / Larvivora akahige / Ficedula narcissina / Turdus cardis', nativeRegions=['asia','japan'], japanNative=True, japanEndemic=False, status='partial', note='ウグイス・ヒヨドリはアプリ収録済み（v0.23）。他はxeno-cantoに候補、ライセンス未確認。',
      candidates=[C(title='ウグイス（Uguisu5740_cu.ogg）', source='Wikimedia Commons', url='https://commons.wikimedia.org/wiki/File:Uguisu5740_cu.ogg', format='Ogg Vorbis 11024Hz', license='CC BY 2.1 JP', licenseOK='yes', recordedCountry='日本（岐阜県）', note='アプリ収録済み。'),
                  C(title='ヒヨドリ（伊豆）', source='Wikimedia Commons / iNaturalist', url='https://commons.wikimedia.org/wiki/File:Hypsipetes-amaurotis-2025-05-20-282617142.ogg', format='Ogg Vorbis 48kHz', license='CC BY 4.0', licenseOK='yes', recordedCountry='日本（静岡県伊豆市）', note='アプリ収録済み。'),
                  C(title='オオルリ XC805727 ほか', source='xeno-canto', url='https://xeno-canto.org/805727', format='未確認', license='未確認', licenseOK='unverified')]),
 dict(no=18, group='両生類', jp='カジカガエル', en='Kajika frog', latin='Buergeria buergeri', nativeRegions=['japan','asia'], japanNative=True, japanEndemic=True, status='in-app', note='日本固有種。収録音源は録音地不明のため「日本で録音」には入らない。日本録音の原本を引き続き探す。',
      candidates=[C(title='Buergeria buergeri.ogg', source='Wikimedia Commons', url='https://commons.wikimedia.org/wiki/File:Buergeria_buergeri.ogg', format='Ogg Vorbis 44.1kHz stereo', license='CC BY-SA 4.0', licenseOK='yes', recordedCountry='記載なし', note='v0.24でPCM WAV化（原本復号）。')]),
 dict(no=19, group='両生類', jp='モリアオガエル', en='Forest green tree frog', latin='Zhangixalus arboreus', nativeRegions=['japan','asia'], japanNative=True, japanEndemic=True, status='not-found', note='日本固有種（AmphibiaWeb）。公開ライセンスの録音は今回の検索で見つからず。', candidates=[]),
 dict(no=20, group='爬虫類', jp='トッケイヤモリ', en='Tokay gecko', latin='Gekko gecko', nativeRegions=['asia'], japanNative=False, japanEndemic=False, status='verified',
      candidates=[C(title='Mating call of a male Tokay gecko (Gekko gecko).ogg', source='Wikimedia Commons', url='https://commons.wikimedia.org/wiki/File:Mating_call_of_a_male_Tokay_gecko_(Gekko_gecko).ogg', format='Ogg Vorbis 73kbps / 29秒', license='Public domain（作者による放棄）', licenseOK='yes', recordedCountry='ラオス（ボケオ県フエサイ北2.5km・メコン川岸）', recordingEnvironment='川岸・日没直後', wildOrCaptive='記載なし', date='2007-04-22', note='カメラ内蔵マイク。')]),
 dict(no=21, group='昆虫類', jp='スズムシ', en='Bell cricket', latin='Meloimorpha japonica', nativeRegions=['asia','japan'], japanNative=True, japanEndemic=False, status='in-app', note='収録済みは混合合唱（スズムシ等）のみ。単独種の公開録音は今回見つからず。', candidates=[]),
 dict(no=22, group='昆虫類', jp='カンタン', en='Tree cricket (Japanese)', latin='Oecanthus longicauda', nativeRegions=['asia','japan'], japanNative=True, japanEndemic=False, status='not-found', note='アプリの tree-cricket-europe は欧州の別種 O. pellucens。', candidates=[]),
 dict(no=23, group='昆虫類', jp='カネタタキ', en='Kanetataki cricket', latin='Ornebius kanetataki', nativeRegions=['asia','japan'], japanNative=True, japanEndemic=False, status='not-found', candidates=[]),
 dict(no=24, group='昆虫類', jp='ケラ', en='Oriental mole cricket', latin='Gryllotalpa orientalis', nativeRegions=['asia','japan','oceania'], japanNative=True, japanEndemic=False, status='verified',
      candidates=[C(title='BioAcoustica 900 6 Gryllotalpa orientalis 125.flac', source='Wikimedia Commons / BioAcoustica (Natural History Museum)', url='https://commons.wikimedia.org/wiki/File:BioAcoustica_900_6_Gryllotalpa_orientalis_125.flac', format='FLAC（ロスレス）723kbps / 9分24秒 / 48.6MB', license='CC BY 3.0', licenseOK='yes', recordedCountry='記載なし', recordingEnvironment='湿った土6cmの箱（観察窓越し）', wildOrCaptive='飼育下（箱内）と判断できる記述', date='1975-01-10', note='Nagra IV-D。ロスレス原本。録音地不明のため「日本で録音」には入らない。')]),
]
EXTRA = [
 dict(jp='ヨーロッパクロコオロギ（同種の別録音）', latin='Gryllus campestris', status='verified', candidates=[C(title='BioAcoustica 432 2 Gryllus campestris 656r1b.flac', source='Wikimedia Commons / BioAcoustica', url='https://commons.wikimedia.org/wiki/File:BioAcoustica_432_2_Gryllus_campestris_656r1b.flac', format='FLAC（ロスレス）', license='未確認（BioAcoustica一般はCC BY）', licenseOK='unverified', note='既存 field-cricket-europe（Vorbis）とは別録音。同一録音の置換ではないため二重登録にはならない。')]),
]

if __name__ == '__main__':
    for i in range(25, 53):
        T.append(dict(no=i, group='—', jp='（52対象リスト受領待ち）', en='', latin='', nativeRegions=[], japanNative=None, japanEndemic=None, status='pending-list', candidates=[]))
    from collections import Counter
    cnt = Counter(t['status'] for t in T)
    db = dict(schema='ae-wildlife-master-db/1', version='v0.24', surveyed='2026-10-31', statusCounts=cnt, targets=T, extra=EXTRA, method=__doc__)
    json.dump(db, open('dist/data/wildlife_master_db.json', 'w'), ensure_ascii=False, indent=1)
    rows = []
    for t in T:
        cands = t.get('candidates') or [{}]
        for c in cands:
            rows.append({'No': t['no'], '分類': t['group'], '対象': t['jp'], '学名': t['latin'], '状態': t['status'],
                         '日本に自然分布': {True: 'はい', False: 'いいえ', None: '未確認'}[t['japanNative']],
                         '日本固有': {True: 'はい', False: 'いいえ', None: '未確認'}[t['japanEndemic']],
                         '候補': c.get('title', ''), '出典': c.get('source', ''), 'URL': c.get('url', ''), '形式・品質': c.get('format', ''),
                         'ライセンス': c.get('license', ''), '採用可否': c.get('licenseOK', ''), '録音国': c.get('recordedCountry', ''),
                         '録音環境': c.get('recordingEnvironment', ''), '野外/飼育': c.get('wildOrCaptive', ''), '録音日': c.get('date', ''),
                         '備考': ' '.join(x for x in [t.get('note', ''), c.get('note', '')] if x)})
    with open('dist/data/wildlife_master_db.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, list(rows[0])); w.writeheader(); w.writerows(rows)
    print(dict(cnt), len(rows))
