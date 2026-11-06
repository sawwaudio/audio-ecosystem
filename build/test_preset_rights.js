// v0.30 プリセットの商用モード・区分・帰属情報の回帰テスト。python3 -m http.server 8765 で配信して実行する。
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const JP=/[぀-ヿ一-鿿]/;
const tmp=require('os').tmpdir()+'/ae_preset_test_'+process.pid;fs.mkdirSync(tmp,{recursive:true});
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
const msg=()=>pg.evaluate(()=>document.getElementById('message').innerText);
// 1. 書き出し
const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('#exportPreset')]);const file=tmp+'/exported.json';await dl.saveAs(file);
const P=JSON.parse(fs.readFileSync(file,'utf8'));R.exportName=dl.suggestedFilename();
ok('export_mode',P.rightsMode==='all'&&P.rights&&P.rights.mode==='all');
const ids=await pg.evaluate(()=>__rightsDebug.presetIds());R.ids=ids.length;
ok('export_sources_match',ids.length>0&&JSON.stringify(P.rights.sources.map(s=>s.id))===JSON.stringify(ids));
const recs=await pg.evaluate(()=>Object.fromEntries(JSON.parse(document.getElementById('ae-recordings').textContent).map(r=>[r.id,r.license])));
ok('export_tiers_match_license',await pg.evaluate(srcs=>srcs.every(s=>s.tier===__rightsDebug.tierOf(s.license)),P.rights.sources));
ok('export_license_from_ledger',P.rights.sources.every(s=>s.license&&s.license===recs[s.id]));
ok('export_attribution_flag',P.rights.sources.every(s=>s.attributionRequired===/^CC BY/i.test(s.license)));
ok('export_attribution_fields',P.rights.sources.filter(s=>s.attributionRequired).every(s=>s.title&&s.author&&s.url&&s.licenseURL));
const t=P.rights.tiers;ok('export_tier_counts',t.A+t.B+t.C+t.X+t.U===P.rights.sources.length);
ok('export_notice_bilingual',JP.test(P.rights.notice)&&/attributionRequired/.test(P.rights.notice));
R.exportMsg=await msg();ok('export_msg',R.exportMsg.includes('プリセットJSONを書き出しました。')&&R.exportMsg.includes('ライセンス区分と帰属情報を含みます（A '+t.A+'件・B '+t.B+'件・C '+t.C+'件）。'));
ok('export_size_ok',fs.statSync(file).size<100000);
// 2. 厳しいモードのプリセット → 適用される
const imp=async(obj,name)=>{const f=tmp+'/'+name+'.json';fs.writeFileSync(f,JSON.stringify(obj));await pg.setInputFiles('#presetFile',f);await pg.waitForTimeout(500);return msg()};
R.m2=await imp({...P,rightsMode:'nosa'},'nosa');ok('stricter_applied',await pg.evaluate(()=>__rightsDebug.mode==='nosa'&&document.getElementById('rightsMode').value==='nosa')&&R.m2.includes('を適用しました。'));
// 3. 緩いモードのプリセット（BY-SA の環境層入り）→ いまの設定を保つ・対象外を知らせる
const bySaBed=Object.keys(P.field.levels).find(id=>/BY-SA/.test(recs[id]||''));R.bySaBed=bySaBed;
const loose={...P,rightsMode:'all',field:{...P.field,levels:{...P.field.levels,[bySaBed]:50}}};
R.m3=await imp(loose,'loose');ok('looser_kept',await pg.evaluate(()=>__rightsDebug.mode==='nosa')&&R.m3.includes('いまの設定のままにしました。'));
ok('blocked_note',/このプリセットの素材のうち\d+件は商用モードの対象外のため鳴りません/.test(R.m3));
ok('bed_level_restored',await pg.evaluate(id=>Number(document.getElementById('field-'+id).value)===50,bySaBed));
ok('blocked_badge_on_bed',await pg.evaluate(id=>document.getElementById('field-'+id).closest('label').dataset.rightsBlocked==='1',bySaBed));
// 4. 不正な商用モード → 読み込まない
R.m4=await imp({...P,rightsMode:'free'},'bad');ok('invalid_rejected',R.m4.includes('不正な商用モード')&&await pg.evaluate(id=>Number(document.getElementById('field-'+id).value)===50&&__rightsDebug.mode==='nosa',bySaBed));
// 5. 旧形式（rightsMode なし）→ モードは変えず読み込める
const old={...P};delete old.rightsMode;delete old.rights;R.m5=await imp(old,'old');ok('legacy_ok',R.m5.startsWith('プリセットJSONを読み込みました。')&&await pg.evaluate(()=>__rightsDebug.mode==='nosa'));
// 6. CC0 のみに厳しくする
R.m6=await imp({...P,rightsMode:'cc0'},'cc0');ok('cc0_applied',await pg.evaluate(()=>__rightsDebug.mode==='cc0'));
// 7. 英語表示
await pg.click('#langToggle');await pg.waitForTimeout(600);
await pg.evaluate(()=>__rightsDebug.set('nosa'));R.en1=await imp(loose,'loose_en');await pg.waitForTimeout(300);R.en1=await msg();
ok('en_import_msg',!JP.test(R.en1)&&/stricter/.test(R.en1)&&/excluded by commercial mode/.test(R.en1));
await pg.evaluate(()=>__rightsDebug.set('all'));R.en2=await imp({...P,rightsMode:'nosa'},'nosa_en');await pg.waitForTimeout(300);R.en2=await msg();ok('en_applied_msg',!JP.test(R.en2)&&/Applied the preset/.test(R.en2));
const [dl2]=await Promise.all([pg.waitForEvent('download'),pg.click('#exportPreset')]);await pg.waitForTimeout(400);R.en3=await msg();ok('en_export_msg',!JP.test(R.en3)&&/Includes license tiers/.test(R.en3));
R.en4=await imp({...P,rightsMode:'free'},'bad_en');await pg.waitForTimeout(300);R.en4=await msg();ok('en_invalid_msg',!JP.test(R.en4));
R.overflow=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok('no_overflow',R.overflow<=0);
await pg.evaluate(()=>{__rightsDebug.set('all');try{localStorage.removeItem('ae-lang')}catch(e){}});
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
