// v0.58 の回帰テスト：初期設定で鳴らす音は「ディジュリドゥ・低音（パイプオルガンのペダルの実録音）・鳥」。
// 楽器の層はディジュリドゥ 45・パイプオルガンのペダル 30 だけ、環境音はすべて 0、生き物は鳥4種（CC0）。無料版でもそのまま全部鳴る。
// python3 -m http.server 8765 で配信して実行する（音源リポジトリへのリンクが必要）。
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');(async()=>{
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const R={},fail=[];const ok=(k,c)=>{R[k+'_ok']=!!c;if(!c)fail.push(k)};const errs=[];
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const LAYERS=[];for(const g of ['low','music','rhythm']){const m=html.match(new RegExp('"'+g+'": \\[(\\[.*?\\])\\]'));for(const x of m[1].matchAll(/\["(\w+)", "[^"]*", (\d+)\]/g))LAYERS.push([x[1],+x[2]])}
const BIRDS=['uguisu-yokohama','song-thrush','eurasian-wren','nightingale-russia'];
const open=async(free)=>{const cx=await b.newContext({viewport:{width:390,height:844}});const pg=await cx.newPage();await require('./photo_fixture')(pg);
 pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
 if(free)await pg.addInitScript(()=>{try{localStorage.setItem('saww.planPreview','free')}catch(e){}});
 await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(900);return {cx,pg}};
const state=pg=>pg.evaluate(([keys,birds])=>({
 layers:Object.fromEntries(keys.map(k=>[k,+(document.getElementById('param-'+k)||{value:-1}).value])),
 field:[...document.querySelectorAll('#fieldControls input')].filter(i=>+i.value>0).map(i=>i.id),
 species:Object.entries(__bioDebug.settings).filter(([,v])=>v.enabled).map(([k])=>k).sort(),
 birdsTier:birds.map(id=>__rightsDebug.tierOf(JSON.parse(document.getElementById('ae-recordings').textContent).find(r=>r.id===id).license))}),[LAYERS.map(l=>l[0]),BIRDS]);
const isDefault=s=>Object.entries(s.layers).every(([k,v])=>v===({didge:45,organPedal:30}[k]||0))&&s.field.length===0&&s.species.join()===[...BIRDS].sort().join();

// 1. 埋め込みの初期値
R.embedded=LAYERS.filter(([,v])=>v>0);ok('embedded',LAYERS.length>=30&&R.embedded.map(x=>x.join(':')).join()==='didge:45,organPedal:30');
ok('embedded_field',/const fieldDefaults=\{[^}]*\}/.exec(html)[0].match(/:(\d+)/g).every(x=>x===':0'));

// 2. 最初に開いた時
let {cx,pg}=await open(false);
R.s0=await state(pg);ok('defaults',isDefault(R.s0));ok('birds_cc0',R.s0.birdsTier.every(t=>t==='A'));
ok('free_instruments',await pg.evaluate(()=>['didge','organPedal'].every(k=>__instrAllowed(k))));

// 3. 鳴らす：ディジュリドゥとペダルの持続音・鳥の声・音が出ている
await pg.click('#play');await pg.waitForTimeout(8000);
const sound=pg=>pg.evaluate(async birds=>{const loops=__realDebug.loops();const hist=__bioDebug.history().map(x=>x.id);let rms=0;for(let i=0;i<10;i++){rms=Math.max(rms,__bioDebug.signal().rms);await new Promise(r=>setTimeout(r,60))}
 return {loops,birds:[...new Set(hist)].filter(id=>birds.includes(id)),other:[...new Set(hist)].filter(id=>!birds.includes(id)),rms}},BIRDS);
R.play=await sound(pg);ok('plays',R.play.loops.includes('didge')&&R.play.loops.includes('organPedal')&&R.play.birds.length>=1&&R.play.other.length===0&&R.play.rms>1e-4);

// 4. 「初期設定に戻す」でも同じ
await pg.evaluate(()=>{const i=document.getElementById('param-bowl');i.value=60;i.dispatchEvent(new Event('input',{bubbles:true}))});
await pg.click('#reset');await pg.waitForTimeout(400);R.s1=await state(pg);ok('reset',isDefault(R.s1));
await cx.close();

// 5. 無料版でも初期設定のまま全部鳴る（鍵の付いた欄・止められた楽器がない）
({cx,pg}=await open(true));
R.s2=await state(pg);ok('free_defaults',isDefault(R.s2));
await pg.click('#play');await pg.waitForTimeout(8000);R.freePlay=await sound(pg);
ok('free_plays',R.freePlay.loops.includes('didge')&&R.freePlay.loops.includes('organPedal')&&R.freePlay.birds.length>=1&&R.freePlay.rms>1e-4);
ok('free_not_locked',await pg.evaluate(()=>['didge','organPedal'].every(k=>!document.getElementById('param-'+k).disabled)));
await cx.close();

R.version=/<title>saww audio ecosystem v0\.(\d+)/.exec(html)[1];ok('version',+R.version>=58);
R.errs=errs.filter(e=>!/favicon|net::ERR/.test(e));ok('no_console_errors',R.errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
