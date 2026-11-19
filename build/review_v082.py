#!/usr/bin/env python3
"""v0.82 音源の審査台帳（研究用メタデータ）と公開ライブラリの審査状態。2026-11-19 追加。

- research/source_review.json / .csv：候補すべて（APPROVED / REVIEW / REJECTED）。アプリには埋め込まない。
- data/recording_licenses.json と index.html の ae-recordings：公開中の録音に verificationStatus を付ける。
  * APPROVED：CC0・パブリックドメインで、実演家・宗教儀礼の懸念がない
  * LEGACY：この方針より前に公開した録音（CC BY・CC BY-SA、または実演家・宗教的文脈の要確認）。
    既存のプリセットを壊さないため表示は続けるが、新規の取り込みでは使わない区分。扱いはオーナーの判断待ち。
- アプリは verificationStatus が APPROVED か LEGACY の録音だけを読み込む（それ以外・未設定は表示しない＝fail-closed）。
"""
import csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
TODAY = '2026-11-19'

FIELDS = ['id', 'title', 'category', 'subcategory', 'country', 'region', 'community', 'species', 'recordist', 'performer',
          'recording_date', 'duration', 'original_url', 'original_file_url', 'file_format', 'sample_rate', 'bit_depth', 'bitrate',
          'channels', 'license_name', 'license_url', 'license_evidence', 'commercial_use', 'redistribution', 'modification',
          'social_export', 'performer_rights', 'cultural_consent', 'sacred_or_restricted', 'verification_date',
          'verification_status', 'rejection_reason', 'source_batch']

FOLKWAYS_EVIDENCE = 'https://folkways-media.si.edu/docs/folkways/customer_service/License_Request_Form.pdf'
NPS_LIBRARY = 'https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm'
NPS_STATEMENT = ('NPS Yellowstone Sound Library: "The files available here were recorded in the park and are in the public domain. '
                 'They may be downloaded and used without limitation; however, please credit the National Park Service where appropriate."')


def C(**k):
    r = {f: '' for f in FIELDS}
    r.update(verification_date=TODAY, source_batch='chatgpt-2026')
    r.update(k)
    return r


def folkways(title, sacred=False, extra=''):
    return C(id='folkways-' + re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-'), title=title, category='WORLD VOICES',
             subcategory='伝統歌唱・儀礼' if sacred else '伝統歌唱', country='Peru', region='Ucayali（アマゾン）', community='Shipibo-Konibo',
             original_url='https://folkways.si.edu/', license_name='Smithsonian Folkways（商用ライセンス・個別許諾）',
             license_evidence=FOLKWAYS_EVIDENCE, commercial_use='個別許諾が必要', redistribution='不可', modification='不可', social_export='不可',
             performer_rights='未確認', cultural_consent='未確認', sacred_or_restricted='yes' if sacred else 'possible',
             verification_status='REJECTED',
             rejection_reason='Smithsonian Folkways の録音は CC0・PD ではなく、利用には個別のライセンス申請が必要。Shipibo-Konibo の儀礼・葬送に関わる録音は方針により研究用メタデータのみ。' + extra)


def notfound(cid, title, cat, country, extra='', sacred='unknown'):
    return C(id=cid, title=title, category=cat, country=country, verification_status='REVIEW', sacred_or_restricted=sacred,
             commercial_use='不明', redistribution='不明', modification='不明', social_export='不明', performer_rights='未確認', cultural_consent='未確認',
             rejection_reason='原本ページを特定できない（Wikimedia Commons でタイトル検索・2026-11-19）。権利未確認のため公開しない。' + extra)


def bysa(cid, title, cat, country, url, lic='CC BY-SA 4.0', extra='', sacred='unknown'):
    return C(id=cid, title=title, category=cat, country=country, original_url=url, license_name=lic,
             license_url={'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
                          'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/'}.get(lic, ''),
             license_evidence=url, commercial_use='可（条件付き）', redistribution='可（条件付き）', modification='可（条件付き）', social_export='条件付き',
             performer_rights='未確認', cultural_consent='未確認', sacred_or_restricted=sacred, verification_status='REJECTED',
             rejection_reason=lic + ' は今回の採用対象外（CC0・PD のみ）。' + extra)


CW = 'https://commons.wikimedia.org/wiki/File:'
cands = [
    # A. ペルー・アマゾン（Smithsonian Folkways）
    folkways('Shipibo: Feather Song'), folkways('Shipibo: Work Song'), folkways('Shipibo: Lullaby'),
    folkways('Conibo: Social Dance Music'), folkways('Shipibo: Public Work Music'),
    folkways("Shipibo: Girl's Puberty Rite", True), folkways('Conibo: Fiesta Music'), folkways('Shipibo Song'),
    folkways('Conibo: Funeral Music', True),
    # B. アフリカ
    notfound('uganda-traditional-instruments-singing', 'Uganda — Traditional Instruments and Singing', 'WORLD VOICES', 'Uganda'),
    notfound('nigeria-igbo-traditional-singing', 'Nigeria — Igbo Traditional Singing', 'WORLD VOICES', 'Nigeria'),
    notfound('nigeria-igbo-traditional-trumpet', 'Nigeria — Igbo Traditional Trumpet', 'WORLD VOICES', 'Nigeria'),
    bysa('chad-ngambay-traditional-singing', 'Chad — Ngambay Traditional Singing', 'WORLD VOICES', 'Chad', CW + 'Ngambay_traditionalsong.ogg',
         extra='Wiki Loves Africa 2016 の投稿（作者 Mayaf）。'),
    notfound('car-aka-polyphonic-singing', 'Central African Republic — Aka Polyphonic Singing', 'WORLD VOICES', 'Central African Republic'),
    bysa('togo-blekete-rhythm', 'Togo — Blekete Rhythm', 'WORLD VOICES', 'Togo', CW + 'Blekete_rhythm.wav',
         extra='ブレケテはエウェの信仰（ブレクテ神）に結びつく太鼓とされ、文化的確認も必要。', sacred='possible'),
    notfound('ghana-northern-drumming-singing', 'Ghana — Northern Ghana Drumming and Singing', 'WORLD VOICES', 'Ghana'),
    notfound('ghana-akan-nnwonkoro', 'Ghana — Akan Nnwonkoro', 'WORLD VOICES', 'Ghana'),
    bysa('nigeria-hausa-emirate-music', 'Nigeria — Hausa Emirate Music', 'WORLD VOICES', 'Nigeria',
         CW + 'Hausa_traditional_emirate_turbening_music_01.wav', extra='同名の4ファイル（01〜04）すべて CC BY-SA 4.0。首長の儀礼（ターバン授与）の音楽。', sacred='possible'),
    # C. アジア
    notfound('mongolia-traditional-folk-song', 'Mongolia — Traditional Folk Song', 'WORLD VOICES', 'Mongolia'),
    notfound('tuva-chylandyk', 'Tuva — Chylandyk Throat Singing', 'WORLD VOICES', 'Russia (Tuva)'),
    notfound('indonesia-karungut', 'Indonesia — Karungut', 'WORLD VOICES', 'Indonesia', extra='カルングットはダヤクの口承の歌で、儀礼で歌われる場合がある。', sacred='possible'),
    bysa('indonesia-kacapi', 'Indonesia — Kacapi', 'WORLD VOICES', 'Indonesia',
         CW + 'Kacapi_Rincik_Laras_Madenda_koleksi_Jurusan_Karawitan_ISBI_Bandung.wav', extra='Commons の Kacapi 録音（ISBI Bandung 所蔵の4本）はすべて CC BY-SA 4.0。'),
    bysa('indonesia-gender-wayang', 'Indonesia — Balinese Gender Wajang', 'WORLD VOICES', 'Indonesia', CW + 'Gamelan_gender_Wayang_ensemble_accompany.wav',
         extra='ワヤン（影絵芝居）の伴奏で、儀礼の場で演奏されることがある。', sacred='possible'),
    bysa('indonesia-don-dapdape', 'Indonesia — Don Dapdape', 'WORLD VOICES', 'Indonesia', CW + 'Don_Dapdape_(Balinese_Folksong).wav'),
    bysa('indonesia-peteng-bulan', 'Indonesia — Peteng Bulan', 'WORLD VOICES', 'Indonesia', CW + 'Peteng_Bulan_(Balinese_Folksong).wav'),
    bysa('indonesia-javanese-gamelan', 'Indonesia — Javanese Gamelan', 'WORLD VOICES', 'Indonesia', 'https://commons.wikimedia.org/w/index.php?search=Javanese+gamelan',
         extra='Commons の検索で見つかった録音は BY-SA のみ（CC0・PD の録音は見つからない）。'),
    notfound('india-bharud', 'India — Bharud', 'WORLD VOICES', 'India', extra='バルードはヴァールカリー派の信仰に結びつく歌の形式。', sacred='possible'),
    notfound('india-marathi-lokgeet', 'India — Marathi Lokgeet', 'WORLD VOICES', 'India'),
    C(id='cambodia-phlom-slek', title='Cambodia — Phlom Slek（cambodian music 02）', category='WORLD VOICES', subcategory='民族楽器（木の葉笛）',
      country='Cambodia', region='Siem Reap（Prasat Bakong）', recordist='rucisko', performer='地元の男性（氏名なし・録音者とは別人）', recording_date='2019-05-10',
      duration='81.3', original_url='https://freesound.org/people/rucisko/sounds/469487/', file_format='WAV', sample_rate='44100', bit_depth='24', channels='2',
      license_name='CC0 1.0', license_url='https://creativecommons.org/publicdomain/zero/1.0/',
      license_evidence='https://freesound.org/people/rucisko/sounds/469487/ （Commons 転載：' + CW + 'Phlom_Slek.wav）',
      commercial_use='可（録音者の CC0）', redistribution='可', modification='可', social_export='可（録音の権利のみ）',
      performer_rights='未確認：演奏者は録音者が頼んで吹いてもらった地元の人で、実演家の許諾の記録がない', cultural_consent='非儀礼（寺院の近くでくつろいでいた人の演奏と記載）',
      sacred_or_restricted='no', verification_status='REVIEW',
      rejection_reason='録音者の CC0 は実演家の権利まで放棄できない。実演家の許諾が確認できるまで公開しない。'),
    C(id='cambodia-khmer-music-phlom-slek', title='Khmer music including Phlom Slek', category='WORLD VOICES', subcategory='民族楽器・合奏',
      country='Cambodia', recordist='isarthurgrau', recording_date='2012-11-19', duration='674.5',
      original_url='https://freesound.org/people/isarthurgrau/sounds/169957/', file_format='WAV', license_name='CC0 1.0',
      license_url='https://creativecommons.org/publicdomain/zero/1.0/', license_evidence=CW + 'Khmer_music_including_Phlom_Slek.wav',
      commercial_use='可（録音者の CC0）', redistribution='可', modification='可', social_export='可（録音の権利のみ）',
      performer_rights='未確認（演奏者の記載なし）', cultural_consent='未確認', sacred_or_restricted='unknown', verification_status='REVIEW',
      rejection_reason='演奏者が録音者と別人で、実演家の許諾と演奏の場（儀礼かどうか）が確認できない。'),
    notfound('philippines-kolitong', 'Philippines — Kolitong', 'WORLD VOICES', 'Philippines'),
    # D. その他
    notfound('undertone-singing', 'Undertone Singing', 'WORLD VOICES', ''),
    notfound('overtone-singing', 'Overtone Singing', 'WORLD VOICES', '', extra='Commons の “Otonvow.wav” は CC BY-SA 4.0 で対象外。'),
    C(id='tuvan-internationale-self-recorded', title='Tuvan Internationale Vocal, Self Recorded（カルグラ唱法を含む）', category='WORLD VOICES',
      subcategory='倍音唱法（自作自演）', country='', recordist='Commons の投稿者本人', performer='同上（自分で歌って録音）', duration='92.7',
      original_url=CW + 'Tuvan_Internationale_Vocal,_Self_Recorded.wav', file_format='WAV', license_name='CC0 1.0',
      license_url='https://creativecommons.org/publicdomain/zero/1.0/', license_evidence=CW + 'Tuvan_Internationale_Vocal,_Self_Recorded.wav',
      commercial_use='可（録音・実演とも投稿者の CC0）', redistribution='可', modification='可', social_export='要確認', performer_rights='投稿者本人（CC0）',
      cultural_consent='非儀礼', sacred_or_restricted='no', verification_status='REVIEW',
      rejection_reason='曲は「インターナショナル」（旋律 ドジェテール 1932年没・PD）だが、トゥバ語の訳詞の作者と権利が確認できない。政治歌でもあり、使い方はオーナー判断。'),
    notfound('germanic-throat-singing', 'Germanic Throat Singing', 'WORLD VOICES', ''),
    bysa('png-ujangong-mask-dance-singing', 'Papua New Guinea — Ujangong Mask Dance Singing', 'WORLD VOICES', 'Papua New Guinea',
         CW + 'Ujangong_Mix_(ISRC_USUAN1100484).mp3', lic='CC BY 3.0', extra='仮面舞踊の歌で、儀礼的な文脈の可能性もある。', sacred='possible'),
    notfound('japan-nagauta-urashima-1931', 'Japan — Nagauta Urashima (1931)', 'WORLD VOICES', 'Japan',
             extra='1931年の録音は日本法で保護期間が切れている可能性が高いが、原盤・演奏者・出典を特定できていない。'),
]

# E. イエローストーン国立公園の音源ライブラリ（NPS・パブリックドメインと明記）。ファイルの取得と検証が済んだものだけ APPROVED。
NPS = [
    ('yellowstone-fumarole', 'Fumaroles（Norris Porcelain Basin）', 'GEOSPHERE', '噴気孔', 'NorrisPorcelainBasinFumerole', 'fumaroles', 'NPS/Jennifer Jerrett', '2014-01-31'),
    ('yellowstone-black-growler', 'Black Growler Steam Vent', 'GEOSPHERE', '噴気孔（蒸気）', 'NorrisBlackGrowler', 'blackgrowler', 'NPS/Jennifer Jerrett', '2014-01-31'),
    ('yellowstone-dragons-mouth', "The Dragon's Mouth Spring", 'GEOSPHERE', '温泉（洞窟の噴出）', 'DragonsMouth', 'dragonsmouth', 'NPS/David Restivo', '2013-10-29'),
    ('yellowstone-black-sand-pool', 'Black Sand Pool（泡のはじける音）', 'GEOSPHERE', '温泉（泡）', '020102BlackSandBasinBlackSandPoolImplodingBubblesBinaural0101',
     'blacksandpool', 'NPS/Peter Comley', '2015-03-23'),
    ('yellowstone-old-faithful', 'Old Faithful（噴出）', 'GEOSPHERE', '間欠泉', 'OldFaithful11162014', 'oldfaithful', 'NPS/Jennifer Jerrett', '2014-11-16'),
    ('yellowstone-lake-sings', 'Singing Lake（冬のイエローストーン湖の氷）', 'GEOSPHERE', '湖氷', 'YellowstoneLakeSings', 'singinglake', 'NPS/Jennifer Jerrett', '2013-12-17'),
    ('yellowstone-fountain-paint-pot', 'Fountain Paint Pot（泥火山）', 'GEOSPHERE', '泥泉（マッドポット）', 'FountainPaintPot', 'fountainpaintpots', 'NPS/Jennifer Jerrett', '2014-05-01'),
    ('yellowstone-elk-bugle', 'Elk Bugle（アメリカアカシカの雄の声）', 'BIOSPHERE', '哺乳類', 'ElkBugle1', 'elk', 'NPS/Neal Herbert', '2013-10-16'),
    # 2026-11-20 追加（次の一手③）
    ('yellowstone-chorus-frogs', 'Frogs (boreal chorus)', 'BIOSPHERE', '両生類', 'ChorusFrogs', 'chorusfrogs', 'NPS/Neal Herbert', '2014-05-02'),
    ('yellowstone-coyotes', 'Coyotes', 'BIOSPHERE', '哺乳類', 'Coyotes', 'coyote', 'NPS/Neal Herbert', '2014-01-31'),
    ('yellowstone-bison-rut', 'Bison (rut)', 'BIOSPHERE', '哺乳類', '@YELL-BisonRut-JenniferJerrett', 'bison', 'NPS/Jennifer Jerrett', '2014-08-07'),
    ('yellowstone-wilsons-snipe', "Wilson's Snipe", 'BIOSPHERE', '鳥類', 'Snipe', 'wilsonssnip', 'NPS/Jennifer Jerrett', '2014-05-09'),
    ('yellowstone-sandhill-cranes', 'Sandhill Crane', 'BIOSPHERE', '鳥類', 'YELLFLBCSACR20075171', 'sandhillcrane', 'NPS/Shan Burson', '2007-05-17'),
    ('yellowstone-killdeer', 'Killdeer chorus', 'BIOSPHERE', '鳥類', '030404GeyserHillAnemoneKilldeerChorus02M10013', 'killdeer', 'NPS/Peter Comley', '2015-03-22'),
    ('yellowstone-ear-spring', 'Ear Spring', 'GEOSPHERE', '温泉（泡）', 'EarSpring', 'earspring', 'NPS/Jennifer Jerrett', '2014-02-25'),
    ('yellowstone-maple-fire', 'Fire — Maple Fire 2016', 'GEOSPHERE', '森林火災', 'YELLMapleFire20160814T04ms3', 'fire', 'NPS/Jennifer Jerrett', '2016-08-14'),
]
SPECIES = {'yellowstone-elk-bugle': 'Cervus canadensis', 'yellowstone-chorus-frogs': 'Pseudacris maculata', 'yellowstone-coyotes': 'Canis latrans', 'yellowstone-bison-rut': 'Bison bison', 'yellowstone-wilsons-snipe': 'Gallinago delicata', 'yellowstone-sandhill-cranes': 'Antigone canadensis', 'yellowstone-killdeer': 'Charadrius vociferus'}
nps_verified = {}
vf = P('research', 'nps_verified.json')
if os.path.exists(vf):
    nps_verified = json.load(open(vf, encoding='utf-8'))
for cid, title, cat, sub, fn, page, who, date in NPS:
    v = nps_verified.get(cid)
    r = C(id=cid, title=title, category=cat, subcategory=sub, country='United States', region='Yellowstone National Park（Wyoming）',
          species=SPECIES.get(cid, ''), recordist=who, performer='なし（自然音）', recording_date=date,
          original_url='https://www.nps.gov/yell/learn/photosmultimedia/sounds-' + page + '.htm',
          original_file_url='https://www.nps.gov/nps-audiovideo/legacy/mp3/imr/avElement/' + (fn[1:] if fn.startswith('@') else 'yell-' + fn) + '.mp3', file_format='MP3',
          license_name='Public domain（米国国立公園局）', license_url=NPS_LIBRARY, license_evidence=NPS_STATEMENT,
          commercial_use='可', redistribution='可', modification='可', social_export='可（クレジット「National Park Service」を推奨）',
          performer_rights='該当なし（自然音）', cultural_consent='該当なし', sacred_or_restricted='no', source_batch='v0.82-geosphere')
    if v:
        r.update(duration=v['duration'], sample_rate=v['sample_rate'], bitrate=v['bitrate'], channels=v['channels'], bit_depth='（MP3）',
                 verification_status='APPROVED', rejection_reason='', sha256=v['sha256'])
    else:
        r.update(verification_status='REVIEW', rejection_reason='権利は確認済み（PD）。原本ファイルの取得・音質・ハッシュの検証が未了のため保留。')
    cands.append(r)

# NPS ライブラリの残り（2026-11-20 に全ページの CREDIT / AUTHOR を確認）。ページ単位で記録。
MSU_PAGES = ['americancoots', 'dipper', 'americanrobins', 'anemone-geysers', 'artistpaintpots', 'goldeneagle', 'beehivegeyser', 'berylspring', 'canadagoose',
             'commonloon', 'commonyellowthroat', 'mountainbluebird', 'redwingedblackbird', 'ruffedgrouse', 'savannahsparrow', 'townsendssolitaire',
             'westernmeadowlark', 'birdchorus', 'spadefoottoad', 'uintagroundsquirrel', 'wolves']
for k in MSU_PAGES:
    cands.append(C(id='nps-msu-' + k, title='Yellowstone Sound Library — ' + k + '（NPS & MSU Acoustic Atlas 表記の録音）', category='BIOSPHERE/GEOSPHERE',
                   country='United States', region='Yellowstone National Park', original_url='https://www.nps.gov/yell/learn/photosmultimedia/sounds-' + k + '.htm',
                   license_name='Public domain（ライブラリの記載）', license_url=NPS_LIBRARY, license_evidence=NPS_STATEMENT, commercial_use='可（記載上）',
                   redistribution='可（記載上）', modification='可（記載上）', social_export='可（記載上）', performer_rights='該当なし（自然音）', cultural_consent='該当なし',
                   sacred_or_restricted='no', verification_status='REVIEW', source_batch='v0.82-nps-rest',
                   rejection_reason='録音者の表記が「NPS & MSU Acoustic Atlas」の共同表記。州立大学（MSU）側の権利の扱いを Acoustic Atlas に確認するまで採用しない。'))
NPS_REST = {'raven': '他の録音（Black Sand Basin のワタリガラス）', 'warblingvireo': 'ウタイモズモドキ', 'dawnchorus': '朝の合唱（既存の朝の合唱が多い）',
            'bisoneating': 'バイソンの採食音', 'castlegeyser': '間欠泉', 'cliffgeyser': '間欠泉', 'grandgeyser': '間欠泉', 'sawmillgeyser': '間欠泉',
            'veterangeyser': '間欠泉', 'vixengeyser': '間欠泉', 'hurricanevent': '噴気孔', 'puffnstuff': '間欠泉', 'redfox': 'アカギツネ（既存に同種あり）',
            'redsquirrel': 'アメリカアカリス', 'scissorsspringsgeyser': '間欠泉', 'spoutergeyser': '間欠泉', 'thunder': '雷と鳥（既存に雷雨あり）'}
for k, what in NPS_REST.items():
    cands.append(C(id='nps-rest-' + k, title='Yellowstone Sound Library — ' + k + '（' + what + '）', category='BIOSPHERE/GEOSPHERE', country='United States',
                   region='Yellowstone National Park', original_url='https://www.nps.gov/yell/learn/photosmultimedia/sounds-' + k + '.htm',
                   license_name='Public domain（米国国立公園局）', license_url=NPS_LIBRARY, license_evidence=NPS_STATEMENT, commercial_use='可', redistribution='可',
                   modification='可', social_export='可', performer_rights='該当なし（自然音）', cultural_consent='該当なし', sacred_or_restricted='no',
                   verification_status='REVIEW', source_batch='v0.82-nps-rest',
                   rejection_reason='権利は確認済み（NPS 単独表記・PD）。今回は既存との重複を避けて取得していない。採用するには原本の取得・音質・ハッシュの検証が必要。'))
cands.append(C(id='nps-rest-snowmobile', title='Yellowstone Sound Library — snowmobile（スノーモービル）', category='（人工音）', country='United States',
               original_url='https://www.nps.gov/yell/learn/photosmultimedia/sounds-snowmobile.htm', license_name='Public domain（米国国立公園局）', license_url=NPS_LIBRARY,
               license_evidence=NPS_STATEMENT, commercial_use='可', redistribution='可', modification='可', social_export='可', performer_rights='該当なし',
               cultural_consent='該当なし', sacred_or_restricted='no', verification_status='REJECTED', source_batch='v0.82-nps-rest',
               rejection_reason='機械の騒音で、自然音・世界の声のどちらの方針にも合わない。'))
cands.append(C(id='nps-rest-horsebackriders', title='Yellowstone Sound Library — horse-drawn wagon / horseback riders', category='（人の活動音）', country='United States',
               original_url='https://www.nps.gov/yell/learn/photosmultimedia/sounds-horsebackriders.htm', license_name='Public domain（ライブラリの記載）', license_url=NPS_LIBRARY,
               license_evidence=NPS_STATEMENT, commercial_use='可（記載上）', redistribution='可（記載上）', modification='可（記載上）', social_export='要確認',
               performer_rights='人の声が入る可能性（未確認）', cultural_consent='該当なし', sacred_or_restricted='no', verification_status='REJECTED', source_batch='v0.82-nps-rest',
               rejection_reason='人の活動音で人の声が入る可能性があり、方針外。NPS & MSU の共同表記でもある。'))
ids = [c['id'] for c in cands]
assert len(ids) == len(set(ids)), 'duplicate candidate id'
os.makedirs(P('research'), exist_ok=True)
json.dump(cands, open(P('research', 'source_review.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open(P('research', 'source_review.csv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=FIELDS + ['sha256'], extrasaction='ignore')
    w.writeheader()
    for c in cands:
        w.writerow(c)

# ---- 公開中の録音の審査状態 ----
FLAGGED = {  # CC0/PD でも、実演家の権利または宗教的文脈の確認が要るもの
    'zenkoji-bells-kofu': '寺院の鐘（宗教的な営みの音）。儀礼音として扱うかオーナー確認',
    'asakusa-sanja-matsuri': '三社祭（神社の祭礼）の場の音。宗教儀礼の音声に当たるかオーナー確認',
    'beijing-drum-tower': '鼓楼の太鼓の演奏（実演家の許諾の記録なし）',
}


def status_of(r):
    tier = r.get('rightsTier') or ''
    if r['id'] in FLAGGED:
        return 'LEGACY', FLAGGED[r['id']]
    if tier == 'A':
        return 'APPROVED', ''
    return 'LEGACY', {'B': 'CC BY（表記が必要）。v0.82 以降の新規採用の対象外', 'C': 'CC BY-SA（継承あり）。販売版・リールでは使わない（既存方針）'}.get(tier, '区分不明')


def mark(r):
    s, why = status_of(r)
    r['verificationStatus'] = s
    if why:
        r['reviewNote'] = why
    else:
        r.pop('reviewNote', None)
    return r


led = json.load(open(P('data', 'recording_licenses.json'), encoding='utf-8'))
for r in led:
    if not r.get('rightsTier'):
        lic = r['license']
        r['rightsTier'] = 'C' if 'BY-SA' in lic else 'B' if lic.startswith('CC BY') else 'A' if re.match(r'(CC0|Public domain)', lic) else 'X'
    mark(r)
json.dump(led, open(P('data', 'recording_licenses.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

html = open(P('index.html'), encoding='utf-8').read()
m = re.search(r'(<script type="application/json" id="ae-recordings">)(.*?)(</script>)', html, re.S)
recs = json.loads(m.group(2))
tiers = {r['id']: r['rightsTier'] for r in led}
for r in recs:
    had = 'rightsTier' in r
    r.setdefault('rightsTier', tiers.get(r['id']))
    mark(r)
    if not had:
        r.pop('rightsTier', None)
html = html[:m.start(2)] + json.dumps(recs, ensure_ascii=False, separators=(',', ':')) + html[m.end(2):]
open(P('index.html'), 'w', encoding='utf-8').write(html)

from collections import Counter
print('candidates', Counter(c['verification_status'] for c in cands))
print('public', Counter(r['verificationStatus'] for r in led))
