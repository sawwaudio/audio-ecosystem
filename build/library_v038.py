"""v0.38 取り込み：オーナーの Mac にある原本（Freesound）から作った抜粋 86 本の台帳。
各項目の作者・題名・ライセンス・公開日・録音地は 2026-11-02 に Freesound の原典ページで確認した（ブラウザで取得）。
- 種名は原典に記載があるものだけを学名で書く。記載がない・あいまいなものは「記載なし」とし、推測で種を断定しない。
- kind：species（1種の声）／mixed（複数種・種を断定しない合唱）／bed（環境層）
- 除外：231526（Granulated Coral Reef。原典のタグに processed・sci-fi とあり、加工された音のため実録音として扱わない）、
        573584（携帯電話の録音）、687446（4ch・解析に時間がかかるため次回）。
"""
E = []


def add(fs, id, kind, group, jp, en, latin, *, title, author, user, lic, pub, loc, locEn, country, area, regions, native=None,
        japanNative=None, habitats=(), activity=(), roles=('Texture',), wild='野外', date=None, note='', japan=False, extra=''):
    E.append(dict(fs=str(fs), id=id, kind=kind, group=group, jp=jp, en=en, latin=latin, title=title, author=author, user=user, lic=lic,
                  pub=pub, loc=loc, locEn=locEn, country=country, area=area, regions=list(regions), native=list(native or []),
                  japanNative=japanNative, habitats=list(habitats), activity=list(activity), roles=list(roles), wild=wild,
                  date=date or f'不明（Freesound公開 {pub}）', note=note, japan=japan, extra=extra))


NS = '原典に記載なし'
# ───────── 鳥（1種の声）
add(63220, 'tawny-owl', 'species', 'birds', 'モリフクロウ', 'Tawny owl', 'Strix aluco', title='Owls.wav', author='Benboncan', user='Benboncan', lic='BY4', pub='2008-11-16',
    loc='英国ウェールズ・グウィネズ州 Penrhyndeudraeth', locEn='Penrhyndeudraeth, Gwynedd, Wales, UK', country='英国', area='ウェールズ', regions=['europe'], native=['europe', 'asia', 'africa'], japanNative=False,
    habitats=['temperate_forest', 'night_forest'], activity=['night'], roles=['Call & Response'], note='オス2羽の鳴き交わし（原典に学名の記載あり）。残響は周囲の丘による自然のもの（原典記載）。')
add(75073, 'european-nightjar', 'species', 'birds', 'ヨーロッパヨタカ', 'European nightjar', 'Caprimulgus europaeus', title='Nightjar .wav', author='Benboncan', user='Benboncan', lic='BY4', pub='2009-07-01',
    loc='英国ウェールズ・Blaenau Ffestiniog', locEn='Blaenau Ffestiniog, Wales, UK', country='英国', area='ウェールズ', regions=['europe'], native=['europe', 'asia', 'africa'], japanNative=False,
    habitats=['grassland'], activity=['night', 'dusk'], roles=['Drone'], note='ジーという連続音（原典に学名の記載あり）。ほかの音は投稿者が編集で除去（原典記載）。')
add(734533, 'eurasian-wren', 'species', 'birds', 'ミソサザイ（さえずり）', 'Eurasian wren (song)', 'Troglodytes troglodytes', title='Wren song close', author='Sacha.Julien', user='Sacha.Julien', lic='CC0', pub='2024-05-04',
    loc='フランス・イゼール県 Claix（Peuil の自然地区）', locEn='Claix, Isère, France (Peuil natural area)', country='フランス', area='イゼール県', regions=['europe'], native=['europe', 'asia', 'africa', 'japan'], japanNative=True,
    habitats=['temperate_forest'], activity=['day'], roles=['Melody'], note='マイクから約6mのさえずり（原典記載）。原典は英名 “wren”。日本のミソサザイを同種とする分類と別種とする分類がある。')
add(643455, 'eurasian-wren-ireland', 'species', 'birds', 'ミソサザイ（さえずり・アイルランド）', 'Eurasian wren (song, Ireland)', 'Troglodytes troglodytes', title='Wren Birdsong', author='iainmccurdy', user='iainmccurdy', lic='BY4', pub='2022-07-24',
    loc='アイルランド・キルデア州 Maynooth', locEn='Maynooth, Kildare, Ireland', country='アイルランド', area='キルデア州', regions=['europe'], native=['europe', 'asia', 'africa', 'japan'], japanNative=True,
    habitats=['temperate_forest'], activity=['day'], roles=['Melody'], note='毎朝同じ個体と思われるミソサザイ（原典記載。原典は英名 “wren”）。')
add(260797, 'eurasian-wren-alarm', 'species', 'birds', 'ミソサザイ（警戒声）', 'Eurasian wren (alarm call)', 'Troglodytes troglodytes', title='Eurasian Wren alarm call.wav', author='klankbeeld', user='klankbeeld', lic='BY4', pub='2015-01-09',
    loc=NS, locEn='Not stated in source', country='不明', area='', regions=[], native=['europe', 'asia', 'africa', 'japan'], japanNative=True,
    habitats=['temperate_forest'], activity=['day'], roles=['Pulse'], note='警戒声（原典は英名 “Eurasian Wren”）。投稿者がノイズを処理済み（原典記載）。')
add(517477, 'song-thrush', 'species', 'birds', 'ウタツグミ', 'Song thrush', 'Turdus philomelos', title='Song Thrush.wav', author='Artemis_R_Swann', user='Artemis_R_Swann', lic='CC0', pub='2020-05-09',
    loc='英国イングランド・ケンブリッジ', locEn='Cambridge, England, UK', country='英国', area='ケンブリッジシャー', regions=['europe'], native=['europe', 'asia', 'africa'], japanNative=False,
    habitats=['temperate_forest'], activity=['day'], roles=['Melody'], note='原典は英名 “Song Thrush”（学名の記載なし。英名が1種を指す）。原本は32-bit浮動小数のため24-bitへ変換。')
add(785669, 'song-thrush-2', 'species', 'birds', 'ウタツグミ（サウサンプトン）', 'Song thrush (Southampton)', 'Turdus philomelos', title='Song Thrush', author='richwise', user='richwise', lic='CC0', pub='2025-01-18',
    loc='英国イングランド・サウサンプトン', locEn='Southampton, England, UK', country='英国', area='ハンプシャー', regions=['europe'], native=['europe', 'asia', 'africa'], japanNative=False,
    habitats=['temperate_forest'], activity=['day'], roles=['Melody'], date='2024-12-29（原典のファイル名）', note='原典は英名 “Song Thrush”（学名の記載なし）。')
add(801117, 'nightingale', 'species', 'birds', 'サヨナキドリ（ナイチンゲール）', 'Common nightingale', 'Luscinia megarhynchos', title='Nightingale', author='iainmccurdy', user='iainmccurdy', lic='BY4', pub='2025-04-24',
    loc='フランス・ヴォクリューズ県 Malemort-du-Comtat', locEn='Malemort-du-Comtat, Vaucluse, France', country='フランス', area='ヴォクリューズ県', regions=['europe'], native=['europe', 'asia', 'africa'], japanNative=False,
    habitats=['temperate_forest'], activity=['night', 'day'], roles=['Melody'], note='1羽のさえずりをパラボラ集音で周囲から切り分けた録音（原典に学名の記載あり）。低域カット・ノイズ処理あり（原典記載）。')
add(521035, 'nightingale-russia', 'species', 'birds', 'ナイチンゲール（ロシア北西部・種名記載なし）', 'Nightingale (NW Russia, species not stated)', 'Luscinia sp.（原典は “nightingale” のみ）', title='Nightingale Song', author='smand', user='smand', lic='CC0', pub='2020-06-03',
    loc='ロシア・レニングラード州キンギセップ地区 Pustomerzhskoe', locEn='Pustomerzhskoe, Kingisepp District, Leningrad Oblast, Russia', country='ロシア', area='レニングラード州', regions=['europe'],
    habitats=['temperate_forest'], activity=['night'], roles=['Melody'], note='夜の森のさえずり（原典記載）。原典に種名がなく、この地域では2種のナイチンゲールがいるため種を断定しない。')
add(852685, 'nightingale-vendee', 'species', 'birds', 'ナイチンゲール（ヴァンデ・近接・種名記載なし）', 'Nightingale close-up (Vendée, species not stated)', 'Luscinia sp.（原典は “nightingale” のみ）', title='nightingale close up', author='bruno.auzet', user='bruno.auzet', lic='CC0', pub='2026-05-03',
    loc='フランス・ヴァンデ県 Terval', locEn='Terval, Vendée, France', country='フランス', area='ヴァンデ県', regions=['europe'],
    habitats=['temperate_forest'], activity=['night', 'day'], roles=['Melody'], note='約5mの近さで録ったさえずり。遠くにカエル・人の声が時々入る（原典記載）。原典に種名の記載がないため種を断定しない。')
add(524526, 'uguisu-yokohama', 'species', 'birds', 'ウグイス（横浜・街なか）', 'Japanese bush warbler (Yokohama, city)', 'Horornis diphone', title='Japanese bush warbler (uguisu) in a city ambiance', author='warukunai', user='warukunai', lic='CC0', pub='2020-06-30',
    loc='神奈川県横浜市（投稿者の自宅付近）', locEn='Yokohama, Kanagawa (near the recordist’s home)', country='日本', area='神奈川県横浜市', regions=['asia', 'japan'], native=['asia', 'japan'], japanNative=True,
    habitats=[], activity=['day'], roles=['Melody'], japan=True, note='原典は英名と「uguisu」。風・車など街の音を含む（原典記載）。市街地のため生息環境フィルターには使わない。')
for i, fs, pub in [(1, 432605, '2018-06-15'), (2, 432604, '2018-06-15'), (3, 432603, '2018-06-15')]:
    add(fs, f'loon-{i}', 'species', 'birds', f'アビの声（ウィスコンシン）{i}', f'Loon call (Wisconsin) {i}', 'Gavia sp.（原典は “Loon, Diver”）', title=f'Loon / Diver call {i}', author='nicStage', user='nicStage', lic='BY4', pub=pub,
        loc='米国ウィスコンシン州 Mercer Lake（ジオタグは Minocqua）', locEn='Mercer Lake, Wisconsin, USA', country='米国', area='ウィスコンシン州', regions=['north_america'],
        habitats=['wetland'], activity=[], roles=['Melody', 'Call & Response'], note='湖のアビ類の声（原典は “Loon, Diver”。種名の記載なし）。Rode NT-4＋MixPre-6（原典記載）。')
add(399796, 'lyrebird', 'species', 'birds', 'コトドリ', 'Superb lyrebird', 'Menura novaehollandiae', title='Superb Lyrebird II', author='samarobryn', user='samarobryn', lic='CC0', pub='2017-08-18',
    loc='オーストラリア・ビクトリア州 Bogong Village 付近', locEn='near Bogong Village, Victoria, Australia', country='オーストラリア', area='ビクトリア州', regions=['oceania'], native=['oceania'], japanNative=False,
    habitats=['temperate_forest'], activity=['day'], roles=['Melody'], note='原典は英名 “Superb Lyrebird”（1種を指す）。雨粒が録音機に当たる音あり（原典記載）。')
add(203498, 'lyrebird-healesville', 'species', 'birds', 'コトドリ（ヒールズビル・サンクチュアリ・物まね）', 'Superb lyrebird mimicry (Healesville Sanctuary)', 'Menura novaehollandiae（原典は “Lyrebird”）', title='Lyrebird imitating sounds at Healesville Sanctuary.wav', author='youthful_implants', user='youthful_implants', lic='CC0', pub='2013-10-21',
    loc='オーストラリア・ビクトリア州 ヒールズビル・サンクチュアリ', locEn='Healesville Sanctuary, Victoria, Australia', country='オーストラリア', area='ビクトリア州', regions=['oceania'], native=['oceania'], japanNative=False,
    habitats=[], activity=['day'], roles=['Melody', 'Experimental'], wild='飼育（動物保護施設）', note='他の鳥やカメラのシャッター音の物まね（原典記載）。iPhone 録音を軽く編集・正規化したもの（原典記載。非圧縮マスターではない可能性）。ヒールズビルのコトドリはコトドリ（Superb）と考えられるが、原典は “Lyrebird” のみ。')
add(347047, 'woodpecker', 'species', 'birds', 'キツツキ類（種名記載なし）', 'Woodpecker (species not stated)', '記載なし（キツツキ科）', title='Woodpecker', author='johnaudiotech', user='johnaudiotech', lic='CC0', pub='2016-06-06',
    loc=NS, locEn='Not stated in source', country='不明', area='', regions=[], habitats=['temperate_forest'], activity=['day'], roles=['Percussion'], note='森で木をたたく音（原典記載）。')
add(554594, 'woodpecker-leipzig', 'species', 'birds', 'キツツキ類（ライプツィヒ・種名記載なし）', 'Woodpecker (Leipzig, species not stated)', '記載なし（キツツキ科）', title='woodpecker tap knock hammer in wood sound effect', author='Garuda1982', user='Garuda1982', lic='BY4', pub='2021-01-17',
    loc='ドイツ・ザクセン州ライプツィヒ', locEn='Leipzig, Saxony, Germany', country='ドイツ', area='ザクセン州', regions=['europe'], habitats=['temperate_forest'], activity=['day'], roles=['Percussion'],
    note='PCM-D100＋ME66（原典記載）。原本は192kHzのため96kHzへ変換。')
add(847353, 'woodpecker-illinois', 'species', 'birds', 'キツツキ類のドラミング（イリノイ・種名記載なし）', 'Woodpecker drumming (Illinois, species not stated)', '記載なし（キツツキ科）', title='Woodpecker drumming in morning March 6 2026', author='kvgarlic', user='kvgarlic', lic='CC0', pub='2026-03-06',
    loc='米国イリノイ州 ショーニー国有林（Carbondale）', locEn='Shawnee National Forest, Illinois, USA', country='米国', area='イリノイ州', regions=['north_america'], habitats=['temperate_forest'], activity=['day'], roles=['Percussion', 'Pulse'],
    date='2026-03-06（原典の題名）', note='朝のドラミング（原典記載）。')
add(744205, 'scops-owls-crete', 'species', 'birds', 'コノハズク類（クレタ島・種名記載なし）', 'Scops owls (Crete, species not stated)', 'Otus sp.（原典は “Scops Owls”）', title='Scops Owls (Crete)', author='iainmccurdy', user='iainmccurdy', lic='BY4', pub='2024-07-02',
    loc='ギリシャ・クレタ島 Kare（内陸の村）', locEn='Kare, Crete, Greece', country='ギリシャ', area='クレタ島', regions=['europe'], habitats=['grassland'], activity=['night'], roles=['Call & Response', 'Pulse'],
    note='少なくとも4羽が距離を変えて鳴く（原典記載）。虫・遠くのヤギの音を含む。原典に学名の記載がないため種を断定しない。')
# ───────── 鳥（複数種）
add(619718, 'edge-forest-nl', 'mixed', 'birds', 'オランダの森の縁の朝（アカゲラ・ウタツグミ等）', 'Forest edge at dawn (Netherlands): woodpeckers & thrushes', '複数種：Great Spotted Woodpecker・Song Thrush・Mistle Thrush 等（原典の英名）',
    title='edge forest 0738AM 210221_0257.wav', author='klankbeeld', user='klankbeeld', lic='BY4', pub='2022-02-13', loc='オランダ・北ブラバント州 Helvoirt（Loonse en Drunense Duinen 付近）', locEn='Helvoirt, North Brabant, Netherlands',
    country='オランダ', area='北ブラバント州', regions=['europe'], habitats=['temperate_forest'], activity=['day'], roles=['Percussion', 'Melody'], date='2021-02-21 07:38（原典の題名）', note='アカゲラのドラミング、ウタツグミ・ヤドリギツグミのさえずり、カラス・ガン（原典の英名による）。種数に加算しない。')
add(344880, 'dawn-chorus-ashdown', 'mixed', 'birds', '夜明けの合唱とカッコウ（英国・アッシュダウンの森）', 'Dawn chorus with distant cuckoo (Ashdown Forest, UK)', '複数種（遠くのカッコウを含む。原典記載）',
    title='Dawn chorus Ashdown Forrest Distact Cuckoo.wav', author='Simon Spiers', user='Simon%20Spiers', lic='CC0', pub='2016-05-02', loc='英国イングランド・アッシュダウンの森', locEn='Ashdown Forest, England, UK',
    country='英国', area='イースト・サセックス', regions=['europe'], habitats=['temperate_forest'], activity=['day'], roles=['Texture', 'Melody'], date='2016-04-30 5時ごろ（原典記載）', note='春の夜明けの合唱。種数に加算しない。')
add(576578, 'dawn-chorus-brittany', 'mixed', 'birds', '夜明けの合唱（フランス・ブルターニュ）', 'Dawn chorus (Brittany, France)', '複数種（種名の記載なし）',
    title='210528_1603_FR_DawnChorus.wav', author='kevp888', user='kevp888', lic='BY4', pub='2021-06-17', loc='フランス・ブルターニュ Plomodiern 付近', locEn='near Plomodiern, Brittany, France',
    country='フランス', area='フィニステール県', regions=['europe'], habitats=['temperate_forest'], activity=['day'], roles=['Texture', 'Melody'], date='2021年5月（原典記載）', note='原本は57分。区間は冒頭8分から選択。原典に両端のフェード処理の記載あり。')
add(843606, 'dawn-chorus-provence', 'mixed', 'birds', '夜明けの合唱とナイチンゲール（プロヴァンス）', 'Provençal dawn chorus with nightingale', '複数種（近くのナイチンゲールを含む。原典記載）',
    title='Provençal Dawn Chorus - Nightingale', author='iainmccurdy', user='iainmccurdy', lic='BY4', pub='2026-01-30', loc='フランス・ヴォクリューズ県 Méthamis（Vallat de Coulombey）', locEn='Méthamis, Vaucluse, France',
    country='フランス', area='ヴォクリューズ県', regions=['europe'], habitats=['temperate_forest'], activity=['day'], roles=['Melody', 'Texture'], date='2025-04-26 日の出前（原典記載）', note='MKH 8040 の ORTF（原典記載）。')
add(440604, 'fujinomiya-forest-birds', 'mixed', 'birds', '森の鳥のさえずり（静岡・富士宮）', 'Forest birdsong (Fujinomiya, Shizuoka)', '複数種（種名の記載なし）',
    title='singing birds in the forest', author='florianreichelt', user='florianreichelt', lic='CC0', pub='2018-09-17', loc='静岡県富士宮市（原典の地名）', locEn='Fujinomiya, Shizuoka, Japan',
    country='日本', area='静岡県富士宮市', regions=['asia', 'japan'], habitats=['temperate_forest', 'mountain'], activity=['day'], roles=['Melody', 'Texture'], japan=True, note='日本旅行中の録音（原典記載）。種は未特定のため種数に加算しない。')
# ───────── 動物（1種の声）
add(431302, 'fox', 'species', 'animals', 'キツネ（夜の鳴き声）', 'Fox cry at night', '記載なし（原典は “fox”）', title='Fox Cry.wav', author='Simon Spiers', user='Simon%20Spiers', lic='CC0', pub='2018-05-27',
    loc=NS + '（寝室の窓のすぐ外）', locEn='Not stated (just outside the bedroom window)', country='不明', area='', regions=[], habitats=[], activity=['night'], roles=['Call & Response'],
    note='真夜中に窓の外で鳴いたキツネ（原典記載）。原典に種名・録音地の記載がないため種を断定しない。')
add(762242, 'wolf', 'species', 'animals', 'オオカミ（群れの遠吠え・ヴェルコール）', 'Wolf pack howling (Vercors)', 'Canis lupus（原典は “wolves”）', title='Wolves howling (spontaneous and free )', author='Sacha.Julien', user='Sacha.Julien', lic='BY4', pub='2024-10-29',
    loc='フランス・ヴェルコールの森', locEn='Vercors forest, France', country='フランス', area='ヴェルコール', regions=['europe'], native=['europe', 'asia', 'north_america'], japanNative=False,
    habitats=['temperate_forest', 'mountain', 'night_forest'], activity=['night'], roles=['Drone', 'Call & Response'], date='2024年秋（原典記載）', note='野生の群れの自発的な遠吠え（原典記載）。ヨーロッパの野生オオカミは Canis lupus。')
add(850406, 'roe-deer', 'species', 'animals', 'ノロジカの鳴き交わし（ブルターニュ）', 'Roe deer calls (Brittany)', 'Capreolus capreolus（原典は “roe deer”）', title='two roe-deers', author='bruno.auzet', user='bruno.auzet', lic='CC0', pub='2026-04-14',
    loc='フランス・モルビアン県 Saint-Dolay', locEn='Saint-Dolay, Morbihan, France', country='フランス', area='モルビアン県', regions=['europe'], native=['europe', 'asia'], japanNative=False,
    habitats=['grassland'], activity=['dusk'], roles=['Call & Response'], note='2頭のノロジカの鳴き交わし。春の鳥（クロウタドリ・ヨーロッパコマドリ等）と羊の鈴を含む（原典記載）。')
add(327443, 'siamang', 'species', 'animals', 'フクロテナガザル（香港動物園）', 'Siamang (Hong Kong Zoo)', 'Symphalangus syndactylus（原典は “Siamang”）', title='Siamang Gibbon Calls', author='RTB45', user='RTB45', lic='BY4', pub='2015-11-02',
    loc='香港・中西区（香港動植物公園）', locEn='Hong Kong Zoological and Botanical Gardens', country='中国（香港）', area='香港', regions=['asia'], native=['asia'], japanNative=False,
    habitats=[], activity=['dusk'], roles=['Call & Response', 'Melody'], wild='飼育（動物園）', note='オス・メスのペアの夕方のなわばりの声（原典記載）。動物園の録音のため生息環境フィルターには使わない。')
add(819670, 'siamang-belgium', 'species', 'animals', 'フクロテナガザル（ベルギーの動物園）', 'Siamangs (zoo, Belgium)', 'Symphalangus syndactylus（原典は “siamang”）', title='siamang monkeys', author='ikbenraar', user='ikbenraar', lic='CC0', pub='2025-08-15',
    loc='ベルギー・エノー州 Brugelette（動物園）', locEn='zoo in Brugelette, Hainaut, Belgium', country='ベルギー', area='エノー州', regions=['europe'], native=['asia'], japanNative=False,
    habitats=[], activity=['day'], roles=['Call & Response'], wild='飼育（動物園）', note='複数のフクロテナガザル（原典記載）。')
add(148422, 'howler-belize', 'species', 'animals', 'クロホエザルの夜の声（ベリーズ）', 'Black howler monkeys at night (Belize)', 'Alouatta sp.（原典は “Black Howler Monkeys”）', title='Howler Monkeys-Belize.wav', author='RTB45', user='RTB45', lic='BY4', pub='2012-03-09',
    loc='ベリーズ・カヨ地区 ブルーホール国立公園付近', locEn='near Blue Hole National Park, Cayo, Belize', country='ベリーズ', area='カヨ地区', regions=['north_america'],
    habitats=['tropical_rainforest', 'night_forest'], activity=['night'], roles=['Drone', 'Call & Response'], note='夜のホエザルと森の音（原典記載）。原典は英名のみで学名の記載なし。MD録音を経由（原典記載。非圧縮マスターではない可能性）。')
add(819668, 'elephant-zoo', 'species', 'animals', 'ゾウ（ベルギーの動物園・種名記載なし）', 'Elephant (zoo, Belgium, species not stated)', '記載なし（ゾウ科）', title='Elephant sound', author='ikbenraar', user='ikbenraar', lic='CC0', pub='2025-08-15',
    loc='ベルギー・エノー州 Brugelette（動物園）', locEn='zoo in Brugelette, Hainaut, Belgium', country='ベルギー', area='エノー州', regions=['europe'], habitats=[], activity=['day'], roles=['Experimental'], wild='飼育（動物園）', note='約8秒（原典の長さ）。')
add(498626, 'sea-lion-valparaiso', 'species', 'animals', 'アシカの叫び（チリ・バルパライソ・種名記載なし）', 'Sea lions (Valparaíso, Chile, species not stated)', '記載なし（アシカ科）', title='Sea Lion screaming in Caleta Portales (Chile)', author='felix.blume', user='felix.blume', lic='CC0', pub='2019-12-19',
    loc='チリ・バルパライソ Caleta Portales（魚市場の近く）', locEn='Caleta Portales, Valparaíso, Chile', country='チリ', area='バルパライソ州', regions=['south_america', 'marine'], habitats=['coast'], activity=['day'], roles=['Call & Response'],
    note='魚の残りを待つアシカ（原典記載）。')
add(849186, 'sea-lion-valdivia', 'species', 'animals', 'アシカのうなり声（チリ・バルディビア・種名記載なし）', 'Growling sea lion (Valdivia, Chile, species not stated)', '記載なし（原典は “lobo marino, sea lion”）', title='Lobo Marino Grunendo - Growling Sea Lion', author='Diim_1', user='Diim_1', lic='CC0', pub='2026-03-30',
    loc='チリ・ロス・リオス州バルディビアの沿岸', locEn='coast of Valdivia, Los Ríos, Chile', country='チリ', area='ロス・リオス州', regions=['south_america', 'marine'], habitats=['coast'], activity=[], roles=['Percussion'], note='約3.6秒（原典の長さ）。')
add(43824, 'bats-backyard', 'species', 'animals', 'コウモリの狩りの声（種名記載なし）', 'Insect-eating bats hunting (species not stated)', '記載なし（翼手目）', title='Bats Hunting For Insects.wav', author='digifishmusic', user='digifishmusic', lic='BY4', pub='2007-11-13',
    loc=NS + '（投稿者の裏庭）', locEn='Not stated (the recordist’s back yard)', country='不明', area='', regions=[], habitats=[], activity=['night'], roles=['Pulse', 'Experimental'],
    note='2頭の食虫性コウモリ。10kHz 未満を投稿者が除去（原典記載）。')
add(724581, 'bat-batbox', 'species', 'animals', 'コウモリのエコーロケーション（バットディテクター・フランス）', 'Bat echolocation via bat detector (France)', '記載なし（翼手目）', title='Bat echolocation call captured with a batbox', author='Sacha.Julien', user='Sacha.Julien', lic='CC0', pub='2024-02-23',
    loc='フランス・ドローム県 Eurre の自然保護区（Livron-sur-Drôme）', locEn='Eurre nature reserve, Drôme, France', country='フランス', area='ドローム県', regions=['europe'], habitats=['river'], activity=['night'], roles=['Pulse', 'Experimental'],
    note='超音波をバットディテクター（Pettersson）で聞こえる音に変換したもの（原典記載）。')
add(755275, 'bat-slowed', 'species', 'animals', 'コウモリのエコーロケーション（0.05倍速）', 'Bat echolocation at 0.05× speed', '記載なし（翼手目）', title='bat echolocation at 0.05 times speed', author='Garuda1982', user='Garuda1982', lic='CC0', pub='2024-09-19',
    loc=NS, locEn='Not stated in source', country='不明', area='', regions=[], habitats=[], activity=['night'], roles=['Experimental'], note='超音波を 0.05 倍の速さに下げて聞こえるようにしたもの（原典の題名）。')
add(161691, 'dolphin', 'species', 'animals', 'イルカの声（カリブ海・水中・種名記載なし）', 'Dolphins underwater (Caribbean, species not stated)', '記載なし（原典は “dolphins”）', title='Dolphin screaming underwater in Caribbean Sea (Mexico)', author='felix.blume', user='felix.blume', lic='CC0', pub='2012-07-24',
    loc='メキシコ・キンタナロー州 プンタ・アレン近くの沖', locEn='off Punta Allen, Quintana Roo, Mexico', country='メキシコ', area='キンタナロー州', regions=['north_america', 'marine'], habitats=['ocean'], activity=['day'], roles=['Melody', 'Experimental'],
    date='2012年7月（原典記載）', note='船上からハイドロフォンで録音（原典記載）。')
add(385796, 'atlantic-spotted-dolphin', 'species', 'animals', 'タイセイヨウマダライルカ', 'Atlantic spotted dolphin', 'Stenella frontalis', title='Atlantic Spotted Dolphins off the coast of La Gomera, Canary Islands', author='geraldfiebig', user='geraldfiebig', lic='CC0', pub='2017-03-25',
    loc='スペイン・カナリア諸島ラ・ゴメラ島 Valle Gran Rey 沖', locEn='off Valle Gran Rey, La Gomera, Canary Islands, Spain', country='スペイン', area='カナリア諸島', regions=['africa', 'marine'], native=['marine'], japanNative=False,
    habitats=['ocean'], activity=['day'], roles=['Melody', 'Experimental'], date='2017-03-11（原典記載）', note='ホエールウォッチング船からの録音。前半は船上の録音機、後半は水中（原典記載。学名の記載あり）。')
add(408555, 'amazon-river-dolphins', 'species', 'animals', 'アマゾンのカワイルカ（テフェ川・種名記載なし）', 'Amazonian river dolphins (Rio Tefé, species not stated)', '記載なし（原典は “Amazonian Dolphins”）', title='Amazonian Dolphins', author='felix.blume', user='felix.blume', lic='CC0', pub='2017-11-06',
    loc='ブラジル・アマゾナス州 テフェ川（Tauary 村の近く）', locEn='Rio Tefé near Tauary, Amazonas, Brazil', country='ブラジル', area='アマゾナス州', regions=['south_america'], habitats=['river', 'tropical_rainforest'], activity=['day'], roles=['Pulse', 'Experimental'],
    date='2017年9月（原典記載）', note='ハイドロフォン録音（原典記載）。この川には複数種のカワイルカがいるため種を断定しない。')
add(496870, 'humpback', 'species', 'animals', 'ザトウクジラの歌（モントレー湾・深海）', 'Humpback whale song (Monterey Bay, deep water)', 'Megaptera novaeangliae', title='MBARI_MARS_2017_1107h22_HS1P2.wav', author='MBARI_MARS', user='MBARI_MARS', lic='BY4', pub='2019-12-12',
    loc='米国カリフォルニア州サンタクルーズ沖の深海（36.71, −122.186）', locEn='deep water off Santa Cruz, California (36.71, −122.186)', country='米国', area='カリフォルニア州沖', regions=['north_america', 'marine'], native=['marine'], japanNative=True,
    habitats=['ocean'], activity=['night'], roles=['Melody', 'Drone'], date='2017-11-07 22時台（原典のファイル名）', note='MBARI の海洋観測ハイドロフォン（原典に学名の記載あり）。ナガスクジラの低い声を含む区間がある（原典記載）。原本は約103分。区間は冒頭8分から選択。32kHz。')
add(15689, 'treefrog-france', 'species', 'animals', 'アマガエル類（フランス南西部・種名記載なし）', 'Tree frog (SW France, species not stated)', '記載なし（原典は “treefrog”）', title='tree frog.wav', author='reinsamba', user='reinsamba', lic='BY4', pub='2006-02-14',
    loc='フランス・ロット＝エ＝ガロンヌ県 Saint-Sernin', locEn='Saint-Sernin, Lot-et-Garonne, France', country='フランス', area='ロット＝エ＝ガロンヌ県', regions=['europe'], habitats=['wetland'], activity=['night'], roles=['Pulse'],
    date='1999年4月（原典記載）', note='繁殖期の1匹（原典記載）。DAT録音。')
add(462863, 'common-toad', 'species', 'animals', 'ヨーロッパヒキガエル', 'Common toad', 'Bufo bufo', title='Common toad (Bufo bufo)', author='Breviceps', user='Breviceps', lic='CC0', pub='2019-03-08',
    loc=NS + '（ヒキガエルの道路横断を助ける活動中、バケツの中）', locEn='Not stated (in a bucket during a toad-crossing patrol)', country='不明', area='', regions=[], native=['europe', 'asia', 'africa'], japanNative=False,
    habitats=[], activity=['night'], roles=['Pulse'], note='原典の題名に学名の記載あり。バケツの中の声のため生息環境フィルターには使わない。約11秒。')
add(802737, 'small-frog-ojai', 'species', 'animals', 'カエルの声（カリフォルニア・オーハイ・種名記載なし）', 'Small frog croaks (Ojai, California, species not stated)', '記載なし（原典は “frog”）', title='Small Frog Croaks', author='clif_creates', user='clif_creates', lic='CC0', pub='2025-04-29',
    loc='米国カリフォルニア州 Ojai', locEn='Ojai, California, USA', country='米国', area='カリフォルニア州', regions=['north_america'], habitats=['river'], activity=['night'], roles=['Pulse'], note='群れから1匹を切り出したもの。iZotope RX でノイズ処理（原典記載）。約3.4秒。')
add(852657, 'pacific-treefrog-chorus', 'species', 'animals', 'タイヘイヨウアマガエル類の合唱（カリフォルニア・ペトロリア）', 'Pacific tree frog chorus (Petrolia, California)', 'Pseudacris sp.（原典は “Pacific Tree Frogs”）', title='Pacific Tree Frogs in Secluded Pond, Petrolia, CA', author='CVLTIV8R', user='CVLTIV8R', lic='CC0', pub='2026-05-02',
    loc='米国カリフォルニア州 Petrolia の小さな池', locEn='small pond in Petrolia, California, USA', country='米国', area='カリフォルニア州', regions=['north_america'], habitats=['wetland'], activity=['night'], roles=['Texture', 'Pulse'],
    note='原典は英名 “Pacific Tree Frogs”（分類の変更があり英名から種を1つに決めない）。原本は32-bitのため24-bitへ変換。')
# ───────── 動物（複数種・合唱・水中）
add(850410, 'owl-fox-brittany', 'mixed', 'animals', 'モリフクロウとキツネの夜（ブルターニュ）', 'Tawny owl and fox at night (Brittany)', '複数種：Strix aluco（原典は “tawny owl, chouette hulotte”）とキツネ（種名記載なし）',
    title='owl and fox in large', author='bruno.auzet', user='bruno.auzet', lic='CC0', pub='2026-04-14', loc='フランス・モルビアン県 Saint-Dolay の広い野原', locEn='open field in Saint-Dolay, Morbihan, France',
    country='フランス', area='モルビアン県', regions=['europe'], habitats=['grassland', 'night_forest'], activity=['night'], roles=['Call & Response', 'Atmosphere'], date='2026年4月（原典記載）', note='遠くの犬の声を含む。軽いノイズ処理（原典記載）。')
add(797762, 'whales-orcas-norway', 'mixed', 'animals', 'ザトウクジラとシャチ（ノルウェー・水中）', 'Humpback whales and orcas underwater (Norway)', '複数種：ザトウクジラ・シャチ（原典の英名）',
    title='humpback_whales_and_orcas_ambient_underwater_recording', author='raiden04', user='raiden04', lic='BY4', pub='2025-04-08', loc='ノルウェー・トロムス Skjervøy', locEn='Skjervøy, Troms, Norway',
    country='ノルウェー', area='トロムス', regions=['europe', 'marine'], habitats=['ocean'], activity=[], roles=['Melody', 'Atmosphere'], note='ヘッドホン向けの立体音響として処理された水中録音（原典記載）。原本は32-bitのため24-bitへ変換。')
add(737242, 'snapping-shrimp', 'mixed', 'animals', 'テッポウエビ類のはじける音（フロリダ・水中）', 'Snapping shrimp (Florida, underwater)', '記載なし（原典は “snapping shrimp”）',
    title='ANMLAqua-snapping-shrimp-choppy-water-20240223', author='nathanwolek', user='nathanwolek', lic='BY4', pub='2024-05-26', loc='米国フロリダ州 New Smyrna Beach（キャナベラル国立海岸）', locEn='Canaveral National Seashore, Florida, USA',
    country='米国', area='フロリダ州', regions=['north_america', 'marine'], habitats=['coast', 'ocean'], activity=['day'], roles=['Texture', 'Percussion'], date='2024-02-23（原典の題名）', note='はさみを閉じて獲物を気絶させる音（原典記載）。風で荒れた水面の音を含む。')
add(188723, 'bullfrogs-hk', 'mixed', 'animals', 'ウシガエル類の合唱（香港・駐車場・種名記載なし）', 'Bullfrogs in a car park (Hong Kong, species not stated)', '記載なし（原典は “bullfrogs”）',
    title='Bullfrog Concerto.wav', author='soloan', user='soloan', lic='BY4', pub='2013-05-19', loc='香港（駐車場）', locEn='a car park in Hong Kong', country='中国（香港）', area='香港', regions=['asia'], habitats=[], activity=['night'], roles=['Pulse', 'Drone'],
    note='iPhone の AAC 録音を MP3 に変換したもの（原典記載）。非圧縮の音質ではない。')
add(813256, 'peepers-toads-ozarks', 'mixed', 'animals', 'スプリングピーパーとアメリカヒキガエル（オザーク）', 'Spring peepers and American toads (Ozarks)', '複数種（原典の英名：spring peepers・American toads）',
    title='Spring Night Frogs (loop)', author='NickTayloe', user='NickTayloe', lic='BY4', pub='2025-06-24', loc='米国ミズーリ州 Edgar Springs（オザークの小川の近く）', locEn='Edgar Springs, Missouri, USA (Ozarks)',
    country='米国', area='ミズーリ州', regions=['north_america'], habitats=['wetland', 'river'], activity=['night'], roles=['Texture', 'Pulse'], note='つなぎ目なくループするよう編集済み（原典記載）。')
add(242851, 'treefrogs-newyork', 'mixed', 'animals', 'アマガエル類の合唱（ニューヨーク州・種名記載なし）', 'Tree frog chorus (New York, species not stated)', '記載なし（原典は “Tree Frogs”）',
    title='Tree Frogs', author='knufds', user='knufds', lic='CC0', pub='2014-07-18', loc='米国ニューヨーク州ダッチェス郡北部 Milan（トウモロコシ畑のそばの湿地）', locEn='Milan, Dutchess County, New York, USA',
    country='米国', area='ニューヨーク州', regions=['north_america'], habitats=['wetland'], activity=['night'], roles=['Texture'], date='2005年ごろ（原典記載）', note='Oktava 012 の XY＋Marantz（原典記載）。')
add(278871, 'frog-pond-netherlands', 'mixed', 'animals', '森の池のカエルの合唱（オランダ）', 'Frogs in a forest pond (Netherlands)', '記載なし（原典は “frogs”）',
    title='Nature sounds frog 3.WAV', author='Sandermotions', user='Sandermotions', lic='CC0', pub='2015-07-03', loc='オランダ・フレヴォラント州 Dronten', locEn='Dronten, Flevoland, Netherlands',
    country='オランダ', area='フレヴォラント州', regions=['europe'], habitats=['wetland', 'temperate_forest'], activity=[], roles=['Texture', 'Pulse'], note='Zoom H1（原典記載）。')
add(503206, 'lake-frogs-katydids', 'mixed', 'animals', '夜の湖のカエルとキリギリス類（イリノイ）', 'Frogs and katydids on a lake at night (Illinois)', '記載なし（原典は “frogs and katydids”）',
    title='Lilipads and frogs at night.wav', author='Danjocross', user='Danjocross', lic='CC0', pub='2020-01-22', loc='米国イリノイ州の湖', locEn='a lake in Illinois, USA',
    country='米国', area='イリノイ州', regions=['north_america'], habitats=['wetland'], activity=['night'], roles=['Texture', 'Pulse'], note='無編集。車・飛行機の音なし（原典記載）。')
add(503211, 'utah-canyon-frogs', 'mixed', 'animals', '峡谷のカエル・ヒキガエルと夜の鳥（ユタ）', 'Frogs, toads and night birds in a canyon (Utah)', '記載なし（原典は “toads and frogs”）',
    title='Frogs Toads and Night Birds in Utah.wav', author='Danjocross', user='Danjocross', lic='CC0', pub='2020-01-22', loc='米国ユタ州 Hite 付近の小さな峡谷の水たまり', locEn='canyon pothole near Hite, Utah, USA',
    country='米国', area='ユタ州', regions=['north_america'], habitats=['wetland', 'mountain'], activity=['night'], roles=['Texture', 'Call & Response'], note='風・車・飛行機の音なし（原典記載）。')
add(645706, 'brazil-frog-chorus', 'mixed', 'animals', '夜のカエルの合唱とコオロギ（ブラジル・リオデジャネイロ州）', 'Night frog chorus with crickets (Rio de Janeiro State, Brazil)', '記載なし（原典は “frogs” “crickets”）',
    title='AMBRurl_BR Serrinha do alambari night frogs chorus with close crickets_Melia Roger_ORTF Schoeps.WAV', author='MeliaRoger', user='MeliaRoger', lic='CC0', pub='2022-08-03',
    loc='ブラジル・リオデジャネイロ州 Resende（Serrinha do Alambari）', locEn='Serrinha do Alambari, Resende, Rio de Janeiro, Brazil', country='ブラジル', area='リオデジャネイロ州', regions=['south_america'],
    habitats=['tropical_rainforest', 'night_forest'], activity=['night'], roles=['Texture', 'Pulse'], note='夏の夜（原典記載）。')
add(669408, 'amazon-night-jungle', 'mixed', 'animals', 'アマゾンの夜の森（テフェ）', 'Amazon rainforest at night (Tefé)', '記載なし（種名の記載なし）',
    title="D332 Night Jungle Ambience 1.WAV", author='billcutbill（Bill’s Amazonas Sound Library (by Bill Cutbill)）', user='billcutbill', lic='BY4', pub='2023-01-12', loc='ブラジル・アマゾナス州テフェ', locEn='Tefé, Amazonas, Brazil',
    country='ブラジル', area='アマゾナス州', regions=['south_america'], habitats=['tropical_rainforest', 'night_forest'], activity=['night'], roles=['Texture', 'Atmosphere'],
    note='原典の指定により、帰属表示に「Bill’s Amazonas Sound Library (by Bill Cutbill)」を含める。', extra='Bill’s Amazonas Sound Library (by Bill Cutbill)')
add(769592, 'podlaskie-spring-night', 'mixed', 'animals', '春の夜のカエルの合唱（ポーランド・ポドラシェ）', 'Spring night frog chorus (Podlaskie, Poland)', '記載なし（原典は “frogs” “crickets”）',
    title='Spring Night peepers Crickets European Frogs Choir  Croaking Sounds Podlaskie  02-MAY-2024 32bit 192khz_PART_01', author='TenderMicrophones.pl', user='TenderMicrophones.pl', lic='BY4', pub='2024-11-21',
    loc='ポーランド・ポドラシェ県 Wiktorowo（道路脇の池）', locEn='roadside pond in Wiktorowo, Podlaskie, Poland', country='ポーランド', area='ポドラシェ県', regions=['europe'],
    habitats=['wetland', 'grassland'], activity=['night'], roles=['Texture'], date='2024-05-03（原典の本文。題名は 02-MAY-2024）', note='約60分の録音の part 1（原典記載）。原本は192kHz・32-bit浮動小数のため96kHz・24-bitへ変換。')
add(802736, 'frog-creek-ojai', 'mixed', 'animals', '夜の小川のカエルとコオロギ（カリフォルニア・オーハイ）', 'Night creek with frogs and crickets (Ojai, California)', '記載なし（原典は “frogs” “crickets”）',
    title='Frog Creek Ambience', author='clif_creates', user='clif_creates', lic='CC0', pub='2025-04-29', loc='米国カリフォルニア州 Ojai の小川', locEn='a creek in Ojai, California, USA',
    country='米国', area='カリフォルニア州', regions=['north_america'], habitats=['river', 'wetland'], activity=['night'], roles=['Texture', 'Pulse'], note='ガンマイク＋ステレオの録音機で幅を出した録音（原典記載）。')
add(819667, 'malaysian-frogs', 'mixed', 'animals', 'カエルの群れ（マレーシア・メルシン）', 'Frogs in the evening (Mersing, Malaysia)', '記載なし（原典は “frogs”）',
    title='Malaysian frogs', author='ikbenraar', user='ikbenraar', lic='CC0', pub='2025-08-15', loc='マレーシア・ジョホール州 Mersing', locEn='Mersing, Johor, Malaysia',
    country='マレーシア', area='ジョホール州', regions=['asia'], habitats=['tropical_rainforest', 'wetland'], activity=['dusk'], roles=['Texture', 'Call & Response'], note='距離を変えて録音（原典記載）。原本は AIFF。')
add(826445, 'wetlands-night', 'mixed', 'animals', '夜の湿地（カエル・ヒキガエル・鳥の声）', 'Wetlands at night: frogs, toads, bird whistles', '記載なし（種名の記載なし）',
    title='Wetlands Night - Frogs, toads, bird whistles', author='RealSquink', user='RealSquink', lic='CC0', pub='2025-09-14', loc=NS, locEn='Not stated in source',
    country='不明', area='', regions=[], habitats=['wetland'], activity=['night'], roles=['Texture', 'Call & Response'], note='鳥の声が少しずつ増える（原典記載）。')
add(856015, 'amphibians-campsite', 'mixed', 'animals', '両生類の夜の合唱（フランス北部・アブヴィル近郊）', 'Amphibian night chorus (near Abbeville, France)', '記載なし（種名の記載なし）',
    title='260427_024431_FR_Amphibians_night_chorus_in_campsite', author='kevp888', user='kevp888', lic='BY4', pub='2026-05-27', loc='フランス北部 アブヴィル近郊のキャンプ場（池の近く）', locEn='campsite near Abbeville, northern France',
    country='フランス', area='ソンム県', regions=['europe'], habitats=['wetland'], activity=['night'], roles=['Texture'], date='2026-04-27 2時50分ごろ（原典記載）', note='車の屋根の上から録音（原典記載）。')
add(729082, 'pond-hydrophone-essex', 'mixed', 'animals', '小さな池の水中音（英国エセックス）', 'Small pond hydrophone (Essex, UK)', '記載なし（音の主は不明と原典記載）',
    title='Small Pond (Hydrophone)', author='naturenotesuk', user='naturenotesuk', lic='BY4', pub='2024-03-26', loc='英国イングランド・エセックス Billericay', locEn='Billericay, Essex, England, UK',
    country='英国', area='エセックス', regions=['europe'], habitats=['wetland'], activity=[], roles=['Experimental', 'Texture'], note='音の多くは何が出しているか分からず、虫の発音の可能性がある（原典記載）。')
add(733081, 'reedbed-pondlife', 'mixed', 'animals', 'ヨシ原の池の生き物の水中音（英国ノーサンプトンシャー）', 'Reedbed and pond life underwater (Northamptonshire, UK)', '記載なし（原典は “pondlife” “insect clicking”）',
    title='Reedbed and Pondlife Sounds', author='Mark_Taylor_Echophora_', user='Mark_Taylor_Echophora_', lic='BY4', pub='2024-04-21', loc='英国イングランド・ノーサンプトンシャー Brixworth Country Park', locEn='Brixworth Country Park, Northamptonshire, England, UK',
    country='英国', area='ノーサンプトンシャー', regions=['europe'], habitats=['wetland'], activity=[], roles=['Experimental', 'Texture'], note='泡・虫のクリック音。水中から聞こえる人の声・鳥・飛行機を少し含む（原典記載）。原本は32-bit浮動小数のため24-bitへ変換。')
add(271673, 'garden-pond-hydrophone', 'mixed', 'animals', '庭の池の水中音（英国デヴォン）', 'Garden pond hydrophone (Devon, UK)', '記載なし（原典は “insects, tadpoles, newts, goldfish”）',
    title='garden pond hydrophone', author='odilonmarcenaro', user='odilonmarcenaro', lic='CC0', pub='2015-04-25', loc='英国イングランド・デヴォン Crediton', locEn='Crediton, Devon, England, UK',
    country='英国', area='デヴォン', regions=['europe'], habitats=[], activity=['day'], roles=['Experimental', 'Texture'], note='小雨の中の庭の池。虫・オタマジャクシ・イモリ・金魚の音、遠くのクロウタドリ（原典記載）。庭の池のため生息環境フィルターには使わない。')
add(508987, 'titi-monkeys-tefe', 'mixed', 'animals', 'サルの叫び（アマゾン・原典は “zogzog”・種名記載なし）', 'Zogzog monkeys yelling (Amazon, species not stated)', '記載なし（原典は “zogzog monkey”）',
    title='Zogzog monkey yelling in the Amazonian Rainforest', author='felix.blume', user='felix.blume', lic='CC0', pub='2020-03-15', loc='ブラジル・アマゾナス州テフェ近郊 Tauary 村', locEn='near Tauary, Tefé, Amazonas, Brazil',
    country='ブラジル', area='アマゾナス州', regions=['south_america'], habitats=['tropical_rainforest'], activity=['day'], roles=['Call & Response'], note='“zogzog” は現地での呼び名（原典記載）。種を断定しない。')
# ───────── 虫（複数種）
add(483360, 'tokyo-cicadas-afternoon', 'mixed', 'insects', '夏の午後のセミ（東京）', 'Cicadas on a summer afternoon (Tokyo)', '記載なし（原典は “cicada”）',
    title='Tokyo_Cicada.wav', author='sound pro', user='sound%20pro', lic='CC0', pub='2019-09-04', loc='東京（詳細の記載なし）', locEn='Tokyo (no further detail)', country='日本', area='東京都',
    regions=['asia', 'japan'], habitats=[], activity=['day'], roles=['Drone', 'Texture'], japan=True, note='原本は6チャンネル。1・2チャンネルをステレオとして使用（サンプルはそのまま）。')
add(440574, 'crickets-washington', 'mixed', 'insects', '夜のコオロギ（ワシントン州ナチェス）', 'Crickets at night (Naches, Washington)', '記載なし（原典は “crickets”）',
    title='crickets.wav', author='ES335-001', user='ES335-001', lic='CC0', pub='2018-09-17', loc='米国ワシントン州 Naches 近くの Nile Valley', locEn='Nile Valley near Naches, Washington, USA',
    country='米国', area='ワシントン州', regions=['north_america'], habitats=['grassland'], activity=['night'], roles=['Texture', 'Pulse'], date='2018年9月上旬（原典記載）', note='Tascam DR-08（原典記載）。')
add(532301, 'night-woods-pennsylvania', 'mixed', 'insects', '夜の森のコオロギとキリギリス類（ペンシルベニア）', 'Night woods: crickets and katydids (Pennsylvania)', '記載なし（原典は “crickets and katydids”）',
    title='Night Woods', author='widgetstudios', user='widgetstudios', lic='CC0', pub='2020-08-25', loc='米国ペンシルベニア州 French Creek 州立公園（Douglassville）', locEn='French Creek State Park, Pennsylvania, USA',
    country='米国', area='ペンシルベニア州', regions=['north_america'], habitats=['temperate_forest', 'night_forest'], activity=['night'], roles=['Texture'], date='晩夏〜初秋（原典記載）')
add(825635, 'night-insects-indiana', 'mixed', 'insects', '9月の夜の虫（インディアナ）', 'Night insects in September (Indiana)', '記載なし（原典は “crickets, katydids, cicadas”）',
    title='Night Insects in September - Midwest US (loop)', author='NickTayloe', user='NickTayloe', lic='CC0', pub='2025-09-08', loc='米国インディアナ州 Albion', locEn='Albion, Indiana, USA',
    country='米国', area='インディアナ州', regions=['north_america'], habitats=['grassland'], activity=['night'], roles=['Texture'], note='EQ 処理・ループ用の編集あり（原典記載）。')
# ───────── 環境層
def bed(fs, id, jp, en, **k):
    add(fs, id, 'bed', 'landscape', jp, en, '該当なし', **k)


bed(101684, 'rain-loon-ontario', '雨とアビの声（カナダ・オンタリオ）', 'Rain with a loon call (Ontario, Canada)', title='Medium Rain with Loon Call.WAV', author='jakobthiesen', user='jakobthiesen', lic='BY3', pub='2010-07-21',
    loc='カナダ・オンタリオ州 Minden 近くの Schuyler Lake', locEn='Schuyler Lake near Minden, Ontario, Canada', country='カナダ', area='オンタリオ州', regions=['north_america'], habitats=['wetland'], activity=['day'], roles=['Atmosphere', 'Texture'])
bed(176680, 'iceland-forest', 'アイスランドの森の開けた場所', 'Open area in a forest (Iceland)', title='Atmos Country Open area in forest.aif', author='nickcath', user='nickcath', lic='CC0', pub='2013-01-31',
    loc='アイスランドの森（詳細の記載なし）', locEn='a forest in Iceland', country='アイスランド', area='', regions=['europe'], habitats=['temperate_forest'], activity=['day'], roles=['Atmosphere'],
    date='夏の午後（原典記載）', note='鳥・ハエ・木々の風（原典記載）。原本は4チャンネル。1・2チャンネルをステレオとして使用（サンプルはそのまま）。')
bed(206044, 'rock-tide-northumberland', '岩場に寄せる潮（英国ノーサンバーランド）', 'Tide on volcanic rock (Northumberland, UK)', title='Bathing House Rock Surface Close.wav', author='Tessa_Elieff', user='Tessa_Elieff', lic='BY3', pub='2013-11-11',
    loc='英国イングランド・ノーサンバーランド Alnwick（Bathing House の海岸）', locEn='Bathing House coast, Alnwick, Northumberland, UK', country='英国', area='ノーサンバーランド', regions=['europe'], habitats=['coast'], activity=['day'], roles=['Texture', 'Atmosphere'], date='2013年11月（原典記載）')
bed(280214, 'forest-thunderstorm-hamburg', '森の雷雨（ドイツ・ハンブルク近郊）', 'Thunderstorm in the forest (near Hamburg)', title='Rain And Thunder In The Forest.wav', author='pulswelle', user='pulswelle', lic='CC0', pub='2015-07-06',
    loc='ドイツ・ハンブルク近郊', locEn='near Hamburg, Germany', country='ドイツ', area='ハンブルク近郊', regions=['europe'], habitats=['temperate_forest'], activity=[], roles=['Atmosphere', 'Drone'])
bed(344975, 'stormy-night', '嵐の夜', 'Stormy night', title='Stormy Night', author='VKProduktion', user='VKProduktion', lic='CC0', pub='2016-05-03',
    loc=NS, locEn='Not stated in source', country='不明', area='', regions=[], habitats=[], activity=['night'], roles=['Atmosphere', 'Drone'], date='冬（原典記載）')
bed(368823, 'yukinoura-bamboo', '雪浦の竹林（長崎・西海市）', 'Bamboo forest at Yukinoura (Saikai, Nagasaki)', title='Japan_Yukinoura_Bamboo_Forest_and_Road_.wav', author='RutgerMuller', user='RutgerMuller', lic='CC0', pub='2016-11-21',
    loc='長崎県西海市雪浦（町の出入口の道路沿いの竹林）', locEn='Yukinoura, Saikai, Nagasaki (bamboo grove by the main road)', country='日本', area='長崎県西海市', regions=['asia', 'japan'], habitats=['temperate_forest'], activity=['day'], roles=['Atmosphere', 'Texture'],
    japan=True, date='2016-11-21 16時30分ごろ（原典記載）', note='大きな道路沿いのため車の音を含む（原典記載）。')
bed(437062, 'river-cicadas-provence', '川とセミ（フランス・ヴォクリューズ）', 'River and cicadas (Vaucluse, France)', title='RIVER AND CICADAS - 2', author='SamuelGremaud', user='SamuelGremaud', lic='CC0', pub='2018-08-16',
    loc='フランス・ヴォクリューズ県 Saint-Léger-du-Ventoux', locEn='Saint-Léger-du-Ventoux, Vaucluse, France', country='フランス', area='ヴォクリューズ県', regions=['europe'], habitats=['river', 'mountain'], activity=['day'], roles=['Texture', 'Drone'],
    note='原本は32-bit浮動小数のため24-bitへ変換。')
bed(577568, 'forest-drips-after-storm', '雷雨のあとの森の滴', 'Water falling from trees after a thunderstorm', title='Water falling from forest trees after intense thunderstorm', author='djtiii', user='djtiii', lic='BY3', pub='2021-06-22',
    loc=NS, locEn='Not stated in source', country='不明', area='', regions=[], habitats=['temperate_forest'], activity=[], roles=['Texture', 'Percussion'], note='遠くの幹線道路の低いうなりを除去（原典記載）。')
bed(667786, 'waves-deadmans-cove', '入り江に砕ける波（ワシントン州ロングビーチ）', 'Waves at Deadman’s Cove (Long Beach, Washington)', title="WATRWave_medium waves breaking at deadman's cove_TK_SASSMKH8020.wav", author='tim.kahn', user='tim.kahn', lic='BY4', pub='2023-01-03',
    loc='米国ワシントン州 Long Beach（Deadman’s Cove）', locEn='Deadman’s Cove, Long Beach, Washington, USA', country='米国', area='ワシントン州', regions=['north_america'], habitats=['coast'], activity=[], roles=['Texture', 'Atmosphere'])
bed(709372, 'winter-fens-kampina', '冬の湿原（オランダ・カンピナ国立公園）', 'Winter fens (Kampina, Netherlands)', title='Winter fens NL 1129AM Kampina Kogelvangersven 230214_0559', author='klankbeeld', user='klankbeeld', lic='BY4', pub='2023-11-07',
    loc='オランダ・北ブラバント州 Boxtel（カンピナ国立公園）', locEn='Kampina National Park, Boxtel, Netherlands', country='オランダ', area='北ブラバント州', regions=['europe'], habitats=['wetland', 'grassland'], activity=['day'], roles=['Atmosphere'],
    date='2023-02-14 11時29分（原典の題名）', note='とても静かなヒースの湿原と森。多くの鳥（原典記載）。')
bed(746930, 'yamanushi-river', '川（Yamanushi・日本）', 'River at Yamanushi (Japan)', title='WATRFall_Yamanushi Medium River Town_CP_NONE_ZOOM XY', author='kzarkses', user='kzarkses', lic='BY4', pub='2024-07-20',
    loc='日本（原典は題名の「Yamanushi」とタグ「JAPAN」のみ）', locEn='Japan (title “Yamanushi” and tag “JAPAN” only)', country='日本', area='', regions=['asia', 'japan'], habitats=['river'], activity=[], roles=['Texture'],
    japan=True, note='町なかの中くらいの川（題名）。録音地の詳細の記載なし。')
bed(790541, 'ice-lake-sweden', '氷の下を流れる水と森の風（スウェーデン）', 'Water under lake ice in a windy forest (Sweden)', title='AMBLake Water moving under ice, lake ambience in a windy forest, Stora Alljungen, Sweden', author='vhio', user='vhio', lic='CC0', pub='2025-03-01',
    loc='スウェーデン・ブレーキンゲ県 Holmsjö（Stora Alljungen 湖）', locEn='Stora Alljungen, Holmsjö, Blekinge, Sweden', country='スウェーデン', area='ブレーキンゲ県', regions=['europe'], habitats=['wetland', 'temperate_forest'], activity=['day'], roles=['Atmosphere', 'Texture'],
    date='2025-03-01 14時15分（原典記載）', note='凍った湖の下の流れ、氷のきしみ、強い風、ワタリガラス（原典記載）。')
bed(803679, 'waves-big-lagoon', '海岸に打ち寄せる波（カリフォルニア・ビッグラグーン）', 'Ocean waves at Big Lagoon (Redwood Coast, California)', title='Ocean Waves Crashing on the Coast of Big Lagoon, Redwoods', author='CVLTIV8R', user='CVLTIV8R', lic='CC0', pub='2025-05-04',
    loc='米国カリフォルニア州北部 ビッグラグーン（レッドウッド海岸）', locEn='Big Lagoon, Redwood Coast, California, USA', country='米国', area='カリフォルニア州', regions=['north_america'], habitats=['coast'], activity=['day'], roles=['Texture', 'Atmosphere'],
    note='原本は32-bitのため24-bitへ変換。')
bed(843888, 'rain-rapids-nz', '雨と急流（ニュージーランド・シャープリン滝）', 'Rain and rapids (Sharplin Falls, New Zealand)', title='Rain and rapids', author='Desmond178', user='Desmond178', lic='CC0', pub='2026-02-02',
    loc='ニュージーランド・カンタベリー Mount Somers（シャープリン滝）', locEn='Sharplin Falls, Mount Somers, Canterbury, New Zealand', country='ニュージーランド', area='カンタベリー', regions=['oceania'], habitats=['river', 'mountain'], activity=['day'], roles=['Texture', 'Atmosphere'],
    note='傘に当たる雨粒を含む（原典記載）。原本は32-bit浮動小数のため24-bitへ変換。')
bed(857847, 'birds-stream-paris', '朝の鳥と小川（パリ西郊・リュエイユ＝マルメゾン）', 'Morning birds and stream (Rueil-Malmaison, near Paris)', title='260528_050202_FR_Birds_and_water_stream_in_the_morning', author='kevp888', user='kevp888', lic='BY4', pub='2026-06-08',
    loc='フランス・リュエイユ＝マルメゾン（森の近くの住宅の2階の窓）', locEn='Rueil-Malmaison, France (second-floor window near a forest)', country='フランス', area='オー＝ド＝セーヌ県', regions=['europe'], habitats=['temperate_forest'], activity=['day'], roles=['Atmosphere', 'Melody'],
    date='2026-05-28 5時ごろ（原典記載）', note='原本は22分。区間は冒頭8分から選択。')
bed(859225, 'waterfall-hexenklamm', '滝と遠くの鳥（ドイツ・ヘクセンクラム）', 'Waterfall with distant birds (Hexenklamm, Germany)', title='WATRFall_Waterfall closeup birds distant_SHMI', author='Shuhmi', user='Shuhmi', lic='BY4', pub='2026-06-17',
    loc='ドイツ・ラインラント＝プファルツ州 ピルマゼンス近郊のヘクセンクラム（プファルツの森の峡谷）', locEn='Hexenklamm gorge near Pirmasens, Palatinate Forest, Germany', country='ドイツ', area='ラインラント＝プファルツ州', regions=['europe'], habitats=['river', 'mountain', 'temperate_forest'], activity=['day'], roles=['Texture', 'Drone'],
    date='2026-06-10 朝（原典記載）')
bed(868995, 'rain-frogs-guiana', '夜の小雨とカエル（仏領ギアナ）', 'Light rain, frogs and toads at night (French Guiana)', title='Light Rain, Frogs and Toads at Night - Rémire-Montjoly, French Guiana', author='felix.blume', user='felix.blume', lic='CC0', pub='2026-09-04',
    loc='仏領ギアナ Rémire-Montjoly（家の前）', locEn='Rémire-Montjoly, French Guiana', country='フランス（仏領ギアナ）', area='仏領ギアナ', regions=['south_america'], habitats=['tropical_rainforest', 'night_forest'], activity=['night'], roles=['Atmosphere', 'Texture'])

LIC = {'CC0': ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'), 'BY4': ('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'),
       'BY3': ('CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/')}
