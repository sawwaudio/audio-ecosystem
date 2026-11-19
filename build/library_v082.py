"""v0.82 取り込み：イエローストーン国立公園の音源ライブラリ（米国国立公園局 NPS）から 15 本（2026-11-19 に7本、11-20 に8本）。
権利の根拠：https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm
 「The files available here were recorded in the park and are in the public domain. They may be downloaded and used without
  limitation; however, please credit the "National Park Service" where appropriate.」
- 録音者の表記は各ページの CREDIT / AUTHOR（すべて NPS 単独の表記のものを選んだ。NPS & MSU Acoustic Atlas の共同表記の録音は使わない）。
- 原本は NPS が配布する MP3（192〜256kbps）。抜粋は 24-bit 整数へデコード（ビット完全ではない。changes に記録）。
- 同じページの 102kbps・クリップを含む Fountain Paint Pot は保留（research/source_review.json で REVIEW）。
- 11-20：全ページの CREDIT / AUTHOR を確認。NPS & MSU 共同表記の21ページ、重複を避けた NPS 単独の17ページは REVIEW、人工音2ページは REJECTED（台帳に記録）。
- 審査台帳 research/source_review.json で APPROVED（研究用メタデータと公開データは分けて管理）。
"""
E = []
NPS = 'https://www.nps.gov/yell/learn/photosmultimedia/sounds-'
NA = '該当なし'
LOC = 'イエローストーン国立公園（米国ワイオミング州）'
LOC_EN = 'Yellowstone National Park, Wyoming, USA'


def add(fs, id, kind, group, jp, en, latin, *, title, author, page, file, date, loc, locEn, habitats=(), activity=(), roles=('Texture',), wild='野外', note=''):
    E.append(dict(fs=fs, id=id, kind=kind, group=group, jp=jp, en=en, latin=latin, title=title, author=author, user='NPS', lic='NPS-PD', pub='',
                  loc=loc, locEn=locEn, country='アメリカ合衆国', area='ワイオミング州', regions=['north_america'], native=[], japanNative=None,
                  habitats=list(habitats), activity=list(activity), roles=list(roles), wild=wild, date=date, note=note, japan=False,
                  extra='National Park Service', url=NPS + page + '.htm',
                  download='https://www.nps.gov/nps-audiovideo/legacy/mp3/imr/avElement/' + (file[1:] if file.startswith('@') else 'yell-' + file) + '.mp3'))


add('yellowstone-fumarole', 'yellowstone-fumarole', 'bed', 'landscape', '噴気孔の轟き（イエローストーン・ノリス間欠泉盆地）',
    'Roaring fumarole (Norris Geyser Basin, Yellowstone)', NA, title='Fumaroles — unnamed fumarole, Norris Porcelain Basin', author='NPS/Jennifer Jerrett',
    page='fumaroles', file='NorrisPorcelainBasinFumerole', date='2014-01-31（原典記載）', loc='イエローストーン国立公園 ノリス間欠泉盆地 ポーセリン盆地',
    locEn='Porcelain Basin, Norris Geyser Basin, Yellowstone National Park, USA', habitats=['mountain'], activity=['day'], roles=['Drone', 'Texture'],
    note='名前のない噴気孔から吹き出す蒸気の轟き（原典記載）。地熱の音。')
add('yellowstone-black-growler', 'yellowstone-black-growler', 'bed', 'landscape', 'ブラック・グロウラー噴気孔（イエローストーン）',
    'Black Growler Steam Vent (Yellowstone)', NA, title='Black Growler Steam Vent', author='NPS/Jennifer Jerrett',
    page='blackgrowler', file='NorrisBlackGrowler', date='2014-01-31（原典記載）', loc='イエローストーン国立公園 ノリス間欠泉盆地 ポーセリン盆地',
    locEn='Porcelain Basin, Norris Geyser Basin, Yellowstone National Park, USA', habitats=['mountain'], activity=['day'], roles=['Drone', 'Atmosphere'],
    note='ポーセリン盆地へ下りる道で最初に聞こえる噴気孔の一つ（原典記載）。')
add('yellowstone-dragons-mouth', 'yellowstone-dragons-mouth', 'bed', 'landscape', 'ドラゴンズ・マウス泉（洞窟から噴く蒸気と水）',
    "Dragon's Mouth Spring (Yellowstone)", NA, title="The Dragon's Mouth", author='NPS/David Restivo', page='dragonsmouth', file='DragonsMouth',
    date='2013-10-29（原典記載）', loc='イエローストーン国立公園 マッドボルケーノ地域', locEn='Mud Volcano area, Yellowstone National Park, USA',
    habitats=['mountain'], activity=['day'], roles=['Pulse', 'Texture'],
    note='洞窟から周期的に吐き出される蒸気と、打ち寄せる水の音（原典記載）。')
add('yellowstone-black-sand-pool', 'yellowstone-black-sand-pool', 'bed', 'landscape', 'ブラックサンド・プールの泡（地中ではじける低音）',
    'Imploding bubbles at Black Sand Pool (Yellowstone)', NA, title='Black Sand Pool — imploding bubbles (binaural)', author='NPS/Peter Comley',
    page='blacksandpool', file='020102BlackSandBasinBlackSandPoolImplodingBubblesBinaural0101', date='2015-03-23（原典記載）',
    loc='イエローストーン国立公園 ブラックサンド盆地', locEn='Black Sand Basin, Yellowstone National Park, USA', habitats=['mountain'], activity=['day'],
    roles=['Pulse', 'Texture'], note='泉の深いところで泡がつぶれる低い衝撃音と、水面に抜ける泡の音。バイノーラル録音（原典記載。ヘッドホン推奨）。')
add('yellowstone-old-faithful', 'yellowstone-old-faithful', 'bed', 'landscape', 'オールド・フェイスフル間欠泉（晩秋・人のいない噴出）',
    'Old Faithful Geyser, late fall without crowds (Yellowstone)', NA, title='Old Faithful (late-fall recording without crowds)', author='NPS/Jennifer Jerrett',
    page='oldfaithful', file='OldFaithful11162014', date='2014-11-16（原典記載）', loc='イエローストーン国立公園 アッパー間欠泉盆地',
    locEn='Upper Geyser Basin, Yellowstone National Park, USA', habitats=['mountain'], activity=['day'], roles=['Drone', 'Atmosphere'],
    note='人のいない晩秋の録音。低い唸りは風ではなく噴出による自然の振動（原典記載）。原本はモノラル（配布ファイルは2ch）。')
add('yellowstone-lake-sings', 'yellowstone-lake-sings', 'bed', 'landscape', '冬のイエローストーン湖の氷が鳴る音',
    'Singing ice of Yellowstone Lake in winter', NA, title='Singing Lake', author='NPS/Jennifer Jerrett', page='singinglake', file='YellowstoneLakeSings',
    date='2013-12-17（原典記載）', loc='イエローストーン国立公園 イエローストーン湖', locEn='Yellowstone Lake, Yellowstone National Park, USA',
    habitats=['mountain'], activity=['day'], roles=['Melody', 'Atmosphere'],
    note='気温の変化で湖の氷が鳴る、冬だけのまれな音。解説なしの生の録音（原典記載）。')
add('yellowstone-elk-bugle', 'yellowstone-elk-bugle', 'species', 'animals', 'アメリカアカシカの雄の声（ビューグル・イエローストーン）',
    'Bull elk bugle (Yellowstone)', 'Cervus canadensis（原典は “elk”・Cervus elaphus）', title='Elk Bugle 1', author='NPS/Neal Herbert',
    page='elk', file='ElkBugle1', date='2013-10-16（原典記載）', loc='イエローストーン国立公園 マンモス・ホット・スプリングス',
    locEn='Mammoth Hot Springs, Yellowstone National Park, USA', habitats=['grassland'], activity=['day'], roles=['Call'],
    note='秋の朝、雌の群れの近くで雄が鳴く（原典記載）。')

LIC = {'NPS-PD': ('Public domain', 'https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm')}

# ───────── 2026-11-20 追加（次の一手③：NPS ライブラリの残りを審査し、NPS 単独表記・音質・重複なしの8本を採用）
add('yellowstone-chorus-frogs', 'yellowstone-chorus-frogs', 'species', 'animals', 'ボレアルコーラスガエルの合唱（イエローストーン）',
    'Boreal chorus frogs (Yellowstone)', 'Pseudacris maculata（原典は “boreal chorus frog”）', title='Frogs (boreal chorus)', author='NPS/Neal Herbert',
    page='chorusfrogs', file='ChorusFrogs', date='2014-05-02（原典記載）', loc=LOC, locEn=LOC_EN, habitats=['wetland'], activity=['night'], roles=['Texture', 'Pulse'],
    note='春に聞こえる雄だけの合唱（原典記載）。')
add('yellowstone-coyotes', 'yellowstone-coyotes', 'species', 'animals', 'コヨーテの群れの声（イエローストーン・ギボン川）',
    'Coyotes along the Gibbon River (Yellowstone)', 'Canis latrans（原典は “coyotes”）', title='Coyotes', author='NPS/Neal Herbert',
    page='coyote', file='Coyotes', date='2014-01-31（原典記載）', loc='イエローストーン国立公園 ギボン川', locEn='Gibbon River, Yellowstone National Park, USA',
    habitats=['river', 'grassland'], activity=['night'], roles=['Call'], note='ギボン川沿いで鳴き交わすコヨーテの群れ（原典記載）。')
add('yellowstone-bison-rut', 'yellowstone-bison-rut', 'species', 'animals', 'アメリカバイソンの雄の吠え声（発情期・イエローストーン）',
    'Bull bison bellowing in the rut (Yellowstone)', 'Bison bison（原典は “bison”）', title='Bison (rut)', author='NPS/Jennifer Jerrett',
    page='bison', file='@YELL-BisonRut-JenniferJerrett', date='2014-08-07（原典記載）', loc=LOC, locEn=LOC_EN, habitats=['grassland'], activity=['day'],
    roles=['Call', 'Drone'], note='群れの中で存在と優位を示す雄の吠え声。発情期に多くなる（原典記載）。')
add('yellowstone-wilsons-snipe', 'yellowstone-wilsons-snipe', 'species', 'birds', 'アメリカタシギのディスプレイ飛行の羽音（夜・イエローストーン）',
    "Wilson's snipe winnowing at night (Yellowstone)", 'Gallinago delicata（原典は “Wilson\'s snipe”）', title="Wilson's Snipe", author='NPS/Jennifer Jerrett',
    page='wilsonssnip', file='Snipe', date='2014-05-09（原典記載）', loc='イエローストーン国立公園 水につかった草地', locEn='Flooded meadows, Yellowstone National Park, USA',
    habitats=['wetland'], activity=['night'], roles=['Pulse', 'Texture'], note='春の夜、水につかった草地から聞こえる縄張りの音（尾羽の振動）（原典記載）。')
add('yellowstone-sandhill-cranes', 'yellowstone-sandhill-cranes', 'species', 'birds', 'カナダヅルの飛びながらの声（イエローストーン）',
    'Sandhill cranes calling overhead (Yellowstone)', 'Antigone canadensis（原典は “sandhill cranes”）', title='Sandhill Crane', author='NPS/Shan Burson',
    page='sandhillcrane', file='YELLFLBCSACR20075171', date='2007-05-17（原典記載）', loc=LOC, locEn=LOC_EN, habitats=['wetland', 'grassland'], activity=['day'],
    roles=['Call'], note='頭上を飛びながら鳴くカナダヅル。夏に多い（原典記載）。原本は MP3 128kbps・モノラル。')
add('yellowstone-killdeer', 'yellowstone-killdeer', 'species', 'birds', 'フタオビチドリの鳴き交わし（間欠泉の丘・イエローストーン）',
    'Killdeer chorus on Geyser Hill (Yellowstone)', 'Charadrius vociferus（原典記載）', title='Killdeer chorus near Anemone Geyser', author='NPS/Peter Comley',
    page='killdeer', file='030404GeyserHillAnemoneKilldeerChorus02M10013', date='2015-03-22（原典記載）', loc='イエローストーン国立公園 アッパー間欠泉盆地 ガイザーヒル',
    locEn='Geyser Hill, Upper Geyser Basin, Yellowstone National Park, USA', habitats=['grassland'], activity=['day'], roles=['Call', 'Texture'],
    note='アネモネ間欠泉の近くでのフタオビチドリの合唱。ステレオ録音（原典記載）。')
add('yellowstone-ear-spring', 'yellowstone-ear-spring', 'bed', 'landscape', 'イヤー・スプリング（絶えず泡立つ小さな温泉）',
    'Ear Spring, sizzling and bubbling (Yellowstone)', NA, title='Ear Spring', author='NPS/Jennifer Jerrett', page='earspring', file='EarSpring',
    date='2014-02-25（原典記載）', loc='イエローストーン国立公園 アッパー間欠泉盆地 ガイザーヒル', locEn='Geyser Hill, Upper Geyser Basin, Yellowstone National Park, USA',
    habitats=['mountain'], activity=['day'], roles=['Texture'], note='絶えずジュージューと泡立つ小さな温泉（原典記載）。原本は16秒。')
add('yellowstone-maple-fire', 'yellowstone-maple-fire', 'bed', 'landscape', '森林火災（ロッジポールマツが燃える音・2016年メープル火災）',
    'Wildfire: burning lodgepole pines (Maple Fire 2016, Yellowstone)', NA, title='Fire — Maple Fire', author='NPS/Jennifer Jerrett', page='fire',
    file='YELLMapleFire20160814T04ms3', date='2016-08-14（原典記載）', loc=LOC, locEn=LOC_EN, habitats=['temperate_forest'], activity=['day'],
    roles=['Texture'], note='燃える若いロッジポールマツの約4.5m 手前で録音。約14秒で木の塊が炎に包まれる（原典記載）。抜粋はその前後を含む。')
