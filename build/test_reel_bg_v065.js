// v0.65 リール録画中にタブが裏に回った時の描画停止の対策（バックログ 2④）の回帰テスト。python3 -m http.server 8765 で配信して実行する。
// 裏のタブを、document.hidden を true にして visibilitychange を送り、requestAnimationFrame を止めることで再現する（実際のタブ切り替え・実機は未検証）。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
const msg=()=>pg.evaluate(()=>document.getElementById('message').innerText);
await pg.click('#play');await pg.waitForTimeout(2500);
// 1. 表のタブのまま：rAF で描き、Worker の時計は代わりに描かない。裏の案内は出ない。
let dlP=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(()=>__reelDebug.start(3));await pg.waitForTimeout(500);
let s=await pg.evaluate(()=>__reelDebug.state());R.tickKind=s.tick;ok('tick_worker',s.tick==='worker');
await dlP;await pg.waitForTimeout(400);s=await pg.evaluate(()=>__reelDebug.state());R.visible={frames:s.result.frames,tickFrames:s.result.tickFrames,hiddenSec:s.result.hiddenSec};
ok('visible_frames',s.result.frames>=45);ok('visible_no_tick_draw',s.result.tickFrames<=3);ok('visible_no_hidden',s.result.hiddenSec===0&&s.result.hiddenCount===0);
ok('visible_no_msg',!(await msg()).includes('タブが裏に回って'));
// 2. 録画中に裏へ：rAF を止め、document.hidden=true。Worker の時計で描き続ける。
dlP=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(()=>__reelDebug.start(5));await pg.waitForTimeout(800);
await pg.evaluate(()=>{window.__rafOrig=window.requestAnimationFrame;window.requestAnimationFrame=()=>0;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))});
const f0=(await pg.evaluate(()=>__reelDebug.state())).frames;await pg.waitForTimeout(2000);const s1=await pg.evaluate(()=>__reelDebug.state());
R.hiddenDrawn=s1.frames-f0;ok('hidden_keeps_drawing',R.hiddenDrawn>=30);ok('hidden_tick_frames',s1.tickFrames>=30);
ok('status_updates',/● REC [2-5] \/ 5 SEC/.test(await pg.evaluate(()=>document.getElementById('reelStatus').textContent)));
await pg.evaluate(()=>{window.requestAnimationFrame=window.__rafOrig;delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))});
ok('restored_visible',await pg.evaluate(()=>document.hidden===false));
await dlP;await pg.waitForTimeout(400);s=await pg.evaluate(()=>__reelDebug.state());R.hidden={frames:s.result.frames,tickFrames:s.result.tickFrames,hiddenSec:s.result.hiddenSec,count:s.result.hiddenCount};
ok('hidden_sec',s.result.hiddenSec>1.5&&s.result.hiddenSec<3.5&&s.result.hiddenCount===1);ok('hidden_total_frames',s.result.frames>=100);
R.msg=await msg();ok('hidden_msg',/録画中にタブが裏に回っていました（約[23]秒）/.test(R.msg)&&R.msg.includes('リール動画を書き出しました'));
// 3. 英語表示
await pg.evaluate(()=>__i18n.set('en'));await pg.waitForTimeout(300);R.msgEn=await msg();ok('hidden_msg_en',/background for about [23] s while recording/.test(R.msgEn)&&!/[぀-ヿ一-鿿]/.test(R.msgEn));
await pg.evaluate(()=>__i18n.set('ja'));
// 4. 書き出し後は時計が止まる（録画していない時は描かない）
const fz=(await pg.evaluate(()=>__reelDebug.state())).frames;await pg.waitForTimeout(600);ok('tick_stopped',(await pg.evaluate(()=>__reelDebug.state())).frames===fz);
// 5. 辞書の同一性
const src=fs.readFileSync(__dirname+'/src_i18n.js','utf8'),html=fs.readFileSync(__dirname+'/../index.html','utf8');const m=src.match(/ \[\/\^録画中にタブが裏に回っていました[^\n]*\n/);ok('i18n_parity',!!m&&html.includes(m[0]));
ok('version',await pg.evaluate(()=>document.title.includes('v0.65')));
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
