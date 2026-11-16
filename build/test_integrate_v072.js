// v0.72 本体への統合（2026-11-15）の回帰テスト。python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
// 本体（main：v0.67〜v0.71 の音律・BY-SA の警告・スマホの入力欄・リールのテンプレートの並び）と、公開版（音源リポジトリ：課金の公開・年末の無料開放・SEMI-PRO・
// 配信用の画面・英語が既定・楽器の試聴を外した）を1つにした状態を確かめる。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};const errs=[];
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
// 1. 公開のままの設定（billingTest なし）：課金は live、2026年12月31日までは全機能が無料（plan 'open'）
{const cx=await b.newContext({viewport:{width:390,height:844},locale:'en-US'});const pg=await cx.newPage();
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await pg.route(/^https:\/\/(thumb|upload)\.wikimedia\.org\/|^https:\/\/fonts\.|^https:\/\/saw-saww-official\.com\/|^https:\/\/saww-billing\./,r=>r.fulfill({status:204,body:''}));
 await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(1500);
 R.open=await pg.evaluate(()=>({live:__billingDebug.live,plan:sawwEntitlement.plan,lang:document.documentElement.lang,mixer:sawwEntitlement.allows('mixer'),sampler:sawwEntitlement.allows('sampler')}));
 ok('live_open',R.open.live&&(Date.now()<Date.parse('2027-01-01T00:00:00+09:00')?R.open.plan==='open'&&R.open.mixer&&R.open.sampler:R.open.plan==='free'));
 ok('english_default',R.open.lang==='en'||await pg.evaluate(()=>document.getElementById('langToggle').textContent.trim()==='日本語'));
 await cx.close()}
// 2. 本体の機能：音律（432Hz・純正律）とキー、リールのテンプレートの並び（ポップを外し、流体・等高線・Bio Motion を足した）
{const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
 await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(1200);
 R.tune=await pg.evaluate(()=>({ref:window.saeTuning&&saeTuning.get().ref,sys:window.saeTuning&&saeTuning.get().system,key:!!document.getElementById('keySelect')||!!document.querySelector('.keyRow select')}));
 ok('tuning',R.tune.ref===432&&R.tune.sys==='ji5'&&R.tune.key);
 R.chips=await pg.evaluate(()=>[...document.querySelectorAll('.tplChip')].map(c=>c.dataset.tpl));const opts=await pg.evaluate(()=>[...document.querySelectorAll('#reelStyle option')].map(o=>o.value));
 ok('chips_match_select',R.chips.every(v=>opts.includes(v))&&opts.every(v=>R.chips.includes(v))&&!R.chips.some(v=>v.startsWith('pop-')));
 await pg.click('.tplChip[data-tpl="flow"]');await pg.waitForTimeout(300);ok('chip_flow',await pg.evaluate(()=>document.getElementById('reelStyle').value)==='flow');
 ok('live_button',await pg.evaluate(()=>!!document.getElementById('liveOpenBtn')&&!!window.__liveDebug));
 await pg.evaluate(()=>__liveDebug.open('contour'));await pg.waitForFunction(()=>__liveDebug.state().frames>3,null,{timeout:5000}).catch(()=>{});R.live=await pg.evaluate(()=>__liveDebug.state());await pg.evaluate(()=>__liveDebug.close());
 // 2026-11-16 自動実行：ソフトウェア描画では 800ms で3フレームに届かないことがあり（変更前の main でも5回中3回失敗）、最大5秒まで描画を待つ形に。
 ok('live_draws',R.live.on&&R.live.frames>3);
 ok('no_audition',await pg.evaluate(()=>document.querySelectorAll('#auditionButtons button').length===0));
 await cx.close()}
// 3. URL：本体の URL を正とし、旧 URL（音源リポジトリ）向けの管理者の許可も受け付ける。画面に出す URL は本体
ok('audiences',/STUDIO_AUDIENCE = 'https:\/\/sawwaudio\.github\.io\/audio-ecosystem\/'/.test(html)&&/STUDIO_AUDIENCES=\[STUDIO_AUDIENCE,'https:\/\/sawwaudio\.github\.io\/audio-ecosystem-sounds-1\/'\]/.test(html)&&!/aud!==STUDIO_AUDIENCE|href!==STUDIO_AUDIENCE/.test(html));
ok('shown_url',!/fillText\([^)]*audio-ecosystem-sounds-1/.test(html)&&/sawwaudio\.github\.io\/audio-ecosystem'/.test(html));
ok('files',['legal.html','credits.html','sw.js'].every(f=>fs.existsSync(__dirname+'/../'+f)));
const tiers=JSON.parse(/id="ae-tiers">([\s\S]*?)<\/script>/.exec(html)[1]);ok('tiers_data_same',JSON.stringify(tiers)===JSON.stringify(JSON.parse(fs.readFileSync(__dirname+'/../data/product_tiers.json','utf8'))));
const tag='<script id="ae-i18n">',ia=html.indexOf(tag)+tag.length;ok('i18n_parity',html.slice(ia,html.indexOf('</script>',ia))===fs.readFileSync(__dirname+'/src_i18n.js','utf8'));
R.errs=errs;ok('no_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
