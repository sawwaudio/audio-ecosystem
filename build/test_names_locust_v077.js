// バックログ B（学名・和名の照合）テーマ「トノサマバッタの和名の典拠」（locust）の回帰テスト。2026-11-16 自動実行で追加。
// python3 -m http.server 8765 で配信して実行する。
// 確認：nameJa は典拠がある行だけ・和名は jp と一致・典拠の学名は台帳の latin と一致、典拠（林野庁 東北森林管理局の図鑑）と裏付け（百科事典2つ）の URL・取得日、
// 標準和名の目録ではないこと・九州大学 MOKUROKU と日本直翅類学会は未照合であること・図鑑の地域を録音地と混同しない注記、
// GBIF の照合（latinCheck）の記録と note の更新、アプリ内の録音一覧（ae-recordings）の和名・学名が台帳と同じ、390px の日英で横にはみ出さない・コンソールエラー0。
// 照合の内容は 2026-11-16 に取得したもの。テストはネットにつながず、記録の整合だけを確かめる。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};
const led=JSON.parse(fs.readFileSync(__dirname+'/../data/recording_licenses.json','utf8'));const by=Object.fromEntries(led.map(r=>[r.id,r]));
const l=by['locust'];ok('row_exists',!!l);const s=l.nameJaSource||{};
ok('ja_only_with_source',led.filter(r=>'nameJa' in r).every(r=>r.nameJaSource&&/^https:\/\//.test(r.nameJaSource.url)&&r.nameJaSource.title&&r.nameJaSource.checked));
ok('locust_ja',l.nameJa==='トノサマバッタ'&&l.jp===l.nameJa&&l.latin==='Locusta migratoria');
ok('source',/東北森林管理局/.test(s.title)&&/^https:\/\/www\.rinya\.maff\.go\.jp\//.test(s.url)&&s.latinInSource===l.latin&&/^トノサマバッタ Locusta migratoria/.test(s.entry)&&/バッタ科/.test(s.entry)&&s.checked==='2026-11-16');
ok('corroboration',Array.isArray(s.corroboration)&&s.corroboration.length>=2&&s.corroboration.every(c=>/^https:\/\//.test(c.url)&&c.latinInSource===l.latin&&c.checked&&/バッタ科/.test(c.entry)));
ok('not_standard_list_noted',/標準和名の目録ではない/.test(s.note)&&/MOKUROKU.*未照合|未照合/.test(s.note)&&/日本直翅類学会/.test(s.note));
ok('region_not_location',/録音地ではない/.test(s.note)&&/不明/.test(l.location));
ok('author_from_gbif',/命名者・年は GBIF/.test(s.note));
const g=l.latinCheck;ok('gbif',g&&/GBIF/.test(g.source)&&g.status==='ACCEPTED'&&g.matchType==='EXACT'&&g.matchedName.startsWith(l.latin+' ')&&g.family==='Acrididae'&&!/典拠は未取得/.test(g.note));
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const errs=[];
const cx=await b.newContext({viewport:{width:390,height:900}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(900);
const app=await pg.evaluate(()=>{const rs=JSON.parse(document.getElementById('ae-recordings').textContent);const r=rs.find(x=>x.id==='locust');return r?{jp:r.jp,latin:r.latin}:null});R.app=app;
ok('app_matches_ledger',app&&app.jp===l.jp&&app.latin===l.latin);
await pg.evaluate(()=>__i18n.set('ja'));await pg.waitForTimeout(300);ok('no_overflow_ja',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
await pg.evaluate(()=>__i18n.set('en'));await pg.waitForTimeout(300);ok('no_overflow_en',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
