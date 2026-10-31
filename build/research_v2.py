#!/usr/bin/env python3
"""Wildlife sound candidate research v0.25-R (2026-10-31).

Every field below was read from the source page in this session unless the row says
'ページ未読'. Acoustic scores are PROVISIONAL: no file could be downloaded or listened to
from this environment (Freesound / Commons blocked for downloads).
License classes: CC0 / PD = 採用可 ; CC BY = 採用可（帰属表示）; CC BY-SA = 条件付き（改変物に継承）;
                 CC BY-NC / NC-ND / ARR / 再配布不可 = 除外 ; 合成 = 除外
"""
import csv, json, os

FS = 'https://freesound.org/people/'
# id: dict(cand)
C = {}
def c(id, **k): C[id] = dict(id=id, **k)

# ---------- verified on page (adoptable licence) ----------
c('fs-431302', title='Fox Cry.wav', by='Simon Spiers', url=FS+'Simon%20Spiers/sounds/431302/', source='Freesound', fmt='WAV', sr=48000, bits=24, ch=2, dur='0:46', size='12.6MB', lic='CC0', species='キツネ（種名記載なし）', latin=None, loc='記載なし（自宅の窓の外・夜間）', env='市街地（Urban-soundsタグ）', wild='記載なし', mixed=False, user_listed=True, note='種名の記載がないため Vulpes vulpes と断定しない。')
c('fs-850410', title='owl and fox in large', by='bruno.auzet', url=FS+'bruno.auzet/sounds/850410/', source='Freesound', fmt='WAV', sr=48000, bits=24, ch=2, dur='5:44', size='95.1MB', lic='CC0', species='モリフクロウ＋キツネ＋遠くの犬（混合）', latin='Strix aluco ほか', loc='フランス・ブルターニュ（Saint-Dolay）', env='開けた野原・湿地・春の夜', wild='記載なし', date='2026-04', mixed=True, user_listed=True, note='複数種の環境録音。単独種2本として登録しない。Izotopeで軽いノイズ除去あり。')
c('fs-819668', title='Elephant sound', by='ikbenraar', url=FS+'ikbenraar/sounds/819668/', source='Freesound', fmt='WAV', sr=48000, bits=16, ch=2, dur='0:07.8', size='1.4MB', lic='CC0', species='ゾウ（種名記載なし）', latin=None, loc='ベルギー・Brugelette', env='動物園', wild='飼育（動物園）', mixed=False, user_listed=True, note='7.8秒と短い。唸りとトランペットを含むとタグ記載。')
c('fs-819667', title='Malaysian frogs', by='ikbenraar', url=FS+'ikbenraar/sounds/819667/', source='Freesound', fmt='AIFF', sr=48000, bits=24, ch=2, dur='3:33', size='58.5MB', lic='CC0', species='カエル類の群れ（種不明）', latin=None, loc='マレーシア・ジョホール州メルシン', env='夕方・距離を変えて収録', wild='記載なし（フィールド録音）', mixed=True, note='対象52種のいずれとも断定できない追加候補。')
c('fs-347047', title='Woodpecker', by='johnaudiotech', url=FS+'johnaudiotech/sounds/347047/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=2, dur='0:34', size='5.7MB', lic='CC0', species='キツツキ類（種名記載なし）', latin=None, loc='記載なし（森）', env='森', wild='記載なし', mixed=False, user_listed=True, note='ドラミング。種不明のため「キツツキ類」として登録。')
c('fs-762242', title='Wolves howling (spontaneous and free)', by='Sacha.Julien', url=FS+'Sacha.Julien/sounds/762242/', source='Freesound', fmt='WAV', sr=48000, bits=24, ch=2, dur='0:51', size='14.0MB', lic='CC BY 4.0', species='オオカミ（群れの遠吠え）', latin='Canis lupus（記載は"wolves"）', loc='フランス・ヴェルコール', env='森林・夜', wild='記載なし（森林・自然発生の遠吠え）', date='2024年秋', mixed=False, note='ORTF・NT1・MixPre6。同投稿者に遠方の親子の遠吠え等もあり。')
c('fs-408555', title='Amazonian Dolphins', by='felix.blume', url=FS+'felix.blume/sounds/408555/', source='Freesound', fmt='WAV', sr=96000, bits=24, ch=2, dur='2:48', size='92.3MB', lic='CC0', species='アマゾンカワイルカ（ボト・タグ記載）', latin='Inia（タグ "boto"）', loc='ブラジル・アマゾナス州テフェ川', env='河川・水中（Aquarian H2a）', wild='記載なし（河川）', date='2017-09', mixed=False, note='マイルカ類ではなくカワイルカ。別枠で登録。')
c('fs-161691', title='Dolphin screaming underwater in Caribbean Sea (Mexico)', by='felix.blume', url=FS+'felix.blume/sounds/161691/', source='Freesound', fmt='WAV', sr=48000, bits=24, ch=1, dur='0:44', size='6.0MB', lic='CC0', species='イルカ（種名記載なし）', latin=None, loc='メキシコ・キンタナロー州プンタアレン沖', env='海・水中（船上からハイドロフォン）', wild='記載なし', date='2012-07', mixed=False, note='')
c('fs-498626', title='Sea Lion screaming in Caleta Portales (Chile)', by='felix.blume', url=FS+'felix.blume/sounds/498626/', source='Freesound', fmt='WAV', sr=48000, bits=24, ch=2, dur='4:47', size='78.8MB', lic='CC0', species='アシカ（種名記載なし）', latin=None, loc='チリ・バルパライソ、カレタ・ポルタレス', env='漁港付近', wild='記載なし（魚市場付近で餌待ち）', mixed=False, note='オットセイではない。アシカ科の別枠として登録。原録音96kHz、配布48kHz。')
c('fs-278871', title='Nature sounds frog 3.WAV', by='Sandermotions', url=FS+'Sandermotions/sounds/278871/', source='Freesound', fmt='WAV', sr=96000, bits=24, ch=2, dur='0:35', size='19.5MB', lic='CC0', species='カエル類の群れ（種不明）', latin=None, loc='オランダ・フレヴォラント州ドロンテン', env='森の池', wild='記載なし', mixed=True, user_listed=True, note='指示書のPond Frogs。')
c('fs-148422', title='Howler Monkeys-Belize.wav', by='RTB45', url=FS+'RTB45/sounds/148422/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=2, dur='8:25', size='84.9MB', lic='CC BY 4.0', species='クロホエザル', latin='Alouatta pigra（タグ）', loc='ベリーズ・ブルーホール国立公園付近', env='熱帯林・夜', wild='記載なし', mixed=True, note='録音機材がミニディスク（ATRAC非可逆）。WAVだが元は圧縮音源。背景に虫。')
c('fs-327443', title='Siamang Gibbon Calls', by='RTB45', url=FS+'RTB45/sounds/327443/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=2, dur='0:48', size='8.1MB', lic='CC BY 4.0', species='フクロテナガザル（ペア）', latin='Symphalangus syndactylus（記載は"Siamang"）', loc='香港動物園', env='動物園', wild='飼育（動物園）', mixed=False, note='オス・メスのペアの夕方の縄張り発声。')
c('fs-75073', title='Nightjar .wav', by='Benboncan', url=FS+'Benboncan/sounds/75073/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=2, dur='0:18', size='3.0MB', lic='CC BY 4.0', species='ヨーロッパヨタカ', latin='Caprimulgus europaeus', loc='英国ウェールズ・Blaenau Ffestiniog', env='記載なし', wild='記載なし（フィールド録音）', mixed=False, note='デュアルモノ。他の音は編集で除去。日本のヨタカ（C. jotaka）とは別種。')
c('fs-399796', title='Superb Lyrebird II', by='samarobryn', url=FS+'samarobryn/sounds/399796/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=2, dur='0:28', size='4.8MB', lic='CC0', species='コトドリ', latin='Menura novaehollandiae（記載は"Superb Lyrebird"）', loc='オーストラリア・ビクトリア州 Bogong Village 付近', env='記載なし', wild='記載なし', mixed=False, note='Zoom H1・Auditionで後処理。')
c('fs-203498', title='Lyrebird imitating sounds at Healesville Sanctuary.wav', by='youthful_implants', url=FS+'youthful_implants/sounds/203498/', source='Freesound', fmt='WAV', sr=48000, bits=16, ch=2, dur='1:18', size='14.3MB', lic='CC0', species='コトドリ（模倣を含む）', latin=None, loc='オーストラリア・ヒールズビル・サンクチュアリ', env='保護施設', wild='飼育の可能性（保護施設）', mixed=False, note='iPhone録音。模倣の多様さは高いが音質は低い見込み。')
c('fs-188723', title='Bullfrog Concerto.wav', by='soloan', url=FS+'soloan/sounds/188723/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=1, dur='1:02', size='5.2MB', lic='CC BY 4.0', species='ウシガエル', latin='Rana catesbeiana（タグ）', loc='香港・駐車場', env='市街地', wild='記載なし', mixed=False, note='iPhoneボイスメモ（AAC）由来。WAVだが元は圧縮音源。')
c('fs-260797', title='Eurasian Wren alarm call.wav', by='klankbeeld', url=FS+'klankbeeld/sounds/260797/', source='Freesound', fmt='WAV', sr=48000, bits=24, ch=1, dur='0:36', size='5.0MB', lic='CC BY 4.0', species='ミソサザイ（警戒声）', latin='Troglodytes troglodytes（タグ）', loc='記載なし', env='記載なし', wild='記載なし', mixed=False, note='さえずり（歌）ではなく警戒声。整音済み。')
c('fs-524526', title='Japanese bush warbler (uguisu) in a city ambiance', by='warukunai', url=FS+'warukunai/sounds/524526/', source='Freesound', fmt='WAV', sr=48000, bits=16, ch=2, dur='0:56', size='10.3MB', lic='CC0', species='ウグイス', latin='Horornis diphone', loc='日本・横浜市', env='市街地', wild='野生（自宅付近）', mixed=False, note='既存ウグイス（岐阜・11024Hz）とは別録音。全帯域の日本録音。')
c('fs-755275', title='bat echolocation at 0.05 times speed', by='Garuda1982', url=FS+'Garuda1982/sounds/755275/', source='Freesound', fmt='WAV', sr=96000, bits=24, ch=2, dur='0:51', size='27.8MB', lic='CC0', species='コウモリ（種名記載なし）', latin=None, loc='記載なし', env='記載なし', wild='記載なし', mixed=False, note='0.05倍速で可聴化。超音波の変換素材（Experimental）。')
c('fs-43824', title='Bats Hunting For Insects.wav', by='digifishmusic', url=FS+'digifishmusic/sounds/43824/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=2, dur='0:20', size='3.3MB', lic='CC BY 4.0', species='食虫コウモリ2頭（種名記載なし）', latin=None, loc='記載なし（自宅の裏庭）', env='夜', wild='野生', mixed=False, note='検出器の記載なし。可聴域の音のみの可能性。')
c('fs-365257', title='Japan_Kashiwa_Insects_Far_and_Upclose.wav', by='RutgerMuller', url=FS+'RutgerMuller/sounds/365257/', source='Freesound', fmt='WAV', sr=96000, bits=24, ch=2, dur='3:23', size='111.3MB', lic='CC0', species='鳴く虫の合唱（種不明）', latin=None, loc='日本・千葉県柏市', env='記載なし（秋）', wild='野生', date='2016年10月下旬', mixed=True, note='日本録音・96kHz/24-bit。種を特定しない合唱として登録。')
c('fs-63220', title='Owls.wav', by='Benboncan', url=FS+'Benboncan/sounds/63220/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=2, dur='0:46', size='7.7MB', lic='CC BY 4.0', species='モリフクロウ（オス2羽）', latin='Strix aluco', loc='英国ウェールズ・Penrhyndeudraeth', env='記載なし', wild='記載なし', mixed=False, note='日本のフクロウ（S. uralensis）とは別種。')
c('fs-15689', title='tree frog.wav', by='reinsamba', url=FS+'reinsamba/sounds/15689/', source='Freesound', fmt='WAV', sr=44100, bits=16, ch=2, dur='1:40', size='16.8MB', lic='CC BY 4.0', species='アマガエル類1匹（種名記載なし）', latin=None, loc='フランス南西部 St.Sernin', env='記載なし', wild='記載なし', date='1999-04', mixed=False, note='DAT録音。日本のアマガエル（D. japonicus）とは別種の可能性が高いが、種不明のため断定しない。')
c('fs-797762', title='humpback_whales_and_orcas_ambient_underwater_recording', by='raiden04', url=FS+'raiden04/sounds/797762/', source='Freesound', fmt='WAV', sr=48000, bits=32, ch=2, dur='6:55', size='151.8MB', lic='CC BY 4.0', species='ザトウクジラ＋シャチ（混合）', latin=None, loc='ノルウェー・Skjervøy（ジオタグ）', env='海洋', wild='記載なし', mixed=True, note='Rychen et al.(2023) の公開データからの空間音響レンダリング。直接のフィールド録音ではない加工素材。元データのライセンス要確認。')
c('fs-496870', title='MBARI_MARS_2017_1107h22_HS1P2.wav', by='MBARI_MARS', url=FS+'MBARI_MARS/sounds/496870', source='Freesound', fmt='WAV', sr=32000, bits=16, ch=1, dur='102:59', size='377.2MB', lic='CC BY 4.0', species='ザトウクジラの歌（冒頭にナガスクジラ）', latin='Megaptera novaeangliae', loc='米国カリフォルニア州モントレー湾沖・深海', env='海洋（海底ハイドロフォン）', wild='野生', date='2017-11-07', mixed=False, note='v0.24調査で確認。MBARIはファイルごとにライセンスが異なる（多くはNC）。')
# Commons / other (verified in v0.24 survey)
c('wc-orca', title='Killer whale.ogg', by='National Park Service', url='https://commons.wikimedia.org/wiki/File:Killer_whale.ogg', source='Wikimedia Commons', fmt='Ogg Vorbis 74kbps', sr=None, bits=None, ch=None, dur='0:30', size='267KB', lic='Public domain', species='シャチ', latin='Orcinus orca', loc='米国アラスカ・グレーシャーベイ湾口', env='海洋（固定ハイドロフォン）', wild='記載なし（定住型個体群の記述）', mixed=False, note='非可逆・低ビットレート。')
c('wc-tokay', title='Mating call of a male Tokay gecko (Gekko gecko).ogg', by='Richard Ling', url='https://commons.wikimedia.org/wiki/File:Mating_call_of_a_male_Tokay_gecko_(Gekko_gecko).ogg', source='Wikimedia Commons', fmt='Ogg Vorbis 73kbps', sr=None, bits=None, ch=None, dur='0:29', size='261KB', lic='Public domain', species='トッケイヤモリ', latin='Gekko gecko', loc='ラオス・ボケオ県メコン川岸', env='川岸・日没直後', wild='記載なし', date='2007-04-22', mixed=False, note='カメラ内蔵マイク。')
c('wc-kera', title='BioAcoustica 900 6 Gryllotalpa orientalis 125.flac', by='Natural History Museum (BioAcoustica)', url='https://commons.wikimedia.org/wiki/File:BioAcoustica_900_6_Gryllotalpa_orientalis_125.flac', source='Wikimedia Commons', fmt='FLAC（ロスレス）', sr=None, bits=None, ch=None, dur='9:24', size='48.6MB', lic='CC BY 3.0', species='ケラ', latin='Gryllotalpa orientalis', loc='記載なし', env='土を入れた箱（観察窓越し）', wild='飼育下（箱内）', date='1975-01-10', mixed=False, note='Nagra IV-D。')
c('pd-loon', title='Common Loon (USFWS)', by='U.S. Fish and Wildlife Service', url='https://publicdomainaudiovideo.blogspot.com/2009/08/common-loon.html', source='Public Domain Audio & Video', fmt='MP3 / OGG', sr=None, bits=None, ch=None, dur='不明', size='377kB / 244kB', lic='Public domain', species='ハシグロアビ', latin='Gavia immer', loc='記載なし', env='記載なし', wild='記載なし', mixed=False, note='圧縮音源のみ。')
c('wc-tawny-xc', title='Strix aluco - Tawny Owl XC565862.mp3', by='Alvaro Ortiz Troncoso', url='https://commons.wikimedia.org/wiki/File:Strix_aluco_-_Tawny_Owl_XC565862.mp3', source='Wikimedia Commons', fmt='MP3 91kbps', sr=None, bits=None, ch=None, dur='0:09.5', size='110KB', lic='CC BY-SA 4.0', species='モリフクロウ', latin='Strix aluco', loc='ドイツ・ベルリン', env='街路樹', wild='野生', mixed=False, note='')
c('ss-elephant', title='Elephant trumpeting', by='MediaHouse GmbH / Siemens Stiftung', url='https://medienportal.siemens-stiftung.org/en/elephant-trumpeting-101868', source='Siemens Stiftung', fmt='不明（105.7kB）', sr=None, bits=None, ch=None, dur='不明', size='105.7kB', lic='CC BY-SA 4.0', species='ゾウ（種名記載なし）', latin=None, loc='記載なし', env='記載なし', wild='記載なし', mixed=False, note='小容量。')

# ---------- excluded ----------
X = [
 ('MBARI_MARS 404314 Marine mammal community', FS+'MBARI_MARS/sounds/404314/', 'CC BY-NC 4.0', 'カマイルカ・ザトウクジラ・アシカの混合、MP3'),
 ('MBARI_MARS 404318 Cachalot (sperm whale)', FS+'MBARI_MARS/sounds/404318/', 'CC BY-NC 4.0', 'マッコウクジラ。MP3 48kHz'),
 ('MBARI_MARS 458854 orcas', FS+'MBARI_MARS/sounds/458854/', 'CC BY-NC 4.0', 'シャチ。WAV 64kHz/16-bit'),
 ('listeningtowhales 321497 Drifting with Caribbean Humpback Whales', FS+'listeningtowhales/sounds/321497/', 'CC BY-NC 3.0', 'ザトウクジラ。AIFF 44.1/16'),
 ('Philip_Goddard 706810 Roe deer rutting calls', FS+'Philip_Goddard/sounds/706810/', 'CC BY-NC 4.0', 'ノロジカ。FLAC 42分'),
 ('Robinhood76 807854 fur seal scream', FS+'Robinhood76/sounds/807854/', 'CC BY-NC 4.0', 'オットセイ。1.8秒'),
 ('KevinSonger 581576 Belted Kingfisher', FS+'KevinSonger/sounds/581576/', 'CC BY-NC 4.0', 'アメリカヤマセミ（カワセミとは別種）'),
 ('KevinSonger 583599 Green Tree Frog Hyla cinerea', FS+'KevinSonger/sounds/583599/', 'CC BY-NC 4.0', 'アメリカアマガエル'),
 ('genghisattenborough 28110 White throated Kingfisher', FS+'genghisattenborough/sounds/28110/', 'CC BY-NC 4.0', 'アオショウビン'),
 ('Acoustic Atlas 2488 Common Loons on Yellowstone Lake', 'https://acousticatlas.org/item.php?id=2488', 'CC BY-NC 4.0', 'ハシグロアビ。48kHz/24-bit録音'),
 ('Western Soundscape Archive Red Fox', 'https://collections.lib.utah.edu/ark:/87278/s6mw2wjr', 'CC BY-NC-ND 3.0 US', 'キツネ'),
 ('International Wolf Center Gray Wolf howl', 'https://collections.lib.utah.edu/ark:/87278/s63n2gvr', 'All rights reserved', 'オオカミ'),
 ('URI GSO Fish Sounds Collection', 'https://web.uri.edu/gso/research/fish-sounds/', '再配布・作品組込・商用不可', 'ガマアンコウ・ニベ類など'),
 ('NoiseCollector 57980 lemur2b.wav', FS+'NoiseCollector/sounds/57980/', 'CC BY 3.0（合成音）', '画像から合成した音。実録音ではない'),
 ('The_Sound_Side 320547 coyotes going crazy before dawn', FS+'The_Sound_Side/sounds/320547/', 'CC BY 4.0（種名に疑義）', 'レバノン／イスラエルでの録音。コヨーテは中東に分布しないため種名が誤っている可能性が高い。コヨーテとしては不採用（種不明のイヌ科として保留）'),
]
# ---------- user-listed but page unreadable ----------
U = [
 ('Siamang（ikbenraar 819670）', FS+'ikbenraar/sounds/819670/', '投稿者ページで「動物園で録音」と確認。個別ページは2回とも読込失敗'),
 ('Zogzog Monkey（felix.blume 508987）', FS+'felix.blume/sounds/508987/', 'パック一覧でタイトル（Zogzog monkey yelling in the Amazonian Rainforest, 2020-03-15）のみ確認'),
 ('Roe Deer（bruno.auzet 850406）', FS+'bruno.auzet/sounds/850406/', '投稿者の最新一覧に無く未確認'),
 ('Bat Echolocation（Sacha.Julien 724581）', FS+'Sacha.Julien/sounds/724581/', '投稿者ページに無く未確認'),
 ('Atlantic Spotted Dolphins（geraldfiebig 385796）', FS+'geraldfiebig/sounds/385796/', '検索に出ず未確認'),
 ('Growling Sea Lion（Diim_1 849186）', FS+'Diim_1/sounds/849186/', '検索に出ず未確認'),
 ('Tree Frogs（knufds 242851）', FS+'knufds/sounds/242851/', '検索に出ず未確認'),
 ('Small Frog Croaks（clif_creates 802737）', FS+'clif_creates/sounds/802737/', '検索に出ず未確認'),
 ('Common Toad（Breviceps 462863）', FS+'Breviceps/sounds/462863/', '検索で「Common toad (Bufo bufo) by Breviceps」の存在は確認。個別ページは読込失敗'),
 ('Croaking Frogs（Breviceps 573584）', FS+'Breviceps/sounds/573584/', '検索に出ず未確認'),
]

# ---------- 52 targets ----------
# (no, group, jp, en, latin, feature, status, candidate ids, existing-in-app, note)
T = [
 (1,'鳥類','ウグイス','Japanese bush warbler','Horornis diphone','流れるような旋律','候補あり',['fs-524526'],'あり（Commons・岐阜・11024Hz）','横浜録音・48kHzは既存より帯域が広い別録音。'),
 (2,'鳥類','ミソサザイ','Eurasian wren','Troglodytes troglodytes / T. fumigatus','高密度の複雑な歌','一部（警戒声のみ）',['fs-260797'],'なし','さえずり（歌）の採用候補は未発見。'),
 (3,'鳥類','コマドリ','Japanese robin','Larvivora akahige','明瞭な高音の旋律','未発見',[],'なし','xeno-canto等に録音はあるがライセンス未確認（自動取得不可）。'),
 (4,'鳥類','オオルリ','Blue-and-white flycatcher','Cyanoptila cyanomelana','長い音程変化','未発見',[],'なし','同上。'),
 (5,'鳥類','キビタキ','Narcissus flycatcher','Ficedula narcissina','多様なフレーズ','未発見',[],'なし','同上。'),
 (6,'鳥類','ホトトギス','Lesser cuckoo','Cuculus poliocephalus','周期的な特徴的発声','収録済み',[],'あり（Commons・7812Hz）','より高品質な録音は未発見。'),
 (7,'鳥類','アビ類','Loons','Gavia spp.','遠方まで響く長い声','候補あり（圧縮のみ）',['pd-loon'],'なし','高品質なAcoustic Atlas録音はNCで除外。'),
 (8,'鳥類','フクロウ','Owls','Strix uralensis ほか','低く間隔の広い発声','候補あり（近縁種）',['fs-63220','fs-850410','wc-tawny-xc'],'なし','いずれもモリフクロウ（日本に分布しない）。日本のフクロウは未発見。'),
 (9,'鳥類','アオバズク','Northern boobook','Ninox japonica','反復する夜間の声','未発見',[],'なし',''),
 (10,'鳥類','ヨタカ','Nightjars','Caprimulgus spp.','機械的な連続発声','候補あり（近縁種）',['fs-75073'],'なし','ヨーロッパヨタカ。日本のヨタカ（C. jotaka）は未発見。'),
 (11,'鳥類','キツツキ類','Woodpeckers','Picidae','木を叩く自然のパーカッション','候補あり（種不明）',['fs-347047'],'なし',''),
 (12,'鳥類','ライチョウ','Rock ptarmigan','Lagopus muta','低い声と特殊な鳴き方','未発見',[],'なし',''),
 (13,'鳥類','カワセミ','Common kingfisher','Alcedo atthis','鋭い短い発声','未発見',[],'なし','見つかった近縁2種はNCで除外。'),
 (14,'鳥類','コトドリ','Superb lyrebird','Menura novaehollandiae','模倣を含む極めて複雑な発声','候補あり',['fs-399796','fs-203498'],'なし',''),
 (15,'哺乳類','キツネ','Fox','Vulpes vulpes ほか','鋭い叫びと間欠発声','候補あり（種名記載なし）',['fs-431302','fs-850410'],'なし',''),
 (16,'哺乳類','ノロジカ','Roe deer','Capreolus capreolus','低い吠え声と鳴き交わし','未確認',[],'なし','指示書の候補（850406）は未読。見つかった42分の録音はNCで除外。'),
 (17,'哺乳類','ニホンジカ','Sika deer','Cervus nippon','長い笛状の声','未確認',['(v0.24) British Library W1CDR0001426 BD2'],'なし','Commons掲載（英国コレクション）。ファイルページ未読。'),
 (18,'哺乳類','ニホンザル','Japanese macaque','Macaca fuscata','多様な社会的発声','未発見',[],'なし','日本固有種。'),
 (19,'哺乳類','フクロテナガザル','Siamang','Symphalangus syndactylus','共鳴の強い歌声','候補あり（動物園）',['fs-327443'],'なし','指示書の候補（819670）も動物園録音。'),
 (20,'哺乳類','ホエザル','Howler monkeys','Alouatta spp.','低域の長い唸り','候補あり',['fs-148422'],'なし','ミニディスク由来。'),
 (21,'哺乳類','ゾウ','Elephants','Elephantidae','低い声と複雑な倍音','候補あり（動物園・短尺）',['fs-819668','ss-elephant'],'なし',''),
 (22,'哺乳類','オオカミ','Gray wolf','Canis lupus','遠くまで響く持続音','候補あり',['fs-762242'],'なし',''),
 (23,'哺乳類','コヨーテ','Coyote','Canis latrans','複数個体の遠吠え','未確定',[],'なし','見つかったCC BY録音は中東での録音で、種名に疑義（除外リスト参照）。'),
 (24,'哺乳類','コウモリ','Bats','Chiroptera','超音波クリックの可聴化','候補あり（種不明）',['fs-755275','fs-43824'],'なし',''),
 (25,'哺乳類','ワオキツネザル','Ring-tailed lemur','Lemur catta','特徴的な警戒声','未発見',[],'なし','"lemur"名の候補は合成音で除外。'),
 (26,'哺乳類','オットセイ','Fur seals','Arctocephalinae','不規則な低音の発声','未発見（近縁で代替候補）',['fs-498626'],'なし','オットセイの録音はNCで除外。アシカ（チリ）をアシカ科の別枠として登録。オットセイとしては計上しない。'),
 (27,'両生類','アマガエル','Japanese tree frog','Dryophytes japonicus','細かい周期的発声','未発見（種不明の近縁録音あり）',['fs-15689'],'なし','フランスのアマガエル類（種不明）。日本のアマガエルとしては計上しない。'),
 (28,'両生類','モリアオガエル','Forest green tree frog','Zhangixalus arboreus','集団の重なりと反復','未発見',[],'なし','日本固有種。'),
 (29,'両生類','カジカガエル','Kajika frog','Buergeria buergeri','笛や鈴のような発声','収録済み',[],'あり（Commons・録音地不明）','日本録音の候補は未発見。'),
 (30,'両生類','シュレーゲルアオガエル','Schlegel\'s green tree frog','Zhangixalus schlegelii','高音の反復','未発見',[],'なし','日本固有種。'),
 (31,'両生類','トノサマガエル','Black-spotted pond frog','Pelophylax nigromaculatus','低音の連続発声','未発見',[],'なし',''),
 (32,'両生類','ウシガエル','American bullfrog','Lithobates catesbeianus','深い低周波的な声','候補あり（圧縮由来）',['fs-188723'],'なし','AAC由来。'),
 (33,'両生類','ヨーロッパヒキガエル','Common toad','Bufo bufo','不規則で短い鳴き声','未確認',[],'なし','指示書の候補（Breviceps 462863）は検索で存在のみ確認、詳細未読。'),
 (34,'爬虫類','トッケイヤモリ','Tokay gecko','Gekko gecko','特徴的な反復発声','候補あり（圧縮）',['wc-tokay'],'なし',''),
 (35,'水中生物','ザトウクジラ','Humpback whale','Megaptera novaeangliae','長い歌、音程変化','候補あり',['fs-496870','fs-797762'],'なし',''),
 (36,'水中生物','シロイルカ','Beluga','Delphinapterus leucas','高音の笛・クリック','未発見',[],'なし',''),
 (37,'水中生物','シャチ','Killer whale','Orcinus orca','パルス状発声','候補あり（圧縮）',['wc-orca','fs-797762'],'なし','MBARIのWAVはNCで除外。'),
 (38,'水中生物','マッコウクジラ','Sperm whale','Physeter macrocephalus','規則的なクリック列','未発見（採用可能なもの）',[],'なし','MBARI録音はNCで除外。'),
 (39,'水中生物','マイルカ類','Dolphins','Delphinidae','笛状の声とクリック','候補あり（種不明）',['fs-161691'],'なし','アマゾンカワイルカ（fs-408555）は別科として別枠。'),
 (40,'水中生物','テッポウエビ','Snapping shrimp','Alpheidae','短い強烈な破裂音','未発見',[],'なし',''),
 (41,'水中生物','イセエビ類','Spiny lobsters','Palinuridae','摩擦によるきしみ音','未発見',[],'なし',''),
 (42,'水中生物','ガマアンコウ科の魚','Toadfishes','Batrachoididae','低域のハム音','未発見（採用可能なもの）',[],'なし','URIコレクションは再配布不可で除外。'),
 (43,'水中生物','グチ・ニベ類','Drums and croakers','Sciaenidae','太鼓状の発声','未発見（採用可能なもの）',[],'なし','同上。'),
 (44,'昆虫','スズムシ','Bell cricket','Meloimorpha japonica','鈴状の明瞭な高音','収録済み（混合のみ）',[],'あり（混合合唱）','単独種録音は未発見。'),
 (45,'昆虫','マツムシ','Matsumushi','Xenogryllus marmoratus','特徴的な反復パターン','未発見',[],'なし',''),
 (46,'昆虫','カンタン','Japanese tree cricket','Oecanthus longicauda','繊細な持続的高音','未発見',[],'なし','既存の欧州カンタン属（O. pellucens）は別種。'),
 (47,'昆虫','カネタタキ','Kanetataki','Ornebius kanetataki','小さく周期的なパルス','未発見',[],'なし',''),
 (48,'昆虫','ケラ','Oriental mole cricket','Gryllotalpa orientalis','連続的な低い振動音','候補あり（ロスレス）',['wc-kera'],'なし',''),
 (49,'昆虫','ウマオイ','Umaoi','Hexacentrus japonicus','比較的長い笛状の声','未発見',[],'なし',''),
 (50,'昆虫','コオロギの異なる発声種','Crickets (new species)','Gryllidae','周期と音色の多様性','未確認',['(v0.24) BioAcoustica Teleogryllus sp. / Acheta domesticus（FLAC）'],'あり（G. pennsylvanicus, G. campestris）','ファイル名のみ確認。'),
 (51,'昆虫','キリギリス類の未収録種','Bush-crickets (new species)','Tettigoniidae','粗い高周波テクスチャー','未確認',['(v0.24) BioAcoustica Phaneroptera falcata / Metrioptera saussuriana / Polysarcus denticauda（FLAC）'],'あり（Gampsocleis, Tettigonia 2種）','ファイル名のみ確認。'),
 (52,'昆虫','発音する甲虫類','Sound-producing beetles','Coleoptera','摩擦音、クリック、振動音','未発見',[],'なし',''),
]
EXTRA = ['fs-819667','fs-408555','fs-365257']  # adoptable, outside the 52 species list

# ---------- provisional acoustic scores (1-5; not listened) ----------
# 音色独自性, リズム独自性, 旋律性, 倍音, 低音, 空間性, ノイズの少なさ, ループ適性, 組合せ
S = {
 'fs-496870':(5,3,5,5,5,4,3,5,4,'既存に無い海洋・低域・旋律。103分あり非反復の素材を切り出せる。'),
 'fs-408555':(5,4,3,4,3,5,4,4,4,'96k/24の水中録音。クリックと笛の混在で既存に無い音色。'),
 'fs-762242':(5,2,4,4,4,5,4,3,5,'森林の空間に広がる持続音。ドローン層と相性が良い。'),
 'fs-148422':(5,3,2,4,5,4,2,4,4,'既存最低域級の生物音。8分と長いがミニディスク由来でノイズ評価は低め。'),
 'fs-327443':(5,4,5,5,3,2,3,3,3,'強い共鳴の旋律。動物園の残響と周囲音に注意。'),
 'fs-399796':(5,4,5,4,2,4,3,3,4,'模倣を含む複雑な旋律。野外（記載なし）・CC0。'),
 'fs-161691':(4,3,4,4,2,4,4,4,4,'海中の笛状発声。'),
 'fs-498626':(4,3,2,3,4,4,3,4,3,'不規則な低音の群れ。4分47秒と長い。'),
 'fs-755275':(5,4,2,3,3,3,4,3,3,'超音波の可聴化素材（Experimental）。'),
 'fs-75073':(5,5,1,3,2,3,4,5,4,'機械的な連続パルス。他の音は除去済みでループ向き。'),
 'fs-365257':(3,3,2,3,1,5,4,5,5,'日本録音の虫の合唱（96k/24）。Japanモードの環境層不足を補う。'),
 'fs-819668':(5,2,2,5,5,2,3,2,3,'低い唸りと倍音。7.8秒と短い。'),
 'fs-524526':(3,3,5,3,1,3,3,3,4,'既存ウグイスより全帯域。市街地背景あり。'),
 'fs-431302':(4,4,2,3,2,4,4,3,3,'夜間の鋭い間欠発声。'),
 'fs-850410':(3,3,2,3,2,5,4,5,5,'夜の野原の空間。混合録音のため雰囲気素材として。'),
 'fs-347047':(5,5,1,2,2,3,3,4,4,'木を叩く自然のパーカッション。'),
 'wc-kera':(4,3,1,3,4,2,3,5,4,'連続的な低い振動音。ロスレス9分。飼育下。'),
 'fs-278871':(3,4,2,3,2,4,4,4,4,'池のカエル群（96k/24）。'),
 'fs-819667':(3,4,2,3,2,5,4,4,4,'東南アジアのカエル群（AIFF 48k/24・3分半）。'),
 'wc-orca':(5,4,3,4,3,3,2,3,3,'パルス状発声。74kbpsの圧縮音源。'),
 'fs-188723':(4,3,1,3,5,2,2,3,3,'深い低音。AAC由来・モノラル。'),
 'wc-tokay':(4,4,2,3,2,3,2,3,3,'特徴的な反復。73kbps・カメラマイク。'),
 'fs-63220':(3,3,2,3,3,4,3,3,4,'モリフクロウ2羽の鳴き交わし。'),
 'fs-15689':(3,4,2,3,1,3,3,4,4,'アマガエル類の周期的発声（種不明）。'),
 'fs-43824':(3,3,1,2,1,3,3,3,3,'裏庭のコウモリ（検出器なし）。'),
 'fs-203498':(4,3,4,3,2,3,2,3,3,'iPhone・保護施設。'),
 'fs-260797':(3,4,1,2,1,2,4,3,3,'警戒声のみ。'),
 'fs-797762':(4,3,4,4,4,5,4,4,3,'公開データからの空間レンダリング（加工素材）。'),
}
TOP20 = ['fs-496870','fs-408555','fs-762242','fs-148422','fs-327443','fs-399796','fs-161691','fs-498626','fs-755275','fs-75073',
         'fs-365257','fs-819668','fs-524526','fs-431302','fs-850410','fs-347047','wc-kera','fs-278871','wc-tokay','wc-orca']
LIC_OK = {'CC0':'可（帰属不要）','Public domain':'可（帰属不要）','CC BY 4.0':'可（帰属表示）','CC BY 3.0':'可（帰属表示）','CC BY-SA 4.0':'条件付き（改変物は同条件）'}
EXISTING = {'fs-524526':'ウグイス（v0.23・Commons Uguisu5740_cu.ogg）と同種・別録音。帯域（48kHz vs 11024Hz）と収録地（横浜 vs 岐阜）が異なるため別素材として追加理由あり。',
            'fs-365257':'秋の虫の合唱2本（v0.23・兵庫・16kHz）と同種群・別録音。収録地（千葉）・音質（96k/24）が異なる。',
            'fs-850410':'既存にフクロウ・キツネなし。混合録音のため1件として計上。fs-431302（キツネ）とは別録音。'}

if __name__ == '__main__':
    out = 'research'
    os.makedirs(out, exist_ok=True)
    rows = []
    for (no, g, jp, en, lat, feat, st, cids, ex, note) in T:
        cl = [C[i] for i in cids if i in C] or [None]
        for cc in cl:
            sc = S.get(cc['id']) if cc else None
            rows.append({'No': no, '分類': g, '和名': jp, '英名': en, '学名': lat, '音の特徴': feat, '状態': st, 'v0.23/v0.24既存': ex,
                         '候補': cc['title'] if cc else '; '.join(x for x in cids if x not in C), '投稿者': cc['by'] if cc else '', '原典URL': cc['url'] if cc else '',
                         '実在確認': 'ページ確認済' if cc else ('ファイル名のみ' if cids else ''), '記載種': cc['species'] if cc else '',
                         '形式': cc['fmt'] if cc else '', 'サンプルレート': cc.get('sr') or '' if cc else '', 'ビット深度': cc.get('bits') or '' if cc else '',
                         'ch': cc.get('ch') or '' if cc else '', '再生時間': cc['dur'] if cc else '', 'サイズ': cc['size'] if cc else '',
                         'ライセンス': cc['lic'] if cc else '', '商用・同梱・再配布': LIC_OK.get(cc['lic'], '') if cc else '',
                         '録音地': cc['loc'] if cc else '', '野外/飼育': cc['wild'] if cc else '', '混合録音': ('はい' if cc and cc['mixed'] else ('いいえ' if cc else '')),
                         '重複': EXISTING.get(cc['id'], '既存と重複なし（種・録音とも）') if cc else '',
                         '暫定スコア合計(45)': sum(sc[:9]) if sc else '', 'Top20順位': (TOP20.index(cc['id']) + 1) if cc and cc['id'] in TOP20 else '',
                         '備考': ' '.join(x for x in [note, cc['note'] if cc else ''] if x)})
    for i in EXTRA:
        cc = C[i]; sc = S.get(i)
        rows.append({'No': '追加', '分類': '対象外の追加候補', '和名': cc['species'], '学名': cc['latin'] or '', '状態': '候補あり', '候補': cc['title'], '投稿者': cc['by'], '原典URL': cc['url'], '実在確認': 'ページ確認済',
                     '記載種': cc['species'], '形式': cc['fmt'], 'サンプルレート': cc['sr'], 'ビット深度': cc['bits'], 'ch': cc['ch'], '再生時間': cc['dur'], 'サイズ': cc['size'], 'ライセンス': cc['lic'],
                     '商用・同梱・再配布': LIC_OK.get(cc['lic'], ''), '録音地': cc['loc'], '野外/飼育': cc['wild'], '混合録音': 'はい' if cc['mixed'] else 'いいえ',
                     '重複': EXISTING.get(i, '既存と重複なし'), '暫定スコア合計(45)': sum(sc[:9]) if sc else '', 'Top20順位': (TOP20.index(i) + 1) if i in TOP20 else '', '備考': cc['note']})
    keys = list(dict.fromkeys(k for r in rows for k in r))
    with open(f'{out}/candidate_master_v0_25R.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, keys); w.writeheader(); w.writerows(rows)
    from collections import Counter
    def bucket(s):
        if s.startswith('収録済'): return '収録済み'
        if s.startswith('候補あり'): return '採用可能な候補あり'
        if s.startswith('一部'): return '一部のみ'
        if s.startswith('未確'): return '未確認・未確定'
        return '未発見'
    cnt = Counter(bucket(t[6]) for t in T)
    json.dump(dict(candidates=C, excluded=X, unread=U, targets=T, scores=S, top20=TOP20, counts=cnt), open(f'{out}/research_v0_25R.json', 'w'), ensure_ascii=False, indent=1, default=str)
    print(dict(cnt), len(rows), 'adoptable verified:', sum(1 for k in C if C[k]['lic'] in ('CC0', 'Public domain', 'CC BY 4.0', 'CC BY 3.0')))
    # sanity: every Top20 is adoptable licence and verified
    for i in TOP20: assert C[i]['lic'] in ('CC0', 'Public domain', 'CC BY 4.0', 'CC BY 3.0'), i
    assert len(T) == 52 and len(set(TOP20)) == 20
