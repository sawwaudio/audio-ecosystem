// リールのテンプレート「自然」「ポップ」で、録画中の経過時間が「NaN:NaN」と描かれていた不具合（存在しない reelState.t0 を参照）の回帰テスト。
// 2026-11-08 自動実行で追加。python3 -m http.server 8765 で配信して実行する。canvas の fillText を横取りし、描いた文字を調べる。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await pg.addInitScript(()=>{const P=CanvasRenderingContext2D.prototype,f=P.fillText;window.__txt={nan:[],rec:[]};P.fillText=function(s,...a){const v=String(s);if(/NaN/.test(v)&&window.__txt.nan.length<20)window.__txt.nan.push(v);if(/^● \d\d:\d\d$/.test(v))window.__txt.rec.push(v);return f.call(this,s,...a)}});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
await pg.click('#play');await pg.waitForTimeout(2000);
for(const style of ['nature','pop']){
 await pg.evaluate(()=>{window.__txt.nan=[];window.__txt.rec=[]});
 const dl=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(s=>__reelDebug.start(3,{style:s}),style);await dl;await pg.waitForTimeout(300);
 const t=await pg.evaluate(()=>({nan:window.__txt.nan.slice(),rec:window.__txt.rec.slice(),style:__reelDebug.style()}));
 R[style]={nan:t.nan.slice(0,3),recN:t.rec.length,first:t.rec[0],last:t.rec[t.rec.length-1]};
 ok(style+'_style',t.style===style);ok(style+'_no_nan',t.nan.length===0);ok(style+'_rec_drawn',t.rec.length>=20);
 const secs=t.rec.map(s=>{const m=s.match(/(\d\d):(\d\d)$/);return +m[1]*60+ +m[2]});
 ok(style+'_rec_range',secs.length>0&&Math.min(...secs)===0&&Math.max(...secs)<=4&&secs.every((v,i)=>i===0||v>=secs[i-1]));
}
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
