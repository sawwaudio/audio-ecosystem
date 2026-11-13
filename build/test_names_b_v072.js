// バックログ B（学名・和名の照合）テーマ「日本のセミ5種」の回帰テスト。2026-11-14 自動実行で追加。python3 -m http.server 8765 で配信して実行する。
// 確認：台帳 data/recording_licenses.json の nameJa は典拠（nameJaSource）がある行だけ・和名は jp と一致・典拠に載る学名が台帳の latin と一致、
// latinCheck（GBIF の照合）の項目がそろう、ミンミンゼミは GBIF で異名（受理名 Hyalessa maculaticollis）と記録し画面の学名は変えていない、
// アプリ内の録音一覧（ae-recordings）の和名・学名が台帳と同じ、390px で横にはみ出さない・コンソールエラー0。
// 照合の内容（典拠の PDF・GBIF の応答）は 2026-11-13 に取得したもの。テストはネットにつながず、記録の整合だけを確かめる。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};
const led=JSON.parse(fs.readFileSync(__dirname+'/../data/recording_licenses.json','utf8'));const by=Object.fromEntries(led.map(r=>[r.id,r]));
const IDS={cicada:'アブラゼミ',higurashi:'ヒグラシ',niiniizemi:'ニイニイゼミ',tsukutsukuboshi:'ツクツクボウシ',minminzemi:'ミンミンゼミ'};
// 1. 典拠のない和名を書かない
const withJa=led.filter(r=>'nameJa' in r);R.withJa=withJa.map(r=>r.id);
ok('ja_only_with_source',withJa.every(r=>r.nameJaSource&&/^https:\/\//.test(r.nameJaSource.url)&&r.nameJaSource.title&&r.nameJaSource.checked));
ok('ja_set_exact',withJa.length===5&&Object.keys(IDS).every(id=>by[id]&&by[id].nameJa===IDS[id]));
// 2. 和名は jp と一致、典拠の学名は台帳の latin と一致
ok('ja_matches_jp',Object.keys(IDS).every(id=>by[id].jp===by[id].nameJa));
ok('source_latin',Object.keys(IDS).every(id=>by[id].nameJaSource.latinInSource===by[id].latin));
// 3. GBIF の照合の記録
ok('latin_check_fields',Object.keys(IDS).every(id=>{const c=by[id].latinCheck;return c&&/GBIF/.test(c.source)&&c.query===by[id].latin&&['ACCEPTED','SYNONYM'].includes(c.status)&&Number.isInteger(c.usageKey)&&c.checked}));
ok('accepted_four',['cicada','higurashi','niiniizemi','tsukutsukuboshi'].every(id=>by[id].latinCheck.status==='ACCEPTED'&&by[id].latinCheck.matchedName.startsWith(by[id].latin+' (')&&!by[id].latinCheck.acceptedName));
const mm=by.minminzemi;ok('minmin_synonym',mm.latinCheck.status==='SYNONYM'&&mm.latinCheck.acceptedName.startsWith('Hyalessa maculaticollis')&&mm.latin==='Oncotympana maculaticollis');
// 4. アプリ（ae-recordings）と台帳の一致・390px・エラー0
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const errs=[];
const cx=await b.newContext({viewport:{width:390,height:900}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(900);
const app=await pg.evaluate(ids=>{const rs=JSON.parse(document.getElementById('ae-recordings').textContent);return ids.map(id=>{const r=rs.find(x=>x.id===id);return r?{id,jp:r.jp,latin:r.latin}:{id,missing:true}})},Object.keys(IDS));R.app=app;
ok('app_matches_ledger',app.every(a=>!a.missing&&a.jp===by[a.id].jp&&a.latin===by[a.id].latin));
ok('no_overflow',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
