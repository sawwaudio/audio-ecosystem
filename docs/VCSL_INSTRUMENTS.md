# VCSL（CC0）の楽器一覧と、合成音の置き換え先の案
**2026-11-08 07:20 JST（自動実行）／バックログ C ③（VCSL の楽器一覧の調査）と C ①（置き換え先の対応表）の下書き**

この文書は**調査の記録**であり、取り込み・実装はしていない。音は聴いていない・音高は測っていない（取り込む時に、これまでどおり1本ずつ測る）。置き換えるかどうか・合成版を外すかどうかは**オーナー判断**。

## 0. 調べ方
- 取得元：https://github.com/sgossner/VCSL 固定コミット `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`（これまでの取り込みと同じ）。
- ライセンス：同コミットの `LICENSE` を取得して確認（冒頭「Creative Commons Legal Code / CC0 1.0 Universal」）。
- 方法：音声本体を落とさない部分取得（`git clone --filter=blob:none --no-checkout`）で、ファイル名の一覧（`git ls-tree -r --name-only`）だけを読んだ。全 4,282 パス、うち WAV 4,231 本、楽器のフォルダ 104。
- 「使用中」は、本体の `instruments/pcm/` のファイル名を一覧と突き合わせて判定（ファイル名の `#` は本体では `s` に置き換えているため、それを戻して照合）。21 フォルダが使用中。
- 本数はフォルダ内の WAV の数（強弱・ラウンドロビン・マイク位置の違いを含む）。音の数ではない。

## 1. 合成音の置き換え先の案（C ①・オーナー判断用）
合成音の層（「合成音を鳴らさない」の対象。test_synth_off_v051.js の targets と同じ10個）ごとに、VCSL で近いものを挙げる。◎＝同じ種類の楽器、○＝性格が近い、△＝代わりにはなるが別物。

| 合成音の層（キー） | 画面の名前 | 置き換え先の案（VCSL） | 近さ | 補足 |
|---|---|---|---|---|
| sub | 低音ドローン | 使用中の organPedal（Pipe Organ の NT5_PedalQuiet）・pianoLow | ○ | 実録音の低音はすでにある。合成の sub は純音に近い最低域で、実録音では同じ音にならない |
| organDrone | オルガン持続音 | Renaissance Organ（4フィート・8フィート・フル、各27本）／Pipe Organ の Man3Quiet・Man3Open（各21本） | ◎ | 持続音のループ化（使用中の organPedal と同じ仕組み）で置き換えられる見込み（未検証） |
| bowed | 擦弦持続音 | Vibraphone の Vibes_bowed（6本）／Wine Glasses（16本）／使用中の bowedPsaltery | ○ | VCSL に弓で弾く弦楽器（ヴァイオリン族）は無い |
| organ | パイプオルガン | Pipe Organ の Man3Quiet（21本）／Renaissance Organ | ◎ | 旋律（melody）の層として足せる見込み |
| bowl | シンギングボウル | なし | — | VCSL にシンギングボウルは無い。近いのは Wine Glasses（擦る・減衰）だが別物。別の CC0 の取得元が必要 |
| piano | ソフトピアノ | Grand Piano, Kawai（228本）／Upright Piano, Knight・Yamaha／使用中の Steinway B（JHPiano） | ◎ | 使用中の pianoLow は最低音域だけ。中高音域を旋律の層として足せる見込み |
| bells | 柔らかなベル | Hand Chimes（19本）／使用中の tubularBells・glockenspiel・handBells | ◎ | ハンドチャイムがいちばん「柔らかなベル」に近い（未聴） |
| heart | 心拍の脈動（合成） | Bass Drum 2（30本。強弱・クレッシェンド）／使用中の frameDrum（くぐもった打音） | △ | 心拍の二連打は奏法では録られていない。フレーズの組み方で近づけることになる |
| kick | ランダムキック | Bass Drum 2／Bass Drum 1 | ◎ | |
| stones | 石の打撃（合成） | Claves（12本）／Woodblock（10本） | △ | VCSL に石の打撃は無い。木の打撃で代えるなら「石」と表示しない |

- 置き換え済みとみなせるもの：いまでも bells・piano（低音域）・sub は実録音の層が並んでいる。合成版を外すかはオーナー判断（LIBRARY_300_PLAN 3）。
- 置き換え先が VCSL に無いもの：bowl（シンギングボウル）、stones（石）。これらは別の CC0 / CC BY の取得元を探す（自動実行では候補調査まで）。

## 2. 次に取り込む楽器の候補（バックログ E 用・優先順の案）
1. Hand Chimes（柔らかなベルの置き換え・旋律）
2. Renaissance Organ（オルガン持続音の置き換え・ループ）
3. Vibes_bowed と Wine Glasses（擦る持続音。アンビエントに合う）
4. Grand Piano, Kawai（ソフトピアノの置き換え・中高音域の旋律）
5. Mark Trees・Bell Tree（きらめき・ときどき鳴らす音）
6. Ocarina・Baroque Recorder（息の旋律。持続のループ）
7. Bass Drum 2（キック・心拍の置き換え）
- Ocean Drum は「波の音をまねる楽器」なので、入れる場合は自然録音（環境音）と混同しないよう楽器の層に置き、名前に「楽器」と明記する。
- TX81Z（Electrophones）は FM 音源の録音＝合成音なので採らない。

## 3. 全楽器の一覧（固定コミット c1ea7bc 時点）
| 分類 | 楽器（フォルダ名） | WAV の本数 | 本体での状態・メモ |
|---|---|---:|---|
| Aerophones / Edge-blown Aerophones | Ball Whistle | 2 | — |
| Aerophones / Edge-blown Aerophones | Baroque Alto Recorder | 36 | 候補（旋律・持続） |
| Aerophones / Edge-blown Aerophones | Baroque Bass Recorder | 41 | 候補（低音の持続） |
| Aerophones / Edge-blown Aerophones | Baroque Soprano Recorder | 25 | 候補 |
| Aerophones / Edge-blown Aerophones | Baroque Tenor Recorder | 39 | 候補 |
| Aerophones / Edge-blown Aerophones | Ocarina, Small | 23 | 候補 |
| Aerophones / Edge-blown Aerophones | Ocarina, Typical | 42 | 候補（旋律・持続） |
| Aerophones / Edge-blown Aerophones | Pipe Organ | 65 | **使用中**：organPedal（NT5_PedalQuiet） |
| Aerophones / Edge-blown Aerophones | Renaissance Organ | 81 | 候補（オルガン持続音・パイプオルガンの置き換え先。4フィート・8フィート・フル） |
| Aerophones / Edge-blown Aerophones | Train Whistle, Toy | 6 | — |
| Aerophones / Free Aerophones | Harmonica-Hohner-Special20-C | 58 | — |
| Aerophones / Free Aerophones | Harmonica-Hohner-Special20-F | 94 | — |
| Aerophones / Free Aerophones | Harmonica-Hohner-Super64 | 78 | — |
| Aerophones / Free Aerophones | Siren | 5 | — |
| Aerophones / Lip Aerophones | Didgeridoo | 12 | **使用中**：didge・didgePhrase |
| Aerophones / Reed Aerophones | Saxello | 39 | — |
| Aerophones / Reed Aerophones | Tenor Saxophone | 105 | — |
| Chordophones / Composite Chordophones | Concert Harp | 45 | **使用中**：harp（KSHarp） |
| Chordophones / Composite Chordophones | Folk Harp | 58 | 候補（第2のハープ） |
| Chordophones / Composite Chordophones | Strumstick | 57 | — |
| Chordophones / Zithers | Dan Tranh | 115 | **使用中**：danTranh |
| Chordophones / Zithers | Grand Piano, Kawai | 228 | 候補（ソフトピアノの置き換え先） |
| Chordophones / Zithers | Grand Piano, Kawai - Legacy | 134 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Chordophones / Zithers | Grand Piano, Steinway B | 351 | **使用中**：pianoLow（JHPiano） |
| Chordophones / Zithers | Harpsichord, English | 110 | — |
| Chordophones / Zithers | Harpsichord, Flemish | 108 | — |
| Chordophones / Zithers | Harpsichord, French | 58 | — |
| Chordophones / Zithers | Harpsichord, Italian | 63 | — |
| Chordophones / Zithers | Harpsichord, Unk | 122 | — |
| Chordophones / Zithers | Psaltery, Bowed and Plucked | 33 | **使用中**：bowedPsaltery |
| Chordophones / Zithers | Upright Piano, Knight | 143 | 候補（ソフトピアノの置き換え先） |
| Chordophones / Zithers | Upright Piano, Yamaha | 142 | 候補 |
| Electrophones / TX81Z | Clavisynth | 57 | 対象外（電子楽器＝合成音。実録音の方針に合わない） |
| Electrophones / TX81Z | FM Piano | 66 | 対象外（電子楽器＝合成音。実録音の方針に合わない） |
| Electrophones / TX81Z | Piano 1 | 66 | 対象外（電子楽器＝合成音。実録音の方針に合わない） |
| Idiophones / Friction Idiophones | Wine Glasses | 16 | 候補（擦る・減衰。グラスハープ風の持続音。4音×4） |
| Idiophones / Plucked Idiophones | Kalimba, Kenya | 15 | **使用中**：kalimba |
| Idiophones / Plucked Idiophones | Kalimba, Tanzania | 27 | 候補（第2のカリンバ） |
| Idiophones / Plucked Idiophones | Mbira Mavembe (Gandanga), Zimbabwe, Low G | 24 | 候補 |
| Idiophones / Plucked Idiophones | Mbira dzaVadzimu Nyamaropa, Zimbabwe, Low B | 24 | **使用中**：mbira |
| Idiophones / Plucked Idiophones | Nyunga Nyunga, Mozambique, Low F | 19 | 候補 |
| Idiophones / Struck Idiophones | Agogo Bells | 15 | — |
| Idiophones / Struck Idiophones | Anvil | 9 | — |
| Idiophones / Struck Idiophones | Balafon | 54 | **使用中**：balafon |
| Idiophones / Struck Idiophones | Bell Tree | 11 | 候補 |
| Idiophones / Struck Idiophones | Bell Tree - Legacy | 5 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Idiophones / Struck Idiophones | Brake Drum | 17 | — |
| Idiophones / Struck Idiophones | Cabasa | 6 | — |
| Idiophones / Struck Idiophones | Cajon | 18 | **使用中**：cajon |
| Idiophones / Struck Idiophones | Claps | 10 | — |
| Idiophones / Struck Idiophones | Clash Cymbals 1 | 10 | — |
| Idiophones / Struck Idiophones | Clash Cymbals 2 | 5 | — |
| Idiophones / Struck Idiophones | Claves | 12 | 候補（石の打撃の近い代わり。石ではない） |
| Idiophones / Struck Idiophones | Cowbells | 13 | — |
| Idiophones / Struck Idiophones | Finger Cymbals | 1 | — |
| Idiophones / Struck Idiophones | Flexatone | 8 | — |
| Idiophones / Struck Idiophones | Glockenspiel | 18 | **使用中**：glockenspiel |
| Idiophones / Struck Idiophones | Gong 1 | 7 | **使用中**：gong |
| Idiophones / Struck Idiophones | Guiro | 14 | — |
| Idiophones / Struck Idiophones | Hand Bells, Nepalese | 3 | **使用中**：handBells |
| Idiophones / Struck Idiophones | Hand Chimes | 19 | 候補（柔らかなベルの置き換え先） |
| Idiophones / Struck Idiophones | Hi-Hat Cymbal | 15 | — |
| Idiophones / Struck Idiophones | Marimba | 30 | **使用中**：marimba |
| Idiophones / Struck Idiophones | Mark Trees | 6 | 候補（ウィンドチャイム。きらめき） |
| Idiophones / Struck Idiophones | Ratchet | 8 | — |
| Idiophones / Struck Idiophones | Shaker - Legacy | 2 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Idiophones / Struck Idiophones | Shaker, Large | 6 | — |
| Idiophones / Struck Idiophones | Shaker, Small | 16 | — |
| Idiophones / Struck Idiophones | Slapstick | 5 | — |
| Idiophones / Struck Idiophones | Sleigh Bells | 6 | — |
| Idiophones / Struck Idiophones | Slit Drum | 6 | **使用中**：slitDrum |
| Idiophones / Struck Idiophones | Suspended Cymbal 1 | 25 | — |
| Idiophones / Struck Idiophones | Suspended Cymbal 2 | 23 | — |
| Idiophones / Struck Idiophones | Tambourine 1 | 7 | — |
| Idiophones / Struck Idiophones | Tambourine 2 | 7 | — |
| Idiophones / Struck Idiophones | Tambourine 3 - Legacy | 4 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Idiophones / Struck Idiophones | Tambourine 4 - Legacy | 6 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Idiophones / Struck Idiophones | Tambourine 5 - Legacy | 9 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Idiophones / Struck Idiophones | Triangles | 63 | 候補（拍のアクセント） |
| Idiophones / Struck Idiophones | Tubular Bells 1 | 18 | 候補（別の個体） |
| Idiophones / Struck Idiophones | Tubular Bells 2 | 22 | **使用中**：tubularBells |
| Idiophones / Struck Idiophones | Tubular Glockenspiel | 27 | 候補 |
| Idiophones / Struck Idiophones | Vibraphone | 50 | **使用中**：vibes（Vibes_soft） |
| Idiophones / Struck Idiophones | Vibraslap | 4 | — |
| Idiophones / Struck Idiophones | Woodblock | 10 | 候補（同上） |
| Idiophones / Struck Idiophones | Xylophone | 48 | 候補 |
| Membranophones / Other Membranophones | Ocean Drum | 3 | 要判断（波の音をまねる楽器。自然録音と混同しない表示が必要） |
| Membranophones / Struck Membranophones | Bass Drum 1 | 8 | — |
| Membranophones / Struck Membranophones | Bass Drum 2 | 30 | 候補（ランダムキック・心拍の置き換え先） |
| Membranophones / Struck Membranophones | Bass Drum 3 - Legacy | 39 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Membranophones / Struck Membranophones | Bongos | 28 | — |
| Membranophones / Struck Membranophones | Conga | 34 | **使用中**：conga |
| Membranophones / Struck Membranophones | Darbuka | 20 | **使用中**：darbuka |
| Membranophones / Struck Membranophones | Frame Drum | 18 | **使用中**：frameDrum |
| Membranophones / Struck Membranophones | Legacy Snares | 108 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Membranophones / Struck Membranophones | Legacy Toms | 41 | 保留（旧版の収録。新版がある場合はそちらを優先） |
| Membranophones / Struck Membranophones | Snare Drum, Modern 1 | 29 | — |
| Membranophones / Struck Membranophones | Snare Drum, Modern 2 | 24 | — |
| Membranophones / Struck Membranophones | Snare Drum, Modern 3 | 19 | — |
| Membranophones / Struck Membranophones | Snare Drum, Rope Tension | 32 | — |
| Membranophones / Struck Membranophones | Timpani 1 | 40 | **使用中**：timpaniRoll |
| Membranophones / Struck Membranophones | Timpani 2 | 204 | 候補（別の個体） |
| Membranophones / Struck Membranophones | Tom 1 | 22 | — |
| Membranophones / Struck Membranophones | Tom 2 | 22 | — |
