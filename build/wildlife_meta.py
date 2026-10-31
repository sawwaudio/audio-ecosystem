#!/usr/bin/env python3
"""Wildlife metadata for the 32 v0.23 recordings → dist/data/wildlife_meta.json.

Distribution (where the organism naturally lives) and recording location (where THIS file
was recorded) are separate fields and never derived from each other.
japanNative / japanEndemic: true / false / null(未確認). null is never treated as Japanese.
"""
import json

REF = {
    'kb': '一般的な分布知識（出典URL未記録・要確認）',
    'wp-kajika': 'https://en.wikipedia.org/wiki/Kajika_frog（endemic to Japan: Honshu, Kyushu, Shikoku）',
    'wp-tcan': 'https://en.wikipedia.org/wiki/Tettigonia_cantans（Europe, E Palearctic, Near East, N Africa。日本の記載なし）',
    'wp-cbru': 'https://en.wikipedia.org/wiki/Chorthippus_brunneus（Europe, N Africa, temperate Asia。日本の記載なし）',
    'wp-cbig': 'https://en.wikipedia.org/wiki/Chorthippus_biguttulus（"well into Asia including Japan"。ただし日本産ヒナバッタを別種 C. maritimus とする見解があり未確定扱い）',
}
# id: (en, nativeRegions, japanNative, japanEndemic, distRef, recCountry, recRegion, recRegions, recEnv, wild, habitats, activity, roles, note)
M = {
 'blackbird': ('Common blackbird', ['europe','asia','africa'], False, False, 'kb', None, None, [], '不明', '不明', ['temperate_forest'], ['day','dusk'], ['Melody'], '日本では迷鳥。オセアニアの個体群は移入。'),
 'american-field-cricket': ('Fall field cricket', ['north_america'], False, False, 'kb', '米国', '北東部（録音者のガレージ）', ['north_america'], '屋内（ガレージ）', '不明（屋内）', ['grassland'], ['night','day'], ['Pulse'], ''),
 'barking-treefrog': ('Barking treefrog', ['north_america'], False, False, 'kb', '米国', 'ミシシッピ州 University of Mississippi Field Station', ['north_america'], '野外調査地', '野外', ['wetland'], ['night'], ['Pulse','Call & Response'], '背景に他種のカエル。'),
 'autumn-insects': ('Autumn insect chorus (bell cricket etc.)', ['asia','japan'], True, False, 'kb', '日本', '兵庫県香美町・JR餘部駅', ['asia','japan'], '駅周辺の草地（推定せず：原本は駅名のみ）', '野外', ['grassland'], ['night'], ['Texture','Drone'], '複数種の混合。分布は主種スズムシ（Meloimorpha japonica）に基づく。'),
 'cicada': ('Large brown cicada', ['asia','japan'], True, False, 'kb', '日本', '神奈川県川崎市宮前区・東高根森林公園', ['asia','japan'], '公園林', '野外', ['temperate_forest'], ['day'], ['Drone','Texture'], ''),
 'higurashi': ('Evening cicada', ['asia','japan'], True, False, 'kb', '日本', '神奈川県川崎市麻生区', ['asia','japan'], '不明', '野外', ['temperate_forest','mountain'], ['dusk','day'], ['Melody','Call & Response'], '明け方・夕方に鳴く。'),
 'niiniizemi': ('Kaempfer cicada', ['asia','japan'], True, False, 'kb', '日本', '神奈川県横浜市青葉区', ['asia','japan'], '不明', '野外', ['temperate_forest'], ['day'], ['Drone'], ''),
 'tsukutsukuboshi': ('Meimuna opalifera cicada', ['asia','japan'], True, False, 'kb', '日本', '神奈川県川崎市麻生区', ['asia','japan'], '不明', '野外', ['temperate_forest'], ['day'], ['Melody','Pulse'], ''),
 'minminzemi': ('Robust cicada', ['asia','japan'], True, False, 'kb', '日本', '埼玉県志木市', ['asia','japan'], '不明', '野外', ['temperate_forest','mountain'], ['day'], ['Pulse','Melody'], '原録音11024Hz。'),
 'japanese-bush-warbler': ('Japanese bush warbler', ['asia','japan'], True, False, 'kb', '日本', '岐阜県・谷汲山華厳寺', ['asia','japan'], '寺社林', '野外', ['temperate_forest','mountain'], ['day'], ['Melody'], '原録音11024Hz。'),
 'hototogisu': ('Lesser cuckoo', ['asia','japan','africa'], True, False, 'kb', '日本', '神奈川県川崎市宮前区・東高根森林公園', ['asia','japan'], '公園林', '野外', ['temperate_forest','mountain'], ['day','night'], ['Melody'], '越冬地にアフリカ東部を含む。夜間にも鳴く。原録音7812Hz。'),
 'tide-rocks': (None, [], None, None, None, None, None, [], '岩場の潮間帯', '—', ['coast'], [], ['Texture','Atmosphere'], '環境音。録音地不明のため地域フィルターでは All World / Ocean・Marine のみ。'),
 'rocky-beach': (None, [], None, None, None, None, None, [], '岩浜', '—', ['coast'], [], ['Atmosphere'], '環境音。録音地不明。15kbps参考素材。'),
 'kajika-frog': ('Kajika frog', ['japan','asia'], True, True, 'wp-kajika', None, None, [], '不明', '不明', ['river','mountain'], ['day','night'], ['Melody','Call & Response'], '日本固有種。録音地は原本に記載なし → 「日本で録音」フィルター対象外。'),
 'brown-eared-bulbul': ('Brown-eared bulbul', ['asia','japan'], True, False, 'kb', '日本', '静岡県伊豆市（34.9695, 138.9262）', ['asia','japan'], '不明', '野外（iNaturalist観察282617142）', ['temperate_forest'], ['day'], ['Melody'], ''),
 'autumn-insects-2': ('Autumn insect chorus II', ['asia','japan'], True, False, 'kb', '日本', '兵庫県美方郡香美町・JR餘部駅', ['asia','japan'], '駅周辺', '野外', ['grassland'], ['night'], ['Texture','Drone'], '混合録音。autumn-insects とは別テイク（類似度上位15組に入らず）。'),
 'tree-cricket-europe': ('Italian tree cricket', ['europe','africa','asia'], False, False, 'kb', None, None, [], '不明（図鑑付属CD）', '不明', ['grassland'], ['night'], ['Drone','Melody'], '日本のカンタンは別種（Oecanthus longicauda）。'),
 'field-cricket-europe': ('European field cricket', ['europe','africa','asia'], False, False, 'kb', None, None, [], '不明（図鑑付属CD）', '不明', ['grassland'], ['day','night'], ['Pulse'], ''),
 'river-esk': (None, [], None, None, None, '英国', 'スコットランド・Esk川（Kagyu Samye Ling付近）', ['europe'], '河川', '—', ['river'], [], ['Atmosphere','Texture'], '環境音。'),
 'forest-leaves': (None, [], None, None, None, 'カナダ', '46.8906, -71.2458', ['north_america'], '秋の森林', '—', ['temperate_forest'], [], ['Texture','Percussion'], '環境音。原典は96kHz/32-bit WAV。'),
 'forest-wind': (None, [], None, None, None, 'スウェーデン', 'Tuntorp, Brastad, Lysekil', ['europe'], '松林（強風25m/s）', '—', ['temperate_forest'], [], ['Atmosphere','Drone'], '環境音。'),
 'rain-field': (None, [], None, None, None, None, None, [], '不明', '—', [], [], ['Atmosphere','Texture'], '録音地・環境不明 → 生息環境フィルターでは使わない。'),
 'fire-field': (None, [], None, None, None, None, None, [], '暖炉（人工環境）', '—', [], [], ['Texture','Percussion','Experimental'], '自然環境音ではない。'),
 'gampsocleis-glabra': ('Gampsocleis glabra (bush-cricket)', ['europe','asia'], False, False, 'kb', None, None, [], '不明（図鑑付属CD）', '不明', ['grassland'], ['day'], ['Drone','Texture'], '日本のキリギリスは別種（G. buergeri / G. mikado）。'),
 'locust': ('Migratory locust', ['africa','asia','europe','oceania','japan'], True, False, 'kb', None, None, [], '不明（図鑑付属CD）', '不明', ['grassland'], ['day'], ['Percussion','Texture'], '日本に自然分布（トノサマバッタ）するが録音地は不明 → 日本生息種フィルター対象／日本録音フィルター対象外。'),
 'tettigonia-viridissima': ('Great green bush-cricket', ['europe','africa','asia'], False, False, 'kb', None, None, [], '不明（図鑑付属CD）', '不明', ['grassland','temperate_forest'], ['dusk','night'], ['Pulse','Texture'], ''),
 'tettigonia-cantans': ('Upland green bush-cricket', ['europe','asia','africa'], None, None, 'wp-tcan', None, None, [], '不明（図鑑付属CD）', '不明', ['grassland'], ['day','night'], ['Drone','Texture'], '日本での分布は未確認。'),
 'chorthippus-biguttulus': ('Bow-winged grasshopper', ['europe','asia'], None, None, 'wp-cbig', None, None, [], '不明（図鑑付属CD）', '不明', ['grassland'], ['day'], ['Pulse'], '日本産の扱いが分類学的に未確定。'),
 'chorthippus-brunneus': ('Common field grasshopper', ['europe','asia','africa'], None, None, 'wp-cbru', None, None, [], '不明（図鑑付属CD）', '不明', ['grassland'], ['day'], ['Percussion'], '日本での分布は未確認。'),
 'sparrow': ('Eurasian tree sparrow', ['europe','asia','japan'], True, False, 'kb', 'ロシア', 'モスクワ州プーシチノ', ['europe'], '不明', '野外', ['grassland'], ['day'], ['Melody','Texture'], '日本に自然分布するが録音はロシア → 日本生息種：対象／日本録音：対象外。'),
 'swallow': ('Barn swallow', ['europe','asia','africa','north_america','south_america','japan'], True, False, 'kb', '米国', 'ミネソタ州 Minnesota Valley NWR', ['north_america'], '橋（野生生物保護区）', '野外', ['grassland','wetland'], ['day'], ['Melody'], '日本で繁殖。録音は米国。'),
 'white-eye': ('Indian white-eye', ['asia'], False, False, 'kb', 'インド', '詳細不明', ['asia'], '不明', '野外', [], ['day'], ['Melody'], '日本のメジロは別種（Zosterops japonicus）。生息環境は熱帯〜亜熱帯の疎林で、指定9区分に該当なし。'),
}

if __name__ == '__main__':
    feats = json.load(open('work/acoustic_features.json'))['features']
    out = {}
    for rid, v in M.items():
        en, nat, jn, je, ref, cty, reg, recr, env, wild, hab, act, roles, note = v
        f = feats[rid]
        out[rid] = dict(en=en, nativeRegions=nat, japanNative=jn, japanEndemic=je, distributionBasis=REF.get(ref) if ref else '環境音（分布なし）',
                        recordedCountry=cty, recordedArea=reg, recordedRegions=recr, recordingEnvironment=env, wildOrCaptive=wild,
                        habitats=hab, activity=act, activityBasis='種の一般的な鳴く時間帯（録音時刻ではない）' if act else None,
                        soundRoles=roles, soundRolesBasis='鳴き方の既知特徴による手動分類（自動音響分析値を併記）',
                        acoustic={k: (round(x, 4) if isinstance(x, float) else x) for k, x in f.items()}, note=note)
    assert len(out) == 32
    json.dump(out, open('dist/data/wildlife_meta.json', 'w'), ensure_ascii=False, indent=1)
    print('ok', len(out))
