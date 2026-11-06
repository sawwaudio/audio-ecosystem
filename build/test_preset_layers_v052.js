// v0.52 層の設定（合成音を鳴らさない・合成音の密度・楽器の密度）をプリセットに保存する機能の回帰テスト（バックログ C の残り②）。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const wait=ms=>pg.waitForTimeout(ms);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{['saww.synthOff','saww.boost','ae-lang'].forEach(k=>localStorage.removeItem(k))}catch(e){}});await pg.reload();await wait(900);
const state=()=>pg.evaluate(()=>({off:__synthOff.get(),s:__boostOf('bells'),i:__boostOf('kalimba'),sv:document.getElementById('synthBoost').value,iv:document.getElementById('instrBoost').value,
 sl:document.getElementById('synthBoostV').textContent,il:document.getElementById('instrBoostV').textContent,chk:document.getElementById('synthOff').checked,badge:!document.getElementById('synthOffBadge').hidden,
 ls:localStorage.getItem('saww.boost'),lo:localStorage.getItem('saww.synthOff')}));
const slide=(id,v)=>pg.evaluate(([id,v])=>{const e=document.getElementById(id);e.value=String(v);e.dispatchEvent(new Event('input'))},[id,v]);

// 1. 既定の書き出し：layers が入る
R.ex0=await pg.evaluate(()=>__presetDebug.exportData().layers);
ok('export_default',R.ex0&&R.ex0.synthOff===false&&R.ex0.synthBoost===1&&R.ex0.instrBoost===1);
// 2. 設定を変えて書き出す
await pg.evaluate(()=>__synthOff.set(true));await slide('synthBoost',150);await slide('instrBoost',250);
const preset=await pg.evaluate(()=>__presetDebug.exportData());R.ex1=preset.layers;
ok('export_changed',R.ex1.synthOff===true&&R.ex1.synthBoost===1.5&&R.ex1.instrBoost===2.5);
// JSON で往復しても同じ
ok('json_roundtrip',JSON.stringify(JSON.parse(JSON.stringify(preset)).layers)===JSON.stringify(R.ex1));
// 3. 既定に戻してから読み込む：値・画面・保存・お知らせ
await pg.evaluate(()=>__synthOff.set(false));await slide('synthBoost',100);await slide('instrBoost',100);
R.notes=await pg.evaluate(p=>__presetDebug.apply(JSON.parse(JSON.stringify(p))),preset);await wait(200);R.st1=await state();
ok('apply',R.st1.off&&R.st1.s===1.5&&R.st1.i===2.5&&R.st1.sv==='150'&&R.st1.iv==='250'&&R.st1.sl==='150%'&&R.st1.il==='250%'&&R.st1.chk&&R.st1.badge&&R.st1.ls==='{"s":1.5,"i":2.5}'&&R.st1.lo==='1');
ok('apply_note',R.notes.includes('合成音を鳴らさない設定（楽器は実録音だけ）を読み込みました。'));
// 合成音を鳴らす設定のプリセットではお知らせを出さず、切に戻す
const p2=JSON.parse(JSON.stringify(preset));p2.layers={synthOff:false,synthBoost:1,instrBoost:1};R.notes2=await pg.evaluate(p=>__presetDebug.apply(p),p2);R.st2=await state();
ok('apply_off',!R.st2.off&&!R.st2.chk&&!R.st2.badge&&R.st2.s===1&&R.st2.i===1&&R.st2.lo==='0'&&!R.notes2.some(n=>/合成音を鳴らさない/.test(n)));
// 4. layers のない古いプリセット：いまの設定を変えない
await pg.evaluate(()=>__synthOff.set(true));await slide('synthBoost',200);
const old=JSON.parse(JSON.stringify(preset));delete old.layers;await pg.evaluate(p=>__presetDebug.apply(p),old);R.st3=await state();
ok('old_preset_keeps',R.st3.off&&R.st3.s===2&&R.st3.i===1);
// 一部だけの layers：書かれた項目だけ変える
const part=JSON.parse(JSON.stringify(preset));part.layers={instrBoost:3};await pg.evaluate(p=>__presetDebug.apply(p),part);R.st4=await state();
ok('partial',R.st4.off&&R.st4.s===2&&R.st4.i===3&&R.st4.iv==='300');
// 5. 範囲外は丸める（0.5〜4、10% 刻み）
const cl=JSON.parse(JSON.stringify(preset));cl.layers={synthOff:false,synthBoost:9,instrBoost:.12};await pg.evaluate(p=>__presetDebug.apply(p),cl);R.st5=await state();
ok('clamp',R.st5.s===4&&R.st5.i===.5&&R.st5.sv==='400'&&R.st5.iv==='50');
const rd=JSON.parse(JSON.stringify(preset));rd.layers={synthBoost:1.27};await pg.evaluate(p=>__presetDebug.apply(p),rd);R.st5b=await state();ok('round',R.st5b.s===1.3&&R.st5b.sv==='130');
// 6. 不正な layers は読み込みを止め、何も変えない
const before=await state();R.bad=[];
for(const L of [{synthOff:'yes'},{synthBoost:'2'},{instrBoost:null},[1],'x',null]){const bad=JSON.parse(JSON.stringify(preset));bad.layers=L;bad.p.volume=11;
 R.bad.push(await pg.evaluate(p=>{try{__presetDebug.apply(p);return 'applied'}catch(e){return e.message}},bad))}
const after=await state();const vol=await pg.evaluate(()=>__presetDebug.exportData().p.volume);
ok('invalid',R.bad.every(m=>m==='不正な層の設定')&&JSON.stringify(before)===JSON.stringify(after)&&vol!==11);
// 7. 読み直しても残る（localStorage 経由）
await pg.reload();await wait(900);R.st6=await state();ok('reload',R.st6.s===1.3&&R.st6.sv==='130'&&R.st6.i===.5);
// 8. 英語表示：お知らせとエラーの英訳・未翻訳0
await pg.click('#langToggle');await wait(400);
R.en=await pg.evaluate(()=>[__i18n.t('合成音を鳴らさない設定（楽器は実録音だけ）を読み込みました。'),__i18n.t('不正な層の設定')]);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;
ok('english',R.en[0]==='Loaded the “mute synth sounds” setting (instruments from real recordings only).'&&R.en[1]==='Invalid layer setting');ok('no_untranslated',un.length===0);
await pg.click('#langToggle');await wait(300);
// 9. 390px・i18n の一致・エラー0
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
const fs=require('fs');const html=fs.readFileSync(__dirname+'/../index.html','utf8'),i18n=fs.readFileSync(__dirname+'/src_i18n.js','utf8');
const tag='<script id="ae-i18n">',ia=html.indexOf(tag)+tag.length,ib=html.indexOf('</script>',ia);ok('i18n_parity',html.slice(ia,ib)===i18n);
await pg.evaluate(()=>{try{['saww.synthOff','saww.boost','ae-lang'].forEach(k=>localStorage.removeItem(k))}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
