// v0.70 432Hz 純正律エンジン（オーナー要望 2026-11-13）の回帰テスト。python3 -m http.server 8765 で配信して実行する。
// 確認：既定が A4=432Hz・5-limit 純正律／周波数の計算（主音・整数比）／12キー×長短の転調で和音の中が整数比のまま／
// 12平均律＋440Hz が従来の式と同じ値（旧作品の互換）／演奏中の持続音の発振器の周波数と出力が無音でないこと／音律の切り替え／
// 楽器サンプルは半音単位のまま（録音の音程・速度を変えない）／プリセット（音律なし＝440Hz・平均律、不正値は拒否）／
// 実周波数の表示・記憶・英語表示・辞書の同一性・390px・エラー0。
// 実機・耳での確認（うなりの少なさ、楽器サンプルとの音程差の聴こえ方）は未検証。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:900}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const W=t=>pg.waitForTimeout(t);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('saww.tuning');localStorage.removeItem('saww.key');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await W(900);
// 1. 既定
R.def=await pg.evaluate(()=>saeTuning.get());ok('default_432_ji5',R.def.ref===432&&R.def.system==='ji5');
ok('ui_default',await pg.evaluate(()=>document.getElementById('tuneRef').value==='432'&&document.getElementById('tuneSystem').value==='ji5'));
// 2. 周波数の計算（C メジャー・Cmaj9）：主音 C3=432×2^(-21/12)、構成音は 1・5/4・3/2・15/8・9/4
const calc=await pg.evaluate(()=>{const c3=432*2**(-21/12),hz=saeTuning.chordHz();return {c3,hz,ratios:hz.map(f=>f/hz[0]),a4:saeTuning.hz(69)}});R.calc=calc;
const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e*Math.max(1,Math.abs(b));
ok('tonic_c3',near(calc.hz[0],calc.c3));ok('cmaj9_ratios',[1,5/4,3/2,15/8,9/4].every((r,i)=>near(calc.ratios[i],r)));
ok('display_hz',await pg.evaluate(()=>/^A4 = 432 Hz · C3 128\.43 · E3 160\.54 · G3 192\.65 · B3 240\.81 · D4 288\.98 Hz$/.test(document.getElementById('tuneHz').textContent)));
R.tuneHz=await pg.evaluate(()=>document.getElementById('tuneHz').textContent);
// 3. キー A では A4 がちょうど 432Hz
await pg.selectOption('#harmKey','9');await W(150);ok('a4_exact',await pg.evaluate(()=>saeTuning.hz(69)===432&&saeTuning.hz(57)===216));
// 4. 転調：12キー×長短の全和音で、構成音/根音が5-limitの整数比、根音/主音が音階の比、楽器サンプル用の半音が元の音と一致
const SC=[1,16/15,9/8,6/5,5/4,4/3,45/32,3/2,8/5,5/3,9/5,15/8];
const tr=await pg.evaluate(()=>{const out=[];for(const mode of ['major','minor'])for(let k=0;k<12;k++){document.getElementById('harmKey').value=String(k);document.getElementById('harmMode').value=mode;document.getElementById('harmMode').dispatchEvent(new Event('change'));
 const CH=()=>saeTuning.debug.chords();for(let i=0;i<6;i++){const c=CH()[i],rootHz=saeTuning.hz(c.root,c.root),deg=((c.root-k)%12+12)%12,tonic=c.root-deg,tonicHz=432*2**((tonic-69)/12);
  const tones=[];for(const o of [-24,-12,0,12,24])for(const n of c.notes){const m=c.root+n+o,f=saeTuning.hz(m,c.root);tones.push({semi:n+o,r:f/rootHz,sm:saeTuning.sampleMidi(f),m})}
  out.push({k,mode,i,root:c.root,deg,rootRatio:rootHz/tonicHz,tones})}}return out});
let bad=[];for(const x of tr){if(!near(x.rootRatio,SC[x.deg]))bad.push(['root',x.k,x.mode,x.i]);for(const t of x.tones){const s=((t.semi%12)+12)%12,o=Math.floor(t.semi/12);if(!near(t.r,SC[s]*2**o))bad.push(['tone',x.k,x.mode,x.i,t.semi]);if(t.sm!==t.m)bad.push(['sample',x.k,x.mode,x.i,t.m,t.sm])}}
R.transposeChecked=tr.length;R.transposeBad=bad.slice(0,5);ok('transpose_ji',tr.length===144&&bad.length===0);
await pg.evaluate(()=>{const k=document.getElementById('harmKey'),m=document.getElementById('harmMode');k.value='0';m.value='major';m.dispatchEvent(new Event('change'))});await W(100);
// 5. 12平均律＋440Hz は従来の式（440×2^((m-69)/12)）と同じ
await pg.selectOption('#tuneRef','440');await pg.selectOption('#tuneSystem','12tet');await W(100);
R.legacyMaxErr=await pg.evaluate(()=>{let e=0;for(let m=12;m<=108;m++)for(const r of [m,m-7,m+5])e=Math.max(e,Math.abs(saeTuning.hz(m,r)-440*Math.pow(2,(m-69)/12)));return e});ok('legacy_identical',R.legacyMaxErr===0);
ok('ui_legacy_label',await pg.evaluate(()=>document.getElementById('tuneHz').textContent.startsWith('A4 = 440 Hz · C3 130.81')));
// 432Hz の平均律も選べる（基準と比率は独立）
await pg.selectOption('#tuneRef','432');await W(100);ok('ref_independent',await pg.evaluate(()=>{const t=saeTuning.get();return t.ref===432&&t.system==='12tet'&&Math.abs(saeTuning.hz(60)-432*2**(-9/12))<1e-12}));
await pg.selectOption('#tuneSystem','ji5');await W(100);
// 6. 演奏：持続音の発振器が純正律の周波数（倍音 2・3 倍と、既存のうなり用の 1.003・1.004 倍を除いて整数比）、出力は無音でない。演奏中の切り替えで新しい持続音が 440Hz・平均律になる
await pg.click('#play');await W(3500);
const dr=await pg.evaluate(()=>{const D=saeTuning.debug,c=D.chords()[D.chordIndex()],d=D.drone();return {chord:c.name,root:c.root,parts:d.parts,rootHz:saeTuning.hz(c.root,c.root),sig:__bioDebug.signal()}});
R.droneChord=dr.chord;R.droneSub=dr.parts[0];R.sig=dr.sig;
ok('drone_sub_ji',dr.parts[0].key==='sub'&&Math.abs(dr.parts[0].f-dr.rootHz/4)<1e-3);
const jiR=s=>SC[((s%12)+12)%12]*2**Math.floor(s/12);R.droneParts=dr.parts.length;
ok('drone_all_ji',dr.parts.length>=5&&dr.parts.every(p=>{const r=p.base/dr.rootHz;for(let s=-36;s<=36;s++)for(const k of [1,2,3,1.003,1.004])if(Math.abs(r/(jiR(s)*k)-1)<1e-9)return true;return false}));
ok('audio_out',dr.sig.rms>1e-4);
await pg.selectOption('#tuneRef','440');await pg.selectOption('#tuneSystem','12tet');await W(600);
const dr2=await pg.evaluate(()=>{const D=saeTuning.debug,c=D.chords()[D.chordIndex()],d=D.drone();return {sub:d.parts[0].f,exp:440*2**((c.root-24-69)/12),groups:d.groups}});R.dr2=dr2;
ok('switch_while_playing',Math.abs(dr2.sub-dr2.exp)<1e-3&&dr2.groups<=4);
await pg.selectOption('#tuneRef','432');await pg.selectOption('#tuneSystem','ji5');await W(300);
// 7. 楽器サンプル：純正律・432Hz でも整数の半音で鳴らす（録音の音程・速度は半音単位のまま）
await pg.evaluate(()=>{const el=document.getElementById('param-harp');el.value='70';el.dispatchEvent(new Event('input'))});
const smp=[];for(let i=0;i<8&&smp.length<4;i++){await pg.evaluate(()=>__audioEcosystemDebug.triggerVoice('harp'));await W(700);const sl=await pg.evaluate(()=>saeTuning.debug.sampleLast());if(sl&&sl.kind==='harp')smp.push(sl.midi)}
R.harpMidi=smp;ok('harp_integer_midi',smp.length>0&&smp.every(Number.isInteger));
const html=fs.readFileSync(__dirname+'/../index.html','utf8');ok('real_melody_semitone',html.includes('const f0=randomPitch();let m=sampleMidi(f0);')&&!/Math\.log2\([^)]*\/440\)/.test(html));
await pg.click('#play');await W(400);
// 8. プリセット
const pr=await pg.evaluate(()=>{const D=__audioEcosystemDebug,out={};const d=D.exportData();out.exported=d.tuning;
 const old=JSON.parse(JSON.stringify(d));delete old.tuning;D.applyData(old);out.afterOld=saeTuning.get();
 D.applyData(d);out.afterNew=saeTuning.get();
 const badP=JSON.parse(JSON.stringify(d));badP.tuning={ref:1000,system:'ji5'};try{D.applyData(badP);out.bad='accepted'}catch(e){out.bad=e.message}
 const badS=JSON.parse(JSON.stringify(d));badS.tuning={ref:432,system:'pythagorean'};try{D.applyData(badS);out.badS='accepted'}catch(e){out.badS=e.message}
 out.afterBad=saeTuning.get();return out});R.preset=pr;
ok('preset_export',pr.exported&&pr.exported.ref===432&&pr.exported.system==='ji5');ok('preset_old_legacy',pr.afterOld.ref===440&&pr.afterOld.system==='12tet');
ok('preset_new_restored',pr.afterNew.ref===432&&pr.afterNew.system==='ji5');ok('preset_invalid_rejected',pr.bad==='不正な音律設定'&&pr.badS==='不正な音律設定'&&pr.afterBad.ref===432);
ok('api_rejects_invalid',await pg.evaluate(()=>saeTuning.set({ref:'432',system:'ji5'})===false&&saeTuning.set({ref:470,system:'none'})===false&&saeTuning.get().ref===432));
// 9. 記憶：再読み込み後も選んだ設定のまま
await pg.selectOption('#tuneRef','442');await W(100);await pg.reload();await W(900);
ok('persist',await pg.evaluate(()=>{const t=saeTuning.get();return t.ref===442&&t.system==='ji5'&&document.getElementById('tuneRef').value==='442'}));
await pg.selectOption('#tuneRef','432');
// 10. 英語表示・辞書の同一性・はみ出し
await pg.evaluate(()=>__i18n.set('en'));await W(300);
R.en=await pg.evaluate(()=>({sys:[...document.getElementById('tuneSystem').options].map(o=>o.textContent),lbl:document.querySelector('label[for=tuneRef]').textContent,aria:document.getElementById('tuneSystem').getAttribute('aria-label'),un:__i18n.untranslated().filter(x=>/基準|音律|純正律|平均律/.test(x))}));
ok('english',R.en.sys.join('|')==='5-limit just intonation|12-tone equal temperament'&&R.en.lbl==='Reference A4'&&R.en.aria==='Tuning'&&R.en.un.length===0);
ok('no_overflow_en',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));await pg.evaluate(()=>__i18n.set('ja'));await W(200);
ok('no_overflow_ja',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));
const src=fs.readFileSync(__dirname+'/src_i18n.js','utf8');const line=src.split('\n').find(l=>l.startsWith("'基準 A4':'Reference A4'"));ok('i18n_parity',!!line&&html.includes(line+'\n'));
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
