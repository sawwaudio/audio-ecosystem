// v0.66 映像テンプレート（organic・particles・geometry）の回帰テスト。python3 -m http.server 8765 で配信して実行する。
// 確認：選べる・描画が空でない・光の点滅を抑える時は1秒に3回まで・15秒の書き出し（1080×1920・音あり）。ffprobe があれば中身も確認する。
const {chromium}=require('playwright');const fs=require('fs'),cp=require('child_process'),os=require('os'),path=require('path');(async()=>{
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();await require('./photo_fixture')(pg);
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};
const tmp=process.env.AE_OUT||path.join(os.tmpdir(),'ae_visual_test_'+process.pid);fs.mkdirSync(tmp,{recursive:true});
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
ok('styles_listed',await pg.evaluate(()=>['organic','particles','geometry'].every(v=>[...document.querySelectorAll('#reelStyle option')].some(o=>o.value===v))));
ok('calm_default_on',await pg.evaluate(()=>document.getElementById('reelCalm').checked));
// 1. 三つの映像が、音に合わせて描かれ、空白にならない（輝度のばらつき）
await pg.click('#play');await pg.waitForTimeout(2500);
for(const s of ['organic','particles','geometry']){
 await pg.selectOption('#reelStyle',s);await pg.evaluate(()=>__reelDebug.preview(true));await pg.waitForTimeout(2500);
 const sd=await pg.evaluate(()=>{const c=document.getElementById('reelCanvas').getContext('2d');const d=c.getImageData(0,220,1080,1360).data;let s=0,q=0,n=0;for(let i=0;i<d.length;i+=16){const l=0.3*d[i]+0.59*d[i+1]+0.11*d[i+2];s+=l;q+=l*l;n++}const m=s/n;return Math.sqrt(Math.max(0,q/n-m*m))});
 await pg.evaluate(()=>__reelDebug.preview(false));R['sd_'+s]=+sd.toFixed(2);ok('drawn_'+s,sd>6);
}
// 2. 点滅を抑える：1秒に3回まで（10秒ぶんの音で確かめる）
await pg.evaluate(()=>__visualDebug.setCalm(true));await pg.selectOption('#reelStyle','organic');await pg.waitForTimeout(10000);
R.calmState=await pg.evaluate(()=>__visualDebug.state());ok('calm_max_3_per_second',R.calmState&&R.calmState.maxWin<=3);
// 3. 書き出し：15秒・organic・音あり
const dlP=pg.waitForEvent('download',{timeout:60000});
await pg.evaluate(()=>__reelDebug.start(15,{style:'organic',calm:true}));
const dl=await dlP;const file=path.join(tmp,dl.suggestedFilename());await dl.saveAs(file);R.file=dl.suggestedFilename();
await pg.waitForTimeout(500);const st=await pg.evaluate(()=>__reelDebug.state());R.result={...(st.result||{}),text:undefined,caption:undefined};
ok('export_style',R.result.style==='organic'&&R.result.calm===true);
ok('file_name',/^saww_audio_ecosystem_reel_.+\.(mp4|webm)$/.test(R.file)||/\.(mp4|webm)$/.test(R.file));
if(fs.existsSync(file)&&process.env.AE_FFPROBE!=='0'){try{const j=JSON.parse(cp.execSync('ffprobe -v error -print_format json -show_format -show_streams "'+file+'"').toString());
 const v=j.streams.find(s=>s.codec_type==='video'),a=j.streams.find(s=>s.codec_type==='audio');const dur=+j.format.duration;
 R.probe={w:v&&v.width,h:v&&v.height,dur:+dur.toFixed(2),audio:!!a,vcodec:v&&v.codec_name,acodec:a&&a.codec_name,size:fs.statSync(file).size};
 ok('probe_1080x1920',v&&v.width===1080&&v.height===1920);ok('probe_15s',dur>14.2&&dur<16);ok('probe_has_audio',!!a);
 cp.execSync('ffmpeg -v error -y -ss 6 -i "'+file+'" -frames:v 1 "'+path.join(tmp,'frame_6s.png')+'"');R.frame=path.join(tmp,'frame_6s.png');
}catch(e){ok('probe',false);R.probeErr=String(e.message).slice(0,200)}}
R.errs=errs.filter(e=>!/favicon|net::ERR/.test(e));ok('no_console_errors',R.errs.length===0);
R.out=tmp;console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
