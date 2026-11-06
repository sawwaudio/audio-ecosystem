const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
for(const url of ['http://localhost:8765/index.html','file:///home/claude/v023/legacy/AUDIO_ECOSYSTEM_v0_23.html']){const pg=await b.newPage();await require('./photo_fixture')(pg);await pg.goto(url);
const r=await pg.evaluate(()=>({layers:__audioEcosystemDebug.getState().layerCount,voices:[...document.querySelectorAll('#touchVoice option')].map(o=>o.value),audition:document.querySelectorAll('#auditionButtons button').length,real:document.querySelectorAll('#realButtons button').length,preset:Object.keys(__audioEcosystemDebug.exportData()).join(',')}));
await pg.click('#play');await pg.waitForTimeout(4000);r.trig=await pg.evaluate(()=>['harp','vibes'].map(k=>__audioEcosystemDebug.triggerVoice(k)));
console.log(url.slice(-24),JSON.stringify(r));await pg.close()}
await b.close()})();
