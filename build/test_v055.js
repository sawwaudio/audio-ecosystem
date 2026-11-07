// v0.55：伝統楽器6種（ムビラ・バラフォン・ダン・チャン・弓で弾くプサルテリー・ネパールのハンドベル・ディジュリドゥのフレーズ）と、
// 無料版で出せる楽器を限る仕組み（data/product_tiers.json の instruments.free、「無料版の見え方を試す」）の回帰テスト。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const wait=ms=>pg.waitForTimeout(ms);
const NEW={low:['didgePhrase'],melody:['mbira','balafon','danTranh','bowedPsaltery'],perc:['handBells']},ALL=[...NEW.low,...NEW.melody,...NEW.perc];
const FREE=['didge','natureLow','organPedal','harp','kalimba','frameDrum'];
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{['ae-lang','saww.planPreview'].forEach(k=>localStorage.removeItem(k))}catch(e){}});await pg.reload();await wait(900);
// 1. 録音の台帳：32本・VCSL 固定コミット・CC0・音高
R.data=await pg.evaluate(()=>{const s=JSON.parse(document.getElementById('ae-instruments').textContent).filter(x=>x.added==='v0.55');const m=JSON.parse(document.getElementById('ae-audio-manifest').textContent).instruments;
 const by=k=>s.filter(x=>x.kind===k);return {n:s.length,kinds:[...new Set(s.map(x=>x.kind))].join(),cc0:s.every(x=>x.license==='CC0 1.0'&&/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/.test(x.url)&&/^[0-9a-f]{64}$/.test(x.sha256)),files:s.every(x=>m[x.id]&&m[x.id].pcm.lossless&&m[x.id].compat),
  mbira:by('mbira').map(x=>x.midi),bells:by('handBells').every(x=>!x.pitched),didge:by('didgePhrase').every(x=>x.pitched&&x.midi===37)}});
ok('data',R.data.n===32&&R.data.kinds==='mbira,balafon,danTranh,bowedPsaltery,handBells,didgePhrase'&&R.data.cc0&&R.data.files&&R.data.mbira.join()==='59.3,63.08,66.15,68.12,71.22,73.02,76.1'&&R.data.bells&&R.data.didge);
// 2. 楽器（実録音）の欄：低音・旋律・打楽器に入る・PRO の印（無料の6種以外）
R.panel=await pg.evaluate(()=>{const sec=[...document.querySelectorAll('#instrBody .layerSub')].map(s=>[...s.querySelectorAll('.control[data-layer]')].map(r=>r.dataset.layer));
 const chip=k=>!!document.querySelector('#instrBody .control[data-layer="'+k+'"] label .proChip');const keys=[...document.querySelectorAll('#instrBody .control[data-layer]')].map(r=>r.dataset.layer);
 return {sec,pro:keys.filter(chip),free:keys.filter(k=>!chip(k)),labels:['mbira','danTranh','didgePhrase'].map(k=>document.querySelector('label[for="param-'+k+'"]').firstChild.textContent).join('|'),
  enabled:keys.every(k=>!document.getElementById('param-'+k).disabled),note:document.getElementById('instrTierNote').textContent}});
ok('sections',NEW.low.every(k=>R.panel.sec[0].includes(k))&&NEW.melody.every(k=>R.panel.sec[1].includes(k))&&NEW.perc.every(k=>R.panel.sec[2].includes(k))&&R.panel.labels==='ムビラ（ジンバブエ）|ダン・チャン（ベトナムの箏）|ディジュリドゥ（フレーズ）');
ok('pro_marks',R.panel.free.slice().sort().join()===FREE.slice().sort().join()&&ALL.every(k=>R.panel.pro.includes(k))&&R.panel.enabled&&/テスト公開中は全部の楽器が鳴ります/.test(R.panel.note));
// 3. テスト公開中（beta）は全部鳴る：新しい6種がそれぞれ鳴る
const setP=(k,v)=>pg.evaluate(([k,v])=>{const el=document.getElementById('param-'+k);el.value=v;el.dispatchEvent(new Event('input'))},[k,v]);
await pg.click('#play');await wait(1500);R.play={};
for(const k of ALL){await setP(k,70);let seen=false;for(let i=0;i<60&&!seen;i++){if(i%15===0)await pg.evaluate(k=>__realDebug.hit(k),k);await wait(100);seen=await pg.evaluate(k=>__realDebug.voices().includes(k),k)}R.play[k]=seen;await setP(k,0)}
ok('plays_beta',Object.values(R.play).every(Boolean));
// 4. 無料版の見え方を試す：PRO の楽器は止まり、鳴らない。無料の楽器は鳴る
await setP('mbira',60);await setP('gong',40);await setP('didge',50);await wait(300);
await pg.evaluate(()=>document.getElementById('plansSection').scrollIntoView());await pg.check('#planPreview');await wait(400);
R.free=await pg.evaluate(()=>({mbira:{dis:document.getElementById('param-mbira').disabled,v:document.getElementById('param-mbira').value,locked:document.querySelector('#instrBody .control[data-layer="mbira"]').classList.contains('locked')},
 gong:document.getElementById('param-gong').value,didge:{dis:document.getElementById('param-didge').disabled,v:document.getElementById('param-didge').value},
 allowed:{mbira:__instrAllowed('mbira'),didge:__instrAllowed('didge'),harp:__instrAllowed('harp'),vibes:__instrAllowed('vibes'),bells:__instrAllowed('bells'),sub:__instrAllowed('sub')},
 hit:__realDebug.hit('balafon'),note:document.getElementById('instrTierNote').textContent,saved:localStorage.getItem('saww.planPreview')}));
await wait(2500);R.free.voices=await pg.evaluate(()=>__realDebug.voices());
ok('free_locks',R.free.mbira.dis&&R.free.mbira.v==='0'&&R.free.mbira.locked&&R.free.gong==='0'&&!R.free.didge.dis&&R.free.didge.v==='50');
ok('free_gate',!R.free.allowed.mbira&&R.free.allowed.didge&&R.free.allowed.harp&&!R.free.allowed.vibes&&R.free.allowed.bells&&R.free.allowed.sub&&R.free.hit===false&&!R.free.voices.some(k=>ALL.includes(k)||k==='gong')&&R.free.saved==='free'&&/^無料版：6種の楽器が鳴ります/.test(R.free.note));
// 無料の楽器（ディジュリドゥの持続音）は鳴り続ける
R.didge=await pg.evaluate(()=>__realDebug.loops?__realDebug.loops():null);
// 読み直しても無料版のまま・解除すると全部戻る
await pg.reload();await wait(900);R.persist=await pg.evaluate(()=>({cb:document.getElementById('planPreview').checked,dis:document.getElementById('param-balafon').disabled}));
ok('free_persist',R.persist.cb&&R.persist.dis);
await pg.evaluate(()=>document.getElementById('plansSection').scrollIntoView());await pg.uncheck('#planPreview');await wait(300);
R.back=await pg.evaluate(()=>({dis:[...document.querySelectorAll('#instrBody .control[data-layer] input')].some(i=>i.disabled),allowed:__instrAllowed('mbira'),saved:localStorage.getItem('saww.planPreview')}));
ok('back_to_beta',!R.back.dis&&R.back.allowed&&R.back.saved==='beta');
// 5. プランの比較表に楽器の行
R.rows=await pg.evaluate(()=>[...document.querySelectorAll('.planTable tbody tr')].map(r=>[...r.children].map(c=>c.textContent).join('|')).filter(t=>/楽器（実録音）/.test(t)));
ok('plan_rows',R.rows.length===2&&/^楽器（実録音）6種：.*\|✓\|✓$/.test(R.rows[0])&&/^すべての楽器（実録音）.*\|—\|✓$/.test(R.rows[1]));
// 6. 英語表示・はみ出し・エラー
await pg.click('#langToggle');await wait(500);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;
R.en=await pg.evaluate(()=>({mbira:document.querySelector('label[for="param-mbira"]').firstChild.textContent,prev:document.querySelector('.planPreview').textContent.trim()}));
ok('english',un.length===0&&R.en.mbira==='Mbira (Zimbabwe)'&&R.en.prev==='Preview the free version (instrument limits)');
await pg.click('#langToggle');await wait(300);ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{['ae-lang','saww.planPreview'].forEach(k=>localStorage.removeItem(k))}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
