// v0.92 ペダルボード 第5版（100種・10の分類。AudioWorklet の台を含む）の回帰テスト。python3 -m http.server 8765 で本体を配信して実行する。
// 音：30台すべてをオフラインで鳴らす（数値が壊れない・大きすぎない・鳴る・オフは素通し）。主な台は中身も確かめる。
// つなぎ：自然の録音を含む全体の音がペダルを通ること、試聴（audio 要素）もペダルを通ること。
// 画面：空のボード→おすすめ→カタログで足す・外す・並べ替え・8台まで・つまみ（キー・ダブルクリック）・プリセット（旧形式も）・英語・はみ出し。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];
const pg=await b.newPage({viewport:{width:390,height:900}});pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await pg.goto('http://localhost:8765/index.html?lang=ja');await pg.waitForTimeout(1200);
R.count=await pg.evaluate(()=>__pedals.ids.length);ok('hundred',R.count===100);
// ── 音（オフライン） ──
R.all=await pg.evaluate(async()=>{const P=__pedals,sr=44100,out={};const defs=id=>{const d=P.def[id],v={};for(const k of d.knobs)v[k.k]=k.def;if(d.steps)v[d.steps.k]=d.steps.def;return v};
 for(const id of P.ids){const d=P.def[id],v={};if(id==='tapeensemble')v.sens=-80;for(const k of d.knobs)v[k.k]=k.def;if(d.steps)v[d.steps.k]=d.steps.def;
  const res={};for(const on of [true,false]){const oc=new OfflineAudioContext(2,sr*2,sr);await P.ready(oc);const p=P.makePedal(oc,id,{...defs(id),...(id==='tapeensemble'?{sens:-80}:{})}),o=oc.createOscillator(),g=oc.createGain();o.frequency.value=220;g.gain.value=.4;o.connect(g);g.connect(p.input);p.output.connect(oc.destination);o.start();o.stop(1.2);
   if(on){p.setOn(true);if(id==='microloop')oc.suspend(.6).then(()=>{p.action('hold');oc.resume()});if(d.mode==='stutter')oc.suspend(.5).then(()=>{p.fire();oc.resume()});if(d.mode==='freeze')oc.suspend(.6).then(()=>{oc.resume()})}
   const r=await oc.startRendering(),a=r.getChannelData(0),c=r.getChannelData(1);let pk=0,s=0,fin=true;for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(c[i]))fin=false;pk=Math.max(pk,Math.abs(a[i]),Math.abs(c[i]));if(i>sr*.3&&i<sr*1.1)s+=a[i]*a[i]}
   res[on?'on':'off']={fin,pk:+pk.toFixed(3),rms:+Math.sqrt(s/(sr*.8)).toFixed(4)}}
  out[id]=res}
 return out});
R.bad=Object.entries(R.all).filter(([id,r])=>!r.on.fin||!r.off.fin||r.on.pk>3||r.on.rms<.003||Math.abs(r.off.rms-.2828)>.02).map(([id,r])=>id+':'+JSON.stringify(r));
ok('all_pedals_sound',R.bad.length===0);
R.dsp=await pg.evaluate(async()=>{const P=__pedals,sr=48000,out={};
 const rms=(a,s,e)=>{let x=0;for(let i=Math.floor(s);i<Math.floor(e);i++)x+=a[i]*a[i];return Math.sqrt(x/Math.max(1,e-s))};
 const freq=(a,s,e)=>{let z=0;for(let i=Math.floor(s)+1;i<Math.floor(e);i++)if(a[i-1]<0&&a[i]>=0)z++;return z/((e-s)/sr)};
 async function run(id,v,secs,feed,after,ch=1){const d=P.def[id],base={};for(const k of d.knobs)base[k.k]=k.def;if(d.steps)base[d.steps.k]=d.steps.def;const oc=new OfflineAudioContext(ch,Math.floor(sr*secs),sr);await P.ready(oc);const p=P.makePedal(oc,id,{...base,...v});feed(oc,p.input);p.output.connect(oc.destination);p.setOn(true);if(after)after(oc,p);const r=await oc.startRendering();return ch===2?[r.getChannelData(0),r.getChannelData(1)]:r.getChannelData(0)}
 const sine=(hz,dur=99)=>(oc,dst)=>{const o=oc.createOscillator();o.frequency.value=hz;const g=oc.createGain();g.gain.value=.5;o.connect(g);g.connect(dst);o.start();o.stop(dur)};
 const burst=(dur=.05)=>(oc,dst)=>{const n=Math.floor(sr*dur),bf=oc.createBuffer(1,n,sr),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*.8;const s=oc.createBufferSource();s.buffer=bf;s.connect(dst);s.start(0)};
 let a=await run('octave',{sub:0,up:100,dry:0},1.5,sine(440));out.octUp=Math.round(freq(a,sr*.5,sr*1.4));
 a=await run('pitchshift',{semi:-12,mix:100},1.5,sine(440));out.shiftDown=Math.round(freq(a,sr*.5,sr*1.4));
 a=await run('pitchdelay',{time:400,repeats:0,mix:100,interval:12},1.4,sine(330,.3));out.pdEchoHz=Math.round(freq(a,sr*.5,sr*.65));
 a=await run('reverb',{type:4,decay:15,mod:100,mix:100},20,burst(.3));out.shim=[rms(a,sr*1,sr*3),rms(a,sr*8,sr*10),rms(a,sr*17,sr*19)].map(x=>+x.toFixed(5));
 a=await run('freeze',{len:500,level:100,dry:0},7,(oc,dst)=>{const n=Math.floor(sr*1.5),bf=oc.createBuffer(1,n,sr),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*.4;const s=oc.createBufferSource();s.buffer=bf;s.connect(dst);s.start(0)},(oc,p)=>{p.setOn(false);oc.suspend(1.2).then(()=>{p.setOn(true);oc.resume()});oc.suspend(5).then(()=>{p.setOn(false);oc.resume()})});
 out.frz=[rms(a,sr*2,sr*3),rms(a,sr*4,sr*5),rms(a,sr*6.2,sr*7)].map(x=>+x.toFixed(4));
 // マイクロループ：330Hz を 1.2 秒流して止める。1.0 秒でつかむ（そのまま・1倍）→ 音が止まった後の 3〜4 秒にも 330Hz が鳴り続ける
 a=await run('microloop',{len:.5,speed:1,fb:0,mix:100},5,sine(330,1.2),(oc,p)=>{oc.suspend(1).then(()=>{p.action('hold');oc.resume()})});out.loop={hz:Math.round(freq(a,sr*3,sr*4)),rms:+rms(a,sr*3,sr*4).toFixed(4)};
 // 2倍速でつかむと 660Hz
 a=await run('microloop',{len:.5,speed:2,fb:0,mix:100},3,sine(330,1.2),(oc,p)=>{oc.suspend(1).then(()=>{p.action('hold');oc.resume()})});out.loop2=Math.round(freq(a,sr*1.8,sr*2.6));
 // テープ合奏：440Hz の音を聞き取って、オクターブ 0 で 440Hz 付近を鳴らす
 a=await run('tapeensemble',{oct:0,voice:0,mix:100,sens:-80,attack:.02},2,sine(440));out.mel=Math.round(freq(a,sr*1,sr*1.9));out.melRms=+rms(a,sr*1,sr*1.9).toFixed(3);
 // スウェル：音の頭は小さく、1.2 秒後には大きい
 a=await run('swell',{rise:1,sens:-50},2,sine(440));out.swell=[+rms(a,sr*.05,sr*.15).toFixed(3),+rms(a,sr*1.3,sr*1.5).toFixed(3)];
 // ロッシー：欠けがある（20ms ごとの音量の最小が 0 に近い区間がある）
 a=await run('lossy',{loss:90,quality:80,smear:0},3,sine(440));{const w=[];for(let t=.3;t<2.9;t+=.01)w.push(rms(a,sr*t,sr*(t+.01)));out.lossy=[+Math.min(...w).toFixed(3),+Math.max(...w).toFixed(3)]}
 // 記憶のやまびこ：入力が止まった後も、過去の音の粒が鳴る
 a=await run('memorydelay',{spread:2,size:.2,repeats:0,mix:100,mode:0},4,sine(440,1));out.mem=+rms(a,sr*1.5,sr*3).toFixed(3);
 // リバースディレイ：止めた後も逆向きの音が出る
 a=await run('reversedelay',{len:.5,fb:0,mix:100},2,sine(440,.5));out.rev=+rms(a,sr*.55,sr*.95).toFixed(3);
 // マルチリバーブ：8種類とも数値が壊れず、残響が出る
 out.verbs=[];for(let t=0;t<8;t++){const b=await run('reverb',{type:t,decay:2,mix:100},3,burst(.05));let fin=true;for(const x of b)if(!Number.isFinite(x)){fin=false;break}out.verbs.push(fin&&rms(b,sr*.3,sr*1)>.0005)}
 // マルチコーラス：6種類とも鳴る
 out.chos=[];for(let t=0;t<6;t++){const b=await run('chorus',{type:t,mix:100,depth:80},1.5,sine(440));out.chos.push(+rms(b,sr*.5,sr*1.4).toFixed(3))}
 // ハーモニックトレモロ：低い音と高い音が逆に揺れる
 {const oc=new OfflineAudioContext(1,sr*2,sr),d=P.def.tremolo,v={};for(const k of d.knobs)v[k.k]=k.def;v.shape=2;v.depth=100;v.rate=4;const p=P.makePedal(oc,'tremolo',v);const lo=oc.createOscillator(),hi=oc.createOscillator();lo.frequency.value=150;hi.frequency.value=3000;
  const glo=oc.createGain(),ghi=oc.createGain();glo.gain.value=.3;ghi.gain.value=.3;lo.connect(glo);hi.connect(ghi);glo.connect(p.input);ghi.connect(p.input);p.output.connect(oc.destination);p.setOn(true);lo.start();hi.start();await oc.startRendering().then(()=>{});out.htrem=true}
 // ピンポン：左が先、右が後
 const [L,Rr]=await run('pingpong',{time:300,repeats:40,mix:100},1.2,burst(),null,2);out.pp=[rms(L,sr*.3,sr*.36),rms(Rr,sr*.3,sr*.36),rms(Rr,sr*.6,sr*.66),rms(L,sr*.6,sr*.66)].map(x=>+x.toFixed(4));
 // トレモロ：音量が揺れる（深さ 100%）
 a=await run('tremolo',{rate:4,depth:100},2,sine(440));{const w=[];for(let t=.5;t<1.5;t+=.025)w.push(rms(a,sr*t,sr*(t+.02)));out.trem=[+Math.min(...w).toFixed(3),+Math.max(...w).toFixed(3)]}
 // リングモジュレーター：440Hz × 180Hz → 440 ではなくなる
 a=await run('ringmod',{freq:180,mix:100},1.5,sine(440));out.ringHz=Math.round(freq(a,sr*.5,sr*1.4));
 // スタッター：繰り返しの間、元の音が切り替わる
 a=await run('stutter',{len:100,repeats:4,chance:0},1.5,sine(440),(oc,p)=>{oc.suspend(.5).then(()=>{p.fire();oc.resume()})});out.stut=+rms(a,sr*.6,sr*.85).toFixed(3);
 // ── v0.91 で足した台 ──
 a=await run('freqshift',{shift:100,mix:100},1.5,sine(440));out.fsh=Math.round(freq(a,sr*.5,sr*1.4));
 a=await run('pitchbend',{bend:12,mix:100},1.5,sine(440));out.bend=Math.round(freq(a,sr*.5,sr*1.4));
 a=await run('subharmonic',{sub1:100,sub2:0,dry:0},1.5,sine(440));out.sub=Math.round(freq(a,sr*.5,sr*1.4));
 a=await run('gate',{thr:-30},1,(oc,dst)=>{const o=oc.createOscillator(),g=oc.createGain();g.gain.value=.005;o.connect(g);g.connect(dst);o.start()});out.gate=+rms(a,sr*.3,sr*.9).toFixed(5);
 a=await run('decimator',{rate:1000,bits:4,mix:100},1,sine(440));{let st=0;for(let i=sr*.3+1;i<sr*.9;i++)if(a[i]!==a[i-1])st++;out.dec=st}
 a=await run('infinite',{decay:85,mix:100,size:1},6,burst(.2),(oc,p)=>{oc.suspend(.5).then(()=>{p.action('hold');oc.resume()})});out.inf=[+rms(a,sr*.6,sr*1).toFixed(4),+rms(a,sr*5,sr*6).toFixed(4)];
 a=await run('tapestop',{time:1,start:.5},2.5,sine(440),(oc,p)=>{p.setOn(false);oc.suspend(.5).then(()=>{p.setOn(true);oc.resume()})});out.ts=[Math.round(freq(a,sr*.55,sr*.75)),Math.round(freq(a,sr*1.05,sr*1.25))];
 a=await run('resonator',{root:57,chord:0,decay:40,mix:100},2,burst(1.5));out.reso=+rms(a,sr*.3,sr*1.3).toFixed(4);
 {const oc=new OfflineAudioContext(1,sr/2,sr),d=P.def.combfilter,v={};for(const k of d.knobs)v[k.k]=k.def;Object.assign(v,{freq:220,feedback:50,mix:100,tone:100});const p=P.makePedal(oc,'combfilter',v);const bf=oc.createBuffer(1,64,sr);bf.getChannelData(0)[0]=1;const s=oc.createBufferSource();s.buffer=bf;s.connect(p.input);p.output.connect(oc.destination);p.setOn(true);s.start(.1);const r=await oc.startRendering(),aa=r.getChannelData(0);
  const pk=[];for(let i=1;i<aa.length-1;i++)if(Math.abs(aa[i])>.02&&Math.abs(aa[i])>=Math.abs(aa[i-1])&&Math.abs(aa[i])>=Math.abs(aa[i+1])){if(!pk.length||i-pk[pk.length-1]>20)pk.push(i)}out.comb=Math.round(sr/(pk[2]-pk[1]))}
 // ── v0.92 で足した台 ──
 a=await run('reverser',{len:.5,mix:100},2,sine(440,.6));out.rvs=+rms(a,sr*.65,sr*1.05).toFixed(3);
 a=await run('expander',{thr:-30,ratio:4},1,(oc,dst)=>{const o=oc.createOscillator(),g=oc.createGain();g.gain.value=.01;o.connect(g);g.connect(dst);o.start()});out.exp=+rms(a,sr*.3,sr*.9).toFixed(5);
 {const pluck=(oc,dst)=>{const o=oc.createOscillator(),g=oc.createGain();o.frequency.value=440;g.gain.setValueAtTime(.5,0);g.gain.setTargetAtTime(0,.01,.15);o.connect(g);g.connect(dst);o.start()};const t0=await run('transient',{attack:0,sustain:0},1,pluck),t1=await run('transient',{attack:100,sustain:0},1,pluck),t2=await run('transient',{attack:0,sustain:100},1,pluck);out.tr=[rms(t0,0,sr*.01),rms(t1,0,sr*.01),rms(t0,sr*.3,sr*.5),rms(t2,sr*.3,sr*.5)].map(x=>+x.toFixed(4))}
 a=await run('vocoder',{root:48,q:8,mix:100,chord:0},1.5,(oc,dst)=>{const n=Math.floor(sr*1.5),bf=oc.createBuffer(1,n,sr),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*.5;const s=oc.createBufferSource();s.buffer=bf;s.connect(dst);s.start(0)});out.voc=+rms(a,sr*.5,sr*1.4).toFixed(4);
 a=await run('vocoder',{root:48,q:8,mix:100,chord:0},1.5,()=>{});out.vocSilent=+rms(a,sr*.5,sr*1.4).toFixed(5);
 a=await run('humremover',{depth:100,low:20,mains:0},1.5,sine(50));out.hum50=+rms(a,sr*.6,sr*1.4).toFixed(4);
 a=await run('humremover',{depth:100,low:20,mains:0},1.5,sine(440));out.hum440=+rms(a,sr*.6,sr*1.4).toFixed(4);
 a=await run('bandlimit',{low:20,high:1000,slope:1},1.5,sine(5000));out.blHi=+rms(a,sr*.6,sr*1.4).toFixed(4);
 a=await run('longdelay',{time:2,repeats:0,mix:100,tone:100},3,burst(.1));out.ld=[+rms(a,sr*1,sr*1.8).toFixed(4),+rms(a,sr*2,sr*2.2).toFixed(4)];
 {const [L,Rr]=await run('utility',{gain:0,pan:-100,width:100,mono:0},1,sine(440),null,2);out.utPan=[+rms(L,sr*.3,sr*.9).toFixed(3),+rms(Rr,sr*.3,sr*.9).toFixed(3)]}
 a=await run('tilteq',{tilt:12,center:900},1.2,sine(5000));out.tilt=+rms(a,sr*.4,sr*1.1).toFixed(3);
 a=await run('whammy',{interval:12,rate:.05,mix:100,shape:0},1.5,sine(440));out.wham=+rms(a,sr*.5,sr*1.4).toFixed(3);
 return out});
const D=R.dsp;
ok('reverser',D.rvs>.01);ok('expander',D.exp<.002);ok('transient',D.tr[1]>D.tr[0]*1.3&&D.tr[3]>D.tr[2]*1.3);ok('vocoder',D.voc>.003&&D.vocSilent<.0005);ok('hum_remover',D.hum50<D.hum440*.1);ok('band_limit',D.blHi<.02);ok('long_delay',D.ld[0]<.002&&D.ld[1]>.01);ok('utility_pan',D.utPan[1]<.01&&D.utPan[0]>.1);ok('tilt_eq',D.tilt>.5);ok('whammy',D.wham>.05);
ok('freqshift',Math.abs(D.fsh-540)<15);ok('pitchbend',Math.abs(D.bend-880)<25);ok('subharmonic',Math.abs(D.sub-220)<12);ok('gate_cuts_quiet',D.gate<.0005);ok('decimator',D.dec<700);
ok('infinite_hold',D.inf[1]>D.inf[0]*.2);ok('tapestop',D.ts[0]<430&&D.ts[1]<D.ts[0]*.6);ok('resonator',D.reso>.003);ok('combfilter',Math.abs(D.comb-220)<20);
ok('octave_up',Math.abs(D.octUp-880)<25);ok('pitch_shift',Math.abs(D.shiftDown-220)<12);ok('pitch_delay',Math.abs(D.pdEchoHz-660)<30);
ok('shimmer_stable',D.shim[1]<D.shim[0]&&D.shim[2]<D.shim[1]);ok('freeze',D.frz[0]>.05&&Math.abs(D.frz[1]/D.frz[0]-1)<.25&&D.frz[2]<.002);
ok('microloop',Math.abs(D.loop.hz-330)<12&&D.loop.rms>.05&&Math.abs(D.loop2-660)<25);ok('tape_ensemble',Math.abs(D.mel-440)<15&&D.melRms>.02);ok('swell',D.swell[0]<D.swell[1]*.3);ok('lossy',D.lossy[0]<.02&&D.lossy[1]>.1);ok('memory',D.mem>.01);ok('reverse_delay',D.rev>.01);ok('multi_reverb',D.verbs.every(Boolean));ok('multi_chorus',D.chos.every(x=>x>.05));ok('pingpong',D.pp[0]>.01&&D.pp[1]<D.pp[0]*.2&&D.pp[2]>.005&&D.pp[3]<D.pp[2]*.3);
ok('tremolo',D.trem[0]<.05&&D.trem[1]>.25);ok('ringmod',Math.abs(D.ringHz-440)>40);ok('stutter',D.stut>.1);
// ── 画面 ──
await pg.evaluate(()=>{document.getElementById('pedalSection').open=true});
R.empty=await pg.evaluate(()=>({cards:document.querySelectorAll('.pdCard').length,chips:[...document.querySelectorAll('.pdChip')].map(b=>b.dataset.pedal)}));ok('empty_board',R.empty.cards===0&&R.empty.chips.join()==='microloop,reverb,tape,freeze');
await pg.click('.pdChip[data-pedal="tape"]');await pg.click('#pdAdd');await pg.waitForTimeout(200);
R.cat=await pg.evaluate(()=>({items:document.querySelectorAll('.pdCatItem').length,groups:document.querySelectorAll('.pdCatGroup').length,tapeDisabled:document.querySelector('.pdCatItem[data-pedal="tape"]').disabled}));ok('catalog',R.cat.items===100&&R.cat.groups===10&&R.cat.tapeDisabled);
await pg.fill('#pdSearch','ドップラー');await pg.waitForTimeout(150);R.search=await pg.evaluate(()=>[...document.querySelectorAll('.pdCatItem')].map(b=>b.dataset.pedal).join());
await pg.fill('#pdSearch','rotary');await pg.waitForTimeout(150);R.search2=await pg.evaluate(()=>[...document.querySelectorAll('.pdCatItem')].map(b=>b.dataset.pedal).join());
await pg.fill('#pdSearch','zzzz');await pg.waitForTimeout(150);R.search3=await pg.evaluate(()=>document.getElementById('pdCatalog').textContent.includes('見つかりませんでした'));
ok('search',R.search==='doppler'&&R.search2.split(',').includes('rotary')&&R.search3);await pg.fill('#pdSearch','');await pg.waitForTimeout(150);
for(const id of ['reverb','fuzz','chorus'])await pg.click('.pdCatItem[data-pedal="'+id+'"]');
R.order=await pg.evaluate(()=>[...document.querySelectorAll('.pdCard')].map(c=>c.dataset.pedal).join());ok('catalog_order',R.order==='fuzz,chorus,tape,reverb');
await pg.click('.pdCard[data-pedal="reverb"] .pdMove[data-dir="-1"]');R.moved=await pg.evaluate(()=>__pedals.state().chain.map(e=>e.id).join());ok('move',R.moved==='fuzz,chorus,reverb,tape');
await pg.click('.pdCard[data-pedal="chorus"] .pdRemove');ok('remove',await pg.evaluate(()=>__pedals.state().chain.map(e=>e.id).join()==='fuzz,reverb,tape'&&!document.querySelector('.pdCard[data-pedal="chorus"]')&&!document.querySelector('.pdCatItem[data-pedal="chorus"]').disabled));
// つまみ：キーで回す・ダブルクリックで戻す
await pg.focus('.pdCard[data-pedal="fuzz"] .pdDial[data-k="tone"]');await pg.keyboard.press('ArrowUp');await pg.keyboard.press('ArrowUp');
R.knob=await pg.evaluate(()=>({v:__pedals.state().chain.find(e=>e.id==='fuzz').v.tone,txt:document.querySelector('.pdCard[data-pedal="fuzz"] output[data-k="tone"]').textContent,aria:document.querySelector('.pdCard[data-pedal="fuzz"] .pdDial[data-k="tone"]').getAttribute('aria-valuenow')}));
await pg.dblclick('.pdCard[data-pedal="fuzz"] .pdDial[data-k="tone"]');R.reset=await pg.evaluate(()=>__pedals.state().chain.find(e=>e.id==='fuzz').v.tone);
ok('knob',R.knob.v===54&&R.knob.txt==='54%'&&R.knob.aria==='54'&&R.reset===50);
// 8台まで
await pg.evaluate(()=>{for(const id of ['freeze','octave','overdrive','phaser','microloop','glitch','eq3'])__pedals.add(id)});
R.full=await pg.evaluate(()=>({n:__pedals.state().chain.length,disabled:[...document.querySelectorAll('.pdCatItem')].every(b=>b.disabled),note:!!document.querySelector('.pdFull'),count:document.getElementById('pdCount').textContent}));ok('max_eight',R.full.n===8&&R.full.disabled&&R.full.note&&R.full.count==='8 / 8');
// 全体の音がペダルを通る（自然の録音を含む）：ファズの音量 0 で無音、外すと戻る
await pg.evaluate(()=>{for(const id of [...__pedals.state().chain.map(e=>e.id)])__pedals.remove(id);__pedals.add('fuzz');__pedals.setVal('fuzz','level',0);__pedals.setOn('fuzz',false)});
await pg.click('#play');await pg.waitForTimeout(6000);
const m=async()=>{let s=0;for(let i=0;i<12;i++){s+=await pg.evaluate(()=>__pedals.probe());await pg.waitForTimeout(80)}return +(s/12).toFixed(4)};
R.route={off:await m()};await pg.evaluate(()=>__pedals.setOn('fuzz',true));await pg.waitForTimeout(600);R.route.fuzz0=await m();await pg.evaluate(()=>__pedals.setOn('fuzz',false));await pg.waitForTimeout(600);R.route.back=await m();
ok('whole_mix_through_pedals',R.route.off>.001&&R.route.fuzz0<R.route.off*.05&&R.route.back>R.route.off*.5);
// 試聴もペダルを通る：オンの間に試聴 → audio 要素が Web Audio に入る（ファズ 0 で無音、外すと聞こえる）
R.prev=await pg.evaluate(async()=>{__pedals.setOn('fuzz',true);const btn=[...document.querySelectorAll('button')].find(b=>/試聴|▶ 聴く|聴く/.test(b.textContent)&&b.closest('[data-resident-id]'));if(!btn)return {btn:false};btn.click();await new Promise(r=>setTimeout(r,2500));
 const el=document.getElementById('previewPlayer');const a=__pedals.probe();__pedals.setOn('fuzz',false);await new Promise(r=>setTimeout(r,800));let s=0;for(let i=0;i<8;i++){s+=__pedals.probe();await new Promise(r=>setTimeout(r,80))}
 return {btn:true,playing:!el.paused,muted:a,heard:s/8,ctx:document.getElementById('play').getAttribute('aria-pressed')}});
ok('preview_through_pedals',R.prev.btn&&R.prev.playing&&R.prev.muted<.0005&&R.prev.heard>.0005);
// プリセット：今の形式と旧形式（v0.86）
R.preset=await pg.evaluate(()=>{const now=__pedals.preset();const okNow=now.v===2&&now.chain.length===1&&now.chain[0].id==='fuzz';
 __pedals.applyPreset({target:'sampler',p:{fuzz:{on:true,v:{tone:80}},shimmer:{on:true,v:{mix:70}},tape:{on:false,v:{}}}});const s=__pedals.state();
 const okOld=s.target==='sampler'&&s.chain.map(e=>e.id+(e.on?'+':'-')).join()==='fuzz+,reverb+'&&s.chain[0].v.tone===80&&s.chain[1].v.type===4&&s.chain[1].v.mix===70;
 __pedals.applyPreset({v:2,target:'master',chain:[{id:'nope'},{id:'reverb',on:true,v:{decay:999,mix:'x'}},{id:'reverb'},{id:'looper'},{id:'vibrato',on:true,v:{rate:3}}]});const s2=__pedals.state();
 return {okNow,okOld,clean:s2.chain.map(e=>e.id).join()==='reverb,chorus'&&s2.chain[0].v.decay===15&&s2.chain[0].v.mix===40&&s2.chain[1].v.type===1&&s2.chain[1].v.rate===3}});
ok('preset',R.preset.okNow&&R.preset.okOld&&R.preset.clean);
// 英語
await pg.evaluate(()=>{__pedals.add('microloop');__pedals.add('tapeensemble');document.getElementById('pdAdd').click()});
await pg.selectOption('#langSelect','en');await pg.waitForTimeout(500);
R.en=await pg.evaluate(()=>{const s=document.getElementById('pedalSection');s.querySelectorAll('details').forEach(d=>d.open=true);const jp=/[぀-ヿ一-鿿]/;const left=[];const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(t&&jp.test(t)&&n.parentElement.checkVisibility())left.push(t)}
 for(const e of s.querySelectorAll('[aria-label]'))if(jp.test(e.getAttribute('aria-label')))left.push('@'+e.getAttribute('aria-label'));return {left:[...new Set(left)].slice(0,12),name:s.querySelector('.pdCard[data-pedal="microloop"] .pdName').textContent}});
ok('english',R.en.left.length===0&&R.en.name==='Micro-looper');
await pg.selectOption('#langSelect','ja');await pg.waitForTimeout(300);ok('back_ja',await pg.evaluate(()=>document.querySelector('.pdCard[data-pedal="microloop"] .pdName').textContent==='マイクロループ'));
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{document.getElementById('pdAdd').click();document.getElementById('pedalSection').scrollIntoView()});await pg.waitForTimeout(200);await pg.screenshot({path:'/tmp/pedals2.png'});
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon|404/.test(e));ok('no_errors',R.errs.length===0);
console.log(JSON.stringify({...R,all:undefined},null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
