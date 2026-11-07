// v0.51「合成音を鳴らさない（楽器は実録音だけ）」の回帰テスト（docs/LIBRARY_300_PLAN.md 3 の段階2・3の準備）。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const wait=ms=>pg.waitForTimeout(ms);
const ev=k=>pg.evaluate(k=>__audioEcosystemDebug.eventsBy()[k]||0,k),fire=k=>pg.evaluate(k=>__audioEcosystemDebug.triggerVoice(k),k),drone=()=>pg.evaluate(()=>__audioEcosystemDebug.droneLevels());
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{['saww.synthOff','ae-lang','saww.boost'].forEach(k=>localStorage.removeItem(k))}catch(e){}});await pg.reload();await wait(900);

// 1. 既定は切。合成音の欄の先頭にチェック、印と説明は出ない
R.ui0=await pg.evaluate(()=>{const c=document.getElementById('synthOff');return {inBody:!!c&&!!c.closest('#synthBody'),first:document.querySelector('#synthBody>*')===document.querySelector('#synthBody>.synthOffRow'),checked:c.checked,get:__synthOff.get(),badge:document.getElementById('synthOffBadge').hidden,note:document.getElementById('synthOffNote').textContent,label:c.closest('label').textContent.trim()}});
ok('default_off',R.ui0.inBody&&R.ui0.first&&!R.ui0.checked&&!R.ui0.get&&R.ui0.badge&&R.ui0.note===''&&R.ui0.label==='合成音を鳴らさない（楽器は実録音だけ）');
// 2. 対象は合成音（groups の low/music/rhythm のうち実録音でないもの）だけ
R.target=await pg.evaluate(()=>{__synthOff.set(true);const r=Object.fromEntries(['sub','organDrone','bowed','organ','bowl','piano','bells','heart','kick','stones','harp','vibes','kalimba','didge','natureLow','frameDrum','birds','water'].map(k=>[k,__synthMuted(k)]));__synthOff.set(false);return r});
ok('targets',['sub','organDrone','bowed','organ','bowl','piano','bells','heart','kick','stones'].every(k=>R.target[k])&&['harp','vibes','kalimba','didge','natureLow','frameDrum','birds','water'].every(k=>!R.target[k]));

// 3. 切の時は従来どおり合成音が鳴る（持続音も）。v0.58：初期設定では合成音が 0 のため、以前の初期値を入れる
await require('./legacy_defaults')(pg,{layers:true});await pg.click('#play');await wait(1500);
const before={};for(const k of ['bells','piano','kick'])before[k]=await ev(k);for(const k of ['bells','piano','kick'])await fire(k);await wait(200);
R.offFire={};for(const k of ['bells','piano','kick'])R.offFire[k]=(await ev(k))-before[k];
R.droneOff=await drone();
ok('off_plays',Object.values(R.offFire).every(n=>n>=1)&&R.droneOff.sub>0&&R.droneOff.organDrone>0);

// 4. 入れる：保存・印・説明。合成音は出ない、持続音は 0（和音を変えた後の新しい持続音も 0）、値は変えない
const vals0=await pg.evaluate(()=>['sub','bells','kick','kalimba'].map(k=>document.getElementById('param-'+k).value).join());
await pg.evaluate(()=>{document.getElementById('synthPanel').open=true});await pg.click('#synthOff');await wait(200);
R.ui1=await pg.evaluate(()=>({checked:document.getElementById('synthOff').checked,saved:localStorage.getItem('saww.synthOff'),badge:!document.getElementById('synthOffBadge').hidden,note:document.getElementById('synthOffNote').textContent,muted:document.getElementById('synthBody').classList.contains('synthMuted')}));
ok('on_ui',R.ui1.checked&&R.ui1.saved==='1'&&R.ui1.badge&&R.ui1.muted&&R.ui1.note==='合成音を止めています。楽器は実録音だけで鳴ります（つまみの値はそのまま。切ると元に戻ります）。');
const b2={};for(const k of ['bells','piano','kick','stones'])b2[k]=await ev(k);for(let i=0;i<3;i++)for(const k of ['bells','piano','kick','stones'])await fire(k);await wait(300);
R.onFire={};for(const k of ['bells','piano','kick','stones'])R.onFire[k]=(await ev(k))-b2[k];
await pg.click('#change');await wait(400);R.droneOn=await drone();
ok('on_silent',Object.values(R.onFire).every(n=>n===0)&&R.droneOn.sub===0&&R.droneOn.organDrone===0&&R.droneOn.bowed===0);
// 自律演奏の間も合成音は出ない（数秒回して増えない）
const b3=await pg.evaluate(()=>__audioEcosystemDebug.eventsBy());await wait(4000);const a3=await pg.evaluate(()=>__audioEcosystemDebug.eventsBy());
R.autoSynth=['sub','organDrone','bowed','organ','bowl','piano','bells','heart','kick','stones'].reduce((n,k)=>n+((a3[k]||0)-(b3[k]||0)),0);ok('auto_silent',R.autoSynth===0);
// 実録音の楽器は鳴る
await pg.evaluate(()=>{const el=document.getElementById('param-kalimba');el.value=70;el.dispatchEvent(new Event('input'))});
let seen=false;for(let i=0;i<60&&!seen;i++){if(i%15===0)await pg.evaluate(()=>__realDebug.hit('kalimba'));await wait(100);seen=await pg.evaluate(()=>__realDebug.voices().includes('kalimba'))}R.realPlays=seen;ok('real_plays',seen);
await pg.evaluate(()=>{const el=document.getElementById('param-kalimba');el.value=0;el.dispatchEvent(new Event('input'))});
R.vals=await pg.evaluate(()=>['sub','bells','kick','kalimba'].map(k=>document.getElementById('param-'+k).value).join());ok('values_kept',R.vals===vals0);
// 試聴の欄では1音ずつ聴ける
const b4=await ev('bells');await pg.evaluate(()=>{document.getElementById('auditionPanel').open=true});await pg.click('#auditionButtons button[data-sound="bells"]');await wait(500);R.audition=(await ev('bells'))-b4;ok('audition',R.audition>=1);
await pg.waitForFunction(()=>!__audioEcosystemDebug.getState().auditionKey,null,{timeout:12000});

// 5. 読み直しても残る。切ると元に戻る
await pg.reload();await wait(900);R.reload=await pg.evaluate(()=>({checked:document.getElementById('synthOff').checked,get:__synthOff.get(),badge:!document.getElementById('synthOffBadge').hidden}));ok('reload',R.reload.checked&&R.reload.get&&R.reload.badge);
await require('./legacy_defaults')(pg,{layers:true});await pg.click('#play');await wait(1200);R.droneReload=await drone();
await pg.evaluate(()=>{document.getElementById('synthPanel').open=true});await pg.click('#synthOff');await wait(200);
const b5=await ev('bells');await fire('bells');await wait(200);R.backFire=(await ev('bells'))-b5;await pg.click('#change');await wait(400);R.droneBack=await drone();
R.back=await pg.evaluate(()=>({saved:localStorage.getItem('saww.synthOff'),badge:document.getElementById('synthOffBadge').hidden,note:document.getElementById('synthOffNote').textContent}));
ok('back_on',R.droneReload.sub===0&&R.backFire>=1&&R.droneBack.sub>0&&R.back.saved==='0'&&R.back.badge&&R.back.note==='');
await pg.click('#play');await wait(400);

// 6. 英語表示（未翻訳0）
await pg.evaluate(()=>__synthOff.set(true));await pg.click('#langToggle');await wait(500);
R.en={label:await pg.evaluate(()=>document.getElementById('synthOff').closest('label').textContent.trim()),note:await pg.textContent('#synthOffNote'),badge:await pg.textContent('#synthOffBadge')};
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;
ok('english',R.en.label==='Mute synth sounds (instruments from real recordings only)'&&R.en.badge==='Muted'&&/^Synth sounds are muted\./.test(R.en.note));ok('no_untranslated',un.length===0);
await pg.click('#langToggle');await wait(300);
// 7. 390px で横はみ出しなし・i18n の一致・エラー0
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
const fs=require('fs');const html=fs.readFileSync(__dirname+'/../index.html','utf8'),i18n=fs.readFileSync(__dirname+'/src_i18n.js','utf8');
const tag='<script id="ae-i18n">',ia=html.indexOf(tag)+tag.length,ib=html.indexOf('</script>',ia);ok('i18n_parity',html.slice(ia,ib)===i18n);
await pg.evaluate(()=>{try{['saww.synthOff','ae-lang'].forEach(k=>localStorage.removeItem(k))}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
