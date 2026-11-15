// 押しやすさ（バックログ A：実機で困りそうな点）の回帰テスト。2026-11-16 自動実行で追加。python3 -m http.server 8765 で配信して実行する。
// 確認：幅 390px（日本語・英語）で、見えている開閉の見出し（details > summary、ⓘ 詳しく を含む）の高さが 44px 以上、
// チェックボックスが 22px 以上、チェックボックスを含むラベル（押せる範囲）の高さが 44px 以上。横にはみ出さない。
// 広い画面（1024px）では従来の大きさのまま（見出しに 44px 未満が残る）。コンソールエラー0。
// 44px は Apple の Human Interface Guidelines の推奨の大きさ。実機（iPhone Safari）での押しやすさは未検証（テストは計算後の大きさで確かめる）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const errs=[];
const scan=pg=>pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);
 const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return !(s.display==='none'||s.visibility==='hidden'||r.width<4||r.height<4||e.closest('[hidden],dialog:not([open])'))};
 const sm=[],cb=[],lb=[];
 for(const e of document.querySelectorAll('details>summary'))if(vis(e))sm.push({t:e.textContent.trim().slice(0,24),h:Math.round(e.getBoundingClientRect().height)});
 for(const e of document.querySelectorAll('input[type=checkbox]')){if(!vis(e))continue;const r=e.getBoundingClientRect();cb.push({id:e.id,w:Math.round(r.width),h:Math.round(r.height)});
  const l=e.closest('label');if(l&&vis(l))lb.push({id:e.id,h:Math.round(l.getBoundingClientRect().height)})}
 return {sm,cb,lb,sw:document.documentElement.scrollWidth}});
for(const [w,lang] of [[390,'ja'],[390,'en'],[1024,'ja']]){
 const cx=await b.newContext({viewport:{width:w,height:900}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
 await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(900);
 await pg.evaluate(l=>__i18n.set(l),lang);await pg.waitForTimeout(300);
 const s=await scan(pg);const k=w+lang;R[k]={summaries:s.sm.length,checkboxes:s.cb.length,labels:s.lb.length,sw:s.sw};
 ok(k+'_found',s.sm.length>=15&&s.cb.length>=8&&s.lb.length>=8);ok(k+'_no_overflow',s.sw<=w);
 if(w===390){const a=s.sm.filter(x=>x.h<44),c=s.cb.filter(x=>x.w<22||x.h<22),d=s.lb.filter(x=>x.h<44);R[k].small=[...a,...c,...d].slice(0,6);
  ok(k+'_summary44',a.length===0);ok(k+'_checkbox22',c.length===0);ok(k+'_label44',d.length===0)}
 else{ok(k+'_desktop_unchanged',s.sm.some(x=>x.h<44)&&s.cb.some(x=>x.w<22))}
 await cx.close()}
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
