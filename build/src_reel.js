// v0.31 リールモード（最小版） — ロードマップ フェーズ1 / バックログ2
// いまの演奏を縦1080×1920の映像（スペクトログラム・波形・いま鳴いている実録音の名前と録音地・帰属表示）と音で同時に録画し、
// ブラウザの MediaRecorder で書き出す（MP4 に対応するブラウザは MP4、それ以外は WebM。変換はしない）。
// 権利：リールに CC BY-SA を含めない（docs/COMMERCIAL_POLICY.md 2）。録画開始時に商用モードが「すべて」なら「BY-SAを除く」に切り替え、
// 録画中は「すべて」に戻せない。帰属表示（CC BY）は映像のテロップと、説明欄用のクレジット .txt の両方に入れる。
// 録音地は録音台帳の location（原本の記載）をそのまま表示し、分布とは混同しない。
var reelState=null;
const REEL_W=1080,REEL_H=1920,REEL_FPS=30;
function reelNote(kind,id){if(!reelState||!reelState.active||!id)return;const k=kind+':'+id;if(!reelState.used.has(k))reelState.used.set(k,{kind,id,origin:kind==='recording'?(bufferOrigins.get(id)||'embedded'):'embedded'})}
function reelGuard(){if(!reelState||!reelState.active)return false;const sel=$('rightsMode');if(sel)sel.value=RIGHTS.mode;
 $('message').replaceChildren(Object.assign(document.createElement('span'),{textContent:'録画中は「すべての素材」に切り替えられません（リールに BY-SA を含めないため）。'}));return true}
function reelMime(){if(typeof MediaRecorder==='undefined'||!MediaRecorder.isTypeSupported)return null;
 for(const m of ['video/mp4;codecs=avc1.42E01F,mp4a.40.2','video/mp4;codecs=avc1,mp4a','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'])if(MediaRecorder.isTypeSupported(m))return m;return null}
function reelMeta(){try{return JSON.parse($('ae-wildlife-meta').textContent)}catch(e){return {}}}
const REEL_META=reelMeta();
// いま鳴っている実録音（生き物の声→環境層の順）。録音のない合成音は名前を出さない。
function reelNowPlaying(){const out=[],seen=new Set();
 const add=(id,role)=>{if(seen.has(id))return;const r=recordings.find(x=>x.id===id);if(!r)return;seen.add(id);out.push({id,role,r,en:REEL_META[id]?.en||''})};
 for(const id of activeBio.keys())add(id,'bio');for(const v of fieldVoices)add(v.id,'field');return out}
function reelMsg(parts){$('message').replaceChildren(...parts.flatMap((t,i)=>{const s=Object.assign(document.createElement('span'),{textContent:t});return i?[' ',s]:[s]}))}
let reelSpec=null,reelFreq=null,reelWave=null;
function reelFit(c,text,max){if(c.measureText(text).width<=max)return text;let t=text;while(t.length>1&&c.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…'}
function reelDraw(){const cv=$('reelCanvas');if(!cv)return;const c=cv.getContext('2d');const M=60,W=REEL_W-M*2;
 c.fillStyle='#0c1718';c.fillRect(0,0,REEL_W,REEL_H);
 c.fillStyle='#e4eee8';c.font='600 66px ui-monospace,Menlo,monospace';c.textBaseline='alphabetic';c.fillText('AUDIO ECOSYSTEM',M,150);
 c.fillStyle='#99b4aa';c.font='28px ui-monospace,Menlo,monospace';c.fillText('実録音の自然音で自律演奏 / Real field recordings, played live',M,200);
 // スペクトログラム（右から左へ流れる。縦軸は対数周波数 40Hz〜16kHz）
 const SX=M,SY=260,SH=820;if(!reelSpec){reelSpec=document.createElement('canvas');reelSpec.width=W;reelSpec.height=SH;const s=reelSpec.getContext('2d');s.fillStyle='#0b1b1e';s.fillRect(0,0,W,SH)}
 const sc=reelSpec.getContext('2d');
 if(analyser&&ctx){if(!reelFreq||reelFreq.length!==analyser.frequencyBinCount)reelFreq=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(reelFreq);
  const step=4;sc.drawImage(reelSpec,-step,0);const ny=ctx.sampleRate/2,lo=Math.log(40),hi=Math.log(Math.min(16000,ny));
  for(let y=0;y<SH;y++){const f=Math.exp(hi-(y/SH)*(hi-lo)),bin=Math.min(reelFreq.length-1,Math.round(f/ny*reelFreq.length)),v=reelFreq[bin]/255;
   sc.fillStyle='hsl('+(190-v*150)+','+(35+v*45)+'%,'+(6+v*62)+'%)';sc.fillRect(W-step,y,step,1)}}
 c.drawImage(reelSpec,SX,SY);c.strokeStyle='#31484a';c.lineWidth=2;c.strokeRect(SX,SY,W,SH);
 c.fillStyle='#99b4aa';c.font='22px ui-monospace,Menlo,monospace';c.fillText('16 kHz',SX+12,SY+32);c.fillText('40 Hz',SX+12,SY+SH-14);
 // 波形
 const WY=1130,WH=170;c.strokeStyle='#31484a';c.strokeRect(M,WY,W,WH);
 if(analyser){if(!reelWave||reelWave.length!==analyser.fftSize)reelWave=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(reelWave);
  c.strokeStyle='#b5d6be';c.lineWidth=3;c.beginPath();for(let i=0;i<W;i++){const v=reelWave[Math.floor(i/W*reelWave.length)]||0,y=WY+WH/2-Math.max(-1,Math.min(1,v*2.2))*WH/2;i?c.lineTo(M+i,y):c.moveTo(M+i,y)}c.stroke()}
 // いま鳴っている実録音：名前（和名 / 英名）・学名・録音地（原本の記載）・ライセンス
 const now=reelNowPlaying();let y=1380;
 c.fillStyle='#99b4aa';c.font='24px ui-monospace,Menlo,monospace';c.fillText('いま鳴っている実録音 / NOW PLAYING'+(now.length>3?' (+'+(now.length-3)+')':''),M,y);y+=20;
 if(!now.length){c.fillStyle='#e4eee8';c.font='34px ui-monospace,Menlo,monospace';c.fillText('…',M,y+50)}
 for(const n of now.slice(0,3)){y+=52;c.fillStyle='#e4eee8';c.font='600 36px ui-monospace,Menlo,monospace';c.fillText(reelFit(c,n.r.jp+(n.en?' / '+n.en:''),W),M,y);
  y+=36;c.fillStyle='#b8dcc8';c.font='24px ui-monospace,Menlo,monospace';c.fillText(reelFit(c,(n.r.latin&&n.r.latin!=='該当なし'?n.r.latin+' · ':'')+'録音地 / Recorded at: '+(n.r.location||'—'),W),M,y);
  y+=32;c.fillStyle='#99b4aa';c.font='22px ui-monospace,Menlo,monospace';c.fillText(reelFit(c,'"'+(n.r.title||'')+'" — '+(n.r.author||'')+' · '+(n.r.license||''),W),M,y)}
 // 下部：権利の表示と経過時間
 c.fillStyle='#99b4aa';c.font='22px ui-monospace,Menlo,monospace';
 c.fillText(reelFit(c,'Commercial mode: '+({all:'all sources',nosa:'no CC BY-SA',cc0:'CC0 / PD only'}[RIGHTS.mode])+' · Full credits in caption / 全クレジットは説明欄',W),M,REEL_H-110);
 const st=reelState,el=st&&st.active?(performance.now()-st.startedAt)/1000:0;c.fillStyle='#e4eee8';c.font='600 28px ui-monospace,Menlo,monospace';
 c.fillText(st&&st.active?'● REC '+el.toFixed(1)+' / '+st.sec+' s':'AUDIO ECOSYSTEM · SAW SOUND LAB',M,REEL_H-60);
 if(st&&st.active)st.frames++}
function reelLoop(){if(!reelState||!reelState.active)return;reelDraw();const el=(performance.now()-reelState.startedAt)/1000;
 const s=$('reelStatus');const txt='● REC '+Math.floor(el)+' / '+reelState.sec+' SEC';if(s.textContent!==txt)s.textContent=txt;reelState.raf=requestAnimationFrame(reelLoop)}
// v0.32 キャプション案（日英）：説明欄用 .txt の先頭に入れる。聞こえた実録音の名前と録音地（録音台帳の location＝原本の記載のまま。分布ではない）を最大4件。
// 合成音も鳴るため「実録音だけ」とは書かない。投稿するかどうか・文面の編集はオーナーが行う（自動投稿はしない）。
function reelCaption(entries){
 const recs=entries.filter(e=>e.kind==='recording'&&!e.imported).map(e=>({e,r:recordings.find(x=>x.id===e.id)})).filter(x=>x.r);
 const top=recs.slice(0,4),more=recs.length-top.length;
 const ja=top.map(({e,r})=>e.name+'（録音地：'+(r.location||'原本に記載なし')+'）').join('、');
 const en=top.map(({e,r})=>(e.en||e.latin||e.name)+' (recorded at: '+(r.location||'not stated in the source')+')').join(', ');
 return ['── キャプション案（日本語）※投稿前に確認・編集してください ──','自然の実録音を使って、その場で自律演奏したアンビエントです。',
  ...(top.length?['聞こえる音：'+ja+(more>0?' ほか'+more+'件':'')]:[]),
  '音源のクレジット（帰属表示）は下記のとおりです。','#自然音 #環境音 #フィールドレコーディング #アンビエント #AUDIOECOSYSTEM','',
  '── Caption draft (English) — review and edit before posting ──','Generative ambient, played live with real field recordings of nature.',
  ...(top.length?['Heard here: '+en+(more>0?' and '+more+' more':'')]:[]),
  'Sound credits (attribution) below.','#fieldrecording #naturesounds #ambient #soundscape #AUDIOECOSYSTEM']}
async function reelStart(sec,opts={}){
 if(reelState&&(reelState.active||reelState.finalizing))return;
 sec=Math.max(1,Math.min(60,Number(sec)||30));
 const mime=opts.mime?(typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(opts.mime)?opts.mime:null):reelMime();if(!mime)throw Error('この環境は動画の録画（MediaRecorder）に対応していません');
 const cv=$('reelCanvas');if(!cv.captureStream)throw Error('この環境はキャンバスの録画に対応していません');
 const notes=[];if(RIGHTS.mode==='all'){applyRights('nosa');notes.push('リールに BY-SA を含めないため、商用モードを「'+RIGHTS_MODES.nosa+'」に切り替えました。')}
 if(!playing)await start();
 // 対象外の声（モードを切り替えた直後にフェードアウト中のもの）が消えるまで待ってから録画を始める（最大3秒）。
 const blockedVoice=()=>[...activeBio.keys(),...[...fieldVoices].map(v=>v.id)].some(id=>!rightsAllowed(id));
 for(let i=0;i<30&&blockedVoice();i++)await new Promise(r=>setTimeout(r,100));
 const dest=ctx.createMediaStreamDestination();master._output.connect(dest);
 reelSpec=null;reelDraw();
 const stream=new MediaStream([...cv.captureStream(REEL_FPS).getVideoTracks(),...dest.stream.getAudioTracks()]);
 const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:opts.videoBitsPerSecond||8000000,audioBitsPerSecond:192000});
 reelState={active:true,finalizing:false,rec,dest,stream,chunks:[],used:new Map(),mime,sec,startedAt:performance.now(),frames:0,timer:null,raf:0};
 for(const id of activeBio.keys())reelNote('recording',id);for(const v of fieldVoices)reelNote('recording',v.id);for(const v of sampleVoices)reelNote('instrument',v.sid);
 rec.ondataavailable=e=>{if(e.data&&e.data.size)reelState.chunks.push(e.data)};rec.onstop=()=>reelFinalize();
 rec.start(1000);reelState.timer=setTimeout(reelStop,sec*1000);reelState.raf=requestAnimationFrame(reelLoop);
 $('reelRecord').disabled=true;$('reelCredits').hidden=true;
 reelMsg([...notes,'リールを録画中。'+sec+'秒で自動書き出しします。'])}
function reelStop(){const st=reelState;if(!st||!st.active)return;st.active=false;st.finalizing=true;clearTimeout(st.timer);cancelAnimationFrame(st.raf);
 st.duration=(performance.now()-st.startedAt)/1000;$('reelStatus').textContent='ENCODING…';try{st.rec.stop()}catch(e){reelFinalize()}}
function reelFinalize(){const st=reelState;if(!st||!st.finalizing)return;st.finalizing=false;
 try{st.stream.getTracks().forEach(t=>t.stop())}catch(e){}try{master._output.disconnect(st.dest)}catch(e){}
 try{const type=st.mime.split(';')[0],ext={'video/mp4':'mp4','video/x-matroska':'mkv'}[type]||'webm',blob=new Blob(st.chunks,{type});if(!blob.size)throw Error('録画データがありません');
  const now=new Date(),stamp=now.toISOString().replace(/[:.]/g,'-'),name='audio_ecosystem_reel_'+stamp+'.'+ext,entries=attributionEntries([...st.used.values()]),caption=reelCaption(entries);
  const text=['リール動画 / Reel video: '+name+' ('+REEL_W+'×'+REEL_H+', '+st.duration.toFixed(1)+' s, '+type+')','',...caption,'',attributionText(entries,{date:now})].join('\r\n');
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  const req=entries.filter(e=>!e.imported&&needsAttribution(e.license)).length,sa=entries.filter(e=>!e.imported&&rightsTierOf(e.license)==='C').length;
  st.result={name,type,size:blob.size,duration:st.duration,frames:st.frames,entries:entries.map(e=>({id:e.id,kind:e.kind,license:e.license,imported:!!e.imported})),text,caption:caption.join('\n'),sa};
  $('reelCreditsSummary').textContent='このリールのクレジット：素材'+entries.length+'件（帰属表示が必要 '+req+'件）';$('reelCreditsText').textContent=text;$('reelCredits').hidden=false;
  $('reelStatus').textContent=st.duration.toFixed(1)+' SEC · SAVED';
  reelMsg(['リール動画を書き出しました（'+ext.toUpperCase()+'・'+(blob.size/1024/1024).toFixed(1)+' MB）。',...(sa?['BY-SA の素材が'+sa+'件含まれています。このリールは公開しないでください。']:[])])}
 catch(e){$('reelStatus').textContent='EXPORT FAILED';reelMsg(['リールの書き出しに失敗しました: '+e.message]);st.result={error:e.message}}
 finally{$('reelRecord').disabled=false}}
$('reelRecord').addEventListener('click',()=>reelStart($('reelLength').value).catch(e=>{$('reelStatus').textContent='UNAVAILABLE';reelMsg(['リールを録画できません: '+e.message])}));
$('reelStop').addEventListener('click',reelStop);
$('reelCreditsSave').addEventListener('click',()=>{const r=reelState&&reelState.result;if(r&&r.text)saveText(r.name.replace(/\.(mp4|webm|mkv)$/,'')+'_credits.txt',r.text)});
reelDraw();
window.__reelDebug={start:(s,o)=>reelStart(s,o),stop:reelStop,mime:reelMime,now:()=>reelNowPlaying().map(n=>({id:n.id,role:n.role,location:n.r.location})),state:()=>reelState?{active:reelState.active,finalizing:reelState.finalizing,frames:reelState.frames,used:[...reelState.used.keys()],result:reelState.result||null}:null};
