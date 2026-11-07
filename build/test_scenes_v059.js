// v0.59 の回帰テスト：生き物と環境音のイメージ写真（data/scene_photos.json → ae-scenes）。
// 写真は表示時に Commons から読み込むため、テストでは photo_fixture が試験画像を返す。AE_SHOT=フォルダ で画面の写真を保存する。
const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),crypto=require('crypto');(async()=>{
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];const SHOT=process.env.AE_SHOT;
const D=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','scene_photos.json'),'utf8'));
const SP=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','species_photos.json'),'utf8'));
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const recs=JSON.parse(/<script type="application\/json" id="ae-recordings">([\s\S]*?)<\/script>/.exec(html)[1]);
const bi=l=>{const m=/^([A-Z][a-z]+ [a-z]+)(?:（|$)/.exec(l||'');return m&&!/ sp$/.test(m[1])?m[1]:null};

// 1. データ：対象の録音が存在し、学名の写真がある録音には付けない。ライセンスは CC0・パブリックドメイン・CC BY だけ。URL はファイル名から正しく作られている
R.mapped=Object.keys(D.map).length;R.images=Object.keys(D.images).length;
ok('map_ids',Object.keys(D.map).every(id=>recs.some(r=>r.id===id))&&Object.values(D.map).every(k=>D.images[k]));
ok('species_first',Object.keys(D.map).every(id=>{const r=recs.find(x=>x.id===id);const s=bi(r.latin);return !(s&&SP[s])}));
ok('licenses',Object.values(D.images).every(i=>/^(CC0|Public domain|CC BY \d\.\d)$/.test(i.license)&&!/SA|NC|ND|GFDL/.test(i.license)&&i.author&&i.place_ja&&i.place_en));
ok('urls',Object.values(D.images).every(i=>{const n=i.file.replace(/ /g,'_'),md=crypto.createHash('md5').update(n).digest('hex'),q=encodeURIComponent(n).replace(/\(/g,'%28').replace(/\)/g,'%29');
 return i.page==='https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(n).replace(/%28/g,'(').replace(/%29/g,')').replace(/%2C/g,',')&&i.thumb.startsWith('https://upload.wikimedia.org/wikipedia/commons/')&&i.thumb.includes('/'+md[0]+'/'+md.slice(0,2)+'/'+q)}));

// 2. 画面：環境音・種の分からない生き物のタイルに写真と「イメージ」の印。種の写真には印なし。対象外はこれまでどおりの絵
const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(1200);
await pg.evaluate(()=>{const b=document.querySelector('.tileMore');if(b&&b.getAttribute('aria-expanded')==='false')b.click()});await pg.waitForTimeout(300);
const tile=id=>pg.evaluate(id=>{const t=document.querySelector('.tile[data-id="'+id+'"]');if(!t)return null;const im=t.querySelector('.tileImg img');return {img:!!im,src:im?im.getAttribute('src'):'',mark:t.querySelector('.sceneMark')?.textContent||'',ph:!!t.querySelector('.tileImg .ph')}},id);
R.amb=await tile('takayama-river');R.frog=await tile('malaysian-frogs');R.species=await tile('uguisu-yokohama');R.none=await tile('higurashi');
ok('amb_photo',R.amb&&R.amb.img&&/330px-Waterfall_Trail_on_Fossil_Creek/.test(R.amb.src)&&R.amb.mark==='イメージ');
ok('creature_photo',R.frog&&R.frog.img&&R.frog.mark==='イメージ');ok('species_no_mark',R.species&&R.species.img&&R.species.mark==='');ok('unmapped_keeps_drawing',R.none&&!R.none.img&&R.none.ph&&R.none.mark==='');
if(SHOT){await pg.evaluate(()=>document.getElementById('ambGrid')?.scrollIntoView());await pg.waitForTimeout(300);await pg.screenshot({path:SHOT+'/scenes_amb.png'})}
// 詳細シート：出典の行に「イメージ写真（録音の場所・生き物そのものではありません）」と撮影地・作者・ライセンス
await pg.evaluate(()=>document.querySelector('.tile[data-id="takayama-river"] .tileInfo').click());await pg.waitForTimeout(400);
R.credit=await pg.textContent('#sheetPhotoCredit');ok('sheet_credit',/^イメージ写真（録音の場所・生き物そのものではありません）：米国アリゾナ州・フォッシル・クリークの渓流 · Deborah Lee Soltesz \/ Coconino National Forest · CC0 · Wikimedia Commons$/.test(R.credit));
if(SHOT)await pg.screenshot({path:SHOT+'/scenes_sheet.png'});
await pg.keyboard.press('Escape');await pg.waitForTimeout(200);
// 英語表示
await pg.click('#langToggle');await pg.waitForTimeout(600);await pg.evaluate(()=>document.querySelector('.tile[data-id="takayama-river"] .tileInfo').click());await pg.waitForTimeout(400);
R.en={credit:await pg.textContent('#sheetPhotoCredit'),mark:await pg.evaluate(()=>document.querySelector('.tile[data-id="takayama-river"] .sceneMark')?.textContent)};
ok('english',/^Mood photo \(not the recorded place or animal\): Fossil Creek, Arizona, USA · /.test(R.en.credit)&&R.en.mark==='MOOD');
R.over=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok('no_overflow',R.over<=0);
R.errs=errs;ok('no_console_errors',errs.length===0);await cx.close();
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
