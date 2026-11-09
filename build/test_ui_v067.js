// v0.67 の回帰テスト：キー（12×メジャー／マイナー）、リールのテンプレート（見本つきボタン）と長さボタン、英語表示、390px。
const {chromium}=require('playwright');(async()=>{
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};const errs=[];
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.clear()}catch(e){}});await pg.reload();await pg.waitForTimeout(1200);
const st=()=>pg.evaluate(()=>({chord:document.getElementById('chord').textContent,notes:document.getElementById('notes').textContent,key:document.getElementById('harmKey').value,mode:document.getElementById('harmMode').value}));
// 1. キー：既定は C メジャー（従来と同じ）、12 のキー、E♭ マイナー、F♯ メジャー、保存して復元、演奏中に変えても止まらない
R.k0=await st();ok('key_default',R.k0.chord==='Cmaj9'&&R.k0.notes==='C · E · G · B · D'&&R.k0.key==='0'&&R.k0.mode==='major');
ok('key_count',await pg.evaluate(()=>document.querySelectorAll('#harmKey option').length===12&&document.querySelectorAll('#harmMode option').length===2));
await pg.selectOption('#harmKey','3');await pg.selectOption('#harmMode','minor');R.k1=await st();ok('key_eb_minor',R.k1.chord==='E♭m9'&&R.k1.notes==='E♭ · G♭ · B♭ · D♭ · F');
await pg.selectOption('#harmMode','major');await pg.selectOption('#harmKey','6');R.k2=await st();ok('key_fs_major',R.k2.chord==='F♯maj9'&&R.k2.notes==='F♯ · A♯ · C♯ · F · G♯');
await pg.selectOption('#harmKey','9');await pg.reload();await pg.waitForTimeout(1000);R.k3=await st();ok('key_saved',R.k3.chord==='Amaj9'&&R.k3.key==='9');
await pg.click('#play');await pg.waitForTimeout(2500);await pg.selectOption('#harmKey','7');await pg.waitForTimeout(1500);
R.k4=await pg.evaluate(()=>({chord:document.getElementById('chord').textContent,live:__bioDebug&&__bioDebug.state?__bioDebug.state().playing:undefined}));ok('key_change_while_playing',/^G/.test(R.k4.chord));
// 2. リール：テンプレートの見本ボタンが select と一致、押すと選ばれる、長さボタン
const chips=await pg.evaluate(()=>({chips:[...document.querySelectorAll('.tplChip')].map(c=>c.dataset.tpl).sort().join(),opts:[...document.querySelectorAll('#reelStyle option')].map(o=>o.value).sort().join(),pressed:[...document.querySelectorAll('.tplChip[aria-pressed=true]')].map(c=>c.dataset.tpl)}));
ok('chips_match_select',chips.chips===chips.opts&&chips.pressed.length===1);
await pg.click('.tplChip[data-tpl="geometry"]');await pg.waitForTimeout(400);
R.r1=await pg.evaluate(()=>({sel:document.getElementById('reelStyle').value,style:__reelDebug.style(),pressed:[...document.querySelectorAll('.tplChip[aria-pressed=true]')].map(c=>c.dataset.tpl)}));
ok('chip_selects',R.r1.sel==='geometry'&&R.r1.style==='geometry'&&R.r1.pressed.join()==='geometry');
await pg.selectOption('#reelStyle','pop-candy');await pg.waitForTimeout(300);ok('select_syncs_chip',(await pg.evaluate(()=>[...document.querySelectorAll('.tplChip[aria-pressed=true]')].map(c=>c.dataset.tpl).join()))==='pop-candy');
await pg.click('.seg [data-len="45"]');R.len=await pg.evaluate(()=>({v:document.getElementById('reelLength').value,p:[...document.querySelectorAll('.seg [aria-pressed=true]')].map(b=>b.dataset.len).join()}));ok('length_buttons',R.len.v==='45'&&R.len.p==='45');
ok('record_wide',await pg.evaluate(()=>{const r=document.getElementById('reelRecord').getBoundingClientRect(),p=document.getElementById('reelPreview').getBoundingClientRect();return r.width>p.width*1.6}));
// 3. 英語表示・はみ出し
await pg.click('#langToggle');await pg.waitForTimeout(600);
R.en=await pg.evaluate(()=>({un:(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})(),chip:document.querySelector('.tplChip[data-tpl="organic"] .tplName').textContent,key:document.querySelector('.keyRow label').textContent}));
R.en.un=R.en.un.filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));
ok('english',R.en.un.length===0&&R.en.chip==='Organic'&&R.en.key==='Key');
ok('no_overflow',(await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=0);
R.errs=errs.filter(e=>!/favicon|net::ERR/.test(e));ok('no_console_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
