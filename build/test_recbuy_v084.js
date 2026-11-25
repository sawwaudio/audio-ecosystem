// v0.84 録音の買い取り（アプリ側）の通しテスト。python3 -m http.server 8765 で本体を配信して実行する。
// 課金サーバーは偽物（route）。localhost だけで効く saww.billingTest で課金の設定・公開鍵・管理者の鍵を差し替える。
const {chromium}=require('playwright');const {webcrypto:wc}=require('crypto');(async()=>{
const APP='http://localhost:8765/index.html?lang=ja';const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};const errs=[];
const b64u=b=>Buffer.from(b).toString('base64url');
const kp=await wc.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const pub=await wc.subtle.exportKey('jwk',kp.publicKey);
const sk=await wc.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const sp=await wc.subtle.exportKey('jwk',sk.publicKey);
const sign=async(p,key=kp.privateKey)=>{const h=b64u(JSON.stringify({alg:'ES256',typ:'JWT',kid:'test'})),b=b64u(JSON.stringify(p));return h+'.'+b+'.'+b64u(await wc.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,Buffer.from(h+'.'+b)))};
const WHEN='2027-02-01T00:00:00Z',t0=Math.floor(Date.parse(WHEN)/1000);
const token=plan=>sign({sub:'cus_t',plan,cap:plan==='pro'?['export','sampler']:[],st:'active',pe:t0+30*86400,iat:t0,exp:t0+30*86400});
const CFG={status:'live',apiBase:'https://billing.test',publicKey:{kty:'EC',crv:'P-256',x:pub.x,y:pub.y},paymentLink:'https://buy.stripe.com/test_pro',portalLink:'https://billing.stripe.com/p/login/test',semiPaymentLink:'https://buy.stripe.com/test_semi',studioPublicKey:{kty:'EC',crv:'P-256',x:sp.x,y:sp.y}};
const b=await chromium.launch();
async function page(tok,old=false){const cx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});const pg=await cx.newPage();pg.on('pageerror',e=>errs.push(e.message));
 const calls=[];const store={items:[]};
 await pg.route('https://billing.test/**',async r=>{const q=r.request(),u=new URL(q.url());const h=q.headers();
  if(old&&u.pathname.startsWith('/recordings'))return r.abort();calls.push({m:q.method(),p:u.pathname+u.search,auth:h['authorization']||'',admin:h['x-saww-admin']||'',meta:h['x-saww-meta']||'',type:h['content-type']||'',len:(q.postDataBuffer()||Buffer.alloc(0)).length});
  if(u.pathname==='/recordings'&&q.method()==='POST'){store.items.unshift({id:'11111111-1111-4111-8111-111111111111',title:JSON.parse(Buffer.from(h['x-saww-meta'],'base64url')).title,status:'pending',at:t0});return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,id:'11111111-1111-4111-8111-111111111111',submitted:1,approved:0,limit:5})})}
  if(u.pathname==='/recordings/mine')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,month:'2027-02',submitted:store.items.length,approved:0,limit:5,items:store.items})});
  if(u.pathname==='/admin/recordings'){if(!h['x-saww-admin'])return r.fulfill({status:401,contentType:'application/json',body:'{"ok":false}'});return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,autoCredit:false,limit:5,items:[{id:'22222222-2222-4222-8222-222222222222',cus:'cus_x',plan:'pro',title:'夜のカエル',place:'高知',recordedOn:'2027-01-20',size:204800,at:t0,status:'pending',monthApproved:1,stripeUrl:'https://dashboard.stripe.com/customers/cus_x'}]})})}
  if(/\/admin\/recordings\/2{8}-.*\/audio$/.test(u.pathname))return r.fulfill({status:200,contentType:'audio/wav',body:Buffer.alloc(64)});
  if(/\/admin\/recordings\/2{8}-/.test(u.pathname)&&q.method()==='POST')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,status:'approved',credit:'manual',stripeUrl:'https://dashboard.stripe.com/customers/cus_x',monthApproved:2})});
  return r.fulfill({status:503,body:''})});
 await pg.clock.install({time:new Date(WHEN)});
 await pg.goto(APP,{waitUntil:'domcontentloaded'});await pg.evaluate(([c,t])=>{localStorage.clear();localStorage.setItem('saww.billingTest',JSON.stringify(c));if(t)localStorage.setItem('saww.pro',t)},[CFG,tok]);
 await pg.reload({waitUntil:'domcontentloaded'});await pg.waitForTimeout(1500);
 await pg.evaluate(()=>{const s=document.getElementById('plansSection');for(let n=s;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true});return {cx,pg,calls}}
// 1. FREE には出さない
{const {cx,pg}=await page(null);R.free=await pg.evaluate(()=>!!document.getElementById('recProgram'));ok('hidden_for_free',!R.free);await cx.close()}
// 2. PRO：送る（確認3つが必須・ヘッダーと中身）・自分の一覧
{const {cx,pg,calls}=await page(await token('pro'));
 R.shown=await pg.evaluate(()=>!!document.getElementById('recProgram')&&!document.getElementById('recProgram').hidden&&!!document.querySelector('a[href="recording-program.html"]'));ok('shown_for_pro',R.shown);
 await pg.evaluate(()=>{document.getElementById('recProgram').open=true});await pg.waitForTimeout(400);
 await pg.setInputFiles('#recFile',{name:'mori.wav',mimeType:'audio/wav',buffer:Buffer.alloc(4096,1)});
 await pg.fill('#recTitle','朝の森の鳥');await pg.fill('#recPlace','長野県');
 await pg.click('#recSend');await pg.waitForTimeout(300);R.needChecks=await pg.textContent('#recMsg');ok('checks_required',/3つの確認/.test(R.needChecks)&&!calls.some(c=>c.p==='/recordings'));
 for(const id of ['recOwn','recNoPeople','recLicense'])await pg.check('#'+id);
 await pg.click('#recSend');await pg.waitForTimeout(800);
 const sent=calls.find(c=>c.p==='/recordings'&&c.m==='POST');const meta=sent&&JSON.parse(Buffer.from(sent.meta,'base64url'));
 R.sent={msg:await pg.textContent('#recMsg'),auth:!!sent&&sent.auth.startsWith('Bearer '),type:sent&&sent.type,len:sent&&sent.len,meta};
 ok('sent',/送りました/.test(R.sent.msg)&&R.sent.auth&&R.sent.type==='audio/wav'&&R.sent.len===4096&&meta.title==='朝の森の鳥'&&meta.place==='長野県'&&meta.terms==='2026-11-25'&&meta.own&&meta.noPeople&&meta.license&&meta.fileName==='mori.wav');
 await pg.waitForTimeout(500);R.mine=await pg.evaluate(()=>document.getElementById('recMine').textContent);ok('mine_list',/今月の採用：0 \/ 5/.test(R.mine)&&/朝の森の鳥/.test(R.mine)&&/審査待ち/.test(R.mine));
 await pg.setInputFiles('#recFile',{name:'big.wav',mimeType:'audio/wav',buffer:Buffer.alloc(20*1024*1024+10)});await pg.fill('#recTitle','大きい');for(const id of ['recOwn','recNoPeople','recLicense'])await pg.check('#'+id);
 const before=calls.length;await pg.click('#recSend');await pg.waitForTimeout(300);ok('size_checked_locally',/20MB/.test(await pg.textContent('#recMsg'))&&calls.length===before);
 await cx.close()}
// 3. SEMI-PRO にも出す
{const {cx,pg}=await page(await token('semi'));ok('shown_for_semi',await pg.evaluate(()=>!!document.getElementById('recProgram')&&!document.getElementById('recProgram').hidden));await cx.close()}
// 3b. 課金サーバーが古い（録音の受け付けがない）間は出さない
{const {cx,pg}=await page(await token('pro'),true);ok('hidden_until_server_ready',await pg.evaluate(()=>!!document.getElementById('recProgram')&&document.getElementById('recProgram').hidden));await cx.close()}
// 4. 管理者：審査の一覧・聴く・採用（手動の相殺の案内）
{const t=Math.floor(Date.parse(WHEN)/1000),body=b64u(JSON.stringify({role:'studio-admin',aud:'http://localhost:8765/',iat:t,exp:t+600})),pass=body+'.'+b64u(await wc.subtle.sign({name:'ECDSA',hash:'SHA-256'},sk.privateKey,Buffer.from(body)));
 const {cx,pg,calls}=await page(null);await pg.evaluate(p=>{location.hash='saww-admin='+p;location.reload()},pass);await pg.waitForTimeout(2000);
 await pg.evaluate(()=>{const s=document.getElementById('plansSection');for(let n=s;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true});
 ok('admin_panel_has_review',await pg.evaluate(()=>!!document.getElementById('adminRec')));
 await pg.click('#adminRecReload');await pg.waitForTimeout(800);
 const q=calls.find(c=>c.p.startsWith('/admin/recordings?'));R.adminHdr=q&&q.admin.slice(0,5);
 R.card=await pg.evaluate(()=>document.querySelector('.adminRecCard')?.textContent||'');ok('admin_queue',R.adminHdr==='pass.'&&/夜のカエル/.test(R.card)&&/今月の採用 1\/5/.test(R.card)&&/相殺は手動/.test(await pg.textContent('#adminRecNote')));
 await pg.evaluate(()=>[...document.querySelectorAll('.adminRecCard button')].find(b=>/聴く/.test(b.textContent)).click());await pg.waitForTimeout(600);
 ok('admin_listen',calls.some(c=>/\/audio$/.test(c.p)&&c.admin.startsWith('pass.'))&&await pg.evaluate(()=>!document.querySelector('.adminRecCard audio').hidden));
 await pg.evaluate(()=>[...document.querySelectorAll('.adminRecCard button')].find(b=>/採用/.test(b.textContent)&&!/不採用/.test(b.textContent)).click());await pg.waitForTimeout(600);
 R.after=await pg.evaluate(()=>document.querySelector('.adminRecCard').textContent);
 ok('admin_approve',calls.some(c=>c.m==='POST'&&/\/admin\/recordings\/2{8}/.test(c.p))&&/残高に -US\$1/.test(R.after)&&/Stripe の顧客を開く/.test(R.after));await cx.close()}
// 5. 条件のページ
{const cx=await b.newContext();const pg=await cx.newPage();const r=await pg.goto('http://localhost:8765/recording-program.html');R.terms=await pg.evaluate(()=>({t:document.title,noai:!!document.querySelector('meta[name=robots][content*=noai]'),five:/US\$5/.test(document.body.textContent),lic:/取り消すことはできません/.test(document.body.textContent)}));ok('terms_page',r.status()===200&&R.terms.noai&&R.terms.five&&R.terms.lic);await cx.close()}
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon/.test(e));ok('no_page_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
