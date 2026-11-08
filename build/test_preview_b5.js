// バックログ5「実録音ライブラリの▶が自律演奏中に即フェードされる（v0.23 由来）」の確認テスト（2026-11-08 自動実行で追加）。python3 -m http.server 8765 で配信して実行する。
// 現在の仕様：試聴（▶）は自律演奏を止め、選んだ録音だけを再生する。自律演奏の停止処理（フェード）が試聴の音を止めないことを確かめる。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:900}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
const badge=()=>pg.evaluate(()=>document.getElementById('statusBadge').textContent);
const st=()=>pg.evaluate(()=>{const a=document.getElementById('previewPlayer');return {paused:a.paused,t:a.currentTime,src:a.currentSrc||'',status:document.getElementById('previewStatus').textContent}});
// 1. 自律演奏を始める
await pg.click('#play');await pg.waitForTimeout(3000);R.badgePlay=await badge();ok('autonomous_on',/LIVE/.test(R.badgePlay));
// 2. 自律演奏中に実録音ライブラリの最初の▶を押す（無料版で鳴らせる・商用モードの対象のもの）
const label=await pg.evaluate(()=>{let d=document.getElementById('realRecordings');while(d){if(d.tagName==='DETAILS')d.open=true;d=d.parentElement}
 for(const x of document.querySelectorAll('#realButtons button')){x.click();const s=document.getElementById('previewStatus').textContent;if(!/PRO|対象外|未収録/.test(s))return x.textContent;}return null});
R.label=label;ok('preview_button_found',!!label);
await pg.waitForTimeout(1500);const s1=await st();
// 3. 自律演奏の停止（フェード）が終わった後も、試聴は鳴り続ける
await pg.waitForTimeout(3500);const s2=await st();R.s1=s1;R.s2={paused:s2.paused,t:s2.t,status:s2.status};
ok('preview_not_paused',!s2.paused);ok('preview_volume',await pg.evaluate(()=>document.getElementById('previewPlayer').volume)>0.75);ok('preview_advances',s2.t>s1.t+2.5);ok('preview_status',/再生中|秒/.test(s2.status)&&!/停止|エラー/.test(s2.status));
R.badgeAfter=await badge();ok('autonomous_paused',!/LIVE/.test(R.badgeAfter));
// 4. 試聴を止める → 止まる
await pg.evaluate(()=>document.getElementById('stopPreview').click());await pg.waitForTimeout(300);const s3=await st();ok('stop_preview',s3.paused&&/試聴停止/.test(s3.status));
// 5. 自律演奏をもう一度始めると、試聴は止まったまま・自律演奏は鳴る
await pg.evaluate(()=>{const bs=[...document.querySelectorAll('#realButtons button')];for(const x of bs){x.click();if(!/PRO|対象外|未収録/.test(document.getElementById('previewStatus').textContent))break}});await pg.waitForTimeout(1200);
await pg.click('#play');await pg.waitForTimeout(1500);const s4=await st();ok('play_stops_preview',s4.paused);R.badgeReplay=await badge();ok('autonomous_again',/LIVE/.test(R.badgeReplay));
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
