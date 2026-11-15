// バックログ B（学名・和名の照合）テーマ「日本の鳥5種」（ウグイス・ホトトギス・ヒヨドリ・スズメ・ツバメ、録音6行）の回帰テスト。2026-11-14 自動実行で追加（2026-11-15 本体に反映）。
// python3 -m http.server 8765 で配信して実行する。
// 確認：nameJa は典拠（日本鳥学会『日本鳥類目録 改訂第7版』）がある行だけ・jp は和名で始まる（「ヒヨドリ（伊豆）」など地名の補足は残す）、
// 典拠の学名は台帳の latin と一致（ウグイスだけ典拠は Cettia diphone、台帳は GBIF の受理名 Horornis diphone で、異名の記録がある）、
// GBIF の照合の記録、第8版は未照合と明記、アプリ内の録音一覧（ae-recordings）の和名・学名が台帳と同じ（画面の学名は変えていない）、
// 390px・英語表示で横にはみ出さない・コンソールエラー0。照合の内容は 2026-11-14 に取得したもの。テストはネットにつながず、記録の整合だけを確かめる。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};
const led=JSON.parse(fs.readFileSync(__dirname+'/../data/recording_licenses.json','utf8'));const by=Object.fromEntries(led.map(r=>[r.id,r]));
const IDS={'japanese-bush-warbler':'ウグイス','uguisu-yokohama':'ウグイス',hototogisu:'ホトトギス','brown-eared-bulbul':'ヒヨドリ',sparrow:'スズメ',swallow:'ツバメ'};
const ids=Object.keys(IDS);
ok('rows_exist',ids.every(id=>by[id]));
ok('ja_only_with_source',led.filter(r=>'nameJa' in r).every(r=>r.nameJaSource&&/^https:\/\//.test(r.nameJaSource.url)&&r.nameJaSource.title&&r.nameJaSource.checked));
ok('ja_values',ids.every(id=>by[id].nameJa===IDS[id]&&by[id].jp.startsWith(IDS[id])));
ok('source_is_osj7',ids.every(id=>/日本鳥類目録 改訂第7版/.test(by[id].nameJaSource.title)&&/ornithology\.jp/.test(by[id].nameJaSource.url)&&/^\d+\. /.test(by[id].nameJaSource.entry)));
ok('osj8_unverified_noted',ids.every(id=>/第8版.*未照合/.test(by[id].nameJaSource.note)));
const uguisu=['japanese-bush-warbler','uguisu-yokohama'];
ok('source_latin',ids.filter(id=>!uguisu.includes(id)).every(id=>by[id].nameJaSource.latinInSource===by[id].latin));
ok('uguisu_cettia',uguisu.every(id=>by[id].latin==='Horornis diphone'&&by[id].nameJaSource.latinInSource==='Cettia diphone'&&/異名/.test(by[id].nameJaSource.note)
  &&by[id].latinCheck.sourceNameCheck&&by[id].latinCheck.sourceNameCheck.status==='SYNONYM'&&by[id].latinCheck.sourceNameCheck.acceptedUsageKey===by[id].latinCheck.usageKey));
ok('gbif_accepted',ids.every(id=>{const c=by[id].latinCheck;return c&&/GBIF/.test(c.source)&&c.query===by[id].latin&&c.status==='ACCEPTED'&&c.matchType==='EXACT'&&Number.isInteger(c.usageKey)&&c.matchedName.startsWith(by[id].latin+' ')&&c.checked}));
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const errs=[];
const cx=await b.newContext({viewport:{width:390,height:900}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(900);
const app=await pg.evaluate(ids=>{const rs=JSON.parse(document.getElementById('ae-recordings').textContent);return ids.map(id=>{const r=rs.find(x=>x.id===id);return r?{id,jp:r.jp,latin:r.latin}:{id,missing:true}})},ids);R.app=app;
ok('app_matches_ledger',app.every(a=>!a.missing&&a.jp===by[a.id].jp&&a.latin===by[a.id].latin));
ok('no_overflow_ja',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
await pg.goto('http://localhost:8765/index.html?lang=en');await pg.waitForTimeout(900);
ok('no_overflow_en',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
