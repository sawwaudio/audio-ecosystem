const {chromium}=require('playwright');
const fs=require('node:fs'), path=require('node:path');
(async()=>{
 const out=process.argv[2], base='https://sawwaudio.github.io/audio-ecosystem-sounds-1/';
 fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
 try{
 const p=await b.newPage({viewport:{width:435,height:720},deviceScaleFactor:2,serviceWorkers:'block'});
 // Exclude photographs, external embeds and user libraries from the studio capture.
 await p.route('**/*',r=>{
 const u=new URL(r.request().url()), id=path.basename(u.pathname).split('.')[0];
 if(u.pathname.startsWith('/audio-ecosystem/audio/')&&['rain-field','rocky-beach'].includes(id)){
  const root=process.env.SAE_ROOT||path.join(__dirname,'..');
  const f=path.join(root,'audio',path.basename(path.dirname(u.pathname)),path.basename(u.pathname));
  if(fs.existsSync(f))return r.fulfill({body:fs.readFileSync(f)});
 }
 return r.request().resourceType()==='image'||!r.request().url().startsWith(base)?r.abort():r.continue()});
 await p.goto(base,{waitUntil:'domcontentloaded'});
 await p.addStyleTag({content:'img,iframe{visibility:hidden!important}'});
 await p.locator('#reelImage').selectOption('none');
 await p.locator('#tabAmbience').click();
 let download;
 for(const [i,id] of ['rain-field','rocky-beach'].entries()){
 const tile=p.locator('#ambGrid .tilePlay[data-id="'+id+'"]');
 await tile.click();await p.waitForFunction(id=>document.querySelector('#ambGrid .tilePlay[data-id="'+id+'"]').getAttribute('aria-pressed')==='true',id);
 await p.locator('#ambGrid .tile.sounding[data-id="'+id+'"]').waitFor({timeout:15000});
 await p.screenshot({path:path.join(out,'step'+i+'.png')});
 if(!i){
  download=p.waitForEvent('download',{timeout:70000}); download.catch(()=>{});
  await p.evaluate(()=>window.__reelDebug.start(18,{style:'organic'}));
  await p.waitForTimeout(3900);
 }
 }
 const file=await download;
 await file.saveAs(path.join(out,'performance.media'));
 const audit=await p.evaluate(()=>window.__reelDebug.state().result);
 if(!audit || audit.sa || !audit.entries.length || audit.entries.some(e=>e.imported || !['rain-field','rocky-beach'].includes(e.id)) || new Set(audit.entries.map(e=>e.id)).size!==2)throw Error('Unexpected sound in performance '+JSON.stringify(audit?.entries));
 fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(audit,null,2));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
