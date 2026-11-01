// v0.26 音声メモリ対策（環境層のローテーション）の回帰テスト。python3 -m http.server 8765 で配信して実行する（約2分）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const SECS=+(process.env.SECS||110);
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
await pg.click('#play');await pg.waitForTimeout(1500);
// 9層すべてを30%に
await pg.evaluate(()=>{for(const i of document.querySelectorAll('#fieldControls input')){i.value=30;i.dispatchEvent(new Event('input'))}});
const seen=new Set();let maxSound=0,over=0,maxPcm=0,budget=0,memMsg=[];const counts=[];
for(let t=0;t<SECS;t++){await pg.waitForTimeout(1000);const s=await pg.evaluate(()=>({snd:__fieldDebug.sounding(),st:__bioDebug.stats(),msgs:[document.getElementById('message').textContent,document.getElementById('realStatus').textContent,document.getElementById('fieldStatus').textContent]}));
 s.snd.forEach(x=>seen.add(x));maxSound=Math.max(maxSound,s.snd.length);if(s.snd.length>4)over++;counts.push(s.snd.length);maxPcm=Math.max(maxPcm,s.st.pcmBytes);budget=s.st.pcmBudget;
 for(const m of s.msgs)if(/メモリ上限|読み込み待ち/.test(m))memMsg.push(t+':'+m)}
R.seen=[...seen];R.maxSounding=maxSound;R.secondsOver4=over;R.maxPcmMB=+(maxPcm/1048576).toFixed(1);R.memMsg=memMsg.slice(0,5);R.counts=counts.join('');
ok('cap',maxSound<=5&&over<=6);ok('rotation',seen.size>=8);ok('budget',maxPcm<=budget);ok('no_memory_messages',memMsg.length===0);
R.fieldStatus=await pg.textContent('#fieldStatus');ok('status_note',R.fieldStatus.includes('同時に鳴るのは4層まで'));
R.bio=await pg.evaluate(()=>__bioDebug.stats());ok('creatures_still_play',R.bio.highWater>=1);
R.signal=await pg.evaluate(()=>__bioDebug.signal());ok('nonsilent',R.signal.rms>1e-4);
await pg.click('#langToggle');await pg.waitForTimeout(300);R.fieldStatusEn=await pg.textContent('#fieldStatus');
const un=(await pg.evaluate(()=>__i18n.untranslated())).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
await pg.click('#langToggle');
// 2層だけ（既定）に戻すとローテーションの注記が消え、両方が鳴り続ける
await pg.evaluate(()=>{for(const i of document.querySelectorAll('#fieldControls input')){i.value=['field-river-esk','field-forest-leaves'].includes(i.id)?30:0;i.dispatchEvent(new Event('input'))}});
await pg.waitForTimeout(3000);R.after=await pg.evaluate(()=>__fieldDebug.sounding());ok('two_beds',R.after.length<=2&&R.after.every(x=>['river-esk','forest-leaves'].includes(x)));
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
