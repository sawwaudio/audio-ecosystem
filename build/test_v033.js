// v0.33 合成の模倣音を鳴らさない・タッチ演奏を下へ移動、の回帰テスト。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});await require('./photo_fixture')(pg);const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
// タッチ演奏は生き物・環境層・リールより下、保存ボタンの手前
R.order=await pg.evaluate(()=>{const y=id=>document.getElementById(id).getBoundingClientRect().top+scrollY;return {touch:y('touchSection'),bio:y('bioSection'),field:y('fieldSection'),reel:y('reelSection'),save:y('save'),canvasInTouch:!!document.querySelector('#touchSection #field')}});
ok('touch_bottom',R.order.canvasInTouch&&R.order.touch>R.order.bio&&R.order.touch>R.order.field&&R.order.touch>R.order.reel&&R.order.touch<R.order.save);
// 全種を参加させても、実録音のない種（合成の模倣音）は鳴らない
const synthIds=await pg.evaluate(()=>{const recs=new Set(JSON.parse(document.getElementById('ae-recordings').textContent).map(r=>r.id));const all=Object.keys(__bioDebug.settings);for(const id of all)__bioDebug.settings[id].enabled=true;return all.filter(id=>!recs.has(id))});R.synthIds=synthIds.length;
await pg.click('#play');await pg.waitForTimeout(40000);
R.hist=await pg.evaluate(()=>__bioDebug.history().map(h=>h.id));
ok('some_played',R.hist.length>=1);ok('no_synth_played',R.hist.every(id=>!synthIds.includes(id)));
ok('pool_no_synth',await pg.evaluate(ids=>__bioDebug.candidatePool().every(x=>!ids.includes(x.id)),synthIds));
// タッチ演奏は従来どおり動く（ハープは実録音）
ok('touch_voices',await pg.evaluate(()=>document.querySelectorAll('#touchVoice option').length===6));
await pg.click('#langToggle');await pg.waitForTimeout(400);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
