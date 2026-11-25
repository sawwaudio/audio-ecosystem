// v0.85 ペダルボードの回帰テスト。python3 -m http.server 8765 で本体を配信して実行する。
// 音の中身はオフラインで描画して確かめる（音程・帰還が膨らまないこと・フリーズが伸び続けて放すと消えること・やまびこの間隔）。
// 画面：7台のペダル、オン・オフ、つまみ、かける場所、英語で日本語が残らないこと、横にはみ出さないこと。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const errs=[];
const pg=await b.newPage({viewport:{width:390,height:900}});pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await pg.goto('http://localhost:8765/index.html?lang=ja');await pg.waitForTimeout(1200);
// ── 音（オフライン） ──
R.dsp=await pg.evaluate(async()=>{const P=window.__pedals,sr=48000,out={};
 const rms=(a,s,e)=>{let x=0;for(let i=s;i<e;i++)x+=a[i]*a[i];return Math.sqrt(x/Math.max(1,e-s))};
 const freq=(a,s,e)=>{let z=0;for(let i=s+1;i<e;i++)if(a[i-1]<0&&a[i]>=0)z++;return z/((e-s)/sr)};
 const finite=a=>a.every(Number.isFinite);
 async function run(id,v,secs,feed,on=true,after){const oc=new OfflineAudioContext(1,Math.floor(sr*secs),sr),p=P.makePedal(oc,id,{...Object.fromEntries(P.def[id].knobs.map(k=>[k.k,k.def])),...(P.def[id].steps?{[P.def[id].steps.k]:P.def[id].steps.def}:{}),...v});
  feed(oc,p.input);p.output.connect(oc.destination);if(on)p.setOn(true);if(after)after(oc,p);const r=await oc.startRendering();return r.getChannelData(0)}
 const sine=(hz,dur=99)=>(oc,dst)=>{const o=oc.createOscillator();o.frequency.value=hz;const g=oc.createGain();g.gain.value=.5;o.connect(g);g.connect(dst);o.start();o.stop(dur)};
 const burst=(dur=.05)=>(oc,dst)=>{const n=Math.floor(sr*dur),bf=oc.createBuffer(1,n,sr),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*.8;const s=oc.createBufferSource();s.buffer=bf;s.connect(dst);s.start(0)};
 // オクターブ：上だけ → 約 880Hz、下だけ → 約 220Hz
 let a=await run('octave',{sub:0,up:100,dry:0},1.5,sine(440));out.octUp=Math.round(freq(a,sr*.5,sr*1.4));
 a=await run('octave',{sub:100,up:0,dry:0},1.5,sine(440));out.octSub=Math.round(freq(a,sr*.5,sr*1.4));
 // オフの時は素通し（元の 440Hz・同じ大きさ）
 a=await run('octave',{},1,sine(440),false);out.bypassHz=Math.round(freq(a,sr*.3,sr*.9));out.bypassRms=+rms(a,sr*.3,sr*.9).toFixed(3);
 // ファズ：歪んで有限・大きすぎない
 a=await run('fuzz',{sustain:100},1,sine(220));out.fuzzRms=+rms(a,sr*.3,sr*.9).toFixed(3);out.fuzzPeak=+Math.max(...a.map(Math.abs)).toFixed(3);out.fuzzFinite=finite(a);
 // テープ：鳴っていて、揺れで音程がわずかに動く
 a=await run('tape',{wow:100,age:30,drop:0},3,sine(440));const f1=freq(a,sr*.4,sr*1.2),f2=freq(a,sr*1.3,sr*2.1);out.tapeRms=+rms(a,sr*.4,sr*2.8).toFixed(3);out.tapeWobble=Math.round(Math.abs(f1-f2)*10)/10;out.tapeFinite=finite(a);
 // アナログディレイ：300ms ごとのやまびこ
 a=await run('analog',{time:300,repeats:50,mod:0,mix:100},1.5,burst());const e=(t)=>rms(a,Math.floor(sr*t),Math.floor(sr*(t+.06)));out.anEcho=[e(.3),e(.6),e(.45)].map(x=>+x.toFixed(4));
 // ピッチディレイ：+12 で、1回目のやまびこの音程が 2 倍
 a=await run('pitchdelay',{time:400,repeats:0,mix:100,interval:12},1.4,sine(330,.3));out.pdEchoHz=Math.round(freq(a,Math.floor(sr*.5),Math.floor(sr*.65)));
 // シマー：きらめき最大・残響最長でも膨らまない（20秒）
 a=await run('shimmer',{decay:12,shimmer:100,mix:100},20,burst(.3));out.shim=[rms(a,sr*1,sr*3),rms(a,sr*8,sr*10),rms(a,sr*17,sr*19)].map(x=>+x.toFixed(5));out.shimFinite=finite(a);
 // フリーズ：雑音を 1.5 秒流して止める。1.2 秒でつかむ → 4〜5 秒でも鳴っている（大きさが保たれる）→ 5 秒で放す → 6.5 秒以降は無音
 a=await run('freeze',{len:500,level:100,dry:0},7,(oc,dst)=>{const n=Math.floor(sr*1.5),bf=oc.createBuffer(1,n,sr),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*.4;const s=oc.createBufferSource();s.buffer=bf;s.connect(dst);s.start(0)},false,(oc,p)=>{oc.suspend(1.2).then(()=>{p.setOn(true);oc.resume()});oc.suspend(5).then(()=>{p.setOn(false);oc.resume()})});
 out.frz=[rms(a,sr*2,sr*3),rms(a,sr*4,sr*5),rms(a,sr*6.2,sr*7)].map(x=>+x.toFixed(4));out.frzFinite=finite(a);
 return out});
const D=R.dsp;
ok('octave_up',Math.abs(D.octUp-880)<25);ok('octave_down',Math.abs(D.octSub-220)<12);ok('bypass_clean',D.bypassHz===440&&Math.abs(D.bypassRms-.354)<.01);
ok('fuzz',D.fuzzFinite&&D.fuzzRms>.05&&D.fuzzPeak<1.2);ok('tape',D.tapeFinite&&D.tapeRms>.1&&D.tapeWobble>0);
ok('analog_echo',D.anEcho[0]>.02&&D.anEcho[1]>.005&&D.anEcho[1]<D.anEcho[0]&&D.anEcho[2]<D.anEcho[1]);
ok('pitch_delay',Math.abs(D.pdEchoHz-660)<30);
ok('shimmer_stable',D.shimFinite&&D.shim[0]>0&&D.shim[1]<D.shim[0]&&D.shim[2]<D.shim[1]);
ok('freeze',D.frzFinite&&D.frz[0]>.05&&D.frz[1]>.05&&Math.abs(D.frz[1]/D.frz[0]-1)<.25&&D.frz[2]<.002);
// ── 画面 ──
R.ui=await pg.evaluate(()=>{document.getElementById('pedalSection').open=true;return {cards:[...document.querySelectorAll('.pdCard')].map(c=>c.dataset.pedal),knobs:document.querySelectorAll('.pdKnob input').length,targets:[...document.querySelectorAll('#pdTarget option')].map(o=>o.value)}});
ok('ui_cards',R.ui.cards.join()==='freeze,octave,fuzz,tape,pitchdelay,analog,shimmer'&&R.ui.knobs===24&&R.ui.targets.join()==='master,bio,field,music,sampler');
await pg.click('#play');await pg.waitForTimeout(2500);
R.attached=await pg.evaluate(()=>__pedals.built());ok('freeze_ready_on_start',!!R.attached&&R.attached.pedals.join()==='freeze');
await pg.evaluate(()=>document.querySelector('.pdCard[data-pedal="fuzz"] .pdSwitch').scrollIntoView());
await pg.click('.pdCard[data-pedal="fuzz"] .pdSwitch');await pg.click('.pdCard[data-pedal="shimmer"] .pdSwitch');await pg.waitForTimeout(300);
R.after=await pg.evaluate(()=>({b:__pedals.built(),on:Object.entries(__pedals.state().p).filter(([k,v])=>v.on).map(([k])=>k),pressed:document.querySelector('.pdCard[data-pedal="fuzz"] .pdSwitch').getAttribute('aria-pressed'),status:document.getElementById('pdStatus').textContent}));
ok('switch_on',R.after.on.join()==='fuzz,shimmer'&&R.after.b.pedals.join()==='freeze,fuzz,shimmer'&&R.after.pressed==='true'&&R.after.status==='ファズ · シマー');
await pg.evaluate(()=>{const i=document.querySelector('.pdCard[data-pedal="fuzz"] input[data-k="tone"]');i.value='90';i.dispatchEvent(new Event('input',{bubbles:true}))});
ok('knob',await pg.evaluate(()=>__pedals.state().p.fuzz.v.tone===90&&document.querySelector('.pdCard[data-pedal="fuzz"] output[data-k="tone"]').textContent==='90%'&&JSON.parse(localStorage.getItem('saww.pedals.v1')).p.fuzz.v.tone===90));
await pg.selectOption('#pdTarget','sampler');await pg.waitForTimeout(200);R.sampler=await pg.evaluate(()=>__pedals.built());ok('target_channel',R.sampler&&R.sampler.target==='sampler'&&R.sampler.pedals.join()==='freeze,fuzz,shimmer');
await pg.selectOption('#pdTarget','master');await pg.waitForTimeout(800);
R.level=await pg.evaluate(async()=>{const a=document.createElement('canvas');return __audioEcosystemDebug.getState().audioState});ok('audio_running',R.level==='running');
await pg.click('#pdAllOff');ok('all_off',await pg.evaluate(()=>Object.values(__pedals.state().p).every(v=>!v.on)&&document.getElementById('pdStatus').textContent==='すべてオフ'));
// 英語
await pg.selectOption('#langSelect','en');await pg.waitForTimeout(500);await pg.click('.pdCard[data-pedal="octave"] .pdSwitch');await pg.waitForTimeout(200);
R.en=await pg.evaluate(()=>{const s=document.getElementById('pedalSection');s.querySelectorAll('details').forEach(d=>d.open=true);return {un:__i18n.untranslated().filter(t=>{const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())if(n.nodeValue.trim()===t)return true;return [...s.querySelectorAll('*')].some(e=>[...e.attributes].some(a=>'@'+a.name+'='+a.value===t))}),name:s.querySelector('.pdCard[data-pedal="shimmer"] .pdName').textContent,status:document.getElementById('pdStatus').textContent,summary:s.querySelector('summary span').textContent}});
ok('english',R.en.un.length===0&&R.en.name==='Shimmer'&&R.en.status==='Octave');
await pg.selectOption('#langSelect','ja');await pg.waitForTimeout(300);ok('back_ja',await pg.evaluate(()=>document.querySelector('.pdCard[data-pedal="shimmer"] .pdName').textContent==='シマー'));
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>document.getElementById('pedalSection').scrollIntoView());await pg.screenshot({path:'/tmp/pedals.png',fullPage:false});
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon|404/.test(e));ok('no_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
