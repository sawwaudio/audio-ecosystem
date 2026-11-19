"""v0.79 取り込み：2026-11-16〜19 に集めた 23 本（Freesound 17・Wikimedia Commons 6）の台帳。
各項目の作者・題名・ライセンス・公開日・録音地・説明は 2026-11-19 に原典ページで確認した（ブラウザで取得）。
- 原本の保管：オーナーの Mac（~/Downloads）。WAV/AIFF 原本は可逆の FLAC（~/Downloads/flac/）にして保管し、必要なら WAV に戻せる
  （32-bit 浮動小数の原本だけは FLAC が浮動小数を扱えないため 24-bit 整数にした。その旨を notes に記録）。
- 非可逆の原本（Commons の Ogg Vorbis、Freesound の m4a）は抜粋時に 24-bit 整数へデコードした（ビット完全ではない。changes 欄に記録）。
- 種名は原典に記載があるものだけ。都市・寺社・楽器の録音は latin を「該当なし」とする。
- 楽器の実録音（尺八・和太鼓・琴・三味線・梵鐘・鼓楼の太鼓）は、いまは専用の群がないため landscape 群の単発音（環境層ではない）として扱う。
"""
E = []


def add(fs, id, kind, group, jp, en, latin, *, title, author, user, lic, pub, loc, locEn, country, area, regions, native=None,
        japanNative=None, habitats=(), activity=(), roles=('Texture',), wild='野外', date=None, note='', japan=False, extra='', url=None):
    E.append(dict(fs=str(fs), id=id, kind=kind, group=group, jp=jp, en=en, latin=latin, title=title, author=author, user=user, lic=lic,
                  pub=pub, loc=loc, locEn=locEn, country=country, area=area, regions=list(regions), native=list(native or []),
                  japanNative=japanNative, habitats=list(habitats), activity=list(activity), roles=list(roles), wild=wild,
                  date=date or f'不明（Freesound公開 {pub}）', note=note, japan=japan, extra=extra, url=url))


NA = '該当なし'
# ───────── 環境層（日本）
add(514135, 'zenkoji-bells-kofu', 'bed', 'landscape', '善光寺の鐘と朝の鳥（甲府・坂折）', 'Zenkoji temple bells and morning birds (Kofu)', NA,
    title='zenkojibells_norm.wav', author='earthmonkey1', user='earthmonkey1', lic='CC0', pub='2020-04-19',
    loc='山梨県甲府市 坂折（3月・午前6時ごろ）', locEn='Sakaori, Kofu, Yamanashi, Japan (March, around 6 AM)', country='日本', area='山梨県', regions=['japan'],
    habitats=['mountain'], activity=['day'], roles=['Atmosphere', 'Drone'], japan=True,
    note='日本の朝の環境音と鳥の声。約1分30秒から遠くに善光寺の鐘（原典記載）。Zoom H4n で録音し正規化済み（原典記載）。')
add(361916, 'matsudo-water-tunnel', 'bed', 'landscape', '江戸川そばの金属の水路トンネル（千葉・松戸）', 'Metal water tunnel near the Edogawa (Matsudo, Chiba)', NA,
    title='Japan_Matsudo_Water_Tunnel_3Takes_24Bit_96KHz_MS-Stereo.wav', author='RutgerMuller', user='RutgerMuller', lic='CC0', pub='2016-10-08',
    loc='千葉県松戸市 江戸川の近く', locEn='Near the Edogawa River, Matsudo, Chiba, Japan', country='日本', area='千葉県', regions=['japan'],
    habitats=['river'], activity=['day'], roles=['Texture', 'Drone'], japan=True,
    note='金属のトンネルの中を流れる水を、Zoom H2n（MS ステレオ）を下に向けて録音（原典記載）。原本は 24-bit・96kHz。')
add(377750, 'hakuba-shrine-snow', 'bed', 'landscape', '雪の白馬八方神社（長野・白馬）', 'Hakuba Happo Shrine in snow (Nagano)', NA,
    title='Hakuba Happo Shrine (Winter).wav', author='Oscarno', user='Oscarno', lic='CC0', pub='2017-01-24',
    loc='長野県北安曇郡 白馬村 八方神社', locEn='Happo Shrine, Hakuba, Kitaazumi, Nagano, Japan', country='日本', area='長野県', regions=['japan'],
    habitats=['mountain'], activity=['day'], roles=['Texture'], japan=True,
    note='雪の中を歩く足音（原典記載）。原本全体がとても小さい音量（平均 約-60dBFS）。')
add(315890, 'asakusa-sanja-matsuri', 'bed', 'landscape', '浅草・三社祭のおみくじと人のざわめき（東京）', 'Omikuji and crowd at Asakusa Sanja Matsuri (Tokyo)', NA,
    title='Tokyo - Asakusa Shrine', author='manuke', user='manuke', lic='CC0', pub='2015-07-14',
    loc='東京都台東区 浅草（三社祭・2008年5月）', locEn='Asakusa, Taito, Tokyo, Japan (Sanja Matsuri, May 2008)', country='日本', area='東京都', regions=['japan'],
    activity=['day'], roles=['Texture', 'Percussion'], japan=True, date='2008年5月（原典記載。Freesound公開 2015-07-14）',
    note='金属音はおみくじ（みくじ棒の入った金属の箱）を振る音。人の声と周囲の音を含む。Zoom H4 で録音・無加工（原典記載）。')
add(490656, 'typhoon-hagibis-mitaka', 'bed', 'landscape', '台風19号（ハギビス）の風（東京・三鷹）', 'Wind of Typhoon Hagibis (Mitaka, Tokyo)', NA,
    title='Atmospheric typhoon wind noise', author='piego', user='piego', lic='CC0', pub='2019-10-31',
    loc='東京都三鷹市', locEn='Mitaka, Tokyo, Japan', country='日本', area='東京都', regions=['japan'],
    activity=['day'], roles=['Atmosphere', 'Drone'], japan=True, date='2019年10月（台風19号の通過時。Freesound公開 2019-10-31）',
    note='台風ハギビス（令和元年東日本台風）の通過中に安全な場所から録音（原典記載）。Zoom H6・RODE NTG2。')
add(75069, 'tokyo-night-rain', 'bed', 'landscape', '深夜の都会の雨（東京・中野）', 'Late-night urban rain (Nakano, Tokyo)', NA,
    title='Shin-Nakano_Rain_on_Balcony_Spring_2008.wav', author='markystar', user='markystar', lic='CC0', pub='2009-07-01',
    loc='東京都中野区 新中野（ベランダ・2008年春）', locEn='Shin-Nakano, Nakano, Tokyo, Japan (balcony, spring 2008)', country='日本', area='東京都', regions=['japan'],
    activity=['night'], roles=['Texture'], japan=True, date='2008年春（題名の記載。Freesound公開 2009-07-01）',
    note='東京の深夜の雨（原典記載）。原本は 32-bit 浮動小数のため、保管用 FLAC と抜粋は 24-bit 整数。')
add(75273, 'koenji-park-dusk', 'bed', 'landscape', '夕暮れの小さな公園と噴水（東京・東高円寺）', 'Small park with fountain at dusk (Higashi-Koenji, Tokyo)', NA,
    title='tokyo_park_at_dusk.wav', author='markystar', user='markystar', lic='CC0', pub='2009-07-08',
    loc='東京都杉並区 東高円寺の小さな公園', locEn='A small park in Higashi-Koenji, Tokyo, Japan', country='日本', area='東京都', regions=['japan'],
    activity=['dusk'], roles=['Atmosphere'], japan=True,
    note='夕暮れの公園。背景に若い人たちの話し声を含む（原典記載）。')
add(42195, 'shinagawa-night-street', 'bed', 'landscape', '深夜1時の品川の街（遠くの虫と車）', 'Shinagawa street after 1 AM (Tokyo)', NA,
    title='TokyoStreetAtNight_120.wav', author='markystar', user='markystar', lic='CC0', pub='2007-10-10',
    loc='東京都 品川（高層住宅の6階・午前1時過ぎ）', locEn='Shinagawa, Tokyo, Japan (6th floor, after 1 AM)', country='日本', area='東京都', regions=['japan'],
    activity=['night'], roles=['Atmosphere', 'Drone'], japan=True,
    note='遠くの虫の声と、ふだんは交通量の多い道路の車。駅は閉まっているが人の動きや風の音がある（原典記載）。原本全体が小さい音量。')
add(44616, 'nakano-night-intersection', 'bed', 'landscape', '夜11時の交差点（東京・中野 青梅街道）', 'Intersection at 11 PM (Ome-kaido, Nakano, Tokyo)', NA,
    title='ShinNakanoOmekaidoLateNightNearIntersexion_4mics.wav', author='markystar', user='markystar', lic='CC0', pub='2007-12-05',
    loc='東京都中野区 新中野 青梅街道の交差点付近', locEn='Near an intersection on Ome-kaido, Shin-Nakano, Tokyo, Japan', country='日本', area='東京都', regions=['japan'],
    activity=['night'], roles=['Atmosphere'], japan=True,
    note='住宅地の交差点。夜11時は車が少なく、歩く人などの小さな音が聞こえる。加工はトリミングのみ（原典記載）。')
add(42211, 'nakano-autumn-night', 'bed', 'landscape', '秋の夜の住宅地（東京・中野）', 'Autumn night in a residential area (Nakano, Tokyo)', NA,
    title='ShinNakanoAutumnNightScape120.wav', author='markystar', user='markystar', lic='CC0', pub='2007-10-10',
    loc='東京都中野区 新中野の住宅地', locEn='Residential area, Shin-Nakano, Tokyo, Japan', country='日本', area='東京都', regions=['japan'],
    activity=['night'], roles=['Atmosphere'], japan=True,
    note='東京の住宅地の夜（原典記載。タグに虫の声）。原本は26分・全体がとても小さい音量。')
add(136432, 'tokyo-bus-interior', 'bed', 'landscape', '東京の路線バスの車内（エンジンと車内放送）', 'Inside a Tokyo city bus (engine and announcements)', NA,
    title='inside a japanese bus2.WAV', author='cobwebjoe', user='cobwebjoe', lic='CC0', pub='2011-12-01',
    loc='東京都内の路線バス車内', locEn='Inside a city bus, Tokyo, Japan', country='日本', area='東京都', regions=['japan'],
    activity=['day'], roles=['Drone', 'Texture'], japan=True,
    note='バスのエンジン音と日本語の車内放送（原典記載）。')
# ───────── 環境層（海外）
add(524997, 'leipzig-city-lake', 'bed', 'landscape', '都市の湖（ドイツ・ライプツィヒ）', 'City lake (Leipzig, Germany)', NA,
    title='city lake atmo field recording', author='Garuda1982', user='Garuda1982', lic='CC0', pub='2020-07-04',
    loc='ドイツ・ザクセン州 ライプツィヒ コスプデン湖', locEn='Cospudener See, Leipzig, Saxony, Germany', country='ドイツ', area='ザクセン州', regions=['europe'],
    habitats=['wetland'], activity=['day'], roles=['Atmosphere'],
    note='Sony PCM-D100 で録音（原典記載）。原本は18分・全体がとても小さい音量。')
add(463353, 'chelmsford-storm-chimes', 'bed', 'landscape', '嵐の園芸店の風鈴と防水シート（英国・チェルムズフォード）', 'Wind chimes and tarp in a storm (Chelmsford, UK)', NA,
    title='Field Recording_chimes tarp wind', author='sdotlyre', user='sdotlyre', lic='CC0', pub='2019-03-13',
    loc='英国イングランド・エセックス州 チェルムズフォードの園芸店', locEn='A garden centre in Chelmsford, Essex, England, UK', country='英国', area='エセックス州', regions=['europe'],
    activity=['day'], roles=['Texture', 'Melody'],
    note='嵐の日に園芸店で iPhone 8 により録音（原典記載）。原本は AAC（m4a）の非可逆形式。')
add(804709, 'chiang-mai-forest', 'bed', 'landscape', 'チェンマイの森（タイ）', 'Forest in Chiang Mai (Thailand)', NA,
    title='Forest Ambience, Chiang Mai, Thailand (March 7, 2019)', author='marc.om', user='marc.om', lic='CC0', pub='2025-05-08',
    loc='タイ・チェンマイ県 ムアンチェンマイ郡の森', locEn='Forest in Mueang Chiang Mai, Chiang Mai, Thailand', country='タイ', area='チェンマイ県', regions=['asia'],
    habitats=['tropical_rainforest'], activity=['day'], roles=['Atmosphere', 'Texture'], date='2019-03-07（題名の記載。Freesound公開 2025-05-08）',
    note='チェンマイの森のフィールド録音（原典記載）。原本は AAC（m4a）の非可逆形式。')
add(67046, 'bamboo-wind-chime', 'bed', 'landscape', '竹の風鈴（竹のウィンドチャイム）', 'Bamboo wind chimes', NA,
    title='bamboo.wav', author='gmni', user='gmni', lic='CC0', pub='2009-02-09',
    loc='原典に記載なし', locEn='Not stated in source', country='不明', area='不明', regions=[],
    roles=['Percussion', 'Texture'],
    note='竹のウィンドチャイム（原典のカテゴリは楽器サンプル＞打楽器。タグに japan・chinese・wind・rain）。録音地の記載なし。')
add(378431, 'koshi-wind-chime', 'bed', 'landscape', '8音のウィンドチャイム Koshi（竹の共鳴筒）', 'Koshi wind chime with eight metal tones', NA,
    title='Koshi Wind Chimes, Medium', author='Kinoton', user='Kinoton', lic='CC0', pub='2017-01-30',
    loc='原典に記載なし', locEn='Not stated in source', country='不明', area='不明', regions=[],
    roles=['Melody', 'Texture'],
    note='竹の共鳴筒に囲まれた8本の金属音（a1-d2-f2-g2-a2-d3-f3-a3）のウィンドチャイム。ORTF ステレオ・Tascam DR-60D MkII・RODE M5 ×2（原典記載）。')
# ───────── 虫（種を特定しない）
add(41502, 'tokyo-balcony-crickets', 'mixed', 'insects', 'ベランダの裏で鳴く夜のコオロギ類（東京）', 'Night crickets behind a balcony (Tokyo)', '原典に記載なし（種を特定しない）',
    title='crickets_and_a_freak.wav', author='markystar', user='markystar', lic='CC0', pub='2007-09-29',
    loc='東京都内（アパートのベランダの裏）', locEn='Behind an apartment balcony, Tokyo, Japan', country='日本', area='東京都', regions=['japan'],
    habitats=['grassland'], activity=['night'], roles=['Texture', 'Pulse'], japan=True,
    note='夜のコオロギの声と隣家のエアコンの低い音（原典記載）。原典は途中（約46〜69秒）に人の声を含むため、その区間を避けて抜粋。原本は 32-bit 浮動小数のため 24-bit 整数。')
# ───────── 楽器の実録音（Wikimedia Commons）
C = 'https://commons.wikimedia.org/wiki/File:'
add('c-syakuhachi', 'shakuhachi', 'landscape', 'landscape', '尺八（楽器の実録音）', 'Shakuhachi (real instrument recording)', NA,
    title='Syakuhachi.ogg', author='kenekana', user='kenekana', lic='BY3', pub='', loc='原典に記載なし', locEn='Not stated in source', country='不明', area='不明', regions=[],
    roles=['Melody'], wild='楽器', date='不明（Wikimedia Commons 掲載）', url=C + 'Syakuhachi.ogg',
    note='尺八の音（約10秒）。原本は Ogg Vorbis（非可逆）。')
add('c-wadaiko', 'wadaiko', 'landscape', 'landscape', '和太鼓（楽器の実録音）', 'Wadaiko drum (real instrument recording)', NA,
    title='和太鼓の音オーディオ.ogg', author='大橋亮介', user='大橋亮介', lic='BY3', pub='', loc='原典に記載なし', locEn='Not stated in source', country='不明', area='不明', regions=[],
    roles=['Percussion', 'Pulse'], wild='楽器', date='不明（Wikimedia Commons 掲載）', url=C + '和太鼓の音オーディオ.ogg',
    note='和太鼓の音（約3秒）。原本は Ogg Vorbis（非可逆）。')
add('c-koto', 'koto', 'landscape', 'landscape', '琴（楽器の実録音）', 'Koto (real instrument recording)', NA,
    title='琴の音のオーディオ.ogg', author='KOIKICHIGAI', user='KOIKICHIGAI', lic='BY3', pub='', loc='原典に記載なし', locEn='Not stated in source', country='不明', area='不明', regions=[],
    roles=['Melody'], wild='楽器', date='不明（Wikimedia Commons 掲載）', url=C + '琴の音のオーディオ.ogg',
    note='琴の音（約3.5秒）。原本は Ogg Vorbis（非可逆）。')
add('c-shamisen', 'shamisen', 'landscape', 'landscape', '三味線（楽器の実録音）', 'Shamisen (real instrument recording)', NA,
    title='三味線の音オーディオ.ogg', author='KOIKICHIGAI', user='KOIKICHIGAI', lic='BY3', pub='', loc='原典に記載なし', locEn='Not stated in source', country='不明', area='不明', regions=[],
    roles=['Melody', 'Percussion'], wild='楽器', date='不明（Wikimedia Commons 掲載 2025-10-06）', url=C + '三味線の音オーディオ.ogg',
    note='三味線の音（約9.5秒）。原本は Ogg Vorbis（非可逆）。')
add('c-bonsho', 'bonsho-chomeiji', 'landscape', 'landscape', '長命寺の梵鐘（滋賀・近江八幡）', 'Temple bell of Chomeiji (Shiga)', NA,
    title='Bonsyou5599.ogg', author='Jnn', user='Jnn', lic='BY21jp', pub='', loc='滋賀県 姨綺耶山 長命寺', locEn='Chomeiji temple, Mt. Ikiyasan, Shiga, Japan', country='日本', area='滋賀県',
    regions=['japan'], roles=['Drone', 'Melody'], wild='楽器', japan=True, date='不明（Wikimedia Commons 掲載）', url=C + 'Bonsyou5599.ogg',
    note='長命寺の梵鐘の音色（原典記載）。原本は Ogg Vorbis・11kHz・モノラル（非可逆・帯域が狭い）。')
add('c-gulou', 'beijing-drum-tower', 'landscape', 'landscape', '北京・鼓楼の太鼓の演奏（中国）', 'Drum performance at the Drum Tower (Beijing)', NA,
    title='Gulou performance.ogv', author='Philip Jägenstedt', user='Philip Jägenstedt', lic='PD', pub='', loc='中国・北京 鼓楼', locEn='Drum Tower (Gulou), Beijing, China', country='中国', area='北京',
    regions=['asia'], roles=['Percussion', 'Pulse'], wild='楽器', date='不明（Wikimedia Commons 掲載）', url=C + 'Gulou_performance.ogv',
    note='北京の鼓楼での太鼓の演奏（原典記載）。原本は動画（Ogg Theora/Vorbis）の音声トラック（非可逆）。')

LIC = {'CC0': ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'), 'BY3': ('CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'),
       'BY21jp': ('CC BY 2.1 JP', 'https://creativecommons.org/licenses/by/2.1/jp/'), 'PD': ('Public domain', 'https://commons.wikimedia.org/wiki/Commons:Public_domain')}
