// v0.68 スマートフォンでの入力欄（バックログ A：実機で困りそうな点）の回帰テスト。2026-11-13 自動実行で追加。python3 -m http.server 8765 で配信して実行する。
// 確認：幅 390px で、見えている選択欄・数値欄の文字が 16px 以上（iPhone Safari は 16px 未満の入力欄に触れると画面を拡大するため）。
// 地域フィルター（geoPanel）の選択欄が高さ 44px 以上。横にはみ出さない。広い画面（1024px）では従来の大きさのまま。コンソールエラー0。
// 実機（iPhone Safari）での拡大の有無は未検証（テストは計算後のスタイルで確かめる）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const errs=[];
const scan=pg=>pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);const o=[];
 for(const e of document.querySelectorAll('select,input[type=number],input[type=text],input[type=search],textarea')){const s=getComputedStyle(e),r=e.getBoundingClientRect();
  if(s.display==='none'||s.visibility==='hidden'||r.width<4||r.height<4||e.closest('[hidden],dialog:not([open])'))continue;
  o.push({id:e.id||e.className||e.tagName,fs:parseFloat(s.fontSize),h:Math.round(r.height),geo:!!e.closest('.geoGrid')})}
 return {o,sw:document.documentElement.scrollWidth}});
for(const [w,lang] of [[390,'ja'],[390,'en'],[1024,'ja']]){
 const cx=await b.newContext({viewport:{width:w,height:900}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
 await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(900);
 if(lang==='en'){await pg.evaluate(()=>__i18n.set('en'));await pg.waitForTimeout(300)}
 const s=await scan(pg);const k=w+lang;R[k]={n:s.o.length,sw:s.sw,minFs:Math.min(...s.o.map(x=>x.fs)),geoH:s.o.filter(x=>x.geo).map(x=>x.h)};
 ok(k+'_found',s.o.length>=10);ok(k+'_no_overflow',s.sw<=w);
 if(w===390){const small=s.o.filter(x=>x.fs<16);R[k].small=small.slice(0,5);ok(k+'_font16',small.length===0);
  const g=s.o.filter(x=>x.geo);ok(k+'_geo_found',g.length===5);ok(k+'_geo_tall',g.every(x=>x.h>=44))}
 else{ok(k+'_desktop_unchanged',s.o.some(x=>x.fs<16))}
 await cx.close()}
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
