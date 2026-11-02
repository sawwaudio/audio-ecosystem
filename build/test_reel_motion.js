// v0.37 リールの見た目「動き」の回帰テスト。python3 -m http.server 8765 で配信して実行する。
// 確かめること：既定が「動き」、プレビューで絵が動く・音に反応する、生き物のカードが出る、文字が SNS の画面部品に隠れにくい範囲に収まる、「分析」に戻せる、録画できる、英語表示、エラー0。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
R.ui=await pg.evaluate(()=>({style:__reelDebug.style(),sel:document.getElementById('reelStyle').value,opts:[...document.querySelectorAll('#reelStyle option')].map(o=>o.value),btn:document.getElementById('reelPreview').textContent}));
ok('default_motion',R.ui.style==='motion'&&R.ui.sel==='motion'&&R.ui.opts.join()==='motion,analysis'&&R.ui.btn==='▶ 動きをプレビュー');
// 画面の縮小版（108×192）を取り、2枚の差（0〜255）と明るさの散らばりを測る
const snap=()=>pg.evaluate(()=>{const s=document.createElement('canvas');s.width=108;s.height=192;const g=s.getContext('2d');g.drawImage(document.getElementById('reelCanvas'),0,0,108,192);return [...g.getImageData(0,0,108,192).data]});
const diff=(a,b)=>{let d=0,n=0;for(let i=0;i<a.length;i+=4){d+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);n+=3}return d/n};
const spread=a=>{const L=[];for(let i=0;i<a.length;i+=4)L.push((a[i]+a[i+1]+a[i+2])/3);const m=L.reduce((x,y)=>x+y,0)/L.length;return Math.sqrt(L.reduce((x,y)=>x+(y-m)**2,0)/L.length)};
// 1. 無音でもプレビューは動く（光の粒が流れる）
await pg.click('#reelPreview');await pg.waitForTimeout(3200);const q1=await snap();await pg.waitForTimeout(700);const q2=await snap();R.idleDiff=+diff(q1,q2).toFixed(2);ok('idle_moves',R.idleDiff>.08);
R.btnOn=await pg.evaluate(()=>({t:document.getElementById('reelPreview').textContent,p:document.getElementById('reelPreview').getAttribute('aria-pressed')}));ok('preview_button',R.btnOn.t==='■ プレビューを止める'&&R.btnOn.p==='true');
// 2. 演奏中：音に反応する（輪・霧）、カードが出る
await pg.click('#play');await pg.waitForTimeout(7000);
const a1=await snap();await pg.waitForTimeout(500);const a2=await snap();R.liveDiff=+diff(a1,a2).toFixed(2);R.spread=+spread(a2).toFixed(1);ok('live_moves',R.liveDiff>R.idleDiff&&R.liveDiff>1);ok('not_flat',R.spread>8);
R.mo=await pg.evaluate(()=>{const m=__reelDebug.motion();return {cards:m.cards,env:m.env,parts:m.parts,ms:m.drawMs.reduce((a,b)=>a+b,0)/m.drawMs.length,boxes:m.boxes}});
R.now=await pg.evaluate(()=>__reelDebug.now().map(n=>n.id));
ok('reacts',R.mo.env.rms>.2&&(R.mo.env.low+R.mo.env.mid+R.mo.env.high)>.3);
ok('cards_follow_now',R.now.length>0&&R.now.every(id=>R.mo.cards.includes(id)));
const cardTexts=R.mo.boxes.filter(x=>x.kind==='card').length;ok('cards_drawn',cardTexts>=4);
// 文字の安全域：左 60〜右 932px、上 220〜下 1580px（1080×1920）
const bad=R.mo.boxes.filter(x=>x.x<59||x.x+x.w>933||x.y<219||x.y+x.h>1581);R.unsafe=bad;ok('text_in_safe_zone',bad.length===0&&R.mo.boxes.some(x=>x.kind==='rights'));
R.drawMs=+R.mo.ms.toFixed(2);ok('draw_cost',R.mo.ms<12);
// 3. プレビュー中に演奏を始めると、鳴き始めた声ごとにカードが現れ、強い波紋が広がる
R.fresh=await pg.evaluate(()=>{const m=__reelDebug.motion();return {cardEvents:m.cardEvents,strongRips:m.strongRips}});ok('new_voice_card',R.fresh.cardEvents>=1&&R.fresh.strongRips>=1&&R.fresh.strongRips<=R.fresh.cardEvents);
// 4. 「分析」に切り替えられ、戻せる
await pg.selectOption('#reelStyle','analysis');await pg.waitForTimeout(400);R.analysis=await pg.evaluate(()=>{const c=document.getElementById('reelCanvas').getContext('2d');const p=c.getImageData(60,262,1,1).data;return {style:__reelDebug.style(),motion:__reelDebug.motion(),px:[...p].slice(0,3)}});
ok('analysis_style',R.analysis.style==='analysis'&&R.analysis.motion===null);
await pg.selectOption('#reelStyle','motion');await pg.click('#reelPreview');R.stopped=await pg.evaluate(()=>document.getElementById('reelPreview').getAttribute('aria-pressed'));ok('preview_stop',R.stopped==='false');
// 5. 「動き」で録画（3秒）：書き出しと描いたフレーム数
const dlP=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(()=>__reelDebug.start(3));const dl=await dlP;await pg.waitForTimeout(400);
const st=await pg.evaluate(()=>__reelDebug.state());R.rec={file:dl.suggestedFilename(),frames:st.frames,style:await pg.evaluate(()=>__reelDebug.style())};ok('record_motion',/\.(mp4|webm)$/.test(R.rec.file)&&st.frames>=60&&R.rec.style==='motion');
// 録画の開始時に見た目を指定できる（render_reel の --style）
const dl2P=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(()=>__reelDebug.start(2,{style:'analysis'}));R.optStyle=await pg.evaluate(()=>__reelDebug.style());await dl2P;await pg.evaluate(()=>__reelDebug.setStyle('motion'));ok('start_style_opt',R.optStyle==='analysis');
// 6. 英語表示・画面幅
await pg.click('#langToggle');await pg.waitForTimeout(500);
R.en=await pg.evaluate(()=>{const s=document.getElementById('reelSection');const out=[];const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;const pre=document.getElementById('reelCreditsText');while(n=w.nextNode()){if(pre.contains(n))continue;const t=n.nodeValue.trim();if(t&&/[぀-ヿ一-鿿]/.test(t))out.push(t)}for(const el of s.querySelectorAll('[aria-label]'))if(/[぀-ヿ一-鿿]/.test(el.getAttribute('aria-label')))out.push('@'+el.getAttribute('aria-label'));return {jp:out,opt:document.querySelector('#reelStyle option[value="motion"]').textContent,btn:document.getElementById('reelPreview').textContent}});
ok('english',R.en.jp.length===0&&R.en.opt==='Motion (for reels)'&&R.en.btn==='▶ Preview motion');
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,(k,v)=>k==='boxes'?undefined:v,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
