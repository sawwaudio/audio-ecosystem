// v0.48 リール「自然」「自然・紙」（写真が主役・色は写真から）と、画面の自然な配色・書体の回帰テスト。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const wait=ms=>pg.waitForTimeout(ms);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await wait(900);
// 1. 既定は「自然」。書体は明朝・ゴシック・イタリック
R.ui=await pg.evaluate(()=>({tpl:__studioDebug.template(),style:__reelDebug.style(),opts:[...document.querySelectorAll('#reelStyle option')].map(o=>o.value).slice(0,3),fonts:(document.querySelector('link[href*="fonts.googleapis.com/css2"]')||{}).href||'',bodyFont:getComputedStyle(document.body).fontFamily,title:getComputedStyle(document.querySelector('.stepTitle')).fontFamily}));
ok('default_nature',R.ui.tpl==='nature'&&R.ui.style==='nature'&&R.ui.opts.join()==='nature,nature-paper,pop-sunny'&&/Shippori\+Mincho\+B1/.test(R.ui.fonts)&&/Zen Kaku Gothic New/.test(R.ui.bodyFont)&&/Shippori Mincho B1/.test(R.ui.title));
// 1b. 生き物と環境音を分ける：分類の絞り込み・環境音の欄・分類の台帳
R.cat=await pg.evaluate(()=>{const c=JSON.parse(document.getElementById('ae-categories').textContent).categories,n={};for(const v of Object.values(c))n[v.cat]=(n[v.cat]||0)+1;
 return {n,total:Object.keys(c).length,filters:[...document.querySelectorAll('#tileFilters button')].map(b=>b.dataset.f).join(),amb:[...document.querySelectorAll('#ambGrid .tile')].map(t=>t.dataset.group),gridAmb:document.querySelectorAll('#tileGrid .tile[data-group="ambience"]').length,basis:Object.values(c).every(v=>v.basis)}});
await pg.click('#tileFilters [data-f="aquatic"]');await wait(300);R.cat.aquatic=await pg.evaluate(()=>[...new Set([...document.querySelectorAll('#tileGrid .tile')].map(t=>t.dataset.group))]);await pg.click('#tileFilters [data-f="all"]');await wait(200);
ok('categories',R.cat.total===127&&R.cat.n.ambience===30&&R.cat.n.amphibians>=15&&R.cat.n.aquatic>=8&&R.cat.n.mammals>=8&&R.cat.filters==='all,birds,insects,amphibians,mammals,aquatic,japan' /* v0.53：写真あり・再生中を外し、自分の音は読み込んだ時だけ */&&R.cat.amb.length===30&&R.cat.amb.every(g=>g==='ambience')&&R.cat.gridAmb===0&&R.cat.aquatic.join()==='aquatic'&&R.cat.basis);
// 2. 写真が主役：写真の場所に写真が描かれ、色は写真（またはグループ）から取る
const ids=await pg.evaluate(()=>[...document.querySelectorAll('#tileGrid .tile')].filter(t=>t.querySelector('img')&&t.querySelector('.tileTier').textContent!=='C').map(t=>t.dataset.id).slice(0,2));
await pg.evaluate(ids=>{for(const id of ids)__studioDebug.start(id)},ids);await wait(1800);await pg.evaluate(()=>__reelDebug.preview(true));await wait(1500);
const region=(x,y,w,h)=>pg.evaluate(([x,y,w,h])=>{const d=document.getElementById('reelCanvas').getContext('2d').getImageData(x,y,w,h).data;let s=0,s2=0,n=0;for(let i=0;i<d.length;i+=16){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++}const m=s/n;return {mean:+m.toFixed(1),sd:+Math.sqrt(Math.max(0,s2/n-m*m)).toFixed(1)}},[x,y,w,h]);
R.subject=await pg.evaluate(()=>__studioDebug.subject());R.pal=await pg.evaluate(id=>__studioDebug.natPal(id),R.subject);
R.photoArea=await region(140,420,800,500);R.bgArea=await region(40,1700,1000,180);
const fx=await pg.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1;return true});
ok('photo_hero',ids.includes(R.subject)&&R.photoArea.sd>3&&Array.isArray(R.pal.acc)&&R.pal.acc.length===3&&Array.isArray(R.pal.dark));
R.cost=await pg.evaluate(()=>{const c=document.getElementById('reelCanvas').getContext('2d');const t0=performance.now();for(let i=0;i<20;i++)window.reelDrawStudio(c,'nature');return (performance.now()-t0)/20});ok('draw_cost',R.cost<25);
const snap=()=>pg.evaluate(()=>{const s=document.createElement('canvas');s.width=108;s.height=192;s.getContext('2d').drawImage(document.getElementById('reelCanvas'),0,0,108,192);return [...s.getContext('2d').getImageData(0,0,108,192).data]});
const diff=(a,b2)=>{let d=0;for(let i=0;i<a.length;i+=4)d+=Math.abs(a[i]-b2[i])+Math.abs(a[i+1]-b2[i+1])+Math.abs(a[i+2]-b2[i+2]);return d/(a.length/4)/3};
const s1=await snap();await wait(700);const s2=await snap();R.motion=+diff(s1,s2).toFixed(2);ok('moves',R.motion>.2);
// 3. 「自然・紙」：明るい紙の地
await pg.selectOption('#reelStyle','nature-paper');await wait(500);R.paper=await pg.evaluate(()=>{const p=document.getElementById('reelCanvas').getContext('2d').getImageData(20,20,1,1).data;return [p[0],p[1],p[2]]});
ok('paper',Math.abs(R.paper[0]-243)<12&&Math.abs(R.paper[1]-239)<12&&Math.abs(R.paper[2]-230)<12);
// 4. 画面の配色（夕方の森・琥珀色）
R.css=await pg.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,reel:getComputedStyle(document.getElementById('reelRecord')).backgroundColor}));ok('ui_colors',R.css.bg==='rgb(20, 26, 22)'&&R.css.reel==='rgb(230, 194, 122)');
// 5. 録画：「自然」で書き出せて、写真と録音のクレジットが入る
await pg.selectOption('#reelStyle','nature');await wait(200);
const dlP=pg.waitForEvent('download',{timeout:40000,predicate:d=>/\.(mp4|webm)$/.test(d.suggestedFilename())});await pg.evaluate(()=>__reelDebug.start(15));await wait(3200);await pg.click('#reelStop');const dl=await dlP;
const st=await pg.evaluate(()=>__reelDebug.state());R.rec={file:dl.suggestedFilename(),frames:st.frames,style:await pg.evaluate(()=>__reelDebug.style()),photos:await pg.evaluate(()=>__studioDebug.photosUsed()),credits:/Photo credits/i.test(st.result.text)};
ok('record_nature',/\.(mp4|webm)$/.test(R.rec.file)&&R.rec.frames>=40&&R.rec.style==='nature'&&R.rec.photos.length>=1&&R.rec.credits);
// 6. 英語表示・はみ出し・エラー
await pg.click('#langToggle');await wait(400);const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;
R.en=await pg.evaluate(()=>document.querySelector('#reelStyle option').textContent);ok('english',un.length===0&&R.en==='Nature (colours from the photo)');await pg.click('#langToggle');await wait(200);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
