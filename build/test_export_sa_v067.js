// v0.67 BY-SA を含む書き出しの扱い（バックログ 3③）の回帰テスト。python3 -m http.server 8765 で配信して実行する。
// 確認：商用モード「すべての素材」で WAV 録音を始めると BY-SA も入ることを知らせる。書き出しに BY-SA の素材が入った時は警告し、件数を記録する。
// 「BY-SAを除く」では知らせも警告も出ない。英語表示。辞書（build/src_i18n.js と index.html）の同一性。ミックスダウンにも同じ警告（コードと件数の関数）。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const W=t=>pg.waitForTimeout(t);
const msg=()=>pg.evaluate(()=>document.getElementById('message').innerText);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await W(800);
const ids=await pg.evaluate(()=>{const rs=JSON.parse(document.getElementById('ae-recordings').textContent);return {sa:rs.find(r=>/BY-SA/.test(r.license||'')),by:rs.find(r=>/^CC BY\b/.test(r.license||'')&&!/BY-SA/.test(r.license))}});
ok('fixtures',!!ids.sa&&!!ids.by);R.sa=ids.sa&&ids.sa.id;R.by=ids.by&&ids.by.id;
ok('mode_all_default',await pg.evaluate(()=>document.getElementById('rightsMode').value==='all'));
await pg.click('#play');await W(2500);
// 1. すべての素材：開始時に知らせ、BY-SA の素材が入れば書き出し時に警告
let dl=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(async()=>{await __audioEcosystemDebug.startRecord()});await W(400);
R.startMsg=await msg();ok('start_note',R.startMsg.includes('WAV録音中。30秒で自動書き出しします。')&&R.startMsg.includes('商用モードが「すべての素材」のため、CC BY-SA の素材も録音に入ります。'));
await pg.evaluate(id=>__audioEcosystemDebug.noteRecUse('recording',id),ids.sa.id);await W(1500);await pg.evaluate(()=>__audioEcosystemDebug.stopRecord());await dl;await W(600);
R.endMsg=await msg();const last=await pg.evaluate(()=>__audioEcosystemDebug.attribution().last);
ok('end_warn',/16-bit stereo WAVを書き出しました/.test(R.endMsg)&&/BY-SA の素材が[1-9]\d*件含まれています。販売物やリール動画には使わないでください/.test(R.endMsg));
ok('sa_count',last&&last.sa>=1);ok('credits_note',last&&/CC BY-SA/.test(last.text));
// 2. 英語表示
await pg.evaluate(()=>__i18n.set('en'));await W(300);R.endMsgEn=await msg();ok('end_warn_en',/Exported a 16-bit stereo WAV/.test(R.endMsgEn)&&/BY-SA source\(s\) are included\. Don’t use this in products for sale/.test(R.endMsgEn)&&!/[぀-ヿ一-鿿]/.test(R.endMsgEn));
await pg.evaluate(()=>__i18n.set('ja'));await W(200);
// 3. BY-SAを除く：知らせも警告も出ない
await pg.selectOption('#rightsMode','nosa');await W(300);ok('mode_nosa',await pg.evaluate(()=>document.getElementById('rightsMode').value==='nosa'));
dl=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(async()=>{await __audioEcosystemDebug.startRecord()});await W(400);
R.startMsg2=await msg();ok('start_no_note',R.startMsg2.includes('WAV録音中')&&!R.startMsg2.includes('BY-SA'));
await pg.evaluate(id=>__audioEcosystemDebug.noteRecUse('recording',id),ids.by.id);await W(1500);await pg.evaluate(()=>__audioEcosystemDebug.stopRecord());await dl;await W(600);
R.endMsg2=await msg();const last2=await pg.evaluate(()=>__audioEcosystemDebug.attribution().last);ok('end_no_warn',/16-bit stereo WAVを書き出しました/.test(R.endMsg2)&&!/BY-SA/.test(R.endMsg2)&&last2.sa===0);
await pg.selectOption('#rightsMode','all');
// 4. 件数の関数（持込音源は数えない）とミックスダウンの警告
ok('sa_count_fn',await pg.evaluate(()=>__audioEcosystemDebug.saCount([{license:'CC BY-SA 4.0'},{license:'CC BY 4.0'},{license:'CC BY-SA 3.0',imported:true},{license:'CC0'}])===1));
const src=fs.readFileSync(__dirname+'/src_studio.js','utf8'),html=fs.readFileSync(__dirname+'/../index.html','utf8');const mix=src.split('\n').find(l=>l.includes('const sa=saCount(entries);trkStatus('));
ok('mixdown_warn_code',!!mix&&html.includes(mix)&&mix.includes('BY-SA の素材が'));
// 5. 辞書の同一性
const i18n=fs.readFileSync(__dirname+'/src_i18n.js','utf8');const lines=i18n.split('\n').filter(l=>l.includes('CC BY-SA の素材も録音に入ります')||l.includes('販売物やリール動画には使わないでください'));
ok('i18n_parity',lines.length===2&&lines.every(l=>html.includes(l+'\n')));
ok('no_overflow',await pg.evaluate(()=>document.documentElement.scrollWidth<=390));ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
