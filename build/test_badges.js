// v0.29 区分バッジ（A/B/C）の回帰テスト。python3 -m http.server 8765 で配信して実行する。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900}});const pg=await ctx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
const tierOf=await pg.evaluate(()=>Object.fromEntries(JSON.parse(document.getElementById('ae-recordings').textContent).map(r=>[r.id,__rightsDebug.tierOf(r.license)])));
const beds=await pg.evaluate(()=>JSON.parse(document.getElementById('ae-recordings').textContent).filter(r=>r.fieldBed).map(r=>r.id));
await pg.click('#auditPanel summary');await pg.waitForTimeout(300);
const check=async mode=>{const bs=await pg.evaluate(()=>__rightsDebug.badges());const bad=bs.filter(x=>x.where!=='audit'||tierOf[x.id]).filter(x=>{const t=tierOf[x.id];if(!t)return x.where!=='audit';const allowed=mode==='all'||(mode==='nosa'?t!=='C':t==='A');return x.tier!==t||x.blocked===allowed});return {n:bs.length,bad,fields:bs.filter(x=>x.where==='field').length,audit:bs.filter(x=>x.where==='audit').length,res:bs.filter(x=>x.where==='resident').length}};
let c=await check('all');R.all={n:c.n,fields:c.fields,audit:c.audit,res:c.res,bad:c.bad.length};
ok('field_badges_all_beds',c.fields===beds.length);ok('audit_badges',c.audit>=41);ok('resident_badges',c.res>=1);ok('all_none_blocked',c.bad.length===0);
R.auditTiers=await pg.evaluate(()=>[...document.querySelectorAll('#auditTable tbody tr')].map(tr=>tr.cells[1].textContent));ok('audit_tier_col',R.auditTiers.every(t=>/^[ABCX]$/.test(t)));
ok('audit_header',await pg.evaluate(()=>document.querySelector('#auditTable thead th:nth-child(2)').textContent==='区分'));
await pg.selectOption('#rightsMode','nosa');await pg.waitForTimeout(300);c=await check('nosa');R.nosa={bad:c.bad.length,blocked:(await pg.evaluate(()=>__rightsDebug.badges().filter(x=>x.blocked).length))};ok('nosa_marks',c.bad.length===0&&R.nosa.blocked>0);
R.offVisible=await pg.evaluate(()=>[...document.querySelectorAll('[data-rights-blocked="1"] .rightsOff')].every(e=>!e.hidden&&e.offsetParent!==null||e.closest('details:not([open])')||e.closest('[hidden]')));ok('off_label_shown',R.offVisible);
R.opacity=await pg.evaluate(()=>getComputedStyle(document.querySelector('#fieldControls [data-rights-blocked="1"]')).opacity);ok('dimmed',R.opacity==='0.55');
await pg.selectOption('#rightsMode','cc0');await pg.waitForTimeout(300);c=await check('cc0');ok('cc0_marks',c.bad.length===0);
// 生き物の一覧のタブを切り替えても付く
await pg.evaluate(()=>{for(const b of document.querySelectorAll('#bioTabs button'))b.click()});await pg.waitForTimeout(300);c=await check('cc0');ok('after_tab_switch',c.bad.length===0&&c.res>=1);
await pg.selectOption('#rightsMode','all');await pg.waitForTimeout(300);c=await check('all');ok('back_to_all',c.bad.length===0);
// 英語表示
await pg.click('#langToggle').catch(()=>pg.evaluate(()=>document.querySelector('[data-lang-toggle],#aeLang')?.click()));await pg.waitForTimeout(600);
await pg.selectOption('#rightsMode','nosa');await pg.waitForTimeout(500);
R.en=await pg.evaluate(()=>[...document.querySelectorAll('.rightsLine')].map(e=>e.innerText).filter(t=>/[぀-ヿ一-鿿]/.test(t)).slice(0,5));ok('en_translated',R.en.length===0);
R.enTitle=await pg.evaluate(()=>[...document.querySelectorAll('.rightsBadge')].filter(e=>!e.closest('#auditTable')).map(e=>e.title).filter(t=>/[぀-ヿ一-鿿]/.test(t)).length);ok('en_title',R.enTitle===0);
R.enHead=await pg.evaluate(()=>document.querySelector('#auditTable thead th:nth-child(2)').textContent);ok('en_head',R.enHead==='Tier');
R.overflow=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok('no_overflow',R.overflow<=0);
await pg.selectOption('#rightsMode','all');
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
