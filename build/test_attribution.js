// 帰属表示（v0.25）の回帰テスト。python3 -m http.server 8765 で配信して実行する。
// 確認：録音中に鳴った素材の記録、WAV の LIST/INFO（ICMT）への埋め込み、WAV が復号できること、
// クレジット文書の保存、全素材の帰属表示、英語表示での文言、横はみ出し、コンソールエラー0。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
await pg.click('#play');await pg.waitForTimeout(4000);
ok('autoplay_running',await pg.evaluate(()=>__audioEcosystemDebug.getState().audioState==='running'));
// 録音開始 → 実録音を2種強制発音 → 停止・書き出し
const dl=pg.waitForEvent('download',{timeout:30000});
await pg.evaluate(async()=>{await __audioEcosystemDebug.startRecord()});
// 注：playSpecies(id,true) は <audio> 試聴（自律演奏を止める）なので録音対象外。ここでは自律演奏で鳴る素材を使う。
await pg.waitForTimeout(6000);
const used=await pg.evaluate(()=>__audioEcosystemDebug.attribution().used.map(u=>u.kind+':'+u.id));R.used=used;
ok('used_tracked',used.length>=1&&used.some(u=>/^recording:(cicada|tsukutsukuboshi)$/.test(u)));
await pg.click('#stopRecord');
const d=await dl;R.wavName=d.suggestedFilename();ok('wav_name',/^audio_ecosystem_.*\.wav$/.test(R.wavName));
const fs=require('fs');const buf=fs.readFileSync(await d.path());
// RIFF を走査
const chunks={};let o=12;ok('riff',buf.toString('ascii',0,4)==='RIFF'&&buf.readUInt32LE(4)===buf.length-8&&buf.toString('ascii',8,12)==='WAVE');
while(o+8<=buf.length){const id=buf.toString('ascii',o,o+4),sz=buf.readUInt32LE(o+4);chunks[id]={o,sz};if(id==='LIST'){let p=o+12;const info={};while(p+8<=o+8+sz){const k=buf.toString('ascii',p,p+4),n=buf.readUInt32LE(p+4);info[k]=buf.toString('utf8',p+8,p+8+n).replace(/\0+$/,'');p+=8+n+(n%2)}chunks.info=info}o+=8+sz+(sz%2)}
R.chunks=Object.keys(chunks);ok('chunks',!!chunks['fmt ']&&!!chunks.data&&!!chunks.LIST&&o===buf.length);
const icmt=chunks.info?.ICMT||'';R.icmtHead=icmt.split('\r\n').slice(0,3);
const exp=await pg.evaluate(ids=>ids.map(k=>{const [kind,id]=k.split(':');const r=kind==='recording'?JSON.parse(document.getElementById('ae-recordings').textContent).find(x=>x.id===id):JSON.parse(document.getElementById('ae-instruments').textContent).find(x=>x.id===id);return {title:r.title||r.original,author:r.author,license:r.license,url:r.url||r.sourceURL}}),used);
ok('icmt_has_sources',exp.every(e=>icmt.includes(e.title)&&icmt.includes(e.author)&&icmt.includes(e.license)&&icmt.includes(e.url)));
ok('icmt_bysa_note',!exp.some(e=>/BY-SA/.test(e.license))||icmt.includes('Adaptations of CC BY-SA'));ok('isft',(chunks.info?.ISFT||'').startsWith('AUDIO ECOSYSTEM'));
// ブラウザで復号できるか（LIST 付きでも再生可能）
R.decode=await pg.evaluate(async b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const ac=new OfflineAudioContext(2,44100,44100);const ab=await ac.decodeAudioData(bin.buffer);return {ch:ab.numberOfChannels,dur:ab.duration}},buf.toString('base64'));
ok('wav_decodes',R.decode.ch===2&&R.decode.dur>0.1);
// 画面のクレジット欄と保存
await pg.waitForTimeout(300);
ok('credits_panel',await pg.evaluate(()=>!document.getElementById('recordCredits').hidden&&document.getElementById('recordCreditsText').textContent.length>200));
R.summary=await pg.textContent('#recordCreditsSummary');
const dl2=pg.waitForEvent('download');await pg.click('#recordCreditsSave');const d2=await dl2;R.txtName=d2.suggestedFilename();
const txt=fs.readFileSync(await d2.path(),'utf8');ok('txt_saved',/_credits\.txt$/.test(R.txtName)&&txt.includes('Σ64')&&txt===('﻿'+icmt));
// 全素材の帰属表示（41録音＋15楽器）
await pg.evaluate(()=>{document.getElementById('realRecordings').open=true;document.querySelectorAll('#realRecordings details').forEach(d=>d.open=true)});
const dl3=pg.waitForEvent('download');await pg.click('#creditsAttribution');const d3=await dl3;const lib=fs.readFileSync(await d3.path(),'utf8');
R.libLines=lib.split('\r\n').filter(l=>/^\d+\. /.test(l)).length;ok('library_142',R.libLines===142);  // v0.38：録音127＋楽器15
// 英語表示
await pg.click('#langToggle');await pg.waitForTimeout(300);R.summaryEn=await pg.textContent('#recordCreditsSummary');
ok('summary_en',/^Credits for this capture: \d+ source\(s\) \(\d+ require attribution\)$/.test(R.summaryEn));
const un=await pg.evaluate(()=>__i18n.untranslated());R.untranslated=un.filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));ok('no_untranslated',R.untranslated.length===0);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.click('#langToggle');
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
