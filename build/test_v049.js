// v0.49：ロゴ・生き物と環境音のタブ・音ごとの音量と休み・「鳴っている音」の一覧・写真のない生き物のイラスト・タッチ演奏を外す・
// 楽器（実録音）と合成音（シンセ）の整理・密度のつまみ・旋律の実録音楽器4種（カリンバ・マリンバ・チューブラーベル・グロッケンシュピール）の回帰テスト。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const cx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});const pg=await cx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const wait=ms=>pg.waitForTimeout(ms);
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{['ae-rights','ae-lang','saww.boost'].forEach(k=>localStorage.removeItem(k))}catch(e){}});await pg.reload();await wait(900);

// 1. ロゴ（ヘッダー・タブのアイコン・ホーム画面のアイコン）
R.logo=await pg.evaluate(()=>{const i=document.querySelector('img.brandLogo');return {img:!!i&&i.complete&&i.naturalWidth>=96,svg:!!document.querySelector('svg.brandMark'),icon:!!document.querySelector('link[rel="icon"][href^="data:image/png"]'),apple:!!document.querySelector('link[rel="apple-touch-icon"]')}});
ok('logo',R.logo.img&&!R.logo.svg&&R.logo.icon&&R.logo.apple);
// 2. タブ：生き物 ⇄ 環境音（川・雨・波・風）。環境音は 30 のタイル
R.tabs={start:await pg.evaluate(()=>({c:!document.getElementById('creaturePane').hidden,a:!document.getElementById('ambSection').hidden}))};
await pg.click('#tabAmbience');await wait(200);
R.tabs.amb=await pg.evaluate(()=>({c:!document.getElementById('creaturePane').hidden,a:!document.getElementById('ambSection').hidden,n:document.querySelectorAll('#ambGrid .tile').length,sel:document.getElementById('tabAmbience').getAttribute('aria-selected')}));
const amb=await pg.evaluate(()=>document.querySelector('#ambGrid .tile').dataset.id);await pg.click('#ambGrid .tile[data-id="'+amb+'"] .tilePlay');await wait(1500);
R.tabs.count=await pg.textContent('#tabAmbienceN');
await pg.click('#tabCreatures');await wait(200);R.tabs.back=await pg.evaluate(()=>!document.getElementById('creaturePane').hidden&&document.getElementById('ambSection').hidden);
ok('tabs',R.tabs.start.c&&!R.tabs.start.a&&!R.tabs.amb.c&&R.tabs.amb.a&&R.tabs.amb.n>=30&&R.tabs.amb.sel==='true'&&/1/.test(R.tabs.count)&&R.tabs.back);
// 3. 生き物：写真のないものはイラスト（実写ではないと明記）
R.ill=await pg.evaluate(()=>{__studioDebug.showAll(true);const ids=[...document.querySelectorAll('#tileGrid .tile')].filter(t=>!t.querySelector('img')).map(t=>t.dataset.id);
 const r={n:ids.length,svg:ids.every(id=>document.querySelector('#tileGrid .tile[data-id="'+id+'"] svg')),first:ids[0]};__studioDebug.showAll(false);return r});
ok('illustrations',R.ill.n>0&&R.ill.svg);
// 4. 1つの生き物を鳴らす → 詳細で音量と休みを選ぶ（ループと自律演奏で共通）
const bio=await pg.evaluate(()=>[...document.querySelectorAll('#tileGrid .tile')].map(t=>t.dataset.id).find(id=>__studioDebug.engineKind(id)==='bio'&&document.querySelector('#tileGrid .tile[data-id="'+id+'"] .tileTier').textContent!=='C'));
await pg.click('#tileGrid .tile[data-id="'+bio+'"] .tilePlay');await wait(1500);
await pg.click('#tileGrid .tile[data-id="'+bio+'"] .tileInfo');await wait(300);
R.sheet={restRow:await pg.evaluate(()=>!document.getElementById('sheetRestRow').hidden),opts:await pg.evaluate(()=>[...document.querySelectorAll('#sheetRestBox option')].map(o=>o.value))};
await pg.selectOption('#sheetRestBox select','30');await pg.fill('#sheetVol','40');await pg.dispatchEvent('#sheetVol','input');
R.sheet.after=await pg.evaluate(id=>({rest:__studioDebug.restOf(id),eng:__bioDebug.settings[id].rest,lvl:__bioDebug.settings[id].level,vol:__studioDebug.state(id).vol}),bio);await pg.keyboard.press('Escape');
ok('sheet_rest_vol',R.sheet.restRow&&R.sheet.opts.join()===',0,5,15,30,60'&&R.sheet.after.rest===30&&R.sheet.after.eng===30&&R.sheet.after.vol===40&&R.sheet.after.lvl===20);
// 5. 鳴っている音の一覧：2つ並ぶ → ✕ で外す
await pg.click('#dockList');await wait(300);
R.dock={rows:await pg.evaluate(()=>[...document.querySelectorAll('#dockPanelList .dpRow')].map(r=>r.dataset.id)),exp:await pg.getAttribute('#dockList','aria-expanded'),n:await pg.textContent('#dockListN')};
await pg.click('#dockPanelList .dpRow[data-id="'+amb+'"] .dpRemove');await wait(900);
R.dock.after=await pg.evaluate(()=>[...document.querySelectorAll('#dockPanelList .dpRow')].map(r=>r.dataset.id));
ok('dock_panel',R.dock.rows.includes(bio)&&R.dock.rows.includes(amb)&&R.dock.exp==='true'&&R.dock.n==='2'&&!R.dock.after.includes(amb)&&R.dock.after.includes(bio));
await pg.click('#dockPanelClose');await wait(200);ok('dock_close',await pg.evaluate(()=>document.getElementById('dockPanel').hidden));
await pg.click('#tileStopAll');await wait(700);
// 6. タッチ演奏は画面にない
ok('no_touch',await pg.evaluate(()=>{const s=document.getElementById('touchSection');return !s||!!s.closest('[hidden]')}));
// 7. 楽器（実録音）と合成音（シンセ）：低音・旋律・打楽器／持続音・旋律・打撃
R.panel=await pg.evaluate(()=>{const sec=id=>[...document.querySelectorAll('#'+id+' .layerSub')].map(s=>({t:s.querySelector('.layerSubTitle').textContent,k:[...s.querySelectorAll('input[type=range]')].map(i=>i.id.slice(6))}));
 return {instr:sec('instrBody'),synth:sec('synthBody'),order:document.getElementById('instrPanel').compareDocumentPosition(document.getElementById('synthPanel'))&4,
  sum:document.querySelector('#synthPanel>summary').textContent,master:!!document.getElementById('param-volume').closest('.masterBlock'),label:document.querySelector('label[for="param-kalimba"]').textContent}});
const flat=a=>a.flatMap(s=>s.k);
ok('instr_panel',R.panel.instr.map(s=>s.t).join()==='低音,旋律,打楽器'&&['didge','organPedal','timpaniRoll','gong','pianoLow','natureLow'].every(k=>R.panel.instr[0].k.includes(k))
 &&['harp','vibes','kalimba','marimba','tubularBells','glockenspiel'].every(k=>R.panel.instr[1].k.includes(k))&&['frameDrum','cajon','darbuka','slitDrum','conga'].every(k=>R.panel.instr[2].k.includes(k))&&R.panel.label==='カリンバ');
ok('synth_panel',R.panel.synth.map(s=>s.t).join()==='持続音,旋律,打撃'&&flat(R.panel.synth).sort().join()==='bells,bowed,bowl,heart,kick,organ,organDrone,piano,stones,sub'&&/合成音（シンセ）/.test(R.panel.sum)&&R.panel.order&&R.panel.master);
// 8. 密度のつまみ：合成音だけ／楽器だけに効く。同時発音の上限も上がる
const setR=(id,v)=>pg.evaluate(([id,v])=>{const el=document.getElementById(id);el.value=v;el.dispatchEvent(new Event('input'))},[id,v]);
await setR('synthBoost',300);await setR('instrBoost',150);
R.boost=await pg.evaluate(()=>({sub:__boostOf('sub'),bells:__boostOf('bells'),harp:__boostOf('harp'),kal:__boostOf('kalimba'),birds:__boostOf('birds'),cap:__boostCap(),saved:localStorage.getItem('saww.boost')}));
ok('boost',R.boost.sub===3&&R.boost.bells===3&&R.boost.harp===1.5&&R.boost.kal===1.5&&R.boost.birds===1&&R.boost.cap===2.2&&/"s":3/.test(R.boost.saved));
await setR('synthBoost',100);await setR('instrBoost',100);
// 9. 旋律の実録音楽器4種：読み込み・和音の音を音域の中で鳴らす・ミキサーの「音楽」へ
const setP=(k,v)=>pg.evaluate(([k,v])=>{const el=document.getElementById('param-'+k);el.value=v;el.dispatchEvent(new Event('input'))},[k,v]);
await pg.evaluate(()=>__audioEcosystemDebug.startRecord());await pg.click('#play');await wait(1200);
R.mel={};for(const k of ['kalimba','marimba','tubularBells','glockenspiel']){await setP(k,70);let seen=false;for(let i=0;i<60&&!seen;i++){if(i%15===0)await pg.evaluate(k=>__realDebug.hit(k),k);await wait(100);seen=await pg.evaluate(k=>__realDebug.voices().includes(k),k)}R.mel[k]=seen;await setP(k,0)}
ok('melodic_play',Object.values(R.mel).every(Boolean));
R.inst=await pg.evaluate(()=>{const s=JSON.parse(document.getElementById('ae-instruments').textContent).filter(x=>x.added==='v0.49');const m=JSON.parse(document.getElementById('ae-audio-manifest').textContent).instruments;
 return {n:s.length,kinds:[...new Set(s.map(x=>x.kind))].join(),cc0:s.every(x=>x.license==='CC0 1.0'&&/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/.test(x.url)&&/^[0-9a-f]{64}$/.test(x.sha256)),pcm:s.every(x=>m[x.id]&&m[x.id].pcm.lossless&&m[x.id].compat)}});
ok('melodic_data',R.inst.n===20&&R.inst.kinds==='kalimba,marimba,tubularBells,glockenspiel'&&R.inst.cc0&&R.inst.pcm);
await wait(600);R.credits=await pg.evaluate(()=>__audioEcosystemDebug.attribution().used.filter(u=>u.kind==='instrument').map(u=>u.id));
ok('melodic_credits',['kalimba','marimba','tubularBells','glockenspiel'].every(k=>R.credits.some(id=>id.startsWith(k+'-'))));
await pg.evaluate(()=>__studioDebug.stopEverything());await wait(600);
// 10. 英語表示・はみ出し・エラー
await pg.click('#langToggle');await wait(500);
const un=(await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return __i18n.untranslated()})).filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x));R.untranslated=un;ok('no_untranslated',un.length===0);
R.en={instr:await pg.textContent('#instrPanel>summary'),kal:await pg.textContent('label[for="param-kalimba"]'),tab:await pg.textContent('#tabAmbience')};
ok('english',/Instruments \(real recordings\)/.test(R.en.instr)&&R.en.kal==='Kalimba'&&/Ambience/.test(R.en.tab));
await pg.click('#langToggle');await wait(300);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.setViewportSize({width:1280,height:900});await wait(300);ok('overflow_desktop',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
await pg.evaluate(()=>{try{['ae-rights','ae-lang','saww.boost'].forEach(k=>localStorage.removeItem(k))}catch(e){}});
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
