const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
const R={};
R.overflow=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
R.title=await pg.title();
R.coverage=await pg.textContent('#sourceCoverage');
// start autonomous
await pg.click('#play');await pg.waitForTimeout(7000);
R.state=await pg.evaluate(()=>__audioEcosystemDebug.getState().audioState);
R.instr=await pg.evaluate(()=>__sourceDebug.instruments());
// species, multi-part, mp3-only, flac
for(const id of ['higurashi','forest-wind','forest-leaves','barking-treefrog','sparrow','hototogisu']){
  R['play_'+id]=await pg.evaluate(async id=>{const ok=await __bioDebug.playSpecies(id,true);const d=__bioDebug.decoded().find(x=>x.id===id);return {ok,d}},id);
}
R.signal=await pg.evaluate(()=>__bioDebug.signal());
// compare PCM decode with original decode in-browser (higurashi = joined parts, barking = headroom scaled)
R.compare=await pg.evaluate(async()=>{const m=__sourceDebug.manifest.recordings,out={};const ac=new OfflineAudioContext(2,44100,44100);
 for(const id of ['higurashi','barking-treefrog','blackbird','forest-leaves']){const e=m[id];const parts=await Promise.all(e.pcm.parts.map(p=>fetch(p.path).then(r=>r.arrayBuffer())));const pcm=await ac.decodeAudioData(__sourceDebug.joinWav(parts));const org=await ac.decodeAudioData(await fetch(e.original.path).then(r=>r.arrayBuffer()));
  const hs=e.pcm.headroomScale;let maxd=0,n=Math.min(pcm.length,org.length);for(let c=0;c<pcm.numberOfChannels;c++){const a=pcm.getChannelData(c),o=org.getChannelData(c);for(let i=0;i<n;i++){const dd=Math.abs(a[i]/hs-o[i]);if(dd>maxd)maxd=dd}}
  out[id]={pcmLen:pcm.length,orgLen:org.length,ch:pcm.numberOfChannels,maxAbsDiff:maxd,expected:e.pcm.frames}}return out});
// audition WAV via audio element
await pg.evaluate(()=>__previewDebug.play('tsukutsukuboshi'));await pg.waitForTimeout(2500);
R.preview=await pg.evaluate(()=>({...__previewDebug.state(),src:document.getElementById('previewPlayer').currentSrc,msg:document.getElementById('previewStatus').textContent}));
await pg.evaluate(()=>__previewDebug.stop());
// switch to compat & original
for(const mode of ['compat','original','pcm']){await pg.selectOption('#sourceMode',mode);R['mode_'+mode]=await pg.evaluate(async()=>{await __bioDebug.playSpecies('blackbird',true);return {d:__bioDebug.decoded().find(x=>x.id==='blackbird'),last:document.getElementById('sourceLast').textContent}})}
R.memory=await pg.evaluate(()=>__sourceDebug.memory());
// audit + verify subset
await pg.click('#auditPanel summary');R.auditRows=await pg.evaluate(()=>document.querySelectorAll('#auditTable tbody tr').length);
R.overflow2=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
R.verify=await pg.evaluate(()=>__sourceDebug.verifyHashes());
// record wav still works
R.rec=await pg.evaluate(async()=>{await __audioEcosystemDebug.startRecord();await new Promise(r=>setTimeout(r,1500));return __audioEcosystemDebug.recordingState()});
await pg.screenshot({path:'shot_top.png',fullPage:false});
R.errs=errs;console.log(JSON.stringify(R,null,1));await b.close()})().catch(e=>{console.error(e);process.exit(1)});
