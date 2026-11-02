// v0.36 ミキサー M2（拍に同期するエフェクト）の回帰テスト（docs/DJ_MIXER_SPEC.md）。
// 音の確認は、ページ内の OfflineAudioContext で本番と同じ makeFx／fxApplyInst に試験信号を通して、サンプル単位で測る。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
// 画面
R.ui=await pg.evaluate(()=>({types:[...document.querySelectorAll('#fxType option')].map(o=>o.value),targets:[...document.querySelectorAll('#fxTarget option')].map(o=>o.value),beats:[...document.querySelectorAll('#fxBeats button')].map(x=>x.textContent),status:document.getElementById('fxStatus').textContent,inMixer:!!document.querySelector('#mixerSection #fxPanel')}));
ok('ui',R.ui.types.join()==='delay,echo,pingpong,reverb,flanger,phaser,sweep,roll,gate,crush'&&R.ui.targets.join()==='master,bio,field,music,sampler'&&R.ui.beats.join()==='1/8,1/4,1/2,1,2,4'&&R.ui.status==='オフ'&&R.ui.inMixer);
const render=o=>pg.evaluate(o=>__fxDebug.render(o),o);
const maxAbs=a=>a.reduce((m,v)=>Math.max(m,Math.abs(v)),0),energy=a=>a.reduce((m,v)=>m+v*v,0);
// 120BPM・1/2拍＝0.25秒＝12000サンプル
const B=12000;R.cal=await pg.evaluate(()=>__fxDebug.cal());ok('calibrated',R.cal.measured);
// 1) オフ（差し込んだだけ）は原音と完全に同じ
const by=await render({type:'echo',on:false,input:'chirp',dur:.5});R.bypassErr=maxAbs(by.L.map((v,i)=>v-by.inL[i]));ok('bypass_identical',R.bypassErr<1e-6);
// 2) ディレイ：0.25秒ごとに 1 → 0.38 → 0.144
const dl=await render({type:'delay',dur:.8});R.delay={d0:dl.L[0],e1:dl.L[B],e2:dl.L[2*B],e3:dl.L[3*B],gap:maxAbs(dl.L.slice(10,B-10))};
ok('delay',Math.abs(R.delay.d0-1)<1e-3&&Math.abs(R.delay.e1-1)<.01&&Math.abs(R.delay.e2-.38)<.01&&Math.abs(R.delay.e3-.1444)<.01&&R.delay.gap<1e-3);
// 3) エコー：1回目はそのまま、2回目以降はだんだん暗く（高域が削られて山が低く広がる）・弱くなる
const ec=await render({type:'echo',dur:1.1});const win=(a,c)=>a.slice(c-20,c+600);R.echo={e1:ec.L[B],p2:maxAbs(win(ec.L,2*B)),p3:maxAbs(win(ec.L,3*B)),E2:energy(win(ec.L,2*B)),E3:energy(win(ec.L,3*B))};
ok('echo',Math.abs(R.echo.e1-1)<.01&&R.echo.p2<.62*.9&&R.echo.p3<R.echo.p2*.8&&R.echo.E3<R.echo.E2&&R.echo.E3>0);
// 4) ピンポンディレイ：左のインパルス → 1回目は左だけ、2回目は右だけ、3回目は左（0.5倍ずつ）
const pp=await render({type:'pingpong',input:'impulseL',dur:.8});R.ping={L1:pp.L[B],R1:pp.R[B],L2:pp.L[2*B],R2:pp.R[2*B],L3:pp.L[3*B],R3:pp.R[3*B]};
ok('pingpong',Math.abs(R.ping.L1-.5)<.01&&Math.abs(R.ping.R1)<1e-3&&Math.abs(R.ping.L2)<1e-3&&Math.abs(R.ping.R2-.5)<.01&&Math.abs(R.ping.L3-.25)<.01&&Math.abs(R.ping.R3)<1e-3);
// 5) リバーブ：残響は拍の2倍（0.5秒）で終わる
const rv=await render({type:'reverb',dur:1});R.reverb={tail:energy(rv.L.slice(2400,2*B)),after:maxAbs(rv.L.slice(2*B+2400))};ok('reverb',R.reverb.tail>1e-4&&R.reverb.after<2e-3);
// 6) フランジャー・フェイザー・フィルタースイープ：音が変わり、発散しない
R.mod={};for(const t of ['flanger','phaser','sweep']){const r=await render({type:t,input:'noise',dur:1});const diff=Math.sqrt(energy(r.L.map((v,i)=>v-r.inL[i]))/energy(r.inL));R.mod[t]={diff:+diff.toFixed(3),peak:+maxAbs(r.L).toFixed(3)};ok(t,diff>.1&&R.mod[t].peak<4&&r.L.every(Number.isFinite))}
// フィルタースイープは拍の周期で明るさが変わる（1拍＝0.5秒の前半と後半で高域の量が違う）
const sw=await render({type:'sweep',input:'noise',beats:1,dur:1});const hf=a=>{let e=0;for(let i=1;i<a.length;i++)e+=(a[i]-a[i-1])**2;return e};R.sweepHf=[hf(sw.L.slice(0,12000)),hf(sw.L.slice(12000,24000))].map(v=>+v.toFixed(2));ok('sweep_moves',Math.max(...R.sweepHf)/Math.min(...R.sweepHf)>1.5);
// 7) ロール：1.0秒で押すと、直前の1/2拍（0.75〜1.0秒）をそのまま繰り返す（サンプル一致）
const rl=await render({type:'roll',input:'chirp',engageAt:1,dur:1.75});let err=0;for(let k=0;k<36000;k++)err=Math.max(err,Math.abs(rl.L[48000+k]-rl.inL[36000+(k%B)]));R.rollErr=err;R.rollBefore=maxAbs(rl.L.slice(0,47900).map((v,i)=>v-rl.inL[i]));
ok('roll',R.rollErr<1e-4&&R.rollBefore<1e-6);
// 7b) トランスゲート（v0.39）：120BPM・1/2拍＝0.25秒ごとに、前半0.125秒だけ鳴り、後半は無音（ドライ0）。差し込んだだけ（オフ）は原音と一致
const rms=a=>Math.sqrt(energy(a)/a.length);const tg=await render({type:'gate',input:'tone',dur:1});R.gate=[];for(let w=0;w<8;w++)R.gate.push(+rms(tg.L.slice(w*6000,(w+1)*6000)).toFixed(4));
ok('gate',R.gate.every((v,i)=>i%2===0?Math.abs(v-.3536)<.01:v<1e-4));
const tg1=await render({type:'gate',input:'tone',beats:1,dur:1});R.gate1=[0,1,2,3].map(w=>+rms(tg1.L.slice(w*12000,(w+1)*12000)).toFixed(4));ok('gate_beat',R.gate1[0]>.3&&R.gate1[1]<1e-4&&R.gate1[2]>.3&&R.gate1[3]<1e-4);
const tgh=await render({type:'gate',input:'tone',depth:.5,dur:.5});R.gateHalf=[+rms(tgh.L.slice(0,6000)).toFixed(4),+rms(tgh.L.slice(6000,12000)).toFixed(4)];ok('gate_drywet',Math.abs(R.gateHalf[0]-.3536)<.01&&Math.abs(R.gateHalf[1]-.1768)<.01);
// 7c) ビットクラッシュ（v0.39）：6サンプルごとに値を保持（サンプルレート1/6）し、6ビットの段（1/32刻み）に丸める。オフは原音と一致
const cr=await render({type:'crush',input:'tone',dur:.25});let held=0,grid=0,n=0;for(let i=6;i<12000;i++){n++;if(Math.abs(cr.L[i]-cr.L[i-(i%6)])<1e-6)held++;if(Math.abs(cr.L[i]*32-Math.round(cr.L[i]*32))<1e-3)grid++}
R.crush={hold:+(held/n).toFixed(4),grid:+(grid/n).toFixed(4),diff:+Math.sqrt(energy(cr.L.map((v,i)=>v-cr.inL[i]))/energy(cr.inL)).toFixed(3),peak:+maxAbs(cr.L).toFixed(4)};
ok('crush',R.crush.hold>.999&&R.crush.grid>.9&&R.crush.diff>.05&&R.crush.peak<=.5+1/64+1e-6);
for(const t of ['gate','crush']){const o=await render({type:t,input:'chirp',on:false,dur:.5});R[t+'Bypass']=maxAbs(o.L.map((v,i)=>v-o.inL[i]));ok(t+'_bypass',R[t+'Bypass']<1e-6)}
// 8) 操作：拍・テンポ（TAP）・ドライ／ウェット
await pg.evaluate(()=>document.getElementById('mixerSection').open=true);
await pg.click('#fxBeats button:nth-child(4)');R.beats=await pg.evaluate(()=>__fxDebug.state().beats);ok('beat_button',R.beats===1);
// TAP：ページ内で 0.5 秒間隔に5回押す（Playwright のクリック間隔は揺れるため）→ 120BPM 前後
await pg.evaluate(async()=>{const t=document.getElementById('fxTap');for(let i=0;i<5;i++){t.click();if(i<4)await new Promise(r=>setTimeout(r,500))}});
R.tapBpm=await pg.evaluate(()=>__fxDebug.state().bpm);ok('tap_tempo',R.tapBpm>=114&&R.tapBpm<=121);
await pg.fill('#fxBpm','120');await pg.locator('#fxBpm').dispatchEvent('change');R.bpm=await pg.evaluate(()=>({bpm:__fxDebug.state().bpm,sec:__fxDebug.beatSec()}));ok('bpm_input',R.bpm.bpm===120&&Math.abs(R.bpm.sec-.5)<1e-9);
await pg.fill('#fxBpm','999');await pg.locator('#fxBpm').dispatchEvent('change');R.bpmClamp=await pg.evaluate(()=>__fxDebug.state().bpm);ok('bpm_clamp',R.bpmClamp===200);await pg.fill('#fxBpm','120');await pg.locator('#fxBpm').dispatchEvent('change');await pg.locator('#fxBpm').blur();
// 9) 実演奏：マスターにかける → 差し込み・音が出る・状態表示。かける先を環境音に変える → 環境音の全レーンに差し込み、マスターから外れる
await pg.click('#play');await pg.waitForTimeout(6000);
await pg.selectOption('#fxType','echo');await pg.click('#fxOn');await pg.waitForTimeout(1500);
R.live1=await pg.evaluate(()=>({st:__fxDebug.state(),status:document.getElementById('fxStatus').textContent,peak:Math.max(...Array.from({length:10},()=>__mixerDebug.peakDb('master')))}));
ok('live_master',R.live1.st.inserted.join()==='master'&&R.live1.status==='オン：エコー · 1拍（0.50秒）→ マスター');
let pk=-Infinity;for(let i=0;i<20;i++){pk=Math.max(pk,await pg.evaluate(()=>__mixerDebug.peakDb('master')));await pg.waitForTimeout(50)}R.livePeak=pk;ok('live_sound',pk>-80&&pk<=0.5);
await pg.selectOption('#fxTarget','field');await pg.waitForTimeout(300);R.live2=await pg.evaluate(()=>__fxDebug.state().inserted.sort());ok('live_channel',R.live2.length>=2&&R.live2.every(k=>k.startsWith('field:'))&&R.live2.includes('field:dry')&&R.live2.includes('field:wet'));
await pg.click('#fxOn');R.offState=await pg.evaluate(()=>__fxDebug.state());ok('off',!R.offState.on&&R.offState.inserted.length>=2);
// 9b) 実演奏：10種類すべてを順に切り替え → エラーなし・マスターのピークが 0dBFS を超えない・オフで経路が残る（v0.39）
await pg.selectOption('#fxTarget','master');await pg.click('#fxOn');R.allTypes={};
for(const t of ['delay','echo','pingpong','reverb','flanger','phaser','sweep','roll','gate','crush']){await pg.selectOption('#fxType',t);let mx=-Infinity;for(let i=0;i<8;i++){mx=Math.max(mx,await pg.evaluate(()=>__mixerDebug.peakDb('master')));await pg.waitForTimeout(60)}R.allTypes[t]={peak:+mx.toFixed(2),ins:(await pg.evaluate(()=>__fxDebug.state().inserted)).join()}}
ok('all_types_live',Object.values(R.allTypes).every(v=>v.peak<=0&&v.ins==='master'));
await pg.selectOption('#fxType','crush');await pg.selectOption('#fxTarget','music');await pg.waitForTimeout(200);R.crushMusic=await pg.evaluate(()=>__fxDebug.state().inserted.sort());ok('crush_channel',R.crushMusic.length>=2&&R.crushMusic.every(k=>k.startsWith('music:')));
await pg.click('#fxOn');
// 10) 押している間だけ（ロール）
await pg.selectOption('#fxType','roll');await pg.selectOption('#fxTarget','master');const hold=pg.locator('#fxHold');await hold.scrollIntoViewIfNeeded();const hb=await hold.boundingBox();
await pg.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await pg.mouse.down();await pg.waitForTimeout(400);R.holdDown=await pg.evaluate(()=>__fxDebug.state());await pg.mouse.up();await pg.waitForTimeout(100);R.holdUp=await pg.evaluate(()=>__fxDebug.state());
ok('hold',R.holdDown.held&&R.holdDown.engaged&&R.holdDown.inserted.join()==='master'&&!R.holdUp.held&&!R.holdUp.engaged);
await hold.focus();await pg.keyboard.down('Space');R.kbdHold=await pg.evaluate(()=>__fxDebug.state().held);await pg.keyboard.up('Space');R.kbdRelease=await pg.evaluate(()=>__fxDebug.state().held);ok('hold_keyboard',R.kbdHold===true&&R.kbdRelease===false);
// ミキサー M1 は引き続き動く（レーン・ミュート）
R.lanes=await pg.evaluate(()=>__mixerDebug.lanes());ok('mixer_lanes',['bio','field','music','sampler'].every(c=>R.lanes[c].includes('dry')&&R.lanes[c].includes('wet'))&&R.lanes.music.includes('direct'));
// 11) 英語表示・画面幅・エラー
await pg.click('#fxOn');await pg.click('#langToggle');await pg.waitForTimeout(400);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.en=await pg.evaluate(()=>({opt:document.querySelector('#fxType option[value="pingpong"]').textContent,status:document.getElementById('fxStatus').textContent,hold:document.getElementById('fxHold').textContent}));
ok('english',R.en.opt==='Ping-pong delay'&&/^On: Roll · 1 beat \(0\.50 s\) → Master$/.test(R.en.status)&&R.en.hold==='Hold to apply');
await pg.click('#fxOn');
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
