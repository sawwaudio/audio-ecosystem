// 日本語／英語切り替えの回帰テスト。python3 -m http.server 8765 で配信して実行する。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900}});const pg=await ctx.newPage();
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
const ALLOW=['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'];
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
ok('default_ja',await pg.evaluate(()=>__i18n.get()==='ja'&&document.documentElement.lang==='ja'));
const snap=()=>pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return document.querySelector('main').innerText+'|'+[...document.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')).join('|')});
await snap();await pg.waitForTimeout(300);const ja1=await snap();
await pg.click('#langToggle');await pg.waitForTimeout(200);
ok('switched_en',await pg.evaluate(()=>__i18n.get()==='en'&&document.documentElement.lang==='en'&&document.getElementById('langToggle').textContent==='日本語'));
for(const t of ['birds','insects','animals','landscape']){await pg.click(`#bioTabs [data-tab="${t}"]`);await pg.waitForTimeout(150)}
let un=(await pg.evaluate(()=>__i18n.untranslated())).filter(x=>!ALLOW.includes(x));R.untranslated_static=un;ok('static_all_en',un.length===0);
ok('play_label_en',(await pg.textContent('#play')).includes('Start autonomous play'));
await pg.click('#play');await pg.waitForTimeout(6000);
ok('autoplay_running',await pg.evaluate(()=>__audioEcosystemDebug.getState().audioState==='running'));
ok('pause_label_en',(await pg.textContent('#play')).includes('Pause'));
await pg.selectOption('#geoRegion','japan');await pg.waitForTimeout(400);
for(const m of ['compat','pcm']){await pg.selectOption('#sourceMode',m);await pg.evaluate(async()=>__bioDebug.playSpecies('blackbird',true))}
await pg.waitForTimeout(800);
un=(await pg.evaluate(()=>__i18n.untranslated())).filter(x=>!ALLOW.includes(x));R.untranslated_dynamic=un;ok('dynamic_all_en',un.length===0);
R.sourceLast=await pg.textContent('#sourceLast');R.geoResult=await pg.textContent('#geoResult');R.live=await pg.textContent('#liveSpecies');
ok('overflow_en',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.screenshot({path:'/tmp/claude-0/s/shot_en.png'});
// 記憶：再読み込みで英語のまま
await pg.reload();await pg.waitForTimeout(800);
ok('persist_en',await pg.evaluate(()=>__i18n.get()==='en')&&(await pg.textContent('#play')).includes('Start'));
// 日本語へ戻すと原文に完全一致
await pg.click('#langToggle');await pg.waitForTimeout(200);await pg.evaluate(()=>{});
const p2=await ctx.newPage();await p2.goto('http://localhost:8765/index.html');await p2.waitForTimeout(800);
ok('persist_ja',await p2.evaluate(()=>__i18n.get()==='ja'));await p2.close();
await pg.reload();await pg.waitForTimeout(800);await snap();await pg.waitForTimeout(300);const ja1b=await snap();
await pg.click('#langToggle');await pg.waitForTimeout(200);const en1=await snap();await pg.click('#langToggle');await pg.waitForTimeout(200);
const ja2=await snap();ok('en_differs',en1!==ja2);ok('roundtrip_identical',ja1b===ja2);if(ja1b!==ja2){let i=0;while(ja1b[i]===ja2[i])i++;R.diff=[ja1b.slice(i-40,i+60),ja2.slice(i-40,i+60)]}
// URL 指定
await pg.goto('http://localhost:8765/index.html?lang=en');await pg.waitForTimeout(800);ok('url_param_en',await pg.evaluate(()=>__i18n.get()==='en'));
await pg.evaluate(()=>__i18n.set('ja'));
// 既存機能の維持（25レイヤー・8音色・15楽器）
const st=await pg.evaluate(()=>({layers:__audioEcosystemDebug.getState().layerCount,voices:document.querySelectorAll('#touchVoice option').length,audition:document.querySelectorAll('#auditionButtons button').length,real:document.querySelectorAll('#realButtons button').length,instr:__sourceDebug.instruments()}));
R.state=st;ok('layers25',st.layers===25);ok('voices8',st.voices===8);ok('audition25',st.audition===25);
ok('overflow_ja',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
