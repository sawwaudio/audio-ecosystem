// v0.35 ミキサー M1 の回帰テスト（docs/DJ_MIXER_SPEC.md）。v0.41 でチャンネルごとの FX つまみが加わり、つまみは1チャンネル6個。
// 周波数特性はページ内の OfflineAudioContext で、ミキサーの1レーン（本番と同じ makeMixLane）にインパルスを通して測る。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});await require('./photo_fixture')(pg);const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
// 画面：4チャンネル、タッチ演奏より上
R.ui=await pg.evaluate(()=>{const y=id=>document.getElementById(id).getBoundingClientRect().top+scrollY;return {strips:[...document.querySelectorAll('#mixGrid .mixStrip')].map(s=>s.dataset.ch),knobs:document.querySelectorAll('#mixGrid .knob').length,faders:document.querySelectorAll('#mixGrid .fader').length,mixer:y('mixerSection'),touch:y('touchSection')}});
ok('four_channels',R.ui.strips.join()==='bio,field,music,sampler'&&R.ui.knobs===24&&R.ui.faders===4);ok('above_touch',R.ui.mixer<R.ui.touch);
// 周波数特性
const F=[40,100,250,500,1000,2000,3000,6000,12000];
const resp=s=>pg.evaluate(([s,F])=>__mixerDebug.response(s,F),[s,F]);
const flat=await resp({});R.flat=flat.map(v=>+v.toFixed(2));ok('flat_neutral',flat.every(v=>Math.abs(v)<.25));
const at=(arr,f)=>arr[F.indexOf(f)];
const lowKill=await resp({low:0}),midKill=await resp({mid:0}),hiKill=await resp({hi:0});
R.kill={low40:+at(lowKill,40).toFixed(1),mid1k:+at(midKill,1000).toFixed(1),hi12k:+at(hiKill,12000).toFixed(1),low_at_6k:+at(lowKill,6000).toFixed(2),hi_at_100:+at(hiKill,100).toFixed(2)};
ok('kill_low',R.kill.low40<-40&&Math.abs(R.kill.low_at_6k)<.3);ok('kill_mid',R.kill.mid1k<-30);ok('kill_hi',R.kill.hi12k<-35&&Math.abs(R.kill.hi_at_100)<.3);
const hiBoost=await resp({hi:1});R.hiBoost12k=+at(hiBoost,12000).toFixed(2);ok('boost_6db',Math.abs(R.hiBoost12k-6)<.3);
const lpf=await resp({filter:-.6}),hpf=await resp({filter:.6});R.filter={lp100:+at(lpf,100).toFixed(1),lp6k:+at(lpf,6000).toFixed(1),hp40:+at(hpf,40).toFixed(1),hp6k:+at(hpf,6000).toFixed(1)};
ok('lowpass',R.filter.lp6k<-15&&Math.abs(R.filter.lp100)<1.5);ok('highpass',R.filter.hp40<-15&&Math.abs(R.filter.hp6k)<1.5);
const half=await resp({fader:.5}),trim=await resp({trim:-6}),zero=await resp({fader:0}),muted=await resp({mute:true});
R.levels={fader_half:+at(half,1000).toFixed(2),trim_m6:+at(trim,1000).toFixed(2),fader0:at(zero,1000),mute:at(muted,1000)};
ok('fader_curve',Math.abs(R.levels.fader_half+12.04)<.2);ok('trim',Math.abs(R.levels.trim_m6+6)<.2);ok('fader_zero',R.levels.fader0<-150&&R.levels.mute<-150);
// 実演奏：全レーンがあり、ミュートでそのチャンネルの音が消える
await pg.click('#play');await pg.waitForTimeout(9000);
R.lanes=await pg.evaluate(()=>__mixerDebug.lanes());ok('lanes',['bio','field','music','sampler'].every(c=>R.lanes[c]&&R.lanes[c].includes('dry')&&R.lanes[c].includes('wet'))&&R.lanes.music.includes('direct'));
const peaks=async()=>pg.evaluate(async()=>{const o={};for(const ch of ['field','music','master']){let m=-Infinity;for(let i=0;i<20;i++){m=Math.max(m,__mixerDebug.peakDb(ch));await new Promise(r=>setTimeout(r,50))}o[ch]=m}return o});
R.before=await peaks();ok('field_sounds',R.before.field>-80);ok('master_sounds',R.before.master>-80);
await pg.evaluate(()=>{__mixerDebug.set('field','mute',true);__mixerDebug.set('music','fader',0)});await pg.waitForTimeout(600);
R.after=await peaks();ok('mute_field',R.after.field===-Infinity);ok('fader_music',R.after.music===-Infinity);
await pg.evaluate(()=>{__mixerDebug.set('field','mute',false);__mixerDebug.set('music','fader',1)});
// 操作：キーボード（Home=最小、Delete=初期値）とフェーダーのドラッグ
await pg.evaluate(()=>document.getElementById('mixerSection').open=true);
const hi=pg.locator('#mixGrid [data-ch="field"] [data-k="hi"]');await hi.focus();await pg.keyboard.press('Home');
R.kbd={kill:await pg.evaluate(()=>__mixerDebug.state().ch.field.hi),text:await hi.getAttribute('aria-valuetext')};await pg.keyboard.press('Delete');R.kbd.reset=await pg.evaluate(()=>__mixerDebug.state().ch.field.hi);
ok('keyboard',R.kbd.kill===0&&R.kbd.text==='KILL'&&R.kbd.reset===.5);
const fd=pg.locator('#mixGrid [data-ch="bio"] .fader');await fd.scrollIntoViewIfNeeded();const bb=await fd.boundingBox();
await pg.mouse.move(bb.x+bb.width/2,bb.y+bb.height*.75);await pg.mouse.down();await pg.mouse.move(bb.x+bb.width/2,bb.y+bb.height*.5,{steps:4});await pg.mouse.up();
R.drag=await pg.evaluate(()=>__mixerDebug.state().ch.bio.fader);ok('fader_drag',Math.abs(R.drag-.5)<.06);
const kn=pg.locator('#mixGrid [data-ch="music"] [data-k="filter"]');await kn.scrollIntoViewIfNeeded();const kb=await kn.boundingBox();await pg.mouse.move(kb.x+kb.width/2,kb.y+kb.height/2);await pg.mouse.down();await pg.mouse.move(kb.x+kb.width/2,kb.y+kb.height/2-45,{steps:5});await pg.mouse.up();
R.knobDrag=await pg.evaluate(()=>__mixerDebug.state().ch.music.filter);ok('knob_drag',R.knobDrag>.5&&R.knobDrag<.7);
await pg.click('#mixReset');R.reset=await pg.evaluate(()=>Object.values(__mixerDebug.state().ch).every(s=>s.fader===1&&s.filter===0&&s.hi===.5&&!s.mute));ok('reset',R.reset);
// 英語表示と画面幅
await pg.click('#langToggle');await pg.waitForTimeout(400);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.en=await pg.evaluate(()=>({name:document.querySelector('#mixGrid [data-ch="field"] .mixName').textContent,aria:document.querySelector('#mixGrid [data-ch="field"] .fader').getAttribute('aria-label')}));ok('english',R.en.name==='Ambience'&&R.en.aria==='Ambience fader');
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
