// v0.71 楽器サンプルも基準・音律に合わせる切り替え（オーナー判断 2026-11-13：追加・既定オフ）の回帰テスト。python3 -m http.server 8765 で配信して実行する。
// 確認：既定はオフで再生速度は半音単位（2^(半音/12)）のまま／オンにすると 鳴らしたい周波数÷サンプルの公称周波数（440Hz・平均律とみなす）／
// 440Hz・平均律ではオンでも従来と同じ速度／実際のハープの再生速度／記憶・プリセット（旧形式はオフ）・英語・辞書の同一性・390px・エラー0。
// 個々の楽器サンプルの実際の音高（本当に 440Hz・平均律か）は未計測。耳での確認は未検証。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const W=t=>pg.waitForTimeout(t);const near=(a,b)=>Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(b));
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('saww.tuning');localStorage.removeItem('saww.key');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await W(900);
// 1. 既定はオフ
ok('default_off',await pg.evaluate(()=>saeTuning.get().samples===false&&document.getElementById('tuneSamples').checked===false));
const off=await pg.evaluate(()=>[saeTuning.sampleRate(60,57,999),saeTuning.sampleRate(45,57,1)]);ok('off_semitone',near(off[0],2**(3/12))&&near(off[1],0.5));
// 2. 実際のハープ（オフ）：再生速度は半音単位
await pg.evaluate(()=>{const el=document.getElementById('param-harp');el.value='70';el.dispatchEvent(new Event('input'))});
await pg.click('#play');await W(2500);
const harp=async()=>{const out=[];for(let i=0;i<10&&out.length<4;i++){await pg.evaluate(()=>__audioEcosystemDebug.triggerVoice('harp'));await W(600);const s=await pg.evaluate(()=>saeTuning.debug.sampleLast());if(s&&s.kind==='harp'&&s.rate)out.push(s)}return out};
const cents=r=>1200*Math.log2(r);const fracC=r=>{const c=cents(r);return c-100*Math.round(c/100)};
let h=await harp();R.harpOff=h.map(s=>+cents(s.rate).toFixed(3));ok('harp_off_semitone',h.length>0&&h.every(s=>Math.abs(fracC(s.rate))<1e-6));
// 3. オン（432Hz・純正律）：公称 440Hz の録音を鳴らしたい周波数に合わせる
await pg.check('#tuneSamples');await W(200);ok('on_state',await pg.evaluate(()=>saeTuning.get().samples===true));
await pg.selectOption('#harmKey','9');await W(200);
ok('on_a4',await pg.evaluate(()=>Math.abs(saeTuning.sampleRate(69,69,saeTuning.hz(69))-432/440)<1e-12));
h=await harp();R.harpOn=h.map(s=>+cents(s.rate).toFixed(2));
// 432Hz 由来の −31.77 セントに、純正律の差（−15.6〜+21.5）が加わる。半音ちょうどにはならない
ok('harp_on_retuned',h.length>0&&h.every(s=>{const f=fracC(s.rate);return f<-5&&f>-60}));
// 4. 440Hz・平均律ならオンでも従来と同じ
await pg.selectOption('#tuneRef','440');await pg.selectOption('#tuneSystem','12tet');await W(200);
R.legacyErr=await pg.evaluate(()=>{let e=0;for(let m=36;m<=96;m++)for(const mm of [48,57,60,72])e=Math.max(e,Math.abs(saeTuning.sampleRate(m,mm,saeTuning.hz(m))/2**((m-mm)/12)-1));return e});ok('legacy_same',R.legacyErr<1e-12);
await pg.selectOption('#tuneRef','432');await pg.selectOption('#tuneSystem','ji5');await W(200);
await pg.click('#play');await W(300);
// 5. 実録音の楽器層（和音の根音合わせ・旋律）も同じ関数を通る
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
ok('code_paths',html.includes('rate:sampleRateFor(tm,best.meta.midi,tuneHz(tm,root))')&&html.includes('sampleRateFor(m,meta.midi,fm)')&&html.includes('rate=sampleRateFor(midi,meta.midi,freq)')&&!html.includes('2**(best.d/12)'));
// 6. 記憶・プリセット
await pg.reload();await W(900);ok('persist',await pg.evaluate(()=>saeTuning.get().samples===true&&document.getElementById('tuneSamples').checked));
const pr=await pg.evaluate(()=>{const D=__audioEcosystemDebug,d=D.exportData(),out={exp:d.tuning};const old=JSON.parse(JSON.stringify(d));old.tuning={ref:432,system:'ji5'};D.applyData(old);out.noSamples=saeTuning.get().samples;
 delete old.tuning;D.applyData(old);out.legacy=saeTuning.get();D.applyData(d);out.back=saeTuning.get();out.ui=document.getElementById('tuneSamples').checked;
 const bad=JSON.parse(JSON.stringify(d));bad.tuning.samples='yes';try{D.applyData(bad);out.bad='accepted'}catch(e){out.bad=e.message}return out});R.preset=pr;
ok('preset',pr.exp.samples===true&&pr.noSamples===false&&pr.legacy.samples===false&&pr.legacy.ref===440&&pr.back.samples===true&&pr.ui===true&&pr.bad==='不正な音律設定');
await pg.uncheck('#tuneSamples');
// 6b. WAV のクレジットに音律（書き出し時点）。全素材の一覧（library）には入れない
await pg.click('#play');await W(1500);await pg.evaluate(async()=>{await __audioEcosystemDebug.startRecord()});await W(1500);await pg.evaluate(()=>__audioEcosystemDebug.stopRecord());await W(1500);
const cr=await pg.evaluate(()=>{const a=__audioEcosystemDebug.attribution();return {last:a.last&&a.last.text||'',lib:a.library}});
R.creditLine=(cr.last.split(/\r?\n/).find(l=>l.startsWith('音律 / Tuning'))||'');
ok('credit_tuning',R.creditLine==='音律 / Tuning: A4 = 432 Hz · 5-limit 純正律 / 5-limit just intonation（合成音 / synthesized tones） · 楽器サンプル / Instrument samples: 半音単位（録音のまま） / semitone steps (as recorded)');
ok('library_no_tuning',!cr.lib.includes('音律 / Tuning'));
await pg.click('#play');await W(300);
// 7. 英語・辞書・はみ出し
await pg.evaluate(()=>__i18n.set('en'));await W(300);R.en=await pg.evaluate(()=>document.getElementById('tuneSamples').parentElement.textContent.trim());
ok('english',R.en==='Retune instrument samples too (changes recording playback speed)');ok('no_overflow_en',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
await pg.evaluate(()=>__i18n.set('ja'));await W(200);ok('no_overflow_ja',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
const src=fs.readFileSync(__dirname+'/src_i18n.js','utf8');const line=src.split('\n').find(l=>l.startsWith("'楽器サンプルも合わせる"));ok('i18n_parity',!!line&&html.includes(line+'\n'));
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
