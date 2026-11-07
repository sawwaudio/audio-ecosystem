// v0.62：BEAT FX「自律演奏の楽器を拍に合わせる」（DJ_MIXER_SPEC M2 のテンポの残り）の回帰テスト。
// オンにすると、自律演奏の実録音の楽器（打楽器・旋律）のフレーズが BEAT FX のテンポの8分の格子に乗ること、オフでは従来どおり（遅らせない）こと、
// 手で鳴らした音は遅らせないこと、プリセットに保存・読み込みできること、英語表示があることを確かめる。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:844}});await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const wait=ms=>pg.waitForTimeout(ms);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{['ae-lang'].forEach(k=>localStorage.removeItem(k))}catch(e){}});await pg.reload();await wait(900);
// 1. 画面：チェックは既定でオフ、押すと状態が変わる
R.ui=await pg.evaluate(()=>{const c=document.getElementById('fxGrid');return {has:!!c,checked:c&&c.checked,state:__fxDebug.state().grid,label:c&&c.parentElement.textContent}});
ok('ui',R.ui.has&&R.ui.checked===false&&R.ui.state===false&&/拍に合わせる/.test(R.ui.label));
// 2. 格子：120BPM → 8分＝0.25秒。オフなら時刻はそのまま、オン（自律演奏）なら次の格子、手で鳴らした音はそのまま
await pg.evaluate(()=>{const e=document.getElementById('fxBpm');e.value='120';e.dispatchEvent(new Event('change'))});
R.snapOff=await pg.evaluate(()=>__realDebug.snap(10.13,false));
await pg.evaluate(()=>{const c=document.getElementById('fxGrid');c.checked=true;c.dispatchEvent(new Event('change'))});
R.snapOn=await pg.evaluate(()=>({a:__realDebug.snap(10.13,false),b:__realDebug.snap(10.25,false),g:__realDebug.snap(10.13,true),state:__fxDebug.state().grid}));
ok('snap',Math.abs(R.snapOff-10.13)<1e-9&&Math.abs(R.snapOn.a-10.25)<1e-9&&Math.abs(R.snapOn.b-10.25)<1e-9&&Math.abs(R.snapOn.g-10.13)<1e-9&&R.snapOn.state===true);
// 3. 実際に鳴らす：自律演奏中に旋律（カリンバ）と打楽器（フレームドラム）を鳴らし、始まりの時刻がすべて 0.25 秒の整数倍
const setP=(k,v)=>pg.evaluate(([k,v])=>{const el=document.getElementById('param-'+k);el.value=v;el.dispatchEvent(new Event('input'))},[k,v]);
await pg.click('#play');await wait(1200);
const onGrid=ts=>ts.length>0&&ts.every(t=>{const r=t/.25;return Math.abs(r-Math.round(r))<1e-6});
R.play={};for(const k of ['kalimba','frameDrum']){await setP(k,70);let st=[];for(let i=0;i<60&&!st.length;i++){if(i%15===0)await pg.evaluate(k=>__realDebug.hit(k),k);await wait(100);st=await pg.evaluate(k=>__realDebug.starts().filter(v=>v.k===k).map(v=>v.t),k)}
 R.play[k]={n:st.length,grid:onGrid(st),t:st.slice(0,4)};await setP(k,0)}
ok('on_grid',Object.values(R.play).every(v=>v.n>0&&v.grid));
// 4. オフに戻すと格子に乗せない（時刻 0.05 秒先がそのまま）
await pg.evaluate(()=>{const c=document.getElementById('fxGrid');c.checked=false;c.dispatchEvent(new Event('change'))});
R.offState=await pg.evaluate(()=>({s:__fxDebug.state().grid,v:__realDebug.snap(3.3,false)}));ok('off_again',R.offState.s===false&&Math.abs(R.offState.v-3.3)<1e-9);
await pg.click('#play');await wait(300);
// 5. プリセット：書き出しに grid が入り、読み込みで戻る。不正な値は拒否
await pg.evaluate(()=>{const c=document.getElementById('fxGrid');c.checked=true;c.dispatchEvent(new Event('change'))});
R.preset=await pg.evaluate(()=>{const d=__presetDebug.exportData();return d.beatFx?d.beatFx.grid:'none'});
ok('preset_export',R.preset===true);
R.parse=await pg.evaluate(()=>{const r={};const d=__presetDebug.exportData();
 const bad=JSON.parse(JSON.stringify(d));bad.beatFx.grid='yes';try{__presetDebug.apply(bad);r.bad='accepted'}catch(e){r.bad='rejected'}r.afterBad=__fxDebug.state().grid;
 const good=JSON.parse(JSON.stringify(d));good.beatFx.grid=false;try{__presetDebug.apply(good)}catch(e){r.apply='ERR '+e.message}
 r.after=__fxDebug.state().grid;r.box=document.getElementById('fxGrid').checked;return r});
ok('preset_roundtrip',R.parse.bad==='rejected'&&R.parse.afterBad===true&&!R.parse.apply&&R.parse.after===false&&R.parse.box===false);
// 6. 英語表示
await pg.click('#langToggle');await wait(300);R.en=await pg.evaluate(()=>document.getElementById('fxGrid').parentElement.textContent.trim());ok('english',R.en==='Lock the autonomous instruments to the beat');
await pg.click('#langToggle');await wait(200);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
