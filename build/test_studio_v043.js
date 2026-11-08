// v0.43 の回帰テスト：写真のタイル（See it. Tap it. Hear it.）・マスター EQ・リール作成・マルチトラック・プラン。
// 写真は build/photo_fixture.js の試験画像で返す（オフライン）。マイクは Chromium の擬似デバイス。
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true,permissions:['clipboard-read','clipboard-write','microphone'],hasTouch:true});
const pg=await ctx.newPage();await require('./photo_fixture')(pg);const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const FX=path.join(__dirname,'fixtures');const OUT=process.env.SHOT_DIR||null;
const wait=ms=>pg.waitForTimeout(ms);const peak=async ch=>pg.evaluate(async ch=>{let m=-Infinity;for(let i=0;i<10;i++){m=Math.max(m,__mixerDebug.peakDb(ch));await new Promise(r=>setTimeout(r,50))}return m},ch);
await pg.goto('http://localhost:8765/index.html');await wait(900);
// 1. 名称・画面の順番
R.brand=await pg.evaluate(()=>({title:document.title,h1:document.querySelector('header h1').textContent,tiles:document.getElementById('tileSection').getBoundingClientRect().top<document.getElementById('sourceSection').getBoundingClientRect().top}));
ok('brand',R.brand.h1==='saww audio ecosystem'&&/^saww audio ecosystem v0\.\d+/.test(R.brand.title)&&R.brand.tiles);
// 2. 写真と音の対応（学名の完全一致。v0.59 からは、種の写真がない録音にイメージ写真）。v0.45 から最初は12枚だけ見せるので、すべて表示してから数える
await pg.evaluate(()=>__studioDebug.showAll(true));
R.map=await pg.evaluate(()=>{const photos=JSON.parse(document.getElementById('ae-photos').textContent);const recs=JSON.parse(document.getElementById('ae-recordings').textContent);const sc=JSON.parse(document.getElementById('ae-scenes')?.textContent||'{"map":{}}');const bad=[],withPhoto=[]; // v0.59：種の写真がない録音にはイメージ写真（ae-scenes）
 for(const r of recs){const p=__studioDebug.photoFor(r.id),b=__studioDebug.binomial(r.latin);if(p){withPhoto.push(r.id);if(p.scene){if(sc.map[r.id]!==p.scene||(b&&photos[b]))bad.push('scene:'+r.id)}else if(!b||p.latin!==b||photos[b].file!==p.file)bad.push(r.id)}else if(b&&photos[b])bad.push('missing:'+r.id)
  if(p&&!/^(CC0|Public domain|CC BY \d)/.test(p.license))bad.push('license:'+r.id);if(p&&/SA|NC|ND/.test(p.license))bad.push('license:'+r.id)}
 const tiles=[...document.querySelectorAll('#tileSection .tile')];return {tiles:tiles.length,withPhoto:withPhoto.length,imgs:tiles.filter(t=>t.querySelector('img')).length,ph:tiles.filter(t=>t.querySelector('.ph')).length,bad,first:tiles.slice(0,3).map(t=>t.dataset.id)}});
ok('tile_count',R.map.tiles===127&&R.map.imgs+R.map.ph===127);ok('photo_mapping',R.map.bad.length===0&&R.map.withPhoto>=30&&R.map.imgs===R.map.withPhoto);
// 3. タップで再生・もう一度で停止・重ねる
const t1=R.map.first[0],t2=await pg.evaluate(()=>[...document.querySelectorAll('#tileSection .tile')].find(t=>t.dataset.group==='ambience'&&__studioDebug.engineKind(t.dataset.id)==='field').dataset.id);
await pg.tap('#tileSection .tile[data-id="'+t1+'"] .tilePlay');await wait(2500);
R.play1={pressed:await pg.getAttribute('#tileSection .tile[data-id="'+t1+'"] .tilePlay','aria-pressed'),bio:await peak('bio'),playing:await pg.evaluate(()=>__studioDebug.playing()),auto:await pg.evaluate(()=>document.getElementById('statusBadge').textContent)};
ok('tap_play',R.play1.pressed==='true'&&R.play1.bio>-80&&R.play1.playing.includes(t1));
await pg.evaluate(()=>__studioDebug.setTab('ambience'));await pg.tap('#tileSection .tile[data-id="'+t2+'"] .tilePlay');await wait(2500);R.layer={playing:await pg.evaluate(()=>__studioDebug.playing()),field:await peak('field')};ok('layer_two',R.layer.playing.length===2&&R.layer.field>-80);await pg.evaluate(()=>__studioDebug.setTab('creatures'));
R.wave=await pg.evaluate(id=>{const c=document.querySelector('#tileSection .tile[data-id="'+id+'"] .tileWave');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return {lit:n,cls:c.closest('.tile').className}},t1);ok('playing_wave',R.wave.lit>20&&/\bon\b/.test(R.wave.cls));
await pg.tap('#tileSection .tile[data-id="'+t1+'"] .tilePlay');await wait(900);R.stop1={pressed:await pg.getAttribute('#tileSection .tile[data-id="'+t1+'"] .tilePlay','aria-pressed'),bio:await peak('bio')};ok('tap_stop',R.stop1.pressed==='false'&&R.stop1.bio===-Infinity);
// 4. 長押しで詳細・音量・ループ。キーボード（Enter で再生、i で詳細、Esc で閉じる）
const tb=await pg.locator('#tileSection .tile[data-id="'+t1+'"] .tilePlay').boundingBox();await pg.mouse.move(tb.x+30,tb.y+30);await pg.mouse.down();await wait(700);await pg.mouse.up();await wait(200);
R.sheet=await pg.evaluate(()=>({open:document.getElementById('tileSheet').open,name:document.getElementById('sheetName').textContent,info:[...document.querySelectorAll('#sheetInfo dt')].map(d=>d.textContent),credit:document.getElementById('sheetPhotoCredit').textContent,playing:__studioDebug.playing()}));
ok('long_press_sheet',R.sheet.open&&R.sheet.info.some(t=>/ライセンス/.test(t))&&R.sheet.info.some(t=>/録音地/.test(t))&&R.sheet.info.some(t=>/写真のライセンス/.test(t))&&!R.sheet.playing.includes(t1));
await pg.click('#sheetPlay');await wait(1500);await pg.fill('#sheetVol','20');await pg.dispatchEvent('#sheetVol','input');await pg.uncheck('#sheetLoop');
R.sheetCtl=await pg.evaluate(id=>__studioDebug.state(id),t1);ok('sheet_controls',R.sheetCtl.on&&R.sheetCtl.vol===20&&R.sheetCtl.loop===false);
await pg.keyboard.press('Escape');await wait(200);R.sheetClosed=await pg.evaluate(()=>!document.getElementById('tileSheet').open);ok('sheet_close',R.sheetClosed);
await pg.evaluate(()=>__studioDebug.stopAll());await wait(300);
const t3=R.map.first[1];await pg.focus('#tileSection .tile[data-id="'+t3+'"] .tilePlay');await pg.keyboard.press('Enter');await wait(1500);R.kbd={on:await pg.evaluate(id=>__studioDebug.state(id)?.on,t3)};await pg.keyboard.press('i');await wait(200);R.kbd.sheet=await pg.evaluate(()=>document.getElementById('tileSheet').open);await pg.keyboard.press('Escape');
R.kbd.aria=await pg.evaluate(id=>{const t=document.querySelector('#tileSection .tile[data-id="'+id+'"]');const lb=t.querySelector('.tileInfo').getAttribute('aria-labelledby').split(' ').map(x=>document.getElementById(x).textContent).join(' ');return {play:t.querySelector('.tilePlay').getAttribute('aria-label'),info:lb}},t3);
ok('keyboard',R.kbd.on&&R.kbd.sheet&&R.kbd.aria.play.length>0&&/^詳細 /.test(R.kbd.aria.info));await pg.evaluate(()=>__studioDebug.stopAll());await wait(300);
// 5. 商用モード：BY-SA のタイルは対象外になったら止まり、薄く表示される（代用しない）
const sa=await pg.evaluate(()=>{const recs=JSON.parse(document.getElementById('ae-recordings').textContent);return recs.find(r=>/BY-SA/.test(r.license)).id});
await pg.evaluate(()=>__rightsDebug.set('all'));await pg.evaluate(id=>__studioDebug.start(id),sa);await wait(1500);const before=await pg.evaluate(id=>__studioDebug.state(id).on,sa);await pg.evaluate(()=>__rightsDebug.set('nosa'));await wait(800);
R.rights={before,after:await pg.evaluate(id=>__studioDebug.state(id).on,sa),dim:await pg.evaluate(id=>document.querySelector('#tileSection .tile[data-id="'+id+'"]').classList.contains('blocked'),sa)};ok('rights_stop',R.rights.before&&!R.rights.after&&R.rights.dim);await pg.evaluate(()=>__rightsDebug.set('all'));
// 6. 自分の音（WAV・AIFF・MP3・M4A・FLAC）と画像
await pg.setInputFiles('#tileUserFile',['wav','aiff','mp3','m4a','flac'].map(e=>path.join(FX,'user_tone.'+e)));await wait(2500);
R.user=await pg.evaluate(()=>({ids:__studioDebug.users(),status:document.getElementById('tileStatus').textContent,shown:[...document.querySelectorAll('#tileSection .tile')].map(t=>t.dataset.id)}));
R.formats=Object.fromEntries(['wav','aiff','mp3','m4a','flac'].map(e=>[e,R.user.ids.some(id=>id==='import:user_tone'||id.startsWith('import:user_tone'))]));
ok('user_import',R.user.ids.length===5&&R.user.shown.length===5);
const u1=R.user.ids[0];await pg.evaluate(id=>__studioDebug.open(id),u1);await pg.setInputFiles('#tileUserImage',path.join(FX,'photo_fixture.jpg'));await wait(500);
R.userImg=await pg.evaluate(id=>({img:!!document.querySelector('#tileSection .tile[data-id="'+CSS.escape(id)+'"] img'),sheet:!!document.querySelector('#sheetPhoto img')}),u1);await pg.keyboard.press('Escape');ok('user_image',R.userImg.img&&R.userImg.sheet);
await pg.evaluate(id=>__studioDebug.start(id),u1);await wait(1200);R.userPlay=await peak('sampler');ok('user_play_sampler',R.userPlay>-60);await pg.evaluate(()=>__studioDebug.stopAll());await wait(400);
// 7. マスター EQ：3つのつまみ。全部キルで出音が消え、戻すと鳴る
R.meq=await pg.evaluate(()=>[...document.querySelectorAll('#mixMasterEq .knob')].map(k=>k.dataset.k+':'+k.getAttribute('aria-valuetext')));ok('master_eq_ui',R.meq.join()==='low:0,mid:0,hi:0');
await pg.evaluate(id=>__studioDebug.start(id),t2);await wait(1500);const m0=await peak('master');await pg.evaluate(()=>{for(const k of ['low','mid','hi'])__mixerDebug.set('master',k,0)});await wait(800);const m1=await peak('master');
await pg.evaluate(()=>{__mixerDebug.set('master','low',.5);__mixerDebug.set('master','mid',.5);__mixerDebug.set('master','hi',1)});await wait(800);const m2=await peak('master');
R.meqLive={on:+m0.toFixed(1),killed:m1,hiBoost:+m2.toFixed(1),state:await pg.evaluate(()=>__mixerDebug.state().master)};ok('master_eq_kill',m0>-80&&m1<-90&&m2>-80);
await pg.evaluate(()=>document.getElementById('mixerSection').open=true);await pg.click('#mixReset');R.meqReset=await pg.evaluate(()=>__mixerDebug.state().master);ok('master_eq_reset',R.meqReset.low===.5&&R.meqReset.mid===.5&&R.meqReset.hi===.5);
await pg.evaluate(()=>__studioDebug.stopAll());await wait(300);
// 8. マルチトラック：追加・再生・ミュート・書き出し（WAV・AIFF 24-bit）・出音の録音・マイク録音
await pg.evaluate(async([u,lib])=>{await __studioDebug.addTrack(u);await __studioDebug.addTrack(lib)},[u1,t2]);await wait(500);
await pg.evaluate(()=>__studioDebug.trkPlay());await wait(400);R.trk={tracks:await pg.evaluate(()=>__studioDebug.tracks()),state:await pg.evaluate(()=>__studioDebug.trk()),smp:await peak('sampler')};
ok('tracks_play',R.trk.tracks.length===2&&R.trk.state.playing&&R.trk.state.voices>=2&&R.trk.smp>-80);await pg.evaluate(()=>__studioDebug.trkStop());
const dlW=pg.waitForEvent('download',{predicate:d=>/\.wav$/.test(d.suggestedFilename())});const mixW=await pg.evaluate(()=>__studioDebug.trkMixdown('wav'));const dw=await dlW;const fw=await dw.path();const bw=fs.readFileSync(fw);
R.wav={name:dw.suggestedFilename(),riff:bw.toString('ascii',0,4),bits:bw.readUInt16LE(34),ch:bw.readUInt16LE(22),sr:bw.readUInt32LE(24),bytes:bw.length,len:mixW.len};ok('mixdown_wav',/^saww_audio_ecosystem_mix_.+\.wav$/.test(R.wav.name)&&R.wav.riff==='RIFF'&&R.wav.bits===24&&R.wav.ch===2&&R.wav.bytes===44+Math.ceil(mixW.len*mixW.sr)*6);
const dlA=pg.waitForEvent('download',{predicate:d=>/\.aif$/.test(d.suggestedFilename())});await pg.evaluate(()=>__studioDebug.trkMixdown('aiff'));const da=await dlA;const ba=fs.readFileSync(await da.path());
R.aiff={name:da.suggestedFilename(),form:ba.toString('ascii',0,4)+ba.toString('ascii',8,12)};R.aiffBack=await pg.evaluate(async b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const a=__studioDebug.parseAiff(bin.buffer);return a?{sr:a.sampleRate,ch:a.numberOfChannels,len:a.length}:null},ba.toString('base64'));
ok('mixdown_aiff',/\.aif$/.test(R.aiff.name)&&R.aiff.form==='FORMAIFF'&&R.aiffBack&&R.aiffBack.ch===2&&Math.abs(R.aiffBack.sr-mixW.sr)<1);
await pg.evaluate(id=>__studioDebug.start(id),t2);await wait(800);await pg.evaluate(()=>__studioDebug.trkRecord('bounce'));await wait(1600);await pg.evaluate(()=>__studioDebug.trkRecStop());await wait(400);await pg.evaluate(()=>__studioDebug.stopAll());
R.bounce=await pg.evaluate(()=>({users:__studioDebug.users(),tracks:__studioDebug.tracks().length}));ok('bounce_record',R.bounce.users.some(u=>u.startsWith('bounce:'))&&R.bounce.tracks===3);
await pg.evaluate(()=>__studioDebug.trkRecord('mic'));await wait(1600);await pg.evaluate(()=>__studioDebug.trkRecStop());await wait(400);
R.mic=await pg.evaluate(()=>({users:__studioDebug.users(),tracks:__studioDebug.tracks().length,status:document.getElementById('trkStatus').textContent}));ok('mic_record',R.mic.users.some(u=>u.startsWith('mic:'))&&R.mic.tracks===4);
await pg.evaluate(()=>__studioDebug.trkStop());
// 9. リール：タイルだけで作る（自律演奏は始めない）・テンプレート forest・写真と撮影者が説明欄に入る・書き出し後の共有
await pg.evaluate(()=>__rightsDebug.set('nosa'));const photoTile=await pg.evaluate(()=>{const recs=JSON.parse(document.getElementById('ae-recordings').textContent);return recs.find(r=>__studioDebug.photoFor(r.id)&&!/BY-SA/.test(r.license)).id});
await pg.evaluate(id=>__studioDebug.start(id),photoTile);await wait(1500);await pg.selectOption('#reelStyle','forest');
const dlR=pg.waitForEvent('download',{timeout:60000,predicate:d=>/\.(mp4|webm)$/.test(d.suggestedFilename())});await pg.evaluate(()=>__reelDebug.start(4,{}));await wait(1500);
if(OUT){const d=await pg.evaluate(()=>document.getElementById('reelCanvas').toDataURL('image/png'));fs.writeFileSync(path.join(OUT,'reel_forest.png'),Buffer.from(d.split(',')[1],'base64'))}
const dr=await dlR;await wait(800);const st=await pg.evaluate(()=>__reelDebug.state());
R.reel={file:dr.suggestedFilename(),frames:st.frames,auto:await pg.evaluate(()=>document.getElementById('statusBadge').textContent),photos:await pg.evaluate(()=>__studioDebug.photosUsed()),credits:/写真のクレジット \/ Photo credits/.test(st.result.text),photographer:await pg.evaluate(id=>__studioDebug.photoFor(id).author,photoTile),done:await pg.evaluate(()=>!document.getElementById('reelDone').hidden&&!!document.getElementById('reelVideo').src)};
R.reel.creditHasAuthor=st.result.text.includes(R.reel.photographer);R.reel.tileInCredits=st.result.entries.some(e=>e.id===photoTile);
ok('reel_from_tiles',/^saww_audio_ecosystem_reel_.+\.(mp4|webm)$/.test(R.reel.file)&&R.reel.frames>=60&&R.reel.photos.length===1&&R.reel.credits&&R.reel.creditHasAuthor&&R.reel.tileInCredits&&R.reel.done);
await pg.click('#reelCopy');await wait(300);R.clip=await pg.evaluate(()=>navigator.clipboard.readText());ok('copy_credits',R.clip.includes('Photo credits')&&R.clip.includes('#sawwaudioecosystem'));
R.share=await pg.evaluate(()=>document.getElementById('reelShare').dataset.mode);
for(const tpl of ['ocean','night','wildlife','minimal','waveform','spectrum','abstract']){await pg.selectOption('#reelStyle',tpl);await wait(250)}R.tplErr=errs.length;ok('templates',R.tplErr===0);
if(OUT)for(const tpl of ['minimal','waveform','wildlife']){await pg.selectOption('#reelStyle',tpl);await pg.evaluate(()=>__reelDebug.preview(true));await wait(1500);const d=await pg.evaluate(()=>document.getElementById('reelCanvas').toDataURL('image/png'));fs.writeFileSync(path.join(OUT,'reel_'+tpl+'.png'),Buffer.from(d.split(',')[1],'base64'));await pg.evaluate(()=>__reelDebug.preview(false))}
await pg.evaluate(()=>__studioDebug.stopAll());await pg.evaluate(()=>__rightsDebug.set('all'));
// 10. プラン：FREE / PRO（USD・提案価格・課金なし）・PRO の印
R.plans=await pg.evaluate(()=>({cards:[...document.querySelectorAll('.planCard')].map(c=>c.querySelector('.planName').textContent+' '+c.querySelector('.planPrice').textContent),alt:document.querySelector('.plan-pro > .micro:not(.planNote)')?.textContent,rows:document.querySelectorAll('.planTable tbody tr').length,chips:[...document.querySelectorAll('[data-tier="pro"]')].filter(n=>n.querySelector('.proChip')).length,ent:__studioDebug.entitlement().enforce,pay:!!document.querySelector('#plansSection input:not(#planPreview), #plansSection form, script[src*="stripe"]') /* v0.55：無料版の見え方を試すチェックは支払いの入力ではない */}));
ok('plans',R.plans.cards.join('|')==='FREE $0 forever|PRO $9.99 USD / 月（税込）'&&!R.plans.alt&&R.plans.rows>=10&&R.plans.chips===3&&R.plans.ent===false&&!R.plans.pay);
// 11. 英語表示・画面幅
await pg.click('#langToggle');await wait(500);R.en=await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);return {un:__i18n.untranslated().filter(x=>!['日本語','@aria-label=表示言語を日本語に切り替える','リトルスター / CC BY-SA 4.0'].includes(x)&&!/^@?(aria-label=)?(mic|bounce|import):|マイク録音|出音の録音|user_tone/.test(x)),filter:document.querySelector('#tileFilters button').textContent,h2:document.getElementById('tileTitle').textContent}});
ok('english',R.en.un.length===0&&R.en.filter==='All');await pg.click('#langToggle');await wait(300);
ok('overflow',await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0);
if(OUT){await pg.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=false);scrollTo(0,0)});await pg.evaluate(id=>__studioDebug.start(id),photoTile);await wait(1500);await pg.screenshot({path:path.join(OUT,'tiles_390.png')})}
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
