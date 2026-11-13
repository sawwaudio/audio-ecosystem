#!/usr/bin/env node
// 音声ファイルから、SAE の映像シェーダー（flow・contour・geometry）の動画を 1 コマずつ描いて作る（実時間に縛られないので、GPU のない機械でも 30fps の滑らかな動画になる）。
// シェーダーは公開アプリの index.html から読み出す（アプリと同じ絵になる）。音の解析（低域・中域・高域・音量・立ち上がり）はここで計算する。
// 使い方：node tools/render_visual.js --audio in.wav --app ../audio-ecosystem-sounds-1/index.html --out out.mp4 --size 1080x1920 --plan "contour:10,flow:10" [--hue 200] [--gl 720x1280]
// 出力：映像＋元の音声（AAC）。文字入れは別に ffmpeg で行う。
const {chromium}=require('playwright');const fs=require('fs'),cp=require('child_process'),path=require('path');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:d};
const AUDIO=arg('audio'),APP=arg('app'),OUT=arg('out'),[W,H]=arg('size','1080x1920').split('x').map(Number),FPS=+arg('fps',30),HUE=+arg('hue',200);
const [GW,GH]=arg('gl',W<H?'720x1280':'1280x720').split('x').map(Number);
const PLAN=arg('plan','contour:10').split(',').map(s=>{const [m,d]=s.split(':');return {m,d:+d}});
if(!AUDIO||!APP||!OUT){console.error('--audio --app --out は必須');process.exit(2)}
const MODE={flow:0,contour:1,geometry:2};
// 1. 音声を 48kHz モノラルの float に
const SR=48000,pcm=cp.execFileSync('ffmpeg',['-v','error','-i',AUDIO,'-ac','1','-ar',String(SR),'-f','f32le','-'],{maxBuffer:1<<30});
const x=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length>>2),DUR=x.length/SR,TOTAL=Math.min(DUR,PLAN.reduce((s,p)=>s+p.d,0)),NF=Math.floor(TOTAL*FPS);
// 2. コマごとの特徴量（FFT 2048・ブラックマン窓）
const N=2048,win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=.42-.5*Math.cos(2*Math.PI*i/(N-1))+.08*Math.cos(4*Math.PI*i/(N-1));
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]]}}
 for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const ur=re[i+k],ui=im[i+k],vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci,vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;re[i+k]=ur+vr;im[i+k]=ui+vi;re[i+k+len/2]=ur-vr;im[i+k+len/2]=ui-vi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t}}}}
const raw=[];let prev=null;
for(let f=0;f<NF;f++){const c=Math.floor(f/FPS*SR),re=new Float32Array(N),im=new Float32Array(N);let ss=0;
 for(let i=0;i<N;i++){const s=x[c-N/2+i]||0;re[i]=s*win[i];ss+=s*s}fft(re,im);
 const mag=new Float32Array(N/2);for(let i=0;i<N/2;i++)mag[i]=Math.hypot(re[i],im[i])/(N/4);
 const band=(a,b)=>{const i0=Math.max(1,Math.round(a/SR*N)),i1=Math.min(N/2-1,Math.round(b/SR*N));let s=0;for(let i=i0;i<=i1;i++)s+=mag[i]*mag[i];return Math.sqrt(s/(i1-i0+1))};
 let flux=0;if(prev)for(let i=1;i<N/2;i++){const d=mag[i]-prev[i];if(d>0)flux+=d}prev=mag;
 raw.push({low:band(40,250),mid:band(250,3000),high:band(3000,12000),rms:Math.sqrt(ss/N),flux})}
// 3. 正規化（各値の 95 パーセンタイルを 0.9 に）と平滑化（立ち上がりは速く、戻りはゆっくり）。立ち上がりは 1 秒に 3 回まで。
const pct=(k,p)=>{const a=raw.map(r=>r[k]).sort((a,b)=>a-b);return a[Math.floor(a.length*p)]||1e-9};
const nk={};for(const k of ['low','mid','high','rms','flux'])nk[k]=.9/Math.max(1e-9,pct(k,.95));
const feats=[];let sm={low:0,mid:0,high:0,rms:0},on=0,hold=0,mean=0,onT=[],pl=0,pm=0;const dt=1/FPS;
for(let f=0;f<NF;f++){const r=raw[f],t=f/FPS;for(const k of ['low','mid','high','rms']){const v=Math.min(1.2,r[k]*nk[k]);sm[k]+=(v-sm[k])*(1-Math.exp(-dt*(v>sm[k]?9:3)))}
 const fl=r.flux*nk.flux;mean=mean*.95+fl*.05;onT=onT.filter(q=>t-q<1);if(fl>mean*1.7+.08&&onT.length<3&&(!onT.length||t-onT[onT.length-1]>.2)){onT.push(t);hold=.35}
 hold=Math.max(0,hold-dt);on+=((hold>0?1:0)-on)*(1-Math.exp(-dt*6));pl+=dt*(.15+1.2*sm.low);pm+=dt*(.05+.6*sm.mid);
 feats.push({t,L:sm.low,M:sm.mid,H:sm.high,A:sm.rms,O:on,PL:pl,PM:pm})}
// 4. シェーダーをアプリから読む
const html=fs.readFileSync(APP,'utf8'),m=/const VX_FRAG=`([\s\S]*?)`;/.exec(html);if(!m){console.error('VX_FRAG が index.html に見つかりません');process.exit(3)}
const page=`<canvas id=g width=${GW} height=${GH}></canvas><canvas id=o width=${W} height=${H}></canvas><script>
const gl=g.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x};
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'#version 300 es\\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,${JSON.stringify(m[1])}));gl.linkProgram(pr);gl.useProgram(pr);
const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const l=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
const U={};for(const n of ['R','T','L','M','H','A','O','HUE','PL','PM','MODE'])U[n]=gl.getUniformLocation(pr,n);const c=o.getContext('2d');c.imageSmoothingQuality='high';
window.frame=(f,mode,hue,fade)=>{gl.viewport(0,0,${GW},${GH});gl.uniform2f(U.R,${GW},${GH});gl.uniform1f(U.T,f.t);gl.uniform1f(U.L,f.L);gl.uniform1f(U.M,f.M);gl.uniform1f(U.H,f.H);gl.uniform1f(U.A,f.A);gl.uniform1f(U.O,f.O);gl.uniform1f(U.HUE,hue);gl.uniform1f(U.PL,f.PL);gl.uniform1f(U.PM,f.PM);gl.uniform1i(U.MODE,mode);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 c.globalAlpha=1;c.drawImage(g,0,0,${W},${H});if(fade<1){c.fillStyle='rgba(3,8,10,'+(1-fade)+')';c.fillRect(0,0,${W},${H})}return o.toDataURL('image/jpeg',.93)}</script>`;
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const pg=await b.newPage();pg.on('pageerror',e=>{console.error('PAGE',e.message);process.exit(4)});await pg.setContent(page);
 const ff=cp.spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-i',AUDIO,'-t',String(NF/FPS),'-map','0:v','-map','1:a','-c:v','libx264','-preset','veryfast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',OUT],{stdio:['pipe','inherit','inherit']});
 const t0=Date.now();
 for(let f=0;f<NF;f++){const t=f/FPS;let acc=0,seg=PLAN[PLAN.length-1],ph=0;for(const p of PLAN){if(t<acc+p.d){seg=p;ph=t-acc;break}acc+=p.d}
  const fade=Math.max(0,Math.min(1,ph/.5,(seg.d-ph)/.5,(TOTAL-t)/.7+.0,t/.5));
  const url=await pg.evaluate(([F,mode,hue,fade])=>window.frame(F,mode,hue,fade),[feats[f],MODE[seg.m]??1,(HUE%360)/360,fade]);
  if(!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',')+1),'base64')))await new Promise(r=>ff.stdin.once('drain',r));
  if(f%60===0)process.stderr.write(`\r${f}/${NF} コマ（${((Date.now()-t0)/1000).toFixed(0)}秒）`)}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();
 fs.writeFileSync(OUT+'.features.json',JSON.stringify({fps:FPS,frames:NF,plan:PLAN,hue:HUE,peak:{L:Math.max(...feats.map(f=>f.L)),H:Math.max(...feats.map(f=>f.H)),A:Math.max(...feats.map(f=>f.A))},onsets:feats.filter((f,i)=>i&&f.O>feats[i-1].O&&feats[i-1].O<.05).length}));
 console.error('\n'+OUT,NF,'コマ')})();
