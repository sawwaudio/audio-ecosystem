// v0.60 DJ ミキサー M5 の残り（MIDI 出力：機器のランプ）の回帰テスト（docs/DJ_MIXER_SPEC.md）。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。MIDI 機器は navigator.requestMIDIAccess の差し替えで模擬する。
// 入力「Test Pad」と、同じ名前の出力（ランプ用）・別名の出力「Other Synth」（送ってはいけない）を用意する。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
const mock=()=>{const inp={id:'in-1',name:'Test Pad',state:'connected',onmidimessage:null};
 const log={pad:[],synth:[]};const out1={id:'out-1',name:'Test Pad',state:'connected',send:d=>log.pad.push([...d])};const out2={id:'out-2',name:'Other Synth',state:'connected',send:d=>log.synth.push([...d])};
 const acc={inputs:new Map([['in-1',inp]]),outputs:new Map([['out-1',out1],['out-2',out2]]),onstatechange:null};
 window.__midiMock={log,send:(...d)=>{if(inp.onmidimessage)inp.onmidimessage({data:new Uint8Array(d)})}};
 Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:()=>Promise.resolve(acc)})};
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);await pg.addInitScript(mock);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const wait=ms=>pg.waitForTimeout(ms),send=(...d)=>pg.evaluate(d=>__midiMock.send(...d),d);
const log=()=>pg.evaluate(()=>JSON.parse(JSON.stringify(__midiMock.log))),clr=()=>pg.evaluate(()=>{__midiMock.log.pad.length=0;__midiMock.log.synth.length=0});
const dclick=sel=>pg.evaluate(s=>document.querySelector(s).click(),sel),setOut=v=>pg.evaluate(v=>{const c=document.getElementById('midiOut');if(c.checked!==v){c.checked=v;c.dispatchEvent(new Event('change'))}},v);
const has=(arr,m)=>arr.some(x=>x.length===3&&x[0]===m[0]&&x[1]===m[1]&&x[2]===m[2]);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-midi');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await wait(900);
await pg.evaluate(()=>{document.getElementById('mixerSection').open=true;document.getElementById('samplerSection').open=true});
R.ver=await pg.evaluate(()=>document.querySelector('.tagline').textContent);ok('version',/v0\.60/.test(R.ver));
ok('checkbox_default_off',await pg.evaluate(()=>{const c=document.getElementById('midiOut');return !!c&&!c.checked&&__midi.out===false}));
// 割り当て（学習は test_midi で確かめ済みなので、ここでは直接入れる）：ノート36→FX オン／オフ、37→パッド1、38→押している間だけ、CC20→生き物の MUTE、CC7→生き物のフェーダー（連続値：ランプは送らない）
await pg.evaluate(()=>{Object.assign(__midi.maps,{'note:1:36':{t:'btn',sel:'#fxOn'},'note:1:37':{t:'pad',i:0},'note:1:38':{t:'hold'},'cc:1:20':{t:'btn',sel:'#mixGrid [data-ch="bio"] [data-k="mute"]'},'cc:2:7':{t:'mix',ch:'bio',k:'fader'}});__midi.render()});
await dclick('#midiConnect');await wait(400);
let L=await log();R.offSends=L.pad.length+L.synth.length;ok('nothing_sent_when_off',R.offSends===0);
// 入れる：いまの状態をまとめて送る（すべて消灯）。別名の出力には送らない。連続値の割り当てには送らない
await setOut(true);await wait(250);L=await log();R.initial=L;
ok('initial_state',has(L.pad,[0x90,36,0])&&has(L.pad,[0x90,37,0])&&has(L.pad,[0x90,38,0])&&has(L.pad,[0xB0,20,0])&&L.pad.length===4);
ok('not_to_other_output',L.synth.length===0);
ok('no_cont_sends',!L.pad.some(x=>x[0]===0xB1));
ok('saved_out',await pg.evaluate(()=>JSON.parse(localStorage.getItem('ae-midi')).out===true));
// 変化がなければ送らない
await clr();await wait(500);L=await log();ok('no_repeat',L.pad.length===0);
// FX オン → 点灯、オフ → 消灯
await dclick('#fxOn');await wait(350);L=await log();R.fxOn=L.pad;ok('fx_on_lit',has(L.pad,[0x90,36,127])&&L.pad.length===1);
await clr();await dclick('#fxOn');await wait(350);L=await log();ok('fx_off_unlit',has(L.pad,[0x90,36,0])&&L.pad.length===1);
// MIDI のノートで「押している間だけ」：押す → 点灯、離す → 消灯
await clr();await send(0x90,38,100);await wait(350);L=await log();ok('hold_lit',has(L.pad,[0x90,38,127]));
await clr();await send(0x80,38,0);await wait(350);L=await log();ok('hold_unlit',has(L.pad,[0x90,38,0]));
// CC のボタン（MUTE）：CC で押す → ミュート → CC 127 を送り返す
await clr();await send(0xB0,20,127);await wait(350);L=await log();R.mute=L.pad;
ok('mute_cc_lit',await pg.evaluate(()=>document.querySelector('#mixGrid [data-ch="bio"] [data-k="mute"]').getAttribute('aria-pressed')==='true')&&has(L.pad,[0xB0,20,127]));
await send(0xB0,20,0);await clr();await send(0xB0,20,127);await wait(350);L=await log();ok('mute_cc_unlit',has(L.pad,[0xB0,20,0]));
// パッド：録音を割り当てると点灯
await clr();await pg.evaluate(()=>{const s=document.getElementById('smpSource');s.value='recording:forest-leaves';s.dispatchEvent(new Event('change'))});await dclick('#smpLoad');await pg.waitForFunction(()=>__samplerDebug.state().dur>0,null,{timeout:20000});
await pg.evaluate(()=>__samplerDebug.setRange(2,3));await dclick('#smpAssign');await wait(350);L=await log();R.pad=L.pad;ok('pad_assigned_lit',has(L.pad,[0x90,37,127]));
// チャンネル番号：ch3 のノートの割り当ては 0x92 で送る
await clr();await pg.evaluate(()=>{__midi.maps['note:3:40']={t:'btn',sel:'#fxOn'}});await wait(350);L=await log();ok('channel_status',has(L.pad,[0x92,40,0]));
// 切る：点灯していたものを消して、以後は送らない
await clr();await setOut(false);await wait(100);L=await log();R.offAll=L.pad;ok('off_clears',has(L.pad,[0x90,37,0])&&L.pad.every(x=>x[2]===0));
await clr();await dclick('#fxOn');await wait(350);L=await log();ok('silent_after_off',L.pad.length===0&&L.synth.length===0);await dclick('#fxOn');
ok('saved_off',await pg.evaluate(()=>JSON.parse(localStorage.getItem('ae-midi')).out===undefined));
// 読み直し：保存した「入」が戻る
await setOut(true);await pg.reload();await wait(900);ok('reload_keeps',await pg.evaluate(()=>document.getElementById('midiOut').checked&&__midi.out===true));
// 入力と名前の合う出力がない時は送らない
await pg.evaluate(()=>{__midi.acc={inputs:new Map(),outputs:new Map([['o',{name:'Other Synth',state:'connected',send:d=>__midiMock.log.synth.push([...d])}]])};__midi.maps['note:1:36']={t:'btn',sel:'#fxOn'}});
await pg.evaluate(()=>{__midiMock.log.synth.length=0});await dclick('#midiConnect');await wait(400);L=await log();ok('no_matching_output',L.synth.length===0);
// 英語表示・390px・i18n の一致
await pg.evaluate(()=>{document.getElementById('mixerSection').open=true;document.querySelectorAll('#midiPanel details').forEach(d=>d.open=true)});
await dclick('#langToggle');await wait(300);
R.en=await pg.evaluate(()=>document.querySelector('#midiOut').parentElement.textContent.trim());ok('english',/Light the controller/.test(R.en));
R.untr=await pg.evaluate(()=>__i18n.untranslated().filter(x=>/ランプ/.test(x)));ok('no_untranslated',R.untr.length===0);
ok('no_overflow_390',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
const fs=require('fs');const src=fs.readFileSync(__dirname+'/src_i18n.js','utf8');const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const m=src.match(/'機器のランプを光らせる[^\n]*\n/);ok('i18n_parity',!!m&&html.includes(m[0]));
const msrc=fs.readFileSync(__dirname+'/src_midi.js','utf8').trim();const a=html.indexOf('/*<ae-midi>*/')+13,z=html.indexOf('/*</ae-midi>*/');ok('midi_src_parity',html.slice(a,z).trim()===msrc);
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
