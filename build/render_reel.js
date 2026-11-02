// v0.32 リールの自動レンダリング（クラウド用） — ロードマップ フェーズ1 / バックログ2②
// ヘッドレス Chromium でアプリを開いて自律演奏を再生し、リールモード（v0.31）で録画する。
//   中間ファイル：VP9 映像＋非圧縮 PCM 音声の WebM（Chromium が対応する場合。非対応ならアプリ既定の形式）
//   書き出し　　：ffmpeg で H.264（High・yuv420p・30fps 固定）＋ AAC 192kbps・48kHz・2ch の MP4（+faststart）
// 音声の非可逆圧縮は、この AAC 化の1回だけ（中間が PCM の場合）。映像は VP9 の中間ファイルからの再エンコードで、画質が上がるわけではない。
// 権利：商用モードは「BY-SAを除く」（既定）か「CC0・PDのみ」だけを受け付ける。録画中に鳴った素材に BY-SA が1件でもあれば MP4 を作らず失敗にする。
// 投稿はしない（Instagram への投稿はオーナーが行う）。
//
// 使い方（リポジトリ直下で python3 -m http.server 8765 を起動してから）：
//   node build/render_reel.js --sec 30 [--mode nosa|cc0] [--region japan] [--basis recorded] [--scene summer] [--style motion|analysis（既定 motion。v0.37）] [--warmup 6] [--out 出力先（既定は一時フォルダの ae_reels。リポジトリ内に動画を置かない）] [--keep]
// 出力：<名前>.mp4（H.264/AAC）、<名前>_credits.txt（キャプション案＋帰属表示）、<名前>_report.json（検査結果）。
// 終了コード：検査がすべて合格なら 0、それ以外は 1。
const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),cp=require('child_process');
const A={sec:30,mode:'nosa',region:'',basis:'recorded',scene:'',style:'motion',warmup:6,out:require('path').join(require('os').tmpdir(),'ae_reels'),url:'http://localhost:8765/index.html',keep:false};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');if(k==='keep'){A.keep=true;continue}const v=process.argv[++i];if(!(k in A)||v===undefined){console.error('不明な引数: --'+k);process.exit(2)}A[k]=typeof A[k]==='number'?Number(v):v}
if(!['nosa','cc0'].includes(A.mode)){console.error('--mode は nosa か cc0 のみ（リールに BY-SA を含めないため）');process.exit(2)}
if(!(A.sec>=1&&A.sec<=60)){console.error('--sec は 1〜60');process.exit(2)}
const PCM_MIME='video/webm;codecs=vp9,pcm';
const probe=f=>JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',f]).toString());
const meanVolume=f=>{const r=cp.spawnSync('ffmpeg',['-v','info','-nostats','-i',f,'-vn','-af','volumedetect','-f','null','-'],{encoding:'utf8'});const m=/mean_volume: (-?[\d.]+) dB/.exec(r.stderr);return m?parseFloat(m[1]):null};
(async()=>{
 fs.mkdirSync(A.out,{recursive:true});const work=fs.mkdtempSync(path.join(require('os').tmpdir(),'ae_render_'));
 const R={tool:'build/render_reel.js',version:'v0.32',started:new Date().toISOString(),params:{...A},checks:{},pass:false};const fail=[];const ok=(k,c)=>{R.checks[k]=!!c;if(!c)fail.push(k)};
 const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
  await pg.goto(A.url);await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
  await pg.evaluate(m=>__rightsDebug.set(m),A.mode);
  if(A.region)R.geo=await pg.evaluate(o=>{const g=__geoDebug.apply(o);return {ids:g.ids.length,pool:g.pool.length}},{region:A.region,basis:A.basis,habitat:'any',time:'any',role:'any'});
  if(A.scene)await pg.evaluate(s=>__bioDebug.setScene(s),A.scene);
  await pg.click('#play');await pg.waitForTimeout(A.warmup*1000);
  const pcm=await pg.evaluate(m=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(m),PCM_MIME);
  const dlP=pg.waitForEvent('download',{timeout:(A.sec+90)*1000});
  await pg.evaluate(([s,o])=>__reelDebug.start(s,o),[A.sec,pcm?{mime:PCM_MIME,videoBitsPerSecond:20000000,style:A.style}:{style:A.style}]);
  const dl=await dlP;const raw=path.join(work,dl.suggestedFilename());await dl.saveAs(raw);await pg.waitForTimeout(300);
  const st=await pg.evaluate(()=>__reelDebug.state());const res=st.result||{};
  R.intermediate={file:path.basename(raw),mime:pcm?PCM_MIME:'(アプリ既定)',bytes:fs.statSync(raw).size,frames:res.frames,duration:res.duration};
  const ri=probe(raw);R.intermediate.streams=ri.streams.map(s=>[s.codec_type,s.codec_name,s.width||s.channels,s.height||s.sample_rate]);
  R.mode=await pg.evaluate(()=>__rightsDebug.mode);R.entries=(res.entries||[]).map(e=>({id:e.id,kind:e.kind,license:e.license,imported:e.imported}));R.sa=res.sa;
  ok('mode_kept',R.mode===A.mode);ok('no_bysa',res.sa===0&&R.entries.every(e=>e.imported||!/BY-SA/i.test(e.license||'')));
  ok('cc0_only_if_requested',A.mode!=='cc0'||R.entries.every(e=>e.imported||/^(CC0|Public domain)/i.test(e.license||'')));
  ok('entries_recorded',R.entries.length>=1);ok('caption',/キャプション案/.test(res.text||'')&&/Caption draft/.test(res.text||''));
  ok('page_no_errors',errs.length===0);R.pageErrors=errs;
  const base=path.join(A.out,'audio_ecosystem_reel_'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)+'_'+A.mode+(A.region?'_'+A.region:'')+(A.scene?'_'+A.scene:''));
  if(!fail.length){
   const mp4=base+'.mp4';
   cp.execFileSync('ffmpeg',['-y','-v','error','-i',raw,'-map','0:v:0','-map','0:a:0','-vf','fps=30,scale=1080:1920:flags=lanczos:out_range=tv,setsar=1,format=yuv420p','-c:v','libx264','-preset','medium','-profile:v','high','-level:v','4.1','-pix_fmt','yuv420p','-color_range','tv','-b:v','8M','-maxrate','10M','-bufsize','16M','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',mp4]);
   const o=probe(mp4),v=o.streams.find(s=>s.codec_type==='video'),a=o.streams.find(s=>s.codec_type==='audio'),dur=parseFloat(o.format.duration);
   R.output={file:path.basename(mp4),bytes:fs.statSync(mp4).size,duration:dur,video:v&&{codec:v.codec_name,profile:v.profile,w:v.width,h:v.height,pix:v.pix_fmt,fps:v.r_frame_rate},audio:a&&{codec:a.codec_name,ch:a.channels,rate:a.sample_rate,bitrate:a.bit_rate},meanVolume:meanVolume(mp4)};
   ok('h264',v&&v.codec_name==='h264'&&v.pix_fmt==='yuv420p');ok('size_1080x1920',v&&v.width===1080&&v.height===1920);ok('fps_30',v&&v.r_frame_rate==='30/1');
   ok('aac_48k_stereo',a&&a.codec_name==='aac'&&a.channels===2&&a.sample_rate==='48000');ok('duration',Math.abs(dur-res.duration)<1.5);
   ok('not_silent',R.output.meanVolume!==null&&R.output.meanVolume>-70);ok('faststart',(()=>{const h=fs.readFileSync(mp4).subarray(0,4096).toString('latin1');return h.indexOf('moov')>=0&&h.indexOf('moov')<h.indexOf('mdat')||h.indexOf('mdat')<0})());
   const lines=String(res.text||'').split('\r\n');lines[0]='リール動画 / Reel video: '+path.basename(mp4)+' (1080×1920, '+dur.toFixed(1)+' s, H.264/AAC MP4 — 中間ファイル / intermediate: '+(pcm?'VP9 + PCM WebM':'browser default')+')';
   fs.writeFileSync(base+'_credits.txt','﻿'+lines.join('\r\n'));
  }
  if(A.keep)fs.copyFileSync(raw,base+'_intermediate'+path.extname(raw));
 }catch(e){R.error=String(e&&e.stack||e);fail.push('exception')}
 finally{await b.close()}
 R.pass=fail.length===0;R.failed=fail;R.finished=new Date().toISOString();
 const reportFile=(R.output?path.join(A.out,R.output.file.replace(/\.mp4$/,'')):path.join(A.out,'audio_ecosystem_reel_failed_'+Date.now()))+'_report.json';
 fs.writeFileSync(reportFile,JSON.stringify(R,null,1));console.log(JSON.stringify(R,null,1));console.log(R.pass?'RENDER PASS':'RENDER FAIL: '+fail.join(', '));process.exit(R.pass?0:1)})();
