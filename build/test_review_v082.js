// v0.82 音源の審査台帳と公開ゲートの回帰テスト。2026-11-19 追加。
// python3 -m http.server 8765 で配信し、本体の直下に音源リポジトリへのリンク audio-ecosystem-sounds-1 を置いて実行する。
// 確認：①研究用の候補（research/source_review.json）は全件が APPROVED/REVIEW/REJECTED のどれかで、必須の欄をすべて持つ
// ②APPROVED は CC0・PD だけ、根拠 URL・検証日・音源ハッシュがある ③神聖・儀礼の候補（sacred=yes）は APPROVED にならず、アプリの録音・配信目録・音源リポジトリに存在しない
// ④REVIEW・REJECTED の候補はアプリの録音一覧・配信目録・CREDITS・音源リポジトリのどこにも出ない（id と原典 URL で照合）
// ⑤アプリは verificationStatus が APPROVED/LEGACY の録音だけを読み込む（埋め込みを書き換えて REVIEW を混ぜると画面に出ない＝fail-closed）
// ⑥v0.82 以降に追加した録音はすべて APPROVED で、候補台帳の APPROVED と一致し、ライセンスは Public domain/CC0
// ⑦NPS の15本：165本・環境層8・生き物7、配信 FLAC・互換 MP3・軽量 MP3 がデコードでき長さが台帳と合う、原典は nps.gov
// ⑧research/ はアプリから読まれない（index.html・sw.js に research/ の参照なし）・コンソールエラー0。
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');(async()=>{
const R={},fail=[];const ok=(k,c)=>{R[k]=!!c;if(!c)fail.push(k)};
const root=path.join(__dirname,'..');const cands=JSON.parse(fs.readFileSync(root+'/research/source_review.json','utf8'));
const FIELDS=['id','title','category','subcategory','country','region','community','species','recordist','performer','recording_date','duration','original_url','original_file_url','file_format','sample_rate','bit_depth','bitrate','channels','license_name','license_url','license_evidence','commercial_use','redistribution','modification','social_export','performer_rights','cultural_consent','sacred_or_restricted','verification_date','verification_status','rejection_reason'];
ok('cand_fields',cands.length>=40&&cands.every(c=>FIELDS.every(f=>f in c)));
ok('cand_status',cands.every(c=>['APPROVED','REVIEW','REJECTED'].includes(c.verification_status)));
ok('cand_ids_unique',new Set(cands.map(c=>c.id)).size===cands.length);
const appr=cands.filter(c=>c.verification_status==='APPROVED'),hidden=cands.filter(c=>c.verification_status!=='APPROVED');
R.counts={approved:appr.length,review:cands.filter(c=>c.verification_status==='REVIEW').length,rejected:cands.filter(c=>c.verification_status==='REJECTED').length};
ok('approved_rights',appr.length===15&&appr.every(c=>/^(CC0|Public domain)/.test(c.license_name)&&c.license_url&&c.license_evidence&&c.verification_date&&/^[0-9a-f]{64}$/.test(c.sha256||'')&&c.sacred_or_restricted==='no'&&!c.rejection_reason));
ok('hidden_have_reason',hidden.every(c=>c.rejection_reason.length>5));
ok('sacred_never_approved',cands.filter(c=>c.sacred_or_restricted==='yes').every(c=>c.verification_status==='REJECTED')&&cands.some(c=>c.sacred_or_restricted==='yes'));
const html=fs.readFileSync(root+'/index.html','utf8');const blk=i=>JSON.parse(html.match(new RegExp('id="'+i+'">([\\s\\S]*?)</script>'))[1]);
const recs=blk('ae-recordings'),man=blk('ae-audio-manifest').recordings,cr=fs.readFileSync(root+'/CREDITS.md','utf8');
const snd=fs.readdirSync(root+'/audio-ecosystem-sounds-1/audio/pcm').concat(fs.readdirSync(root+'/audio-ecosystem-sounds-1/audio/compat'),fs.readdirSync(root+'/audio-ecosystem-sounds-1/audio/lite'));
R.leak=hidden.filter(c=>recs.some(r=>r.id===c.id||(c.original_url&&r.url===c.original_url))||man[c.id]||cr.includes('| '+c.id+' |')||snd.some(f=>f.startsWith(c.id+'.'))).map(c=>c.id);
ok('no_hidden_in_public',R.leak.length===0);
ok('all_public_have_status',recs.every(r=>['APPROVED','LEGACY'].includes(r.verificationStatus)));
const led=JSON.parse(fs.readFileSync(root+'/data/recording_licenses.json','utf8'));
ok('ledger_status_match',led.length===recs.length&&led.every(l=>{const r=recs.find(x=>x.id===l.id);return r&&r.verificationStatus===l.verificationStatus}));
ok('legacy_has_note',led.filter(l=>l.verificationStatus==='LEGACY').every(l=>l.reviewNote));
ok('approved_is_cc0_pd',led.filter(l=>l.verificationStatus==='APPROVED').every(l=>/^(CC0|Public domain)/.test(l.license)));
const v80=recs.filter(r=>r.added&&r.added>='v0.82');
ok('new_are_approved',v80.length===15&&v80.every(r=>r.verificationStatus==='APPROVED'&&appr.some(c=>c.id===r.id)&&/^https:\/\/www\.nps\.gov\/yell\//.test(r.url)&&r.license==='Public domain'));
ok('count',recs.length===165&&v80.filter(r=>r.fieldBed).length===8&&v80.filter(r=>r.kind==='species').length===7);
ok('credits',v80.every(r=>cr.includes('| '+r.id+' |')&&cr.includes('National Park Service')));
ok('research_not_loaded',!/(fetch\(|src=|href=|import\()['"`][^'"`]*research\//.test(html)&&!/research\//.test(fs.readFileSync(root+'/sw.js','utf8')));
const b=await chromium.launch();const pg=await b.newPage({viewport:{width:390,height:900}});await require('./photo_fixture')(pg);const errs=[];
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
await pg.goto('http://localhost:8765/index.html');await pg.waitForTimeout(800);
R.app=await pg.evaluate(()=>({n:__reviewDebug.ids().length,bad:__reviewDebug.statuses().filter(s=>!['APPROVED','LEGACY'].includes(s)).length}));
ok('app_count',R.app.n===165&&R.app.bad===0);
R.decode=await pg.evaluate(async ids=>{const man=JSON.parse(document.getElementById('ae-audio-manifest').textContent).recordings,oc=new OfflineAudioContext(2,48000,48000),bad=[];
 for(const id of ids){for(const kind of ['pcm','compat','lite']){const e=man[id][kind],p=kind==='pcm'?e.parts[0].path:e.path;
  try{const a=await oc.decodeAudioData(await (await fetch(p)).arrayBuffer());let pk=0;const d=a.getChannelData(0);for(let i=0;i<d.length;i+=7)pk=Math.max(pk,Math.abs(d[i]));
   if(Math.abs(a.duration-e.duration)>(kind==='pcm'?.01:.15)||pk<1e-4)bad.push(id+':'+kind+' '+a.duration.toFixed(3)+'/'+e.duration)}catch(er){bad.push(id+':'+kind+' '+er.message)}}}return bad},v80.map(r=>r.id));
ok('decode_all',R.decode.length===0);
// fail-closed：埋め込みの録音に REVIEW を1件混ぜたページを作り、読み込まれないことを確かめる
const poisoned=html.replace(/(id="ae-recordings">)(\[)/,(m,a,c)=>a+'['+JSON.stringify({...recs[0],id:'zz-review-probe',verificationStatus:'REVIEW'})+',');
const p2=await b.newPage();await require('./photo_fixture')(p2);await p2.route('**/index.html',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:poisoned}));
await p2.goto('http://localhost:8765/index.html');await p2.waitForTimeout(800);
R.probe=await p2.evaluate(()=>({n:__reviewDebug.ids().length,has:__reviewDebug.ids().includes('zz-review-probe')}));ok('fail_closed',R.probe.n===165&&!R.probe.has);
R.errs=errs;ok('no_console_errors',errs.length===0);
console.log(JSON.stringify(R,null,1));console.log(fail.length?'FAIL: '+fail.join(', '):'ALL PASS');await b.close();process.exit(fail.length?1:0)})().catch(e=>{console.error(e);process.exit(1)});
