// v0.27 商用モード（ライセンス区分フィルター）の回帰テスト。python3 -m http.server 8765 で配信して実行する（約1分半）。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
const ALLOW=['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'];
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
ok('default_all',await pg.evaluate(()=>__rightsDebug.mode==='all'&&document.getElementById('rightsMode').value==='all'));
// 区分：自然録音41本＝A9・B15・C17（v0.28）、楽器15本＝すべてA
R.tiers=await pg.evaluate(()=>{const c={};for(const r of JSON.parse(document.getElementById('ae-recordings').textContent)){const t=__rightsDebug.tierOf(r.license);c[t]=(c[t]||0)+1}return c});
ok('tiers_59_51_17',R.tiers.A===59&&R.tiers.B===51&&R.tiers.C===17&&!R.tiers.X);  // v0.38：86本追加（BY-SA の新規採用なし）
ok('instruments_A',await pg.evaluate(()=>JSON.parse(document.getElementById('ae-instruments').textContent).every(s=>__rightsDebug.tierOf(s.license)==='A')));
const tierOf=await pg.evaluate(()=>Object.fromEntries(JSON.parse(document.getElementById('ae-recordings').textContent).map(r=>[r.id,__rightsDebug.tierOf(r.license)])));
// BY-SAを除く：日本の生き物（BY-SAのミンミンゼミ・カジカガエルを含む）＋環境層すべて
await pg.click('#play');await pg.waitForTimeout(1500);
await pg.evaluate(()=>{__bioDebug.setScene('japan');for(const i of document.querySelectorAll('#fieldControls input')){i.value=30;i.dispatchEvent(new Event('input'))}});
await pg.selectOption('#rightsMode','nosa');await pg.waitForTimeout(300);
const h0=await pg.evaluate(()=>__bioDebug.history().length);
const dl=pg.waitForEvent('download',{timeout:60000});await pg.evaluate(async()=>{await __audioEcosystemDebug.startRecord()});
const heard=new Set(),fields=new Set();let poolBad=[];
for(let t=0;t<25;t++){await pg.waitForTimeout(1000);const s=await pg.evaluate(()=>({a:__rightsDebug.active(),pool:__rightsDebug.pool(),on:__rightsDebug.fieldOn()}));
 s.a.bio.forEach(x=>heard.add(x));s.a.field.forEach(x=>fields.add(x));poolBad.push(...s.pool.filter(x=>tierOf[x]==='C'),...s.on.filter(x=>tierOf[x]==='C'))}
const hist=await pg.evaluate(n=>__bioDebug.history().slice(n).map(x=>x.id),h0);hist.forEach(x=>heard.add(x));
R.nosaHeard=[...heard];R.nosaFields=[...fields];
ok('nosa_no_BYSA_bio',[...heard].every(x=>tierOf[x]!=='C'));ok('nosa_no_BYSA_field',[...fields].every(x=>tierOf[x]!=='C'));ok('nosa_pool_clean',poolBad.length===0);
ok('nosa_still_plays',heard.size>=1&&fields.size>=1);
R.signal=await pg.evaluate(()=>__bioDebug.signal());ok('nonsilent',R.signal.rms>1e-4);
R.result=await pg.textContent('#rightsResult');ok('result_text',R.result.includes('使える実録音 110/127件')&&R.result.includes('対象外の17件'));
await pg.evaluate(()=>document.getElementById('tracksSection').open=true);await pg.click('#stopRecord');const d=await dl;const buf=fs.readFileSync(await d.path());
const icmt=(()=>{let o=12;while(o+8<=buf.length){const id=buf.toString('ascii',o,o+4),sz=buf.readUInt32LE(o+4);if(id==='LIST'){let p=o+12;while(p+8<=o+8+sz){const k=buf.toString('ascii',p,p+4),n=buf.readUInt32LE(p+4);if(k==='ICMT')return buf.toString('utf8',p+8,p+8+n);p+=8+n+(n%2)}}o+=8+sz+(sz%2)}return ''})();
R.icmtHead=icmt.split('\r\n').slice(0,5);
ok('wav_mode_line',icmt.includes('商用モード / Commercial mode: BY-SAを除く（販売・リール用）'));
ok('wav_no_BYSA',/C（CC BY-SA・継承あり \/ share-alike）0件/.test(icmt)&&!/CC BY-SA \d/.test(icmt.split('\r\n').filter(l=>/^ {3}CC /.test(l)).join('\n')));
// 試聴もBY-SAは鳴らさない
R.preview=await pg.evaluate(async()=>{const r=await __bioDebug.playSpecies('blackbird',true);return {r,msg:document.getElementById('previewStatus').textContent}});
ok('preview_blocked',R.preview.r===false&&R.preview.msg.includes('商用モードの対象外'));
// CC0・PDのみ：夏の蝉（CC BY）だけを選ぶと、代用せず無音で理由を表示
await pg.click('#play');await pg.waitForTimeout(500);if(!(await pg.evaluate(()=>__audioEcosystemDebug.getState().playing)))await pg.click('#play');
await pg.selectOption('#rightsMode','cc0');await pg.evaluate(()=>__bioDebug.setScene('summer'));await pg.waitForTimeout(400);
R.summerTiers=await pg.evaluate(()=>['higurashi','cicada','niiniizemi','tsukutsukuboshi','minminzemi'].map(id=>__rightsDebug.tierOf(JSON.parse(document.getElementById('ae-recordings').textContent).find(r=>r.id===id).license)));
const h1=await pg.evaluate(()=>__bioDebug.history().length);const f2=new Set();
for(let t=0;t<10;t++){await pg.waitForTimeout(1000);(await pg.evaluate(()=>__rightsDebug.active().field)).forEach(x=>f2.add(x))}
R.cc0Hist=await pg.evaluate(n=>__bioDebug.history().slice(n).map(x=>x.id),h1);R.cc0Fields=[...f2];
ok('cc0_only_A',R.cc0Hist.every(x=>tierOf[x]==='A'||!tierOf[x])&&[...f2].every(x=>tierOf[x]==='A'));
R.result2=await pg.textContent('#rightsResult');
if(R.summerTiers.every(t=>t!=='A'))ok('cc0_silent_reason',R.cc0Hist.filter(x=>tierOf[x]).length===0&&R.result2.includes('参加中の生き物はすべて対象外'));
// 英語表示で未翻訳0
await pg.click('#langToggle');await pg.waitForTimeout(300);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!ALLOW.includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.resultEn=await pg.textContent('#rightsResult');R.summaryEn=await pg.textContent('#rightsPanel summary');
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.click('#langToggle');await pg.waitForTimeout(200);
// 選択の記憶
await pg.reload();await pg.waitForTimeout(800);ok('persist',await pg.evaluate(()=>__rightsDebug.mode==='cc0'&&document.getElementById('rightsMode').value==='cc0'));
await pg.selectOption('#rightsMode','all');ok('back_to_all',await pg.evaluate(()=>__rightsDebug.mode==='all'));
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
