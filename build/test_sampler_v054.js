// v0.54 サンプラー M4 の残り（パッドごとの音量・継ぎ目のゼロ交差合わせ）の回帰テスト（docs/DJ_MIXER_SPEC.md）。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
await pg.evaluate(()=>document.getElementById('samplerSection').open=true);
// 1) 画面：音量 100%・ゼロ交差は既定で切（従来どおり）
R.ui=await pg.evaluate(()=>({vol:document.getElementById('smpVol').value,val:document.getElementById('smpVolVal').textContent,zero:document.getElementById('smpZero').checked,min:document.getElementById('smpVol').min,max:document.getElementById('smpVol').max}));
ok('ui',R.ui.vol==='100'&&R.ui.val==='100'&&R.ui.zero===false&&R.ui.min==='0'&&R.ui.max==='150');
// 2) ゼロ交差の探し方（試験信号）：100Hz の正弦波（上向きの0交差は 0.01 秒ごと）
R.snap=await pg.evaluate(()=>{const c=new OfflineAudioContext(2,48000,48000),bf=c.createBuffer(2,48000,48000),L=bf.getChannelData(0),Rr=bf.getChannelData(1);for(let i=0;i<48000;i++){L[i]=Math.sin(2*Math.PI*100*i/48000+.3);Rr[i]=L[i]}
 const dc=c.createBuffer(1,48000,48000);dc.getChannelData(0).fill(.5);
 const z=t=>__samplerDebug.snapBuf(bf,t),up=t=>{const j=Math.round(z(t)*48000),m=k=>(L[k]+Rr[k])/2;return m(j-1)<0&&m(j)>=0};
 return {a:z(.2523),aUp:up(.2523),b:z(.2571),bUp:up(.2571),far:__samplerDebug.snapBuf(dc,.5),edge:z(0),win:__samplerDebug.snapBuf(bf,.2523,.0005)}});
// 0.3 rad の位相：上向きの0交差は (k − 0.3/2π)/100 秒 ≈ k/100 − 0.000477
const zc=k=>(k-.3/(2*Math.PI))/100;
ok('snap_nearest',Math.abs(R.snap.a-zc(25))<1/48000*1.01&&R.snap.aUp&&Math.abs(R.snap.b-zc(26))<1/48000*1.01&&R.snap.bUp);
ok('snap_none_keeps',R.snap.far===.5&&Number.isFinite(R.snap.edge));
// 下向き（0.2523 の前後 0.5ms には上向きがない → 下向きもなければそのまま）
ok('snap_window',Math.abs(R.snap.win-.2523)<1e-9);
// 3) オフライン描画：パッドの音量はそのまま出力の大きさになる
const pk=async g=>pg.evaluate(g=>__samplerDebug.render({srcDur:1,start:0,end:.5,dur:.6,fade:5,input:'tone',gain:g}).then(r=>r.L.slice(4800,19200).reduce((m,v)=>Math.max(m,Math.abs(v)),0)),g);
R.gain={g1:await pk(1),g05:await pk(.5),g0:await pk(0)};ok('render_gain',Math.abs(R.gain.g05/R.gain.g1-.5)<.005&&R.gain.g0<1e-6);
// 4) 実演奏：読み込み → 音量 60%・ゼロ交差を入れて割り当て
await pg.click('#play');await pg.waitForTimeout(3000);
await pg.selectOption('#smpSource','recording:forest-leaves');await pg.click('#smpLoad');await pg.waitForFunction(()=>__samplerDebug.state().dur>0,null,{timeout:20000});
const setVol=v=>pg.evaluate(v=>{const el=document.getElementById('smpVol');el.value=String(v);el.dispatchEvent(new Event('input'))},v);
await pg.evaluate(()=>__samplerDebug.setRange(2,4));await pg.selectOption('#smpPadSel','0');await pg.selectOption('#smpMode','loop');await setVol(60);await pg.setChecked('#smpZero',true);await pg.click('#smpAssign');
R.a=await pg.evaluate(()=>{const s=__samplerDebug.state(),p=s.pads[0],src=__samplerDebug.srcBuf(),L=src.getChannelData(0),Rr=src.numberOfChannels>1?src.getChannelData(1):L,m=k=>(L[k]+Rr[k])/2,sr=src.sampleRate,i0=Math.round(p.start*sr),i1=Math.round(p.end*sr);
 const cross=j=>(m(j-1)<0&&m(j)>=0)||(m(j-1)>0&&m(j)<=0);return {start:p.start,end:p.end,vol:p.vol,gain:p.gain,base:__samplerDebug.baseGain(0),c0:cross(i0),c1:cross(i1),status:document.getElementById('smpStatus').textContent,md:document.querySelector('#smpPads [data-pad="0"] .md').textContent,valText:document.getElementById('smpVolVal').textContent}});
ok('assign_snapped',R.a.start!==2&&Math.abs(R.a.start-2)<=.0051&&Math.abs(R.a.end-4)<=.0051&&R.a.c0&&R.a.c1);
ok('assign_volume',R.a.vol===60&&Math.abs(R.a.gain-R.a.base*.6)<1e-9&&R.a.md==='ループ · 60%'&&R.a.valText==='60');
ok('assign_status',/^パッド1に割り当てました（[\d.]+秒）。継ぎ目をゼロ交差に合わせました。$/.test(R.a.status));
// ゼロ交差を切ると従来どおり（指定した区間のまま）・音量 100% は表示に出さない
await pg.setChecked('#smpZero',false);await setVol(100);await pg.selectOption('#smpPadSel','1');await pg.selectOption('#smpMode','oneshot');await pg.click('#smpAssign');
R.b=await pg.evaluate(()=>({p:__samplerDebug.state().pads[1],md:document.querySelector('#smpPads [data-pad="1"] .md').textContent,status:document.getElementById('smpStatus').textContent}));
ok('assign_plain',R.b.p.start===2&&R.b.p.end===4&&R.b.p.vol===100&&R.b.md==='1回'&&R.b.status==='パッド2に割り当てました（2.00秒）。');
// 5) 割り当て済みのパッドを選ぶと音量のつまみがその値になり、動かすとそのパッドが変わる（次に鳴らす時から）
await pg.selectOption('#smpPadSel','0');R.sel=await pg.evaluate(()=>document.getElementById('smpVol').value);ok('select_shows_volume',R.sel==='60');
await setVol(120);R.live=await pg.evaluate(()=>({p:__samplerDebug.state().pads[0],base:__samplerDebug.baseGain(0),p1:__samplerDebug.state().pads[1].vol,status:document.getElementById('smpStatus').textContent,md:document.querySelector('#smpPads [data-pad="0"] .md').textContent}));
ok('live_volume',R.live.p.vol===120&&Math.abs(R.live.p.gain-R.live.base*1.2)<1e-9&&R.live.p1===100&&R.live.status==='パッド1の音量を120%にしました（次に鳴らす時から）。'&&R.live.md==='ループ · 120%');
// 鳴らす：音量 0% は無音、120% は鳴る（サンプラーチャンネルのピーク）
const peakFor=async i=>{const pad=pg.locator('#smpPads [data-pad="'+i+'"]');await pad.scrollIntoViewIfNeeded();await pad.click();let p=-Infinity;for(let k=0;k<12;k++){p=Math.max(p,await pg.evaluate(()=>__mixerDebug.peakDb('sampler')));await pg.waitForTimeout(50)}await pg.evaluate(()=>__samplerDebug.stopAll());await pg.waitForTimeout(400);return p};
R.peak120=await peakFor(0);await setVol(0);R.peak0=await peakFor(0);ok('plays_by_volume',R.peak120>-70&&R.peak0<-90);
await setVol(120);
// 6) プリセット：100% 以外のパッドだけ vol を書く・読み直すと同じ音量で、切り取りは保存した区間（ゼロ交差の後）のまま
const J=await pg.evaluate(()=>__presetDebug.exportData());R.exp={p0:J.sampler.pads[0],p1:J.sampler.pads[1]};
ok('export_vol',J.sampler.pads[0].vol===120&&!('vol' in J.sampler.pads[1])&&Math.abs(J.sampler.pads[0].start-R.a.start)<1e-4);
const sum0=await pg.evaluate(()=>__presetDebug.padSum(0));
await pg.reload();await pg.waitForTimeout(800);await pg.evaluate(()=>document.getElementById('samplerSection').open=true);
await pg.evaluate(d=>__presetDebug.apply(d),J);await pg.waitForFunction(()=>/^サンプラーのパッド\d+個を読み込みました。/.test(document.getElementById('smpStatus').textContent),null,{timeout:30000});
R.imp=await pg.evaluate(()=>({p0:__samplerDebug.state().pads[0],p1:__samplerDebug.state().pads[1],base:__samplerDebug.baseGain(0),sum:__presetDebug.padSum(0),md:document.querySelector('#smpPads [data-pad="0"] .md').textContent}));
ok('import_vol',R.imp.p0.vol===120&&Math.abs(R.imp.p0.gain-R.imp.base*1.2)<1e-9&&R.imp.p1.vol===100&&Math.abs(R.imp.sum-sum0)<1e-6&&R.imp.md==='ループ · 120%');
// 不正な音量は拒否して何も変えない
const bad=async f=>pg.evaluate(([d,f])=>{const x=JSON.parse(JSON.stringify(d));new Function('x',f)(x);try{__presetDebug.apply(x);return 'accepted'}catch(e){return e.message}},[J,f]);
R.bad={big:await bad('x.sampler.pads[0].vol=151'),neg:await bad('x.sampler.pads[0].vol=-1'),str:await bad("x.sampler.pads[0].vol='80'"),nan:await bad('x.sampler.pads[0].vol=null')};
ok('reject_bad_vol',Object.values(R.bad).every(v=>v==='不正なサンプラー設定: パッド1')&&(await pg.evaluate(()=>__samplerDebug.state().pads[0].vol))===120);
// 古いプリセット（vol なし）は 100%
const old=JSON.parse(JSON.stringify(J));delete old.sampler.pads[0].vol;await pg.evaluate(d=>__presetDebug.apply(d),old);await pg.waitForFunction(()=>/^サンプラーのパッド\d+個を読み込みました。/.test(document.getElementById('smpStatus').textContent)&&__samplerDebug.state().pads[0],null,{timeout:30000});
ok('old_preset_100',(await pg.evaluate(()=>__samplerDebug.state().pads[0].vol))===100);
// 7) 英語表示・画面幅・ソースの一致・エラー
await pg.selectOption('#smpPadSel','0');await setVol(80);
await pg.click('#langToggle');await pg.waitForTimeout(500);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.en=await pg.evaluate(()=>({vol:document.querySelector('label[for="smpVol"]').textContent,zero:document.getElementById('smpZero').parentElement.textContent,status:document.getElementById('smpStatus').textContent}));
ok('english',R.en.vol==='Pad volume (%)'&&R.en.zero==='Snap edges to zero crossings'&&R.en.status==='Pad 1 volume set to 80% (from its next trigger).');
await pg.click('#langToggle');await pg.waitForTimeout(300);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
const fs=require('fs'),path=require('path'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),src=fs.readFileSync(path.join(__dirname,'src_i18n.js'),'utf8');
const m=html.match(/<script id="ae-i18n">([\s\S]*?)<\/script>/);ok('i18n_source_match',!!m&&m[1].trim()===src.trim());
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
