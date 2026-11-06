// v0.38 実録音の一括取り込み（86本）の回帰テスト。
// 音源は別リポジトリ sawwaudio/audio-ecosystem-sounds-1 に置き、本体からは ../audio-ecosystem-sounds-1/ で読む。
// ローカルでは本体の直下に audio-ecosystem-sounds-1 という名前で音源リポジトリへのリンク（.gitignore 済み）を置いて配信する。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});await require('./photo_fixture')(pg);const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
// 1) 台帳：86本が v0.38 として入り、権利は CC0／CC BY のみ（BY-SA・NC の新規採用なし）
R.lib=await pg.evaluate(()=>{const recs=JSON.parse(document.getElementById('ae-recordings').textContent),man=JSON.parse(document.getElementById('ae-audio-manifest').textContent);
 const v=recs.filter(r=>r.added==='v0.38');return {total:recs.length,n:v.length,lic:[...new Set(v.map(r=>r.license))].sort(),beds:v.filter(r=>r.fieldBed).length,
  pathsOk:v.every(r=>man.recordings[r.id]&&man.recordings[r.id].pcm.parts.every(p=>p.path.startsWith('../audio-ecosystem-sounds-1/audio/pcm/'))&&man.recordings[r.id].compat.path.startsWith('../audio-ecosystem-sounds-1/audio/compat/')),
  ids:v.map(r=>r.id)}});
ok('count',R.lib.total===127&&R.lib.n===86&&R.lib.beds===17);ok('licenses',R.lib.lic.join()==='CC BY 3.0,CC BY 4.0,CC0 1.0');ok('paths',R.lib.pathsOk);
// 2) 86本すべてを FLAC と互換MP3の両方でデコードできる（長さが台帳と一致・無音でない）
R.decode=await pg.evaluate(async ids=>{const man=JSON.parse(document.getElementById('ae-audio-manifest').textContent).recordings,oc=new OfflineAudioContext(2,48000,48000),bad=[];
 for(const id of ids){for(const kind of ['pcm','compat']){const e=man[id][kind],p=kind==='pcm'?e.parts[0].path:e.path;
  try{const buf=await (await fetch(p)).arrayBuffer();const a=await oc.decodeAudioData(buf);let pk=0;const d=a.getChannelData(0);for(let i=0;i<d.length;i+=7)pk=Math.max(pk,Math.abs(d[i]));
   if(Math.abs(a.duration-e.duration)>(kind==='pcm'?.01:.06)||pk<1e-4)bad.push(id+':'+kind+' dur '+a.duration.toFixed(3)+'/'+e.duration+' pk '+pk.toExponential(2))}catch(er){bad.push(id+':'+kind+' '+er.message)}}}return bad},R.lib.ids);
ok('decode_all',R.decode.length===0);
// 3) これまで合成の模倣音しかなかった生き物に実録音が入った（キツネ・オオカミ・ザトウクジラ・イルカ・モリフクロウ・ミソサザイ・サヨナキドリ）
R.real=await pg.evaluate(()=>{const recs=JSON.parse(document.getElementById('ae-recordings').textContent);return ['fox','wolf','humpback','dolphin','tawny-owl','eurasian-wren','nightingale'].filter(id=>!recs.some(r=>r.id===id))});ok('former_synth_now_real',R.real.length===0);
// 4) 自律演奏の候補に入り、実際に鳴る（動物の録音を全部参加させて30秒）
await pg.evaluate(()=>{const recs=JSON.parse(document.getElementById('ae-recordings').textContent);for(const r of recs)if(r.added==='v0.38'&&r.group==='animals'&&__bioDebug.settings[r.id])__bioDebug.settings[r.id].enabled=true});
await pg.click('#play');await pg.waitForTimeout(30000);
R.played=await pg.evaluate(()=>__bioDebug.history().map(h=>h.id));
R.newPlayed=await pg.evaluate(ids=>ids.filter(id=>JSON.parse(document.getElementById('ae-recordings').textContent).some(r=>r.id===id&&r.added==='v0.38')),R.played);
ok('new_recordings_play',R.newPlayed.length>=2);
// 5) 英語表示：新しい名前・学名欄・国名に日本語が残らない（生き物の3つのタブを開いて確認）
await pg.click('#langToggle');await pg.waitForTimeout(300);const un=new Set();
for(const tab of ['birds','insects','animals']){await pg.evaluate(t=>{const b=document.querySelector('#bioTabs [data-tab="'+t+'"]');if(b)b.click()},tab);await pg.waitForTimeout(300);
 for(const x of await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()}))un.add(x)}
R.untranslated=[...un].filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));ok('no_untranslated',R.untranslated.length===0);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
