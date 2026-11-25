/* v0.85 ペダルボード — ギター用エフェクターのような音の加工を、自然の音にかける（2026-11-25 オーナー「サンプラーの他にギターとかの面白いエフェクターを再現して自然音を加工して遊びたい」）。
   特定の製品の回路や音を写したものではなく、よく知られた種類（フリーズ・オクターブ・ファズ・テープ・ピッチディレイ・アナログディレイ・シマーリバーブ）を Web Audio で作ったもの。名前・見た目も製品に似せない。
   つなぐ順番は固定：フリーズ → オクターブ → ファズ → テープ → ピッチディレイ → アナログディレイ → シマー。
   かける場所は「全体（マスター）」か、ミキサーの1チャンネル（そのチャンネルの入口。残響の送りには掛からない）。
   ペダルは最初にオンにした時に作る（それまでは何もつながない）。ディレイ・残響はオフにしても余韻を残す。帰還はすべて 1 未満（フリーズだけは閉じ込めた音をそのまま回すので 1）。 */
(()=>{'use strict';
const ORDER=['freeze','octave','fuzz','tape','pitchdelay','analog','shimmer'];
const SEMI=[-12,-7,-5,5,7,12];
// つまみ：k＝キー、l＝名前、min・max・step・def、f＝表示
const pct=v=>Math.round(v)+'%',ms=v=>Math.round(v)+' ms',sec=v=>(+v).toFixed(1)+' s';
const DEF={
 freeze:{name:'フリーズ',desc:'押した瞬間の音を、離すまで伸ばし続ける',color:'#7fc8e8',knobs:[{k:'len',l:'つかむ長さ',min:200,max:2000,step:50,def:700,f:ms},{k:'level',l:'伸ばす音の大きさ',min:0,max:100,step:1,def:80,f:pct},{k:'dry',l:'元の音',min:0,max:100,step:1,def:100,f:pct}]},
 octave:{name:'オクターブ',desc:'1オクターブ下と上の音を足す',color:'#b99be6',knobs:[{k:'sub',l:'下のオクターブ',min:0,max:100,step:1,def:70,f:pct},{k:'up',l:'上のオクターブ',min:0,max:100,step:1,def:40,f:pct},{k:'dry',l:'元の音',min:0,max:100,step:1,def:80,f:pct}]},
 fuzz:{name:'ファズ',desc:'太く毛羽立った歪み。音色で中域を削る',color:'#e8925a',knobs:[{k:'sustain',l:'歪み',min:0,max:100,step:1,def:60,f:pct},{k:'tone',l:'音色（こもる ↔ 明るい）',min:0,max:100,step:1,def:50,f:pct},{k:'level',l:'音量',min:0,max:100,step:1,def:50,f:pct}]},
 tape:{name:'テープ',desc:'古いテープのような揺れ・こもり・途切れ',color:'#d8c27a',knobs:[{k:'wow',l:'ゆっくり揺れる',min:0,max:100,step:1,def:45,f:pct},{k:'flutter',l:'細かく揺れる',min:0,max:100,step:1,def:25,f:pct},{k:'age',l:'劣化',min:0,max:100,step:1,def:40,f:pct},{k:'drop',l:'途切れ',min:0,max:100,step:1,def:15,f:pct}]},
 pitchdelay:{name:'ピッチディレイ',desc:'繰り返すたびに音程が上がる（下がる）やまびこ',color:'#8fd39b',knobs:[{k:'time',l:'間隔',min:80,max:1000,step:10,def:380,f:ms},{k:'repeats',l:'繰り返し',min:0,max:75,step:1,def:45,f:pct},{k:'mix',l:'混ぜる量',min:0,max:100,step:1,def:55,f:pct}],steps:{k:'interval',l:'音程',def:7,opts:SEMI}},
 analog:{name:'アナログディレイ',desc:'暗く、ゆらゆら揺れるやまびこ',color:'#e07a8f',knobs:[{k:'time',l:'間隔',min:60,max:1000,step:10,def:450,f:ms},{k:'repeats',l:'繰り返し',min:0,max:85,step:1,def:50,f:pct},{k:'mod',l:'揺れ',min:0,max:100,step:1,def:35,f:pct},{k:'mix',l:'混ぜる量',min:0,max:100,step:1,def:45,f:pct}]},
 shimmer:{name:'シマー',desc:'1オクターブ上へ昇りながら広がる長い残響',color:'#f0e6b4',knobs:[{k:'decay',l:'残響の長さ',min:2,max:12,step:.5,def:6,f:sec},{k:'shimmer',l:'きらめき',min:0,max:100,step:1,def:55,f:pct},{k:'tone',l:'明るさ',min:0,max:100,step:1,def:60,f:pct},{k:'mix',l:'混ぜる量',min:0,max:100,step:1,def:45,f:pct}]}};
const TARGETS=['master','bio','field','music','sampler'];
const KEY='saww.pedals.v1';
const st={target:'master',p:{}};
for(const id of ORDER){st.p[id]={on:false,v:{}};for(const k of DEF[id].knobs)st.p[id].v[k.k]=k.def;if(DEF[id].steps)st.p[id].v[DEF[id].steps.k]=DEF[id].steps.def}
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object'){if(TARGETS.includes(s.target))st.target=s.target;for(const id of ORDER){const q=s.p&&s.p[id];if(!q||typeof q!=='object')continue;for(const k of DEF[id].knobs){const v=+(q.v||{})[k.k];if(Number.isFinite(v))st.p[id].v[k.k]=Math.min(k.max,Math.max(k.min,v))}const sd=DEF[id].steps;if(sd&&sd.opts.includes(+(q.v||{})[sd.k]))st.p[id].v[sd.k]=+q.v[sd.k]}}}catch(e){}
// フリーズ以外の「オン」は保存しない（開いた瞬間に音が変わらないように）
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({target:st.target,p:Object.fromEntries(ORDER.map(id=>[id,{v:st.p[id].v}]))}))}catch(e){}};

// ── 部品 ──
const G=(c,v=1)=>{const n=c.createGain();n.gain.value=v;return n};
const BQ=(c,t,f,q=.707)=>{const n=c.createBiquadFilter();n.type=t;n.frequency.value=f;n.Q.value=q;return n};
const tanhCurve=(k,n=4097)=>{const cv=new Float32Array(n),m=Math.tanh(k);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=Math.tanh(k*x)/m}return cv};
const T=(c,prm,v,tc=.03)=>prm.setTargetAtTime(v,c.currentTime,tc);
// 音程を変える部品（ディレイの長さを、のこぎり波で連続して伸び縮みさせる方式。2本の読み出しを半周期ずらし、sin² で重ねて継ぎ目を消す）
// ratio>1：遅れを W→0 へ縮める（速さ |1−ratio|/W 回/秒）、ratio<1：0→W へ伸ばす。sin²(πx)+sin²(π(x+½))＝1 なので音量は一定。
function shifter(c,ratio,W=.06){const input=G(c),output=G(c),n=c.sampleRate,up=ratio>1;
 const rb=c.createBuffer(1,n,n),gb=c.createBuffer(1,n,n),rd=rb.getChannelData(0),gd=gb.getChannelData(0);
 for(let i=0;i<n;i++){const x=i/n;rd[i]=up?W*(1-x):W*x;gd[i]=Math.sin(Math.PI*x)**2}
 const rate=Math.abs(1-ratio)/W,srcs=[],t0=c.currentTime+.01;
 for(const off of [0,.5]){const d=c.createDelay(W+.02),g=G(c,0);d.delayTime.value=0;const r=c.createBufferSource(),gg=c.createBufferSource();r.buffer=rb;gg.buffer=gb;r.loop=gg.loop=true;r.playbackRate.value=gg.playbackRate.value=rate;r.connect(d.delayTime);gg.connect(g.gain);r.start(t0,off);gg.start(t0,off);input.connect(d);d.connect(g);g.connect(output);srcs.push(r,gg)}
 return {input,output,stop(){for(const s of srcs)try{s.stop()}catch(e){}}}}
function noiseBuf(c,secs){const n=Math.floor(c.sampleRate*secs),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
function reverbIR(c,secs){const n=Math.max(256,Math.floor(c.sampleRate*secs)),b=c.createBuffer(2,n,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;for(let i=0;i<n;i++){const x=i/n,att=Math.min(1,i/(c.sampleRate*.012));lp+=(Math.random()*2-1-lp)*.55;d[i]=lp*att*Math.exp(-6.9*x)}}return b}

// ── ペダル1台 ── {input,output,setOn(on),set(k,v),stop()}
function makePedal(c,id,v){const input=G(c),output=G(c),dry=G(c,1),send=G(c,0),wet=G(c,0);input.connect(dry);dry.connect(output);input.connect(send);wet.connect(output);
 const P={id,input,output,on:false,stops:[],v:{...v},set(){},setOn(){},stop(){for(const s of P.stops)try{s.stop()}catch(e){}}};
 const lfo=(hz,type='sine')=>{const o=c.createOscillator();o.type=type;o.frequency.value=hz;o.start();P.stops.push(o);return o};
 // 挿し込み型（オンの間は元の音を加工した音に置き換える）
 const insert=()=>{P.setOn=on=>{P.on=on;T(c,dry.gain,on?0:1,.012);T(c,send.gain,on?1:0,.012);T(c,wet.gain,on?1:0,.012)}};
 // 余韻を残す型（オフでも入口だけ閉じて、鳴っている余韻は消さない）
 const trails=mixKey=>{P.setOn=on=>{P.on=on;T(c,send.gain,on?1:0,.012);if(on)T(c,wet.gain,P.v[mixKey]/100,.02)}};
 if(id==='freeze'){
  const gin=G(c,1),sum=G(c),d=c.createDelay(2.2),fb=G(c,0),hold=G(c,0);d.delayTime.value=v.len/1000;input.connect(gin);gin.connect(sum);sum.connect(d);d.connect(fb);fb.connect(sum);d.connect(hold);hold.connect(output);
  dry.gain.value=1;P.frozen=false;
  P.freeze=on=>{const t=c.currentTime;if(on&&!P.frozen){P.frozen=true;const L=P.v.len/1000,F=Math.min(.25,L*.4);d.delayTime.cancelScheduledValues(t);d.delayTime.setValueAtTime(L,t);
    for(const [g,a,b] of [[gin,1,0],[fb,0,1]]){g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(a,t);g.gain.linearRampToValueAtTime(b,t+F)}hold.gain.cancelScheduledValues(t);hold.gain.setTargetAtTime(P.v.level/100,t,.02);T(c,dry.gain,P.v.dry/100,.05)}
   else if(!on&&P.frozen){P.frozen=false;hold.gain.cancelScheduledValues(t);hold.gain.setTargetAtTime(0,t,.12);fb.gain.cancelScheduledValues(t);fb.gain.setValueAtTime(1,t+.7);fb.gain.linearRampToValueAtTime(0,t+.75);gin.gain.cancelScheduledValues(t);gin.gain.setValueAtTime(0,t+.7);gin.gain.linearRampToValueAtTime(1,t+.75);T(c,dry.gain,1,.05)}};
  P.setOn=on=>{P.on=on;P.freeze(on)};
  P.set=(k,x)=>{P.v[k]=x;if(k==='level'&&P.frozen)T(c,hold.gain,x/100);if(k==='dry'&&P.frozen)T(c,dry.gain,x/100,.05)}}
 else if(id==='octave'){insert();const sub=shifter(c,.5),up=shifter(c,2),sg=G(c,v.sub/100),ug=G(c,v.up/100*.8),dg=G(c,v.dry/100),lp=BQ(c,'lowpass',2200);P.stops.push(sub,up);
  send.connect(lp);lp.connect(sub.input);sub.output.connect(sg);send.connect(up.input);up.output.connect(ug);send.connect(dg);for(const g of [sg,ug,dg])g.connect(wet);
  P.set=(k,x)=>{P.v[k]=x;if(k==='sub')T(c,sg.gain,x/100);if(k==='up')T(c,ug.gain,x/100*.8);if(k==='dry')T(c,dg.gain,x/100)}}
 else if(id==='fuzz'){insert();const hp=BQ(c,'highpass',70),g1=G(c),w1=c.createWaveShaper(),mid=BQ(c,'lowpass',5200),g2=G(c,2.5),w2=c.createWaveShaper(),tl=BQ(c,'lowpass',650),th=BQ(c,'highpass',1300),lg=G(c),hg=G(c),vol=G(c);
  w1.curve=tanhCurve(3);w2.curve=tanhCurve(2);w1.oversample=w2.oversample='4x';send.connect(hp);hp.connect(g1);g1.connect(w1);w1.connect(mid);mid.connect(g2);g2.connect(w2);w2.connect(tl);w2.connect(th);tl.connect(lg);th.connect(hg);lg.connect(vol);hg.connect(vol);vol.connect(wet);
  const ap=()=>{T(c,g1.gain,2*Math.pow(60,P.v.sustain/100));const t=P.v.tone/100;T(c,lg.gain,Math.cos(t*Math.PI/2)*1.4);T(c,hg.gain,Math.sin(t*Math.PI/2)*1.6);T(c,vol.gain,P.v.level/100*.55)};ap();P.set=(k,x)=>{P.v[k]=x;ap()}}
 else if(id==='tape'){insert();const drive=G(c),ws=c.createWaveShaper(),mk=G(c),d=c.createDelay(.1),lp=BQ(c,'lowpass',12000,.5),hp=BQ(c,'highpass',40),vca=G(c,1),
   wowG=G(c),wow2G=G(c),flG=G(c),hiss=c.createBufferSource(),hhp=BQ(c,'highpass',3500),hg=G(c,0),drop=c.createBufferSource(),dropG=G(c,0);
  ws.curve=tanhCurve(1.6);d.delayTime.value=.015;lfo(.55).connect(wowG);lfo(.23,'triangle').connect(wow2G);lfo(6.3).connect(flG);for(const g of [wowG,wow2G,flG])g.connect(d.delayTime);
  hiss.buffer=noiseBuf(c,3);hiss.loop=true;hiss.start();P.stops.push(hiss);hiss.connect(hhp);hhp.connect(hg);hg.connect(vca);
  // 途切れ：11秒の表（ほとんど 0、ときどき滑らかに 1 へ）を繰り返し、音量を 1−深さ×表 にする
  {const sr=c.sampleRate,n=Math.floor(sr*11),b=c.createBuffer(1,n,sr),dd=b.getChannelData(0);for(const [at,len] of [[1.2,.18],[3.9,.35],[5.1,.09],[7.6,.5],[9.4,.14],[10.2,.07]]){const a=Math.floor(at*sr),l=Math.floor(len*sr);for(let i=0;i<l&&a+i<n;i++)dd[a+i]=Math.sin(Math.PI*i/l)**2}drop.buffer=b;drop.loop=true;drop.start();P.stops.push(drop);drop.connect(dropG);dropG.connect(vca.gain)}
  send.connect(drive);drive.connect(ws);ws.connect(mk);mk.connect(d);d.connect(lp);lp.connect(hp);hp.connect(vca);vca.connect(wet);
  const ap=()=>{const a=P.v.age/100;T(c,wowG.gain,.0045*P.v.wow/100);T(c,wow2G.gain,.002*P.v.wow/100);T(c,flG.gain,.00035*P.v.flutter/100);T(c,drive.gain,1+a*3);T(c,mk.gain,1/(1+a*1.6));
   T(c,lp.frequency,16000*Math.pow(2600/16000,a));T(c,hp.frequency,40+a*160);T(c,hg.gain,.012*a*a);T(c,dropG.gain,-.92*P.v.drop/100)};ap();P.set=(k,x)=>{P.v[k]=x;ap()}}
 else if(id==='pitchdelay'||id==='analog'){trails('mix');const sum=G(c),d=c.createDelay(1.5),fb=G(c,0),lp=BQ(c,'lowpass',id==='analog'?2400:5200),hp=BQ(c,'highpass',id==='analog'?90:150),sat=c.createWaveShaper();sat.curve=tanhCurve(1.2);
  d.delayTime.value=v.time/1000;send.connect(sum);sum.connect(d);let tail=d;
  if(id==='analog'){const mg=G(c);lfo(.9).connect(mg);mg.connect(d.delayTime);P.modG=mg}
  else{let sh=shifter(c,2**(v.interval/12));P.sh=sh;d.connect(sh.input);tail=sh.output;P.stops.push({stop(){P.sh.stop()}})}
  const post=G(c);tail.connect(lp);lp.connect(hp);hp.connect(sat);sat.connect(post);post.connect(fb);fb.connect(sum);post.connect(wet);
  const ap=()=>{T(c,d.delayTime,P.v.time/1000,.08);T(c,fb.gain,P.v.repeats/100);if(P.modG)T(c,P.modG.gain,.0035*P.v.mod/100);if(P.on)T(c,wet.gain,P.v.mix/100)};ap();
  P.set=(k,x)=>{P.v[k]=x;if(k==='interval'&&P.sh){const old=P.sh,ns=shifter(c,2**(x/12));try{d.disconnect(old.input)}catch(e){}try{old.output.disconnect()}catch(e){}old.stop();d.connect(ns.input);ns.output.connect(lp);P.sh=ns}else ap()}}
 else if(id==='shimmer'){trails('mix');const pre=BQ(c,'highpass',140),sum=G(c),cv=c.createConvolver(),lp=BQ(c,'lowpass',6000),sh=shifter(c,2,.08),sg=G(c,0),hp2=BQ(c,'highpass',300);P.stops.push(sh);
  cv.buffer=reverbIR(c,v.decay);send.connect(pre);pre.connect(sum);sum.connect(cv);cv.connect(lp);lp.connect(wet);lp.connect(hp2);hp2.connect(sh.input);sh.output.connect(sg);sg.connect(sum);
  // 帰還（きらめき）は最大 0.45：長い残響でも膨らみ続けない（テストで確認）
  const ap=()=>{T(c,sg.gain,.45*P.v.shimmer/100);T(c,lp.frequency,1800*Math.pow(9000/1800,P.v.tone/100));if(P.on)T(c,wet.gain,P.v.mix/100)};ap();
  P.set=(k,x)=>{const was=P.v[k];P.v[k]=x;if(k==='decay'&&was!==x)cv.buffer=reverbIR(c,x);else ap()}}
 return P}

// ── ボード（順番どおりにつなぐ） ──
let built=null; // {c,src,dest,pedals:Map}
const ctxNow=()=>{try{return typeof ctx!=='undefined'&&ctx&&typeof master!=='undefined'&&master?ctx:null}catch(e){return null}};
function slotOf(target){const c=ctxNow();if(!c)return null;if(target==='master'){const e=master._eq;return e&&e.pre?[e.pre,e.trim]:null}
 try{mixLane(target)}catch(e){return null}const l=mixLanes[target]&&mixLanes[target].dry;return l&&l.pre?[l.pre,l.trim]:null}
function rewire(){if(!built)return;const {src,dest,pedals}=built,chain=ORDER.map(id=>pedals.get(id)).filter(Boolean);try{src.disconnect()}catch(e){}for(const p of chain)try{p.output.disconnect()}catch(e){}
 let prev=src;for(const p of chain){prev.connect(p.input);prev=p.output}prev.connect(dest)}
function teardown(){if(!built)return;const {src,dest,pedals}=built;try{src.disconnect()}catch(e){}for(const p of pedals.values()){try{p.output.disconnect()}catch(e){}p.stop()}src.connect(dest);built=null}
// フリーズは音を溜めておく必要があるので、音が出始めたら常に（素通しの状態で）つないでおく
function attach(){const c=ctxNow();if(!c)return;const s=slotOf(st.target);if(!s)return;
 if(built&&(built.src!==s[0]))teardown();if(!built)built={c,src:s[0],dest:s[1],pedals:new Map()};
 let changed=false;for(const id of ORDER)if((st.p[id].on||id==='freeze')&&!built.pedals.has(id)){built.pedals.set(id,makePedal(c,id,st.p[id].v));changed=true}if(changed)rewire();
 for(const [id,p] of built.pedals)if(p.on!==st.p[id].on)p.setOn(st.p[id].on)}
function setOn(id,on){if(!DEF[id])return;st.p[id].on=!!on;attach();render(id)}
function setVal(id,k,x){const d=DEF[id];if(!d)return;const kn=d.knobs.find(q=>q.k===k);if(kn){x=Math.min(kn.max,Math.max(kn.min,+x));if(!Number.isFinite(x))return}else if(d.steps&&d.steps.k===k){x=+x;if(!d.steps.opts.includes(x))return}else return;
 st.p[id].v[k]=x;const p=built&&built.pedals.get(id);if(p)try{p.set(k,x)}catch(e){}save();render(id)}
function setTarget(t){if(!TARGETS.includes(t)||t===st.target)return;st.target=t;teardown();attach();save();renderAll()}
function allOff(){for(const id of ORDER)st.p[id].on=false;attach();renderAll()}

// ── 画面 ──
const $=id=>document.getElementById(id);
function render(id){const card=document.querySelector('.pdCard[data-pedal="'+id+'"]');if(!card)return;const s=st.p[id],d=DEF[id];card.classList.toggle('on',s.on);const fsw=card.querySelector('.pdSwitch');fsw.setAttribute('aria-pressed',String(s.on));
 for(const k of d.knobs){const i=card.querySelector('input[data-k="'+k.k+'"]'),o=card.querySelector('output[data-k="'+k.k+'"]');if(i&&document.activeElement!==i)i.value=String(s.v[k.k]);if(i)i.setAttribute('aria-valuetext',k.f(s.v[k.k]));if(o)o.textContent=k.f(s.v[k.k])}
 if(d.steps)for(const b of card.querySelectorAll('.pdSteps button'))b.setAttribute('aria-pressed',String(+b.dataset.v===s.v[d.steps.k]));
 const any=ORDER.filter(x=>st.p[x].on);const stt=$('pdStatus');if(stt)stt.textContent=any.length?any.map(x=>DEF[x].name).join(' · '):'すべてオフ'}
function renderAll(){if($('pdTarget'))$('pdTarget').value=st.target;for(const id of ORDER)render(id)}
function build(){const box=$('pdBoard');if(!box||box.dataset.built)return;box.dataset.built='1';
 const sel=$('pdTarget');for(const t of TARGETS){const o=document.createElement('option');o.value=t;o.textContent=t==='master'?'全体（マスター）':(typeof MIX_LABEL!=='undefined'&&MIX_LABEL[t])||t;sel.append(o)}sel.onchange=()=>setTarget(sel.value);
 $('pdAllOff').onclick=allOff;
 for(const id of ORDER){const d=DEF[id],card=document.createElement('div');card.className='pdCard';card.dataset.pedal=id;card.style.setProperty('--pd',d.color);
  const head=document.createElement('div');head.className='pdHead';const nm=document.createElement('strong');nm.className='pdName';nm.textContent=d.name;const ds=document.createElement('span');ds.className='micro pdDesc';ds.textContent=d.desc;head.append(nm,ds);card.append(head);
  const kn=document.createElement('div');kn.className='pdKnobs';
  for(const k of d.knobs){const w=document.createElement('label');w.className='pdKnob';const t=document.createElement('span');t.className='micro';t.textContent=k.l;const i=document.createElement('input');i.type='range';i.min=String(k.min);i.max=String(k.max);i.step=String(k.step);i.dataset.k=k.k;i.value=String(st.p[id].v[k.k]);i.oninput=()=>setVal(id,k.k,+i.value);const o=document.createElement('output');o.dataset.k=k.k;o.className='micro';w.append(t,i,o);kn.append(w)}
  card.append(kn);
  if(d.steps){const sw=document.createElement('div');sw.className='pdSteps buttons';sw.setAttribute('role','group');sw.setAttribute('aria-label',d.steps.l);const lab=document.createElement('span');lab.className='micro';lab.textContent=d.steps.l;sw.append(lab);for(const n of d.steps.opts){const b=document.createElement('button');b.type='button';b.dataset.v=String(n);b.textContent=(n>0?'+':'')+n;b.onclick=()=>setVal(id,d.steps.k,n);sw.append(b)}card.append(sw)}
  const fsw=document.createElement('button');fsw.type='button';fsw.className='pdSwitch';fsw.setAttribute('aria-pressed','false');const led=document.createElement('span');led.className='pdLed';led.setAttribute('aria-hidden','true');fsw.append(led,document.createTextNode(id==='freeze'?'押してつかむ / もう一度で放す':'オン / オフ'));fsw.onclick=()=>setOn(id,!st.p[id].on);card.append(fsw);box.append(card)}
 renderAll()}
document.addEventListener('saww:lang',()=>setTimeout(renderAll,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
window.__pedals={attach,setOn,setVal,setTarget,allOff,state:()=>JSON.parse(JSON.stringify(st)),order:ORDER.slice(),def:DEF,makePedal,shifter,built:()=>built?{target:st.target,pedals:[...built.pedals.keys()]}:null};
})();
