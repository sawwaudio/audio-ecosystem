// v0.31 リールモード（最小版）の回帰テスト。python3 -m http.server 8765 で配信して実行する。ffprobe があれば書き出した動画の中身も確認する。
const {chromium}=require('playwright');const fs=require('fs'),cp=require('child_process');(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:900},acceptDownloads:true});const pg=await ctx.newPage();
const errs=[];pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const R={},fail=[];const ok=(k,c)=>{R[k]=c;if(!c)fail.push(k)};const JP=/[぀-ヿ一-鿿]/;
const tmp=require('os').tmpdir()+'/ae_reel_test_'+process.pid;fs.mkdirSync(tmp,{recursive:true});
await pg.goto('http://localhost:8765/index.html');await pg.evaluate(()=>{try{localStorage.removeItem('ae-rights');localStorage.removeItem('ae-lang')}catch(e){}});await pg.reload();await pg.waitForTimeout(800);
const msg=()=>pg.evaluate(()=>document.getElementById('message').innerText);
R.mime=await pg.evaluate(()=>__reelDebug.mime());ok('mime_supported',!!R.mime);
ok('canvas_size',await pg.evaluate(()=>{const c=document.getElementById('reelCanvas');return c.width===1080&&c.height===1920}));
ok('mode_all_at_start',await pg.evaluate(()=>__rightsDebug.mode==='all'));
// 1. 「すべて」から録画 → BY-SAを除くに切り替わり、BY-SA の素材を含まない
await pg.click('#play');await pg.waitForTimeout(4000);
const dlP=pg.waitForEvent('download',{timeout:30000});
await pg.evaluate(()=>__reelDebug.start(4));
R.msgStart=await msg();ok('switched_nosa',await pg.evaluate(()=>__rightsDebug.mode==='nosa'&&document.getElementById('rightsMode').value==='nosa')&&R.msgStart.includes('切り替えました。'));
ok('recording_active',await pg.evaluate(()=>__reelDebug.state().active));
// 録画中は「すべて」に戻せない
await pg.selectOption('#rightsMode','all');await pg.waitForTimeout(200);ok('guard_select',await pg.evaluate(()=>__rightsDebug.mode==='nosa'&&document.getElementById('rightsMode').value==='nosa'));
await pg.evaluate(()=>__rightsDebug.set('all'));ok('guard_api',await pg.evaluate(()=>__rightsDebug.mode==='nosa'));
R.guardMsg=await msg();ok('guard_msg',R.guardMsg.includes('切り替えられません'));
R.now=await pg.evaluate(()=>__reelDebug.now());
const dl=await dlP;const file=tmp+'/'+dl.suggestedFilename();await dl.saveAs(file);R.file=dl.suggestedFilename();await pg.waitForTimeout(300);
const st=await pg.evaluate(()=>__reelDebug.state());R.result={...st.result,text:undefined};R.frames=st.frames;
ok('file_name',/^audio_ecosystem_reel_.+\.(mp4|webm)$/.test(R.file));
const head=fs.readFileSync(file).subarray(0,12);R.size=fs.statSync(file).size;
ok('file_magic',(head[0]===0x1a&&head[1]===0x45&&head[2]===0xdf&&head[3]===0xa3)||head.subarray(4,8).toString()==='ftyp');
ok('file_size',R.size>20000);ok('frames_drawn',st.frames>=60);
ok('no_bysa_used',st.result.sa===0&&st.result.entries.every(e=>e.imported||!/BY-SA/i.test(e.license)));
ok('entries_recorded',st.result.entries.length>=1);
ok('caption_draft',/キャプション案/.test(st.result.text)&&/Caption draft/.test(st.result.text)&&st.result.text.indexOf('キャプション案')<st.result.text.indexOf('Credits & Attribution'));
ok('caption_locations',await pg.evaluate(()=>{const s=__reelDebug.state().result;const recs=JSON.parse(document.getElementById('ae-recordings').textContent);const ids=s.entries.filter(e=>e.kind==='recording'&&!e.imported).slice(0,4).map(e=>e.id);return ids.length>0&&ids.every(id=>{const r=recs.find(x=>x.id===id);return s.caption.includes('（録音地：'+(r.location||'原本に記載なし')+'）')})}));
ok('credits_text',/Reel video/.test(st.result.text)&&/商用モード/.test(st.result.text)&&/BY-SA/.test(st.result.text));
ok('credits_shown',await pg.evaluate(()=>!document.getElementById('reelCredits').hidden&&/^このリールのクレジット：素材\d+件/.test(document.getElementById('reelCreditsSummary').textContent)));
R.msgDone=await msg();ok('export_msg',/リール動画を書き出しました（(MP4|WEBM)・[\d.]+ MB）。/.test(R.msgDone));
ok('after_mode_kept',await pg.evaluate(()=>__rightsDebug.mode==='nosa'));
// 録画後は「すべて」に戻せる（ガードは録画中だけ）
await pg.evaluate(()=>__rightsDebug.set('all'));ok('unguarded_after',await pg.evaluate(()=>__rightsDebug.mode==='all'));await pg.evaluate(()=>__rightsDebug.set('nosa'));
// ffprobe：縦1080×1920の映像と音声
try{const j=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_streams','-of','json',file]).toString());const v=j.streams.find(s=>s.codec_type==='video'),a=j.streams.find(s=>s.codec_type==='audio');
 R.probe={v:v&&[v.codec_name,v.width,v.height],a:a&&[a.codec_name,a.channels,a.sample_rate]};ok('probe_video_1080x1920',!!v&&v.width===1080&&v.height===1920);ok('probe_audio',!!a&&a.channels===2);
 const d=parseFloat(cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file]).toString());const lv=cp.spawnSync('ffmpeg',['-v','info','-nostats','-i',file,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
 R.probe.mean=(/mean_volume: (-?[\d.]+)/.exec(lv.stderr)||[])[1];ok('probe_audio_not_silent',R.probe.mean!==undefined&&parseFloat(R.probe.mean)>-70);R.probe.duration=d}
catch(e){R.probe='ffprobe unavailable: '+e.message}
// 2. クレジットの保存
const [dl2]=await Promise.all([pg.waitForEvent('download'),pg.click('#reelCreditsSave')]);R.credFile=dl2.suggestedFilename();ok('credits_file',/_credits\.txt$/.test(R.credFile));
// v0.32 対応していない形式の指定は録画を始めずに拒否する（商用モードも変えない）
R.badMime=await pg.evaluate(()=>__reelDebug.start(2,{mime:'video/x-bogus'}).then(()=>'started',e=>e.message));ok('bad_mime_rejected',/MediaRecorder/.test(R.badMime)&&!(await pg.evaluate(()=>__reelDebug.state().active)));
// 3. 停止ボタンで途中書き出し（CC0のみモードでも動く）
await pg.evaluate(()=>__rightsDebug.set('cc0'));const dl3P=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(()=>__reelDebug.start(30));await pg.waitForTimeout(2500);await pg.click('#reelStop');
const dl3=await dl3P;await pg.waitForTimeout(300);const st3=await pg.evaluate(()=>__reelDebug.state());R.stop={duration:st3.result.duration,entries:st3.result.entries.length};
ok('stop_button',st3.result.duration<10&&!st3.active&&await pg.evaluate(()=>__rightsDebug.mode==='cc0'));
ok('cc0_only',st3.result.entries.every(e=>e.imported||/^(CC0|Public domain)/i.test(e.license)));
// 4. 英語表示
await pg.evaluate(()=>__rightsDebug.set('all'));await pg.click('#langToggle');await pg.waitForTimeout(600);
R.enReelText=await pg.evaluate(()=>{const s=document.getElementById('reelSection');const pre=document.getElementById('reelCreditsText');const out=[];const w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(pre.contains(n))continue;const t=n.nodeValue.trim();if(t&&/[぀-ヿ一-鿿]/.test(t))out.push(t)}for(const el of s.querySelectorAll('[aria-label]'))if(/[぀-ヿ一-鿿]/.test(el.getAttribute('aria-label')))out.push('@'+el.getAttribute('aria-label'));return out});
ok('en_reel_section',R.enReelText.length===0);
const dl4P=pg.waitForEvent('download',{timeout:30000});await pg.evaluate(()=>__reelDebug.start(2));await pg.waitForTimeout(200);R.en1=await msg();ok('en_start_msg',!JP.test(R.en1)&&/Switched commercial mode/.test(R.en1)&&/Recording reel/.test(R.en1));
await pg.evaluate(()=>__rightsDebug.set('all'));await pg.waitForTimeout(200);R.en2=await msg();ok('en_guard_msg',!JP.test(R.en2));
await dl4P;await pg.waitForTimeout(500);R.en3=await msg();ok('en_done_msg',!JP.test(R.en3)&&/Reel video exported/.test(R.en3));
R.en4=await pg.textContent('#reelCreditsSummary');ok('en_summary',!JP.test(R.en4));
R.overflow=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);ok('no_overflow',R.overflow<=0);
await pg.screenshot({path:tmp+'/reel_en.png',fullPage:false});
await pg.evaluate(()=>{__rightsDebug.set('all');try{localStorage.removeItem('ae-lang');localStorage.removeItem('ae-rights')}catch(e){}});
ok('no_errors',errs.length===0);R.errs=errs;
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})();
