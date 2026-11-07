// v0.56 サンプラー M4 の残り（区間の拡大表示）の回帰テスト（docs/DJ_MIXER_SPEC.md）。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900}});const pg=await ctx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const near=(a,b,e)=>Math.abs(a-b)<=e;
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
await pg.evaluate(()=>document.getElementById('samplerSection').open=true);
const V=()=>pg.evaluate(()=>__samplerDebug.view()),S=()=>pg.evaluate(()=>__samplerDebug.state());
const dis=()=>pg.evaluate(()=>['smpZoomIn','smpZoomOut','smpZoomAll'].map(i=>document.getElementById(i).disabled));
// 1) 読み込み前：ボタンは押せず、表示は「全体」
R.before={view:await V(),dis:await dis()};ok('before_load',R.before.view.label==='表示：全体'&&R.before.dis.every(x=>x));
// 2) 読み込み：全体表示。拡大だけ押せる
await pg.selectOption('#smpSource','recording:forest-leaves');await pg.click('#smpLoad');await pg.waitForFunction(()=>__samplerDebug.state().dur>0,null,{timeout:20000});
const D=(await S()).dur;R.dur=D;R.loaded={view:await V(),dis:await dis()};ok('loaded_full',near(R.loaded.view.a,0,1e-9)&&near(R.loaded.view.b,D,1e-9)&&R.loaded.view.label==='表示：全体'&&JSON.stringify(R.loaded.dis)==='[false,true,true]');
// 3) 全体表示のときは従来どおり（なぞる 20%〜40% → 録音全体の 20%〜40%）
const cv=pg.locator('#smpWave');await cv.scrollIntoViewIfNeeded();let cb=await cv.boundingBox();
const drag=async(f0,f1)=>{cb=await cv.boundingBox();await pg.mouse.move(cb.x+cb.width*f0,cb.y+cb.height/2);await pg.mouse.down();await pg.mouse.move(cb.x+cb.width*f1,cb.y+cb.height/2,{steps:6});await pg.mouse.up()};
await drag(.2,.4);let s=await S();R.dragFull={a:s.start/D,b:s.end/D};ok('drag_full_unchanged',near(R.dragFull.a,.2,.02)&&near(R.dragFull.b,.4,.02));
// 4) 拡大：選んだ区間（2〜4秒）の中心のまわりを 1/2 に
await pg.evaluate(()=>__samplerDebug.setRange(2,4));await pg.click('#smpZoomIn');let v=await V();R.z1=v;
ok('zoom_in_half',near(v.b-v.a,D/2,1e-6)&&v.a<=2&&v.b>=4&&v.label===`表示：${v.a.toFixed(2)}〜${v.b.toFixed(2)}秒（×2.0）`);
for(let i=0;i<4;i++)await pg.click('#smpZoomIn');v=await V();R.z5=v;const w5=D/32;
ok('zoom_in_x32',near(v.b-v.a,w5,1e-6)&&near((v.a+v.b)/2,3,1e-6)&&/（×32\.0）$/.test(v.label));
// 選択は変わらない
s=await S();ok('zoom_keeps_selection',near(s.start,2,1e-9)&&near(s.end,4,1e-9));
// 5) 拡大中のなぞる操作は表示範囲に対して働く（25%〜75% → va+w/4 〜 va+3w/4）
await drag(.25,.75);s=await S();R.dragZoom={start:s.start,end:s.end,va:v.a,w:v.b-v.a};
ok('drag_in_view',near(s.start,v.a+w5*.25,w5*.02)&&near(s.end,v.a+w5*.75,w5*.02));
// 表示範囲は動かない
const v2=await V();ok('drag_keeps_view',near(v2.a,v.a,1e-9)&&near(v2.b,v.b,1e-9));
// 6) つまみも表示範囲に対して働き、もう一方の端は変わらない
const e0=(await S()).end;await pg.evaluate(()=>{const el=document.getElementById('smpStart');el.value='100';el.dispatchEvent(new Event('input'))});s=await S();R.slider={start:s.start,end:s.end};
ok('slider_in_view',near(s.start,v.a+w5*.1,1e-9)&&near(s.end,e0,1e-9));
R.sliderPos=await pg.evaluate(()=>[document.getElementById('smpStart').value,document.getElementById('smpEnd').value]);ok('slider_pos',R.sliderPos[0]==='100'&&Math.abs(+R.sliderPos[1]-750)<=1);
// 7) 細かく選んだ区間をパッドに割り当てると、その長さ（サンプル単位）で切り取られる
await pg.click('#smpAssign');s=await S();const p=s.pads[0];R.assign={len:p&&p.len,expect:p&&Math.round((s.end-s.start)*p.sr)};
ok('assign_precise',p&&Math.abs(p.len-R.assign.expect)<=1&&near(p.start,s.start,1e-6));
// 8) 矢印キーの移動幅は表示範囲の 1/200
await cv.focus();const s0=await S();await pg.keyboard.press('ArrowRight');const s1=await S();R.key={d:s1.start-s0.start,w:w5};ok('arrow_step_view',near(s1.start-s0.start,w5/200,1e-9));
// キー ＋ − 0
await pg.keyboard.press('-');v=await V();ok('key_minus',near(v.b-v.a,w5*2,1e-6));await pg.keyboard.press('+');v=await V();ok('key_plus',near(v.b-v.a,w5,1e-6));
// 9) 縮小は録音の端をこえない・全体に戻る
for(let i=0;i<8;i++)await pg.click('#smpZoomOut').catch(()=>{});v=await V();ok('zoom_out_clamped',near(v.a,0,1e-9)&&near(v.b,D,1e-9)&&v.label==='表示：全体');
await pg.click('#smpZoomIn');await pg.click('#smpZoomIn');await cv.focus();await pg.keyboard.press('0');v=await V();ok('key_zero_all',near(v.b-v.a,D,1e-9));
// 10) 拡大の下限（0.01 秒）と、端に寄せた時のはみ出し防止
await pg.evaluate(()=>{__samplerDebug.setRange(0,.001);for(let i=0;i<20;i++)__samplerDebug.zoom(.5)});v=await V();R.min=v;ok('zoom_min',near(v.b-v.a,.01,1e-9)&&near(v.a,0,1e-9)&&(await dis())[0]===true);
await pg.evaluate(D=>{__samplerDebug.setRange(D-.001,D);__samplerDebug.zoom(.5)},D);v=await V();ok('zoom_edge',near(v.b,D,1e-9)&&v.a>=0);
// 最大拡大でも描画が止まらない（波形の点が描かれる）
R.pixels=await pg.evaluate(()=>{const c=document.getElementById('smpWave'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]===0xd6||d[i]===0x56)n++;return n});ok('draw_at_max_zoom',R.pixels>0);
// 11) 別の録音を読み込むと全体表示に戻る
await pg.evaluate(()=>__samplerDebug.setView(1,.5));await pg.click('#smpLoad');await pg.waitForFunction(()=>/を読み込みました/.test(document.getElementById('smpStatus').textContent),null,{timeout:20000});await pg.waitForTimeout(200);
v=await V();ok('reload_resets_view',near(v.a,0,1e-9)&&near(v.b,(await S()).dur,1e-9));
// 12) 英語表示
await pg.evaluate(()=>__samplerDebug.setView(1,.5));await pg.click('#langToggle');await pg.waitForTimeout(300);
R.en=await pg.evaluate(()=>({in:document.getElementById('smpZoomIn').textContent,out:document.getElementById('smpZoomOut').textContent,all:document.getElementById('smpZoomAll').textContent,view:document.getElementById('smpView').textContent,un:__i18n.untranslated()}));
ok('english',R.en.in==='+ Zoom in'&&R.en.out==='− Zoom out'&&R.en.all==='Show whole'&&/^View: [\d.]+–[\d.]+ s \(×[\d.]+\)$/.test(R.en.view));
await pg.click('#smpZoomAll');await pg.waitForTimeout(300);R.enAll=await pg.textContent('#smpView');ok('english_whole',R.enAll==='View: whole');
await pg.click('#langToggle');await pg.waitForTimeout(300);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
const fs=require('fs'),path=require('path'),html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),src=fs.readFileSync(path.join(__dirname,'src_i18n.js'),'utf8');
const m=html.match(/<script id="ae-i18n">([\s\S]*?)<\/script>/);ok('i18n_source_match',!!m&&m[1].trim()===src.trim());
ok('version',/nature as an instrument\. · v0\.(5[6-9]|[6-9]\d)</.test(html)); // v0.57 以降も通るように
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
