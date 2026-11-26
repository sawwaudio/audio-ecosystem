// v0.88 ペダルとルーパーの AudioWorklet（index.html では文字列として埋め込み、Blob の URL で読み込む）。
// saww-fx：type ごとに処理を変える。micro（短いループ：速さ・逆再生・つかむ）、memory（過去の音を拾って鳴らす記憶のやまびこ）、glitch（音の立ち上がりでつかむ・崩す）、swell（音の出だしをゆっくり膨らませる）、mel（音の高さを聞き取り、テープ楽器の音色で鳴らし直す）
// saww-cap：入ってきた音をそのまま主スレッドへ送る（ルーパーの録音）
class SawwFx extends AudioWorkletProcessor{
 static get parameterDescriptors(){return [{name:'hold',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'}]}
 constructor(o){super();const p=(o&&o.processorOptions)||{};this.t=p.type;this.c=Object.assign({},p.cfg||{});this.port.onmessage=e=>{Object.assign(this.c,e.data)};const sr=sampleRate;this.sr=sr;this.seed=12345;
  if(this.t==='micro'||this.t==='memory'||this.t==='glitch'){this.N=Math.floor(sr*(p.bufSec||8));this.b=[new Float32Array(this.N),new Float32Array(this.N)];this.w=0;this.u=[0,.5];this.r=[0,0];this.heldW=-1;this.gate=0;this.env=0;this.slow=0;this.until=0;this.spd=1;this.n=0}
  if(this.t==='memory'){this.g=[{pos:0,t:0,len:1,rate:1},{pos:0,t:0,len:1,rate:1},{pos:0,t:0,len:1,rate:1}];this.first=true}
  if(this.t==='swell'){this.env=0;this.g=0;this.quiet=0;this.on=false}
  if(this.t==='mel')this.melInit()}
 rnd(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296}
 rd(ch,pos){const N=this.N;pos=((pos%N)+N)%N;const i=Math.floor(pos),f=pos-i,b=this.b[ch];return b[i]*(1-f)+b[(i+1)%N]*f}
 process(inputs,outputs,params){const inp=inputs[0]||[],out=outputs[0];const n=out[0].length,chs=out.length;const ins=[inp[0]||new Float32Array(n),inp[1]||inp[0]||new Float32Array(n)];
  if(this.t==='micro'||this.t==='glitch')this.micro(ins,out,n,chs,params.hold[0]);else if(this.t==='memory')this.memory(ins,out,n,chs);else if(this.t==='swell')this.swell(ins,out,n,chs);else if(this.t==='mel')this.mel(ins,out,n,chs);return true}
 // 窓の長さ L のループを2つの読み出しで交互に（sin² で重ねる）。つかんでいない間は書き続ける。u は「書き込み位置からどれだけ後ろか」を窓の中の割合で表す
 micro(ins,out,n,chs,holdP){const c=this.c,sr=this.sr,N=this.N;let L=Math.max(256,Math.min(N-512,Math.floor((c.len||1)*sr))),fb=c.fb||0;
  for(let i=0;i<n;i++){let hold=holdP>.5,s=c.speed==null?1:c.speed;
   if(this.t==='glitch'){const x=Math.abs(ins[0][i])+Math.abs(ins[1][i]);this.env=Math.max(x,this.env*.999);this.slow=this.slow*.9995+x*.0005;const now=this.n;
    if(now>this.until&&this.env>(c.thr||.02)&&this.env>this.slow*(c.ratio||4)){this.until=now+Math.floor((c.sustain||1)*sr);this.heldW=this.w;const pick=[1,-1,2,.5][Math.floor(this.rnd()*4)];this.spd=c.mode===1?pick:1;L=Math.max(256,Math.floor((c.len||.2)*sr))}
    hold=now<this.until;s=this.spd;this.gate+=((hold?1:0)-this.gate)*.004;this.n++}
   let y0=0,y1=0;
   for(let h=0;h<2;h++){let u=this.u[h];const d=64+u*L,pos=(hold&&this.heldW>=0?this.heldW:this.w)-d;const g=Math.sin(Math.PI*u)**2;y0+=this.rd(0,pos)*g;y1+=this.rd(1,pos)*g;
    u+=(hold?-s:(1-s))/L;if(u>=1)u-=1;if(u<0)u+=1;this.u[h]=u}
   if(this.t==='glitch'){y0*=this.gate;y1*=this.gate}
   if(!hold){this.b[0][this.w]=ins[0][i]+fb*y0;this.b[1][this.w]=ins[1][i]+fb*y1;this.w=(this.w+1)%N;this.heldW=-1}else if(this.heldW<0)this.heldW=this.w;
   out[0][i]=y0;if(chs>1)out[1][i]=y1}}
 // 記憶のやまびこ：ずっと録り続け、3つの読み出しが過去のどこかを小さな粒で鳴らす（粒ごとに場所を選び直す）
 memory(ins,out,n,chs){const c=this.c,sr=this.sr,N=this.N,spread=Math.min(N-sr,Math.max(sr*.3,(c.spread||6)*sr)),G=Math.max(256,Math.floor((c.size||.4)*sr)),fb=c.fb||0;
  if(this.first){this.first=false;this.g.forEach((g,k)=>{g.len=G;g.t=Math.floor(G*k/3);g.pos=this.w-G*2-this.rnd()*spread;g.rate=1})}
  for(let i=0;i<n;i++){let y0=0,y1=0;
   for(const g of this.g){if(g.t>=g.len){g.t=0;g.len=G;g.pos=this.w-G*2-this.rnd()*spread;const m=c.mode||0;g.rate=m===1&&this.rnd()<.5?-1:m===2&&this.rnd()<.35?2:1;if(g.rate<0)g.pos+=G}
    const w=Math.sin(Math.PI*g.t/g.len)**2,p=g.pos+g.t*g.rate;y0+=this.rd(0,p)*w;y1+=this.rd(1,p)*w;g.t++}
   y0*=.66;y1*=.66;this.b[0][this.w]=ins[0][i]+fb*y0;this.b[1][this.w]=ins[1][i]+fb*y1;this.w=(this.w+1)%N;out[0][i]=y0;if(chs>1)out[1][i]=y1}}
 // 音の出だしをゆっくり膨らませる（弓で弾いたような立ち上がり）
 swell(ins,out,n,chs){const c=this.c,sr=this.sr,thr=Math.pow(10,(c.sens==null?-40:c.sens)/20),rise=1/Math.max(1,(c.rise||1)*sr);
  for(let i=0;i<n;i++){const x=Math.max(Math.abs(ins[0][i]),Math.abs(ins[1][i]));this.env=x>this.env?this.env+(x-this.env)*.02:this.env*.9995;
   if(this.env>thr){this.quiet=0;if(!this.on){this.on=true;this.g=0}}else if(this.env<thr*.5){this.quiet++;if(this.quiet>sr*.12){this.on=false}}
   this.g=this.on?Math.min(1,this.g+rise):Math.max(0,this.g-.002);const k=this.g*this.g;out[0][i]=ins[0][i]*k;if(chs>1)out[1][i]=ins[1][i]*k}}
 // ── テープ合奏（音の高さを聞き取って、音色を差し替える） ──
 melInit(){const sr=this.sr;this.F=2048;this.H=512;this.fbuf=new Float32Array(this.F);this.fi=0;this.hop=0;this.win=new Float32Array(this.F);for(let i=0;i<this.F;i++)this.win[i]=.5-.5*Math.cos(2*Math.PI*i/(this.F-1));
  this.lo=43;this.hi=108;this.notes=[];for(let m=this.lo;m<=this.hi;m++){const f=440*Math.pow(2,(m-69)/12);this.notes.push({m,f,k:2*Math.cos(2*Math.PI*f/sr),tgt:0,env:0,ph:Math.random()})}
  const T=[[1,.35,.12,.05,.02,0,0,0],[1,.5,.33,.25,.2,.16,.14,.12],[1,.7,.5,.35,.25,.18,.12,.08],[1,0,.45,0,.25,0,.15,0],[1,.55,.2,.35,.1,.12,.05,.04],[1,.8,.6,.5,.35,.3,.2,.15],[1,.9,.8,.6,.5,.4,.3,.2],[1,.6,.4,.3,.2,.15,.1,.08]];
  this.tabs=T.map(h=>{const t=new Float32Array(2048);let mx=0;for(let i=0;i<2048;i++){let s=0;for(let k=0;k<h.length;k++)s+=h[k]*Math.sin(2*Math.PI*(k+1)*i/2048);t[i]=s;mx=Math.max(mx,Math.abs(s))}for(let i=0;i<2048;i++)t[i]/=mx;return t});this.vib=0;this.noise=0}
 melAnalyse(){const F=this.F,x=new Float32Array(F);let e=0;for(let i=0;i<F;i++){const v=this.fbuf[(this.fi+i)%F]*this.win[i];x[i]=v;e+=v*v}const c=this.c,gate=Math.pow(10,((c.sens==null?-45:c.sens))/10)*F;
  const P=this.notes.map(nt=>{let s1=0,s2=0;const k=nt.k;for(let i=0;i<F;i++){const s0=x[i]+k*s1-s2;s2=s1;s1=s0}return s1*s1+s2*s2-k*s1*s2});
  let tot=0;for(const p of P)tot+=p;for(const nt of this.notes)nt.tgt=0;if(e<gate||tot<=0)return;
  const cand=[];for(let j=1;j<P.length-1;j++){const r=P[j]/tot;if(r>.06&&P[j]>=P[j-1]&&P[j]>=P[j+1])cand.push([r,j])}cand.sort((a,b)=>b[0]-a[0]);
  for(const [r,j] of cand.slice(0,c.voices||4))this.notes[j].tgt=Math.min(1,Math.sqrt(r)*1.4)}
 mel(ins,out,n,chs){const c=this.c,sr=this.sr,tab=this.tabs[c.voice||0],oct=Math.pow(2,c.oct||0),atk=1-Math.exp(-1/(sr*Math.max(.005,c.attack||.15))),rel=1-Math.exp(-1/(sr*Math.max(.02,c.release||.8)));
  for(let i=0;i<n;i++){this.fbuf[this.fi]=(ins[0][i]+ins[1][i])*.5;this.fi=(this.fi+1)%this.F;if(++this.hop>=this.H){this.hop=0;this.melAnalyse()}
   this.vib+=2*Math.PI*.35/sr;const wob=1+.0025*Math.sin(this.vib)+.0012*Math.sin(this.vib*7.3);let y=0;
   for(const nt of this.notes){nt.env+=(nt.tgt-nt.env)*(nt.tgt>nt.env?atk:rel);if(nt.env<1e-4)continue;nt.ph+=nt.f*oct*wob/sr;if(nt.ph>=1)nt.ph-=Math.floor(nt.ph);const p=nt.ph*2048,i0=p|0;y+=(tab[i0]+(tab[(i0+1)&2047]-tab[i0])*(p-i0))*nt.env}
   y*=.25;out[0][i]=y;if(chs>1)out[1][i]=y}}
}
registerProcessor('saww-fx',SawwFx);
class SawwCap extends AudioWorkletProcessor{constructor(){super();this.on=false;this.buf=null;this.port.onmessage=e=>{if(e.data&&'on' in e.data){this.on=e.data.on;if(!this.on){this.flush();this.port.postMessage({done:true})}}};this.L=[];this.R=[];this.k=0}
 flush(){if(!this.k)return;const l=new Float32Array(this.k),r=new Float32Array(this.k);let o=0;for(let j=0;j<this.L.length;j++){l.set(this.L[j],o);r.set(this.R[j],o);o+=this.L[j].length}this.port.postMessage({l,r},[l.buffer,r.buffer]);this.L=[];this.R=[];this.k=0}
 process(inputs){const i=inputs[0];if(this.on&&i&&i[0]){this.L.push(i[0].slice(0));this.R.push((i[1]||i[0]).slice(0));this.k+=i[0].length;if(this.k>=4096)this.flush()}return true}}
registerProcessor('saww-cap',SawwCap);
