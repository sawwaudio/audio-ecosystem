#!/usr/bin/env node
// 2026-11-24 新しいリールテンプレート（Visual Engine 2.0：光る流れ life-earth・枝分かれ成長 life-organic・粒子の宇宙 life-particle・アトラクタ life-math）で
// ショート用の動画を 1 コマずつ作る。描き方は公開アプリ（本体 main の index.html）の「const V2_DT」〜「function reelDrawVisual」の直前をそのまま読み込むので、アプリと同じ絵になる。
// 音の解析（低域・中域・高域・音量・立ち上がり）は render_visual.js と同じ。更新は 1/30 秒刻みで、コマごとに 1 回進める（実時間に縛られない）。
// 使い方：node tools/render_v2.js --audio in.wav --app index.html --out out.mp4 --style life-earth [--seed 123] [--warm 4] [--fps 30]
//   --warm：最初のコマより前に、何秒ぶん先に育てておくか（研究メモ「最初のフレームを完成した姿にする」。0 で従来どおり何もない所から）
// 出力：映像＋元の音声（AAC）。文字入れは別に ffmpeg で行う。
const {chromium}=require('playwright');const fs=require('fs'),cp=require('child_process');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d};
const AUDIO=arg('audio'),APP=arg('app'),OUT=arg('out'),STYLE=arg('style','life-earth'),FPS=+arg('fps',30);let SEED=+arg('seed',12345);
// 枝分かれ成長は育つのに時間がかかるので長めに先に育てる（最初のフレームから画面が埋まる）
const WARM=+arg('warm',-1)>=0?+arg('warm'):(STYLE==='life-organic'?14:4);
if(!AUDIO||!APP||!OUT){console.error('--audio --app --out は必須');process.exit(2)}
const SR=48000,pcm=cp.execFileSync('ffmpeg',['-v','error','-i',AUDIO,'-ac','1','-ar',String(SR),'-f','f32le','-'],{maxBuffer:1<<30});
const x=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length>>2),NF=Math.floor(x.length/SR*FPS);
const N=2048,win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=.42-.5*Math.cos(2*Math.PI*i/(N-1))+.08*Math.cos(4*Math.PI*i/(N-1));
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
 for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const ur=re[i+k],ui=im[i+k],vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci,vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;re[i+k]=ur+vr;im[i+k]=ui+vi;re[i+k+len/2]=ur-vr;im[i+k+len/2]=ui-vi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t}}}}
const raw=[];let prev=null;
for(let f=0;f<NF;f++){const c=Math.floor(f/FPS*SR),re=new Float32Array(N),im=new Float32Array(N);let ss=0;
 for(let i=0;i<N;i++){const s=x[c-N/2+i]||0;re[i]=s*win[i];ss+=s*s}fft(re,im);
 const mag=new Float32Array(N/2);for(let i=0;i<N/2;i++)mag[i]=Math.hypot(re[i],im[i])/(N/4);
 const band=(a,b)=>{const i0=Math.max(1,Math.round(a/SR*N)),i1=Math.min(N/2-1,Math.round(b/SR*N));let s=0;for(let i=i0;i<=i1;i++)s+=mag[i]*mag[i];return Math.sqrt(s/(i1-i0+1))};
 let flux=0;if(prev)for(let i=1;i<N/2;i++){const d=mag[i]-prev[i];if(d>0)flux+=d}prev=mag;raw.push({low:band(40,250),mid:band(250,3000),high:band(3000,12000),rms:Math.sqrt(ss/N),flux})}
const pct=(k,p)=>{const a=raw.map(r=>r[k]).sort((a,b)=>a-b);return a[Math.floor(a.length*p)]||1e-9};
const nk={};for(const k of ['low','mid','high','rms','flux'])nk[k]=.9/Math.max(1e-9,pct(k,.95));
const feats=[];let sm={low:0,mid:0,high:0,rms:0},on=0,hold=0,mean=0,onT=[];const dt=1/FPS;
for(let f=0;f<NF;f++){const r=raw[f],t=f/FPS;for(const k of ['low','mid','high','rms']){const v=Math.min(1.2,r[k]*nk[k]);sm[k]+=(v-sm[k])*(1-Math.exp(-dt*(v>sm[k]?9:3)))}
 const fl=r.flux*nk.flux;mean=mean*.95+fl*.05;onT=onT.filter(q=>t-q<1);if(fl>mean*1.7+.08&&onT.length<3&&(!onT.length||t-onT[onT.length-1]>.2)){onT.push(t);hold=.35}
 hold=Math.max(0,hold-dt);on+=((hold>0?1:0)-on)*(1-Math.exp(-dt*6));feats.push({E:{low:sm.low,mid:sm.mid,high:sm.high,rms:sm.rms},on})}
const html=fs.readFileSync(APP,'utf8'),s0=html.indexOf('const V2_DT'),s1=html.indexOf('function reelDrawVisual',s0);
if(s0<0||s1<0){console.error('Visual Engine 2.0 のコードが index.html に見つかりません');process.exit(3)}
const code=html.slice(s0,s1).replace(/window\.__v2Frame=[^\n]*\n/,'');
const page=`<canvas id=reelCanvas width=1080 height=1920></canvas><script>
const REEL_W=1080,REEL_H=1920,REEL_SAFE={x0:60,x1:REEL_W-148,y0:220,y1:REEL_H-340},REEL_MONO='monospace';const $=id=>document.getElementById(id);function vxOverlay(){}
${code}
const cv=$('reelCanvas'),c=cv.getContext('2d');let v={seed:1,on:0,dt:V2_DT};window.reset=s=>{v={seed:s,on:0,dt:V2_DT}};
window.luma=()=>{const B=v2Buf(v);let s=0;for(let i=0;i<B.R.length;i+=7)s+=B.R[i]+B.G[i]+B.Bl[i];return s/(B.R.length/7)};
window.step=(E,on,draw)=>{v.on=on;v.dt=V2_DT;if(!draw){const B=v2Buf(v);const P={'life-earth':[.92,v2Earth],'life-organic':[.9996,v2Organic],'life-particle':[.93,v2Particle],'life-math':[.93,v2Math]}['${STYLE}'];P[1](B,E,on);B.time+=V2_DT;v2Fade(B,P[0]*P[0]);return null}
 c.save();v2Draw(c,v,E,'${STYLE}');c.restore();return cv.toDataURL('image/jpeg',.92)}</script>`;
(async()=>{const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>{console.error('PAGE',e.message);process.exit(4)});await pg.setContent(page);
 const nW=Math.round(WARM*30),m=feats.slice(0,Math.min(feats.length,FPS*3)),E0={};for(const k of ['low','mid','high','rms'])E0[k]=m.reduce((s,f)=>s+f.E[k],0)/m.length;
 const warm=async()=>{await pg.evaluate(([E,n])=>{for(let i=0;i<n;i++)window.step(E,0,false)},[E0,nW])};
 // 2026-11-24 途中で絵が消えかける種（アトラクタの係数が退化する等）を避ける：先に全体を描かずに進め、明るさの最小が中央値の35%未満なら次の種
 for(let tries=0;tries<8;tries++){await pg.evaluate(s=>window.reset(s),SEED);await warm();
  const L=await pg.evaluate(([F])=>{const o=[];for(const f of F){window.step(f.E,f.on,false);o.push(window.luma())}return o},[feats]);
  const srt=[...L].sort((a,b)=>a-b),med=srt[srt.length>>1],mn=srt[0];console.error(`seed ${SEED} 明るさ 最小/中央値 ${(mn/med).toFixed(2)}`);
  if(mn>=med*.35)break;SEED+=7919}
 await pg.evaluate(s=>window.reset(s),SEED);await warm();
 const ff=cp.spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-i',AUDIO,'-t',String(NF/FPS),'-map','0:v','-map','1:a','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',OUT],{stdio:['pipe','inherit','inherit']});
 const t0=Date.now();
 for(let f=0;f<NF;f++){const url=await pg.evaluate(([E,on])=>window.step(E,on,true),[feats[f].E,feats[f].on]);
  if(!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',')+1),'base64')))await new Promise(r=>ff.stdin.once('drain',r));
  if(f%60===0)process.stderr.write(`\r${STYLE} ${f}/${NF}（${((Date.now()-t0)/1000).toFixed(0)}秒）`)}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.error('\n'+OUT,NF,'コマ')})();
