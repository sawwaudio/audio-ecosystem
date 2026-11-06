// v0.28 環境層5本（高山の川・森の渓流・米国中西部の森の風・東京のセミ2本）と既定の環境層の回帰テスト。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});await require('./photo_fixture')(pg);const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
const NEW={'takayama-river':45,'california-stream':37,'midwest-woods-wind':45,'tokyo-park-cicadas':45,'nakameguro-cicadas':45};
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
// 既定の環境層は BY-SA を含まない（高山の川＋森の葉）
R.defaults=await pg.evaluate(()=>[...document.querySelectorAll('#fieldControls input')].filter(i=>+i.value>0).map(i=>i.id.replace('field-','')));
ok('default_beds',R.defaults.sort().join()==='forest-leaves,takayama-river');
await pg.click('#play');await pg.waitForTimeout(2500);
for(const mode of ['pcm','compat']){await pg.selectOption('#sourceMode',mode);for(const [id,sec] of Object.entries(NEW)){const d=await pg.evaluate(async id=>{try{const buf=await __bioDebug.loadOne(id);return {ok:true,dur:buf.duration,ch:buf.numberOfChannels}}catch(e){return {ok:false,e:e.message}}},id);R[mode+':'+id]=d;ok(mode+'_'+id,d.ok&&Math.abs(d.dur-sec)<0.3&&d.ch===(mode==='pcm'?2:1))}}
await pg.selectOption('#sourceMode','pcm');
// 販売・リール用（BY-SAを除く）でも既定の環境層が鳴る
await pg.selectOption('#rightsMode','nosa');await pg.waitForTimeout(6000);
R.sounding=await pg.evaluate(()=>__fieldDebug.sounding());ok('nosa_default_sounds',R.sounding.includes('takayama-river')&&R.sounding.includes('forest-leaves'));
R.signal=await pg.evaluate(()=>__bioDebug.signal());ok('nonsilent',R.signal.rms>1e-4);
await pg.selectOption('#rightsMode','all');
// 日本で録音 → 日本の環境層（新規3本を含む）／米国の2本は入らない
const g=await pg.evaluate(()=>__geoDebug.apply({region:'japan',basis:'recorded',habitat:'any',time:'any',role:'any'}));
ok('geo_japan',['takayama-river','tokyo-park-cicadas','nakameguro-cicadas'].every(id=>g.fields[id]>0)&&g.fields['california-stream']===0&&g.fields['midwest-woods-wind']===0);
const n=await pg.evaluate(()=>__geoDebug.apply({region:'north_america',basis:'recorded',habitat:'any',time:'any',role:'any'}));
ok('geo_na',n.fields['california-stream']>0&&n.fields['midwest-woods-wind']>0&&n.fields['takayama-river']===0);
await pg.evaluate(()=>__geoDebug.apply({region:'off'}));
await pg.click('#langToggle');await pg.waitForTimeout(300);const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
await pg.click('#langToggle');ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
