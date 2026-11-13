// v0.69 SEMI-PRO（月額 US$5）の回帰テスト。公開版（../audio-ecosystem-sounds-1/index.html）を http://localhost:8766/audio-ecosystem-sounds-1/ で配信して実行する。
// localhost だけで効く saww.billingTest で、課金の設定・公開鍵・SEMI-PRO の支払いリンクを差し替える。証明（ES256）はテストの鍵で署名する。
const {chromium}=require('playwright');const {webcrypto:wc}=require('crypto');(async()=>{
const APP='http://localhost:8766/audio-ecosystem-sounds-1/index.html?lang=ja';const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};const errs=[];
const kp=await wc.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const pub=await wc.subtle.exportKey('jwk',kp.publicKey);
const b64u=b=>Buffer.from(b).toString('base64url');
const token=async(plan,days=30)=>{const t=Math.floor(Date.parse('2027-02-01T00:00:00Z')/1000),h=b64u(JSON.stringify({alg:'ES256',typ:'JWT',kid:'test'})),p=b64u(JSON.stringify({sub:'cus_t',plan,st:'active',pe:t+days*86400,iat:t,exp:t+days*86400}));
 const s=await wc.subtle.sign({name:'ECDSA',hash:'SHA-256'},kp.privateKey,Buffer.from(h+'.'+p));return h+'.'+p+'.'+b64u(s)};
const CFG=semi=>({status:'live',apiBase:'https://billing.test',publicKey:{kty:'EC',crv:'P-256',x:pub.x,y:pub.y},paymentLink:'https://buy.stripe.com/test_pro',annualPaymentLink:'https://buy.stripe.com/test_year',portalLink:'https://billing.stripe.com/p/login/test',semiPaymentLink:semi?'https://buy.stripe.com/test_semi':''});
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
async function page(cfg,tok,when){const cx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});const pg=await cx.newPage();
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await pg.route('https://billing.test/**',r=>r.fulfill({status:503,body:''}));
 if(when)await pg.clock.install({time:new Date(when)});
 await pg.goto(APP,{waitUntil:'domcontentloaded'});await pg.evaluate(([c,t])=>{localStorage.clear();localStorage.setItem('saww.billingTest',JSON.stringify(c));if(t)localStorage.setItem('saww.pro',t)},[cfg,tok]);
 await pg.reload({waitUntil:'domcontentloaded'});await pg.waitForTimeout(1800);return [cx,pg]}
const st=pg=>pg.evaluate(()=>({plan:sawwEntitlement.plan,sampler:sawwEntitlement.allows('sampler'),exportF:sawwEntitlement.allows('export'),mixer:sawwEntitlement.allows('mixer'),tracks:sawwEntitlement.allows('tracks'),
 samplerLocked:document.getElementById('samplerSection').classList.contains('proLocked'),mixerLocked:document.getElementById('mixerSection').classList.contains('proLocked'),tracksLocked:document.getElementById('tracksSection').classList.contains('proLocked'),
 wavLocked:document.getElementById('trkWav').classList.contains('semiLocked'),recLocked:document.getElementById('record').classList.contains('semiLocked'),
 cards:[...document.querySelectorAll('.planCard .planName, .planCard h3, .planCard strong')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,6),status:(document.querySelector('#planAccount .planStatus')||{}).textContent||'',radios:[...document.querySelectorAll('input[name=billingPeriod]')].map(r=>r.value)}));
// 1. いまの公開設定（SEMI-PRO のリンクなし）：何も変わらない
{const [cx,pg]=await page(CFG(false),null,'2027-02-01T00:00:00Z');R.none=await st(pg);ok('hidden_without_link',!R.none.radios.includes('semi')&&!R.none.cards.join().includes('SEMI'));await cx.close()}
// 2. リンクあり・無料の人：SEMI-PRO を選んで買える（内容の確認が先）
{const [cx,pg]=await page(CFG(true),null,'2027-02-01T00:00:00Z');R.free=await st(pg);ok('free_sees_semi',R.free.plan==='free'&&R.free.radios.join()==='semi,month,year');
 await pg.check('#period-semi');await pg.waitForTimeout(300);
 R.buy=await pg.evaluate(()=>({price:[...document.querySelectorAll('#subTerms dt')].map((d,i)=>[d.textContent,document.querySelectorAll('#subTerms dd')[i].textContent]).find(x=>x[0]==='価格')?.[1],btn:document.getElementById('billBuy').textContent,href:document.getElementById('billBuy').getAttribute('href')}));
 ok('semi_terms',/月額 5\.00 米ドル/.test(R.buy.price||'')&&/SEMI-PRO/.test(R.buy.btn)&&!R.buy.href);
 await pg.check('#subAgree');R.href=await pg.evaluate(()=>document.getElementById('billBuy').getAttribute('href'));ok('semi_link',/^https:\/\/buy\.stripe\.com\/test_semi\?client_reference_id=/.test(R.href||''));
 R.table=await pg.evaluate(()=>[...document.querySelectorAll('.planTable thead th')].map(x=>x.textContent).join('|'));ok('table_has_semi',R.table==='機能|FREE|SEMI-PRO|PRO');await cx.close()}
// 3. SEMI-PRO の人（2027年）：サンプラーと録音・書き出しだけ使えない
{const [cx,pg]=await page(CFG(true),await token('semi'),'2027-02-01T00:00:00Z');R.semi=await st(pg);
 ok('semi_plan',R.semi.plan==='semi'&&/SEMI-PRO をご契約中/.test(R.semi.status));
 ok('semi_locks',R.semi.samplerLocked&&!R.semi.mixerLocked&&!R.semi.tracksLocked&&R.semi.wavLocked&&R.semi.recLocked&&!R.semi.sampler&&!R.semi.exportF&&R.semi.mixer&&R.semi.tracks);
 R.instr=await pg.evaluate(()=>({proInstr:window.__instrAllowed&&window.__instrAllowed('mbira'),proRec:window.__recAllowed&&window.__recAllowed('wolf-yellowstone')}));
 ok('semi_instruments_and_creatures',R.instr.proInstr!==false&&R.instr.proRec!==false);
 await pg.evaluate(()=>document.getElementById('record').click());await pg.waitForTimeout(500);R.recMsg=await pg.evaluate(()=>({msg:document.getElementById('message').textContent,status:document.getElementById('recordStatus').textContent}));
 ok('semi_record_blocked',/PRO で使えます/.test(R.recMsg.msg)&&!/REC/.test(R.recMsg.status.replace('READY','')));await cx.close()}
// 4. SEMI-PRO の人（年末の無料開放中）：制限なし
{const [cx,pg]=await page(CFG(true),await token('semi',400),'2026-11-20T00:00:00Z');R.open=await st(pg);ok('semi_open_until_2027',!R.open.samplerLocked&&!R.open.wavLocked&&R.open.sampler&&R.open.exportF);await cx.close()}
// 5. PRO の人：すべて使える
{const [cx,pg]=await page(CFG(true),await token('pro'),'2027-02-01T00:00:00Z');R.pro=await st(pg);ok('pro_all',R.pro.plan==='pro'&&!R.pro.samplerLocked&&!R.pro.wavLocked&&R.pro.sampler&&R.pro.exportF&&!/SEMI/.test(R.pro.status));await cx.close()}
R.errs=errs.filter(e=>!/favicon|net::ERR/.test(e));ok('no_page_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
