// 初回ガイド（バックログ A・9：オンボーディング）の回帰テスト。2026-11-16 自動実行で追加。python3 -m http.server 8765 で配信して実行する。
// 確認：①初めての訪問で「はじめての方へ」の3つの操作が「01 音を選ぶ」の中に出る ②「わかった」で閉じ、再読み込みしても出ない（ae-guide-done）
// ③閉じた後は「▶ 自律演奏をはじめる」に焦点が移る ④配信（?live=…）では出さない ⑤保存が使えない環境でも例外を出さず表示・閉じられる
// ⑥英語表示で未翻訳の日本語が残らない・ガイドの英文 ⑦390px の日英で横にはみ出さない・閉じるボタンの高さ 44px 以上 ⑧辞書（build/src_i18n.js と index.html）の同一性 ⑨コンソールエラー0。
// 実機（iPhone Safari）での見え方・スクリーンリーダーの読み上げは未検証。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};const errs=[];
const open=async(q,w,init)=>{const cx=await b.newContext({viewport:{width:w||390,height:900}});const pg=await cx.newPage();if(init)await pg.addInitScript(init);await require('./photo_fixture')(pg);
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
 await pg.goto('http://localhost:8765/index.html'+(q||''));await pg.waitForTimeout(900);return {cx,pg}};
const shown=pg=>pg.evaluate(()=>{const g=document.getElementById('firstGuide');return !!g&&!g.hidden&&g.getBoundingClientRect().height>20});
// ①〜③・⑦（日本語）
{const {cx,pg}=await open();
 const st=await pg.evaluate(()=>{const g=document.getElementById('firstGuide');return {inTile:!!g.closest('#tileSection'),steps:g.querySelectorAll('ol li').length,role:g.getAttribute('role'),label:document.getElementById(g.getAttribute('aria-labelledby')).textContent,
  btnH:Math.round(document.getElementById('firstGuideClose').getBoundingClientRect().height),sw:document.documentElement.scrollWidth}});R.ja=st;
 ok('shown_first',await shown(pg));ok('in_tile_section',st.inTile&&st.steps===3&&st.role==='note'&&st.label==='はじめての方へ');ok('btn44',st.btnH>=44);ok('no_overflow_ja',st.sw<=390);
 await pg.click('#firstGuideClose');await pg.waitForTimeout(200);ok('closed',!(await shown(pg)));ok('focus_play',await pg.evaluate(()=>document.activeElement&&document.activeElement.id==='play'));
 ok('stored',await pg.evaluate(()=>localStorage.getItem('ae-guide-done')==='1'));
 await pg.reload();await pg.waitForTimeout(900);ok('stays_closed',!(await shown(pg)));await cx.close()}
// ⑥・⑦（英語）
{const {cx,pg}=await open('',390,()=>{try{localStorage.setItem('ae-lang','en')}catch(e){}});await pg.waitForTimeout(400);
 const t=await pg.evaluate(()=>{const g=document.getElementById('firstGuide');return {txt:g.innerText,sw:document.documentElement.scrollWidth}});R.en=t.txt.slice(0,240);
 ok('shown_en',await shown(pg));ok('en_no_japanese',!/[぀-ヿ㐀-鿿]/.test(t.txt));ok('en_text',/New here\?/.test(t.txt)&&/Start autonomous play/.test(t.txt)&&/Got it/.test(t.txt));ok('no_overflow_en',t.sw<=390);await cx.close()}
// ④ 配信では出さない
{const {cx,pg}=await open('?live=auto',1280);ok('hidden_live',!(await shown(pg)));await cx.close()}
// ⑤ 保存が使えない環境
{const {cx,pg}=await open('',390,()=>{const f=()=>{throw new Error('blocked')};try{Object.defineProperty(Storage.prototype,'getItem',{value:f});Object.defineProperty(Storage.prototype,'setItem',{value:f})}catch(e){}});
 ok('no_storage_shown',await shown(pg));await pg.click('#firstGuideClose');await pg.waitForTimeout(200);ok('no_storage_closes',!(await shown(pg)));await cx.close()}
// ⑧ 辞書の同一性
{const src=fs.readFileSync(__dirname+'/src_i18n.js','utf8'),html=fs.readFileSync(__dirname+'/../index.html','utf8');const ln=src.split('\n').find(l=>l.startsWith("'はじめての方へ':"));
 ok('i18n_parity',!!ln&&html.includes(ln+'\n'))}
ok('no_errors',errs.filter(e=>!/blocked/.test(e)).length===0);R.errs=errs.slice(0,6);
console.log(JSON.stringify(R,null,0));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
