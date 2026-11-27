// v0.90 録った人をタイルと詳細に出し、その人の録音で絞り込む（録る人 → 聴く人・作る人）。python3 -m http.server 8765 で配信して実行する。
// タイルの「録音 ○○」／詳細の「録った人」と「この人の録音を見る（n）」／絞り込みのチップと解除／#by= のリンクで開く／環境音だけの人は環境音の欄へ／英語／390px／コンソールエラー0。
const {chromium}=require('playwright');(async()=>{
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];
const b=await chromium.launch();
async function page(hash=''){const cx=await b.newContext({viewport:{width:390,height:900},locale:'ja-JP'});const pg=await cx.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await pg.goto('http://localhost:8765/index.html?lang=ja'+hash);await pg.waitForTimeout(3000);return {cx,pg}}
const recs=await (async()=>{const {cx,pg}=await page();const v=await pg.evaluate(()=>JSON.parse(document.getElementById('ae-recordings').textContent).map(r=>({id:r.id,author:r.author,group:r.group})));await cx.close();return v})();
const cnt={};for(const r of recs)cnt[r.author]=(cnt[r.author]||0)+1;
const multi=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).find(a=>recs.filter(r=>r.author===a).some(r=>r.group!=='ambience'));
const ambOnly=Object.keys(cnt).find(a=>recs.filter(r=>r.author===a).every(r=>r.group==='ambience'));
const single=Object.keys(cnt).find(a=>cnt[a]===1&&recs.find(r=>r.author===a).group!=='ambience');
R.pick={multi,n:cnt[multi],ambOnly,single};
// 1) タイルに録った人
{const {cx,pg}=await page();
 R.tiles=await pg.evaluate(()=>[...document.querySelectorAll('#tileGrid .tile')].slice(0,12).map(t=>{const r=JSON.parse(document.getElementById('ae-recordings').textContent).find(x=>x.id===t.dataset.id);return {id:t.dataset.id,by:t.querySelector('.tileBy')?.textContent||null,author:r&&r.author}}));
 ok('tile_shows_recordist',R.tiles.length>0&&R.tiles.every(t=>!t.author||t.by==='録音 '+t.author));
 // 2) 詳細：録った人と「この人の録音を見る」
 const id=recs.find(r=>r.author===multi&&r.group!=='ambience').id;
 await pg.evaluate(id=>window.__studioDebug.open(id),id);await pg.waitForTimeout(300);
 R.sheet=await pg.evaluate(()=>({hidden:document.getElementById('sheetBy').hidden,text:document.getElementById('sheetBy').textContent}));
 ok('sheet_recordist',!R.sheet.hidden&&R.sheet.text.includes('録った人：'+multi)&&R.sheet.text.includes('この人の録音を見る（'+cnt[multi]+'）'));
 await pg.click('#sheetByBtn');await pg.waitForTimeout(500);
 R.filtered=await pg.evaluate(()=>({open:document.getElementById('tileSheet').open,ids:[...document.querySelectorAll('#tileGrid .tile,#ambGrid .tile')].map(t=>t.dataset.id),chip:document.querySelector('#tileFilters .byChip')?.textContent,by:window.__studioDebug.by()}));
 const want=recs.filter(r=>r.author===multi).map(r=>r.id).sort();
 ok('filter_by_recordist',!R.filtered.open&&R.filtered.by===multi&&JSON.stringify(R.filtered.ids.slice().sort())===JSON.stringify(want)&&R.filtered.chip==='録音：'+multi+' ×');
 ok('overflow_filtered',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
 // 英語
 await pg.evaluate(()=>{const s=document.getElementById('langSelect');s.value='en';s.dispatchEvent(new Event('change',{bubbles:true}))});await pg.waitForTimeout(600);
 R.en=await pg.evaluate(id=>{window.__studioDebug.open(id);const jp=/[぀-ヿ一-鿿]/,left=[];
  const chk=t=>{if(t&&jp.test(t.replace(/ISAKA|Σ64/g,'')))left.push(t)};
  for(const e of document.querySelectorAll('#tileFilters .byChip,#tileFilters .byLink,#sheetBy span,#sheetBy button'))chk(e.textContent);
  for(const e of document.querySelectorAll('#tileGrid .tileBy'))chk(e.textContent.replace(/^rec\. .*/,''));
  return {left,chip:document.querySelector('#tileFilters .byChip')?.textContent,sheet:document.getElementById('sheetBy').textContent,tile:document.querySelector('#tileGrid .tileBy')?.textContent}},recs.find(r=>r.author===multi).id);
 ok('english',R.en.left.length===0&&R.en.chip==='Rec: '+multi+' ×'&&R.en.sheet.startsWith('Recorded by '+multi)&&/^rec\. /.test(R.en.tile));
 await pg.evaluate(()=>window.__studioDebug.close());
 // 解除
 await pg.click('#tileFilters .byChip');await pg.waitForTimeout(400);
 R.cleared=await pg.evaluate(()=>({by:window.__studioDebug.by(),chip:!!document.querySelector('#tileFilters .byChip'),n:document.querySelectorAll('#tileGrid .tile').length}));
 ok('clear_filter',R.cleared.by===null&&!R.cleared.chip&&R.cleared.n>=12);
 // 1本だけの人はボタンを出さない
 await pg.evaluate(id=>window.__studioDebug.open(id),recs.find(r=>r.author===single).id);await pg.waitForTimeout(200);
 ok('single_no_button',!(await pg.$('#sheetByBtn'))&&(await pg.textContent('#sheetBy')).includes(single));
 await cx.close()}
// 3) #by= のリンクで開く
{const {cx,pg}=await page('#by='+encodeURIComponent(multi));
 R.hash=await pg.evaluate(()=>({by:window.__studioDebug.by(),n:document.querySelectorAll('#tileGrid .tile,#ambGrid .tile').length}));
 ok('hash_link',R.hash.by===multi&&R.hash.n===cnt[multi]);
 await pg.evaluate(()=>{location.hash='#by=__nobody__'});await pg.waitForTimeout(300);ok('hash_unknown_ignored',await pg.evaluate(()=>window.__studioDebug.by())===multi);
 await cx.close()}
// 4) 環境音だけの人は環境音の欄を開く
if(ambOnly){const {cx,pg}=await page('#by='+encodeURIComponent(ambOnly));
 R.amb=await pg.evaluate(()=>({paneHidden:document.getElementById('creaturePane').hidden,amb:document.querySelectorAll('#ambGrid .tile').length}));
 ok('ambience_tab',R.amb.paneHidden&&R.amb.amb===cnt[ambOnly]);await cx.close()}else R.amb='no ambience-only recordist';
// 5) 存在しない名前のリンクでは何もしない
{const {cx,pg}=await page('#by=%E3%81%BB%E3%81%92');ok('hash_unknown',await pg.evaluate(()=>window.__studioDebug.by())===null&&await pg.evaluate(()=>document.querySelectorAll('#tileGrid .tile').length)>=12);
 ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);await cx.close()}
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon|ERR_|status of 404/.test(e));ok('no_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
