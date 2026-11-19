// v0.74 書き出しは PRO 専用の回帰テスト。python3 -m http.server 8765 で本体を配信して実行する。
// オーナー指示（2026-11-19）：FREE・SEMI-PRO（年末の無料開放中も）では、音声（WAV・AIFF）・動画（リール）・プリセットのどの形式も書き出せない。
// ブラウザ内のプレビューと再生は使える。PRO・管理者は書き出せる。書き出しの直前に課金の確認サーバー（/export/authorize）で契約を確かめる。
// localhost だけで効く saww.billingTest で課金の設定と公開鍵を差し替え、証明・許可（ES256）はテストの鍵で署名する。課金サーバーは偽物（route）。
const {chromium}=require('playwright');const {webcrypto:wc}=require('crypto');(async()=>{
const APP='http://localhost:8765/index.html?lang=ja';const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};const errs=[];
const kp=await wc.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const pub=await wc.subtle.exportKey('jwk',kp.publicKey);
const kp2=await wc.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const b64u=b=>Buffer.from(b).toString('base64url');
const sign=async(payload,key=kp.privateKey)=>{const h=b64u(JSON.stringify({alg:'ES256',typ:'JWT',kid:'test'})),p=b64u(JSON.stringify(payload));const s=await wc.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,Buffer.from(h+'.'+p));return h+'.'+p+'.'+b64u(s)};
const AFTER='2027-02-01T00:00:00Z',OPEN='2026-11-20T00:00:00Z';
const token=(plan,when=AFTER,days=30,extra={})=>{const t=Math.floor(Date.parse(when)/1000);return sign({sub:'cus_t',plan,...(plan==='pro'?{cap:['export','sampler']}:plan==='semi'?{cap:[]}:{}),st:'active',pe:t+days*86400,iat:t,exp:t+days*86400,...extra})};
const ticket=async(when,key)=>{const t=Math.floor(Date.parse(when)/1000);return sign({typ:'export',sub:'cus_t',plan:'pro',kind:'preset',iat:t,exp:t+300},key)};
const CFG={status:'live',apiBase:'https://billing.test',publicKey:{kty:'EC',crv:'P-256',x:pub.x,y:pub.y},paymentLink:'https://buy.stripe.com/test_pro',annualPaymentLink:'https://buy.stripe.com/test_year',portalLink:'https://billing.stripe.com/p/login/test',semiPaymentLink:'https://buy.stripe.com/test_semi',semiAnnualPaymentLink:'https://buy.stripe.com/test_semi_year'};
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
// server: 'ok'（許可）・'free'（解約済み）・'semi'・'down'（届かない）・'forged'（別の鍵の許可）
async function page({cfg=CFG,tok=null,when=AFTER,server='down'}={}){const cx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP',acceptDownloads:true});const pg=await cx.newPage();
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));const calls=[];
 await pg.route('https://billing.test/**',async r=>{const u=new URL(r.request().url());calls.push(u.pathname);
  if(u.pathname==='/export/authorize'){if(server==='ok')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,plan:'pro',ticket:await ticket(when)})});
   if(server==='forged')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,plan:'pro',ticket:await ticket(when,kp2.privateKey)})});
   if(server==='free')return r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,plan:'free',status:'canceled'})});
   if(server==='semi')return r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,plan:'semi',token:await token('semi',when)})})}
  return r.fulfill({status:503,body:''})});
 await pg.clock.install({time:new Date(when)});
 await pg.goto(APP,{waitUntil:'domcontentloaded'});await pg.evaluate(([c,t])=>{localStorage.clear();localStorage.setItem('saww.billingTest',JSON.stringify(c));if(t)localStorage.setItem('saww.pro',t)},[cfg,tok]);
 await pg.reload({waitUntil:'domcontentloaded'});await pg.waitForTimeout(1500);const dls=[];pg.on('download',d=>dls.push(d.suggestedFilename()));return {cx,pg,calls,dls}}
const state=pg=>pg.evaluate(()=>({plan:sawwEntitlement.plan,allows:sawwEntitlement.allows('export'),now:sawwExport.allowed(),
 locked:['record','trkWav','trkAiff','exportPreset','reelSave','reelShare'].map(id=>document.getElementById(id).classList.contains('exportLocked')),
 nodl:(document.getElementById('reelVideo').getAttribute('controlsList')||'').includes('nodownload'),msg:document.getElementById('message').textContent}));
// 書き出しの入口を全部試す：プリセットのボタン・トラックの WAV／AIFF（直接呼ぶ）・WAV 録音（直接呼ぶ）・API の直接呼び出し
async function tryAll(pg){
 await pg.evaluate(()=>document.getElementById('exportPreset').click());await pg.waitForTimeout(400);
 const btnMsg=await pg.evaluate(()=>document.getElementById('message').textContent);
 // ボタンを経由せず関数を直接呼ぶ（ボタンを隠すだけの制限は迂回できる。関数の中の判定で止まるか）
 const direct=await pg.evaluate(async()=>{const out={};
  out.authorize=(await sawwExport.authorize('audio')).ok;
  // ボタンの制限（data-export-btn・data-semi-btn）を外して押す＝画面の制限を迂回した状態。押した先の処理の中で止まるか
  for(const id of ['trkWav','record']){const x=document.getElementById(id);x.removeAttribute('data-export-btn');x.removeAttribute('data-semi-btn');x.classList.remove('exportLocked','semiLocked')}
  document.getElementById('message').textContent='';document.getElementById('trkWav').click();await new Promise(r=>setTimeout(r,300));out.trk=document.getElementById('trkStatus')?.textContent||'';
  document.getElementById('record').click();await new Promise(r=>setTimeout(r,500));out.recMsg=document.getElementById('message').textContent;out.recording=typeof recording!=='undefined'?recording:null;
  return out});
 await pg.waitForTimeout(600);return {btnMsg,...direct}}
async function reel(pg){await pg.evaluate(()=>__reelDebug.start(2,{endCredits:false})).catch(e=>errs.push('reel '+e.message));
 for(let i=0;i<40;i++){await pg.waitForTimeout(250);const r=await pg.evaluate(()=>{const s=__reelDebug.state();return s&&s.result?{saved:s.result.saved,err:s.result.error||null,status:document.getElementById('reelStatus').textContent,preview:!!document.getElementById('reelVideo').src,done:!document.getElementById('reelDone').hidden}:null});if(r)return r}return null}
const PRO_MSG=/PRO で使えます/;
// 1. FREE（2027年）：どの形式も書き出せない・プレビューは使える
{const {cx,pg,dls}=await page();R.free=await state(pg);ok('free_plan',R.free.plan==='free'&&!R.free.allows&&!R.free.now&&R.free.locked.every(Boolean)&&R.free.nodl);
 R.freeTry=await tryAll(pg);ok('free_no_export',PRO_MSG.test(R.freeTry.btnMsg)&&!R.freeTry.authorize&&PRO_MSG.test(R.freeTry.trk)&&PRO_MSG.test(R.freeTry.recMsg)&&!R.freeTry.recording);
 R.freeReel=await reel(pg);ok('free_reel_preview_only',R.freeReel&&R.freeReel.saved===false&&R.freeReel.preview&&R.freeReel.done&&/PREVIEW/.test(R.freeReel.status));
 await pg.evaluate(()=>document.getElementById('reelSave').click());await pg.evaluate(()=>document.getElementById('reelShare').click());await pg.waitForTimeout(500);
 R.freeDl=dls.slice();ok('free_no_download',dls.length===0);await cx.close()}
// 2. FREE（年末の無料開放中）：書き出しだけは使えない・案内文が出る
{const {cx,pg,dls}=await page({when:OPEN});R.open=await state(pg);R.openTry=await tryAll(pg);
 R.openNote=await pg.evaluate(()=>document.getElementById('planAccount').textContent);
 ok('open_no_export',R.open.plan==='open'&&!R.open.allows&&!R.openTry.authorize&&PRO_MSG.test(R.openTry.btnMsg)&&dls.length===0&&/書き出し・ダウンロード（音声・動画・リール）は PRO のみ/.test(R.openNote));await cx.close()}
// 3. SEMI-PRO（月額・2027年）：書き出せない・ミキサーは使える・サンプラーは使えない
{const {cx,pg,dls,calls}=await page({tok:await token('semi')});R.semi=await state(pg);R.semiTry=await tryAll(pg);
 R.semiF=await pg.evaluate(()=>({mixer:sawwEntitlement.allows('mixer'),sampler:sawwEntitlement.allows('sampler'),proRec:window.__recAllowed('wolf-yellowstone')}));
 ok('semi_no_export',R.semi.plan==='semi'&&!R.semi.allows&&R.semi.locked.every(Boolean)&&!R.semiTry.authorize&&/SEMI-PRO には含まれません/.test(R.semiTry.btnMsg+R.semiTry.trk)&&!R.semiTry.recording);
 ok('semi_features',R.semiF.mixer&&!R.semiF.sampler&&R.semiF.proRec!==false);
 R.semiReel=await reel(pg);ok('semi_reel_preview_only',R.semiReel&&R.semiReel.saved===false&&R.semiReel.preview);
 await pg.evaluate(()=>document.getElementById('reelSave').click());await pg.waitForTimeout(400);ok('semi_no_download',dls.length===0&&!calls.includes('/export/authorize'));await cx.close()}
// 4. SEMI-PRO（無料開放中）：サンプラーは開放、書き出しは不可
{const {cx,pg,dls}=await page({tok:await token('semi',OPEN,400),when:OPEN});R.semiOpen=await state(pg);R.semiOpenTry=await tryAll(pg);
 ok('semi_open_no_export',!R.semiOpen.allows&&!R.semiOpenTry.authorize&&dls.length===0);await cx.close()}
// 5. SEMI-PRO の年額を選べる（US$50・内容の確認が先）
{const {cx,pg}=await page();await pg.evaluate(()=>{const d=document.getElementById('plansSection');for(let n=d;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true});
 R.radios=await pg.evaluate(()=>[...document.querySelectorAll('input[name=billingPeriod]')].map(r=>r.value));
 await pg.check('#period-semiYear');await pg.waitForTimeout(300);
 R.semiYear=await pg.evaluate(()=>({price:[...document.querySelectorAll('#subTerms dt')].map((d,i)=>[d.textContent,document.querySelectorAll('#subTerms dd')[i].textContent]).find(x=>x[0]==='価格')?.[1],what:[...document.querySelectorAll('#subTerms dt')].map((d,i)=>[d.textContent,document.querySelectorAll('#subTerms dd')[i].textContent]).find(x=>x[0]==='内容')?.[1],btn:document.getElementById('billBuy').textContent,href:document.getElementById('billBuy').getAttribute('href')}));
 await pg.check('#subAgree');const href=await pg.evaluate(()=>document.getElementById('billBuy').getAttribute('href'));
 ok('semi_annual_choice',R.radios.join()==='semi,semiYear,month,year'&&/年額 50\.00 米ドル/.test(R.semiYear.price||'')&&/書き出し/.test(R.semiYear.what||'')&&/US\$50/.test(R.semiYear.btn)&&!R.semiYear.href&&/^https:\/\/buy\.stripe\.com\/test_semi_year\?client_reference_id=/.test(href||''));await cx.close()}
// 6. PRO（サーバーが許可）：プリセット・リールを書き出せる
{const {cx,pg,dls,calls}=await page({tok:await token('pro'),server:'ok'});R.pro=await state(pg);
 ok('pro_plan',R.pro.plan==='pro'&&R.pro.allows&&R.pro.now&&R.pro.locked.every(x=>!x)&&!R.pro.nodl);
 await pg.evaluate(()=>document.getElementById('exportPreset').click());await pg.waitForTimeout(800);
 R.proReel=await reel(pg);await pg.waitForTimeout(500);R.proDl=dls.slice();
 ok('pro_exports',dls.some(n=>/preset.*\.json$/.test(n))&&R.proReel&&R.proReel.saved===true&&dls.some(n=>/reel_.*\.(webm|mp4|mkv)$/.test(n))&&calls.includes('/export/authorize'));
 R.proTrk=await pg.evaluate(async()=>{document.getElementById('trkWav').click();await new Promise(r=>setTimeout(r,500));return document.getElementById('trkStatus')?.textContent||''});ok('pro_tracks_gate_passes',!PRO_MSG.test(R.proTrk));await cx.close()}
// 7. PRO・サーバーに届かない：署名を確かめた証明の期限まで書き出せる
{const {cx,pg,dls}=await page({tok:await token('pro'),server:'down'});await pg.evaluate(()=>document.getElementById('exportPreset').click());await pg.waitForTimeout(800);ok('pro_offline_ok',dls.some(n=>/\.json$/.test(n)));await cx.close()}
// 8. 解約済み（端末の証明は期限内・サーバーは 403）：書き出しを止め、FREE に戻す
{const {cx,pg,dls}=await page({tok:await token('pro'),server:'free'});await pg.evaluate(()=>document.getElementById('exportPreset').click());await pg.waitForTimeout(800);
 R.canceled=await pg.evaluate(()=>({plan:sawwEntitlement.plan,tok:localStorage.getItem('saww.pro'),msg:document.getElementById('message').textContent}));
 ok('canceled_denied',dls.length===0&&R.canceled.plan==='free'&&!R.canceled.tok&&/確認できなかった/.test(R.canceled.msg));await cx.close()}
// 9. PRO から SEMI-PRO へ変更済み（サーバーは 403 plan semi）：書き出さず、SEMI-PRO になる
{const {cx,pg,dls}=await page({tok:await token('pro'),server:'semi'});await pg.evaluate(()=>document.getElementById('exportPreset').click());await pg.waitForTimeout(800);
 R.down=await pg.evaluate(()=>sawwEntitlement.plan);ok('downgrade_semi',dls.length===0&&R.down==='semi');await cx.close()}
// 10. 偽の許可（別の鍵の署名）は受け付けない
{const {cx,pg,dls}=await page({tok:await token('pro'),server:'forged'});await pg.evaluate(()=>document.getElementById('exportPreset').click());await pg.waitForTimeout(800);ok('forged_ticket_denied',dls.length===0);await cx.close()}
// 11. 偽の証明・plan を書き換えた証明・期限切れの証明：FREE のまま
{const forged=(await token('pro')).replace(/\.[^.]+$/,'.'+b64u(Buffer.alloc(64)));const {cx,pg,dls}=await page({tok:forged,server:'ok'});
 R.forged=await pg.evaluate(async()=>({plan:sawwEntitlement.plan,auth:(await sawwExport.authorize('video')).ok}));ok('forged_token_free',R.forged.plan==='free'&&!R.forged.auth&&dls.length===0);await cx.close()}
{const {cx,pg}=await page({tok:await token('pro',AFTER,30,{cap:['sampler']}),server:'ok'});R.nocap=await pg.evaluate(async()=>(await sawwExport.authorize('audio')).ok);ok('cap_without_export_denied',!R.nocap);await cx.close()}
{const {cx,pg}=await page({tok:await token('pro','2027-01-01T00:00:00Z',10),server:'down'});R.expired=await pg.evaluate(async()=>({plan:sawwEntitlement.plan,auth:(await sawwExport.authorize('audio')).ok}));ok('expired_token_denied',R.expired.plan==='free'&&!R.expired.auth);await cx.close()}
// 12. 期限が使用中に切れる：その場で書き出せなくなる
{const {cx,pg}=await page({tok:await token('pro',AFTER,0.0005),server:'down'});const before=await pg.evaluate(()=>sawwExport.allowed());await pg.clock.fastForward(120000);await pg.waitForTimeout(1500);
 const after=await pg.evaluate(()=>({now:sawwExport.allowed(),plan:sawwEntitlement.plan}));ok('expiry_revokes',before&&!after.now&&after.plan==='free');await cx.close()}
// 13. 許可（ticket）を PRO の証明として端末に置いても PRO にならない
{const {cx,pg}=await page({tok:await ticket(AFTER),server:'ok'});R.tk=await pg.evaluate(()=>sawwEntitlement.plan);ok('ticket_not_token',R.tk==='free');await cx.close()}
// 14. 管理者（署名付きの管理者パスで入った状態）：サーバーに聞かずに書き出せる
{const sk=await wc.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),sp=await wc.subtle.exportKey('jwk',sk.publicKey);
 const t=Math.floor(Date.parse(AFTER)/1000),body=b64u(JSON.stringify({role:'studio-admin',aud:'http://localhost:8765/',iat:t,exp:t+600})),pass=body+'.'+b64u(await wc.subtle.sign({name:'ECDSA',hash:'SHA-256'},sk.privateKey,Buffer.from(body)));
 const {cx,pg,dls,calls}=await page({cfg:{...CFG,studioPublicKey:{kty:'EC',crv:'P-256',x:sp.x,y:sp.y}}});
 await pg.evaluate(p=>{location.hash='saww-admin='+p;location.reload()},pass);await pg.waitForTimeout(1800);R.admin=await state(pg);
 await pg.evaluate(()=>document.getElementById('exportPreset').click());await pg.waitForTimeout(800);ok('admin_exports',R.admin.plan==='admin'&&R.admin.allows&&dls.some(n=>/\.json$/.test(n))&&!calls.includes('/export/authorize'));await cx.close()}
// 15. 課金を始める前のテスト公開（beta）：これまでどおり書き出せる
{const {cx,pg,dls}=await page({cfg:{...CFG,status:'test'}});await pg.evaluate(()=>document.getElementById('exportPreset').click());await pg.waitForTimeout(800);ok('beta_exports',dls.some(n=>/\.json$/.test(n)));await cx.close()}
// 16. 比較表：書き出しは FREE・SEMI-PRO とも —、リールは FREE で ✓（プレビュー）
{const {cx,pg}=await page();R.table=await pg.evaluate(()=>[...document.querySelectorAll('.planTable tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent)).filter(r=>/書き出し|リール/.test(r[0])));
 ok('table',R.table.some(r=>/ファイルの書き出し/.test(r[0])&&r[1]==='—'&&r[2]==='—'&&r[3]==='✓')&&R.table.some(r=>/プレビュー/.test(r[0])&&r[1]==='✓'));await cx.close()}
R.errs=errs.filter(e=>!/favicon|net::ERR|Failed to fetch|audio|decode/i.test(e));ok('no_page_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
