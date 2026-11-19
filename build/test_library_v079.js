// v0.79 実録音の取り込み（23本：Freesound 17・Wikimedia Commons 6、録音は 127→150）の回帰テスト。2026-11-19 追加。
// python3 -m http.server 8765 で配信し、本体の直下に音源リポジトリへのリンク audio-ecosystem-sounds-1 を置いて実行する。
// 確認：①全体150本・v0.79 が23本（環境層16・虫の合唱1・楽器の単発音6）②権利は CC0／CC BY 3.0／CC BY 2.1 JP／パブリックドメインだけ（BY-SA・NC なし）・台帳の rightsTier が A/B
// ③Commons の6本は原典 URL が commons.wikimedia.org、Freesound の17本は freesound.org ④非可逆の原本（Ogg・m4a）と浮動小数の原本は changes／notes に変換を記録
// ⑤23本の配信 FLAC・互換 MP3・軽量 MP3 がデコードでき、長さが台帳と合い無音でない ⑥環境層16本が音量欄に出る ⑦CREDITS.md に23行
// ⑧英語表示で環境音タブに未翻訳が残らない・390px で横にはみ出さない・コンソールエラー0。
// 軽量 MP3 の長さの許容は 0.15 秒（11kHz の梵鐘は MP3 の1フレームが約0.1秒のため）。聴感（区間の選び方・音量）と実機（iPhone Safari）での再生は未検証。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:390,height:900}});await require('./photo_fixture')(pg);const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
R.lib=await pg.evaluate(()=>{const recs=JSON.parse(document.getElementById('ae-recordings').textContent),man=JSON.parse(document.getElementById('ae-audio-manifest').textContent);
 const v=recs.filter(r=>r.added==='v0.79');return {total:recs.length,n:v.length,lic:[...new Set(v.map(r=>r.license))].sort(),beds:v.filter(r=>r.fieldBed).map(r=>r.id),
  mixed:v.filter(r=>r.kind==='mixed').length,oneShot:v.filter(r=>r.group==='landscape'&&!r.fieldBed).length,
  commons:v.filter(r=>/commons\.wikimedia\.org\/wiki\/File:/.test(r.url)).length,freesound:v.filter(r=>/^https:\/\/freesound\.org\/people\/[^/]+\/sounds\/\d+\/$/.test(r.url)).length,
  lossyNoted:v.filter(r=>/^(vorbis|aac)/.test(r.format)).every(r=>/24-bit 整数に変換/.test(r.changes)&&r.pcmEquality===false),
  floatNoted:['tokyo-night-rain','tokyo-balcony-crickets'].every(id=>{const r=v.find(x=>x.id===id);return r&&/浮動小数/.test(r.notes)}),
  pathsOk:v.every(r=>man.recordings[r.id]&&man.recordings[r.id].pcm.parts.every(p=>p.path.startsWith('../audio-ecosystem-sounds-1/audio/pcm/'))&&man.recordings[r.id].compat.path.startsWith('../audio-ecosystem-sounds-1/audio/compat/')&&man.recordings[r.id].lite&&man.recordings[r.id].lite.path.startsWith('../audio-ecosystem-sounds-1/audio/lite/')),
  ids:v.map(r=>r.id)}});
ok('count',R.lib.total===150&&R.lib.n===23&&R.lib.beds.length===16&&R.lib.mixed===1&&R.lib.oneShot===6);
ok('licenses',R.lib.lic.join()==='CC BY 2.1 JP,CC BY 3.0,CC0 1.0,Public domain');ok('sources',R.lib.commons===6&&R.lib.freesound===17);
ok('lossy_noted',R.lib.lossyNoted);ok('float_noted',R.lib.floatNoted);ok('paths',R.lib.pathsOk);
const led=JSON.parse(fs.readFileSync(__dirname+'/../data/recording_licenses.json','utf8'));const lv=led.filter(r=>r.added==='v0.79');
ok('ledger_tier',lv.length===23&&lv.every(r=>['A','B'].includes(r.rightsTier))&&!lv.some(r=>/BY-SA|NC|ND/.test(r.license)));
ok('ledger_ids_unique',new Set(led.map(r=>r.id)).size===led.length);
const cr=fs.readFileSync(__dirname+'/../CREDITS.md','utf8');R.creditsMissing=R.lib.ids.filter(id=>!cr.includes('| '+id+' |'));ok('credits',R.creditsMissing.length===0);
R.decode=await pg.evaluate(async ids=>{const man=JSON.parse(document.getElementById('ae-audio-manifest').textContent).recordings,oc=new OfflineAudioContext(2,48000,48000),bad=[];
 for(const id of ids){for(const kind of ['pcm','compat','lite']){const e=man[id][kind],p=kind==='pcm'?e.parts[0].path:e.path;
  try{const buf=await (await fetch(p)).arrayBuffer();const a=await oc.decodeAudioData(buf);let pk=0;const d=a.getChannelData(0);for(let i=0;i<d.length;i+=7)pk=Math.max(pk,Math.abs(d[i]));
   if(Math.abs(a.duration-e.duration)>(kind==='pcm'?.01:kind==='lite'?.15:.08)||pk<1e-4)bad.push(id+':'+kind+' dur '+a.duration.toFixed(3)+'/'+e.duration+' pk '+pk.toExponential(2))}catch(er){bad.push(id+':'+kind+' '+er.message)}}}return bad},R.lib.ids);
ok('decode_all',R.decode.length===0);
R.controls=await pg.evaluate(()=>[...document.querySelectorAll('#fieldControls input')].map(i=>i.id));ok('bed_controls',R.lib.beds.every(id=>R.controls.includes('field-'+id)));
await pg.click('#langToggle');await pg.waitForTimeout(300);const un=new Set();
for(const tab of ['landscape','insects']){await pg.evaluate(t=>{const b=document.querySelector('#bioTabs [data-tab="'+t+'"]');if(b)b.click()},tab);await pg.waitForTimeout(300);
 for(const x of await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()}))un.add(x)}
R.untranslated=[...un].filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));ok('no_untranslated',R.untranslated.length===0);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
