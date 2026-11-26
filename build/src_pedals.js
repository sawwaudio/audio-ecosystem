/* v0.87 ペダルボード 第2版 — 30種類から使うものだけを足して、好きな順番につなぐ（2026-11-26 オーナー「エフェクター30種類くらいまで増やす / 使ってないやつは外して、使うやつだけ表示」「UIが微妙」）。
   v0.85（2026-11-25「サンプラーの他にギターとかの面白いエフェクターを再現して自然音を加工して遊びたい」）の7種を引き継ぐ。
   特定の製品の回路や音を写したものではなく、よく知られた種類を Web Audio で作ったもの。名前・見た目も製品に似せない。
   ・定義（名前・説明・つまみ・英語）は build/pedals_def.json。組み込み時に DEF として入る。
   ・ボードは「並び（chain）」：[{id,on,v}]。同じ種類は1台まで、最大8台。足した時はカタログの順（ループ→音程→歪み→…→残響）の位置に入り、↑↓で動かせる。
   ・かける場所：全体（マスター EQ の入口＝リミッターの前。試聴・リール・録音の書き出しにも入る）か、ミキサーの1チャンネルの入口。
   ・試聴（audio 要素）は、ペダルがオンの間だけ Web Audio を通して鳴らす（routePreview）。一度通すと audio 要素は戻せないので、以後の試聴は毎回 ctx を起こして通す。
   ・ディレイ・残響（trails）はオフにしても余韻を残す。帰還は 1 未満（フリーズ・ルーパー・スタッターの閉じ込めは 1）。
   ・保存：localStorage 'saww.pedals.v2'（並びとつまみ。オンかどうかは保存しない）。プリセットの旧形式（v0.85・v0.86）も読める。 */
(()=>{'use strict';
const DEF=/*PEDALS_DEF*/null;
const P_=DEF.pedals,ALL=Object.keys(P_),MAXN=8,UI=DEF.ui,J=a=>a[0];
const TARGETS=['master','bio','field','music','sampler'];
const KEY='saww.pedals.v2',KEY1='saww.pedals.v1';
const defaults=id=>{const d=P_[id],v={};for(const k of d.knobs)v[k.k]=k.def;if(d.steps)v[d.steps.k]=d.steps.def;return v};
const clampV=(id,k,x)=>{const d=P_[id];const kn=d.knobs.find(q=>q.k===k);if(kn){x=+x;if(!Number.isFinite(x))return null;return Math.min(kn.max,Math.max(kn.min,x))}if(d.steps&&d.steps.k===k){x=+x;return d.steps.opts.includes(x)?x:null}return null};
const st={target:'master',chain:[]};
function cleanChain(arr,keepOn){const out=[],seen=new Set();if(!Array.isArray(arr))return out;for(const e of arr){if(!e||!P_[e.id]||seen.has(e.id)||out.length>=MAXN)continue;seen.add(e.id);const v=defaults(e.id);for(const k of Object.keys(v)){const x=clampV(e.id,k,(e.v||{})[k]);if(x!==null)v[k]=x}out.push({id:e.id,on:keepOn&&e.on===true&&P_[e.id].mode!=='freeze',v})}return out}
function fromV1(o){const order=['freeze','octave','fuzz','tape','pitchdelay','analog','shimmer'];return order.filter(id=>o.p&&o.p[id]&&o.p[id].on===true).map(id=>({id,on:true,v:(o.p[id]||{}).v||{}}))}
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object'){if(TARGETS.includes(s.target))st.target=s.target;st.chain=cleanChain(s.chain,false)}
 else{const o=JSON.parse(localStorage.getItem(KEY1)||'null');if(o&&TARGETS.includes(o.target))st.target=o.target}}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({target:st.target,chain:st.chain.map(e=>({id:e.id,v:e.v}))}))}catch(e){}};
const entry=id=>st.chain.find(e=>e.id===id);

// ── 部品 ──
const G=(c,v=1)=>{const n=c.createGain();n.gain.value=v;return n};
const BQ=(c,t,f,q=.707)=>{const n=c.createBiquadFilter();n.type=t;n.frequency.value=f;n.Q.value=q;return n};
const tanhCurve=(k,n=4097)=>{const cv=new Float32Array(n),m=Math.tanh(k);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=Math.tanh(k*x)/m}return cv};
const hardCurve=(n=4097)=>{const cv=new Float32Array(n);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=Math.max(-.8,Math.min(.8,x))/.8}return cv};
const stepCurve=(bits,n=16385)=>{const cv=new Float32Array(n),q=Math.pow(2,bits-1);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=Math.round(x*q)/q}return cv};
const T=(c,prm,v,tc=.03)=>prm.setTargetAtTime(v,c.currentTime,tc);
// 音程を変える部品：ディレイの長さを、のこぎり波で連続して伸び縮みさせる。2本の読み出しを半周期ずらし、sin² で重ねて継ぎ目を消す（sin²(πx)+sin²(π(x+½))＝1）。
function shifter(c,ratio,W=.06){const input=G(c),output=G(c),n=c.sampleRate,up=ratio>1;
 const rb=c.createBuffer(1,n,n),gb=c.createBuffer(1,n,n),rd=rb.getChannelData(0),gd=gb.getChannelData(0);
 for(let i=0;i<n;i++){const x=i/n;rd[i]=up?W*(1-x):W*x;gd[i]=Math.sin(Math.PI*x)**2}
 const rate=Math.abs(1-ratio)/W,srcs=[],t0=c.currentTime+.01;
 for(const off of [0,.5]){const d=c.createDelay(W+.02),g=G(c,0);d.delayTime.value=0;const r=c.createBufferSource(),gg=c.createBufferSource();r.buffer=rb;gg.buffer=gb;r.loop=gg.loop=true;r.playbackRate.value=gg.playbackRate.value=rate;r.connect(d.delayTime);gg.connect(g.gain);r.start(t0,off);gg.start(t0,off);input.connect(d);d.connect(g);g.connect(output);srcs.push(r,gg)}
 return {input,output,stop(){for(const s of srcs)try{s.stop()}catch(e){}}}}
function noiseBuf(c,secs){const n=Math.floor(c.sampleRate*secs),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
function reverbIR(c,secs,reverse=false){const n=Math.max(256,Math.floor(c.sampleRate*secs)),b=c.createBuffer(2,n,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;for(let i=0;i<n;i++){const x=i/n,att=Math.min(1,i/(c.sampleRate*.012));lp+=(Math.random()*2-1-lp)*.55;d[i]=lp*att*Math.exp(-6.9*x)}if(reverse){d.reverse();const f=Math.floor(c.sampleRate*.02);for(let i=0;i<f;i++)d[n-1-i]*=i/f}}return b}
function crackleBuf(c,secs){const sr=c.sampleRate,n=Math.floor(sr*secs),b=c.createBuffer(1,n,sr),d=b.getChannelData(0);for(let i=0;i<n;i++){if(Math.random()<60/sr){const a=(Math.random()*.8+.2)*(Math.random()<.5?-1:1),len=2+Math.floor(Math.random()*14);for(let j=0;j<len&&i+j<n;j++)d[i+j]+=a*Math.exp(-j/3)}}return b}
const SEMIS=[[4,7],[3,7],[5,7],[7,12],[-12,7]];

// ── ペダル1台 ── {input,output,setOn(on),set(k,v),action(k),stop()}
function makePedal(c,id,v){const D=P_[id],mode=D.mode,input=G(c),output=G(c),dry=G(c,1),send=G(c,0),wet=G(c,0);input.connect(dry);dry.connect(output);input.connect(send);wet.connect(output);
 const P={id,input,output,on:false,stops:[],v:{...v},ap(){},set(k,x){P.v[k]=x;P.ap();if(P.on)P.mix()},setOn(){},action(){},stop(){for(const s of P.stops)try{s.stop()}catch(e){}if(P.timer)clearInterval(P.timer)}};
 const lfo=(hz,type='sine')=>{const o=c.createOscillator();o.type=type;o.frequency.value=hz;o.start();P.stops.push(o);return o};
 const mixV=()=>(P.v.mix??100)/100;
 P.mix=()=>{if(mode==='insert'){T(c,dry.gain,0,.012);T(c,wet.gain,1,.012)}else if(mode==='blend'){T(c,dry.gain,1-mixV(),.012);T(c,wet.gain,mixV(),.012)}else if(mode==='trails')T(c,wet.gain,mixV(),.02)};
 if(mode==='insert'||mode==='blend'){P.setOn=on=>{P.on=on;T(c,send.gain,on?1:0,.012);if(on)P.mix();else{T(c,dry.gain,1,.012);T(c,wet.gain,0,.012)}}}
 else if(mode==='trails'){P.setOn=on=>{P.on=on;T(c,send.gain,on?1:0,.012);if(on)P.mix()}}
 const o=G(c);o.connect(wet); // 加工した音の出口
 const B={
 freeze(){const gin=G(c,1),sum=G(c),d=c.createDelay(2.2),fb=G(c,0),hold=G(c,0);d.delayTime.value=v.len/1000;input.connect(gin);gin.connect(sum);sum.connect(d);d.connect(fb);fb.connect(sum);d.connect(hold);hold.connect(output);P.frozen=false;
  P.freeze=on=>{const t=c.currentTime;if(on&&!P.frozen){P.frozen=true;const L=P.v.len/1000,F=Math.min(.25,L*.4);d.delayTime.cancelScheduledValues(t);d.delayTime.setValueAtTime(L,t);
    for(const [g,a,b] of [[gin,1,0],[fb,0,1]]){g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(a,t);g.gain.linearRampToValueAtTime(b,t+F)}hold.gain.cancelScheduledValues(t);hold.gain.setTargetAtTime(P.v.level/100,t,.02);T(c,dry.gain,P.v.dry/100,.05)}
   else if(!on&&P.frozen){P.frozen=false;hold.gain.cancelScheduledValues(t);hold.gain.setTargetAtTime(0,t,.12);fb.gain.cancelScheduledValues(t);fb.gain.setValueAtTime(1,t+.7);fb.gain.linearRampToValueAtTime(0,t+.75);gin.gain.cancelScheduledValues(t);gin.gain.setValueAtTime(0,t+.7);gin.gain.linearRampToValueAtTime(1,t+.75);T(c,dry.gain,1,.05)}};
  P.setOn=on=>{P.on=on;P.freeze(on)};P.set=(k,x)=>{P.v[k]=x;if(k==='level'&&P.frozen)T(c,hold.gain,x/100);if(k==='dry'&&P.frozen)T(c,dry.gain,x/100,.05)}},
 looper(){P.ls='empty';let loop=null;const out=G(c,0);out.connect(output);
  const fresh=()=>{if(loop){try{loop.gin.disconnect()}catch(e){}try{loop.d.disconnect()}catch(e){}}const gin=G(c,0),sum=G(c),d=c.createDelay(16.5),fb=G(c,0);d.delayTime.value=P.v.len;input.connect(gin);gin.connect(sum);sum.connect(d);d.connect(fb);fb.connect(sum);d.connect(out);loop={gin,d,fb}};fresh();
  const lv=()=>P.v.level/100;
  P.action=k=>{const t=c.currentTime;if(k==='rec'){if(P.ls==='rec'){T(c,loop.gin.gain,0,.006);P.ls='play';T(c,out.gain,lv(),.01)}else{if(P.ls==='empty'){loop.d.delayTime.setValueAtTime(P.v.len,t)}loop.fb.gain.setTargetAtTime(1,t,.004);T(c,loop.gin.gain,1,.006);T(c,out.gain,lv(),.01);P.ls='rec'}}
   else if(k==='play'){if(P.ls==='empty')return;if(P.ls==='rec')T(c,loop.gin.gain,0,.006);if(P.ls==='play'){T(c,out.gain,0,.03);P.ls='stop'}else{T(c,out.gain,lv(),.03);P.ls='play'}}
   else if(k==='clear'){T(c,out.gain,0,.01);setTimeout(()=>{fresh()},60);P.ls='empty'}};
  P.setOn=on=>{P.on=on;if(!on&&P.ls!=='empty'){if(P.ls==='rec')T(c,loop.gin.gain,0,.006);T(c,out.gain,0,.03);P.ls='stop'}};P.set=(k,x)=>{P.v[k]=x;if(k==='level'&&(P.ls==='play'||P.ls==='rec'))T(c,out.gain,lv())}},
 octave(){const sub=shifter(c,.5),up=shifter(c,2),sg=G(c),ug=G(c),dg=G(c),lp=BQ(c,'lowpass',2200);P.stops.push(sub,up);send.connect(lp);lp.connect(sub.input);sub.output.connect(sg);send.connect(up.input);up.output.connect(ug);send.connect(dg);for(const g of [sg,ug,dg])g.connect(o);
  P.ap=()=>{T(c,sg.gain,P.v.sub/100);T(c,ug.gain,P.v.up/100*.8);T(c,dg.gain,P.v.dry/100)}},
 pitchshift(){let sh=shifter(c,2**(v.semi/12));send.connect(sh.input);sh.output.connect(o);P.stops.push({stop(){sh.stop()}});
  P.set=(k,x)=>{P.v[k]=x;if(k==='semi'){const old=sh;sh=shifter(c,2**(x/12));send.connect(sh.input);sh.output.connect(o);try{send.disconnect(old.input)}catch(e){}try{old.output.disconnect()}catch(e){}old.stop()}if(P.on)P.mix()}},
 harmonizer(){let sh=[];const vg=G(c),dg=G(c);vg.connect(o);send.connect(dg);dg.connect(o);
  const mk=()=>{for(const s of sh){try{send.disconnect(s.input)}catch(e){}try{s.output.disconnect()}catch(e){}s.stop()}sh=SEMIS[P.v.chord].map(n=>{const s=shifter(c,2**(n/12));send.connect(s.input);s.output.connect(vg);return s})};mk();P.stops.push({stop(){for(const s of sh)s.stop()}});
  P.ap=()=>{T(c,vg.gain,P.v.voices/100*.6);T(c,dg.gain,P.v.dry/100)};P.set=(k,x)=>{P.v[k]=x;if(k==='chord')mk();P.ap()}},
 overdrive(){const hp=BQ(c,'highpass',60),g=G(c),ws=c.createWaveShaper(),lp=BQ(c,'lowpass',4000),lv=G(c);ws.curve=tanhCurve(1.2);ws.oversample='4x';send.connect(hp);hp.connect(g);g.connect(ws);ws.connect(lp);lp.connect(lv);lv.connect(o);
  P.ap=()=>{T(c,g.gain,1+P.v.drive/100*19);T(c,lp.frequency,800*Math.pow(10,P.v.tone/100));T(c,lv.gain,P.v.level/100*.9)}},
 distortion(){const hp=BQ(c,'highpass',90),g=G(c),ws=c.createWaveShaper(),lp=BQ(c,'lowpass',4000),lv=G(c);ws.curve=hardCurve();ws.oversample='4x';send.connect(hp);hp.connect(g);g.connect(ws);ws.connect(lp);lp.connect(lv);lv.connect(o);
  P.ap=()=>{T(c,g.gain,2*Math.pow(100,P.v.drive/100));T(c,lp.frequency,900*Math.pow(10,P.v.tone/100));T(c,lv.gain,P.v.level/100*.5)}},
 fuzz(){const hp=BQ(c,'highpass',70),g1=G(c),w1=c.createWaveShaper(),mid=BQ(c,'lowpass',5200),g2=G(c,2.5),w2=c.createWaveShaper(),tl=BQ(c,'lowpass',650),th=BQ(c,'highpass',1300),lg=G(c),hg=G(c),vol=G(c);
  w1.curve=tanhCurve(3);w2.curve=tanhCurve(2);w1.oversample=w2.oversample='4x';send.connect(hp);hp.connect(g1);g1.connect(w1);w1.connect(mid);mid.connect(g2);g2.connect(w2);w2.connect(tl);w2.connect(th);tl.connect(lg);th.connect(hg);lg.connect(vol);hg.connect(vol);vol.connect(o);
  P.ap=()=>{T(c,g1.gain,2*Math.pow(60,P.v.sustain/100));const t=P.v.tone/100;T(c,lg.gain,Math.cos(t*Math.PI/2)*1.4);T(c,hg.gain,Math.sin(t*Math.PI/2)*1.6);T(c,vol.gain,P.v.level/100*.55)}},
 bitcrush(){const ws=c.createWaveShaper(),lp=BQ(c,'lowpass',8000);ws.curve=stepCurve(v.bits);send.connect(ws);ws.connect(lp);lp.connect(o);let bits=v.bits;
  P.ap=()=>{if(P.v.bits!==bits){bits=P.v.bits;ws.curve=stepCurve(bits)}T(c,lp.frequency,1500*Math.pow(12,P.v.tone/100))}},
 compressor(){const cp=c.createDynamicsCompressor(),mk=G(c);cp.knee.value=6;cp.attack.value=.008;cp.release.value=.2;send.connect(cp);cp.connect(mk);mk.connect(o);
  P.ap=()=>{T(c,cp.threshold,P.v.threshold);T(c,cp.ratio,P.v.ratio);T(c,mk.gain,Math.pow(10,P.v.makeup/20))}},
 tremolo(){const vca=G(c,1),dep=G(c,0);send.connect(vca);vca.connect(o);const osc=lfo(v.rate,v.shape?'square':'sine');osc.connect(dep);dep.connect(vca.gain);
  P.ap=()=>{const ty=P.v.shape?'square':'sine';if(ty!==osc.type)osc.type=ty;T(c,osc.frequency,P.v.rate);const d=P.v.depth/100;T(c,vca.gain,1-d/2);T(c,dep.gain,d/2)}},
 filter(){const f=BQ(c,'lowpass',v.cutoff,v.reso),dep=G(c,0),osc=lfo(Math.max(.001,v.rate));osc.connect(dep);dep.connect(f.detune);send.connect(f);f.connect(o);
  P.ap=()=>{f.type=['lowpass','highpass','bandpass'][P.v.type];T(c,f.frequency,P.v.cutoff);T(c,f.Q,P.v.reso);T(c,osc.frequency,Math.max(.001,P.v.rate));T(c,dep.gain,P.v.rate>0?P.v.depth/100*2400:0)}},
 autowah(){const f=BQ(c,'bandpass',700,v.reso),dep=G(c,0),osc=lfo(v.rate,'triangle'),mk=G(c,2.2);osc.connect(dep);dep.connect(f.detune);send.connect(f);f.connect(mk);mk.connect(o);
  P.ap=()=>{T(c,osc.frequency,P.v.rate);T(c,dep.gain,P.v.depth/100*2000);T(c,f.Q,P.v.reso)}},
 eq3(){const lo=BQ(c,'lowshelf',200),mi=BQ(c,'peaking',1000,.8),hi=BQ(c,'highshelf',4500);send.connect(lo);lo.connect(mi);mi.connect(hi);hi.connect(o);
  P.ap=()=>{T(c,lo.gain,P.v.low);T(c,mi.gain,P.v.mid);T(c,hi.gain,P.v.high)}},
 chorus(){const sum=G(c,.7);P.ch=[];for(const [base,hz] of [[.016,1],[.023,1.27]]){const d=c.createDelay(.06),dep=G(c,0),osc=lfo(v.rate*hz);d.delayTime.value=base;osc.connect(dep);dep.connect(d.delayTime);send.connect(d);d.connect(sum);P.ch.push({osc,dep,hz})}sum.connect(o);
  P.ap=()=>{for(const q of P.ch){T(c,q.osc.frequency,P.v.rate*q.hz);T(c,q.dep.gain,.006*P.v.depth/100)}}},
 flanger(){const sum=G(c),d=c.createDelay(.03),fb=G(c,0),dep=G(c,0),osc=lfo(v.rate,'triangle');d.delayTime.value=.004;osc.connect(dep);dep.connect(d.delayTime);send.connect(sum);sum.connect(d);d.connect(fb);fb.connect(sum);d.connect(o);
  P.ap=()=>{T(c,osc.frequency,P.v.rate);T(c,dep.gain,.0035*P.v.depth/100);T(c,fb.gain,P.v.feedback/100)}},
 phaser(){const sum=G(c),fb=G(c,0),dep=G(c,0),osc=lfo(v.rate),dl=c.createDelay(.01);dl.delayTime.value=.0005;osc.connect(dep);send.connect(sum);let prev=sum;for(const f of [300,700,1500,3000]){const a=BQ(c,'allpass',f,.6);dep.connect(a.detune);prev.connect(a);prev=a}prev.connect(dl);dl.connect(fb);fb.connect(sum);prev.connect(o);
  P.ap=()=>{T(c,osc.frequency,P.v.rate);T(c,dep.gain,P.v.depth/100*1800);T(c,fb.gain,P.v.feedback/100)}},
 vibrato(){const d=c.createDelay(.05),dep=G(c,0),osc=lfo(v.rate);d.delayTime.value=.008;osc.connect(dep);dep.connect(d.delayTime);send.connect(d);d.connect(o);
  P.ap=()=>{T(c,osc.frequency,P.v.rate);T(c,dep.gain,.004*P.v.depth/100)}},
 autopan(){const pn=c.createStereoPanner(),dep=G(c,0),osc=lfo(v.rate);pn.pan.value=0;osc.connect(dep);dep.connect(pn.pan);send.connect(pn);pn.connect(o);
  P.ap=()=>{T(c,osc.frequency,P.v.rate);T(c,dep.gain,P.v.width/100)}},
 ringmod(){const vca=G(c,0),osc=lfo(v.freq),mk=G(c,1.6);osc.connect(vca.gain);send.connect(vca);vca.connect(mk);mk.connect(o);P.ap=()=>{T(c,osc.frequency,P.v.freq)}},
 tape(){const drive=G(c),ws=c.createWaveShaper(),mk=G(c),d=c.createDelay(.1),lp=BQ(c,'lowpass',12000,.5),hp=BQ(c,'highpass',40),vca=G(c,1),wowG=G(c),wow2G=G(c),flG=G(c),hiss=c.createBufferSource(),hhp=BQ(c,'highpass',3500),hg=G(c,0),drop=c.createBufferSource(),dropG=G(c,0);
  ws.curve=tanhCurve(1.6);d.delayTime.value=.015;lfo(.55).connect(wowG);lfo(.23,'triangle').connect(wow2G);lfo(6.3).connect(flG);for(const g of [wowG,wow2G,flG])g.connect(d.delayTime);
  hiss.buffer=noiseBuf(c,3);hiss.loop=true;hiss.start();P.stops.push(hiss);hiss.connect(hhp);hhp.connect(hg);hg.connect(vca);
  {const sr=c.sampleRate,n=Math.floor(sr*11),b=c.createBuffer(1,n,sr),dd=b.getChannelData(0);for(const [at,len] of [[1.2,.18],[3.9,.35],[5.1,.09],[7.6,.5],[9.4,.14],[10.2,.07]]){const a=Math.floor(at*sr),l=Math.floor(len*sr);for(let i=0;i<l&&a+i<n;i++)dd[a+i]=Math.sin(Math.PI*i/l)**2}drop.buffer=b;drop.loop=true;drop.start();P.stops.push(drop);drop.connect(dropG);dropG.connect(vca.gain)}
  send.connect(drive);drive.connect(ws);ws.connect(mk);mk.connect(d);d.connect(lp);lp.connect(hp);hp.connect(vca);vca.connect(o);
  P.ap=()=>{const a=P.v.age/100;T(c,wowG.gain,.0045*P.v.wow/100);T(c,wow2G.gain,.002*P.v.wow/100);T(c,flG.gain,.00035*P.v.flutter/100);T(c,drive.gain,1+a*3);T(c,mk.gain,1/(1+a*2.2));
   T(c,lp.frequency,16000*Math.pow(2600/16000,a));T(c,hp.frequency,40+a*160);T(c,hg.gain,.012*a*a);T(c,dropG.gain,-.92*P.v.drop/100)}},
 vinyl(){const d=c.createDelay(.05),wg=G(c),lp=BQ(c,'lowpass',9000,.6),hp=BQ(c,'highpass',60),cr=c.createBufferSource(),cg=G(c,0),hiss=c.createBufferSource(),hg=G(c,0),hb=BQ(c,'bandpass',5000,.5);
  d.delayTime.value=.01;lfo(.55).connect(wg);wg.connect(d.delayTime);cr.buffer=crackleBuf(c,7);cr.loop=true;cr.start();hiss.buffer=noiseBuf(c,3);hiss.loop=true;hiss.start();P.stops.push(cr,hiss);
  send.connect(d);d.connect(lp);lp.connect(hp);hp.connect(o);cr.connect(cg);cg.connect(o);hiss.connect(hb);hb.connect(hg);hg.connect(o);
  P.ap=()=>{const a=P.v.age/100;T(c,lp.frequency,12000*Math.pow(2200/12000,a));T(c,hp.frequency,60+a*240);T(c,cg.gain,.25*P.v.crackle/100);T(c,hg.gain,.004*a);T(c,wg.gain,.0025*P.v.wow/100)}},
 stutter(){const gin=G(c,1),sum=G(c),d=c.createDelay(.6),fb=G(c,0),hold=G(c,0);d.delayTime.value=v.len/1000;input.connect(gin);gin.connect(sum);sum.connect(d);d.connect(fb);fb.connect(sum);d.connect(hold);hold.connect(output);let busy=0,last=c.currentTime;
  const R=(prm,a,b,t,dur=.004)=>{prm.cancelScheduledValues(t);prm.setValueAtTime(a,t);prm.linearRampToValueAtTime(b,t+dur)};
  const fire=()=>{const L=P.v.len/1000,t=c.currentTime+.02,end=t+L*P.v.repeats;d.delayTime.setValueAtTime(L,t);R(fb.gain,0,1,t);R(gin.gain,1,0,t);R(hold.gain,0,1,t);R(dry.gain,1,0,t);R(fb.gain,1,0,end);R(gin.gain,0,1,end);R(hold.gain,1,0,end);R(dry.gain,0,1,end);busy=end+.05;P.fired=(P.fired||0)+1};
  P.fire=fire;
  P.setOn=on=>{P.on=on;if(P.timer){clearInterval(P.timer);P.timer=0}if(on){last=c.currentTime;P.timer=setInterval(()=>{const now=c.currentTime,dt=now-last;last=now;if(now<busy||c.state!=='running')return;if(Math.random()<(P.v.chance/100)*dt/.5)fire()},60)}else{const t=c.currentTime;R(hold.gain,hold.gain.value,0,t,.01);R(dry.gain,dry.gain.value,1,t,.01);R(fb.gain,fb.gain.value,0,t,.01);R(gin.gain,gin.gain.value,1,t,.01);busy=0}};P.set=(k,x)=>{P.v[k]=x}},
 digitaldelay(){const sum=G(c),d=c.createDelay(1.6),fb=G(c,0),hp=BQ(c,'highpass',60);d.delayTime.value=v.time/1000;send.connect(sum);sum.connect(d);d.connect(hp);hp.connect(fb);fb.connect(sum);hp.connect(o);
  P.ap=()=>{T(c,d.delayTime,P.v.time/1000,.08);T(c,fb.gain,P.v.repeats/100)}},
 pingpong(){const mono=G(c);mono.channelCount=1;mono.channelCountMode='explicit';mono.channelInterpretation='speakers';const dl=c.createDelay(1.3),dr=c.createDelay(1.3),lr=G(c,1),rl=G(c,0),mg=c.createChannelMerger(2),lp=BQ(c,'lowpass',7000);
  send.connect(mono);mono.connect(dl);dl.connect(mg,0,0);dl.connect(lr);lr.connect(dr);dr.connect(mg,0,1);dr.connect(rl);rl.connect(dl);mg.connect(lp);lp.connect(o);
  P.ap=()=>{T(c,dl.delayTime,P.v.time/1000,.08);T(c,dr.delayTime,P.v.time/1000,.08);T(c,lr.gain,Math.sqrt(P.v.repeats/100));T(c,rl.gain,Math.sqrt(P.v.repeats/100))}},
 analog(){const sum=G(c),d=c.createDelay(1.5),fb=G(c,0),lp=BQ(c,'lowpass',2400),hp=BQ(c,'highpass',90),sat=c.createWaveShaper(),mg=G(c),post=G(c);sat.curve=tanhCurve(1.2);
  d.delayTime.value=v.time/1000;send.connect(sum);sum.connect(d);lfo(.9).connect(mg);mg.connect(d.delayTime);d.connect(lp);lp.connect(hp);hp.connect(sat);sat.connect(post);post.connect(fb);fb.connect(sum);post.connect(o);
  P.ap=()=>{T(c,d.delayTime,P.v.time/1000,.08);T(c,fb.gain,P.v.repeats/100);T(c,mg.gain,.0035*P.v.mod/100)}},
 pitchdelay(){const sum=G(c),d=c.createDelay(1.5),fb=G(c,0),lp=BQ(c,'lowpass',5200),hp=BQ(c,'highpass',150),sat=c.createWaveShaper(),post=G(c);sat.curve=tanhCurve(1.2);
  d.delayTime.value=v.time/1000;send.connect(sum);sum.connect(d);let sh=shifter(c,2**(v.interval/12));d.connect(sh.input);sh.output.connect(lp);lp.connect(hp);hp.connect(sat);sat.connect(post);post.connect(fb);fb.connect(sum);post.connect(o);P.stops.push({stop(){sh.stop()}});
  P.ap=()=>{T(c,d.delayTime,P.v.time/1000,.08);T(c,fb.gain,P.v.repeats/100)};
  P.set=(k,x)=>{P.v[k]=x;if(k==='interval'){const old=sh;sh=shifter(c,2**(x/12));d.connect(sh.input);sh.output.connect(lp);try{d.disconnect(old.input)}catch(e){}try{old.output.disconnect()}catch(e){}old.stop()}else P.ap();if(P.on)P.mix()}},
 reverb(){const pd=c.createDelay(.25),cv=c.createConvolver(),lp=BQ(c,'lowpass',6000);cv.buffer=reverbIR(c,v.size);send.connect(pd);pd.connect(cv);cv.connect(lp);lp.connect(o);let size=v.size;
  P.ap=()=>{T(c,pd.delayTime,P.v.predelay/1000);T(c,lp.frequency,1500*Math.pow(10,P.v.tone/100));if(P.v.size!==size){size=P.v.size;cv.buffer=reverbIR(c,size)}}},
 reversereverb(){const cv=c.createConvolver(),hp=BQ(c,'highpass',120);cv.buffer=reverbIR(c,v.len,true);send.connect(hp);hp.connect(cv);cv.connect(o);let len=v.len;
  P.ap=()=>{if(P.v.len!==len){len=P.v.len;cv.buffer=reverbIR(c,len,true)}}},
 shimmer(){const pre=BQ(c,'highpass',140),sum=G(c),cv=c.createConvolver(),lp=BQ(c,'lowpass',6000),sh=shifter(c,2,.08),sg=G(c,0),hp2=BQ(c,'highpass',300);P.stops.push(sh);let decay=v.decay;
  cv.buffer=reverbIR(c,v.decay);send.connect(pre);pre.connect(sum);sum.connect(cv);cv.connect(lp);lp.connect(o);lp.connect(hp2);hp2.connect(sh.input);sh.output.connect(sg);sg.connect(sum);
  // 帰還（きらめき）は最大 0.45：長い残響でも膨らみ続けない（テストで確認）
  P.ap=()=>{T(c,sg.gain,.45*P.v.shimmer/100);T(c,lp.frequency,1800*Math.pow(9000/1800,P.v.tone/100));if(P.v.decay!==decay){decay=P.v.decay;cv.buffer=reverbIR(c,decay)}}}
 };
 B[id]();P.ap();return P}

// ── ボード ──
let built=null; // {c,src,dest,pedals:Map,order}
const ctxNow=()=>{try{return typeof ctx!=='undefined'&&ctx&&typeof master!=='undefined'&&master?ctx:null}catch(e){return null}};
function slotOf(target){const c=ctxNow();if(!c)return null;if(target==='master'){const e=master._eq;return e&&e.pre?[e.pre,e.trim]:null}
 try{mixLane(target)}catch(e){return null}const l=mixLanes[target]&&mixLanes[target].dry;return l&&l.pre?[l.pre,l.trim]:null}
function rewire(){if(!built)return;const {src,dest,pedals}=built;try{src.disconnect()}catch(e){}for(const p of pedals.values())try{p.output.disconnect()}catch(e){}
 let prev=src;for(const e of st.chain){const p=pedals.get(e.id);if(!p)continue;prev.connect(p.input);prev=p.output}prev.connect(dest)}
function teardown(){if(!built)return;const {src,dest,pedals}=built;try{src.disconnect()}catch(e){}for(const p of pedals.values()){try{p.output.disconnect()}catch(e){}p.stop()}src.connect(dest);built=null}
function attach(){const c=ctxNow();if(!c)return;const s=slotOf(st.target);if(!s)return;
 if(built&&(built.src!==s[0]||built.c!==c))teardown();if(!built)built={c,src:s[0],dest:s[1],pedals:new Map(),order:''};
 let changed=false;const ids=new Set(st.chain.map(e=>e.id));
 for(const [id,p] of built.pedals)if(!ids.has(id)){try{p.output.disconnect()}catch(e){}p.stop();built.pedals.delete(id);changed=true}
 for(const e of st.chain)if(!built.pedals.has(e.id)){built.pedals.set(e.id,makePedal(c,e.id,e.v));changed=true}
 const order=st.chain.map(e=>e.id).join();if(changed||built.order!==order){rewire();built.order=order}
 for(const e of st.chain){const p=built.pedals.get(e.id);if(p&&p.on!==e.on)p.setOn(e.on)}}
// 足す：カタログの順の位置に入れる
function add(id){if(!P_[id]||entry(id)||st.chain.length>=MAXN)return false;const at=ALL.indexOf(id);let i=st.chain.findIndex(e=>ALL.indexOf(e.id)>at);if(i<0)i=st.chain.length;st.chain.splice(i,0,{id,on:P_[id].mode==='freeze'?false:true,v:defaults(id)});save();attach();renderAll();return true}
function remove(id){const i=st.chain.findIndex(e=>e.id===id);if(i<0)return;st.chain.splice(i,1);save();attach();renderAll()}
function move(id,dir){const i=st.chain.findIndex(e=>e.id===id),j=i+dir;if(i<0||j<0||j>=st.chain.length)return;[st.chain[i],st.chain[j]]=[st.chain[j],st.chain[i]];save();attach();renderAll();const b=document.querySelector('.pdCard[data-pedal="'+id+'"] .pdMove[data-dir="'+dir+'"]');if(b&&!b.disabled)b.focus()}
function setOn(id,on){const e=entry(id);if(!e)return;e.on=!!on;attach();render(id)}
function setVal(id,k,x){const e=entry(id);if(!e)return;x=clampV(id,k,x);if(x===null)return;e.v[k]=x;const p=built&&built.pedals.get(id);if(p)try{p.set(k,x)}catch(err){}save();render(id)}
function action(id,k){const e=entry(id);if(!e)return;if(!e.on){e.on=true;attach()}const p=built&&built.pedals.get(id);if(p)p.action(k);render(id)}
function setTarget(t){if(!TARGETS.includes(t)||t===st.target)return;st.target=t;teardown();attach();save();renderAll()}
function allOff(){for(const e of st.chain)e.on=false;attach();renderAll()}
// 試聴（audio 要素）をペダルに通す。ペダルがひとつもオンでなく、まだ通したことがなければ、今までどおり直接鳴らす
let elSrc=null;
// play() はクリックの中ですぐ呼ぶ必要がある（iPhone）。ここは待たずに、つなぎ替えと ctx の起こしだけを行う。直前の pause() が ctx を止める途中なら、止め終わってから起こし直す
function routePreview(el){const anyOn=st.chain.some(e=>e.on);if(!elSrc&&!anyOn)return false;const c=ctxNow();if(!c||!el)return false;
 try{if(!elSrc){elSrc=c.createMediaElementSource(el);elSrc.connect(master)}
  const wake=()=>{try{c.resume()}catch(e){}const g=master._output.gain;g.cancelScheduledValues(c.currentTime);g.setTargetAtTime(1,c.currentTime,.02)};wake();
  if(typeof pausing!=='undefined'&&pausing){let n=0;const iv=setInterval(()=>{if(!pausing||++n>60){clearInterval(iv);wake()}},30)}attach();return true}catch(e){return false}}
let _pa=null;function probe(){const c=ctxNow();if(!c)return null;if(!_pa){_pa=c.createAnalyser();_pa.fftSize=8192;master._output.connect(_pa)}const d=new Float32Array(_pa.fftSize);_pa.getFloatTimeDomainData(d);let s=0;for(const x of d)s+=x*x;return Math.sqrt(s/d.length)}

// ── 画面 ──
const $=id=>document.getElementById(id);
const fmt=(k,x)=>{const u=k.u;if(u==='%')return Math.round(x)+'%';if(u==='ms')return Math.round(x)+' ms';if(u==='s')return (+x).toFixed(1)+' s';if(u==='Hz')return x>=1000?(x/1000).toFixed(1)+' kHz':(x<10?(+x).toFixed(2):Math.round(x))+' Hz';if(u==='dB')return (x>0?'+':'')+(+x).toFixed(1)+' dB';if(u===':1')return (+x).toFixed(1)+':1';return String(Math.round(x*10)/10)};
const pos=(k,x)=>k.log?Math.log(x/k.min)/Math.log(k.max/k.min):(x-k.min)/(k.max-k.min);
const valAt=(k,p)=>{p=Math.min(1,Math.max(0,p));const x=k.log?k.min*Math.pow(k.max/k.min,p):k.min+p*(k.max-k.min);return Math.min(k.max,Math.max(k.min,Math.round(x/k.step)*k.step))};
const el=(t,cls,txt)=>{const n=document.createElement(t);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
// つまみ：上下にドラッグ（180px で端から端）、矢印キー（Shift で大きく）、PageUp/Down、Home/End、ダブルクリックで初めの値
function knobEl(id,k){const w=el('div','pdKnob'),dial=el('div','pdDial');dial.tabIndex=0;dial.setAttribute('role','slider');dial.dataset.k=k.k;dial.setAttribute('aria-label',J(k.l));dial.setAttribute('aria-valuemin',String(k.min));dial.setAttribute('aria-valuemax',String(k.max));
 dial.append(el('span','pdCap'));const lab=el('span','pdKLabel',J(k.l)),out=el('output','pdKVal');out.dataset.k=k.k;w.append(dial,lab,out);
 const cur=()=>entry(id).v[k.k];
 dial.addEventListener('keydown',ev=>{const p=pos(k,cur()),s=ev.shiftKey?.1:.02;let n=null;if(ev.key==='ArrowUp'||ev.key==='ArrowRight')n=p+s;else if(ev.key==='ArrowDown'||ev.key==='ArrowLeft')n=p-s;else if(ev.key==='PageUp')n=p+.1;else if(ev.key==='PageDown')n=p-.1;else if(ev.key==='Home')n=0;else if(ev.key==='End')n=1;if(n===null)return;ev.preventDefault();
  let x=valAt(k,n);if(x===cur()&&n!==p)x=Math.min(k.max,Math.max(k.min,cur()+(n>p?k.step:-k.step)));setVal(id,k.k,x)});
 let drag=null;dial.addEventListener('pointerdown',ev=>{try{dial.setPointerCapture(ev.pointerId)}catch(e){}drag={y:ev.clientY,p:pos(k,cur())};dial.focus()});
 dial.addEventListener('pointermove',ev=>{if(!drag)return;setVal(id,k.k,valAt(k,drag.p+(drag.y-ev.clientY)/180))});
 const end=()=>{drag=null};dial.addEventListener('pointerup',end);dial.addEventListener('pointercancel',end);
 dial.addEventListener('dblclick',()=>setVal(id,k.k,k.def));return w}
function cardEl(id,i,n){const d=P_[id],card=el('div','pdCard');card.dataset.pedal=id;card.style.setProperty('--pd',d.color);
 const head=el('div','pdHead'),nm=el('strong','pdName',J(d.name)),tools=el('div','pdTools');
 for(const [dir,txt,lab] of [[-1,'↑',UI.up],[1,'↓',UI.down]]){const b=el('button','pdMove',txt);b.type='button';b.dataset.dir=String(dir);b.setAttribute('aria-label',J(lab));b.disabled=dir<0?i===0:i===n-1;b.onclick=()=>move(id,dir);tools.append(b)}
 const x=el('button','pdRemove','×');x.type='button';x.setAttribute('aria-label',J(UI.remove));x.onclick=()=>remove(id);tools.append(x);head.append(nm,tools);card.append(head,el('span','micro pdDesc',J(d.desc)));
 const kn=el('div','pdKnobs');for(const k of d.knobs)kn.append(knobEl(id,k));card.append(kn);
 if(d.steps){const sw=el('div','pdSteps');sw.setAttribute('role','group');sw.setAttribute('aria-label',J(d.steps.l));sw.append(el('span','micro',J(d.steps.l)));d.steps.opts.forEach((v,ix)=>{const b=el('button',null,d.steps.labels?J(d.steps.labels[ix]):(v>0?'+':'')+v);b.type='button';b.dataset.v=String(v);b.onclick=()=>setVal(id,d.steps.k,v);sw.append(b)});card.append(sw)}
 if(d.actions){const row=el('div','pdActions');for(const a of d.actions){const b=el('button','pdAct',J(a.l));b.type='button';b.dataset.a=a.k;b.onclick=()=>action(id,a.k);row.append(b)}const s=el('span','micro pdLoopState');s.setAttribute('role','status');row.append(s);card.append(row)}
 else{const fsw=el('button','pdSwitch');fsw.type='button';fsw.setAttribute('aria-pressed','false');fsw.append(el('span','pdLed'),el('span',null,J(d.mode==='freeze'?UI.freezeSw:UI.onoff)));fsw.onclick=()=>setOn(id,!entry(id).on);card.append(fsw)}
 return card}
function render(id){const card=document.querySelector('.pdCard[data-pedal="'+id+'"]'),e=entry(id);if(!card||!e)return;const d=P_[id];
 const p=built&&built.pedals.get(id),on=d.mode==='looper'?!!(p&&(p.ls==='rec'||p.ls==='play')):e.on;card.classList.toggle('on',on);
 const fsw=card.querySelector('.pdSwitch');if(fsw)fsw.setAttribute('aria-pressed',String(e.on));
 for(const k of d.knobs){const dial=card.querySelector('.pdDial[data-k="'+k.k+'"]'),out=card.querySelector('output[data-k="'+k.k+'"]'),x=e.v[k.k];if(dial){dial.setAttribute('aria-valuenow',String(x));dial.setAttribute('aria-valuetext',fmt(k,x));dial.style.setProperty('--p',String(pos(k,x)))}if(out)out.textContent=fmt(k,x)}
 if(d.steps)for(const b of card.querySelectorAll('.pdSteps button'))b.setAttribute('aria-pressed',String(+b.dataset.v===e.v[d.steps.k]));
 if(d.actions){const s=card.querySelector('.pdLoopState'),ls=p?p.ls:'empty';s.textContent=J(UI[{empty:'lEmpty',rec:'lRec',play:'lPlay',stop:'lStop'}[ls]]);for(const b of card.querySelectorAll('.pdAct'))b.classList.toggle('lit',(b.dataset.a==='rec'&&ls==='rec')||(b.dataset.a==='play'&&ls==='play'))}
 status()}
function status(){const s=$('pdStatus');if(!s)return;const on=st.chain.filter(e=>e.on).map(e=>J(P_[e.id].name));s.textContent=on.length?on.join(' · '):J(UI.off);const c=$('pdCount');if(c)c.textContent=st.chain.length+' / '+MAXN}
function renderAll(){const box=$('pdBoard');if(!box)return;if($('pdTarget'))$('pdTarget').value=st.target;box.textContent='';
 if(!st.chain.length){const em=el('div','pdEmpty');em.append(el('p','micro',J(UI.empty)));const row=el('div','pdSuggest');row.append(el('span','micro',J(UI.suggest)));for(const id of ['shimmer','tape','freeze','pingpong']){const b=el('button','pdChip',J(P_[id].name));b.type='button';b.dataset.pedal=id;b.style.setProperty('--pd',P_[id].color);b.onclick=()=>add(id);row.append(b)}em.append(row);box.append(em)}
 st.chain.forEach((e,i)=>box.append(cardEl(e.id,i,st.chain.length)));for(const e of st.chain)render(e.id);renderCatalog();status()}
function renderCatalog(){const cat=$('pdCatalog');if(!cat||cat.hidden)return;cat.textContent='';const full=st.chain.length>=MAXN;if(full)cat.append(el('p','micro pdFull',J(UI.full)));
 for(const [ck,ja] of DEF.cats){const ids=ALL.filter(id=>P_[id].cat===ck);if(!ids.length)continue;const g=el('div','pdCatGroup');g.append(el('h4','pdCatH',ja));const list=el('div','pdCatList');
  for(const id of ids){const d=P_[id],has=!!entry(id),b=el('button','pdCatItem');b.type='button';b.dataset.pedal=id;b.style.setProperty('--pd',d.color);b.disabled=has||full;b.append(el('strong',null,J(d.name)),el('span','micro',has?J(UI.added):J(d.desc)));b.onclick=()=>{if(add(id)){const c=document.querySelector('.pdCard[data-pedal="'+id+'"]');if(c)c.scrollIntoView({block:'nearest'})}};list.append(b)}
  g.append(list);cat.append(g)}}
function build(){const box=$('pdBoard');if(!box||box.dataset.built)return;box.dataset.built='1';
 const sel=$('pdTarget');for(const t of TARGETS){const o=document.createElement('option');o.value=t;o.textContent=t==='master'?J(UI.master):(typeof MIX_LABEL!=='undefined'&&MIX_LABEL[t])||t;sel.append(o)}sel.onchange=()=>setTarget(sel.value);
 $('pdAllOff').onclick=allOff;const addB=$('pdAdd'),cat=$('pdCatalog');addB.onclick=()=>{cat.hidden=!cat.hidden;addB.setAttribute('aria-expanded',String(!cat.hidden));addB.textContent=cat.hidden?J(UI.add):J(UI.close);renderCatalog()};
 renderAll()}
document.addEventListener('saww:lang',()=>setTimeout(renderAll,0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
// プリセット・共有リンク用。読み込みは値を範囲に収め、知らないものは無視する。旧形式（v0.85・v0.86 の {target,p:{id:{on,v}}}）も読める
function preset(){return {v:2,target:st.target,chain:st.chain.map(e=>({id:e.id,on:P_[e.id].mode==='freeze'?false:e.on,v:{...e.v}}))}}
function applyPreset(o){if(!o||typeof o!=='object')return false;const chain=Array.isArray(o.chain)?o.chain:(o.p&&typeof o.p==='object'?fromV1(o):null);if(!chain)return false;
 if(TARGETS.includes(o.target)&&o.target!==st.target){st.target=o.target;teardown()}st.chain=cleanChain(chain,true);save();attach();renderAll();return true}
window.__pedals={preset,applyPreset,attach,add,remove,move,setOn,setVal,action,setTarget,allOff,routePreview,probe,ids:ALL.slice(),def:P_,cats:DEF.cats,makePedal,shifter,
 state:()=>JSON.parse(JSON.stringify(st)),built:()=>built?{target:st.target,pedals:st.chain.filter(e=>built.pedals.has(e.id)).map(e=>e.id)}:null,instance:id=>built&&built.pedals.get(id)};
})();
