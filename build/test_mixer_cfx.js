// v0.41 ミキサー M3（チャンネルごとの空間系）の回帰テスト（docs/DJ_MIXER_SPEC.md）。python3 -m http.server 8765 で配信して実行する。
// 音の確認は、ページ内の OfflineAudioContext で本番と同じ makeMixLane／applyMixLane に試験信号を通して、サンプル単位で測る。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});await require('./photo_fixture')(pg);const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const T=['space','dub','sweep','crush'];
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
// 画面：各チャンネルに FX つまみ、種類のボタン4つ（既定はリバーブ）
R.ui=await pg.evaluate(()=>({knobs:[...document.querySelectorAll('#mixGrid .mixStrip')].map(s=>!!s.querySelector('[data-k="color"]')),types:[...document.querySelectorAll('#mixCfx button')].map(x=>x.dataset.cfx),pressed:[...document.querySelectorAll('#mixCfx button[aria-pressed="true"]')].map(x=>x.dataset.cfx),val:document.querySelector('#mixGrid [data-ch="bio"] [data-k="color"] .val').textContent}));
ok('ui',R.ui.knobs.length===4&&R.ui.knobs.every(Boolean)&&R.ui.types.join()===T.join()&&R.ui.pressed.join()==='space'&&R.ui.val==='OFF');
const render=o=>pg.evaluate(o=>__mixerDebug.renderColor(o),o);
const maxAbs=a=>a.reduce((m,v)=>Math.max(m,Math.abs(v)),0),energy=a=>a.reduce((m,v)=>m+v*v,0),dif=r=>r.L.map((v,i)=>v-r.inL[i]);
const hf=a=>{let e=0;for(let i=1;i<a.length;i++)e+=(a[i]-a[i-1])**2;return e/energy(a)};
// 1) 中央（既定）では FX を作らず、レーンの出力は M1 と同じ（つまみ0のチャンネルは v0.40 と同じ経路）
R.center={};for(const t of T){const r=await render({type:t,color:0,input:'noise',dur:.4}),ref=await render({type:t,color:0,input:'noise',dur:.4});R.center[t]=r.built;ok('center_'+t,r.built===null&&maxAbs(r.L.map((v,i)=>v-ref.L[i]))<1e-7)}
// 基準：FX なしのレーン出力（EQ のクロスオーバーで位相が回るため、比較はこれと行う）
const base=await render({type:'space',color:0,input:'noise',dur:1});
const vsBase=r=>Math.sqrt(energy(r.L.map((v,i)=>v-base.L[i]))/energy(base.L));
// 2) 4種それぞれ、左右に回すと出力が変わる
R.onDiff={};for(const t of T)for(const x of [-.8,.8]){const r=await render({type:t,color:x,input:'noise',dur:1});const d=vsBase(r);R.onDiff[t+(x<0?'L':'R')]=+d.toFixed(3);ok('on_'+t+(x<0?'L':'R'),r.built===t&&d>.05&&r.L.every(Number.isFinite))}
// 3) 回してから中央に戻すと元に戻る（スイープ・クラッシュはすぐ、リバーブ・ダブエコーは余韻が自然に消える）
R.back={};
const base4=await render({type:'space',color:0,input:'noise',dur:4});
for(const t of T){const r=await render({type:t,color:.8,colorAt:[.5,0],input:'noise',dur:4});const d=r.L.map((v,i)=>v-base4.L[i]);
 const early=energy(d.slice(24000,48000)),after=energy(d.slice(26400,48000)),late=energy(d.slice(168000)),before=energy(d.slice(0,24000));
 R.back[t]={before:+before.toFixed(3),afterImmediate:+after.toExponential(2),late:+late.toExponential(2)};
 if(t==='sweep'||t==='crush')ok('back_'+t,before>1&&after<1e-6);else ok('back_'+t,before>.05&&late<before*.02)}
// 4) 左右で効き方が違う
// リバーブ：左は短い残響、右は長い残響（0.2秒のノイズの後、残響が 1e-3 を下回るまでの長さ）
const tail=r=>{let last=0;const d=dif(r);for(let i=0;i<d.length;i++)if(Math.abs(d[i])>1e-3)last=i;return last/48000};
const sL=await render({type:'space',color:-.8,input:'burst',dur:4}),sR=await render({type:'space',color:.8,input:'burst',dur:4});R.spaceTail=[+tail(sL).toFixed(2),+tail(sR).toFixed(2)];ok('space_sides',R.spaceTail[0]<1.2&&R.spaceTail[1]>2&&R.spaceTail[1]<3.4);
// ダブエコー（120BPM＝1拍0.5秒）：左は 0.25秒（12000サンプル）、右は 0.375秒（18000）ごとに繰り返す。1回目の大きさ＝送りの量
const a8=await pg.evaluate(()=>__mixerDebug.colorAmt(.8));const peakAt=(a,i)=>maxAbs(a.slice(i-300,i+300));
const dL=await render({type:'dub',color:-.8,input:'impulse',dur:1.2}),dR=await render({type:'dub',color:.8,input:'impulse',dur:1.2});
const d0L=maxAbs(dL.L.slice(0,600)),d0R=maxAbs(dR.L.slice(0,600));// 直接音のピーク（EQ のクロスオーバーでインパルスが少し広がるため、1回目の繰り返しはこれとの比で見る）
R.dub={amt:+a8.toFixed(4),L12k:+(peakAt(dL.L,12000)/d0L).toFixed(3),L18k:+(peakAt(dL.L,18000)/d0L).toFixed(3),R18k:+(peakAt(dR.L,18000)/d0R).toFixed(3),R12k:+(peakAt(dR.L,12000)/d0R).toFixed(3),R36k:+(peakAt(dR.L,36000)/d0R).toFixed(3)};
ok('dub_sides',Math.abs(R.dub.L12k-a8)<.08&&R.dub.L18k<.02&&Math.abs(R.dub.R18k-a8)<.08&&R.dub.R12k<.02&&R.dub.R36k>.05&&R.dub.R36k<R.dub.R18k);
// スイープ：左いっぱいは低い帯域（約60Hz）、右いっぱいは高い帯域（約16kHz）だけを通す（高域の割合で比べる）
const wL=await render({type:'sweep',color:-1,input:'noise',dur:.5}),wR=await render({type:'sweep',color:1,input:'noise',dur:.5});R.sweepHf=[+hf(wL.L).toFixed(4),+hf(wR.L).toFixed(4),+hf(base.L).toFixed(4)];ok('sweep_sides',R.sweepHf[1]>R.sweepHf[0]*20&&R.sweepHf[0]<R.sweepHf[2]);
// クラッシュ：いっぱいで3ビット（1/4 刻みの段）・6サンプル保持、原音とは入れ替わる。左右で同じ
const c1=await render({type:'crush',color:1,input:'tone',dur:.25}),c0=await render({type:'crush',color:-1,input:'tone',dur:.25});let g=0,h=0;for(let i=600;i<12000;i++){if(Math.abs(c1.L[i]*4-Math.round(c1.L[i]*4))<1e-3)g++;if(Math.abs(c1.L[i]-c1.L[i-(i%6)])<1e-6)h++}
R.crush={grid:+(g/11400).toFixed(3),hold:+(h/11400).toFixed(3),lr:maxAbs(c1.L.map((v,i)=>v-c0.L[i]))};ok('crush_full',R.crush.grid>.95&&R.crush.hold>.99&&R.crush.lr<1e-6);
// 5) いっぱいに回しても発散しない（ダブエコーの帰還 62%）：ノイズ3秒の後半のピークが前半の2倍未満
R.maxFb={};for(const x of [-1,1]){const r=await render({type:'dub',color:x,input:'noise',dur:3});const a=maxAbs(r.L.slice(0,72000)),c=maxAbs(r.L.slice(72000));R.maxFb[x]={first:+a.toFixed(3),second:+c.toFixed(3)};ok('maxfb_'+x,Number.isFinite(c)&&c<a*2)}
// 6) 実演奏：環境音の FX つまみを回す → 環境音のレーンにだけ差し込まれ、マスターのピークは 0dBFS 以下。種類を切り替えると作り直す
await pg.evaluate(()=>document.getElementById('mixerSection').open=true);
await pg.click('#play');await pg.waitForTimeout(6000);
R.live={};for(const t of T){await pg.click('#mixCfx [data-cfx="'+t+'"]');await pg.evaluate(()=>__mixerDebug.set('field','color',.9));let mx=-Infinity;for(let i=0;i<10;i++){mx=Math.max(mx,await pg.evaluate(()=>__mixerDebug.peakDb('master')));await pg.waitForTimeout(60)}
 const st=await pg.evaluate(()=>__mixerDebug.cfx());R.live[t]={peak:+mx.toFixed(2),field:st.built.field,others:['bio','music','sampler'].map(c=>(st.built[c]||[]).length).reduce((a,b)=>a+b,0),pressed:await pg.evaluate(()=>[...document.querySelectorAll('#mixCfx button[aria-pressed="true"]')].map(x=>x.dataset.cfx).join())}}
ok('live',Object.entries(R.live).every(([t,v])=>v.peak<=0&&v.field.length>=2&&v.field.every(k=>k.endsWith(':'+t))&&v.others===0&&v.pressed===t));
// 左いっぱい（−1）も 0dBFS 以下
await pg.click('#mixCfx [data-cfx="dub"]');await pg.evaluate(()=>{for(const c of ['bio','field','music'])__mixerDebug.set(c,'color',-1)});let mx2=-Infinity;for(let i=0;i<20;i++){mx2=Math.max(mx2,await pg.evaluate(()=>__mixerDebug.peakDb('master')));await pg.waitForTimeout(60)}R.liveAllMax=+mx2.toFixed(2);ok('live_all_max',mx2<=0);
// BEAT FX のテンポを変えるとダブエコーの間隔が追従する（BEAT FX と同時に使える）
await pg.fill('#fxBpm','100');await pg.locator('#fxBpm').dispatchEvent('change');R.dubSec=await pg.evaluate(()=>__mixerDebug.cfx().dubSec);ok('dub_follows_bpm',Math.abs(R.dubSec-.3)<1e-9);
await pg.click('#fxTypes [data-type="delay"]');await pg.click('#fxOn');await pg.waitForTimeout(400);R.withBeatFx=await pg.evaluate(()=>({fx:__fxDebug.state().inserted.join(),cfx:__mixerDebug.cfx().built.field.length}));ok('with_beat_fx',R.withBeatFx.fx==='master'&&R.withBeatFx.cfx>=2);await pg.click('#fxOn');
// 7) 操作：キーボード（Home＝左いっぱい、Delete＝中央）、ダブルタップ相当、初期化
const kn=pg.locator('#mixGrid [data-ch="bio"] [data-k="color"]');await kn.scrollIntoViewIfNeeded();await kn.focus();await pg.keyboard.press('Home');
R.kbd={v:await pg.evaluate(()=>__mixerDebug.state().ch.bio.color),text:await kn.getAttribute('aria-valuetext')};await pg.keyboard.press('Delete');R.kbd.reset=await pg.evaluate(()=>__mixerDebug.state().ch.bio.color);ok('keyboard',R.kbd.v===-1&&R.kbd.text==='L 100'&&R.kbd.reset===0);
await pg.click('#mixReset');R.reset=await pg.evaluate(()=>Object.values(__mixerDebug.state().ch).every(s=>s.color===0));ok('reset',R.reset);
// 中央に戻したチャンネルは差し込みが残っても原音のまま（実演奏でエラーなし）
// 8) 英語表示・画面幅・エラー
await pg.click('#langToggle');await pg.waitForTimeout(400);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.en=await pg.evaluate(()=>({btn:[...document.querySelectorAll('#mixCfx button')].map(b=>b.textContent).join(),aria:document.querySelector('#mixGrid [data-ch="field"] [data-k="color"]').getAttribute('aria-label')}));ok('english',R.en.btn==='Reverb,Dub echo,Sweep,Crush'&&R.en.aria==='Ambience FX');
await pg.click('#langToggle');
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
