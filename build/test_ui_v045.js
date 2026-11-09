// v0.45 UI 再設計（並び順・説明の畳み込み・タイル＝音場・再生バー）と、実録音の楽器層（低音6・打撃5、フルート・ハーモニクスの削除）の回帰テスト。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const wait=ms=>pg.waitForTimeout(ms);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await wait(900);

// 1. 並び順：01 音を選ぶ → 02 演奏する（タッチ演奏・シンセの層）→ 03 スタジオ → 04 リール（v0.65 で4番目へ）→ 05 公式サイト → プラン → 設定と権利
R.order=await pg.evaluate(()=>{const y=id=>Math.round(document.getElementById(id).getBoundingClientRect().top+scrollY);return ['tileSection','performance','instrPanel','synthPanel','mixerSection','samplerSection','tracksSection','reelSection','siteSection','plansSection','rightsPanel','presetSection','sourceSection'].map(id=>[id,y(id)])});
ok('order',R.order.every((x,i,a)=>i===0||a[i-1][1]<x[1]));
R.nav=await pg.evaluate(()=>[...document.querySelectorAll('.jump a')].map(a=>a.getAttribute('href')));ok('nav',R.nav.join()==='#tileSection,#playGroup,#studioGroup,#reelSection,#siteSection,#settingsGroup');
// 2. 重複をなくした：生き物の一覧（この音場に加える）・環境音の一覧は画面に出ない（処理は動く）
R.legacy=await pg.evaluate(()=>({hidden:document.getElementById('legacyLists').hidden,bio:!!document.querySelector('#legacyLists #bioSection'),field:!!document.querySelector('#legacyLists #fieldSection'),visibleAdd:[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/この音場に加える|この音場に参加|この録音を聴く/.test(b.textContent)).length}));
ok('no_duplicate_add',R.legacy.hidden&&R.legacy.bio&&R.legacy.field&&R.legacy.visibleAdd===0);
// 3. 説明文は「ⓘ 詳しく」に畳まれている：開いていない状態で、60文字を超える説明が見えない
R.help=await pg.evaluate(()=>{const helps=[...document.querySelectorAll('details.help')];const long=[];const w=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);let n;
 while(n=w.nextNode()){const t=n.nodeValue.trim(),el=n.parentElement;if(t.length<=60||!el.checkVisibility()||el.closest('#plansBody,#tileSheet,#reelCanvas,#message,.status,[role=status],#credits,table,select,option,.sheetInfo'))continue;long.push(t.slice(0,40))}
 return {count:helps.length,closed:helps.every(d=>!d.open),long}});
ok('help_folded',R.help.count>=10&&R.help.closed&&R.help.long.length===0);
// 4. 最初は12枚、「すべて表示」で127枚
R.tiles={first:await pg.evaluate(()=>document.querySelectorAll('#tileGrid .tile').length),more:await pg.evaluate(()=>document.querySelector('#tileSection .tileMore')?.textContent)};
R.tiles.all=await pg.evaluate(()=>__studioDebug.showAll(true));await pg.evaluate(()=>__studioDebug.showAll(false));R.tiles.amb=await pg.evaluate(()=>document.querySelectorAll('#ambGrid .tile').length);ok('tiles_paged',R.tiles.first===12&&/97/.test(R.tiles.more)&&R.tiles.all===97&&R.tiles.amb===30); // v0.48：生き物97と環境音30（別の欄）
// 5. タイル＝音場：ループで鳴らす → 自律演奏を始めると参加メンバーへ引き継ぐ（二重に鳴らさない）
const ids=await pg.evaluate(()=>{const tiles=[...document.querySelectorAll('#tileSection .tile')].map(t=>t.dataset.id);return {bio:tiles.filter(id=>__studioDebug.engineKind(id)==='bio').slice(0,2)}});
await pg.evaluate(()=>__studioDebug.showAll(true));const land=await pg.evaluate(()=>[...document.querySelectorAll('#tileSection .tile')].map(t=>t.dataset.id).find(id=>__studioDebug.engineKind(id)==='field'&&!(__studioDebug.fieldLevel(id)>0)));await pg.evaluate(()=>__studioDebug.showAll(false));
const [b1,b2]=ids.bio;const tile=id=>'#tileSection .tile[data-id="'+id+'"] .tilePlay';
await pg.tap(tile(b1));await wait(1500);R.loop={playing:await pg.evaluate(()=>__studioDebug.playing()),dock:await pg.evaluate(()=>__studioDebug.dock())};ok('loop_tap',R.loop.playing.includes(b1)&&!R.loop.dock.hidden&&/1音を再生中/.test(R.loop.dock.text));
await pg.click('#play');await wait(2500);
R.hand={loops:await pg.evaluate(()=>__studioDebug.playing()),enabled:await pg.evaluate(()=>Object.entries(__bioDebug.settings).filter(([,v])=>v.enabled).map(([k])=>k)),on:await pg.evaluate(id=>__studioDebug.isOn(id),b1),pressed:await pg.getAttribute('#play','aria-pressed'),status:await pg.textContent('#tileStatus'),dock:await pg.evaluate(()=>__studioDebug.dock().text)};
ok('handover',R.hand.loops.length===0&&R.hand.enabled.join()===b1&&R.hand.on&&R.hand.pressed==='true'&&/自律演奏/.test(R.hand.dock));
// 自律演奏中のタップ＝参加・不参加の切り替え（ループでは鳴らさない）
await pg.tap(tile(b2));await wait(400);R.join={member:await pg.evaluate(id=>__studioDebug.member(id),b2),loops:await pg.evaluate(()=>__studioDebug.playing()),cls:await pg.evaluate(id=>document.querySelector('#tileSection .tile[data-id="'+id+'"]').className,b2)};
ok('auto_join',R.join.member&&R.join.loops.length===0&&/\bon\b/.test(R.join.cls)&&/\bauto\b|\bsounding\b/.test(R.join.cls));
await pg.tap(tile(b2));await wait(400);ok('auto_leave',!(await pg.evaluate(id=>__studioDebug.member(id),b2)));
// 環境の録音のタイルは環境層のオン／オフ
await pg.evaluate(id=>{__studioDebug.showAll(true);__studioDebug.setTab(document.querySelector('#ambSection .tile[data-id="'+id+'"]')?'ambience':'creatures')},land);await pg.tap(tile(land));await wait(400);R.field={id:land,level:await pg.evaluate(id=>__studioDebug.fieldLevel(id),land)};
await pg.tap(tile(land));await wait(300);R.field.off=await pg.evaluate(id=>__studioDebug.fieldLevel(id),land);ok('auto_field',R.field.level>0&&R.field.off===0);await pg.evaluate(()=>{__studioDebug.showAll(false);__studioDebug.setTab('creatures')});
// 詳細シート：自律演奏のときの音量・休息（一覧から移した設定）
await pg.click('#tileSection .tile[data-id="'+b1+'"] .tileInfo');await wait(300);
// v0.49：音量はループ・自律演奏で共通（#sheetVol）、休みは選ぶ（#sheetRestBox）
R.sheet={auto:true,rest:await pg.evaluate(()=>!document.getElementById('sheetRestRow').hidden)};
await pg.selectOption('#sheetRestBox select','60');await pg.fill('#sheetVol','66');await pg.dispatchEvent('#sheetVol','input');
R.sheet.set=await pg.evaluate(id=>({rest:__bioDebug.settings[id].rest,level:__bioDebug.settings[id].level}),b1);await pg.keyboard.press('Escape');
ok('sheet_auto',R.sheet.auto&&R.sheet.rest&&R.sheet.set.rest===60&&R.sheet.set.level===33);
// 6. 実録音の楽器層：フルート・ハーモニクスは無し、低音6・打撃5を追加
R.layers=await pg.evaluate(()=>({touch:[...document.querySelectorAll('#touchVoice option')].map(o=>o.value),music:[1].flatMap(n=>['instrBody','synthBody'].flatMap(b=>[...document.querySelectorAll('#'+b+' .layerSub')[n].querySelectorAll('input')])).map(i=>i.id.slice(6)),low:[...document.querySelectorAll('#instrBody .layerSub')[0].querySelectorAll('input')].map(i=>i.id.slice(6)),rhy:[...document.querySelectorAll('#instrBody .layerSub')[2].querySelectorAll('input')].map(i=>i.id.slice(6))}));
ok('no_flute_harmonics',!R.layers.touch.some(k=>/flute|harmonics/.test(k))&&!R.layers.music.some(k=>/flute|harmonics/.test(k)));
ok('new_layers',['didge','organPedal','timpaniRoll','gong','pianoLow','natureLow'].every(k=>R.layers.low.includes(k))&&['frameDrum','cajon','darbuka','slitDrum','conga'].every(k=>R.layers.rhy.includes(k)));
R.inst=await pg.evaluate(()=>{const s=JSON.parse(document.getElementById('ae-instruments').textContent).filter(x=>x.added==='v0.45');return {n:s.length,cc0:s.every(x=>x.license==='CC0 1.0'&&/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/.test(x.url)),kinds:[...new Set(s.map(x=>x.kind))]}});ok('instrument_ledger',R.inst.n===37&&R.inst.cc0&&R.inst.kinds.length===10);
const setP=(k,v)=>pg.evaluate(([k,v])=>{const el=document.getElementById('param-'+k);el.value=v;el.dispatchEvent(new Event('input'))},[k,v]);
await pg.evaluate(()=>__audioEcosystemDebug.startRecord());
for(const k of ['didge','organPedal','natureLow'])await setP(k,60);await wait(5000);
const peak=async ch=>{let m=-Infinity;for(let i=0;i<12;i++){m=Math.max(m,await pg.evaluate(c=>__mixerDebug.peakDb(c),ch));await wait(60)}return +m.toFixed(1)};
R.loops={on:await pg.evaluate(()=>__realDebug.loops().sort()),music:await peak('music')};ok('real_loops',R.loops.on.join()==='didge,natureLow,organPedal'&&R.loops.music>-60);
for(const k of ['didge','organPedal','natureLow'])await setP(k,0);await wait(400);R.loops.off=await pg.evaluate(()=>__realDebug.loops());ok('real_loops_off',R.loops.off.length===0);
R.hits={};for(const k of ['frameDrum','cajon','darbuka','slitDrum','conga','timpaniRoll','gong','pianoLow']){await setP(k,60);await pg.evaluate(k=>__realDebug.hit(k),k);let seen=false;for(let i=0;i<20&&!seen;i++){await wait(100);seen=await pg.evaluate(k=>__realDebug.voices().includes(k),k)}R.hits[k]=seen}
ok('real_hits',Object.values(R.hits).every(Boolean));
// 和音の根音へ合わせる（±6半音以内）
R.pick=await pg.evaluate(()=>{const p=__realDebug.pick('organPedal');return {id:p.meta.id,semi:Math.round(12*Math.log2(p.rate))}});ok('pitch_follow',Math.abs(R.pick.semi)<=6);
await wait(800);R.credits=await pg.evaluate(()=>__audioEcosystemDebug.attribution().used.filter(u=>u.kind==='instrument').map(u=>u.id));await pg.evaluate(()=>__audioEcosystemDebug.stopRecord&&__audioEcosystemDebug.stopRecord()).catch(()=>{});
ok('credits',['didge','organPedal','frameDrum','gong'].every(k=>R.credits.some(id=>id.startsWith(k+'-'))));
// 7. 下のバーの「止める」：タイル・自律演奏・トラックをまとめて止める
await pg.click('#tileStopAll');await wait(900);R.stop={auto:await pg.getAttribute('#play','aria-pressed'),loops:await pg.evaluate(()=>__studioDebug.playing()),dock:await pg.evaluate(()=>__studioDebug.dock().hidden)};ok('dock_stop',R.stop.auto==='false'&&R.stop.loops.length===0&&R.stop.dock);
// 8. 英語表示・はみ出し・エラー
await pg.click('#langToggle');await wait(500);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.en={title:await pg.textContent('#tileTitle'),nav:await pg.evaluate(()=>[...document.querySelectorAll('.jump a')].map(a=>a.textContent).join('|')),low:await pg.evaluate(()=>document.querySelector('label[for="param-didge"]').textContent)};
ok('english',R.en.title==='Choose sounds'&&/Studio/.test(R.en.nav)&&R.en.low==='Didgeridoo'); // v0.49：楽器（実録音）の欄の中では「（実録音）」を省く
await pg.click('#langToggle');await wait(300);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.setViewportSize({width:1280,height:900});await wait(300);ok('overflow_desktop',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
