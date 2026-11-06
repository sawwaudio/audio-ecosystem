// v0.42 ミキサー M4（サンプラー／スライサー）の回帰テスト（docs/DJ_MIXER_SPEC.md）。python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
// 音の確認は、ページ内の OfflineAudioContext で本番と同じ smpSlice／smpReversed／smpVoice に試験信号を通して、サンプル単位で測る。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
// 1) 画面：サンプラー欄（ミキサーの下・タッチ演奏の上）、パッド8個、録音の選択肢（自然録音＋楽器）
R.ui=await pg.evaluate(()=>{const y=id=>document.getElementById(id).getBoundingClientRect().top+scrollY;return {pads:document.querySelectorAll('#smpPads button').length,opts:document.querySelectorAll('#smpSource option').length,recs:__bioDebug.recordings.length,mixer:y('mixerSection'),smp:y('samplerSection'),touch:y('touchSection'),idle:document.querySelector('#mixGrid [data-ch="sampler"]').classList.contains('idle'),status:document.getElementById('smpStatus').textContent}});
ok('ui',R.ui.pads===8&&R.ui.opts===R.ui.recs+52&&R.ui.touch<R.ui.mixer&&R.ui.mixer<R.ui.smp&&R.ui.idle&&R.ui.status==='録音を選んで「読み込む」を押してください。');
// 2) オフライン描画（48kHz・試験信号＝0.1秒周期ののこぎり波）
const render=o=>pg.evaluate(o=>__samplerDebug.render(o),o);const maxAbs=a=>a.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
// 切り取り：0.25〜0.5秒 → 12000サンプル、元の 12000 サンプル目からと完全一致
const s1=await render({srcDur:1,start:.25,end:.5,dur:.4,fade:2});let e1=0;for(let k=0;k<12000;k++)e1=Math.max(e1,Math.abs(s1.slice[k]-s1.src[12000+k]));
let o1=0;for(let k=200;k<11800;k++)o1=Math.max(o1,Math.abs(s1.L[k]-s1.slice[k]));R.slice={len:s1.slice.length,err:e1,outErr:o1,after:maxAbs(s1.L.slice(12010))};
ok('slice',R.slice.len===12000&&e1===0&&o1<1e-6&&R.slice.after<1e-6);
// 逆再生：出力は区間を後ろから
const s2=await render({srcDur:1,start:.25,end:.5,dur:.4,reverse:true});let e2=0;for(let k=200;k<11800;k++)e2=Math.max(e2,Math.abs(s2.L[k]-s2.slice[11999-k]));R.reverseErr=e2;ok('reverse',e2<1e-6);
// 速度・音程 +12（2倍速）：長さが半分、k 番目の出力＝区間の 2k 番目
const s3=await render({srcDur:1,start:.25,end:.5,dur:.4,pitch:12});let e3=0;for(let k=200;k<5800;k++)e3=Math.max(e3,Math.abs(s3.L[k]-s3.slice[2*k]));R.pitch={err:e3,after:maxAbs(s3.L.slice(6010))};ok('pitch_up',e3<1e-4&&R.pitch.after<1e-6);
// −12（半分の速さ）：長さが2倍
const s4=await render({srcDur:1,start:.25,end:.5,dur:.6,pitch:-12});R.pitchDown={mid:maxAbs(s4.L.slice(20000,23000)),after:maxAbs(s4.L.slice(24020))};ok('pitch_down',R.pitchDown.mid>.3&&R.pitchDown.after<1e-6);
// ループ：0.25秒の区間を繰り返す。0.8秒で離すと止まる（フェード 10ms）
const s5=await render({srcDur:1,start:.25,end:.5,dur:1,mode:'loop',fade:10,releaseAt:.8});let e5=0;for(let k=1000;k<11000;k++)e5=Math.max(e5,Math.abs(s5.L[12000+k]-s5.slice[k]),Math.abs(s5.L[24000+k]-s5.slice[k]));R.loop={err:e5,after:maxAbs(s5.L.slice(Math.round(.9*48000)))};ok('loop',e5<1e-5&&R.loop.after<1e-3);
// フェード 100ms：50ms の時点でちょうど半分の音量、始まりは 0
const s6=await render({srcDur:1,start:0,end:.5,dur:.6,fade:100,input:'tone'});const r6=s6.L[2400]/s6.slice[2400];R.fade={half:+r6.toFixed(4),first:Math.abs(s6.L[0])};ok('fade',Math.abs(r6-.5)<.01&&R.fade.first<1e-6);
// 3) 実演奏：CC0 の録音を読み込み → 区間 → パッドに割り当て → 押すとサンプラーチャンネルで鳴る
await pg.evaluate(()=>document.getElementById('samplerSection').open=true);
await pg.click('#play');await pg.waitForTimeout(5000);
await pg.selectOption('#smpSource','recording:forest-leaves');await pg.click('#smpLoad');await pg.waitForFunction(()=>__samplerDebug.state().dur>0,null,{timeout:20000});
R.load=await pg.evaluate(()=>({st:__samplerDebug.state(),status:document.getElementById('smpStatus').textContent}));ok('load',R.load.st.src==='recording:forest-leaves'&&R.load.st.dur>10&&/^森の葉擦れ・落葉 を読み込みました（[\d.]+秒）。/.test(R.load.status));
// 波形をなぞって区間を選ぶ（左から 20%〜40%）
const cv=pg.locator('#smpWave');await cv.scrollIntoViewIfNeeded();const cb=await cv.boundingBox();await pg.mouse.move(cb.x+cb.width*.2,cb.y+cb.height/2);await pg.mouse.down();await pg.mouse.move(cb.x+cb.width*.4,cb.y+cb.height/2,{steps:6});await pg.mouse.up();
R.drag=await pg.evaluate(()=>{const s=__samplerDebug.state();return {a:s.start/s.dur,b:s.end/s.dur}});ok('drag_select',Math.abs(R.drag.a-.2)<.02&&Math.abs(R.drag.b-.4)<.02);
await pg.evaluate(()=>__samplerDebug.setRange(2,4));await pg.click('#smpAssign');
R.assign=await pg.evaluate(()=>({p:__samplerDebug.state().pads[0],sel:document.getElementById('smpPadSel').value,status:document.getElementById('smpStatus').textContent,idle:document.querySelector('#mixGrid [data-ch="sampler"]').classList.contains('idle'),label:document.querySelector('#smpPads [data-pad="0"] .nm').textContent}));
ok('assign',R.assign.p&&R.assign.p.len===Math.round(2*R.assign.p.sr)&&R.assign.sel==='1'&&R.assign.status==='パッド1に割り当てました（2.00秒）。'&&!R.assign.idle&&R.assign.label==='森の葉擦れ・落葉');
const pad=i=>pg.locator('#smpPads [data-pad="'+i+'"]');
await pad(0).scrollIntoViewIfNeeded();await pad(0).click();await pg.waitForTimeout(200);
let pk=-Infinity;for(let i=0;i<12;i++){pk=Math.max(pk,await pg.evaluate(()=>__mixerDebug.peakDb('sampler')));await pg.waitForTimeout(50)}
R.live={peak:+pk.toFixed(1),playing:await pg.evaluate(()=>__samplerDebug.state().playing),pressed:await pad(0).getAttribute('aria-pressed'),lanes:(await pg.evaluate(()=>__mixerDebug.lanes())).sampler};
ok('pad_plays',pk>-80&&R.live.playing.includes(0)&&R.live.pressed==='true'&&R.live.lanes.includes('dry'));
// ミキサーのサンプラーチャンネルが効く（ミュートで無音）
await pg.evaluate(()=>__mixerDebug.set('sampler','mute',true));await pg.waitForTimeout(400);let pm=-Infinity;for(let i=0;i<8;i++){pm=Math.max(pm,await pg.evaluate(()=>__mixerDebug.peakDb('sampler')));await pg.waitForTimeout(40)}R.muted=pm;ok('mixer_applies',pm===-Infinity);await pg.evaluate(()=>__mixerDebug.set('sampler','mute',false));
// 1回再生は区間の長さで終わる
await pg.waitForTimeout(2200);R.ended=await pg.evaluate(()=>__samplerDebug.state().playing);ok('oneshot_ends',!R.ended.includes(0));
// 押している間だけ：パッド2
await pg.selectOption('#smpMode','hold');await pg.evaluate(()=>__samplerDebug.setRange(5,6));await pg.click('#smpAssign');
const bb=await pad(1).boundingBox();await pg.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await pg.mouse.down();await pg.waitForTimeout(300);R.holdDown=await pg.evaluate(()=>__samplerDebug.state().playing);await pg.mouse.up();await pg.waitForTimeout(100);R.holdUp=await pg.evaluate(()=>__samplerDebug.state().playing);
ok('hold',R.holdDown.includes(1)&&!R.holdUp.includes(1));
await pad(1).focus();await pg.keyboard.down('Space');R.kbdDown=await pg.evaluate(()=>__samplerDebug.state().playing.includes(1));await pg.keyboard.up('Space');R.kbdUp=await pg.evaluate(()=>__samplerDebug.state().playing.includes(1));ok('hold_keyboard',R.kbdDown&&!R.kbdUp);
// ループ：パッド3（もう一度押すと止まる）。逆再生・音程も記録される
await pg.selectOption('#smpMode','loop');await pg.check('#smpReverse');await pg.evaluate(()=>{const p=document.getElementById('smpPitch');p.value='3';p.dispatchEvent(new Event('input'))});await pg.click('#smpAssign');
await pad(2).click();await pg.waitForTimeout(1500);R.loopOn=await pg.evaluate(()=>__samplerDebug.state().playing.includes(2));await pad(2).click();await pg.waitForTimeout(100);R.loopOff=await pg.evaluate(()=>__samplerDebug.state().playing.includes(2));
R.loopPad=await pg.evaluate(()=>__samplerDebug.state().pads[2]);R.loopLabel=await pg.locator('#smpPads [data-pad="2"] .md').textContent();
ok('loop_live',R.loopOn&&!R.loopOff&&R.loopPad.mode==='loop'&&R.loopPad.reverse&&R.loopPad.pitch===3&&R.loopLabel==='ループ · REV · +3');
await pg.uncheck('#smpReverse');await pg.evaluate(()=>{const p=document.getElementById('smpPitch');p.value='0';p.dispatchEvent(new Event('input'))});
// 拍に合わせて鳴らす：パッド4（120BPM → 0.5秒の倍数で鳴り始める）
await pg.evaluate(()=>__fxDebug.set('bpm',120));await pg.selectOption('#smpMode','oneshot');await pg.check('#smpQuant');await pg.click('#smpAssign');await pad(3).click();
R.quant=await pg.evaluate(()=>{const v=__samplerDebug.voices().find(x=>x.pad===3);return v?{t0:v.t0,k:v.t0/.5}:null});ok('quantize',R.quant&&Math.abs(R.quant.k-Math.round(R.quant.k))<1e-6);await pg.uncheck('#smpQuant');
// 帰属表示：WAV 録音中にパッドを鳴らすと、その録音がクレジットに入る
await pg.evaluate(()=>__audioEcosystemDebug.startRecord());await pg.waitForTimeout(500);await pad(0).click();await pg.waitForTimeout(300);
R.used=await pg.evaluate(()=>__audioEcosystemDebug.attribution().used.map(u=>u.kind+':'+u.id));const dlP=pg.waitForEvent('download',{timeout:20000}).catch(()=>null);await pg.evaluate(()=>__audioEcosystemDebug.stopRecord());await dlP;
ok('attribution',R.used.includes('recording:forest-leaves'));
// 4) 商用モード：CC BY の録音（アブラゼミ）をパッド5に割り当て → 「CC0 のみ」で鳴らない・読み込めない・鳴っていた音は止まる
await pg.selectOption('#smpPadSel','4');await pg.evaluate(()=>__samplerDebug.load('recording:cicada'));await pg.evaluate(()=>__samplerDebug.setRange(10,11));await pg.click('#smpAssign');
await pg.selectOption('#smpMode','loop');await pg.selectOption('#smpPadSel','5');await pg.click('#smpAssign');await pad(5).click();await pg.waitForTimeout(200);R.byPlaying=await pg.evaluate(()=>__samplerDebug.state().playing.includes(5));
await pg.selectOption('#rightsMode','cc0');await pg.waitForTimeout(200);
R.cc0={playing:await pg.evaluate(()=>__samplerDebug.state().playing),blocked:await pad(4).getAttribute('data-smp-blocked'),optDisabled:await pg.evaluate(()=>document.querySelector('#smpSource option[value="recording:cicada"]').disabled),ccOk:await pg.evaluate(()=>!document.querySelector('#smpSource option[value="recording:forest-leaves"]').disabled)};
await pad(4).click();R.cc0.after=await pg.evaluate(()=>({playing:__samplerDebug.state().playing,status:document.getElementById('smpStatus').textContent}));
R.cc0.load=await pg.evaluate(async()=>{const r=await __samplerDebug.load('recording:cicada');return {r,status:document.getElementById('smpStatus').textContent}});
ok('rights',R.byPlaying&&!R.cc0.playing.includes(5)&&R.cc0.blocked==='1'&&R.cc0.optDisabled&&R.cc0.ccOk&&!R.cc0.after.playing.includes(4)&&R.cc0.after.status==='パッド5の録音は商用モードの対象外のため鳴りません。'&&R.cc0.load.r===false&&R.cc0.load.status==='この録音は商用モードの対象外のため読み込めません（代用しません）。');
await pg.selectOption('#rightsMode','all');await pg.waitForTimeout(100);R.backAll=await pad(4).getAttribute('data-smp-blocked');ok('rights_back',R.backAll==='0');
// 楽器の実録音も読み込める
R.inst=await pg.evaluate(async()=>{const r=await __samplerDebug.load('instrument:harp-45');return {r,st:__samplerDebug.state()}});ok('instrument',R.inst.r===true&&R.inst.st.src==='instrument:harp-45'&&R.inst.st.dur>5);
// 空にする・すべて止める
await pg.click('#smpStopAll');R.stopAll=await pg.evaluate(()=>__samplerDebug.state().playing.length);await pg.selectOption('#smpPadSel','3');await pg.click('#smpClear');R.cleared=await pg.evaluate(()=>__samplerDebug.state().pads[3]);
ok('stop_clear',R.stopAll===0&&R.cleared===null);
// 5) 英語表示・画面幅・エラー
await pg.click('#langToggle');await pg.waitForTimeout(500);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.en=await pg.evaluate(()=>({aria:document.querySelector('#smpPads [data-pad="0"]').getAttribute('aria-label'),md:document.querySelector('#smpPads [data-pad="2"] .md').textContent,load:document.getElementById('smpLoad').textContent,empty:document.querySelector('#smpPads [data-pad="7"] .nm').textContent}));
ok('english',R.en.aria==='Pad 1'&&R.en.md==='Loop · REV · +3'&&R.en.load==='Load'&&R.en.empty==='Empty');
await pg.click('#langToggle');await pg.waitForTimeout(300);R.backJa=await pg.evaluate(()=>document.querySelector('#smpPads [data-pad="0"]').getAttribute('aria-label'));ok('back_ja',R.backJa==='パッド1');
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
