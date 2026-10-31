const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(500);
const cases=[{region:'japan',basis:'native'},{region:'japan',basis:'recorded'},{region:'japan',basis:'endemic'},{region:'japan',basis:'native',habitat:'temperate_forest',time:'night'},{region:'europe',basis:'native'},{region:'europe',basis:'recorded'},{region:'north_america',basis:'recorded'},{region:'south_america',basis:'native'},{region:'oceania',basis:'recorded'},{region:'marine'},{region:'world',habitat:'night_forest'},{region:'world',role:'Drone'},{region:'africa',basis:'native',habitat:'any',time:'any',role:'any'}];
for(const c of cases){const r=await pg.evaluate(c=>__geoDebug.apply(Object.assign({region:'off',basis:'native',habitat:'any',time:'any',role:'any'},c)),c);console.log(JSON.stringify(c),'→',r.ids.length,r.ids.join(','),'| fields>0:',Object.entries(r.fields).filter(([,v])=>v>0).map(([k])=>k).join(','));}
// play with japan recorded and check what actually plays
await pg.evaluate(()=>__geoDebug.apply({region:'japan',basis:'recorded',habitat:'any',time:'any',role:'any'}));
await pg.click('#play');await pg.waitForTimeout(25000);
const h=await pg.evaluate(()=>__bioDebug.history().map(x=>x.id));const allowed=await pg.evaluate(()=>__geoDebug.apply({}).ids);
console.log('played',[...new Set(h)].join(','),'outside filter:',h.filter(x=>!allowed.includes(x)));
console.log('fields playing',await pg.evaluate(()=>document.getElementById('fieldStatus').textContent));
console.log('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'errs',errs);
await pg.locator('#geoPanel').screenshot({path:'shot_geo.png'});await b.close()})();
