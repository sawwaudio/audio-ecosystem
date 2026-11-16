// バックログ B（学名・和名の照合）テーマ「カジカガエル」（kajika-frog）の回帰テスト。2026-11-15 自動実行で追加。
// python3 -m http.server 8765 で配信して実行する。
// 確認：nameJa は典拠（国立科学博物館「両生類日本固有種目録（2018年2月版）」）がある行だけ・和名は jp と一致・典拠の学名は台帳の latin と一致、
// 学会の標準和名リストは未照合と明記・目録の分布を録音地と混同しない注記、GBIF の照合の記録、
// トノサマバッタ（locust）は学名だけ照合して nameJa を付けない（典拠未取得）、アプリ内の録音一覧（ae-recordings）の和名・学名が台帳と同じ、
// 390px・英語表示で横にはみ出さない・コンソールエラー0。照合の内容は 2026-11-15 に取得したもの。テストはネットにつながず、記録の整合だけを確かめる。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};
const led=JSON.parse(fs.readFileSync(__dirname+'/../data/recording_licenses.json','utf8'));const by=Object.fromEntries(led.map(r=>[r.id,r]));
const k=by['kajika-frog'],l=by['locust'];
ok('rows_exist',k&&l);
ok('ja_only_with_source',led.filter(r=>'nameJa' in r).every(r=>r.nameJaSource&&/^https:\/\//.test(r.nameJaSource.url)&&r.nameJaSource.title&&r.nameJaSource.checked));
ok('kajika_ja',k.nameJa==='カジカガエル'&&k.jp===k.nameJa);
ok('kajika_source',/両生類日本固有種目録/.test(k.nameJaSource.title)&&/kahaku\.go\.jp/.test(k.nameJaSource.url)&&k.nameJaSource.latinInSource===k.latin&&/カジカガエル Buergeria buergeri/.test(k.nameJaSource.entry));
ok('hsj_unverified_noted',/標準和名リスト.*未照合/.test(k.nameJaSource.note));
ok('range_not_location',/録音地ではない/.test(k.nameJaSource.note)&&k.location==='原本に記載なし');
const g=c=>c&&/GBIF/.test(c.source)&&c.status==='ACCEPTED'&&c.matchType==='EXACT'&&Number.isInteger(c.usageKey)&&c.checked;
ok('gbif_kajika',g(k.latinCheck)&&k.latinCheck.query===k.latin&&k.latinCheck.matchedName.startsWith(k.latin+' '));
ok('gbif_locust',g(l.latinCheck)&&l.latinCheck.query===l.latin&&l.latinCheck.matchedName.startsWith(l.latin+' '));
// 2026-11-16 自動実行：トノサマバッタの和名の典拠を照合して nameJa を付けたため、典拠の記録があることを確かめる形に変更（詳しくは test_names_locust_v077.js）。
ok('locust_no_ja',('nameJa' in l)?(l.nameJa===l.jp&&l.nameJaSource&&l.nameJaSource.latinInSource===l.latin):/典拠は未取得/.test(l.latinCheck.note));
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const errs=[];
const cx=await b.newContext({viewport:{width:390,height:900}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(900);
const ids=['kajika-frog','locust'];
const app=await pg.evaluate(ids=>{const rs=JSON.parse(document.getElementById('ae-recordings').textContent);return ids.map(id=>{const r=rs.find(x=>x.id===id);return r?{id,jp:r.jp,latin:r.latin}:{id,missing:true}})},ids);R.app=app;
ok('app_matches_ledger',app.every(a=>!a.missing&&a.jp===by[a.id].jp&&a.latin===by[a.id].latin));
ok('no_overflow_ja',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
await pg.goto('http://localhost:8765/index.html?lang=en');await pg.waitForTimeout(900);
ok('no_overflow_en',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
