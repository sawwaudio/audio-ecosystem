// v0.46 DJ ミキサー M5 第2段階（Web MIDI：学習で割り当て）の回帰テスト（docs/DJ_MIXER_SPEC.md）。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。MIDI 機器は navigator.requestMIDIAccess の差し替えで模擬する。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
const mock=()=>{const inp={id:'in-1',name:'Test Controller',state:'connected',onmidimessage:null};const acc={inputs:new Map([['in-1',inp]]),outputs:new Map(),onstatechange:null};
 window.__midiMock={send:(...d)=>{if(inp.onmidimessage)inp.onmidimessage({data:new Uint8Array(d)})},asked:null};
 Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:o=>{window.__midiMock.asked=o;return Promise.resolve(acc)}})};
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);await pg.addInitScript(mock);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const wait=ms=>pg.waitForTimeout(ms),send=(...d)=>pg.evaluate(d=>__midiMock.send(...d),d),st=()=>pg.evaluate(()=>document.getElementById('midiStatus').textContent);
const attr=(sel,a)=>pg.evaluate(([s,a])=>document.querySelector(s).getAttribute(a),[sel,a]);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-midi');localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});await pg.reload();await wait(900);
await pg.evaluate(()=>{document.getElementById('mixerSection').open=true;document.getElementById('samplerSection').open=true});

// 1. 画面：ミキサーの中、BEAT FX の後に MIDI の欄
R.ui=await pg.evaluate(()=>{const p=document.getElementById('midiPanel');return {inMixer:!!p&&p.closest('#mixerSection')!==null,afterFx:!!p&&document.getElementById('fxPanel').compareDocumentPosition(p)===Node.DOCUMENT_POSITION_FOLLOWING,btns:[...p.querySelectorAll('.buttons button')].map(b=>b.id).join(),status:document.getElementById('midiStatus').textContent,empty:document.getElementById('midiList').textContent}});
ok('panel',R.ui.inMixer&&R.ui.afterFx&&R.ui.btns==='midiConnect,midiLearn,midiClear'&&R.ui.status==='MIDI 機器は未接続です。'&&R.ui.empty==='割り当てはまだありません。');
// 2. 接続（SysEx は要求しない）
await pg.click('#midiConnect');await wait(100);R.connect={status:await st(),asked:await pg.evaluate(()=>__midiMock.asked)};ok('connect',R.connect.status==='接続中の MIDI 入力：Test Controller'&&R.connect.asked&&R.connect.asked.sysex===false);
// 3. 学習：生き物のフェーダーを押す（値は変わらない）→ CC7 を動かす → 割り当て
const fader='#mixGrid [data-ch="bio"] [data-k="fader"]';
await pg.click('#midiLearn');R.learnOn={pressed:await attr('#midiLearn','aria-pressed'),body:await pg.evaluate(()=>document.body.classList.contains('midiLearn')),status:await st()};
ok('learn_on',R.learnOn.pressed==='true'&&R.learnOn.body&&R.learnOn.status==='割り当てたい操作部（つまみ・フェーダー・パッド・ボタン）を押してください。');
const before=await attr(fader,'aria-valuenow');await pg.locator(fader).scrollIntoViewIfNeeded();const fb=await pg.locator(fader).boundingBox();await pg.mouse.click(fb.x+fb.width/2,fb.y+fb.height*.8);
R.pick={before,after:await attr(fader,'aria-valuenow'),pending:await pg.evaluate(s=>document.querySelector(s).classList.contains('midiPending'),fader),status:await st()};
ok('pick_no_change',R.pick.before===R.pick.after&&R.pick.pending&&R.pick.status==='「生き物 フェーダー」に割り当てます。MIDI のつまみ・フェーダーかパッド・ボタンを動かしてください。');
await send(0xB0,7,64);R.bind={status:await st(),list:await pg.evaluate(()=>document.getElementById('midiList').textContent),pending:await pg.evaluate(()=>document.querySelectorAll('.midiPending').length),val:await attr(fader,'aria-valuenow')};
ok('bind_cc',R.bind.status==='「生き物 フェーダー」に CC 7 · ch1 を割り当てました。'&&/CC 7 · ch1 → 生き物 フェーダー/.test(R.bind.list)&&R.bind.pending===0&&R.bind.val===before);
// 4. つまみにノートは割り当てない（CC を求める）→ CC10 で割り当て
const hi='#mixGrid [data-ch="field"] [data-k="hi"]';await pg.click(hi);await send(0x90,40,100);R.noteToKnob=await st();await send(0xB0,10,64);
ok('knob_needs_cc',R.noteToKnob==='つまみ・フェーダーには、MIDI のつまみかフェーダー（CC）を動かしてください。'&&(await st())==='「環境音 HI」に CC 10 · ch1 を割り当てました。');
// 5. BEAT FX オン／オフにノート36（押しても切り替わらない）・押している間だけにノート37・効果「エコー」以外の2番目のボタンにノート38・ドライ／ウェットに CC11（チャンネル2）
await pg.click('#fxOn');R.fxOnPick=await attr('#fxOn','aria-pressed');await send(0x90,36,100);await send(0x80,36,0);
await pg.click('#fxHold');await send(0x91,37,100);
const t2=await pg.evaluate(()=>document.querySelectorAll('#fxTypes button')[1].dataset.type);await pg.click('#fxTypes button:nth-child(2)');await send(0x90,38,90);
await pg.click('#fxDepth');await send(0xB1,11,30);
// パッド1にノート48、環境音の MUTE に CC20（ボタンに CC）、音楽のフェーダーにピッチベンド（チャンネル3）、始点スライダーに CC21
await pg.click('#smpPads [data-pad="0"]');await send(0x90,48,100);
await pg.click('#mixGrid [data-ch="field"] [data-k="mute"]');await send(0xB0,20,127);
await pg.click('#mixGrid [data-ch="music"] [data-k="fader"]');await send(0xE2,0,64);
await pg.click('#play');await send(0x90,60,100);
// 割り当てできない操作部
await pg.click('#smpWave');R.unmappable=await st();ok('unmappable',R.unmappable==='この操作部は割り当てられません。');
await pg.keyboard.press('Escape');R.learnOff={pressed:await attr('#midiLearn','aria-pressed'),status:await st(),fxOn:R.fxOnPick,playing:await attr('#play','aria-pressed')};
ok('learn_off',R.learnOff.pressed==='false'&&R.learnOff.status==='学習を終えました。'&&R.learnOff.fxOn==='false'&&R.learnOff.playing==='false');
R.maps=await pg.evaluate(()=>JSON.parse(JSON.stringify(__midi.maps)));
ok('maps',Object.keys(R.maps).sort().join()===['cc:1:10','cc:1:20','cc:1:7','cc:2:11','note:1:36','note:1:38','note:1:48','note:1:60','note:2:37','pb:3'].sort().join()&&R.maps['note:1:48'].t==='pad'&&R.maps['note:2:37'].t==='hold'&&R.maps['cc:2:11'].id==='fxDepth'&&R.maps['pb:3'].k==='fader');
// 6. 演奏：CC → フェーダー・つまみ・スライダー
await send(0xB0,7,0);R.f0=await attr(fader,'aria-valuetext');await send(0xB0,7,127);R.f1=await attr(fader,'aria-valuenow');
ok('cc_fader',R.f0==='−∞'&&R.f1==='1');
await send(0xB0,10,0);R.kill=await attr(hi,'aria-valuetext');ok('cc_knob',R.kill==='KILL');
await send(0xB1,11,127);R.depth=await pg.evaluate(()=>[document.getElementById('fxDepth').value,document.getElementById('fxDepthVal').textContent]);await send(0xB1,11,0);R.depth0=await pg.evaluate(()=>document.getElementById('fxDepth').value);
ok('cc_range',R.depth[0]==='100'&&R.depth[1]==='100'&&R.depth0==='0');
await send(0xE2,0x7f,0x7f);R.pb1=await attr('#mixGrid [data-ch="music"] [data-k="fader"]','aria-valuenow');await send(0xE2,0,0);R.pb0=await attr('#mixGrid [data-ch="music"] [data-k="fader"]','aria-valuenow');ok('pitchbend',R.pb1==='1'&&R.pb0==='0');
await send(0xB0,7,127);await send(0xE2,0x7f,0x7f);
// ノート → ボタン（押すたびに切り替え、ノートオフでは変わらない）
await send(0x90,36,100);const on1=await attr('#fxOn','aria-pressed');await send(0x80,36,0);const on2=await attr('#fxOn','aria-pressed');await send(0x90,36,100);const on3=await attr('#fxOn','aria-pressed');
ok('note_button',on1==='true'&&on2==='true'&&on3==='false');
await send(0x90,38,100);R.type=await pg.evaluate(t=>document.querySelector('#fxTypes [data-type="'+t+'"]').getAttribute('aria-pressed'),t2);ok('note_fx_type',R.type==='true');
// 押している間だけ：ノートオン／オフ（ベロシティ0のノートオンも離す扱い）
await send(0x91,37,100);const h1=await pg.evaluate(()=>document.getElementById('fxHold').classList.contains('on'));await send(0x91,37,0);const h2=await pg.evaluate(()=>document.getElementById('fxHold').classList.contains('on'));
ok('note_hold',h1&&!h2);
// ボタンに CC：64 以上に上がった時だけ押す
const mute='#mixGrid [data-ch="field"] [data-k="mute"]';const m0=await attr(mute,'aria-pressed');await send(0xB0,20,0);await send(0xB0,20,127);const m1=await attr(mute,'aria-pressed');await send(0xB0,20,120);const m2=await attr(mute,'aria-pressed');await send(0xB0,20,0);await send(0xB0,20,100);const m3=await attr(mute,'aria-pressed');
ok('cc_button_edge',m0==='false'&&m1==='true'&&m2==='true'&&m3==='false');
// 割り当てのないメッセージは何もしない
await send(0xB5,99,127);await send(0x95,99,127);await send(0xF8);
// 7. パッド：空のパッドはその旨、録音を割り当てるとノートで鳴る（サンプラーチャンネル）
await send(0x90,48,100);R.padEmpty=await pg.evaluate(()=>document.getElementById('smpStatus').textContent);ok('pad_empty',R.padEmpty==='パッド1はまだ空です。');
await send(0x90,60,100);await wait(5000);R.play=await attr('#play','aria-pressed');
await pg.selectOption('#smpSource','recording:forest-leaves');await pg.click('#smpLoad');await pg.waitForFunction(()=>__samplerDebug.state().dur>0,null,{timeout:20000});
await pg.evaluate(()=>__samplerDebug.setRange(2,4));await pg.selectOption('#smpPadSel','0');await pg.click('#smpAssign');await wait(200);
await send(0x90,48,100);await wait(150);let pk=-Infinity;for(let i=0;i<12;i++){pk=Math.max(pk,await pg.evaluate(()=>__mixerDebug.peakDb('sampler')));await wait(50)}
R.pad={playing:await pg.evaluate(()=>__samplerDebug.state().playing),peak:+pk.toFixed(1)};ok('pad_plays',R.play==='true'&&R.pad.playing.includes(0)&&pk>-60);
// 8. 保存：読み直しても割り当てが残り、接続し直すとそのまま使える
R.saved=await pg.evaluate(()=>JSON.parse(localStorage.getItem('ae-midi')));
await pg.reload();await wait(900);await pg.evaluate(()=>document.getElementById('mixerSection').open=true);
R.reload={n:await pg.evaluate(()=>document.querySelectorAll('#midiList li[data-key]').length),labels:await pg.evaluate(()=>[...document.querySelectorAll('#midiList .dst')].map(x=>x.textContent))};
ok('persist',R.saved&&R.saved.v===1&&Object.keys(R.saved.maps).length===10&&R.reload.n===10&&!R.reload.labels.includes('（見つかりません）'));
await pg.click('#midiConnect');await wait(100);await send(0xB0,7,0);R.afterReload=await attr(fader,'aria-valuetext');ok('persist_works',R.afterReload==='−∞');
// 壊れた保存データは無視する
await pg.evaluate(()=>localStorage.setItem('ae-midi',JSON.stringify({v:1,maps:{'cc:1:1':{t:'btn',sel:'body'},'x':{t:'pad',i:0},'note:1:1':{t:'pad',i:99},'cc:1:2':{t:'mix',ch:'bio',k:'trim'}}})));await pg.reload();await wait(700);
R.bad=await pg.evaluate(()=>Object.keys(__midi.maps));ok('bad_storage',R.bad.join()==='cc:1:2');
// 9. 削除と全消去
await pg.evaluate(()=>document.getElementById('mixerSection').open=true);await pg.click('#midiList li[data-key="cc:1:2"] button');R.del=await pg.evaluate(()=>Object.keys(__midi.maps).length);
await pg.evaluate(()=>{__midi.maps={'cc:1:3':{t:'hold'}};__midi.render()});await pg.click('#midiClear');R.clear={n:await pg.evaluate(()=>Object.keys(__midi.maps).length),status:await st(),ls:await pg.evaluate(()=>localStorage.getItem('ae-midi'))};
ok('delete_clear',R.del===0&&R.clear.n===0&&R.clear.status==='割り当てをすべて消しました。'&&R.clear.ls==='{"v":1,"maps":{}}');
// 10. 英語表示：未翻訳0・状態表示の英訳・日本語への往復
await pg.evaluate(()=>{__midi.maps={'note:10:36':{t:'pad',i:0},'pb:2':{t:'mix',ch:'bio',k:'fader'}};__midi.render()});
await pg.click('#langToggle');await wait(400);await pg.click('#midiConnect');await wait(100);
R.en={title:await pg.evaluate(()=>document.querySelector('#midiPanel .title').textContent),status:await st(),list:await pg.evaluate(()=>document.getElementById('midiList').textContent),learn:await pg.evaluate(()=>document.getElementById('midiLearn').textContent)};
await pg.click('#midiLearn');R.en.learn2=await st();await pg.click('#mixGrid [data-ch="field"] [data-k="fader"]');R.en.pick=await st();await send(0xB0,1,10);R.en.bound=await st();await pg.click('#mixGrid [data-ch="field"] [data-k="trim"]');await send(0x90,1,1);R.en.needcc=await st();await pg.keyboard.press('Escape');
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;
ok('en',R.en.title==='MIDI / CONTROLLER'&&R.en.status==='Connected MIDI input: Test Controller'&&/Note 36 · ch10 → Pad 1/.test(R.en.list)&&/Pitch bend · ch2 → /.test(R.en.list)&&R.en.learn==='Learn mapping'&&R.en.learn2==='Press the control you want to map (knob, fader, pad or button).'&&/^Mapping to “.+”\. Move a MIDI knob, fader, pad or button\.$/.test(R.en.pick)&&/^Mapped CC 1 · ch1 to “.+”\.$/.test(R.en.bound)&&R.en.needcc==='For knobs and faders, move a MIDI knob or fader (CC).');
ok('no_untranslated',un.length===0);
await pg.click('#langToggle');await wait(400);R.jp=await pg.evaluate(()=>document.querySelector('#midiPanel .title').textContent);ok('back_to_jp',R.jp==='MIDI / コントローラ');
// 11. 390px で横はみ出しなし
R.overflow=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok('no_overflow',R.overflow<=0);
// 12. Web MIDI のないブラウザ
const cx2=await b.newContext({viewport:{width:390,height:844}});const p2=await cx2.newPage();await require('./photo_fixture')(p2);await p2.addInitScript(()=>{try{delete Navigator.prototype.requestMIDIAccess}catch(e){}});
p2.on('pageerror',e=>errs.push('PAGEERR2 '+e.message));await p2.goto('http://localhost:8765/index.html');await p2.waitForTimeout(700);await p2.evaluate(()=>document.getElementById('mixerSection').open=true);await p2.click('#midiConnect');
R.unsupported=await p2.evaluate(()=>document.getElementById('midiStatus').textContent);ok('unsupported',R.unsupported==='このブラウザは Web MIDI に対応していません。');
// 13. ソースと埋め込みの一致
const fs=require('fs');const html=fs.readFileSync(__dirname+'/../index.html','utf8'),src=fs.readFileSync(__dirname+'/src_midi.js','utf8');
const a=html.indexOf('/*<ae-midi>*/\n')+14,e=html.indexOf('\n/*</ae-midi>*/');ok('src_parity',a>13&&html.slice(a,e)===src.replace(/\n+$/,''));
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL '+fail.join(','):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
