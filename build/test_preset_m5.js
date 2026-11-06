// v0.44 ミキサー M5 第1段階（ミキサー・BEAT FX・チャンネルFX・サンプラーの設定をプリセットに保存）の回帰テスト（docs/DJ_MIXER_SPEC.md）。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
// 1) 設定を作る：ミキサー・マスター EQ・チャンネルFX・BEAT FX・サンプラーのパッド2個（CC0 の森の葉／CC BY のアブラゼミ）
await pg.evaluate(()=>document.getElementById('samplerSection').open=true);
await pg.click('#play');await pg.waitForTimeout(3000);
const loadPad=async(key,a,z,mode,rev,pitch,i)=>{await pg.selectOption('#smpSource',key);await pg.click('#smpLoad');await pg.waitForFunction(k=>__samplerDebug.state().src===k&&__samplerDebug.state().dur>0,key,{timeout:20000});
 await pg.evaluate(([a,z])=>__samplerDebug.setRange(a,z),[a,z]);await pg.selectOption('#smpPadSel',String(i));await pg.selectOption('#smpMode',mode);await pg.setChecked('#smpReverse',rev);await pg.evaluate(v=>{const el=document.getElementById('smpPitch');el.value=String(v);el.dispatchEvent(new Event('input'))},pitch);await pg.click('#smpAssign')};
await loadPad('recording:forest-leaves',2,4,'loop',true,3,0);await loadPad('recording:cicada',1,2.5,'oneshot',false,-5,2);
await pg.evaluate(()=>{const M=__mixerDebug;M.set('field','low',0);M.set('bio','fader',.5);M.set('music','mute',true);M.set('field','trim',-3);M.set('master','hi',.8);M.setCfx('dub');M.set('field','color',-.6);
 const F=__fxDebug;F.set('type','gate');F.set('param',30);F.set('type','delay');F.set('param',20);F.set('type','gate');F.set('beats',1);F.set('target','field');F.set('bpm',128);F.set('depth',.7);F.set('on',true)});
const sumsA=await pg.evaluate(()=>[0,2].map(i=>__presetDebug.padSum(i)));
const before=await pg.evaluate(()=>({mix:__mixerDebug.state(),fx:__fxDebug.state(),smp:__samplerDebug.state()}));
// 2) 書き出し（ボタン → ダウンロード）
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#exportPreset')]);const raw=require('fs').readFileSync(await dl.path(),'utf8'),J=JSON.parse(raw);
R.export={bytes:raw.length,cfx:J.mixer?.cfx,fieldLow:J.mixer?.ch?.field?.low,musicMute:J.mixer?.ch?.music?.mute,masterHi:J.mixer?.master?.hi,fx:J.beatFx,pads:J.sampler?.pads,rightsIds:J.rights?.sources?.map(s=>s.id),msg:await pg.textContent('#message')};
ok('export_mixer',J.mixer.cfx==='dub'&&J.mixer.ch.field.low===0&&J.mixer.ch.bio.fader===.5&&J.mixer.ch.music.mute===true&&J.mixer.ch.field.trim===-3&&J.mixer.ch.field.color===-.6&&J.mixer.master.hi===.8);
ok('export_fx',J.beatFx.type==='gate'&&J.beatFx.beats===1&&J.beatFx.target==='field'&&J.beatFx.bpm===128&&J.beatFx.depth===.7&&J.beatFx.params.gate===30&&J.beatFx.params.delay===20&&!('on' in J.beatFx)&&!('held' in J.beatFx));
ok('export_pads',J.sampler.pads.length===8&&J.sampler.pads[0].src.id==='forest-leaves'&&J.sampler.pads[0].start===2&&J.sampler.pads[0].end===4&&J.sampler.pads[0].mode==='loop'&&J.sampler.pads[0].reverse===true&&J.sampler.pads[0].pitch===3&&J.sampler.pads[2].src.id==='cicada'&&J.sampler.pads[2].pitch===-5&&J.sampler.pads[1]===null&&!/"buf"|"rev"/.test(raw));
ok('export_rights',R.export.rightsIds.includes('forest-leaves')&&R.export.rightsIds.includes('cicada')&&J.rights.sources.find(s=>s.id==='cicada').attributionRequired===true);
ok('export_size',raw.length<100000);ok('export_msg',/ミキサー・エフェクト・サンプラーの設定を含みます（パッド2個。音声は含めず、読み込み時に元の録音から切り取ります）。/.test(R.export.msg));
// 3) 新しいページで読み込み（ファイル選択）→ すべて復元・エフェクトはオンにならない・パッドは元の録音から同じサンプルで切り直し
await pg.reload();await pg.waitForTimeout(800);await pg.evaluate(()=>document.getElementById('samplerSection').open=true);
await pg.setInputFiles('#presetFile',{name:'p.json',mimeType:'application/json',buffer:Buffer.from(raw)});
await pg.waitForFunction(()=>/^サンプラーのパッド\d+個を読み込みました。/.test(document.getElementById('smpStatus').textContent),null,{timeout:30000});
const after=await pg.evaluate(()=>({mix:__mixerDebug.state(),fx:__fxDebug.state(),smp:__samplerDebug.state(),msg:document.getElementById('message').textContent,status:document.getElementById('smpStatus').textContent,sums:[0,2].map(i=>__presetDebug.padSum(i)),label:document.querySelector('#smpPads [data-pad="0"] .nm').textContent,md:document.querySelector('#smpPads [data-pad="0"] .md').textContent,idle:document.querySelector('#mixGrid [data-ch="sampler"]').classList.contains('idle'),cfxPressed:document.querySelector('#mixCfx [data-cfx="dub"]').getAttribute('aria-pressed'),fxPressed:document.querySelector('#fxTypes [data-type="gate"]').getAttribute('aria-pressed')}));
R.import={msg:after.msg,status:after.status,sums:after.sums,sumsA,label:after.label,md:after.md};
ok('import_mixer',JSON.stringify(after.mix)===JSON.stringify(before.mix)&&after.cfxPressed==='true');
ok('import_fx',['type','beats','target','bpm','depth'].every(k=>after.fx[k]===before.fx[k])&&JSON.stringify(after.fx.params)===JSON.stringify(before.fx.params)&&after.fx.on===false&&after.fx.engaged===false&&after.fxPressed==='true');
const padEq=i=>{const x=before.smp.pads[i],y=after.smp.pads[i];return x&&y&&['src','len','sr','mode','reverse','pitch','fade','quant'].every(k=>x[k]===y[k])};
ok('import_pads',padEq(0)&&padEq(2)&&after.smp.pads.filter(Boolean).length===2&&after.sums[0]===sumsA[0]&&after.sums[1]===sumsA[1]&&after.label==='森の葉擦れ・落葉'&&after.md==='ループ · REV · +3'&&!after.idle);
ok('import_msg',after.msg.includes('ミキサー・エフェクトの設定を読み込みました（エフェクトのオン／オフは変えません）。')&&after.msg.includes('サンプラーのパッド2個を元の録音から読み込みます。')&&after.status==='サンプラーのパッド2個を読み込みました。');
// 読み込んだパッドを鳴らす（サンプラーチャンネルに音が出る）
await pg.click('#play');await pg.waitForTimeout(1500);const pad=i=>pg.locator('#smpPads [data-pad="'+i+'"]');await pad(0).scrollIntoViewIfNeeded();await pad(0).click();await pg.waitForTimeout(250);
let pk=-Infinity;for(let i=0;i<12;i++){pk=Math.max(pk,await pg.evaluate(()=>__mixerDebug.peakDb('sampler')));await pg.waitForTimeout(50)}R.padPeak=pk;ok('import_pad_plays',pk>-70);await pad(0).click();
// 4) 商用モード「CC0 のみ」で読み込むと、CC BY のパッドは読み込まない（代用しない）
await pg.selectOption('#rightsMode','cc0');await pg.waitForTimeout(200);
await pg.setInputFiles('#presetFile',{name:'p.json',mimeType:'application/json',buffer:Buffer.from(raw)});
await pg.waitForFunction(()=>/^サンプラーのパッド\d+個を読み込みました。/.test(document.getElementById('smpStatus').textContent),null,{timeout:30000});
R.cc0=await pg.evaluate(()=>({pads:__samplerDebug.state().pads.map(p=>p&&p.src),status:document.getElementById('smpStatus').textContent,mode:__rightsDebug.mode}));
ok('cc0_blocked',R.cc0.mode==='cc0'&&R.cc0.pads[0]==='recording:forest-leaves'&&R.cc0.pads[2]===null&&R.cc0.status==='サンプラーのパッド1個を読み込みました。パッド1個は商用モードの対象外のため読み込みませんでした（代用しません）。');
// 録音が見つからないパッド
const J2=JSON.parse(raw);J2.sampler.pads[5]={...J2.sampler.pads[0],src:{kind:'recording',id:'no-such-recording'}};
await pg.evaluate(d=>__presetDebug.apply(d),J2);await pg.waitForFunction(()=>/^サンプラーのパッド\d+個を読み込みました。/.test(document.getElementById('smpStatus').textContent),null,{timeout:30000});
R.missing=await pg.textContent('#smpStatus');ok('missing',R.missing==='サンプラーのパッド1個を読み込みました。パッド1個は商用モードの対象外のため読み込みませんでした（代用しません）。パッド1個は録音が見つからないため読み込みませんでした。');
await pg.selectOption('#rightsMode','all');await pg.waitForTimeout(200);
// 5) 不正な値は拒否して何も変えない／旧形式（項目なし）はいまの設定のまま
const snap=()=>pg.evaluate(()=>JSON.stringify([__mixerDebug.state(),__fxDebug.state().params,__fxDebug.state().type,__samplerDebug.state().pads.map(p=>p&&p.src)]));const s0=await snap();
const bad=async f=>pg.evaluate(([d,f])=>{const x=JSON.parse(d);new Function('x',f)(x);try{__presetDebug.apply(x);return 'accepted'}catch(e){return e.message}},[raw,f]);
R.bad={trim:await bad("x.mixer.ch.bio.trim='9'"),cfx:await bad("x.mixer.cfx='wah'"),type:await bad("x.beatFx.type='chorus'"),beats:await bad("x.beatFx.beats=3"),long:await bad("x.sampler.pads[0].end=x.sampler.pads[0].start+20"),mode:await bad("x.sampler.pads[0].mode='gate'"),many:await bad("x.sampler.pads.push(null)")};
const s1=await snap();ok('reject_invalid',R.bad.trim==='不正なミキサー設定: bio.trim'&&R.bad.cfx==='不正なミキサー設定: cfx'&&R.bad.type==='不正なエフェクト設定: type'&&R.bad.beats==='不正なエフェクト設定: beats'&&R.bad.long==='不正なサンプラー設定: パッド1'&&R.bad.mode==='不正なサンプラー設定: パッド1'&&R.bad.many==='不正なサンプラー設定'&&s0===s1);
const old=JSON.parse(raw);delete old.mixer;delete old.beatFx;delete old.sampler;R.oldNotes=await pg.evaluate(d=>__presetDebug.apply(d),old);await pg.waitForTimeout(300);ok('old_format_keeps',(await snap())===s0&&!R.oldNotes.some(n=>/ミキサー|サンプラー/.test(n)));
// 範囲外の数値は丸める（例外にしない）
const clampP=JSON.parse(raw);clampP.mixer.ch.bio.trim=50;clampP.beatFx.bpm=999;clampP.beatFx.params.gate=5;await pg.evaluate(d=>__presetDebug.apply(d),clampP);await pg.waitForTimeout(300);
R.clamp=await pg.evaluate(()=>({trim:__mixerDebug.state().ch.bio.trim,bpm:__fxDebug.state().bpm,gate:__fxDebug.state().params.gate}));ok('clamp',R.clamp.trim===9&&R.clamp.bpm===200&&R.clamp.gate===10);
// 6) 英語表示・画面幅・エラー
await pg.setInputFiles('#presetFile',{name:'p.json',mimeType:'application/json',buffer:Buffer.from(raw)});await pg.waitForFunction(()=>/^サンプラーのパッド\d+個を読み込みました。/.test(document.getElementById('smpStatus').textContent),null,{timeout:30000});
await pg.click('#langToggle');await pg.waitForTimeout(500);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.en={msg:await pg.textContent('#message'),status:await pg.textContent('#smpStatus')};
await pg.evaluate(()=>{try{__presetDebug.apply({...__presetDebug.exportData(),mixer:{cfx:'wah'}})}catch(e){document.getElementById('message').textContent='読み込み失敗: '+e.message}});await pg.waitForTimeout(300);R.en.err=await pg.textContent('#message');
ok('english',R.en.msg.includes('Loaded mixer and effect settings (effect on/off is unchanged).')&&R.en.msg.includes('Loading 2 sampler pad(s) from the original recordings.')&&R.en.status==='Loaded 2 sampler pad(s).'&&R.en.err==='Load failed: Invalid mixer setting: cfx');
await pg.click('#langToggle');await pg.waitForTimeout(300);ok('back_ja',(await pg.textContent('#smpStatus'))==='サンプラーのパッド2個を読み込みました。');
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
