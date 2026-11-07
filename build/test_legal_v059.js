// v0.59 の回帰テスト：特定商取引法に基づく表記（legal.html）と、購入ボタンの前の「お申し込みの前に（定期購入の内容）」。
// python3 -m http.server 8765 で配信して実行する。AE_SHOT=フォルダ を付けると画面の写真を保存する。
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');(async()=>{
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];const SHOT=process.env.AE_SHOT;
const APP='http://localhost:8765/index.html';
const legalJson=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','legal.json'),'utf8'));
const HEADS=['販売事業者','運営統括責任者','所在地','電話番号','メールアドレス','販売価格','商品代金以外の必要料金','お支払いの方法','お支払いの時期','提供の時期','定期購入の契約期間・自動更新','解約の方法','返品・返金','お申し込みの撤回','動作環境'];
const TERMS=['内容','価格','契約期間・自動更新','お支払いの時期と方法','提供の時期','解約の方法','返品・返金','動作環境'];
const newPage=async(cx,cfg)=>{const pg=await cx.newPage();await require('./photo_fixture')(pg);pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
 await pg.route('https://buy.stripe.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>stripe</title>'}));
 await pg.goto(APP);await pg.evaluate(c=>{localStorage.clear();if(c)localStorage.setItem('saww.billingTest',JSON.stringify(c))},cfg);await pg.reload();await pg.waitForTimeout(1200);return pg};
const overflow=pg=>pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);

// 1. legal.html：表題・全項目・記入待ち・準備中の注意・390px ではみ出しなし
{const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await pg.goto('http://localhost:8765/legal.html');
 R.page=await pg.evaluate(()=>({title:document.title,h1:document.querySelector('h1').textContent,heads:[...document.querySelectorAll('th')].map(x=>x.textContent),missing:[...document.querySelectorAll('td.missing')].length,notice:!!document.querySelector('.notice'),box:document.querySelector('.box').textContent,back:document.querySelector('a[href="./"]')?.textContent}));
 ok('legal_page',/^特定商取引法に基づく表記/.test(R.page.title)&&R.page.h1==='特定商取引法に基づく表記'&&HEADS.every(h=>R.page.heads.includes(h)));
 const need=['seller','manager','address','phone','email'].filter(k=>!legalJson[k]).length+(legalJson.price.monthly?0:1);
 ok('legal_missing_marked',R.page.missing===need&&R.page.notice===(need>0));ok('legal_subscription_box',/月額の定期購読/.test(R.page.box)&&/解約/.test(R.page.box));
 ok('legal_390',(await overflow(pg))<=0);if(SHOT)await pg.screenshot({path:SHOT+'/legal_390.png',fullPage:true});await cx.close()}

// 2. 販売を始める前（いまの設定）：プランの欄にリンクと内容の案。LIVE にしても特商法が記入待ちなら課金は始まらない
{const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await newPage(cx,null);
 R.pre=await pg.evaluate(()=>({live:__billingDebug.live,ready:__billingDebug.legal.ready,link:document.querySelector('#plansBody .planLegal a')?.getAttribute('href'),pv:!!document.querySelector('#subTermsPreview #subTerms'),dts:[...document.querySelectorAll('#subTerms dt')].map(x=>x.textContent),buy:!!document.getElementById('billBuy')}));
 ok('pre_link_preview',!R.pre.live&&R.pre.link==='legal.html'&&R.pre.pv&&TERMS.every(k=>R.pre.dts.includes(k))&&!R.pre.buy);
 await cx.close();
 const cx2=await b.newContext({viewport:{width:390,height:844}});const pg2=await newPage(cx2,{status:'live',apiBase:'https://billing.test',publicKey:{kty:'EC',crv:'P-256',x:'x',y:'y'},paymentLink:'https://buy.stripe.com/test_x'});
 R.gate=await pg2.evaluate(()=>({live:__billingDebug.live,plan:__billingDebug.state().plan,buy:!!document.getElementById('billBuy')}));ok('gate_until_legal_ready',!R.gate.live&&R.gate.plan==='beta'&&!R.gate.buy);await cx2.close()}

// 3. 販売中（特商法が埋まった想定）：購入ボタンの上に内容、確認のチェックを入れるまで押せない
const LEGAL_OK={ready:true,missing:[],monthly:980,taxIncluded:true,terms:[['内容','saww audio ecosystem PRO の月額の定期購読'],['価格','PRO：月額 980円（税込）。毎月同じ金額です。'],['契約期間・自動更新','1か月ごとの自動更新'],['お支払いの時期と方法','毎月'],['提供の時期','すぐ'],['解約の方法','いつでも'],['返品・返金','返金なし'],['動作環境','最新のブラウザ']]};
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await newPage(cx,{status:'live',apiBase:'https://billing.test',publicKey:{kty:'EC',crv:'P-256',x:'x',y:'y'},paymentLink:'https://buy.stripe.com/test_x',legal:LEGAL_OK});
R.live=await pg.evaluate(()=>{const t=document.getElementById('subTerms'),b=document.getElementById('billBuy'),a=document.getElementById('subAgree');
 return {live:__billingDebug.live,terms:!!t,before:!!(t&&b&&(t.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)),agreeBefore:!!(a&&b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)),
  dis:b.getAttribute('aria-disabled'),cls:b.classList.contains('disabled'),checked:a.checked,price:document.querySelector('.plan-pro .planPrice')?.textContent,meta:document.querySelector('#plansSection .stepMeta').textContent,dd:[...t.querySelectorAll('dd')].map(x=>x.textContent)}});
ok('live_terms_above_buy',R.live.live&&R.live.terms&&R.live.before&&R.live.agreeBefore&&R.live.dd.length===8);
ok('live_price_card',/^¥980/.test(R.live.price)&&/月（税込）/.test(R.live.price)&&R.live.meta==='JPY');
ok('buy_disabled',R.live.dis==='true'&&R.live.cls&&!R.live.checked);
await pg.evaluate(()=>document.getElementById('planAccount').scrollIntoView({block:'center'}));
if(SHOT)await pg.locator('#plansSection').screenshot({path:SHOT+'/plans_live_unchecked.png'});
await pg.click('#billBuy',{force:true});await pg.waitForTimeout(400); // aria-disabled のため、押せない状態のまま押してみる
R.blocked={url:pg.url(),hint:await pg.textContent('#subAgreeHint'),focus:await pg.evaluate(()=>document.activeElement.id)};ok('click_blocked',R.blocked.url.startsWith(APP)&&/確認して/.test(R.blocked.hint)&&R.blocked.focus==='subAgree');
await pg.check('#subAgree');R.after=await pg.evaluate(()=>({dis:document.getElementById('billBuy').getAttribute('aria-disabled'),hint:document.getElementById('subAgreeHint').textContent}));ok('agree_enables',R.after.dis==='false'&&R.after.hint==='');
if(SHOT)await pg.locator('#plansSection').screenshot({path:SHOT+'/plans_live_checked.png'});
await Promise.all([pg.waitForURL(/buy\.stripe\.com\/test_x\?client_reference_id=/,{timeout:8000}).catch(()=>{}),pg.click('#billBuy')]);R.went=pg.url();ok('buy_goes_to_stripe',/^https:\/\/buy\.stripe\.com\/test_x\?client_reference_id=[a-z0-9]{12,}$/.test(R.went));
// 4. 英語表示：法律の本文は日本語のまま（翻訳対象から外す）、説明の一行、未翻訳0、はみ出しなし
await pg.goto(APP);await pg.waitForTimeout(1200);await pg.click('#langToggle');await pg.waitForTimeout(600);
R.en=await pg.evaluate(()=>({un:(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})(),title:document.querySelector('.subTermsTitle').textContent,note:document.querySelector('#subTerms > p.micro')?.textContent,agree:document.querySelector('.subAgree').textContent.trim(),link:document.querySelector('.planLegal a').textContent}));
R.en.un=R.en.un.filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));
ok('english',R.en.un.length===0&&R.en.title==='Before you subscribe — subscription terms'&&/Japanese law/.test(R.en.note||'')&&/renews monthly/.test(R.en.agree)&&/Legal notice/.test(R.en.link));
ok('no_overflow',(await overflow(pg))<=0);await cx.close();

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');R.version=/<title>saww audio ecosystem v0\.(\d+)/.exec(html)[1];ok('version',+R.version>=59);
R.errs=errs.filter(e=>!/favicon|net::ERR/.test(e));ok('no_console_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
