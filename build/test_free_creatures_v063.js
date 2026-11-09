// v0.63 の回帰テスト：無料版で鳴らせる生き物の声は分類ごとに6種（v0.67。v0.63 は4種）（data/product_tiers.json の recordings.free）。残りは PRO。
// テスト公開中（plan 'beta'）は全部鳴る。「無料版の見え方を試す」（localStorage saww.planPreview='free'）で無料版の動きを確かめる。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');(async()=>{
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];
const T=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','product_tiers.json'),'utf8'));
const CATS=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','sound_categories.json'),'utf8')).categories;
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const recs=JSON.parse(/<script type="application\/json" id="ae-recordings">([\s\S]*?)<\/script>/.exec(html)[1]);
const FREE=T.recordings.free,ALL_FREE=Object.values(FREE).flat(),GROUPS=['birds','insects','amphibians','mammals','aquatic'];
const PRO_BIRD='tawny-owl',PRO_INSECT='niiniizemi',FREE_BIRD='uguisu-yokohama';

// 1. データ：5分類×6種（v0.67 で4種→6種）、録音と分類が合う、CC0・CC BY（BY-SA を除くでも鳴る）、初期設定の鳥4種を含む
R.counts=GROUPS.map(g=>(FREE[g]||[]).length);
ok('data_counts',R.counts.every(n=>n===6)&&ALL_FREE.length===30&&new Set(ALL_FREE).size===30);
ok('data_match',GROUPS.every(g=>FREE[g].every(id=>recs.some(r=>r.id===id)&&CATS[id]&&CATS[id].cat===g)));
ok('data_license',ALL_FREE.every(id=>{const l=recs.find(r=>r.id===id).license;return !/BY-SA|NC|ND/.test(l)}));
ok('default_birds_free',['uguisu-yokohama','song-thrush','eurasian-wren','nightingale-russia'].every(id=>FREE.birds.includes(id)));
ok('features',T.features.some(f=>f.id==='creatures_free'&&f.tier==='free')&&T.features.some(f=>f.id==='creatures_all'&&f.tier==='pro'));
ok('embedded',JSON.parse(/<script type="application\/json" id="ae-tiers">([\s\S]*?)<\/script>/.exec(html)[1]).recordings.free.birds.join()===FREE.birds.join());

const open=async free=>{const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
 await pg.addInitScript(f=>{try{localStorage.setItem('saww.planPreview',f?'free':'beta')}catch(e){}},free);
 await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(1200);
 await pg.evaluate(()=>{const m=document.querySelector('.tileMore');if(m&&m.getAttribute('aria-expanded')==='false')m.click()});await pg.waitForTimeout(300);return {cx,pg}};
const tiles=pg=>pg.evaluate(()=>[...document.querySelectorAll('#tileGrid .tile[data-id]')].map(t=>({id:t.dataset.id,pro:!!t.querySelector('.tileProChip'),locked:t.classList.contains('locked')})));

// 2. テスト公開中：全部鳴る。PRO の印は付くが鍵はない
let {cx,pg}=await open(false);
R.beta=await tiles(pg);
ok('beta_chips',R.beta.length>=90&&R.beta.filter(t=>t.pro).length===R.beta.length-ALL_FREE.length&&R.beta.filter(t=>!t.pro).every(t=>ALL_FREE.includes(t.id)));
ok('beta_unlocked',R.beta.every(t=>!t.locked)&&await pg.evaluate(id=>__recAllowed(id),PRO_BIRD));
R.betaNote=await pg.textContent('#recTierNote');ok('beta_note',/テスト公開中は全部の生き物が鳴ります/.test(R.betaNote));
ok('amb_no_chip',await pg.evaluate(()=>[...document.querySelectorAll('#ambGrid .tile')].length>0&&![...document.querySelectorAll('#ambGrid .tile')].some(t=>t.querySelector('.tileProChip'))));
await cx.close();

// 3. 無料版：PRO の生き物は鍵・鳴らない・案内。無料の生き物を先に並べる
({cx,pg}=await open(true));
R.free=await tiles(pg);
ok('free_locked',R.free.filter(t=>t.locked).length===R.free.length-ALL_FREE.length&&R.free.filter(t=>!t.locked).every(t=>ALL_FREE.includes(t.id)));
ok('free_first',R.free.slice(0,ALL_FREE.length).every(t=>!t.locked));
R.freeNote=await pg.textContent('#recTierNote');ok('free_note',/無料版：生き物は分類ごとに6種（計30種）/.test(R.freeNote));
await pg.evaluate(id=>document.querySelector('.tile[data-id="'+id+'"] .tilePlay').click(),PRO_BIRD);await pg.waitForTimeout(800);
R.proTap={on:await pg.evaluate(id=>document.querySelector('.tile[data-id="'+id+'"]').classList.contains('on'),PRO_BIRD),status:await pg.textContent('#tileStatus')};
ok('pro_tap_blocked',!R.proTap.on&&/PRO で鳴らせます/.test(R.proTap.status));
await pg.evaluate(id=>document.querySelector('.tile[data-id="'+id+'"] .tilePlay').click(),FREE_BIRD);
await pg.waitForFunction(id=>document.querySelector('.tile[data-id="'+id+'"]').classList.contains('on'),FREE_BIRD,{timeout:15000}).catch(()=>{});
ok('free_tap_plays',await pg.evaluate(id=>document.querySelector('.tile[data-id="'+id+'"]').classList.contains('on'),FREE_BIRD));
await pg.evaluate(id=>document.querySelector('.tile[data-id="'+id+'"] .tilePlay').click(),FREE_BIRD);await pg.waitForTimeout(300);
// 自律演奏：PRO の生き物を参加にしても鳴らない（候補・playSpecies・試聴とも）
R.engine=await pg.evaluate(async([pb,pi])=>{const s=__bioDebug.settings;for(const id of [pb,pi])if(s[id]){s[id].enabled=true;s[id].level=Math.max(s[id].level||0,.9)}
 const ps=await window.__bioDebug.playSpecies?.(pb);return {ps:ps===undefined?'n/a':ps}},[PRO_BIRD,PRO_INSECT]);
await pg.click('#play');await pg.waitForTimeout(9000);
R.heard=await pg.evaluate(()=>[...new Set(__bioDebug.history().map(x=>x.id))]);
ok('auto_no_pro',R.heard.length>0&&R.heard.every(id=>ALL_FREE.includes(id)));
await pg.click('#play');await pg.waitForTimeout(300);
await cx.close();

// 4. 英語表示（無料版）
({cx,pg}=await open(true));
await pg.click('#langToggle');await pg.waitForTimeout(600);
R.en={note:await pg.textContent('#recTierNote'),chip:await pg.evaluate(()=>document.querySelector('.tileProChip')?.textContent)};
await pg.evaluate(id=>document.querySelector('.tile[data-id="'+id+'"] .tilePlay').click(),PRO_BIRD);await pg.waitForTimeout(500);R.en.status=await pg.textContent('#tileStatus');
ok('english',/^Free: 6 creatures per group \(30 in all\)/.test(R.en.note)&&R.en.chip==='PRO'&&/plays with PRO/.test(R.en.status));
R.over=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok('no_overflow',R.over<=0);
await cx.close();

R.version=/<title>saww audio ecosystem v0\.(\d+)/.exec(html)[1];ok('version',+R.version>=63);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
