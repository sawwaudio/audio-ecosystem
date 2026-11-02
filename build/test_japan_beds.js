// v0.25 日本録音の環境層（4本）の回帰テスト。python3 -m http.server 8765 で配信して実行する。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const NEW=['kashiwa-insects','bamboo-stream','ricefield-frogs','kyoto-rain'];
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
R.controls=await pg.evaluate(()=>[...document.querySelectorAll('#fieldControls input')].map(i=>i.id));ok('field_controls',R.controls.length===31&&NEW.every(id=>R.controls.includes('field-'+id)));
await pg.click('#play');await pg.waitForTimeout(3000);
// PCM・互換MP3の両方で4本を1本ずつデコード
for(const mode of ['pcm','compat']){await pg.selectOption('#sourceMode',mode);for(const id of NEW){const d=await pg.evaluate(async id=>{try{const buf=await __bioDebug.loadOne(id);return {ok:true,dur:buf.duration,ch:buf.numberOfChannels}}catch(e){return {ok:false,e:e.message}}},id);R[mode+':'+id]=d;ok(mode+'_'+id,d.ok&&Math.abs(d.dur-45)<0.2&&d.ch===(mode==='pcm'?2:1))}}
await pg.selectOption('#sourceMode','pcm');
// 地域フィルター：日本で録音 → 4本の環境層が鳴る（他地域の環境層は鳴らない）
const g=await pg.evaluate(()=>__geoDebug.apply({region:'japan',basis:'recorded',habitat:'any',time:'any',role:'any'}));R.geoFields=g.fields;
ok('geo_jp_beds',NEW.every(id=>g.fields[id]>0)&&['river-esk','forest-leaves','forest-wind','rain-field','fire-field'].every(id=>g.fields[id]===0));
await pg.waitForTimeout(7000);
R.playing=await pg.evaluate(()=>[...new Set(__bioDebug.decoded().map(d=>d.id))]);R.fieldStatus=await pg.textContent('#fieldStatus');
// v0.26 以降は同時に鳴る環境層が4層まで（順番に入れ替え）で、待機中の層のPCMはLRUで解放されうる。そのため「4本すべてがいまデコード済み」ではなく、
// 4本がすべて鳴らす対象に入り、いま鳴っている環境層が日本録音の層だけであることを確かめる（v0.31 で修正。自律演奏の生物の選び方によって不定に失敗していた）。
R.fieldNow=await pg.evaluate(()=>__rightsDebug.active().field);R.fieldOn=await pg.evaluate(()=>__rightsDebug.fieldOn());
ok('beds_sounding',['柏','竹林','水田','京都'].every(k=>R.fieldStatus.includes(k))&&NEW.every(id=>R.fieldOn.includes(id))&&R.fieldNow.length>=3&&R.fieldNow.every(id=>R.fieldOn.includes(id))&&NEW.some(id=>R.fieldNow.includes(id)));
R.signal=await pg.evaluate(()=>__bioDebug.signal());ok('nonsilent',R.signal.rms>1e-4);
R.mem=await pg.evaluate(()=>__bioDebug.stats());ok('memory_budget',R.mem.pcmBytes<=R.mem.pcmBudget);
// 夜×日本録音 → 水田のカエルと京都の雨だけ
const n=await pg.evaluate(()=>__geoDebug.apply({region:'japan',basis:'recorded',habitat:'any',time:'night',role:'any'}));R.night=Object.entries(n.fields).filter(([,v])=>v>0).map(([k])=>k);
ok('night_beds',R.night.includes('ricefield-frogs')&&R.night.includes('kyoto-rain')&&!R.night.includes('bamboo-stream')&&!R.night.includes('kashiwa-insects'));
// ヨーロッパ録音 → 日本の環境層は鳴らない
const e=await pg.evaluate(()=>__geoDebug.apply({region:'europe',basis:'recorded',habitat:'any',time:'any',role:'any'}));ok('no_leak_europe',NEW.every(id=>e.fields[id]===0));
await pg.evaluate(()=>__geoDebug.apply({region:'off'}));
// 英語表示で未翻訳なし
await pg.click('#langToggle');await pg.waitForTimeout(300);const un=(await pg.evaluate(()=>__i18n.untranslated())).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.fieldSmallEn=await pg.evaluate(()=>[...document.querySelectorAll('#fieldControls small')].slice(5).map(s=>s.textContent));
await pg.click('#langToggle');ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
