// v0.47 リール「ポップ」5配色と、画面の配色・書体の回帰テスト。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。書体は既定で空の CSS（端末の書体）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const wait=ms=>pg.waitForTimeout(ms);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await wait(900);
// 1. 既定はポップ（ひまわり）。5配色がテンプレートの先頭
await pg.selectOption('#reelStyle','pop-sunny');await wait(200); // v0.48 から既定は「自然」。ポップは選んで使う
R.ui=await pg.evaluate(()=>({tpl:__studioDebug.template(),style:__reelDebug.style(),sel:document.getElementById('reelStyle').value,opts:[...document.querySelectorAll('#reelStyle option')].map(o=>o.value).slice(2,7),fonts:!!document.querySelector('link[href*="Dela+Gothic+One"]')}));
ok('default_pop',R.ui.tpl==='pop-sunny'&&R.ui.style==='pop'&&R.ui.sel==='pop-sunny'&&R.ui.opts.join()==='pop-sunny,pop-candy,pop-lagoon,pop-jungle,pop-night'&&R.ui.fonts);
// 2. 描く：地の色が配色どおり、音で花びらが動く、描画が速い
const ids=await pg.evaluate(()=>[...document.querySelectorAll('#tileGrid .tile')].filter(t=>t.querySelector('img')&&t.querySelector('.tileTier').textContent!=='C').map(t=>t.dataset.id).slice(0,2)); // リールの録画は BY-SA を除くので、C 区分ではない写真の音を使う
await pg.evaluate(ids=>{for(const id of ids)__studioDebug.start(id)},ids);await wait(1800);await pg.evaluate(()=>__reelDebug.preview(true));await wait(800);
const px=()=>pg.evaluate(()=>{const c=document.getElementById('reelCanvas').getContext('2d');const p=c.getImageData(1040,1900,1,1).data;return [p[0],p[1],p[2]]});
const BG={'pop-sunny':[255,212,71],'pop-candy':[255,138,196],'pop-lagoon':[31,68,217],'pop-jungle':[23,168,102],'pop-night':[43,18,89]};R.bg={};
for(const [tpl,rgb] of Object.entries(BG)){await pg.selectOption('#reelStyle',tpl);await wait(350);const p=await px();R.bg[tpl]=p;R.bg[tpl+'_d']=Math.max(...p.map((v,i)=>Math.abs(v-rgb[i])))}
ok('palettes',Object.keys(BG).every(k=>R.bg[k+'_d']<=40));
await pg.selectOption('#reelStyle','pop-sunny');await wait(300);
const snap=()=>pg.evaluate(()=>{const s=document.createElement('canvas');s.width=108;s.height=192;s.getContext('2d').drawImage(document.getElementById('reelCanvas'),0,0,108,192);return [...s.getContext('2d').getImageData(0,0,108,192).data]});
const diff=(a,b2)=>{let d=0;for(let i=0;i<a.length;i+=4)d+=Math.abs(a[i]-b2[i])+Math.abs(a[i+1]-b2[i+1])+Math.abs(a[i+2]-b2[i+2]);return d/(a.length/4)/3};
const s1=await snap();await wait(500);const s2=await snap();R.motion=+diff(s1,s2).toFixed(2);ok('moves',R.motion>1);
R.cost=await pg.evaluate(()=>{const c=document.getElementById('reelCanvas').getContext('2d');const t0=performance.now();for(let i=0;i<20;i++)window.reelDrawStudio(c,'pop');return (performance.now()-t0)/20});ok('draw_cost',R.cost<25);
R.state=await pg.evaluate(()=>({subject:__studioDebug.subject(),photos:__studioDebug.imgCache().filter(x=>x.ok).length}));ok('subject',ids.includes(R.state.subject)&&R.state.photos>=1);
// 4. 画面の配色：深い青紫の地・黄色の主ボタン・グループの色のタイル
R.css=await pg.evaluate(()=>{const g=e=>getComputedStyle(e);const t=document.querySelector('#tileGrid .tile.on');return {bg:g(document.body).backgroundColor,reel:g(document.getElementById('reelRecord')).backgroundColor,tile:t?g(t).borderTopColor:null,group:t?t.dataset.group:null,mark:!!document.querySelector('.brandMark .petals'),live:document.body.classList.contains('live')}});
const GC={birds:'rgb(143, 179, 214)',insects:'rgb(230, 194, 122)',animals:'rgb(207, 142, 106)',landscape:'rgb(142, 195, 160)'}; // v0.48 の自然の色
ok('ui_colors',R.css.bg==='rgb(20, 26, 22)'&&R.css.reel==='rgb(230, 194, 122)'&&R.css.tile===GC[R.css.group]&&R.css.mark&&R.css.live); // v0.48 の配色
// 3. 録画：ポップで書き出せて、写真と録音のクレジットが入る
await pg.evaluate(()=>__rightsDebug.set('all'));
const dlP=pg.waitForEvent('download',{timeout:40000,predicate:d=>/\.(mp4|webm)$/.test(d.suggestedFilename())});await pg.evaluate(()=>__reelDebug.start(15));await wait(3200);await pg.click('#reelStop');const dl=await dlP;
const st=await pg.evaluate(()=>__reelDebug.state());R.rec={file:dl.suggestedFilename(),frames:st.frames,style:await pg.evaluate(()=>__reelDebug.style()),photos:await pg.evaluate(()=>__studioDebug.photosUsed()),credits:/Photo credits/i.test(st.result.text)};
ok('record_pop',/^saww_audio_ecosystem_reel_.+\.(mp4|webm)$/.test(R.rec.file)&&R.rec.frames>=40&&R.rec.style==='pop'&&R.rec.photos.length>=1&&R.rec.credits);
// 5. 英語表示・はみ出し・エラー
await pg.click('#langToggle');await wait(400);const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;
R.en=await pg.evaluate(()=>document.querySelector('#reelStyle option[value="pop-sunny"]').textContent);ok('english',un.length===0&&R.en==='Pop — sunflower');await pg.click('#langToggle');await wait(200);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
