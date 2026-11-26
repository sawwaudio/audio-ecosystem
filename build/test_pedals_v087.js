// v0.87 ペダルボード 第2版の回帰テスト。python3 -m http.server 8765 で本体を配信して実行する。
// 音：30台すべてをオフラインで鳴らす（数値が壊れない・大きすぎない・鳴る・オフは素通し）。主な台は中身も確かめる。
// つなぎ：自然の録音を含む全体の音がペダルを通ること、試聴（audio 要素）もペダルを通ること。
// 画面：空のボード→おすすめ→カタログで足す・外す・並べ替え・8台まで・つまみ（キー・ダブルクリック）・プリセット（旧形式も）・英語・はみ出し。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];
const pg=await b.newPage({viewport:{width:390,height:900}});pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await pg.goto('http://localhost:8765/index.html?lang=ja');await pg.waitForTimeout(1200);
R.count=await pg.evaluate(()=>__pedals.ids.length);ok('thirty',R.count===30);
// ── 音（オフライン） ──
R.all=await pg.evaluate(async()=>{const P=__pedals,sr=44100,out={};
 for(const id of P.ids){const d=P.def[id],v={};for(const k of d.knobs)v[k.k]=k.def;if(d.steps)v[d.steps.k]=d.steps.def;
  const res={};for(const on of [true,false]){const oc=new OfflineAudioContext(2,sr*2,sr),p=P.makePedal(oc,id,v),o=oc.createOscillator(),g=oc.createGain();o.frequency.value=220;g.gain.value=.4;o.connect(g);g.connect(p.input);p.output.connect(oc.destination);o.start();o.stop(1.2);
   if(on){p.setOn(true);if(d.mode==='looper'){oc.suspend(.1).then(()=>{p.action('rec');oc.resume()});oc.suspend(.6).then(()=>{p.action('rec');oc.resume()})}if(d.mode==='stutter')oc.suspend(.5).then(()=>{p.fire();oc.resume()});if(d.mode==='freeze')oc.suspend(.6).then(()=>{oc.resume()})}
   const r=await oc.startRendering(),a=r.getChannelData(0),c=r.getChannelData(1);let pk=0,s=0,fin=true;for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(c[i]))fin=false;pk=Math.max(pk,Math.abs(a[i]),Math.abs(c[i]));if(i>sr*.3&&i<sr*1.1)s+=a[i]*a[i]}
   res[on?'on':'off']={fin,pk:+pk.toFixed(3),rms:+Math.sqrt(s/(sr*.8)).toFixed(4)}}
  out[id]=res}
 return out});
R.bad=Object.entries(R.all).filter(([id,r])=>!r.on.fin||!r.off.fin||r.on.pk>3||r.on.rms<.003||Math.abs(r.off.rms-.2828)>.02).map(([id,r])=>id+':'+JSON.stringify(r));
ok('all_pedals_sound',R.bad.length===0);
R.dsp=await pg.evaluate(async()=>{const P=__pedals,sr=48000,out={};
 const rms=(a,s,e)=>{let x=0;for(let i=Math.floor(s);i<Math.floor(e);i++)x+=a[i]*a[i];return Math.sqrt(x/Math.max(1,e-s))};
 const freq=(a,s,e)=>{let z=0;for(let i=Math.floor(s)+1;i<Math.floor(e);i++)if(a[i-1]<0&&a[i]>=0)z++;return z/((e-s)/sr)};
 async function run(id,v,secs,feed,after,ch=1){const d=P.def[id],base={};for(const k of d.knobs)base[k.k]=k.def;if(d.steps)base[d.steps.k]=d.steps.def;const oc=new OfflineAudioContext(ch,Math.floor(sr*secs),sr),p=P.makePedal(oc,id,{...base,...v});feed(oc,p.input);p.output.connect(oc.destination);p.setOn(true);if(after)after(oc,p);const r=await oc.startRendering();return ch===2?[r.getChannelData(0),r.getChannelData(1)]:r.getChannelData(0)}
 const sine=(hz,dur=99)=>(oc,dst)=>{const o=oc.createOscillator();o.frequency.value=hz;const g=oc.createGain();g.gain.value=.5;o.connect(g);g.connect(dst);o.start();o.stop(dur)};
 const burst=(dur=.05)=>(oc,dst)=>{const n=Math.floor(sr*dur),bf=oc.createBuffer(1,n,sr),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*.8;const s=oc.createBufferSource();s.buffer=bf;s.connect(dst);s.start(0)};
 let a=await run('octave',{sub:0,up:100,dry:0},1.5,sine(440));out.octUp=Math.round(freq(a,sr*.5,sr*1.4));
 a=await run('pitchshift',{semi:-12,mix:100},1.5,sine(440));out.shiftDown=Math.round(freq(a,sr*.5,sr*1.4));
 a=await run('pitchdelay',{time:400,repeats:0,mix:100,interval:12},1.4,sine(330,.3));out.pdEchoHz=Math.round(freq(a,sr*.5,sr*.65));
 a=await run('shimmer',{decay:12,shimmer:100,mix:100},20,burst(.3));out.shim=[rms(a,sr*1,sr*3),rms(a,sr*8,sr*10),rms(a,sr*17,sr*19)].map(x=>+x.toFixed(5));
 a=await run('freeze',{len:500,level:100,dry:0},7,(oc,dst)=>{const n=Math.floor(sr*1.5),bf=oc.createBuffer(1,n,sr),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*.4;const s=oc.createBufferSource();s.buffer=bf;s.connect(dst);s.start(0)},(oc,p)=>{p.setOn(false);oc.suspend(1.2).then(()=>{p.setOn(true);oc.resume()});oc.suspend(5).then(()=>{p.setOn(false);oc.resume()})});
 out.frz=[rms(a,sr*2,sr*3),rms(a,sr*4,sr*5),rms(a,sr*6.2,sr*7)].map(x=>+x.toFixed(4));
 // ルーパー：0.2〜1.2秒に 330Hz を録る（長さ 1秒）→ 音が止まった後の 3〜4 秒にも 330Hz が鳴り続ける → 止めると消える
 a=await run('looper',{len:1,level:100},6,sine(330,1.25),(oc,p)=>{oc.suspend(.2).then(()=>{p.action('rec');oc.resume()});oc.suspend(1.2).then(()=>{p.action('rec');oc.resume()});oc.suspend(4.5).then(()=>{p.action('play');oc.resume()})});
 out.loop={hz:Math.round(freq(a,sr*3,sr*4)),rms:+rms(a,sr*3,sr*4).toFixed(4),after:+rms(a,sr*5,sr*6).toFixed(4)};
 // ピンポン：左が先、右が後
 const [L,Rr]=await run('pingpong',{time:300,repeats:40,mix:100},1.2,burst(),null,2);out.pp=[rms(L,sr*.3,sr*.36),rms(Rr,sr*.3,sr*.36),rms(Rr,sr*.6,sr*.66),rms(L,sr*.6,sr*.66)].map(x=>+x.toFixed(4));
 // トレモロ：音量が揺れる（深さ 100%）
 a=await run('tremolo',{rate:4,depth:100},2,sine(440));{const w=[];for(let t=.5;t<1.5;t+=.025)w.push(rms(a,sr*t,sr*(t+.02)));out.trem=[+Math.min(...w).toFixed(3),+Math.max(...w).toFixed(3)]}
 // リングモジュレーター：440Hz × 180Hz → 440 ではなくなる
 a=await run('ringmod',{freq:180,mix:100},1.5,sine(440));out.ringHz=Math.round(freq(a,sr*.5,sr*1.4));
 // スタッター：繰り返しの間、元の音が切り替わる
 a=await run('stutter',{len:100,repeats:4,chance:0},1.5,sine(440),(oc,p)=>{oc.suspend(.5).then(()=>{p.fire();oc.resume()})});out.stut=+rms(a,sr*.6,sr*.85).toFixed(3);
 return out});
const D=R.dsp;
ok('octave_up',Math.abs(D.octUp-880)<25);ok('pitch_shift',Math.abs(D.shiftDown-220)<12);ok('pitch_delay',Math.abs(D.pdEchoHz-660)<30);
ok('shimmer_stable',D.shim[1]<D.shim[0]&&D.shim[2]<D.shim[1]);ok('freeze',D.frz[0]>.05&&Math.abs(D.frz[1]/D.frz[0]-1)<.25&&D.frz[2]<.002);
ok('looper',Math.abs(D.loop.hz-330)<12&&D.loop.rms>.05&&D.loop.after<.005);ok('pingpong',D.pp[0]>.01&&D.pp[1]<D.pp[0]*.2&&D.pp[2]>.005&&D.pp[3]<D.pp[2]*.3);
ok('tremolo',D.trem[0]<.05&&D.trem[1]>.25);ok('ringmod',Math.abs(D.ringHz-440)>40);ok('stutter',D.stut>.1);
// ── 画面 ──
await pg.evaluate(()=>{document.getElementById('pedalSection').open=true});
R.empty=await pg.evaluate(()=>({cards:document.querySelectorAll('.pdCard').length,chips:[...document.querySelectorAll('.pdChip')].map(b=>b.dataset.pedal)}));ok('empty_board',R.empty.cards===0&&R.empty.chips.length===4);
await pg.click('.pdChip[data-pedal="tape"]');await pg.click('#pdAdd');await pg.waitForTimeout(200);
R.cat=await pg.evaluate(()=>({items:document.querySelectorAll('.pdCatItem').length,groups:document.querySelectorAll('.pdCatGroup').length,tapeDisabled:document.querySelector('.pdCatItem[data-pedal="tape"]').disabled}));ok('catalog',R.cat.items===30&&R.cat.groups===9&&R.cat.tapeDisabled);
for(const id of ['shimmer','fuzz','chorus'])await pg.click('.pdCatItem[data-pedal="'+id+'"]');
R.order=await pg.evaluate(()=>[...document.querySelectorAll('.pdCard')].map(c=>c.dataset.pedal).join());ok('catalog_order',R.order==='fuzz,chorus,tape,shimmer');
await pg.click('.pdCard[data-pedal="shimmer"] .pdMove[data-dir="-1"]');R.moved=await pg.evaluate(()=>__pedals.state().chain.map(e=>e.id).join());ok('move',R.moved==='fuzz,chorus,shimmer,tape');
await pg.click('.pdCard[data-pedal="chorus"] .pdRemove');ok('remove',await pg.evaluate(()=>__pedals.state().chain.map(e=>e.id).join()==='fuzz,shimmer,tape'&&!document.querySelector('.pdCard[data-pedal="chorus"]')&&!document.querySelector('.pdCatItem[data-pedal="chorus"]').disabled));
// つまみ：キーで回す・ダブルクリックで戻す
await pg.focus('.pdCard[data-pedal="fuzz"] .pdDial[data-k="tone"]');await pg.keyboard.press('ArrowUp');await pg.keyboard.press('ArrowUp');
R.knob=await pg.evaluate(()=>({v:__pedals.state().chain.find(e=>e.id==='fuzz').v.tone,txt:document.querySelector('.pdCard[data-pedal="fuzz"] output[data-k="tone"]').textContent,aria:document.querySelector('.pdCard[data-pedal="fuzz"] .pdDial[data-k="tone"]').getAttribute('aria-valuenow')}));
await pg.dblclick('.pdCard[data-pedal="fuzz"] .pdDial[data-k="tone"]');R.reset=await pg.evaluate(()=>__pedals.state().chain.find(e=>e.id==='fuzz').v.tone);
ok('knob',R.knob.v===54&&R.knob.txt==='54%'&&R.knob.aria==='54'&&R.reset===50);
// 8台まで
await pg.evaluate(()=>{for(const id of ['freeze','octave','overdrive','phaser','reverb','looper','eq3'])__pedals.add(id)});
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
 const okOld=s.target==='sampler'&&s.chain.map(e=>e.id+(e.on?'+':'-')).join()==='fuzz+,shimmer+'&&s.chain[0].v.tone===80;
 __pedals.applyPreset({v:2,target:'master',chain:[{id:'nope'},{id:'reverb',on:true,v:{size:999,mix:'x'}},{id:'reverb'}]});const s2=__pedals.state();
 return {okNow,okOld,clean:s2.chain.length===1&&s2.chain[0].v.size===10&&s2.chain[0].v.mix===40}});
ok('preset',R.preset.okNow&&R.preset.okOld&&R.preset.clean);
// 英語
await pg.evaluate(()=>{__pedals.add('looper');__pedals.add('harmonizer');document.getElementById('pdAdd').click()});
await pg.selectOption('#langSelect','en');await pg.waitForTimeout(500);
R.en=await pg.evaluate(()=>{const s=document.getElementById('pedalSection');s.querySelectorAll('details').forEach(d=>d.open=true);const jp=/[぀-ヿ一-鿿]/;const left=[];const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(t&&jp.test(t)&&n.parentElement.checkVisibility())left.push(t)}
 for(const e of s.querySelectorAll('[aria-label]'))if(jp.test(e.getAttribute('aria-label')))left.push('@'+e.getAttribute('aria-label'));return {left:[...new Set(left)].slice(0,12),name:s.querySelector('.pdCard[data-pedal="looper"] .pdName').textContent}});
ok('english',R.en.left.length===0&&R.en.name==='Looper');
await pg.selectOption('#langSelect','ja');await pg.waitForTimeout(300);ok('back_ja',await pg.evaluate(()=>document.querySelector('.pdCard[data-pedal="looper"] .pdName').textContent==='ルーパー'));
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{document.getElementById('pdAdd').click();document.getElementById('pedalSection').scrollIntoView()});await pg.waitForTimeout(200);await pg.screenshot({path:'/tmp/pedals2.png'});
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon|404/.test(e));ok('no_errors',R.errs.length===0);
console.log(JSON.stringify({...R,all:undefined},null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
