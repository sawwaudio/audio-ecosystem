const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
const root=path.resolve(__dirname,'../../..'),dir=process.argv[2];
if(!dir)throw Error('Pass an output directory');
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
const p=await b.newPage({serviceWorkers:'block',viewport:{width:390,height:844}});

const errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='https://sawwaudio.github.io')return r.abort();
const rel=u.pathname.split('/').slice(2).join('/')||'index.html';const f=path.join(root,rel);
return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({path:f}):r.abort()});
await p.goto('https://sawwaudio.github.io/audio-ecosystem-sounds-1/',{waitUntil:'domcontentloaded'});
await p.locator('#tabAmbience').click();
await p.evaluate(()=>{document.querySelector('#reelImage').value='none';document.querySelector('#reelImage').dispatchEvent(new Event('change'))});
for(const id of ['rain-field','rocky-beach']){
const tile=p.locator('#ambGrid .tilePlay[data-id="'+id+'"]');await tile.click();await p.waitForSelector('#ambGrid .tile.sounding[data-id="'+id+'"]',{state:'attached',timeout:15000});
}
const download=p.waitForEvent('download',{timeout:25000});
await p.evaluate(()=>window.__reelDebug.start(7,{style:'cell-pulse'}));await(await download).saveAs(path.join(dir,'capture.mp4'));
const result=await p.evaluate(()=>window.__reelDebug.state().result);
assert.equal(result.sa,0);assert.deepEqual(result.entries.map(x=>x.id).sort(),['rain-field','rocky-beach']);
fs.writeFileSync(path.join(dir,'credits.txt'), result.text);

assert.deepEqual(errors,[]);console.log(JSON.stringify({format:result.type,frames:result.frames,bytes:result.size,credits:result.entries}));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
