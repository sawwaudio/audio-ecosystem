// v0.53：軽くする（軽量の音源が既定・端末への保存・電波なしでの再表示）と、画面の重複を減らした変更の回帰テスト。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクと、build/make_lite_audio.py で作った audio/lite/ が必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};
const errs=[];const watch=pg=>{pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR_/.test(m.text()))errs.push('CONSOLE '+m.text())})};

// ── A. 既定は軽量・通信量・音量の一致・高音質への切り替え（Service Worker なし）──
{const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);watch(pg);
 let bytes=0,flac=0,lite=0;pg.on('response',async r=>{if(!/\/(audio|instruments)\//.test(r.url()))return;const n=(await r.body().catch(()=>Buffer.alloc(0))).length;bytes+=n;if(/\.flac$/.test(r.url()))flac++;if(/\/audio\/lite\//.test(r.url()))lite++});
 await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-source-mode')}catch(e){}});await pg.reload();await pg.waitForTimeout(900);
 R.mode=await pg.evaluate(()=>({mode:__sourceDebug.mode,seg:[...document.querySelectorAll('#netPanel [data-q]')].map(b=>b.dataset.q+':'+b.getAttribute('aria-checked')).join(),sel:document.getElementById('sourceMode').value,
  lite:Object.values(__sourceDebug.manifest.recordings).filter(m=>m.lite).length}));
 ok('default_lite',R.mode.mode==='lite'&&R.mode.seg==='lite:true,pcm:false'&&R.mode.sel==='lite'&&R.mode.lite===118);
 await pg.click('#play');await pg.waitForTimeout(15000);
 R.play={mb:+(bytes/1048576).toFixed(2),flac,lite,log:await pg.evaluate(()=>[...new Set(__sourceDebug.log().map(l=>l.key))].join())};
 ok('light_traffic',R.play.mb<9&&R.play.flac===0&&R.play.lite>0&&/lite/.test(R.play.log)&&!/pcm/.test(R.play.log));
 // 軽量と FLAC で、聞こえる音量（RMS × gain）がそろっていること
 R.level=await pg.evaluate(async()=>{const out={};const ac=new OfflineAudioContext(2,48000,48000);
  for(const id of ['takayama-river','waves-big-lagoon','cicada','blackbird']){const m=__sourceDebug.manifest.recordings[id];const rms=async e=>{const buf=await ac.decodeAudioData(await (await fetch((e.parts?e.parts[0]:e).path)).arrayBuffer());let s=0,n=0;for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=0;i<d.length;i+=7){s+=d[i]*d[i];n++}}return Math.sqrt(s/n)*(e.gain||1)};
   out[id]=+(20*Math.log10(await rms(m.lite)/await rms(m.pcm))).toFixed(2)}return out});
 ok('level_match',Object.values(R.level).every(d=>Math.abs(d)<0.5));
 await pg.click('#netPanel [data-q="pcm"]');await pg.waitForTimeout(300);
 R.hq=await pg.evaluate(async()=>{await __bioDebug.loadOne('blackbird');return {mode:__sourceDebug.mode,last:__sourceDebug.log().slice(-1)[0].key,badge:document.getElementById('netBadge').textContent,sel:document.getElementById('sourceMode').value}});
 ok('switch_hq',R.hq.mode==='pcm'&&R.hq.last==='pcm'&&R.hq.badge==='高音質'&&R.hq.sel==='pcm');
 await pg.click('#netPanel [data-q="lite"]');await pg.waitForTimeout(300);ok('switch_back',await pg.evaluate(()=>__sourceDebug.mode==='lite'&&localStorage.getItem('ae-source-mode')==='lite'));
 // ── 画面の重複を減らした所 ──
 R.ui=await pg.evaluate(()=>{const y=id=>{const e=document.getElementById(id);return e?Math.round(e.getBoundingClientRect().top+scrollY):-1};const dev=document.getElementById('devPanel');
  return {filters:[...document.querySelectorAll('#tileFilters button')].map(b=>b.dataset.f).join(),
   order:['netPanel','rightsPanel','presetSection','creditsPanel'].map(y),devClosed:!dev.open,devHas:['sourceSection','auditPanel','dbPanel','diagPanel'].every(id=>dev.contains(document.getElementById(id))),
   plans:!!document.querySelector('#plansBody details#planCompare:not([open]) table.planTable')&&!!document.querySelector('#plansBody .planCards'),
   labels:['change','auto','quality','save','restore','reset','exportPreset','importPreset'].map(id=>document.getElementById(id).textContent).join('|'),
   tier:[...document.querySelectorAll('#tileGrid .tile:not(.blocked) .tileTier')].every(e=>getComputedStyle(e).display==='none')}});
 ok('filters',R.ui.filters==='all,birds,insects,amphibians,mammals,aquatic,japan');
 ok('settings_order',R.ui.order.every((v,i,a)=>v>0&&(i===0||v>a[i-1]))&&R.ui.devClosed&&R.ui.devHas);
 ok('plans_folded',R.ui.plans);
 ok('japanese_labels',R.ui.labels==='✧ 和音を変える|自動作曲 オン|音の細かさ：高|この端末に保存|保存した設定に戻す|初期設定に戻す|↓ ファイルに書き出す|↑ ファイルから読み込む');
 ok('tier_hidden',R.ui.tier);
 await pg.evaluate(()=>{const ac=new OfflineAudioContext(1,4800,48000);__studioDebug.addUser('テストの音',ac.createBuffer(1,4800,48000))});await pg.waitForTimeout(200);
 R.userFilter=await pg.evaluate(()=>[...document.querySelectorAll('#tileFilters button')].map(b=>b.dataset.f).join());ok('user_filter',R.userFilter.endsWith(',user'));
 await pg.click('#auto');await pg.waitForTimeout(100);R.autoOff=await pg.textContent('#auto');await pg.click('#auto');
 await pg.click('#langToggle');await pg.waitForTimeout(500);
 const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0','テストの音'].includes(x)&&!/テストの音/.test(x)); // 利用者の音の名前は訳さないR.untranslated=un;
 R.en=await pg.evaluate(()=>({net:document.querySelector('#netPanel .title').textContent,seg:document.querySelector('#netPanel [data-q="lite"]').textContent,save:document.getElementById('save').textContent,auto:document.getElementById('auto').textContent}));
 ok('english',un.length===0&&R.en.net==='Quality & data'&&/^Light/.test(R.en.seg)&&R.en.save==='Save on this device'&&R.en.auto==='AUTO COMPOSE ON'&&R.autoOff==='自動作曲 オフ');
 await pg.click('#langToggle');await pg.waitForTimeout(300);ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
 await cx.close()}

// ── B. 端末への保存：一度鳴らした音は、電波がなくても鳴る（Service Worker。?sw=1 で自動テストでも登録）──
{const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();watch(pg);
 await pg.route(/fonts\.(googleapis|gstatic)\.com|upload\.wikimedia\.org/,r=>r.abort());
 await pg.goto('http://localhost:8765/index.html?sw=1');await pg.evaluate(()=>navigator.serviceWorker.ready);await pg.reload();await pg.waitForTimeout(800);
 R.sw={controlled:await pg.evaluate(()=>!!navigator.serviceWorker.controller)};
 await pg.click('#play');await pg.waitForTimeout(1500);await pg.evaluate(async()=>{await __bioDebug.loadOne('takayama-river');await __bioDebug.loadOne('blackbird')});await pg.waitForTimeout(1500);
 R.sw.cached=await pg.evaluate(async()=>{const c=await caches.open('saww-media-1');return (await c.keys()).map(k=>k.url.split('/').pop())});
 await pg.evaluate(()=>document.getElementById('netPanel').scrollIntoView());await pg.waitForTimeout(8500);R.sw.status=await pg.textContent('#netStatus');
 ok('sw_cache',R.sw.controlled&&R.sw.cached.includes('takayama-river.mp3')&&R.sw.cached.includes('blackbird.mp3')&&/保存済み：\d+個/.test(R.sw.status));
 await cx.setOffline(true);await pg.reload();await pg.waitForTimeout(1200);await pg.click('#play');await pg.waitForTimeout(1500);
 R.off={title:await pg.title(),load:await pg.evaluate(async()=>{try{const b=await __bioDebug.loadOne('takayama-river');return 'ok'}catch(e){return 'ng '+e.message}}),
  key:await pg.evaluate(()=>(__sourceDebug.log().slice(-1)[0]||{}).key)};
 ok('offline_reload',/v0\.53/.test(R.off.title)&&R.off.load==='ok'&&R.off.key==='lite');
 await cx.setOffline(false);await pg.evaluate(()=>__studioDebug.stopEverything());if(await pg.evaluate(()=>document.getElementById('play').getAttribute('aria-pressed')==='true'))await pg.click('#play');await pg.waitForTimeout(2500);await pg.click('#netClear');await pg.waitForTimeout(800);
 R.sw.cleared=await pg.evaluate(async()=>(await caches.has('saww-media-1'))?(await (await caches.open('saww-media-1')).keys()).length:0);ok('sw_clear',R.sw.cleared===0);
 await cx.close()}
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
