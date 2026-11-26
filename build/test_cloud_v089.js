// v0.89 アカウントのライブラリ（☁）の画面のテスト。課金サーバーは偽物（route・メモリ）。python3 -m http.server 8765 で配信して実行する。
// 古いサーバー（/library が無い）では欄を出さない／課金中なら出す／プリセットの保存・一覧・読み込み・削除（2回押し）／ループの保存・読み込み／エラーの案内／英語。
const {chromium}=require('playwright');const {webcrypto:wc}=require('crypto');(async()=>{
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];const b64u=b=>Buffer.from(b).toString('base64url');
const kp=await wc.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const pub=await wc.subtle.exportKey('jwk',kp.publicKey);
const sign=async p=>{const h=b64u(JSON.stringify({alg:'ES256',typ:'JWT',kid:'test'})),b=b64u(JSON.stringify(p));return h+'.'+b+'.'+b64u(await wc.subtle.sign({name:'ECDSA',hash:'SHA-256'},kp.privateKey,Buffer.from(h+'.'+b)))};
const WHEN='2027-02-01T00:00:00Z',t0=Math.floor(Date.parse(WHEN)/1000);const token=plan=>sign({sub:'cus_t',plan,cap:plan==='pro'?['export','sampler']:[],st:'active',pe:t0+30*86400,iat:t0,exp:t0+30*86400});
const CFG={status:'live',apiBase:'https://billing.test',publicKey:{kty:'EC',crv:'P-256',x:pub.x,y:pub.y},paymentLink:'https://buy.stripe.com/test_pro',portalLink:'https://billing.stripe.com/p/login/test',semiPaymentLink:'https://buy.stripe.com/test_semi'};
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
async function page(tok,{old=false,plan='pro'}={}){const cx=await b.newContext({viewport:{width:390,height:900},locale:'ja-JP'});const pg=await cx.newPage();pg.on('pageerror',e=>errs.push(e.message));
 const store={p:new Map(),l:new Map()},calls=[];
 await pg.route('https://billing.test/**',async r=>{const q=r.request(),u=new URL(q.url()),h=q.headers(),m=q.method();calls.push(m+' '+u.pathname);
  const J=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Saww-Meta'},body:JSON.stringify(o)});
  if(m==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, PUT, DELETE','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Saww-Meta'}});
  if(!u.pathname.startsWith('/library'))return r.fulfill({status:503,body:''});
  if(old)return r.fulfill({status:404,body:'not found'});
  if(!(h.authorization||'').startsWith('Bearer '))return J({ok:false,error:'token'},401);
  if(u.pathname==='/library')return J({ok:true,presets:[...store.p].map(([id,v])=>({id,name:v.name,created:1})),loops:[...store.l].map(([id,v])=>({id,name:v.name,sr:v.sr,len:v.len,created:1,size:v.buf.length})),limits:{presets:100,loops:20,totalLoopBytes:83886080},used:{loopBytes:[...store.l.values()].reduce((s,v)=>s+v.buf.length,0)}});
  const mm=u.pathname.match(/^\/library\/(preset|loop)\/(.+)$/);if(!mm)return J({ok:false},404);const [_,kind,id]=mm;
  if(m==='DELETE'){store[kind[0]].delete(id);return J({ok:true})}
  if(m==='PUT'){if(kind==='loop'&&plan==='semi')return J({ok:false,error:'plan_pro'},403);if(kind==='preset'){const j=JSON.parse(q.postData());store.p.set(id,j);return J({ok:true,id})}
   const meta=JSON.parse(Buffer.from(h['x-saww-meta'],'base64url'));const buf=q.postDataBuffer();store.l.set(id,{...meta,buf});return J({ok:true,id})}
  if(kind==='preset'){const v=store.p.get(id);return v?J({ok:true,...v}):J({ok:false},404)}
  const v=store.l.get(id);return v?r.fulfill({status:200,contentType:'application/octet-stream',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Saww-Meta','X-Saww-Meta':b64u(JSON.stringify({name:v.name,sr:v.sr,len:v.len}))},body:v.buf}):J({ok:false},404)});
 await pg.goto('http://localhost:8765/index.html?lang=ja');await pg.evaluate(([c,t])=>{localStorage.clear();localStorage.setItem('saww.billingTest',JSON.stringify(c));if(t)localStorage.setItem('saww.pro',t)},[CFG,tok]);
 await pg.reload();await pg.waitForTimeout(3200);return {cx,pg,store,calls}}
// 古いサーバー：出さない
{const {cx,pg}=await page(await token('pro'),{old:true});R.old=await pg.evaluate(()=>[document.getElementById('cloudPresets').hidden,document.getElementById('cloudLoops').hidden,[...document.querySelectorAll('.lpCloud')].every(b=>b.hidden)]);ok('hidden_on_old_server',R.old.every(Boolean));await cx.close()}
// 課金していない：出さない
{const {cx,pg}=await page(null);ok('hidden_for_free',await pg.evaluate(()=>document.getElementById('cloudPresets').hidden));await cx.close()}
// PRO
{const {cx,pg,store}=await page(await token('pro'));
 R.shown=await pg.evaluate(()=>[!document.getElementById('cloudPresets').hidden,!document.getElementById('cloudLoops').hidden,[...document.querySelectorAll('.lpCloud')].every(b=>!b.hidden)]);ok('shown_for_pro',R.shown.every(Boolean));
 await pg.evaluate(()=>{const d=__audioEcosystemDebug.exportData();d.chordIndex=3;d.ecosystem.rate=33;__audioEcosystemDebug.applyData(d)});
 await pg.fill('#cloudPresetName','夜の森');await pg.click('#cloudPresetSave');await pg.waitForTimeout(800);
 R.saved={msg:await pg.textContent('#cloudPresetMsg'),rows:await pg.evaluate(()=>[...document.querySelectorAll('#cloudPresetList .cloudName')].map(e=>e.textContent)),stored:[...store.p.values()].map(v=>v.name+':'+v.data.format+':'+v.data.chordIndex)};
 ok('preset_save',/保存しました/.test(R.saved.msg)&&R.saved.rows.join()==='夜の森'&&R.saved.stored.join()==='夜の森:audio-ecosystem-preset:3');
 await pg.evaluate(()=>{const d=__audioEcosystemDebug.exportData();d.chordIndex=0;d.ecosystem.rate=70;__audioEcosystemDebug.applyData(d)});
 await pg.click('#cloudPresetList .cloudRow button:not(.cloudDel)');await pg.waitForTimeout(600);
 R.loaded=await pg.evaluate(()=>{const d=__audioEcosystemDebug.exportData();return [d.chordIndex,d.ecosystem.rate]});ok('preset_load',R.loaded[0]===3&&R.loaded[1]===33);
 await pg.click('#cloudPresetList .cloudDel');R.del1=await pg.textContent('#cloudPresetList .cloudDel');await pg.click('#cloudPresetList .cloudDel');await pg.waitForTimeout(600);
 ok('preset_delete_two_step',R.del1==='本当に削除'&&store.p.size===0&&/まだありません/.test(await pg.textContent('#cloudPresetList')));
 // ループ：CH1 を録って ☁ → 一覧 → CH1 を消して読み込む（空いている CH1 に入る）
 await pg.click('#play');await pg.waitForTimeout(3500);await pg.evaluate(()=>{const s=document.getElementById('samplerSection');for(let n=s;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true});
 await pg.click('.lpCh[data-ch="0"] .lpRec');await pg.waitForTimeout(1200);await pg.click('.lpCh[data-ch="0"] .lpRec');await pg.waitForTimeout(600);
 const src=await pg.evaluate(()=>{const p=__looper.pcm(0);return {n:p.l.length,sr:p.sr,s:Array.from(p.l.slice(1000,1004))}});
 await pg.click('.lpCh[data-ch="0"] .lpCloud');await pg.waitForTimeout(1000);
 R.loop={msg:await pg.textContent('#cloudLoopMsg'),stored:[...store.l.values()].map(v=>({len:v.len,sr:v.sr,bytes:v.buf.length,name:v.name}))[0],rows:await pg.evaluate(()=>document.querySelectorAll('#cloudLoopList .cloudRow').length)};
 ok('loop_save',/保存しました/.test(R.loop.msg)&&R.loop.stored.len===src.n&&R.loop.stored.bytes===src.n*4&&R.loop.stored.sr===src.sr&&/· CH1$/.test(R.loop.stored.name)&&R.loop.rows===1);
 await pg.click('.lpCh[data-ch="0"] .lpClear');await pg.click('#cloudLoopList .cloudRow button:not(.cloudDel)');await pg.waitForTimeout(800);
 R.back=await pg.evaluate(()=>{const p=__looper.pcm(0);return {st:__looper.state()[0].state,n:p&&p.l.length,s:p&&Array.from(p.l.slice(1000,1004))}});
 ok('loop_load',R.back.st==='play'&&R.back.n===src.n&&R.back.s.every((x,i)=>Math.abs(x-src.s[i])<1/16000)&&/CH1 · 読み込みました/.test(await pg.textContent('#cloudLoopMsg')));
 // 英語
 await pg.evaluate(()=>{const s=document.getElementById('langSelect');s.value='en';s.dispatchEvent(new Event('change',{bubbles:true}))});await pg.waitForTimeout(500);
 R.en=await pg.evaluate(()=>{const jp=/[぀-ヿ一-鿿]/,left=[];for(const id of ['cloudPresets','cloudLoops']){const w=document.createTreeWalker(document.getElementById(id),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(t&&jp.test(t))left.push(t)}}
  for(const e of document.querySelectorAll('#cloudPresets [placeholder],#cloudPresets [aria-label],.lpCloud'))for(const a of ['placeholder','aria-label'])if(jp.test(e.getAttribute(a)||''))left.push('@'+e.getAttribute(a));return left});
 ok('english',R.en.length===0);ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);await cx.close()}
// SEMI-PRO：ループは PRO だけ
{const {cx,pg}=await page(await token('semi'),{plan:'semi'});await pg.click('#play');await pg.waitForTimeout(3000);await pg.evaluate(()=>{const s=document.getElementById('samplerSection');for(let n=s;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true});
 await pg.evaluate(async()=>{await __looper.rec(0);await new Promise(r=>setTimeout(r,800));await __looper.rec(0);await new Promise(r=>setTimeout(r,400));await __cloud.saveLoop(0)});ok('semi_loop_refused',/PRO だけ/.test(await pg.textContent('#cloudLoopMsg')));await cx.close()}
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon/.test(e));ok('no_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
