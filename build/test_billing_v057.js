// v0.57：課金（Stripe の支払いリンク・月額）と、無料版と PRO の区別の回帰テスト。アプリ ↔ 課金の確認サーバー（server/worker.js）を通しで確かめる。
// サーバーはこのテストの中で動かし（Playwright の route で受ける）、Stripe と Resend は偽物。鍵はテストのたびに作る。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');const path=require('path');
(async()=>{const worker=(await import(path.join(__dirname,'..','server','worker.js'))).default;const {subtle}=globalThis.crypto,enc=new TextEncoder();
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
const kp=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const priv={...(await subtle.exportKey('jwk',kp.privateKey)),kid:'t'};const pj=await subtle.exportKey('jwk',kp.publicKey);const pub={kty:'EC',crv:'P-256',x:pj.x,y:pj.y,kid:'t'};
const T=()=>Math.floor(Date.now()/1000);const kv=new Map();const KV={get:async k=>kv.has(k)?kv.get(k):null,put:async(k,v)=>{kv.set(k,v)}};
const APP='http://localhost:8765/index.html';
const env={SAWW_KV:KV,APP_URL:APP,ALLOWED_ORIGINS:'http://localhost:8765',STRIPE_SECRET_KEY:'rk_test',STRIPE_WEBHOOK_SECRET:'whsec_t',ENT_PRIVATE_JWK:JSON.stringify(priv),MAGIC_SECRET:'m-secret-0123456789',RESEND_API_KEY:'re',MAIL_FROM:'saww <a@example.com>',STRIPE_API:'https://stripe.mock',RESEND_API:'https://resend.mock'};
const subs={sub_1:{id:'sub_1',customer:'cus_1',status:'active',items:{data:[{price:{id:'price_pro'},current_period_end:T()+30*86400}]}}};
const sessions={cs_test_paid000000:{id:'cs_test_paid000000',status:'complete',mode:'subscription',subscription:'sub_1',customer_details:{email:'buyer@example.com'}}};
const mails=[];const realFetch=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{const u=new URL(url);if(u.host==='resend.mock'){mails.push(JSON.parse(init.body));return new Response('{}')}
 if(u.host!=='stripe.mock')return realFetch(url,init);let m;
 if((m=u.pathname.match(/^\/v1\/checkout\/sessions\/(.+)$/))){const s=sessions[m[1]];return s?Response.json({...s,subscription:subs[s.subscription]}):new Response('{}',{status:404})}
 if((m=u.pathname.match(/^\/v1\/subscriptions\/(.+)$/)))return Response.json(subs[m[1]]);
 if(u.pathname==='/v1/subscriptions')return Response.json({data:Object.values(subs).filter(s=>s.customer===u.searchParams.get('customer'))});
 return Response.json({id:'cus_1',email:'buyer@example.com'})};
const sigHdr=async body=>{const t=T(),k=await subtle.importKey('raw',enc.encode('whsec_t'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const s=new Uint8Array(await subtle.sign('HMAC',k,enc.encode(t+'.'+body)));return 't='+t+',v1='+[...s].map(x=>x.toString(16).padStart(2,'0')).join('')};
const hook=async ev=>{const body=JSON.stringify(ev);return worker.fetch(new Request('https://billing.test/stripe/webhook',{method:'POST',headers:{'Stripe-Signature':await sigHdr(body)},body}),env)};
const CFG={status:'live',apiBase:'https://billing.test',publicKey:pub,paymentLink:'https://buy.stripe.com/test_x',portalLink:'https://billing.stripe.com/p/login/test_x',legal:{ready:true,missing:[],monthly:980}}; // v0.59：特商法の表記が埋まっていないと課金は始まらない
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const errs=[];const newPage=async(cx)=>{const pg=await cx.newPage();await require('./photo_fixture')(pg);pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
 await pg.route('https://billing.test/**',async route=>{const rq=route.request();const res=await worker.fetch(new Request(rq.url(),{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()}),env);
  const h={};res.headers.forEach((v,k)=>{h[k]=v});if(rq.method()==='POST')h['access-control-allow-origin']='http://localhost:8765';await route.fulfill({status:res.status,headers:h,body:Buffer.from(await res.arrayBuffer())})});
 await pg.route('https://buy.stripe.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>stripe</title>'}));return pg};
const wait=(pg,ms)=>pg.waitForTimeout(ms);const setup=async(pg,cfg)=>{await pg.goto(APP);await pg.evaluate(c=>{localStorage.clear();if(c)localStorage.setItem('saww.billingTest',JSON.stringify(c))},cfg);await pg.reload();await wait(pg,1200)};
const st=pg=>pg.evaluate(()=>({...__billingDebug.state(),live:__billingDebug.live,mbira:document.getElementById('param-mbira').disabled,didge:document.getElementById('param-didge').disabled,
 locked:[...document.querySelectorAll('[data-tier="pro"]')].map(n=>n.classList.contains('proLocked')),buy:document.getElementById('billBuy')?.getAttribute('href')||null,preview:!!document.getElementById('planPreview'),
 status:document.querySelector('#planAccount .planStatus')?.textContent||'',msg:document.querySelector('#planAccount .billMsg')?.textContent||'',hash:location.hash,lead:document.querySelector('#plansSection .lead').textContent}));
// A. 課金の準備前（既定の設定）：テスト公開のまま全部使える
{const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await newPage(cx);await setup(pg,null);R.beta=await st(pg);
 R.beta.note=await pg.textContent('#planAccount');ok('beta_default',!R.beta.live&&R.beta.plan==='beta'&&!R.beta.mbira&&R.beta.locked.every(x=>!x)&&R.beta.preview&&!R.beta.buy&&/課金はまだ始めていません/.test(R.beta.note));await cx.close()}
// B. 課金あり・未購入：無料版。PRO の楽器と PRO の欄は使えない。購入ボタン
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await newPage(cx);await setup(pg,CFG);R.free=await st(pg);
ok('free_limits',R.free.live&&R.free.plan==='free'&&R.free.enforce&&R.free.mbira&&!R.free.didge&&R.free.locked.length===3&&R.free.locked.every(Boolean)&&!R.free.preview&&/^https:\/\/buy\.stripe\.com\/test_x\?client_reference_id=[a-z0-9]{12,}$/.test(R.free.buy)&&/PRO にすると/.test(R.free.lead));
R.lockOpen=await pg.evaluate(async()=>{const d=document.querySelector('details[data-tier="pro"]');d.open=true;await new Promise(r=>setTimeout(r,50));return {open:d.open,note:!d.querySelector(':scope > .proLockNote').hidden}});ok('free_section_locked',!R.lockOpen.open&&R.lockOpen.note);
R.allows=await pg.evaluate(()=>({mixer:sawwEntitlement.allows('mixer'),autoplay:sawwEntitlement.allows('autoplay')}));ok('free_allows',R.allows.mixer===false&&R.allows.autoplay===true);
// C. 支払い → 支払いリンクの「支払い後の移動先」（/activate）→ アプリへ戻って PRO
await hook({id:'evt_1',type:'checkout.session.completed',data:{object:sessions.cs_test_paid000000}});
await pg.goto('https://billing.test/activate?session_id=cs_test_paid000000');await pg.waitForURL(u=>u.toString().startsWith(APP),{timeout:15000});await wait(pg,1500);R.pro=await st(pg);
ok('pro_after_pay',R.pro.plan==='pro'&&!R.pro.mbira&&R.pro.locked.every(x=>!x)&&R.pro.hash===''&&/PRO になりました/.test(R.pro.msg)&&/PRO をご利用中です（次の更新日：\d{4}-\d\d-\d\d）/.test(R.pro.status)&&R.pro.exp>T());
R.portal=await pg.getAttribute('#billPortal','href');ok('portal_link',R.portal===CFG.portalLink);
// 読み直しても PRO。サーバーに届かなくても（電波なし）期限までは PRO
await pg.reload();await wait(pg,1200);ok('pro_persist',(await st(pg)).plan==='pro');
await pg.route('https://billing.test/**',r=>r.abort());await pg.reload();await wait(pg,1200);ok('pro_offline',(await st(pg)).plan==='pro');await pg.unroute('https://billing.test/**');
await pg.route('https://billing.test/**',async route=>{const rq=route.request();const res=await worker.fetch(new Request(rq.url(),{method:rq.method(),headers:rq.headers(),body:['GET','HEAD'].includes(rq.method())?undefined:rq.postData()}),env);const h={};res.headers.forEach((v,k)=>{h[k]=v});h['access-control-allow-origin']='http://localhost:8765';await route.fulfill({status:res.status,headers:h,body:Buffer.from(await res.arrayBuffer())})});
// D. 改ざんした証明は受け付けない
const tok=await pg.evaluate(()=>localStorage.getItem('saww.pro'));
const forged=tok.split('.').slice(0,2).join('.')+'.'+Buffer.from(new Uint8Array(64)).toString('base64url');
await pg.evaluate(()=>localStorage.removeItem('saww.pro'));await pg.goto(APP+'#saww-pro='+forged);await pg.reload();await wait(pg,1200);R.forged=await st(pg);
ok('forged_rejected',R.forged.plan==='free'&&!(await pg.evaluate(()=>localStorage.getItem('saww.pro'))));
const fakePayload=Buffer.from(JSON.stringify({sub:'x',plan:'pro',exp:T()+999999})).toString('base64url');
ok('forged_payload',(await pg.evaluate(t=>__billingDebug.verify(t),tok.split('.')[0]+'.'+fakePayload+'.'+tok.split('.')[2]))===null);
// E. ほかの端末：購入したメールでログイン → メールのリンク → PRO
const cx2=await b.newContext({viewport:{width:390,height:844}});const pg2=await newPage(cx2);await setup(pg2,CFG);
await pg2.evaluate(()=>document.getElementById('planAccount').scrollIntoView());await pg2.fill('#billEmail','buyer@example.com');await pg2.click('#billLogin button[type=submit]');await wait(pg2,800);
R.login={status:await pg2.textContent('#billLoginStatus'),mails:mails.length};
const link=(mails[0]&&mails[0].text.match(/https:\/\/billing\.test\/magic\?t=\S+/)||[])[0];
await pg2.goto(link);await pg2.waitForURL(u=>u.toString().startsWith(APP),{timeout:15000});await wait(pg2,1500);R.login.after=await st(pg2);
ok('login_other_device',/ログイン用のリンクをメールで送りました/.test(R.login.status)&&R.login.mails===1&&R.login.after.plan==='pro');
// 知らないアドレスでも同じ返事（メールは送らない）
await pg2.evaluate(()=>{localStorage.removeItem('saww.pro')});await pg2.reload();await wait(pg2,1000);await pg2.fill('#billEmail','nobody@example.com');await pg2.click('#billLogin button[type=submit]');await wait(pg2,800);
ok('login_unknown',mails.length===1&&/ログイン用のリンクをメールで送りました/.test(await pg2.textContent('#billLoginStatus')));
// 使用済みのリンク
await pg2.goto(link);await pg2.waitForURL(u=>u.toString().startsWith(APP),{timeout:15000});await wait(pg2,1200);ok('link_used',/使用済み/.test((await st(pg2)).msg));
await cx2.close();
// F. 解約 → 証明の更新で FREE に戻る
await pg.goto('https://billing.test/activate?session_id=cs_test_paid000000');await pg.waitForURL(u=>u.toString().startsWith(APP));await wait(pg,1200);
subs.sub_1={...subs.sub_1,status:'canceled'};await hook({id:'evt_2',type:'customer.subscription.deleted',data:{object:subs.sub_1}});
await pg.evaluate(()=>__billingDebug.refresh());await wait(pg,800);R.cancel=await st(pg);
ok('canceled_to_free',R.cancel.plan==='free'&&R.cancel.mbira&&/PRO の期間が終わりました/.test(R.cancel.msg)&&!(await pg.evaluate(()=>localStorage.getItem('saww.pro'))));
// G. ログアウト
subs.sub_1={...subs.sub_1,status:'active'};await hook({id:'evt_3',type:'customer.subscription.updated',data:{object:subs.sub_1}});
await pg.goto('https://billing.test/activate?session_id=cs_test_paid000000');await pg.waitForURL(u=>u.toString().startsWith(APP));await wait(pg,1200);
await pg.evaluate(()=>document.getElementById('planAccount').scrollIntoView());await pg.click('#billLogout');await wait(pg,300);ok('logout',(await st(pg)).plan==='free');
// H. 英語表示・はみ出し・エラー
await pg.click('#langToggle');await wait(pg,500);const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;
R.en=await pg.evaluate(()=>({buy:document.getElementById('billBuy').textContent,ph:document.getElementById('billEmail').placeholder}));ok('english',un.length===0&&R.en.buy==='Get PRO (monthly)'&&R.en.ph==='Email used for purchase');
await pg.click('#langToggle');await wait(pg,300);ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>localStorage.clear());
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
