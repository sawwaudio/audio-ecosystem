// v0.50 DJ ミキサー M5 の残り（MIDI の相対エンコーダー・ソフトテイクオーバー）の回帰テスト（docs/DJ_MIXER_SPEC.md）。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。MIDI 機器は navigator.requestMIDIAccess の差し替えで模擬する。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
const mock=()=>{const inp={id:'in-1',name:'Test Encoder',state:'connected',onmidimessage:null};const acc={inputs:new Map([['in-1',inp]]),outputs:new Map(),onstatechange:null};
 window.__midiMock={send:(...d)=>{if(inp.onmidimessage)inp.onmidimessage({data:new Uint8Array(d)})}};
 Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:()=>Promise.resolve(acc)})};
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);await pg.addInitScript(mock);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const wait=ms=>pg.waitForTimeout(ms),send=(...d)=>pg.evaluate(d=>__midiMock.send(...d),d),st=()=>pg.evaluate(()=>document.getElementById('midiStatus').textContent);
const fader=()=>pg.evaluate(()=>__mixerDebug.state().ch.bio.fader),depth=()=>pg.evaluate(()=>+document.getElementById('fxDepth').value);
const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e;
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-midi');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await wait(900);
await pg.evaluate(()=>{document.getElementById('mixerSection').open=true});await pg.click('#midiConnect');await wait(100);

// 1. 相対値の読み方（目盛りの数）
R.ticks=await pg.evaluate(()=>{const f=__midi.relTicks;return [f('rel2c',1),f('rel2c',5),f('rel2c',127),f('rel2c',120),f('rel2c',0),f('relbin',65),f('relbin',63),f('relbin',64),f('relsign',3),f('relsign',65),f('relsign',70),f('relsign',64),f('abs',10)]});
ok('rel_ticks',R.ticks.join()==='1,5,-1,-8,0,1,-1,0,3,-1,-6,0,0');

// 2. 一覧：つまみ・スライダー（CC）にだけ「動き方」の選択、ピッチベンド・ノートには出さない。既定は絶対値、ソフトテイクオーバーは既定で切
await pg.evaluate(()=>{__midi.maps={'cc:1:7':{t:'mix',ch:'bio',k:'fader'},'cc:1:21':{t:'range',id:'fxDepth'},'pb:2':{t:'mix',ch:'field',k:'fader'},'note:1:36':{t:'pad',i:0},'cc:1:20':{t:'btn',sel:'#fxOn'}};__midi.render()});
R.list=await pg.evaluate(()=>[...document.querySelectorAll('#midiList li[data-key]')].map(li=>li.dataset.key+'='+(li.querySelector('select.mode')?li.querySelector('select.mode').value:'-')));
R.soft0=await pg.evaluate(()=>document.getElementById('midiSoft').checked);
ok('mode_select',R.list.join()==='cc:1:7=abs,cc:1:21=abs,pb:2=-,note:1:36=-,cc:1:20=-'&&R.soft0===false);
R.opts=await pg.evaluate(()=>[...document.querySelectorAll('#midiList li[data-key="cc:1:7"] select option')].map(o=>o.value+':'+o.textContent).join('|'));
ok('mode_options',R.opts==='abs:絶対値|rel2c:相対（2の補数）|relbin:相対（64が中央）|relsign:相対（符号ビット）');

// 3. 相対（2の補数）：フェーダー 1 から 127（−1）×4 → 1−4/64、1（+1）×2 → +2/64、上限で止まる
await pg.selectOption('#midiList li[data-key="cc:1:7"] select','rel2c');
R.f0=await fader();for(let i=0;i<4;i++)await send(0xB0,7,127);R.f1=await fader();await send(0xB0,7,1);await send(0xB0,7,1);R.f2=await fader();await send(0xB0,7,63);R.f3=await fader();
ok('rel2c_fader',near(R.f0,1)&&near(R.f1,1-4/64)&&near(R.f2,1-2/64)&&near(R.f3,1));
// 相対（64が中央）・相対（符号ビット）
await pg.selectOption('#midiList li[data-key="cc:1:7"] select','relbin');await send(0xB0,7,56);R.fb=await fader();await send(0xB0,7,64);R.fb2=await fader();await send(0xB0,7,68);R.fb3=await fader();
ok('relbin_fader',near(R.fb,1-8/64)&&near(R.fb2,R.fb)&&near(R.fb3,1-4/64));
await pg.selectOption('#midiList li[data-key="cc:1:7"] select','relsign');await send(0xB0,7,64+16);R.fs=await fader();await send(0xB0,7,8);R.fs2=await fader();
ok('relsign_fader',near(R.fs,1-20/64)&&near(R.fs2,1-12/64));
// スライダー（ドライ／ウェット 0〜100）：1目盛りで最低でも step 以上動く
await pg.evaluate(()=>{const e=document.getElementById('fxDepth');e.value='50';e.dispatchEvent(new Event('input',{bubbles:true}))});
await pg.selectOption('#midiList li[data-key="cc:1:21"] select','rel2c');R.d0=await depth();await send(0xB0,21,1);R.d1=await depth();await send(0xB0,21,126);R.d2=await depth();
R.dv=await pg.evaluate(()=>document.getElementById('fxDepthVal').textContent);
ok('rel_range',R.d0===50&&R.d1>50&&R.d1<=52&&R.d2<R.d1&&R.dv===String(R.d2));

// 4. 保存：modes は相対の割り当てだけ書く。読み直しても選択が残る。絶対値に戻すと消える
R.saved=await pg.evaluate(()=>JSON.parse(localStorage.getItem('ae-midi')));
ok('save_modes',R.saved.v===1&&R.saved.modes&&R.saved.modes['cc:1:7']==='relsign'&&R.saved.modes['cc:1:21']==='rel2c'&&Object.keys(R.saved.modes).length===2&&!('soft' in R.saved));
await pg.reload();await wait(800);await pg.evaluate(()=>document.getElementById('mixerSection').open=true);
R.reload=await pg.evaluate(()=>[...document.querySelectorAll('#midiList select.mode')].map(s=>s.value).join());ok('reload_modes',R.reload==='relsign,rel2c');
await pg.selectOption('#midiList li[data-key="cc:1:7"] select','abs');R.saved2=await pg.evaluate(()=>JSON.parse(localStorage.getItem('ae-midi')).modes);
ok('abs_removes',R.saved2&&!('cc:1:7' in R.saved2)&&R.saved2['cc:1:21']==='rel2c');
// 割り当てを削除すると動き方も消える
await pg.click('#midiList li[data-key="cc:1:21"] button');R.saved3=await pg.evaluate(()=>JSON.parse(localStorage.getItem('ae-midi')));ok('delete_mode',!R.saved3.modes&&!('cc:1:21' in R.saved3.maps));

// 5. 絶対値・ソフトテイクオーバー切：従来どおりすぐに飛ぶ
await pg.click('#midiConnect');await wait(100);
await pg.evaluate(()=>__mixerDebug.set('bio','fader',.5));await send(0xB0,7,127);R.jump=await fader();ok('abs_jumps',near(R.jump,1));

// 6. ソフトテイクオーバー入：画面 0.5 のとき、遠い値は無視（状態表示）、通り過ぎたら拾う
await pg.click('#midiSoft');R.soft1=await pg.evaluate(()=>[document.getElementById('midiSoft').checked,JSON.parse(localStorage.getItem('ae-midi')).soft]);
await pg.evaluate(()=>__mixerDebug.set('bio','fader',.5));
await send(0xB0,7,127);R.s1={v:await fader(),st:await st()};await send(0xB0,7,100);R.s2=await fader();
await send(0xB0,7,60);R.s3=await fader();await send(0xB0,7,127);R.s4=await fader();
ok('soft_ignore',R.soft1[0]===true&&R.soft1[1]===true&&near(R.s1.v,.5)&&R.s1.st==='ソフトテイクオーバー：MIDI のつまみを画面の値（50%）まで動かすと操作できます。'&&near(R.s2,.5));
ok('soft_pickup_cross',near(R.s3,60/127)&&near(R.s4,1));
// 画面で値を変えたら拾い直す：0.2 にした後、1→0.9 は無視、近く（0.2±3%）で拾う
await pg.evaluate(()=>__mixerDebug.set('bio','fader',.2));await send(0xB0,7,115);R.s5=await fader();await send(0xB0,7,27);R.s6=await fader();await send(0xB0,7,0);R.s7=await fader();
ok('soft_repick',near(R.s5,.2)&&near(R.s6,27/127)&&near(R.s7,0));
// 相対の割り当てはソフトテイクオーバーの対象外（ずれがない）
await pg.evaluate(()=>{__midi.modes['cc:1:7']='rel2c';__midi.render();__mixerDebug.set('bio','fader',.5)});await send(0xB0,7,2);R.s8=await fader();ok('soft_rel_direct',near(R.s8,.5+2/64));
await pg.evaluate(()=>{delete __midi.modes['cc:1:7'];__midi.render()});

// 7. 壊れた保存データ：不正な方式・ピッチベンド・ノート・割り当てのない行の方式は捨てる。v0.46 の形式はそのまま読める
await pg.evaluate(()=>localStorage.setItem('ae-midi',JSON.stringify({v:1,maps:{'cc:1:7':{t:'mix',ch:'bio',k:'fader'},'pb:2':{t:'mix',ch:'field',k:'fader'},'note:1:1':{t:'pad',i:0},'cc:1:9':{t:'range',id:'fxDepth'}},modes:{'cc:1:7':'weird','pb:2':'rel2c','note:1:1':'rel2c','cc:1:8':'rel2c','cc:1:9':'relbin'},soft:'yes'})));
await pg.reload();await wait(700);R.bad=await pg.evaluate(()=>({modes:JSON.stringify(__midi.modes),soft:__midi.soft,n:Object.keys(__midi.maps).length}));
ok('bad_modes',R.bad.modes==='{"cc:1:9":"relbin"}'&&R.bad.soft===false&&R.bad.n===4);
await pg.evaluate(()=>localStorage.setItem('ae-midi',JSON.stringify({v:1,maps:{'cc:1:7':{t:'mix',ch:'bio',k:'fader'}}})));await pg.reload();await wait(700);
R.old=await pg.evaluate(()=>({modes:Object.keys(__midi.modes).length,soft:__midi.soft,n:Object.keys(__midi.maps).length,sel:document.querySelector('#midiList li[data-key="cc:1:7"] select').value}));ok('v046_format',R.old.modes===0&&!R.old.soft&&R.old.n===1&&R.old.sel==='abs');
// 全消去で方式も消える（ソフトテイクオーバーの設定は残す）
await pg.evaluate(()=>{document.getElementById('mixerSection').open=true;__midi.modes={'cc:1:7':'rel2c'};__midi.soft=true});await pg.click('#midiClear');
R.clear=await pg.evaluate(()=>localStorage.getItem('ae-midi'));ok('clear',R.clear==='{"v":1,"maps":{},"soft":true}');

// 8. 英語表示：未翻訳0・状態表示の英訳
await pg.evaluate(()=>{__midi.maps={'cc:1:7':{t:'mix',ch:'bio',k:'fader'}};__midi.render()});await pg.click('#langToggle');await wait(400);await pg.click('#midiConnect');await wait(100);
await pg.evaluate(()=>{__midi.picked={};__mixerDebug.set('bio','fader',.5)});await send(0xB0,7,127);
R.en={status:await st(),soft:await pg.evaluate(()=>document.querySelector('.midiSoftRow').textContent.trim()),opts:await pg.evaluate(()=>[...document.querySelectorAll('#midiList select.mode option')].map(o=>o.textContent).join('|')),aria:await pg.evaluate(()=>document.querySelector('#midiList select.mode').getAttribute('aria-label'))};
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;
ok('en',R.en.status==='Soft takeover: move the MIDI knob to the on-screen value (50%) to take control.'&&R.en.soft==='Soft takeover (ignore a MIDI knob until it passes the on-screen value)'&&R.en.opts==='Absolute|Relative (two’s complement)|Relative (64 = centre)|Relative (sign bit)'&&R.en.aria==='Mode');
ok('no_untranslated',un.length===0);
await pg.click('#langToggle');await wait(300);
// 9. 390px で横はみ出しなし
R.overflow=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok('no_overflow',R.overflow<=0);
// 10. ソースと埋め込みの一致・i18n の一致
const fs=require('fs');const html=fs.readFileSync(__dirname+'/../index.html','utf8'),src=fs.readFileSync(__dirname+'/src_midi.js','utf8'),i18n=fs.readFileSync(__dirname+'/src_i18n.js','utf8');
const a=html.indexOf('/*<ae-midi>*/\n')+14,e=html.indexOf('\n/*</ae-midi>*/');ok('src_parity',a>13&&html.slice(a,e)===src.replace(/\n+$/,''));
const tag='<script id="ae-i18n">',ia=html.indexOf(tag)+tag.length,ib=html.indexOf('</script>',ia);ok('i18n_parity',html.slice(ia,ib)===i18n);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL '+fail.join(','):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
