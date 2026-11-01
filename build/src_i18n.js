/* AUDIO ECOSYSTEM — 日本語／英語切り替え（v0.25 第1段階）
   方針：画面の日本語文言（本体スクリプトが書き込む状態表示も含む）を、表示の直前に英語へ置き換える。
   - 辞書は「日本語原文 → 英語」。新しい文言を追加したら、ここ（EXACT か RULES）にも英語を追加する。
   - 種名は録音データ（ae-recordings の jp）と ae-wildlife-meta の en から自動で作る。
   - 出典・ライセンス台帳（#credits）と監査表・DBの本文は原典の記載を保つため翻訳しない（見出しのみ翻訳）。
   - 日本語に戻すときは、置き換えた文字列を原文に戻す。本体の処理（音・状態・保存データ）には触れない。 */
(()=>{'use strict';
const KEY='ae-lang',JP=/[぀-ヿ㐀-鿿]/;
const EXACT={
// ヘッダー・タッチ演奏
'タッチで演奏':'Touch to play','自律演奏に重ねる':'Layer over autonomous play','タッチ音を止める':'Stop touch sounds','左右：音程・定位 / 上下：強さ':'Left–right: pitch & pan / Up–down: intensity',
'タッチ演奏面。左右で音程と定位、上下で強さ。キーボードの矢印とEnterでも演奏できます':'Touch performance surface. Left–right sets pitch and pan, up–down sets intensity. Arrow keys and Enter also play.',
'タッチ演奏の音色':'Touch voice','タッチ音停止':'Touch sounds stopped','発音数の上限です。余韻を待ってからタッチしてください':'Voice limit reached. Let the tails decay, then touch again.',
'合成':'Synth','実録音ハープ':'Harp (real recording)','実録音ヴィブラフォン':'Vibraphone (real recording)','ハープ実録音':'Harp recording',
'パイプオルガン':'Pipe organ','シンギングボウル':'Singing bowl','ソフトピアノ':'Soft piano','柔らかなベル':'Soft bells','弦のハーモニクス':'String harmonics','息のあるフルート':'Breathy flute',
'低音ドローン':'Sub drone','オルガン持続音':'Organ drone','擦弦持続音':'Bowed drone','心拍の脈動（合成）':'Heartbeat pulse (synth)','ランダムキック':'Random kick','石の打撃（合成）':'Stone hits (synth)',
'持続音・低音 / DRONES':'DRONES','音程のある楽器 / INSTRUMENTS':'INSTRUMENTS','打撃・脈動 / PERCUSSION':'PERCUSSION',
// 再生音源
'AUDIO SOURCE / 再生音源':'AUDIO SOURCE','再生に使う音源':'Playback source','PCM WAV — 非圧縮（原本から作成）':'PCM WAV — uncompressed (decoded from originals)',
'原本ファイル — Ogg / Opus / FLAC':'Original files — Ogg / Opus / FLAC','互換MP3 — v0.23と同じ':'Compatibility MP3 — same as v0.23','互換MP3':'Compatibility MP3','原本ファイル':'Original files',
'互換MP3：v0.23と同じ 44.1kHz / モノラル / 128kbps。比較・互換確認用。':'Compatibility MP3: same as v0.23, 44.1 kHz / mono / 128 kbps. For comparison and compatibility checks.',
'まだ読み込んでいません。音源は必要になった時に1つずつ読み込みます。':'Nothing loaded yet. Sources are loaded one at a time when needed.',
'ステレオ':'stereo','モノラル':'mono','読み込み中':'Loading','実録音を読み込み中':'Loading recording','音源がありません':'No source',
'このブラウザの音声形式対応を確認してください。':'Please check this browser’s audio format support.','v0.24は音源を別ファイルから読み込むため、ローカルサーバー経由で開いてください。':'This version loads audio from separate files. Please open it through a local web server.',
'WAV構造エラー':'WAV structure error','WAV分割ファイルの形式不一致':'WAV part format mismatch',
// 監査・DB
'音源形式監査 · 51サンプル':'Source format audit · 51 samples','A1 非圧縮マスター取得済み · A2 非圧縮マスターあり（抜粋のみ保持） · B1 原典自体が非可逆 · C1 原典未保持（MP3のみ）':'A1 uncompressed master held · A2 uncompressed master exists (excerpt only) · B1 source itself is lossy · C1 source not held (MP3 only)',
'SHA-256を全件検証':'Verify all SHA-256','↓ 監査表CSV':'↓ Audit CSV','全件検証は約190MBを読み込みます。Wi-Fi環境で実行してください。':'Full verification downloads about 190 MB. Please use Wi-Fi.',
'このページではSHA-256検証を使えません（HTTPSが必要）':'SHA-256 verification is unavailable on this page (HTTPS required)','（不一致）':'(mismatch)',
'WILDLIFE SOUND MASTER DATABASE · 52対象':'WILDLIFE SOUND MASTER DATABASE · 52 targets','表示':'Show','すべて':'All','アプリ収録済み':'In the app','候補（確認済み・未取得）':'Candidates (verified, not yet acquired)',
'候補（一部未確認）':'Candidates (partly unverified)','ライセンスで不採用':'Excluded by license','未発見':'Not found','リスト受領待ち':'Awaiting list','リスト待ち':'Awaiting list',
'「確認済み」は形式・ライセンス・録音地を出典ページで確認した候補です。この環境からは音声ファイルを取得できないため、アプリにはまだ入っていません。':'“Verified” means format, license and recording location were checked on the source page. These files could not be fetched from this environment, so they are not in the app yet.',
'名称':'Name','学名':'Scientific name','形式':'Format','ライセンス':'License','状態':'Status','備考':'Notes','対象':'Target','原典':'Source','録音国':'Recording country','日本分布':'Native to Japan','採用可否':'Eligibility',
'候補（形式・ライセンス・録音地）':'Candidates (format, license, location)','収録済':'In app','確認済候補':'Verified candidate','一部未確認':'Partly unverified','不採用':'Excluded','候補':'Candidate','未確認':'Unverified','日本分布 / 固有':'Native / endemic to Japan','日本分布未確認':'Japan distribution unverified',
// 自律演奏
'声を重ねて、風景をつくる':'Layer voices, build a landscape','選んだ生き物が、それぞれ独立して鳴き、休みます。録音は最後まで再生し、両端をフェードします。':'Each selected creature calls and rests independently. Recordings play to the end with fades at both edges.',
'▶ 自律演奏をはじめる':'▶ Start autonomous play','▶ 自律演奏を再開':'▶ Resume autonomous play','■ 演奏を一時停止':'■ Pause','↻ 休息のタイミングを変える':'↻ Reshuffle rest timing',
'いま鳴っている実録音':'Recordings sounding now','待機中':'Standby','次の声を待っています':'Waiting for the next voice','全体の音量・活動量・同時発音数':'Overall volume, activity and polyphony',
'鳥':'Birds','虫':'Insects','動物':'Animals','水・波':'Water & waves','全体の活動量':'Overall activity','同時に鳴ける数':'Max simultaneous voices','実録音の音量':'Recording volume',
'鳥の混ざり具合':'Bird mix','虫の混ざり具合':'Insect mix','動物の混ざり具合':'Animal mix','水と波の混ざり具合':'Water & wave mix','声の同時発音数':'Simultaneous voices',
'最大16生物音 · 初期12音 · 重なりに応じて全体音量を自動調整':'Up to 16 creature voices · 12 by default · overall level auto-balanced by overlap',
'36実録音 / 環境層と自律演奏':'36 recordings / ambience beds and autonomous play','23レイヤーを自律演奏中。和声・音密度・音響空間が連続的に変化します。':'Playing 23 layers autonomously. Harmony, density and space evolve continuously.',
'次の出現順を組み直しました':'Next appearance order reshuffled','選んだ音が次の出現から混ざります':'Selected sounds join from their next appearance','音質モードを変更。新しい音の倍音数と最大同時発音数を実際に切り替えます。':'Quality mode changed. Partial count and max polyphony switch for new notes.',
'音声メモリ上限です。再生中の実録音を停止してから選択してください。':'Audio memory limit reached. Stop a playing recording before selecting another.',
'小音量から開始してください。再生後は自動的に和声と音響風景が進化します。':'Start at a low volume. After playback begins, harmony and soundscape evolve on their own.',
// 生き物
'1. 鳴かせる生き物を選ぶ':'1. Choose the creatures','鳥・虫・動物・波 ▾':'Birds · insects · animals · waves ▾',
'参加中の声を先頭に表示します。「この声を聴く」で音を確認し、「この音場に加える」で独立した声として重ねます。':'Active voices are listed first. Use “listen” to check a sound and “add” to layer it as an independent voice.',
'BIRDS / 鳥':'BIRDS','INSECTS / 虫':'INSECTS','ANIMALS / 動物':'ANIMALS','WATER / 水・波':'WATER','BIRDS / 鳥 — MASTER':'BIRDS — MASTER','INSECTS / 虫 — MASTER':'INSECTS — MASTER','ANIMALS / 動物 — MASTER':'ANIMALS — MASTER',
'参加予定':'Will join','鳴いています':'Calling','休息中':'Resting','参加していません':'Not active','✓ この音場に参加':'✓ In this soundscape','＋ この音場に加える':'＋ Add to this soundscape',
'▶ この録音を聴く':'▶ Listen to this recording','▶ 合成音を聴く':'▶ Listen to the synth imitation','この声の音量':'Voice volume','鳴き終わってからの休息（秒）':'Rest after each call (s)','出典・録音の読み込み':'Source & recording import',
'持込音源の権利':'Rights for imported audio','録音インポート':'Import recording','実録音':'Real recording','合成音':'Synth','日本で録音':'Recorded in Japan','海外または録音地不明':'Recorded abroad or location unknown',
'合成の模倣音（実録音未収録）':'Synthesized imitation (no real recording yet)','実録音未収録 · 合成による模倣音':'No real recording yet · synthesized imitation','実録音未収録です。合成模倣音は下の合成音試聴で確認できます。':'No real recording yet. You can hear the synth imitation with the button below.',
'実録音を最後まで再生。同じ種が休息を挟んで繰り返します。':'Plays the full recording; the same species repeats after a rest.',
'ジリジリと厚く続く声。夏の音場の土台。':'A thick, sizzling drone — the bed of a summer soundscape.','抑揚のある節が続く声。アブラゼミとは独立して重なります。':'A phrased, rising-and-falling song that layers independently of the large brown cicada.',
'複数の虫が鳴く、秋の合唱録音。':'An autumn chorus of several insect species.','澄んだ反復音。響きの間を残して配置。':'Clear repeating calls, placed with space to ring.','細く連続する高い声。':'A thin, continuous high-pitched call.','輪郭の強い反復する声。':'A sharply defined repeating call.',
'兵庫・餘部で収録した秋の合唱。':'An autumn chorus recorded at Amarube, Hyōgo.','短いさえずり。録音自体が約4秒です。':'A short song; the recording itself is about 4 seconds.','笛のようなカエルの声。':'A flute-like frog call.',
'複数種：Meloimorpha japonica 等':'Multiple species: Meloimorpha japonica etc.','該当なし':'n/a','水辺の実録音 / 録音地不明':'Waterside recording / location unknown',
// 地域フィルター
'地域・生息環境で選ぶ — GEOGRAPHIC FILTER':'GEOGRAPHIC FILTER — region & habitat','選んだ条件に合う実録音だけで自律演奏します。該当がない場合は他地域の録音や合成音で代用しません。生物の自然分布と録音地は別に判定します。':'Plays only real recordings that match. Nothing is substituted with other regions or synth sounds. Natural distribution and recording location are judged separately.',
'地域':'Region','使わない（シーン設定）':'Off (use scene setting)','判定':'Basis','自然分布する種':'Species native here','その地域で録音':'Recorded in this region','固有種のみ（Japanのみ）':'Endemics only (Japan only)',
'生息環境':'Habitat','指定なし':'Any','時間帯':'Time of day','音の性格':'Sound role','地域フィルターは未使用です。':'Geographic filter is off.','地域フィルターは未使用です。シーン設定と個別選択で演奏します。':'Geographic filter is off. Playing from the scene setting and individual choices.',
'地域フィルター':'Geographic filter','地域フィルター：該当なし（無音の生物層）':'Geographic filter: no match (creature layer silent)','環境層：条件に合う実録音がないため停止中':'Ambience: stopped — no recording matches the filter',
'Japan Native Species — 日本に自然分布':'Japan Native Species — native to Japan','Recorded in Japan — 日本で録音':'Recorded in Japan','Japan Endemic — 日本固有種':'Japan Endemic — endemic to Japan',
'日本録音':'Recorded in Japan','日本生息':'Lives in Japan','日本固有':'Endemic to Japan','録音地不明':'Location unknown','（自然分布）':'(native range)','（録音地）':'(recording location)',
'：該当する実録音がありません。他地域の録音や合成音で代用せず、生物音・環境層は鳴らしません。':': no matching recordings. Nothing is substituted with other regions or synth sounds; creature and ambience layers stay silent.',
// シーン
'シーン設定 — 生き物の組み合わせをまとめて選ぶ':'Scenes — choose a set of creatures at once','適用すると現在の参加メンバーを置き換えます。下の分類から一匹ずつ追加・解除できます。':'Applying replaces the current selection. You can add or remove creatures one by one below.',
'組み合わせ':'Scene','日本の生き物':'Japanese wildlife','虫をたっぷり':'Lots of insects','夏の蝉':'Summer cicadas','秋の虫':'Autumn insects','鳥のいる風景':'Birdscape','岩場・引き潮':'Rocky shore & ebb tide','この組み合わせを適用':'Apply this scene',
'日本の虫＋海外のコオロギ類 / 次の出現から反映':'Japanese insects + crickets from abroad / applies from the next appearance',
// 試聴
'試聴は自律演奏を止め、選んだ録音だけを再生します':'Preview pauses autonomous play and plays only the chosen recording','試聴を止める':'Stop preview','試聴停止':'Preview stopped','実録音の試聴プレイヤー':'Recording preview player',
'続きの再生待ち：下のプレイヤーの▶を押してください':'Waiting to continue: press ▶ on the player below','再生中':'Playing','再生終了':'Finished','試聴失敗':'Preview failed','次の音へ進みます':'Moving to the next sound',
// ライブラリ・クレジット
'実録音ライブラリ · 36録音 / 個別試聴':'Recording library · 36 recordings / individual preview','日本の生き物を選ぶ':'Choose Japanese wildlife','生物音の自律選択をオフ':'Turn off creature auto-selection','生物音の自律選択をオフにしました':'Creature auto-selection turned off',
'録音者・出典・利用条件':'Recordists, sources & terms of use','↓ ライセンス台帳':'↓ License ledger',
'無料・商用利用可。録音ごとにCC BY、CC BY-SA、Public domainが異なります。公開時は各録音の表示条件に従ってください。CC BY-SA素材を加工した音声作品には継承条件があります。権利者による推奨を意味しません。インポート音声は利用者による権利確認が必要です。':'Free, commercial use allowed. Each recording is CC BY, CC BY-SA or public domain — follow each recording’s attribution terms when publishing. Audio works derived from CC BY-SA material carry share-alike conditions. This does not imply endorsement by the rights holders. Imported audio requires your own rights check.',
'（出典・ライセンスの記載は原典のまま表示しています）':'(Source and license details are shown as written in the originals)',
// 環境実録音
'環境実録音 / FIELD AMBIENCE':'FIELD AMBIENCE','9素材 · 全素材を同時再生可':'9 sources · all can play together','川・森の葉・風・雨・火と日本録音の4素材（柏の虫・竹林と小川・水田のカエル・京都の雨）を独立して重ねます。音量0で停止。同時に鳴るのは4層までで、それ以上選ぶと順番に入れ替わります。重なりに応じて全体音量を自動調整します。':'River, forest leaves, wind, rain and fire plus four Japanese recordings (Kashiwa insects, bamboo & stream, rice-paddy frogs, Kyoto rain) layer independently. Volume 0 stops a bed. Up to 4 beds sound at once; select more and they take turns. Overall level auto-balances with overlap.',
'川と森の葉を選択中':'River and forest leaves selected','旧合成音・抽象音を使う':'Use legacy synth / abstract sounds','実録音の環境層から旧合成環境音に切り替える':'Switch the ambience from real recordings to legacy synth beds',
'自然の実録音ではありません。旧プリセットの音色を残しています。':'These are not real nature recordings; kept from older presets.','旧合成環境音を有効化':'Legacy synth ambience enabled','実録音の環境音に戻しました':'Back to real-recording ambience','環境音の読み込み待ち':'Waiting for ambience to load','実録音の環境層':'Recorded ambience','環境層':'Ambience',
'原本全長':'full original','抜粋':'excerpt',
// 録音・プリセット
'リアルタイム録音。外部サービス不要。録音は30秒で自動停止します。AudioWorklet非対応環境では録音できません。実録音入りWAVの公開には各素材のライセンス条件が適用されます。上の台帳で確認してください。書き出したWAVには、鳴った素材の帰属表示を埋め込みます（LIST/INFO）。':'Real-time capture, no external service. Recording stops automatically at 30 seconds and needs AudioWorklet support. Publishing a WAV that contains recordings is subject to each source’s license — check the ledger above. Exported WAVs embed attribution for every recording that sounded (LIST/INFO chunk).',
'↓ クレジット（帰属表示）を保存':'↓ Save credits (attribution)','帰属表示の内容':'Attribution text','↓ 帰属表示（全素材）':'↓ Attribution (all sources)',
'WAV録音中。30秒で自動書き出しします。':'Recording WAV. Exports automatically at 30 seconds.','この環境はAudioWorklet録音に対応していません':'This environment does not support AudioWorklet recording','録音データがありません':'No recorded data',
'1音ずつ比較。選択中は他の新規イベントを抑え、8秒後に元の音場へ戻ります。既に鳴っている余韻は残ります。':'Compare one sound at a time. While selected, other new events are held back; the soundscape returns after 8 seconds. Tails already sounding continue.',
'このブラウザにプリセットを保存しました。':'Preset saved in this browser.','プリセットJSONを書き出しました。':'Preset JSON exported.','プリセットJSONを読み込みました。':'Preset JSON imported.','プリセットを復元しました（v0.8の設定も読み込み可能）。':'Preset restored (v0.8 settings can be loaded too).',
'音量・音色の初期値を復元しました。':'Volume and tone defaults restored.','保存データなし':'No saved data','対応していないプリセット形式':'Unsupported preset format','既存21音源と5マクロの設定が不足しています':'Settings for the 21 core sources and 5 macros are missing','プリセットJSONを選択':'Choose preset JSON',
'100KBを超えるファイルは読み込めません':'Files over 100 KB cannot be loaded','20MBまで':'up to 20 MB','はい':'Yes','いいえ':'No','なし':'None',
'不正な休息時間':'Invalid rest time','不正な再生設定':'Invalid playback setting','不正な和声番号':'Invalid harmony index','不正な環境設定':'Invalid ambience setting','不正な環境音量':'Invalid ambience volume','不正な生態系設定':'Invalid ecosystem setting','不正な生物設定':'Invalid creature setting',
'保存できません':'Cannot save','復元できません':'Cannot restore','書き出し失敗':'Export failed','読み込み失敗':'Load failed','録音を開始できません':'Cannot start recording','不正な音量値':'Invalid volume value',
'最後の読み込み':'Last loaded','参加中':'Active','読み込み完了':'Loaded',
// 国・地域（地域フィルターの一覧）
// 録音地（原典の記載を英語表記にしたもの。原文は日本語表示と台帳に残る）
'原本に記載なし':'Not stated in source','同時に鳴るのは4層まで（順番に入れ替え）':'up to 4 beds at once (rotating)','千葉県柏市（畑と小さな林）':'Kashiwa, Chiba, Japan (field and small wood)','日本（地名の記載なし）':'Japan (no place name given)','和歌山県・高野山近くの富貴地区の水田':'Rice paddy in the Fuki area near Kōyasan, Wakayama, Japan','京都府京都市（庭）':'Kyoto, Japan (garden)','録音場所不明':'Location unknown','録音場所不明（北西ヨーロッパの鳴く虫コレクション）':'Location unknown (north-western European singing-insect collection)','録音地点不明（北西ヨーロッパの音源集由来）':'Location unknown (from a north-western European sound collection)',
'米国北東部・録音者のガレージ':'North-eastern USA, recordist’s garage','兵庫県香美町・JR餘部駅':'JR Amarube Station, Kami, Hyōgo, Japan','JR餘部駅・兵庫県美方郡香美町':'JR Amarube Station, Kami, Mikata District, Hyōgo, Japan',
'神奈川県川崎市宮前区・東高根森林公園':'Higashi-Takane Forest Park, Miyamae-ku, Kawasaki, Kanagawa, Japan','神奈川県川崎市麻生区':'Asao-ku, Kawasaki, Kanagawa, Japan','神奈川県横浜市青葉区':'Aoba-ku, Yokohama, Kanagawa, Japan','埼玉県志木市':'Shiki, Saitama, Japan',
'岐阜県・谷汲山華厳寺':'Kegon-ji Temple, Mt. Tanigumi, Gifu, Japan','静岡県伊豆市':'Izu, Shizuoka, Japan','スコットランド・Kagyu Samye Ling近くのEsk川':'River Esk near Kagyu Samye Ling, Scotland','モスクワ州プーシチノ、ロシア':'Pushchino, Moscow Oblast, Russia','インド（詳細不明）':'India (details unknown)',
'日本':'Japan','ロシア':'Russia','米国':'USA','英国':'UK','スウェーデン':'Sweden','カナダ':'Canada','インド':'India','スコットランド':'Scotland','オランダ':'Netherlands','ドイツ':'Germany','フランス':'France','不明':'unknown'
};
// 合成のみの種（録音データに英名がないもの）
const EXTRA_NAMES={'サヨナキドリ':'Common nightingale','カッコウ':'Common cuckoo','ミソサザイ':'Eurasian wren','モリフクロウ':'Tawny owl','アマガエル':'Japanese tree frog','シカ':'Sika deer','オオカミ':'Grey wolf','ザトウクジラ':'Humpback whale','イルカ':'Bottlenose dolphin','キツネ':'Red fox',
'スズムシ':'Bell cricket','エンマコオロギ':'Emma field cricket','マツムシ':'Matsumushi cricket','キリギリス':'Japanese bush-cricket','クツワムシ':'Japanese mecopoda katydid',
'引き潮・岩を伝う水':'Ebb tide over rocks','岩浜の小さな波':'Small waves on a rocky beach','川の流れ / Esk川':'River Esk flow','森の葉擦れ・落葉':'Forest leaves rustling & falling','松林の強風':'Strong wind in pines','雨の実録音':'Rain (field recording)','暖炉で燃える枯れ草':'Dry grass burning in a fireplace'};
const NAMES=Object.assign({},EXTRA_NAMES),LATIN={};
try{const recs=JSON.parse(document.getElementById('ae-recordings').textContent),meta=JSON.parse(document.getElementById('ae-wildlife-meta').textContent);
 for(const r of recs){const en=meta[r.id]&&meta[r.id].en;if(en){NAMES[r.jp]=en;if(r.latin)LATIN[r.latin]=en}}}catch(e){}
const RULES=[
 [/^(\d+)種・素材が参加$/,m=>m[1]+' species & sources active'],[/^(\d+)音$/,m=>m[1]+' voices'],[/^(\d+)レイヤー$/,m=>m[1]+' layers'],[/^(\d+(?:\.\d+)?)秒$/,m=>m[1]+' s'],
 [/^(\d+)秒・原本全長$/,m=>m[1]+' s · full original'],[/^(\d+)秒・抜粋（原本 (\d+)秒）$/,m=>m[1]+' s · excerpt (original '+m[2]+' s)'],
 [/^生物 (\d+)$/,m=>'Creatures '+m[1]],[/^自動バランス (\d+%)$/,m=>'Auto balance '+m[1]],[/^音声メモリ (.+)$/,m=>'Audio memory '+m[1]],
 [/^実録音 (\d+)件（生物・声 (\d+) \/ 環境層 (\d+)）$/,m=>m[1]+' recordings ('+m[2]+' creatures / '+m[3]+' ambience)'],
 [/^録音:(.+)$/,m=>'Recorded: '+tr(m[1])],[/^読み込み完了（(.+)）$/,m=>'Loaded ('+tr(m[1])+')'],[/^(.+)を読み込み中（(.+)）$/,m=>'Loading '+tr(m[1])+' ('+tr(m[2])+')'],
 [/^(.+)の読み込みに失敗しました（(.*)$/,m=>'Failed to load '+tr(m[1])+' ('+m[2]],
 [/^(.+) (この声の音量|鳴き終わってからの休息（秒）|持込音源の権利|録音インポート)$/,m=>tr(m[1])+' — '+tr(m[2])],
 [/^(.+)の音量$/,m=>'Volume: '+tr(m[1])],
 [/^(.*?)（指定形式なし → (.+)）$/,m=>tr(m[1])+' (format not available → '+tr(m[2])+')'],[/^(.*?)（原本を読み込めず (.+) で代替）$/,m=>tr(m[1])+' (original could not be loaded; using '+tr(m[2])+')'],
 [/^(.+)（原本位置）$/,m=>m[1]+' (position given in source)'],[/^調査日 (.+)$/,m=>'surveyed '+m[1]],
 [/^([^ ]+) (\d+)$/,m=>{const l=leaf(m[1]);return l==null?m[0]:l+' '+m[2]}],
 [/^([A-Z][a-z]+ [a-z]+)（[^）]*）$/,m=>LATIN[m[1]]||m[1]],
 [/^([▶＋✓■↓↑↻✧●] ?)(.+)$/,m=>m[1]+tr(m[2])],
 [/^PCM WAV：自然録音 (\d+)\/(\d+) · 楽器 (\d+)\/(\d+)。残り(\d+)録音は原本を保持していないため互換MP3で再生します（MP3からのWAV化は音質改善にならないため行いません）。$/,m=>'PCM WAV: nature recordings '+m[1]+'/'+m[2]+' · instruments '+m[3]+'/'+m[4]+'. The remaining '+m[5]+' recordings play as compatibility MP3 because their originals are not held (converting MP3 to WAV would not improve quality, so it is not done).'],
 [/^原本ファイル：自然録音 (.*)$/,m=>'Original files: nature recordings '+tr(m[1])],
 [/^この録音のクレジット：素材(\d+)件（帰属表示が必要 (\d+)件）$/,m=>'Credits for this capture: '+m[1]+' source(s) ('+m[2]+' require attribution)'],
 [/^16-bit stereo WAVを書き出しました（(.*)）。?$/,m=>'Exported a 16-bit stereo WAV ('+m[1]+').'],[/^(?:音源を )?(.+) に切り替えました。次に鳴る音から反映されます。$/,m=>'Switched to '+tr(m[1])+'. Applies from the next sound.'],
 [/^再生待ち：下のプレイヤーの▶を押してください（(.*)）$/,m=>'Waiting to play: press ▶ on the player below ('+tr(m[1])+')'],[/^(.+)：下のプレイヤーの▶を押してください$/,m=>tr(m[1])+': press ▶ on the player below'],
 [/^(.+)：読み込みました。権利は別途確認してください。$/,m=>tr(m[1])+': imported. Please check the rights separately.'],
 [/^再生エラー (.*)$/,m=>'Playback error '+m[1]],[/^検証中 (.*)$/,m=>'Verifying '+m[1]],[/^不一致・失敗 (.*)$/,m=>'Mismatch / failed '+m[1]],[/^サイズ不一致 (.*)$/,m=>'Size mismatch '+m[1]],[/^ファイルのSHA-256一致（(.*)$/,m=>'File SHA-256 matches ('+m[1]],
 [/^([^＋·—/]+)（(録音地|自然分布)）$/,m=>tr(m[1])+' '+EXACT['（'+m[2]+'）']],
 [/^([^＋·—/]+)（(伊豆|兵庫)）$/,m=>NAMES[m[0]]?NAMES[m[0]]:tr(m[1])+' ('+(m[2]==='伊豆'?'Izu':'Hyōgo')+')']
];
const cache=new Map();
function leaf(s){if(!JP.test(s))return s;if(EXACT[s]!==undefined)return EXACT[s];if(NAMES[s])return NAMES[s];for(const [re,f] of RULES){const m=s.match(re);if(m){const v=f(m);if(v!==s)return v}}return null}
function tr(s){if(!s||!JP.test(s))return s;if(cache.has(s))return cache.get(s);let out=leaf(s);
 if(out==null){// 「見出し：本文」形式
  const c=s.match(/^([^：]+)：(.+)$/)||s.match(/^([^:]+?): (.+)$/);if(c&&(!JP.test(c[1])||leaf(c[1])!=null))out=tr(c[1])+': '+tr(c[2]);}
 if(out==null){for(const sep of [' — ',' · ',' ＋ ',' / ']){if(s.includes(sep)){out=s.split(sep).map(tr).join(sep===' ＋ '?' + ':sep);break}}}
 if(out==null)out=s;if(cache.size<5000)cache.set(s,out);return out}
let lang='ja';try{const q=new URLSearchParams(location.search).get('lang');lang=(q==='en'||q==='ja')?q:(localStorage.getItem(KEY)==='en'?'en':'ja')}catch(e){}
const textRec=new Map(),attrRec=new Map(),ATTRS=['aria-label','title','placeholder'];
const SKIP='script,style,#credits,[data-i18n-skip]',TABLES='#auditTable,#dbTable';
function skipEl(el){if(!el||el.closest(SKIP))return true;const t=el.closest(TABLES);return !!(t&&!el.closest('th,thead'))}
function doText(n){const cur=n.nodeValue;const r=textRec.get(n);if(r&&cur===r.en)return;if(!cur||!JP.test(cur)||skipEl(n.parentElement))return;
 const core=cur.trim(),en=tr(core);if(en===core)return;const v=cur.replace(core,en);textRec.set(n,{ja:cur,en:v});n.nodeValue=v}
function doAttr(el,a){const cur=el.getAttribute(a);if(!cur)return;let m=attrRec.get(el);const r=m&&m[a];if(r&&cur===r.en)return;if(!JP.test(cur)||skipEl(el))return;const en=tr(cur);if(en===cur)return;if(!m){m={};attrRec.set(el,m)}m[a]={ja:cur,en};el.setAttribute(a,en)}
function walk(root){if(root.nodeType===3){doText(root);return}if(root.nodeType!==1)return;
 for(const a of ATTRS)if(root.hasAttribute&&root.hasAttribute(a))doAttr(root,a);
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while(n=w.nextNode()){if(n.nodeType===3)doText(n);else for(const a of ATTRS)if(n.hasAttribute(a))doAttr(n,a)}}
const obs=new MutationObserver(list=>{if(lang!=='en')return;for(const m of list){if(m.type==='characterData')doText(m.target);else if(m.type==='attributes')doAttr(m.target,m.attributeName);else for(const n of m.addedNodes)walk(n)}});
function restore(){for(const [n,r] of textRec){if(n.isConnected&&n.nodeValue===r.en)n.nodeValue=r.ja}textRec.clear();
 for(const [el,m] of attrRec){for(const a in m)if(el.getAttribute(a)===m[a].en)el.setAttribute(a,m[a].ja)}attrRec.clear()}
const btn=document.getElementById('langToggle'),note=document.getElementById('creditsLangNote');
function paint(){document.documentElement.lang=lang;if(btn){btn.textContent=lang==='en'?'日本語':'English';btn.setAttribute('aria-label',lang==='en'?'表示言語を日本語に切り替える':'Switch display language to English');btn.setAttribute('aria-pressed',String(lang==='en'))}
 if(note)note.hidden=lang!=='en'}
function set(l){l=l==='en'?'en':'ja';if(l===lang&&(l==='ja'||textRec.size))return paint();lang=l;try{localStorage.setItem(KEY,l)}catch(e){}
 if(l==='en')walk(document.body);else restore();paint()}
obs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
if(btn)btn.addEventListener('click',()=>set(lang==='en'?'ja':'en'));
const want=lang;lang='ja';set(want);paint();
window.__i18n={set,get:()=>lang,t:tr,untranslated:()=>{const out=new Set();const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(t&&JP.test(t)&&!skipEl(n.parentElement)&&!n.parentElement.closest('[hidden]'))out.add(t)}
 for(const el of document.body.querySelectorAll('*'))for(const a of ATTRS){const v=el.getAttribute(a);if(v&&JP.test(v)&&!skipEl(el))out.add('@'+a+'='+v)}return [...out]}};
})();
