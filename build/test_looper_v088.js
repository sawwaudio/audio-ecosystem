// v0.88 6ch ルーパー（サンプラーの欄）の回帰テスト。python3 -m http.server 8765 で本体を配信して実行する。
// 録る→ループになる、重ね録り→↶で戻る、速さ・逆再生、別チャンネルを録る時にルーパーの音が入らない、保存→一覧→読み込み→削除（2回押し）、英語、はみ出し。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];
const pg=await b.newPage({viewport:{width:390,height:900}});pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await pg.goto('http://localhost:8765/index.html?lang=ja');await pg.waitForTimeout(2000);
await pg.evaluate(()=>{const s=document.getElementById('samplerSection');for(let n=s;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true});
R.ui=await pg.evaluate(()=>({chs:document.querySelectorAll('.lpCh').length,summary:document.querySelector('#samplerSection summary span').textContent,lib:document.getElementById('lpLib').textContent}));
ok('ui',R.ui.chs===6&&R.ui.summary.startsWith('サンプラー / ルーパー')&&/まだありません/.test(R.ui.lib));
// 自律演奏の前は録れない（案内が出る）
await pg.click('.lpCh[data-ch="0"] .lpRec');await pg.waitForTimeout(300);ok('needs_audio',/自律演奏/.test(await pg.textContent('#lpMsg')));
await pg.click('#play');await pg.waitForTimeout(4000);
const rms=i=>pg.evaluate(i=>{const b=__looper.buffer(i);if(!b)return 0;const d=b.getChannelData(0);let s=0;for(const x of d)s+=x*x;return Math.sqrt(s/d.length)},i);
// CH1：1.5秒録る
await pg.click('.lpCh[data-ch="0"] .lpRec');await pg.waitForTimeout(1500);await pg.click('.lpCh[data-ch="0"] .lpRec');await pg.waitForTimeout(700);
R.ch1=await pg.evaluate(()=>__looper.state()[0]);R.ch1rms=await rms(0);ok('record_loop',R.ch1.state==='play'&&R.ch1.len>1.2&&R.ch1.len<2.2&&R.ch1rms>.0005);
// 重ね録り → ↶
await pg.click('.lpCh[data-ch="0"] .lpRec');await pg.waitForTimeout(900);await pg.click('.lpCh[data-ch="0"] .lpRec');await pg.waitForTimeout(600);
R.dub={st:await pg.evaluate(()=>__looper.state()[0]),rms:await rms(0)};ok('overdub',R.dub.st.state==='play'&&R.dub.st.undo&&Math.abs(R.dub.st.len-R.ch1.len)<.01&&R.dub.rms>R.ch1rms);
await pg.click('.lpCh[data-ch="0"] .lpUndo');await pg.waitForTimeout(200);R.undo=await rms(0);ok('undo',Math.abs(R.undo-R.ch1rms)<1e-6);
// 速さ・逆再生
await pg.click('.lpCh[data-ch="0"] .lpSpd[data-s="2"]');await pg.click('.lpCh[data-ch="0"] .lpRev');await pg.waitForTimeout(300);
R.mod=await pg.evaluate(()=>({st:__looper.state()[0],pressed:[...document.querySelectorAll('.lpCh[data-ch="0"] [aria-pressed=true]')].map(b=>b.className)}));ok('speed_reverse',R.mod.st.speed===2&&R.mod.st.rev&&R.mod.pressed.includes('lpSpd')&&R.mod.pressed.includes('lpRev'));
// ルーパーの音は録られない：ほかの音を全部止めて（自律演奏を一時停止しても ctx は動かしたまま）CH2 を録ると、ほぼ無音
await pg.evaluate(async()=>{await __looper.setVol(0,1.5)});
// 自律演奏を一時停止しても、ルーパーは鳴り続ける（ctx を止めない）
R.self=await pg.evaluate(async()=>{document.getElementById('play').click();await new Promise(r=>setTimeout(r,1200));let s=0;for(let i=0;i<8;i++){s+=__pedals.probe();await new Promise(r=>setTimeout(r,60))}return {paused:document.getElementById('play').getAttribute('aria-pressed'),out:s/8}});
ok('loops_survive_pause',R.self.paused==='false'&&R.self.out>.001);
await pg.evaluate(()=>{if(__looper.state()[0].state!=='play')__looper.play(0)});await pg.waitForTimeout(300);
await pg.click('.lpCh[data-ch="1"] .lpRec');await pg.waitForTimeout(1200);await pg.click('.lpCh[data-ch="1"] .lpRec');await pg.waitForTimeout(600);
R.ch2rms=await rms(1);R.ch2=await pg.evaluate(()=>__looper.state()[1]);ok('no_self_record',R.ch2.state==='play'&&R.ch2rms<R.ch1rms*.05);
// 保存 → 一覧 → 読み込み → 削除（2回押し）
await pg.click('.lpCh[data-ch="0"] .lpSave');await pg.waitForTimeout(800);
R.lib=await pg.evaluate(()=>({rows:document.querySelectorAll('.lpLibRow').length,name:document.querySelector('.lpLibName')?.textContent||'',msg:document.getElementById('lpMsg').textContent}));ok('save',R.lib.rows===1&&/^LOOP \d\d\/\d\d \d\d:\d\d · CH1$/.test(R.lib.name)&&/保存しました/.test(R.lib.msg));
await pg.selectOption('.lpLibRow select','4');await pg.click('.lpLibRow button:not(.lpDel)');await pg.waitForTimeout(500);
R.load={st:await pg.evaluate(()=>__looper.state()[4]),rms:await rms(4)};ok('load',R.load.st.state==='play'&&Math.abs(R.load.st.len-R.ch1.len)<.01&&Math.abs(R.load.rms-R.ch1rms)<1e-5);
await pg.click('.lpDel');R.del1=await pg.evaluate(()=>document.querySelector('.lpDel').textContent);await pg.click('.lpDel');await pg.waitForTimeout(500);
R.del2=await pg.evaluate(()=>document.querySelectorAll('.lpLibRow').length);ok('delete_two_step',R.del1==='本当に削除'&&R.del2===0);
// 消す
await pg.click('.lpCh[data-ch="4"] .lpClear');ok('clear',await pg.evaluate(()=>__looper.state()[4].state==='empty'&&document.querySelector('.lpCh[data-ch="4"] .lpPlay').disabled));
// 英語
await pg.selectOption('#langSelect','en');await pg.waitForTimeout(500);
R.en=await pg.evaluate(()=>{const s=document.getElementById('looperBlock');s.querySelectorAll('details').forEach(d=>d.open=true);const jp=/[\u3040-\u30ff\u4e00-\u9fff]/;const left=[];const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(t&&jp.test(t))left.push(t)}for(const e of s.querySelectorAll('[aria-label]'))if(jp.test(e.getAttribute('aria-label')))left.push('@'+e.getAttribute('aria-label'));return {left:[...new Set(left)].slice(0,10),state:s.querySelector('.lpCh[data-ch="0"] .lpState').textContent}});
ok('english',R.en.left.length===0&&R.en.state==='Playing');
await pg.selectOption('#langSelect','ja');await pg.waitForTimeout(300);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>document.getElementById('looperBlock').scrollIntoView());await pg.locator('#looperBlock').screenshot({path:'/tmp/looper.png'}).catch(()=>{});
R.errs=errs.filter(e=>!/net::|Failed to fetch|favicon|404/.test(e));ok('no_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
