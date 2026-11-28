/* v0.88 ペダルボード 第3版（34種。Chase Bliss 系の好み：マイクロループ・グリッチ・記憶のやまびこ・リバースディレイ・ロッシー・ダブルドライブ・スウェル・ハーモニックトレモロ、テープ合奏、マルチコーラス・マルチリバーブ。2026-11-26 オーナー指示）。ルーパーはサンプラーの欄の 6ch ルーパーへ移した。
   v0.87 ペダルボード 第2版 — 30種類から使うものだけを足して、好きな順番につなぐ（2026-11-26 オーナー「エフェクター30種類くらいまで増やす / 使ってないやつは外して、使うやつだけ表示」「UIが微妙」）。
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
// 旧い台（v0.85〜v0.87）を新しい台に読み替える：シマー・リバースリバーブ→マルチリバーブ、ビブラート・コーラス→マルチコーラス、ルーパー→（サンプラーのルーパーへ移ったので外す）
function migrate(e){if(!e||typeof e!=='object')return e;const v=e.v||{};
 if(e.id==='shimmer')return {id:'reverb',on:e.on,v:{type:4,decay:v.decay,mod:v.shimmer,tone:v.tone,mix:v.mix}};
 if(e.id==='reversereverb')return {id:'reverb',on:e.on,v:{type:5,decay:v.len,mix:v.mix}};
 if(e.id==='reverb'&&v.size!=null&&v.decay==null)return {id:'reverb',on:e.on,v:{type:1,decay:v.size,predelay:v.predelay,tone:v.tone,mix:v.mix}};
 if(e.id==='vibrato')return {id:'chorus',on:e.on,v:{type:1,rate:v.rate,depth:v.depth}};
 return e}
function cleanChain(arr,keepOn){const out=[],seen=new Set();if(!Array.isArray(arr))return out;for(let e of arr){e=migrate(e);if(!e||!P_[e.id]||seen.has(e.id)||out.length>=MAXN)continue;seen.add(e.id);const v=defaults(e.id);for(const k of Object.keys(v)){const x=clampV(e.id,k,(e.v||{})[k]);if(x!==null)v[k]=x}out.push({id:e.id,on:keepOn&&e.on===true&&P_[e.id].mode!=='freeze',v})}return out}
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
 return {input,output,srcs,stop(){for(const s of srcs)try{s.stop()}catch(e){}}}}
function noiseBuf(c,secs){const n=Math.floor(c.sampleRate*secs),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
function reverbIR(c,secs,reverse=false){const n=Math.max(256,Math.floor(c.sampleRate*secs)),b=c.createBuffer(2,n,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;for(let i=0;i<n;i++){const x=i/n,att=Math.min(1,i/(c.sampleRate*.012));lp+=(Math.random()*2-1-lp)*.55;d[i]=lp*att*Math.exp(-6.9*x)}if(reverse){d.reverse();const f=Math.floor(c.sampleRate*.02);for(let i=0;i<f;i++)d[n-1-i]*=i/f}}return b}
function crackleBuf(c,secs){const sr=c.sampleRate,n=Math.floor(sr*secs),b=c.createBuffer(1,n,sr),d=b.getChannelData(0);for(let i=0;i<n;i++){if(Math.random()<60/sr){const a=(Math.random()*.8+.2)*(Math.random()<.5?-1:1),len=2+Math.floor(Math.random()*14);for(let j=0;j<len&&i+j<n;j++)d[i+j]+=a*Math.exp(-j/3)}}return b}
const SEMIS=[[4,7],[3,7],[5,7],[7,12],[-12,7]];
// 高さを連続して変えられる部品：上げる用と下げる用を1組ずつ持ち、比に応じて片方だけ鳴らす（のこぎり波の速さ＝|1−比|/W を AudioParam で動かす）
function bender(c,W=.05){const input=G(c),output=G(c),parts=[];for(const up of [true,false]){const s=shifter(c,up?2:.5,W),g=G(c,0);input.connect(s.input);s.output.connect(g);g.connect(output);parts.push({s,g,up})}
 const api={input,output,parts,set(r,tc=.05){const t=c.currentTime;for(const p of parts){const on=p.up?r>1.0005:r<.9995;p.g.gain.setTargetAtTime(on?1:0,t,.02);for(const src of p.s.srcs)src.playbackRate.setTargetAtTime(Math.abs(1-r)/W||.0001,t,tc)}
  const pass=Math.abs(r-1)<=.0005;by.gain.setTargetAtTime(pass?1:0,t,.02)},stop(){for(const p of parts)p.s.stop()}};
 const by=G(c,0);input.connect(by);by.connect(output);return api}

const asymCurve=(n=4097)=>{const cv=new Float32Array(n);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=x>0?Math.tanh(4*x)/Math.tanh(4):Math.max(-.6,Math.tanh(2.2*x))/.6*.8}return cv};
// マルチリバーブの残響の形：0部屋 1ホール 2プレート 3スプリング 4シマー（ホール）5リバース 6クラウド 7暗い
function verbIR(c,t,decay){const sr=c.sampleRate,len=t===0?Math.min(decay,2.5)*.8:t===6?decay*1.5:decay,n=Math.max(256,Math.floor(sr*len)),b=c.createBuffer(2,n,sr),sm=[.5,.55,.92,.6,.55,.55,.3,.15][t],atk=[.004,.03,.002,.004,.03,.03,.35,.03][t];
 for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;for(let i=0;i<n;i++){const x=i/n,a=Math.min(1,i/(sr*atk));lp+=(Math.random()*2-1-lp)*sm;d[i]=lp*a*Math.exp(-6.9*x)}
  if(t===0)for(const [tm,g] of [[.007,.8],[.013,.6],[.021,.5],[.029,.4],[.037,.3]]){const i=Math.floor(sr*(tm+ch*.0013));if(i<n)d[i]+=g*(ch?-1:1)}
  if(t===3){for(let k=0;k*sr*.034<n;k++){const st=Math.floor(k*sr*.034),amp=Math.exp(-k*.12)*.5,L=Math.floor(sr*.03);for(let j=0;j<L&&st+j<n;j++){const tt=j/sr;d[st+j]+=amp*Math.sin(2*Math.PI*(3200-60000*tt)*tt)*(1-j/L)}}}
  if(t===5){d.reverse();const f=Math.floor(sr*.02);for(let i=0;i<f;i++)d[n-1-i]*=i/f}}
 return b}
const WK_SRC=/*PEDAL_WORKLET*/'';const wkReady=new WeakMap(),wkJobs=new WeakMap();
function ensureWorklet(c){if(wkJobs.has(c))return wkJobs.get(c);const job=(async()=>{if(!c.audioWorklet)throw Error('no worklet');const url=URL.createObjectURL(new Blob([WK_SRC],{type:'application/javascript'}));try{try{await c.audioWorklet.addModule(url)}catch(e){await c.audioWorklet.addModule('data:application/javascript;charset=utf-8,'+encodeURIComponent(WK_SRC))}}finally{URL.revokeObjectURL(url)}wkReady.set(c,true)})();wkJobs.set(c,job);job.catch(()=>{wkJobs.delete(c)});return job}

// ── ペダル1台 ── {input,output,setOn(on),set(k,v),action(k),stop()}
function makePedal(c,id,v){const D=P_[id],mode=D.mode,input=G(c),output=G(c),dry=G(c,1),send=G(c,0),wet=G(c,0);input.connect(dry);dry.connect(output);input.connect(send);wet.connect(output);
 const P={id,input,output,on:false,stops:[],v:{...v},ap(){},set(k,x){P.v[k]=x;P.ap();if(P.on)P.mix()},setOn(){},action(){},stop(){P.dead=true;for(const s of P.stops)try{s.stop()}catch(e){}if(P.timer)clearInterval(P.timer);if(P.node)try{P.node.disconnect()}catch(e){}}};
 const lfo=(hz,type='sine')=>{const o=c.createOscillator();o.type=type;o.frequency.value=hz;o.start();P.stops.push(o);return o};
 const mixV=()=>(P.v.mix??100)/100;
 P.mix=()=>{const ov=P.mixOverride&&P.mixOverride();if(ov!=null&&mode==='blend'){T(c,dry.gain,1-ov,.012);T(c,wet.gain,ov,.012);return}if(mode==='insert'){T(c,dry.gain,0,.012);T(c,wet.gain,1,.012)}else if(mode==='blend'){T(c,dry.gain,1-mixV(),.012);T(c,wet.gain,mixV(),.012)}else if(mode==='trails')T(c,wet.gain,mixV(),.02)};
 if(mode==='insert'||mode==='blend'){P.setOn=on=>{P.on=on;T(c,send.gain,on?1:0,.012);if(on)P.mix();else{T(c,dry.gain,1,.012);T(c,wet.gain,0,.012)}}}
 else if(mode==='trails'){P.setOn=on=>{P.on=on;T(c,send.gain,on?1:0,.012);if(on)P.mix()}}
 const o=G(c);o.connect(wet); // 加工した音の出口
 // AudioWorklet の台：読み込みが済んでいればすぐ、まだならあとでつなぐ（その間は鳴らない）
 // 最初の設定は processorOptions で渡す（ポートの知らせは遅れて届くので、オフラインの描画では間に合わない）。読み込み済みなら、makePedal の最後に作る
 const wk=(opts,dest=o,src=send)=>{const mk=()=>{if(P.dead||P.node)return;const n=new AudioWorkletNode(c,'saww-fx',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{...opts,cfg:{...(opts.cfg||{}),...(P.pend||{})}}});P.pend=null;src.connect(n);n.connect(dest);P.node=n;if(P.held||P.stopped)n.parameters.get('hold').setValueAtTime(1,c.currentTime)};if(wkReady.get(c)===true)P.mkNode=mk;else ensureWorklet(c).then(mk,()=>{})};
 const cfg=x=>{if(P.node)P.node.port.postMessage(x);else P.pend=Object.assign(P.pend||{},x)};
 const B={
 freeze(){const gin=G(c,1),sum=G(c),d=c.createDelay(2.2),fb=G(c,0),hold=G(c,0);d.delayTime.value=v.len/1000;input.connect(gin);gin.connect(sum);sum.connect(d);d.connect(fb);fb.connect(sum);d.connect(hold);hold.connect(output);P.frozen=false;
  P.freeze=on=>{const t=c.currentTime;if(on&&!P.frozen){P.frozen=true;const L=P.v.len/1000,F=Math.min(.25,L*.4);d.delayTime.cancelScheduledValues(t);d.delayTime.setValueAtTime(L,t);
    for(const [g,a,b] of [[gin,1,0],[fb,0,1]]){g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(a,t);g.gain.linearRampToValueAtTime(b,t+F)}hold.gain.cancelScheduledValues(t);hold.gain.setTargetAtTime(P.v.level/100,t,.02);T(c,dry.gain,P.v.dry/100,.05)}
   else if(!on&&P.frozen){P.frozen=false;hold.gain.cancelScheduledValues(t);hold.gain.setTargetAtTime(0,t,.12);fb.gain.cancelScheduledValues(t);fb.gain.setValueAtTime(1,t+.7);fb.gain.linearRampToValueAtTime(0,t+.75);gin.gain.cancelScheduledValues(t);gin.gain.setValueAtTime(0,t+.7);gin.gain.linearRampToValueAtTime(1,t+.75);T(c,dry.gain,1,.05)}};
  P.setOn=on=>{P.on=on;P.freeze(on)};P.set=(k,x)=>{P.v[k]=x;if(k==='level'&&P.frozen)T(c,hold.gain,x/100);if(k==='dry'&&P.frozen)T(c,dry.gain,x/100,.05)}},
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
 tremolo(){const lo=BQ(c,'lowpass',700),hi=BQ(c,'highpass',700),vl=G(c,1),vh=G(c,1),dl=G(c,0),dh=G(c,0),one=G(c,1);send.connect(lo);send.connect(hi);lo.connect(vl);hi.connect(vh);vl.connect(o);vh.connect(o);const osc=lfo(v.rate,v.shape===1?'square':'sine');osc.connect(dl);osc.connect(dh);dl.connect(vl.gain);dh.connect(vh.gain);
  P.ap=()=>{const ty=P.v.shape===1?'square':'sine';if(ty!==osc.type)osc.type=ty;T(c,osc.frequency,P.v.rate);const d=P.v.depth/100;T(c,vl.gain,1-d/2);T(c,vh.gain,1-d/2);T(c,dl.gain,d/2);T(c,dh.gain,P.v.shape===2?-d/2:d/2)}},
 filter(){const f=BQ(c,'lowpass',v.cutoff,v.reso),dep=G(c,0),osc=lfo(Math.max(.001,v.rate));osc.connect(dep);dep.connect(f.detune);send.connect(f);f.connect(o);
  P.ap=()=>{f.type=['lowpass','highpass','bandpass'][P.v.type];T(c,f.frequency,P.v.cutoff);T(c,f.Q,P.v.reso);T(c,osc.frequency,Math.max(.001,P.v.rate));T(c,dep.gain,P.v.rate>0?P.v.depth/100*2400:0)}},
 autowah(){const f=BQ(c,'bandpass',700,v.reso),dep=G(c,0),osc=lfo(v.rate,'triangle'),mk=G(c,2.2);osc.connect(dep);dep.connect(f.detune);send.connect(f);f.connect(mk);mk.connect(o);
  P.ap=()=>{T(c,osc.frequency,P.v.rate);T(c,dep.gain,P.v.depth/100*2000);T(c,f.Q,P.v.reso)}},
 eq3(){const lo=BQ(c,'lowshelf',200),mi=BQ(c,'peaking',1000,.8),hi=BQ(c,'highshelf',4500);send.connect(lo);lo.connect(mi);mi.connect(hi);hi.connect(o);
  P.ap=()=>{T(c,lo.gain,P.v.low);T(c,mi.gain,P.v.mid);T(c,hi.gain,P.v.high)}},
 chorus(){const tone=BQ(c,'lowpass',8000),trem=G(c,1),tdep=G(c,0),pan=c.createStereoPanner(),pdep=G(c,0),fast=lfo(6),slow=lfo(.6);P.vs=[];
  for(const [hz,pn] of [[1,-1],[1.13,1],[1.47,0]]){const d=c.createDelay(.06),dep=G(c,0),fdep=G(c,0),osc=lfo(v.rate*hz),g=G(c,0),p=c.createStereoPanner();d.delayTime.value=.012;osc.connect(dep);dep.connect(d.delayTime);fast.connect(fdep);fdep.connect(d.delayTime);send.connect(d);d.connect(g);g.connect(p);p.connect(tone);P.vs.push({d,dep,fdep,osc,g,p,hz,pn})}
  // ワープ：ゆっくりした不規則な揺れ（8秒の滑らかな乱数を繰り返す）
  const wb=c.createBuffer(1,c.sampleRate*8,c.sampleRate),wd=wb.getChannelData(0);{let a=0,t=0;for(let i=0;i<wd.length;i++){if(i%Math.floor(c.sampleRate*.4)===0)t=Math.random()*2-1;a+=(t-a)*.0004;wd[i]=a}}const warp=c.createBufferSource(),wdep=G(c,0);warp.buffer=wb;warp.loop=true;warp.start();P.stops.push(warp);warp.connect(wdep);for(const q of P.vs)wdep.connect(q.d.delayTime);
  tone.connect(trem);trem.connect(pan);pan.connect(o);slow.connect(tdep);tdep.connect(trem.gain);slow.connect(pdep);pdep.connect(pan.pan);
  P.mixOverride=()=>P.v.type===1?1:null;
  P.ap=()=>{const t=P.v.type,dp=P.v.depth/100,r=P.v.rate;// [基準の遅れ, 揺れの幅, 使う声の数, 速い揺れ, 不規則な揺れ, 回転]
   const M=[[.014,.006,2,0,0,0],[.006,.004,1,0,0,0],[.012,.003,3,.0003,0,0],[.008,.0012,2,0,0,0],[.012,.0015,1,0,.009,0],[.003,.0008,1,0,0,1]][t];
   P.vs.forEach((q,ix)=>{T(c,q.d.delayTime,M[0]+ix*.003);T(c,q.osc.frequency,(t===3?r*.4:t===5?r*1.5:r)*q.hz);T(c,q.dep.gain,M[1]*dp);T(c,q.fdep.gain,M[3]*dp);T(c,q.g.gain,ix<M[2]?(M[2]===1?1:.8):0);T(c,q.p.pan,t===1||t===5?0:q.pn*(t===3?1:.6))});
   T(c,wdep.gain,M[4]*dp);T(c,tone.frequency,1200*Math.pow(14,P.v.tone/100));T(c,slow.frequency,Math.max(.05,r*1.5));T(c,tdep.gain,M[5]?.25*dp:0);T(c,trem.gain,M[5]?1-.25*dp:1);T(c,pdep.gain,M[5]?.7*dp:0)}},
 flanger(){const sum=G(c),d=c.createDelay(.03),fb=G(c,0),dep=G(c,0),osc=lfo(v.rate,'triangle');d.delayTime.value=.004;osc.connect(dep);dep.connect(d.delayTime);send.connect(sum);sum.connect(d);d.connect(fb);fb.connect(sum);d.connect(o);
  P.ap=()=>{T(c,osc.frequency,P.v.rate);T(c,dep.gain,.0035*P.v.depth/100);T(c,fb.gain,P.v.feedback/100)}},
 phaser(){const sum=G(c),fb=G(c,0),dep=G(c,0),osc=lfo(v.rate),dl=c.createDelay(.01);dl.delayTime.value=.0005;osc.connect(dep);send.connect(sum);let prev=sum;for(const f of [300,700,1500,3000]){const a=BQ(c,'allpass',f,.6);dep.connect(a.detune);prev.connect(a);prev=a}prev.connect(dl);dl.connect(fb);fb.connect(sum);prev.connect(o);
  P.ap=()=>{T(c,osc.frequency,P.v.rate);T(c,dep.gain,P.v.depth/100*1800);T(c,fb.gain,P.v.feedback/100)}},
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
 reverb(){const pd=c.createDelay(.3),sum=G(c),cv=c.createConvolver(),lp=BQ(c,'lowpass',6000),md=c.createDelay(.03),mdep=G(c,0),mosc=lfo(.35),hp2=BQ(c,'highpass',300),sh=shifter(c,2,.08),sg=G(c,0);P.stops.push(sh);
  md.delayTime.value=.006;mosc.connect(mdep);mdep.connect(md.delayTime);send.connect(pd);pd.connect(sum);sum.connect(cv);cv.connect(lp);lp.connect(md);md.connect(o);lp.connect(hp2);hp2.connect(sh.input);sh.output.connect(sg);sg.connect(sum);let key='';
  // 帰還（シマーのきらめき）は最大 0.45：長い残響でも膨らみ続けない（テストで確認）
  P.ap=()=>{const t=P.v.type,m=P.v.mod/100,k=t+':'+P.v.decay;if(k!==key){key=k;cv.buffer=verbIR(c,t,P.v.decay)}T(c,pd.delayTime,P.v.predelay/1000);T(c,lp.frequency,(t===7?700:1500)*Math.pow(t===7?6:10,P.v.tone/100));T(c,sg.gain,t===4?.45*m:0);T(c,mdep.gain,t===6?.004*m:.0006*m)}},
 // ── AudioWorklet を使う台 ──
 microloop(){wk({type:'micro',bufSec:9,cfg:{len:v.len,speed:v.speed,fb:v.fb/100}});P.ap=()=>cfg({len:P.v.len,speed:P.v.speed,fb:P.v.fb/100});P.held=false;
  P.action=k=>{if(k==='hold'){P.held=!P.held;if(P.node)P.node.parameters.get('hold').setValueAtTime(P.held?1:0,c.currentTime)}}},
 glitch(){wk({type:'glitch',bufSec:6,cfg:{}});P.ap=()=>cfg({thr:.25*Math.pow(10,-P.v.sens/40),ratio:3+(100-P.v.sens)/25,sustain:P.v.sustain,len:P.v.len,mode:P.v.mode})},
 tapeensemble(){wk({type:'mel',cfg:{}});P.ap=()=>cfg({sens:P.v.sens,attack:P.v.attack,release:P.v.release,oct:P.v.oct+(P.v.voice===2?-1:0),voice:P.v.voice})},
 swell(){wk({type:'swell',cfg:{}});P.ap=()=>cfg({rise:P.v.rise,sens:P.v.sens})},
 memorydelay(){wk({type:'memory',bufSec:22,cfg:{}});P.ap=()=>cfg({spread:P.v.spread,size:P.v.size,fb:P.v.repeats/100,mode:P.v.mode})},
 reversedelay(){wk({type:'micro',bufSec:5,cfg:{speed:-1}});P.ap=()=>cfg({len:P.v.len,speed:-1,fb:P.v.fb/100})},
 dualdrive(){const hp=BQ(c,'highpass',70),ga=G(c),wa=c.createWaveShaper(),gb=G(c),wb=c.createWaveShaper(),sa=G(c),sb=G(c),pa=G(c),pb=G(c),lp=BQ(c,'lowpass',4000),lv=G(c);wa.curve=tanhCurve(1.3);wb.curve=asymCurve();wa.oversample=wb.oversample='4x';
  send.connect(hp);hp.connect(ga);ga.connect(wa);wa.connect(sa);sa.connect(gb);hp.connect(pb);pb.connect(gb);gb.connect(wb);wb.connect(lp);wa.connect(pa);pa.connect(lp);lp.connect(lv);lv.connect(o);
  P.ap=()=>{const ser=P.v.route===0;T(c,ga.gain,1+P.v.a/100*12);T(c,gb.gain,1+P.v.b/100*40);T(c,sa.gain,ser?1:0);T(c,pb.gain,ser?0:1);T(c,pa.gain,ser?0:.8);T(c,lp.frequency,900*Math.pow(10,P.v.tone/100));T(c,lv.gain,P.v.level/100*.55)}},
 lossy(){const ws=c.createWaveShaper(),lp=BQ(c,'lowpass',6000),hp=BQ(c,'highpass',200),gate=G(c,1),gsrc=c.createBufferSource(),gd=G(c,0),cv=c.createConvolver(),sm=G(c,0),dr=G(c,1);
  cv.buffer=reverbIR(c,.35);send.connect(hp);hp.connect(ws);ws.connect(lp);lp.connect(gate);gate.connect(dr);dr.connect(o);gate.connect(cv);cv.connect(sm);sm.connect(o);gsrc.loop=true;gsrc.connect(gd);gd.connect(gate.gain);let loss=-1,q=-1;
  const lossBuf=x=>{const sr=c.sampleRate,n=sr*6,b=c.createBuffer(1,n,sr),d=b.getChannelData(0);let i=0;while(i<n){const gap=Math.floor(sr*(.03+Math.random()*.6*(1.05-x)));i+=gap;const len=Math.floor(sr*(.015+Math.random()*.08*x));for(let j=0;j<len&&i+j<n;j++)d[i+j]=-1;i+=len}return b};
  P.ap=()=>{const x=P.v.loss/100;if(Math.abs(x-loss)>.02){loss=x;const s2=c.createBufferSource();s2.buffer=lossBuf(Math.max(.01,x));s2.loop=true;s2.connect(gd);s2.start();try{gsrc.stop()}catch(e){}P.stops.push(s2)}T(c,gd.gain,x>0?1:0);
   const qq=P.v.quality/100;if(Math.abs(qq-q)>.04){q=qq;ws.curve=stepCurve(Math.round(4+qq*8))}T(c,lp.frequency,2000*Math.pow(5,qq));T(c,hp.frequency,350-qq*250);T(c,sm.gain,P.v.smear/100*.9);T(c,dr.gain,1-P.v.smear/100*.5)}},
 // ── v0.89 追加（70種へ） ──
 granular(){wk({type:'memory',bufSec:10,cfg:{mode:3}});P.ap=()=>cfg({mode:3,size:P.v.size,spread:P.v.spread,scatter:P.v.scatter/100,fb:0})},
 tapestop(){const hold=G(c,0);P.stopped=false;wk({type:'tstop',bufSec:12,cfg:{stop:v.time,start:v.start}},hold,input);hold.connect(output);
  P.setOn=on=>{P.on=on;const t=c.currentTime;hold.gain.cancelScheduledValues(t);dry.gain.cancelScheduledValues(t);if(on&&!P.stopped){P.stopped=true;cfg({stop:P.v.time,start:P.v.start});if(P.node)P.node.parameters.get('hold').setValueAtTime(1,t);T(c,hold.gain,1,.004);T(c,dry.gain,0,.004)}
   else if(!on&&P.stopped){P.stopped=false;if(P.node)P.node.parameters.get('hold').setValueAtTime(0,t);const back=P.v.start+.05;hold.gain.setTargetAtTime(0,t+back,.01);dry.gain.setTargetAtTime(1,t+back,.01)}};P.set=(k,x)=>{P.v[k]=x;cfg({stop:P.v.time,start:P.v.start})}},
 drone(){wk({type:'mel',cfg:{}});P.ap=()=>cfg({sens:P.v.sens,attack:.6,release:P.v.sustain,oct:P.v.oct,voice:P.v.voice,voices:5})},
 detune(){const U=shifter(c,1.01),Dn=shifter(c,.99),pl=c.createStereoPanner(),pr=c.createStereoPanner(),dl=c.createDelay(.05),dr=c.createDelay(.05);dl.delayTime.value=.011;dr.delayTime.value=.017;P.stops.push(U,Dn);
  send.connect(dl);dl.connect(U.input);U.output.connect(pl);pl.connect(o);send.connect(dr);dr.connect(Dn.input);Dn.output.connect(pr);pr.connect(o);
  P.ap=()=>{const r=Math.pow(2,P.v.cents/1200),W=.06,t=c.currentTime;for(const src of U.srcs)src.playbackRate.setTargetAtTime((r-1)/W,t,.05);for(const src of Dn.srcs)src.playbackRate.setTargetAtTime((1-1/r)/W,t,.05);T(c,pl.pan,-P.v.width/100);T(c,pr.pan,P.v.width/100)}},
 pitchbend(){const b=bender(c);send.connect(b.input);b.output.connect(o);P.stops.push(b);P.ap=()=>b.set(Math.pow(2,P.v.bend/12))},
 arpeggio(){const PAT=[[0,4,7,12],[0,3,7,10],[0,7,12,19],[0,5,7,12],[0,12,0,-12]],b=bender(c,.05);send.connect(b.input);b.output.connect(o);P.stops.push(b);let i=0;
  const step=()=>{const pat=PAT[P.v.pattern],n=pat[i%pat.length];i++;b.set(Math.pow(2,n/12),.002+.12*P.v.glide/100)};
  P.setOn=on=>{P.on=on;T(c,send.gain,on?1:0,.012);if(on)P.mix();else{T(c,dry.gain,1,.012);T(c,wet.gain,0,.012)}if(P.timer){clearInterval(P.timer);P.timer=0}if(on){step();let last=performance.now();P.timer=setInterval(()=>{const iv=60000/P.v.bpm/2;if(performance.now()-last>=iv){last+=iv;if(performance.now()-last>iv)last=performance.now();step()}},10)}}},
 subharmonic(){const s1=shifter(c,.5),s2=shifter(c,.25),lp=BQ(c,'lowpass',900),g1=G(c),g2=G(c),dg=G(c),lp2=BQ(c,'lowpass',500);P.stops.push(s1,s2);send.connect(lp);lp.connect(s1.input);lp.connect(s2.input);s1.output.connect(g1);s2.output.connect(lp2);lp2.connect(g2);send.connect(dg);for(const g of [g1,g2,dg])g.connect(o);
  P.ap=()=>{T(c,g1.gain,P.v.sub1/100);T(c,g2.gain,P.v.sub2/100*1.3);T(c,dg.gain,P.v.dry/100)}},
 boost(){const g=G(c),lo=BQ(c,'lowshelf',600),hi=BQ(c,'highshelf',1500);send.connect(g);g.connect(lo);lo.connect(hi);hi.connect(o);P.ap=()=>{T(c,g.gain,Math.pow(10,P.v.gain/20));T(c,lo.gain,-P.v.tilt);T(c,hi.gain,P.v.tilt)}},
 tubedrive(){const g=G(c),ws=c.createWaveShaper(),lp=BQ(c,'lowpass',5000),hp=BQ(c,'highpass',50),lv=G(c);ws.oversample='4x';send.connect(g);g.connect(ws);ws.connect(hp);hp.connect(lp);lp.connect(lv);lv.connect(o);let key='';
  P.ap=()=>{const b=P.v.bias/100*.6,k=1+P.v.drive/100*6,kk=b.toFixed(2)+':'+k.toFixed(2);if(kk!==key){key=kk;const n=4097,cv=new Float32Array(n),off=Math.tanh(k*b);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=(Math.tanh(k*(x+b))-off)/(1+Math.abs(off))}ws.curve=cv}
   T(c,g.gain,1+P.v.drive/100*3);T(c,lp.frequency,1200*Math.pow(10,P.v.tone/100));T(c,lv.gain,P.v.level/100*.9)}},
 octavefuzz(){const g=G(c),rect=c.createWaveShaper(),og=G(c),dg=G(c),sum=G(c),fz=c.createWaveShaper(),hp=BQ(c,'highpass',120),lp=BQ(c,'lowpass',4000),lv=G(c);
  {const n=4097,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=Math.abs(x)*2-.6}rect.curve=cv}fz.curve=tanhCurve(3.5);fz.oversample=rect.oversample='4x';
  send.connect(g);g.connect(rect);rect.connect(hp);hp.connect(og);og.connect(sum);g.connect(dg);dg.connect(sum);sum.connect(fz);fz.connect(lp);lp.connect(lv);lv.connect(o);
  P.ap=()=>{T(c,g.gain,1+P.v.drive/100*10);T(c,og.gain,P.v.octave/100*1.5);T(c,dg.gain,1-P.v.octave/100*.6);T(c,lp.frequency,900*Math.pow(9,P.v.tone/100));T(c,lv.gain,P.v.level/100*.5)}},
 wavefolder(){const ws=c.createWaveShaper(),lp=BQ(c,'lowpass',6000),lv=G(c);ws.oversample='4x';send.connect(ws);ws.connect(lp);lp.connect(lv);lv.connect(o);let f=0;
  P.ap=()=>{if(Math.abs(P.v.fold-f)>.05){f=P.v.fold;const n=8193,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=Math.sin(x*f*Math.PI/2)}ws.curve=cv}T(c,lp.frequency,1000*Math.pow(12,P.v.tone/100));T(c,lv.gain,P.v.level/100*.7)}},
 decimator(){wk({type:'crush',cfg:{}});P.ap=()=>cfg({rate:P.v.rate,bits:P.v.bits})},
 limiter(){const pre=G(c),cp=c.createDynamicsCompressor(),mk=G(c);cp.knee.value=0;cp.ratio.value=20;cp.attack.value=.001;send.connect(pre);pre.connect(cp);cp.connect(mk);mk.connect(o);
  P.ap=()=>{T(c,cp.threshold,P.v.ceiling);T(c,cp.release,P.v.release/1000);T(c,mk.gain,Math.pow(10,P.v.makeup/20))}},
 gate(){wk({type:'gate',cfg:{}});P.ap=()=>cfg({thr:P.v.thr,hold:P.v.hold/1000,release:P.v.release/1000})},
 sidechain(){const vca=G(c,1),src=c.createBufferSource(),dep=G(c,0);send.connect(vca);vca.connect(o);let shape=-1;src.loop=true;src.connect(dep);dep.connect(vca.gain);src.start();P.stops.push(src);
  const mk=sh=>{const n=c.sampleRate,b=c.createBuffer(1,n,n),d=b.getChannelData(0);for(let i=0;i<n;i++){const x=i/n;d[i]=-(sh?Math.pow(1-x,3):Math.pow(1-x,1.6)*.9)}return b};let cur=src;
  P.ap=()=>{if(P.v.shape!==shape){shape=P.v.shape;const s2=c.createBufferSource();s2.buffer=mk(shape);s2.loop=true;s2.playbackRate.value=P.v.bpm/60;s2.connect(dep);s2.start();try{cur.stop()}catch(e){}cur=s2;P.stops.push(s2)}T(c,cur.playbackRate,P.v.bpm/60);T(c,dep.gain,P.v.depth/100)}},
 slicer(){const vca=G(c,1),dep=G(c,0);send.connect(vca);vca.connect(o);let cur=null,key='';
  const pat=(p,sm)=>{const n=c.sampleRate*2,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0),steps=16,L=n/steps,on=[...Array(steps)].map((_,i)=>p===0?1:p===1?(i%2):p===2?(i%4!==1&&i%4!==3?1:i%4===3?1:0):(Math.random()<.55?1:0)),edge=Math.max(8,Math.floor(L*(.02+sm*.45)));
   for(let s2=0;s2<steps;s2++){for(let j=0;j<L;j++){const gate=on[s2]&&j<L*.7?1:0,e=Math.min(1,Math.min(j,L*.7-j)/edge);d[s2*L+j]=-(1-(gate?Math.max(0,e):0))}}return b};
  P.ap=()=>{const k=P.v.pattern+':'+Math.round(P.v.smooth/5);if(k!==key){key=k;const s2=c.createBufferSource();s2.buffer=pat(P.v.pattern,P.v.smooth/100);s2.loop=true;s2.playbackRate.value=P.v.bpm/120;s2.connect(dep);s2.start();if(cur)try{cur.stop()}catch(e){}cur=s2;P.stops.push(s2)}T(c,cur.playbackRate,P.v.bpm/120);T(c,dep.gain,P.v.depth/100)}},
 formant(){const VF=[[800,1150,2900],[350,2000,2800],[325,700,2530],[450,1800,2830],[450,800,2830]],bp=[0,1,2].map(()=>BQ(c,'bandpass',1000,8)),gs=[1,.7,.45].map(v=>G(c,v)),mk=G(c,3);bp.forEach((b,k)=>{send.connect(b);b.connect(gs[k]);gs[k].connect(mk)});mk.connect(o);let ph=0;
  const setV=(v,tc=.05)=>{const a=VF[Math.floor(v)%5],b=VF[(Math.floor(v)+1)%5],f=v-Math.floor(v);bp.forEach((x,k)=>{T(c,x.frequency,a[k]*(1-f)+b[k]*f,tc)})};
  P.ap=()=>{bp.forEach(x=>T(c,x.Q,P.v.reso));if(!P.v.rate)setV(P.v.vowel)};
  P.timer=setInterval(()=>{if(!P.v.rate)return;ph=(ph+P.v.rate*.05)%5;setV((P.v.vowel+ph)%5,.04)},50)},
 combfilter(){const sum=G(c),d=c.createDelay(.05),fb=G(c,0),lp=BQ(c,'lowpass',6000);send.connect(sum);sum.connect(d);d.connect(lp);lp.connect(fb);fb.connect(sum);lp.connect(o);
  // Web Audio の帰還の輪には 128 サンプルの遅れが入るので、その分を引く（そのため 350Hz までにしている）
  P.ap=()=>{T(c,d.delayTime,Math.max(1/c.sampleRate,1/P.v.freq-128/c.sampleRate),.02);T(c,fb.gain,P.v.feedback/100);T(c,lp.frequency,800*Math.pow(15,P.v.tone/100))}},
 resonator(){const CH=[[0,4,7,12,16],[0,3,7,12,15],[0,7,12,19,24],[0,2,4,6,8]],bp=CH[0].map(()=>BQ(c,'bandpass',440,30)),gs=bp.map(()=>G(c,.0)),mk=G(c,1);bp.forEach((b,k)=>{send.connect(b);b.connect(gs[k]);gs[k].connect(mk)});mk.connect(o);
  P.ap=()=>{const ch=CH[P.v.chord];bp.forEach((b,k)=>{T(c,b.frequency,440*Math.pow(2,(P.v.root+ch[k]-69)/12));T(c,b.Q,P.v.decay);T(c,gs[k].gain,Math.sqrt(P.v.decay)*.9)})}},
 stepfilter(){const f=BQ(c,'lowpass',1200,6);send.connect(f);f.connect(o);P.ap=()=>T(c,f.Q,P.v.reso);let last=0;
  P.timer=setInterval(()=>{const iv=60000/P.v.bpm/2,now=performance.now();if(now-last<iv)return;last=now;const r=P.v.range/100,x=200*Math.pow(2,(1-r)*3+Math.random()*r*6);f.frequency.setTargetAtTime(Math.min(16000,x),c.currentTime,.008)},10)},
 envfilter(){wk({type:'envf',cfg:{}});P.ap=()=>cfg({sens:.2+P.v.sens/100*2.5,range:P.v.range,reso:P.v.reso,dir:P.v.dir,base:P.v.dir?300:220})},
 freqshift(){wk({type:'fshift',cfg:{}});P.ap=()=>cfg({shift:P.v.shift})},
 doppler(){const d=c.createDelay(.2),dep=G(c,0),pn=c.createStereoPanner(),pdep=G(c,0),vca=G(c,.6),vdep=G(c,0),sin=lfo(v.rate),cos=c.createOscillator();d.delayTime.value=.08;
  cos.setPeriodicWave(c.createPeriodicWave(new Float32Array([0,1]),new Float32Array([0,0])));cos.frequency.value=v.rate;cos.start();P.stops.push(cos);
  sin.connect(dep);dep.connect(d.delayTime);cos.connect(pdep);pdep.connect(pn.pan);cos.connect(vdep);const ab=c.createWaveShaper();{const n=257,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=-1+2*i/(n-1);cv[i]=1-Math.abs(x)}ab.curve=cv}vdep.connect(ab);ab.connect(vca.gain);
  send.connect(d);d.connect(pn);pn.connect(vca);vca.connect(o);
  P.ap=()=>{T(c,sin.frequency,P.v.rate);T(c,cos.frequency,P.v.rate);T(c,dep.gain,.06*P.v.depth/100);T(c,pdep.gain,P.v.width/100);T(c,vdep.gain,1)}},
 rotary(){const lo=BQ(c,'lowpass',800),hi=BQ(c,'highpass',800),parts=[];send.connect(lo);send.connect(hi);
  for(const [band,base,ratio] of [[lo,.004,.83],[hi,.002,1]]){const d=c.createDelay(.03),dep=G(c,0),pn=c.createStereoPanner(),pdep=G(c,0),am=G(c,1),adep=G(c,0),osc=lfo(1);d.delayTime.value=base;band.connect(d);d.connect(am);am.connect(pn);pn.connect(o);osc.connect(dep);dep.connect(d.delayTime);osc.connect(pdep);pdep.connect(pn.pan);osc.connect(adep);adep.connect(am.gain);parts.push({osc,dep,pdep,adep,am,ratio,base})}
  P.ap=()=>{const fast=P.v.speed===1,dp=P.v.depth/100;for(const q of parts){q.osc.frequency.setTargetAtTime((fast?6.7:.8)*q.ratio,c.currentTime,fast?.6:1.2);T(c,q.dep.gain,q.base*.4*dp);T(c,q.pdep.gain,.8*dp);T(c,q.adep.gain,.3*dp);T(c,q.am.gain,1-.3*dp)}}},
 widener(){const sp=c.createChannelSplitter(2),mg=c.createChannelMerger(2),dl=c.createDelay(.05),xL=G(c),xR=G(c),cL=G(c,0),cR=G(c,0);send.connect(sp);sp.connect(xL,0);sp.connect(dl,1);dl.connect(xR);xL.connect(mg,0,0);xR.connect(mg,0,1);sp.connect(cR,0);sp.connect(cL,1);cL.connect(mg,0,0);cR.connect(mg,0,1);mg.connect(o);
  P.ap=()=>{T(c,dl.delayTime,P.v.ms/1000);const w=P.v.width/100;T(c,cL.gain,-.25*w);T(c,cR.gain,-.25*w);T(c,xL.gain,1+.1*w);T(c,xR.gain,1+.1*w)}},
 radio(){const bp=BQ(c,'bandpass',1200,.9),hp=BQ(c,'highpass',300),lp=BQ(c,'lowpass',3400),ws=c.createWaveShaper(),g=G(c),nz=c.createBufferSource(),ng=G(c,0),nb=BQ(c,'bandpass',2500,.5);ws.curve=tanhCurve(2);
  send.connect(hp);hp.connect(lp);lp.connect(bp);bp.connect(g);g.connect(ws);ws.connect(o);nz.buffer=noiseBuf(c,3);nz.loop=true;nz.start();P.stops.push(nz);nz.connect(nb);nb.connect(ng);ng.connect(o);
  P.ap=()=>{const t=P.v.tone/100;T(c,hp.frequency,150+t*500);T(c,lp.frequency,2200+t*2500);T(c,bp.frequency,700+t*1400);T(c,g.gain,1.5+P.v.crunch/100*8);T(c,ng.gain,.03*P.v.noise/100)}},
 shortwave(){const bp=BQ(c,'bandpass',1200,1.2),ws=c.createWaveShaper(),fade=G(c,1),fdep=G(c,0),fo=lfo(.13,'triangle'),wh=c.createOscillator(),whg=G(c,0),wdrift=G(c,0),wl=lfo(.07),nz=c.createBufferSource(),ng=G(c,0),nb=BQ(c,'bandpass',2000,.4);ws.curve=tanhCurve(1.5);
  wh.frequency.value=1800;wh.start();P.stops.push(wh);wl.connect(wdrift);wdrift.connect(wh.frequency);wh.connect(whg);whg.connect(o);fo.connect(fdep);fdep.connect(fade.gain);
  send.connect(bp);bp.connect(ws);ws.connect(fade);fade.connect(o);nz.buffer=noiseBuf(c,3);nz.loop=true;nz.start();P.stops.push(nz);nz.connect(nb);nb.connect(ng);ng.connect(o);
  P.ap=()=>{const f=P.v.fade/100;T(c,fade.gain,1-f*.45);T(c,fdep.gain,f*.45);T(c,whg.gain,.02*P.v.whistle/100);T(c,wdrift.gain,400*P.v.tune/100+50);T(c,wh.frequency,900+P.v.tune*20);T(c,bp.frequency,700+P.v.tune*14);T(c,ng.gain,.05*P.v.noise/100)}},
 blur(){const cv=c.createConvolver();send.connect(cv);cv.connect(o);let a=-1;
  P.ap=()=>{if(Math.abs(P.v.amount-a)>.01){a=P.v.amount;const sr=c.sampleRate,n=Math.floor(sr*a),b=c.createBuffer(2,n,sr);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++){const x=i/n;d[i]=(Math.random()*2-1)*Math.sin(Math.PI*x)}}cv.buffer=b}}},
 tapeecho(){const sum=G(c),d=c.createDelay(2.2),sat=c.createWaveShaper(),lp=BQ(c,'lowpass',3500),hp=BQ(c,'highpass',90),fb=G(c,0),wg=G(c),wl=lfo(.6),hs=[1,2,3].map(()=>({d:c.createDelay(2.2),g:G(c,0)}));sat.curve=tanhCurve(1.4);
  send.connect(sum);sum.connect(sat);sat.connect(lp);lp.connect(hp);wl.connect(wg);for(const h of hs){hp.connect(h.d);h.d.connect(h.g);h.g.connect(o);h.g.connect(fb);wg.connect(h.d.delayTime)}fb.connect(sum);
  P.ap=()=>{const H=[[1],[2],[3],[1,3],[1,2,3]][P.v.heads];hs.forEach((h,k)=>{T(c,h.d.delayTime,P.v.time/1000*[1,1.5,2][k],.08);T(c,h.g.gain,H.includes(k+1)?1/Math.sqrt(H.length):0)});T(c,fb.gain,P.v.repeats/100*.9);T(c,wg.gain,.003*P.v.wow/100)}},
 multitap(){const PAT=[[1,2,3,4],[.75,1.5,2.25,3],[.667,1.333,2,2.667],[.5,1.25,2.6,3.3]],sum=G(c),taps=[0,1,2,3].map(()=>({d:c.createDelay(3.5),g:G(c,0)})),fb=G(c,0),lp=BQ(c,'lowpass',6000);send.connect(sum);
  taps.forEach((t,k)=>{sum.connect(t.d);t.d.connect(t.g);t.g.connect(o)});taps[3].g.connect(lp);lp.connect(fb);fb.connect(sum);
  P.ap=()=>{const p=PAT[P.v.pattern];taps.forEach((t,k)=>{T(c,t.d.delayTime,P.v.time/1000*p[k],.08);T(c,t.g.gain,[.8,.6,.45,.35][k])});T(c,fb.gain,P.v.repeats/100)}},
 dub(){const sum=G(c),d=c.createDelay(1.5),lp=BQ(c,'lowpass',2500,2),sat=c.createWaveShaper(),fb=G(c,0),mdep=G(c,0),ml=lfo(.15);sat.curve=tanhCurve(1.1);send.connect(sum);sum.connect(d);d.connect(lp);lp.connect(sat);sat.connect(fb);fb.connect(sum);sat.connect(o);ml.connect(mdep);mdep.connect(lp.detune);
  P.ap=()=>{T(c,d.delayTime,P.v.time/1000,.1);T(c,fb.gain,P.v.feedback/100);T(c,lp.frequency,600+4000*(1-P.v.filter/100));T(c,mdep.gain,600)}},
 slapback(){const d=c.createDelay(.3),lp=BQ(c,'lowpass',5000);send.connect(d);d.connect(lp);lp.connect(o);P.ap=()=>{T(c,d.delayTime,P.v.time/1000);T(c,lp.frequency,1500*Math.pow(8,P.v.tone/100))}},
 gatedreverb(){const cv=c.createConvolver();send.connect(cv);cv.connect(o);let L=-1;
  P.ap=()=>{if(P.v.len!==L){L=P.v.len;const sr=c.sampleRate,n=Math.floor(sr*L/1000),b=c.createBuffer(2,n,sr);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let lp=0;for(let i=0;i<n;i++){lp+=(Math.random()*2-1-lp)*.6;d[i]=lp*Math.min(1,(n-i)/(sr*.004))}}cv.buffer=b}}},
 infinite(){const ins=G(c,1),sz=[.0371,.0531,.0713,.0893],lines=sz.map(()=>({d:c.createDelay(.5),fb:G(c,.85),lp:BQ(c,'lowpass',8000),inv:G(c,-1)})),sum=G(c,.5),dif=[BQ(c,'allpass',700),BQ(c,'allpass',1900)];
  send.connect(dif[0]);dif[0].connect(dif[1]);dif[1].connect(ins);
  for(const l of lines){ins.connect(l.d);sum.connect(l.d);l.d.connect(l.lp);l.lp.connect(l.fb);l.fb.connect(sum);l.fb.connect(l.inv);l.inv.connect(l.d);l.lp.connect(o)}
  P.held=false;const apply=()=>{const t=c.currentTime,dec=P.held?1:P.v.decay/100*.995;lines.forEach((l,k)=>{l.d.delayTime.setTargetAtTime(sz[k]*P.v.size*3,t,.05);l.fb.gain.setTargetAtTime(dec,t,.03);l.lp.frequency.setTargetAtTime(P.held?20000:1500*Math.pow(10,P.v.tone/100),t,.03)});ins.gain.setTargetAtTime(P.held?0:1,t,.03)};
  P.ap=apply;P.action=k=>{if(k==='hold'){P.held=!P.held;apply()}}},
 ambience(){const cv=c.createConvolver();send.connect(cv);cv.connect(o);let L=-1;
  P.ap=()=>{if(P.v.size!==L){L=P.v.size;const sr=c.sampleRate,n=Math.floor(sr*L),b=c.createBuffer(2,n,sr);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let k=0;k<24;k++){const i=Math.floor(Math.random()*n);d[i]+=(Math.random()<.5?-1:1)*Math.exp(-3*i/n)*.6}let lp=0;for(let i=0;i<n;i++){lp+=(Math.random()*2-1-lp)*.5;d[i]+=lp*.25*Math.exp(-6*i/n)}}cv.buffer=b}}},
 bloom(){const cv=c.createConvolver(),sw=G(c);wk({type:'swell',cfg:{}},sw);sw.connect(cv);cv.connect(o);let dk=-1;
  P.ap=()=>{cfg({rise:P.v.rise,sens:-55});if(P.v.decay!==dk){dk=P.v.decay;cv.buffer=reverbIR(c,dk)}}},
 };
 B[id]();P.ap();if(P.mkNode){P.mkNode();P.mkNode=null}if(P.on)P.mix();return P}

// ── ボード ──
let built=null; // {c,src,dest,pedals:Map,order}
const ctxNow=()=>{try{return typeof ctx!=='undefined'&&ctx&&typeof master!=='undefined'&&master?ctx:null}catch(e){return null}};
function slotOf(target){const c=ctxNow();if(!c)return null;if(target==='master'){const e=master._eq;return e&&e.pre?[e.pre,e.trim]:null}
 try{mixLane(target)}catch(e){return null}const l=mixLanes[target]&&mixLanes[target].dry;return l&&l.pre?[l.pre,l.trim]:null}
function rewire(){if(!built)return;const {src,dest,pedals}=built;try{src.disconnect()}catch(e){}for(const p of pedals.values())try{p.output.disconnect()}catch(e){}
 let prev=src;for(const e of st.chain){const p=pedals.get(e.id);if(!p)continue;prev.connect(p.input);prev=p.output}prev.connect(dest)}
function teardown(){if(!built)return;const {src,dest,pedals}=built;try{src.disconnect()}catch(e){}for(const p of pedals.values()){try{p.output.disconnect()}catch(e){}p.stop()}src.connect(dest);built=null}
function attach(){const c=ctxNow();if(!c)return;ensureWorklet(c).catch(()=>{});const s=slotOf(st.target);if(!s)return;
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
const fmt=(k,x)=>{const u=k.u;if(u==='%')return Math.round(x)+'%';if(u==='ms')return Math.round(x)+' ms';if(u==='s')return (+x).toFixed(1)+' s';if(u==='Hz')return x>=1000?(x/1000).toFixed(1)+' kHz':(x<10?(+x).toFixed(2):Math.round(x))+' Hz';if(u==='dB')return (x>0?'+':'')+(+x).toFixed(1)+' dB';if(u===':1')return (+x).toFixed(1)+':1';if(u==='ct')return Math.round(x)+' ct';if(u==='st')return (x>0?'+':'')+(+x).toFixed(1)+' st';if(u==='bpm')return Math.round(x)+' BPM';if(u==='note')return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][x%12]+(Math.floor(x/12)-1);if(u==='oct')return (x>0?'+':x<0?'−':'±')+Math.abs(x)+' oct';return String(Math.round(x*10)/10)};
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
 if(d.actions){const row=el('div','pdActions');for(const a of d.actions){const b=el('button','pdAct',J(a.l));b.type='button';b.dataset.a=a.k;b.setAttribute('aria-pressed','false');b.onclick=()=>action(id,a.k);row.append(b)}card.append(row)}
 {const fsw=el('button','pdSwitch');fsw.type='button';fsw.setAttribute('aria-pressed','false');fsw.append(el('span','pdLed'),el('span',null,J(d.mode==='freeze'?UI.freezeSw:d.mode==='tapestop'?UI.stopSw:UI.onoff)));fsw.onclick=()=>setOn(id,!entry(id).on);card.append(fsw)}
 return card}
function render(id){const card=document.querySelector('.pdCard[data-pedal="'+id+'"]'),e=entry(id);if(!card||!e)return;const d=P_[id];
 const p=built&&built.pedals.get(id);card.classList.toggle('on',e.on);
 const fsw=card.querySelector('.pdSwitch');if(fsw)fsw.setAttribute('aria-pressed',String(e.on));
 for(const k of d.knobs){const dial=card.querySelector('.pdDial[data-k="'+k.k+'"]'),out=card.querySelector('output[data-k="'+k.k+'"]'),x=e.v[k.k];if(dial){dial.setAttribute('aria-valuenow',String(x));dial.setAttribute('aria-valuetext',fmt(k,x));dial.style.setProperty('--p',String(pos(k,x)))}if(out)out.textContent=fmt(k,x)}
 if(d.steps)for(const b of card.querySelectorAll('.pdSteps button'))b.setAttribute('aria-pressed',String(+b.dataset.v===e.v[d.steps.k]));
 if(d.actions)for(const b of card.querySelectorAll('.pdAct')){const lit=b.dataset.a==='hold'&&!!(p&&p.held);b.classList.toggle('lit',lit);b.setAttribute('aria-pressed',String(lit))}
 status()}
function status(){const s=$('pdStatus');if(!s)return;const on=st.chain.filter(e=>e.on).map(e=>J(P_[e.id].name));s.textContent=on.length?on.join(' · '):J(UI.off);const c=$('pdCount');if(c)c.textContent=st.chain.length+' / '+MAXN}
function renderAll(){const box=$('pdBoard');if(!box)return;if($('pdTarget'))$('pdTarget').value=st.target;box.textContent='';
 if(!st.chain.length){const em=el('div','pdEmpty');em.append(el('p','micro',J(UI.empty)));const row=el('div','pdSuggest');row.append(el('span','micro',J(UI.suggest)));for(const id of ['microloop','reverb','tape','freeze']){const b=el('button','pdChip',J(P_[id].name));b.type='button';b.dataset.pedal=id;b.style.setProperty('--pd',P_[id].color);b.onclick=()=>add(id);row.append(b)}em.append(row);box.append(em)}
 st.chain.forEach((e,i)=>box.append(cardEl(e.id,i,st.chain.length)));for(const e of st.chain)render(e.id);renderCatalog();status()}
// カタログ：70種あるので、名前・説明（日本語・英語）で絞り込める
let query='';
function renderCatalog(){const cat=$('pdCatalog');if(!cat||cat.hidden)return;let inp=$('pdSearch');const had=document.activeElement===inp;cat.textContent='';
 inp=el('input','pdSearch');inp.id='pdSearch';inp.type='search';inp.value=query;inp.placeholder=J(UI.search);inp.setAttribute('aria-label',J(UI.search));inp.oninput=()=>{query=inp.value;renderCatalog();const n=$('pdSearch');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}};cat.append(inp);if(had)setTimeout(()=>inp.focus(),0);
 const full=st.chain.length>=MAXN;if(full)cat.append(el('p','micro pdFull',J(UI.full)));const q=query.trim().toLowerCase();let hits=0;
 for(const [ck,ja] of DEF.cats){const ids=ALL.filter(id=>P_[id].cat===ck&&(!q||[...P_[id].name,...P_[id].desc,id].some(t=>String(t).toLowerCase().includes(q))));if(!ids.length)continue;hits+=ids.length;const g=el('div','pdCatGroup');g.append(el('h4','pdCatH',ja));const list=el('div','pdCatList');
  for(const id of ids){const d=P_[id],has=!!entry(id),b=el('button','pdCatItem');b.type='button';b.dataset.pedal=id;b.style.setProperty('--pd',d.color);b.disabled=has||full;b.append(el('strong',null,J(d.name)),el('span','micro',has?J(UI.added):J(d.desc)));b.onclick=()=>{if(add(id)){const c=document.querySelector('.pdCard[data-pedal="'+id+'"]');if(c)c.scrollIntoView({block:'nearest'})}};list.append(b)}
  g.append(list);cat.append(g)}
 if(!hits)cat.append(el('p','micro',J(UI.nohit)))}
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
window.__pedals={ready:c=>ensureWorklet(c),preset,applyPreset,attach,add,remove,move,setOn,setVal,action,setTarget,allOff,routePreview,probe,ids:ALL.slice(),def:P_,cats:DEF.cats,makePedal,shifter,
 state:()=>JSON.parse(JSON.stringify(st)),built:()=>built?{target:st.target,pedals:st.chain.filter(e=>built.pedals.has(e.id)).map(e=>e.id)}:null,instance:id=>built&&built.pedals.get(id)};
})();
