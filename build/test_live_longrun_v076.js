// 配信（?live=auto）の長時間の安定性の回帰テスト（バックログ d）。2026-11-16 自動実行で追加。python3 -m http.server 8765 で配信して実行する（約2分）。
// 確認：①data/live_weights.json の重みが読まれる ②5分ごとの画面の順番（1000区間）で同じ画面が続かず、重み0の画面は出ない、重みの大きい calm が最多・geometry が最少
// ③&w= で重みを上書きできる ④音の入れ替え（約2分半ごと）を60回＝約2時間半ぶん続けても、参加メンバーは BY-SA を含まず・商用モードの範囲内・環境音は同時2つまで・メンバー数が増え続けない・入れ替わる
// ⑤5種類の画面をそれぞれ描き続けてもエラー0・フレームが進む ⑥JS のヒープが増え続けない（最初と最後の差が 40MB 未満）・PCM の予算内 ⑦閉じると描画が止まる。
// 実時間の2時間半の連続再生・実機（iPhone Safari・OBS）での確認は未検証（テストは入れ替えを早回しで呼ぶ）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--enable-precise-memory-info','--js-flags=--expose-gc']});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const errs=[];
const W8=JSON.parse(require('fs').readFileSync(__dirname+'/../data/live_weights.json','utf8')).weights;
const page=async q=>{const cx=await b.newContext({viewport:{width:1280,height:720}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
 await pg.goto('http://localhost:8765/index.html'+(q||''));await pg.waitForTimeout(900);return {cx,pg}};
// ①〜② 既定の重み
{const {cx,pg}=await page();await pg.click('#play');await pg.waitForTimeout(1500);await pg.evaluate(()=>__liveDebug.open('auto'));await pg.waitForTimeout(1200);
 const st=await pg.evaluate(()=>{const s=__liveDebug.state();const seq=[];for(let k=0;k<1000;k++)seq.push(__liveDebug.styleAt(k));return {w:s.weights,seq,rights:__rightsDebug.mode}});
 ok('weights_from_json',Object.keys(W8).every(k=>Math.abs((st.w[k]||0)-W8[k])<1e-9));
 const cnt={};let rep=0;st.seq.forEach((x,i)=>{cnt[x]=(cnt[x]||0)+1;if(i&&st.seq[i-1]===x)rep++});R.counts=cnt;
 ok('no_repeat',rep===0);ok('zero_weight_absent',Object.keys(cnt).every(k=>(W8[k]||0)>0));
 const top=Object.keys(W8).sort((a,b)=>W8[b]-W8[a]),low=top[top.length-1];ok('heaviest_most',cnt[top[0]]===Math.max(...Object.values(cnt)));ok('lightest_least',(cnt[low]||0)===Math.min(...Object.keys(W8).filter(k=>W8[k]>0).map(k=>cnt[k]||0)));
 ok('live_rights_nosa',st.rights!=='all');
 // ④ 音の入れ替えを60回
 const recs=await pg.evaluate(()=>Object.fromEntries(__bioDebug.recordings.map(r=>[r.id,{field:!!r.fieldBed,lic:String(r.license||'')}])));
 const heap=()=>pg.evaluate(()=>{try{if(window.gc)gc()}catch(e){}return performance.memory?performance.memory.usedJSHeapSize:0});
 await pg.waitForTimeout(500);const h0=await heap();const seen=new Set();let maxN=0,maxField=0,bad=[],changes=0,prev=null,pcmOver=0;const sizes=[];
 for(let i=0;i<60;i++){const m=await pg.evaluate(()=>{__liveDebug.state().drift();return {m:__liveDebug.state().members(),allowed:__liveDebug.state().members().map(id=>__rightsDebug.allowed(id)),st:__bioDebug.stats()}});
  await pg.waitForTimeout(250);
  m.m.forEach(x=>seen.add(x));maxN=Math.max(maxN,m.m.length);sizes.push(m.m.length);const f=m.m.filter(id=>recs[id]&&recs[id].field).length;maxField=Math.max(maxField,f);
  m.m.forEach((id,j)=>{if(!m.allowed[j]||/BY-SA/i.test((recs[id]||{}).lic||''))bad.push(id)});
  const key=m.m.slice().sort().join(',');if(prev!==null&&key!==prev)changes++;prev=key;if(m.st&&m.st.pcmBudget&&m.st.pcmBytes>m.st.pcmBudget)pcmOver++}
 await pg.waitForTimeout(3000);const h1=await heap();R.drift={maxMembers:maxN,maxField,seen:seen.size,changes,bad:[...new Set(bad)].slice(0,5),lastSizes:sizes.slice(-5),heapMB:[(h0/1048576).toFixed(1),(h1/1048576).toFixed(1)],pcmOver};
 ok('drift_rights',bad.length===0);ok('drift_field_max2',maxField<=2);ok('drift_bounded',maxN<=6&&sizes.slice(-10).every(n=>n<=6));ok('drift_changes',changes>=40&&seen.size>=8);
 ok('heap_bounded',h0>0&&h1-h0<40*1048576);ok('pcm_budget',pcmOver===0);
 // ⑤ 5種類の画面
 R.frames={};for(const mode of ['contour','flow','geometry','creature','calm']){await pg.evaluate(m=>__liveDebug.open(m),mode);const f0=await pg.evaluate(()=>__liveDebug.state().frames);await pg.waitForTimeout(2500);
  const s=await pg.evaluate(()=>__liveDebug.state());R.frames[mode]=s.frames-f0;ok('draw_'+mode,s.on&&s.mode===mode&&s.frames-f0>5)}
 // ⑦ 閉じる
 await pg.evaluate(()=>__liveDebug.close());const fa=await pg.evaluate(()=>__liveDebug.state().frames);await pg.waitForTimeout(800);const fb=await pg.evaluate(()=>__liveDebug.state());
 ok('close_stops',!fb.on&&fb.frames===fa&&await pg.evaluate(()=>document.getElementById('liveStage').hidden));
 await cx.close()}
// ③ &w= の上書き
{const {cx,pg}=await page('?w=contour:1,flow:2,calm:0,geometry:0,creature:0');await pg.evaluate(()=>__liveDebug.open('auto'));await pg.waitForTimeout(800);
 const seq=await pg.evaluate(()=>{const a=[];for(let k=0;k<200;k++)a.push(__liveDebug.styleAt(k));return a});const set=new Set(seq);R.query=[...set];
 ok('query_weights',set.size===2&&set.has('contour')&&set.has('flow'));await pg.evaluate(()=>__liveDebug.close());await cx.close()}
ok('no_errors',errs.length===0);R.errs=errs.slice(0,8);
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
