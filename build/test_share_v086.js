// v0.86 共有リンクの回帰テスト。python3 -m http.server 8765 で本体を配信して実行する。
// 送る側で設定を変えて共有リンクを作り、別の端末（新しいコンテキスト）で開くと同じ設定になること。壊れたリンク・大きすぎるリンクで壊れないこと。英語。はみ出し。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const errs=[];
const APP='http://localhost:8765/index.html';
async function newPage(url){const cx=await b.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});const pg=await cx.newPage();pg.on('pageerror',e=>errs.push(e.message));await pg.goto(url);await pg.waitForTimeout(1500);return {cx,pg}}
const pick=d=>({species:d.species,field:d.field,p:d.p,ecosystem:d.ecosystem,chordIndex:d.chordIndex,tuning:d.tuning,mixer:d.mixer,beatFx:d.beatFx,pedals:d.pedals,rightsMode:d.rightsMode,layers:d.layers});
// 送る側
const A=await newPage(APP+'?lang=ja');
await A.pg.evaluate(()=>{const D=__audioEcosystemDebug,d=D.exportData();const ids=Object.keys(d.species);d.species[ids[0]]={...d.species[ids[0]],enabled:true,level:77};d.species[ids[5]]={...d.species[ids[5]],enabled:true,level:31};
 const f=Object.keys(d.field.levels);d.field.levels[f[0]]=33;d.ecosystem.rate=40;d.chordIndex=2;
 d.pedals={v:2,target:'sampler',chain:[{id:'fuzz',on:true,v:{tone:80}},{id:'shimmer',on:true,v:{mix:70}},{id:'microloop',on:false,v:{len:2}}]};D.applyData(d)});
const before=pick(await A.pg.evaluate(()=>__audioEcosystemDebug.exportData()));
await A.pg.click('#shareLink');await A.pg.waitForTimeout(600);
R.link=await A.pg.evaluate(()=>({url:document.getElementById('shareUrl').value,shown:!document.getElementById('shareOut').hidden,note:document.getElementById('shareNote').textContent}));
R.clip=await A.pg.evaluate(()=>navigator.clipboard.readText().catch(()=>''));
ok('link_made',R.link.shown&&R.link.url.startsWith('http://localhost:8765/#p=z')&&R.clip===R.link.url&&/コピーしました/.test(R.link.note));
R.len=R.link.url.length;ok('link_short_enough',R.len<1200);
// 受け取る側（別の端末）
const B=await newPage(R.link.url.replace('http://localhost:8765/','http://localhost:8765/index.html?lang=ja'));
R.recv=await B.pg.evaluate(()=>({hash:location.hash,banner:!document.getElementById('shareBanner').hidden,msg:document.getElementById('message').textContent,opened:window.__shareOpened}));
const after=pick(await B.pg.evaluate(()=>__audioEcosystemDebug.exportData()));
R.diff=Object.keys(before).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
ok('opened',R.recv.opened===true&&R.recv.banner&&R.recv.hash===''&&/共有された音/.test(R.recv.msg));ok('same_setup',R.diff.length===0);
await B.pg.click('#shareBannerPlay');await B.pg.waitForTimeout(2000);R.play=await B.pg.evaluate(()=>({playing:__audioEcosystemDebug.getState().playing,banner:!document.getElementById('shareBanner').hidden,pedals:__pedals.built()}));
ok('banner_play',R.play.playing===true&&!R.play.banner&&R.play.pedals&&R.play.pedals.target==='sampler'&&R.play.pedals.pedals.join()==='fuzz,reverb,microloop');
await B.cx.close();
// 壊れたリンク・大きすぎるリンク
for(const [k,h] of [['broken','#p=z!!!'],['garbage','#p=zAAAAAAAA'],['plain_bad','#p=j'+Buffer.from('{"p":"x"}').toString('base64url')],['too_big','#p=j'+Buffer.from(JSON.stringify({x:'a'.repeat(300000)})).toString('base64url')]]){
 const C=await newPage(APP+h);R[k]=await C.pg.evaluate(()=>({opened:window.__shareOpened,msg:document.getElementById('message').textContent,banner:!document.getElementById('shareBanner').hidden}));ok(k,R[k].opened===false&&/開けませんでした/.test(R[k].msg)&&!R[k].banner);await C.cx.close()}
// 圧縮爆弾：小さいリンクが 200KB を超えて展開されるもの
{const zlib=require('zlib');const bomb='#p=z'+zlib.deflateRawSync(Buffer.from(JSON.stringify({x:'a'.repeat(5e6)}))).toString('base64url');const C=await newPage(APP+bomb);R.bomb=await C.pg.evaluate(()=>({opened:window.__shareOpened,msg:document.getElementById('message').textContent}));ok('bomb',R.bomb.opened===false&&/大きすぎる/.test(R.bomb.msg));await C.cx.close()}
// リールのクレジットにリンクを足す関数
R.reelLine=await A.pg.evaluate(async()=>(await reelShareLine()).slice(0,30));ok('reel_line',R.reelLine.startsWith('http://localhost:8765/#p='));
// ファイルのプリセットにもペダルが入る
ok('preset_has_pedals',await A.pg.evaluate(()=>{const d=__audioEcosystemDebug.exportData();return d.pedals&&d.pedals.v===2&&d.pedals.chain.map(e=>e.id+(e.on?'+':'-')).join()==='fuzz+,reverb+,microloop-'&&d.pedals.chain[2].v.len===2}));
// 英語
await A.pg.selectOption('#langSelect','en');await A.pg.waitForTimeout(400);
R.en=await A.pg.evaluate(()=>{const s=document.getElementById('presetSection'),bn=document.getElementById('shareBanner');const roots=[s,bn];return {un:__i18n.untranslated().filter(t=>roots.some(r=>r.textContent.includes(t))),btn:document.getElementById('shareLink').textContent,banner:bn.querySelector('span').textContent}});
ok('english',R.en.un.length===0&&R.en.btn==='🔗 Make a share link'&&R.en.banner==='Opened a shared sound setup');
ok('overflow',await A.pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await A.cx.close();
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon/.test(e));ok('no_page_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
