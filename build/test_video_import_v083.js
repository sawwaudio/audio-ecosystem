// v0.83 「自分の音」に動画ファイルを入れると、音声だけを取り出して使える（2026-11-22 オーナー指示）。
// python3 -m http.server 8765 で本体を配信して実行する。テスト用の動画は ffmpeg で作る（音つき WebM・音なし WebM）。
// 1) ブラウザがそのまま読める動画（decodeAudioData）　2) 読めない動画（decodeAudioData を失敗させて、再生しながら取り出す経路）　3) 音のない動画は断る
const {chromium}=require('playwright');const {execFileSync}=require('child_process');const fs=require('fs'),os=require('os'),path=require('path');(async()=>{
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'saevid-'));const clip=path.join(dir,'my clip.webm'),silent=path.join(dir,'silent.webm');
execFileSync('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=3','-f','lavfi','-i','color=c=blue:s=320x240:d=3','-shortest','-c:v','libvpx-vp9','-b:v','200k','-c:a','libopus',clip]);
execFileSync('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=red:s=320x240:d=2','-c:v','libvpx-vp9','-an',silent]);
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};const errs=[];
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
async function page(){const pg=await (await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'})).newPage();pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('http://localhost:8765/index.html?lang=ja',{waitUntil:'domcontentloaded'});await pg.waitForTimeout(1500);return pg}
const state=pg=>pg.evaluate(()=>({tiles:[...document.querySelectorAll('#tileGrid .tile, #tileGrid [data-id]')].map(t=>t.textContent.trim()).filter(t=>/my clip/.test(t)).length,status:(document.getElementById('message')||{}).textContent||document.body.innerText.match(/(件の音を読み込みました[^\n]*|この動画[^\n]*|取り出し[^\n]*)/)?.[0]||''}));
// accept 属性に動画が入っている
{const pg=await page();R.accept=await pg.evaluate(()=>document.getElementById('tileUserFile').accept);ok('accept_video',/video\/\*/.test(R.accept)&&/\.mp4/.test(R.accept)&&/\.mov/.test(R.accept));
 // 1) 直接読める動画
 await pg.setInputFiles('#tileUserFile',clip);await pg.waitForTimeout(2500);
 R.direct=await pg.evaluate(()=>({user:[...(window.__userSoundsDebug?__userSoundsDebug():[])],msg:document.body.innerText.match(/\d+件の音を読み込みました[^\n]*/)?.[0]||''}));
 ok('direct_loaded',/1件の音を読み込みました/.test(R.direct.msg)&&/動画は音声だけ/.test(R.direct.msg));
 // 3) 音のない動画
 await pg.setInputFiles('#tileUserFile',silent);await pg.waitForTimeout(3500);
 R.silentMsg=await pg.evaluate(()=>document.body.innerText.match(/silent\.webm: [^\n]*/)?.[0]||'');ok('silent_rejected',/音声がありません/.test(R.silentMsg));await pg.close()}
// 2) 直接は読めない動画：decodeAudioData を失敗させ、再生しながら取り出す
{const pg=await page();await pg.evaluate(()=>{const P=(window.AudioContext||window.webkitAudioContext).prototype,orig=P.decodeAudioData;P.decodeAudioData=function(ab){const u=new Uint8Array(ab.slice?ab.slice(0,4):ab);if(u[0]===0x1a&&u[1]===0x45)return Promise.reject(new DOMException('fake','EncodingError'));return orig.apply(this,arguments)}});
 await pg.setInputFiles('#tileUserFile',clip);let msg='';for(let i=0;i<30&&!/件の音を読み込みました/.test(msg);i++){await pg.waitForTimeout(500);msg=await pg.evaluate(()=>document.body.innerText.match(/(\d+件の音を読み込みました[^\n]*|my clip\.webm: [^\n]*)/)?.[0]||'')}
 R.fallback=msg;ok('fallback_playback_loaded',/1件の音を読み込みました/.test(msg));await pg.close()}
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon/.test(e));ok('no_page_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();fs.rmSync(dir,{recursive:true,force:true});process.exit(fail.length?1:0)})();
