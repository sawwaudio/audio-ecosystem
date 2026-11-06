/* saww audio ecosystem v0.43 — 写真で選ぶ音（See it. Tap it. Hear it.）・マスター EQ・リール作成・マルチトラック・プラン
   本体スクリプト（音声エンジン・音源ライブラリ）の後に読み込む。本体の関数と変数（ctx, master, recordings, loadOne, mixLane など）をそのまま使い、
   音声エンジンと音源の対応は変えない。build/integrate_v043.py が index.html の <script id="ae-studio"> にこのファイルを埋め込む。 */
(()=>{'use strict';
const VER='v0.43';
const PHOTOS=(()=>{try{return JSON.parse($('ae-photos').textContent)}catch(e){return {}}})();
const TIERS=(()=>{try{return JSON.parse($('ae-tiers').textContent)}catch(e){return {plans:[],features:[]}}})();
const APP_URL=/^https?:$/.test(location.protocol)&&!/^(localhost|127\.)/.test(location.hostname)?location.origin+location.pathname.replace(/index\.html$/,''):'https://sawwaudio.github.io/audio-ecosystem-sounds-1/';
const lang=()=>window.__i18n&&__i18n.get()==='en'?'en':'ja';
const L=(ja,en)=>lang()==='en'?en:ja;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=(tag,props={},...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k==='html')e.innerHTML=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids)if(c!=null)e.append(c);return e};
const msg=t=>{const m=$('message');if(m)m.replaceChildren(Object.assign(document.createElement('span'),{textContent:t}))};
const status=t=>{const s=$('tileStatus');if(s&&s.textContent!==t)s.textContent=t};

// ───────── 写真（学名で厳密に対応させる） ─────────
// 録音台帳の latin が「属 種小名」だけ（または直後に原典の注記）の時に限り、data/species_photos.json の同じ学名の写真を使う。
// 「sp.」「複数種」「記載なし」は写真を付けない（推定しない）。自分の音は利用者が選んだ画像。
function binomial(latin){const m=/^([A-Z][a-z]+ [a-z]+)(?:（|$)/.exec(latin||'');return m&&!/ sp$/.test(m[1])?m[1]:null}
function photoFor(id){const u=userSounds.get(id);if(u)return u.img?{user:true,thumb:u.img,small:u.img,author:L('利用者の画像','User image'),license:'',page:''}:null;
 const r=recordings.find(x=>x.id===id);const b=r&&binomial(r.latin);const p=b&&PHOTOS[b];if(!p)return null;
 return {...p,latin:b,small:/\/960px-/.test(p.thumb)?p.thumb.replace('/960px-','/330px-'):p.thumb}}
const GROUP_LABEL={birds:['鳥','BIRD'],insects:['虫','INSECT'],animals:['動物','ANIMAL'],landscape:['水・環境','AMBIENCE'],user:['自分の音','MY SOUND']};
function groupOf(id){if(userSounds.has(id))return 'user';const r=recordings.find(x=>x.id===id);return r?(r.kind==='landscape'?'landscape':r.group):'landscape'}
// 統一したプレースホルダー（写真がない音）。色はグループごと、線は同じ型。
const PH_HUE={birds:150,insects:95,animals:30,landscape:195,user:265};
function placeholderSVG(id,g){let h=0;for(const ch of id)h=(h*31+ch.charCodeAt(0))>>>0;const hue=PH_HUE[g]??180,rot=h%360,rings=[];
 for(let i=0;i<7;i++){const r=14+i*11,wob=2+((h>>(i*3))&7)*.6;let d='';for(let k=0;k<=48;k++){const a=k/48*6.2832,rr=r+Math.sin(a*3+i+rot)*wob;d+=(k?'L':'M')+(60+Math.cos(a)*rr).toFixed(1)+' '+(60+Math.sin(a)*rr).toFixed(1)}rings.push('<path d="'+d+'Z" fill="none" stroke="hsla('+hue+',45%,'+(70-i*5)+'%,'+(0.55-i*.06).toFixed(2)+')" stroke-width="1"/>')}
 return '<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="120" height="120" fill="hsl('+hue+',30%,9%)"/>'+rings.join('')+'<circle cx="60" cy="60" r="3" fill="hsl('+hue+',60%,75%)"/></svg>'}

// ───────── 音を鳴らす（写真のタイル） ─────────
// タップで実録音をループ再生（切れ目はクロスフェード）。もう一度タップで止める。いくつでも重ねられる（同時に鳴らす数は 12 まで）。
// 行き先はミキサーのチャンネル：生き物の声→「生き物」、環境の録音→「環境音」、自分の音→「サンプラー」。EQ・FX・録音・リールにそのまま入る。
const userSounds=new Map();const tileState=new Map();let focusId=null;const TILE_MAX=12;
function tst(id){let s=tileState.get(id);if(!s){s={id,vol:70,pan:0,loop:true,voice:null,loading:false};tileState.set(id,s)}return s}
function chanOf(id){if(userSounds.has(id))return 'sampler';const r=recordings.find(x=>x.id===id);return r&&r.kind==='landscape'?'field':'bio'}
function nameOf(id){const u=userSounds.get(id);if(u)return u.name;const r=recordings.find(x=>x.id===id);return r?r.jp:id}
function playingIds(){return [...tileState.values()].filter(s=>s.voice).map(s=>s.id)}
// タイルは1つずつ聞くことが多いので、自律演奏の1声（×0.5）より 6dB 大きく鳴らす（全体はマスターのリミッターで守る）
function ampOf(id){const u=userSounds.get(id);if(u)return u.amp;const r=recordings.find(x=>x.id===id);return 1*(bufferGains.get(id)??r?.performanceGain??1)}
function creditKeysOf(id){const u=userSounds.get(id);return u?[...(u.credits||[])]:[]}
function noteTile(id,fn){fn('recording',id);for(const k of creditKeysOf(id)){const [kind,...rest]=k.split(':');fn(kind,rest.join(':'))}}
async function bufferOf(id){const u=userSounds.get(id);if(u)return u.buffer;return loadOne(id)}
async function tileStart(id){const s=tst(id);if(s.voice||s.loading)return;
 if(!userSounds.has(id)&&!rightsAllowed(id)){status(L('この録音は商用モードの対象外のため鳴らしません（代用しません）。','This recording is excluded by the commercial mode, so it will not play (no substitute).'));return}
 if(playingIds().length>=TILE_MAX){status(L('同時に鳴らせるのは12までです。どれかを止めてください。','Up to 12 sounds can play at once. Stop one first.'));return}
 s.loading=true;renderTile(id);
 try{await smpEnsureCtx();const b=await bufferOf(id);if(!b)throw Error('no buffer');if(!s.loading)return;
  const out=G(s.vol/100),pan=ctx.createStereoPanner?ctx.createStereoPanner():G(1),wet=G(.12),an=ctx.createAnalyser();an.fftSize=256;an.smoothingTimeConstant=.6;
  if(pan.pan)pan.pan.value=s.pan;out.connect(pan);pan.connect(mixLane(chanOf(id)));pan.connect(wet);wet.connect(mixLane(chanOf(id),'wet'));out.connect(an);
  const v={b,out,pan,wet,an,srcs:new Set(),timer:0,amp:ampOf(id),started:ctx.currentTime};s.voice=v;s.loading=false;focusId=id;
  const spawn=(t,first)=>{if(s.voice!==v)return;const d=b.duration,fade=Math.min(1.5,d/6),src=ctx.createBufferSource(),env=G(0);src.buffer=b;src.connect(env);env.connect(out);
   env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(v.amp,t+(first?.12:fade));env.gain.setValueAtTime(v.amp,Math.max(t+.13,t+d-fade));env.gain.linearRampToValueAtTime(0,t+d);
   src.start(t);src.stop(t+d+.05);const n={src,env};v.srcs.add(n);src.onended=()=>{v.srcs.delete(n);try{env.disconnect()}catch(e){}};
   const next=t+d-fade;if(s.loop)v.timer=setTimeout(()=>spawn(next,false),Math.max(0,(next-ctx.currentTime-.4)*1000));else v.timer=setTimeout(()=>{if(s.voice===v&&!s.loop)tileStop(id)},Math.max(0,(t+d-ctx.currentTime)*1000))};
  spawn(ctx.currentTime+.03,true);if(userSounds.has(id))bufferOrigins.set(id,'import');noteTile(id,noteRecUse);
  status(nameOf(id)+' を再生中');}
 catch(e){s.loading=false;s.voice=null;status(L('読み込みに失敗しました: ','Loading failed: ')+(e.message||e.name))}
 finally{renderTile(id);renderCount()}}
function tileStop(id,fast){const s=tileState.get(id);if(!s)return;s.loading=false;const v=s.voice;if(!v){renderTile(id);return}s.voice=null;clearTimeout(v.timer);
 const t=ctx.currentTime,tc=fast?.02:.12;for(const n of v.srcs){try{n.env.gain.cancelScheduledValues(t);n.env.gain.setValueAtTime(n.env.gain.value,t);n.env.gain.setTargetAtTime(0,t,tc);n.src.stop(t+tc*6)}catch(e){}}
 setTimeout(()=>{for(const x of [v.out,v.pan,v.wet,v.an])try{x.disconnect()}catch(e){}},tc*7000+100);if(focusId===id)focusId=playingIds().slice(-1)[0]||null;renderTile(id);renderCount()}
function tileToggle(id){const s=tst(id);if(s.voice||s.loading)tileStop(id);else tileStart(id)}
function tileStopAll(){for(const id of playingIds())tileStop(id);for(const s of tileState.values())s.loading=false;renderAllTiles()}
function setTileVol(id,v){const s=tst(id);s.vol=clamp(+v,0,100);if(s.voice)s.voice.out.gain.setTargetAtTime(s.vol/100,ctx.currentTime,.05)}
function setTilePan(id,v){const s=tst(id);s.pan=clamp(+v,-1,1);if(s.voice&&s.voice.pan.pan)s.voice.pan.pan.setTargetAtTime(s.pan,ctx.currentTime,.05)}
// 商用モードが変わったら、対象外になった音を止める（代用しない）
setInterval(()=>{for(const id of playingIds())if(!userSounds.has(id)&&!rightsAllowed(id))tileStop(id,true);renderRightsDim()},400);

// ───────── タイルの画面 ─────────
const FILTERS=[['all','すべて','All'],['birds','鳥','Birds'],['insects','虫','Insects'],['animals','動物','Animals'],['landscape','水・環境','Water & places'],['japan','日本','Japan'],['photo','写真あり','With photos'],['user','自分の音','My sounds'],['playing','再生中','Playing']];
let tileFilter='all';
function tileIds(){const lib=recordings.map(r=>r.id);const order=id=>{const p=photoFor(id)?0:1,r=recordings.find(x=>x.id===id),k=r.kind==='species'?0:r.kind==='mixed'?1:2;return p*10+k};
 const sorted=lib.slice().sort((a,b)=>order(a)-order(b));return [...userSounds.keys(),...sorted]}
function matches(id){const g=groupOf(id);if(tileFilter==='all')return true;if(tileFilter==='user')return g==='user';if(tileFilter==='playing')return !!tst(id).voice;if(tileFilter==='photo')return !!photoFor(id);
 if(tileFilter==='japan'){const r=recordings.find(x=>x.id===id),m=wildMeta[id]||{};return !!r&&(r.japanRecording===true||(m.recordedRegions||[]).includes('japan')||m.japanNative===true)}
 return g===tileFilter}
function subOf(id){const u=userSounds.get(id);if(u)return u.origin==='mic'?L('マイク録音','Mic recording'):u.origin==='bounce'?L('出音の録音','Output recording'):L('読み込んだ音','Imported audio');
 const r=recordings.find(x=>x.id===id);const b=binomial(r.latin);if(b)return b;const m=wildMeta[id]||{};return m.recordedCountry||''}
function buildTiles(){const grid=$('tileGrid');if(!grid)return;grid.textContent='';
 let uid=0;for(const id of tileIds()){if(!matches(id))continue;uid++;const g=groupOf(id),p=photoFor(id),r=recordings.find(x=>x.id===id);
  const img=p?el('img',{src:p.small,alt:'',loading:'lazy',decoding:'async',referrerpolicy:'no-referrer'}):el('span',{class:'ph',html:placeholderSVG(id,g)});
  if(p)img.addEventListener('error',()=>{img.replaceWith(el('span',{class:'ph',html:placeholderSVG(id,g)}))},{once:true});
  const tierLetter=r?rightsTierOf(r.license):'U';
  const play=el('button',{type:'button',class:'tilePlay','aria-pressed':'false','data-id':id},el('span',{class:'tileImg'},img,!p?el('span',{class:'phLabel',text:GROUP_LABEL[g]?GROUP_LABEL[g][1]:''}):null),
   el('canvas',{class:'tileWave',width:'120',height:'26','aria-hidden':'true'}),el('span',{class:'tileText'},el('span',{class:'tileName',id:'tn-'+uid,text:nameOf(id)}),el('span',{class:'tileSub','data-i18n-skip':/^[A-Z]/.test(subOf(id))?'':false,text:subOf(id)})),
   el('span',{class:'tileTier tier'+tierLetter,'aria-hidden':'true',text:tierLetter}));
  const info=el('button',{type:'button',class:'tileInfo','aria-labelledby':'ti-'+uid+' tn-'+uid,'data-id':id},el('span',{'aria-hidden':'true',text:'i'}),el('span',{id:'ti-'+uid,hidden:true,text:'詳細'}));
  const tile=el('div',{class:'tile','data-id':id,'data-group':g},play,info);grid.append(tile);bindTile(tile,id);renderTile(id)}
 if(!grid.children.length)grid.append(el('p',{class:'micro',text:tileFilter==='user'?L('まだありません。「＋ 自分の音を追加」から読み込めます。','Nothing yet. Add one with “＋ Add my sound”.'):L('該当する音がありません。','No sounds match.')}));
 renderCount();renderRightsDim()}
function bindTile(tile,id){const play=tile.querySelector('.tilePlay'),info=tile.querySelector('.tileInfo');let timer=0,long=false,sx=0,sy=0;
 play.addEventListener('pointerdown',e=>{long=false;sx=e.clientX;sy=e.clientY;clearTimeout(timer);timer=setTimeout(()=>{long=true;openSheet(id)},520)});
 play.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-sx,e.clientY-sy)>12)clearTimeout(timer)});
 for(const ev of ['pointerup','pointercancel','pointerleave'])play.addEventListener(ev,()=>clearTimeout(timer));
 play.addEventListener('contextmenu',e=>e.preventDefault());
 play.addEventListener('click',e=>{if(long){long=false;e.preventDefault();return}tileToggle(id)});
 play.addEventListener('keydown',e=>{if(e.key==='i'||e.key==='I'||(e.key==='Enter'&&e.shiftKey)){e.preventDefault();openSheet(id)}});
 info.addEventListener('click',()=>openSheet(id))}
function renderTile(id){const s=tileState.get(id);for(const tile of document.querySelectorAll('.tile[data-id="'+CSS.escape(id)+'"]')){const b=tile.querySelector('.tilePlay'),on=!!(s&&s.voice),ld=!!(s&&s.loading);
  tile.classList.toggle('on',on);tile.classList.toggle('loading',ld);b.setAttribute('aria-pressed',String(on));
  b.setAttribute('aria-label',nameOf(id))}
 if(sheetId===id)renderSheet()}
function renderAllTiles(){for(const id of tileIds())renderTile(id);renderCount()}
function renderCount(){const c=$('tileCount');if(c){const n=playingIds().length;c.textContent=n?L(n+'音を再生中',n+' playing'):L(recordings.length+'録音',recordings.length+' recordings')}const tr=$('tileToReel');if(tr)tr.disabled=!playingIds().length}
function renderRightsDim(){for(const tile of document.querySelectorAll('.tile')){const id=tile.dataset.id;const blocked=!userSounds.has(id)&&!rightsAllowed(id);if(tile.classList.contains('blocked')!==blocked)tile.classList.toggle('blocked',blocked)}}
// 再生中のタイルに小さな波形（周波数の棒）を描く
let paintAt=0;function paintTiles(now){requestAnimationFrame(paintTiles);if(now-paintAt<40)return;paintAt=now;
 for(const id of playingIds()){const s=tileState.get(id),v=s.voice;const cv=document.querySelector('.tile[data-id="'+CSS.escape(id)+'"] .tileWave');if(!cv||!v)continue;
  const c=cv.getContext('2d'),W=cv.width,H=cv.height,f=v.fbuf||(v.fbuf=new Uint8Array(v.an.frequencyBinCount));v.an.getByteFrequencyData(f);c.clearRect(0,0,W,H);
  const N=20,bw=W/N;c.fillStyle='rgba(214,239,200,.95)';for(let i=0;i<N;i++){const k=Math.floor(Math.pow(i/N,1.6)*f.length*.7)+1,val=f[k]/255,h=Math.max(1.5,val*H);c.fillRect(i*bw+1,(H-h)/2,bw-2,h)}}}
requestAnimationFrame(paintTiles);

// ───────── 詳細シート（長押し・i ボタン） ─────────
let sheetId=null;
function openSheet(id){sheetId=id;const d=$('tileSheet');renderSheet();if(d.showModal&&!d.open)d.showModal();else d.setAttribute('open','');setTimeout(()=>$('sheetPlay')?.focus(),30)}
function closeSheet(){const d=$('tileSheet');if(d.open&&d.close)d.close();else d.removeAttribute('open');const id=sheetId;sheetId=null;const b=document.querySelector('.tile[data-id="'+CSS.escape(id||'')+'"] .tilePlay');if(b)b.focus()}
function fmtSource(id){const e=audioManifest.recordings[id];const pc=e&&(e.pcm||e.compat);if(!pc)return '';return (pc.codec||pc.format||'')+' · '+(pc.sampleRate/1000)+' kHz · '+pc.channels+'ch · '+(pc.duration||0).toFixed(1)+' s'}
function renderSheet(){const id=sheetId;if(!id)return;const s=tst(id),u=userSounds.get(id),r=recordings.find(x=>x.id===id),m=wildMeta[id]||{},p=photoFor(id),g=groupOf(id);
 $('sheetName').textContent=nameOf(id);$('sheetLatin').textContent=r?(binomial(r.latin)||r.latin||''):subOf(id);
 const ph=$('sheetPhoto');ph.textContent='';ph.append(p?el('img',{src:p.thumb,alt:L(nameOf(id)+'の写真',(m.en||nameOf(id))+' photo'),referrerpolicy:'no-referrer'}):el('span',{class:'ph',html:placeholderSVG(id,g)}));
 $('sheetPhotoCredit').textContent=p&&!p.user?L('写真：','Photo: ')+p.author+' · '+p.license+' · Wikimedia Commons':p&&p.user?L('画像：利用者が設定','Image: set by you'):L('写真なし（統一プレースホルダー）','No photo (standard placeholder)');
 const pb=$('sheetPlay');pb.textContent=s.voice?L('■ 停止','■ Stop'):s.loading?L('読み込み中…','Loading…'):L('▶ 再生','▶ Play');pb.setAttribute('aria-pressed',String(!!s.voice));
 $('sheetVol').value=String(s.vol);$('sheetVolVal').textContent=String(s.vol);$('sheetPan').value=String(Math.round(s.pan*100));$('sheetPanVal').textContent=s.pan===0?'C':(s.pan<0?'L':'R')+Math.round(Math.abs(s.pan)*100);$('sheetLoop').checked=s.loop;
 $('sheetUser').hidden=!u;const dl=$('sheetInfo');dl.textContent='';
 const row=(k,v,href)=>{if(v==null||v==='')return;dl.append(el('dt',{text:k}),el('dd',{},href?el('a',{href,target:'_blank',rel:'noopener',text:v}):document.createTextNode(v)))};
 if(u){row('種類 / Type',u.origin==='mic'?'マイク録音 / Mic recording':u.origin==='bounce'?'出音の録音 / Output recording':'読み込んだ音声 / Imported audio');row('ファイル / File',u.file||'');row('長さ / Length',u.buffer.duration.toFixed(2)+' s · '+u.buffer.sampleRate/1000+' kHz · '+u.buffer.numberOfChannels+'ch');
  row('権利 / Rights','利用者が確認する（tier U）。端末の外へ送信しません / Your responsibility (tier U). Never uploaded.');if(u.credits&&u.credits.size)row('含まれる素材 / Includes',u.credits.size+'件の実録音（書き出しのクレジットに入ります）')}
 else if(r){row('和名 / Name',r.jp);row('英名 / English',m.en||'');row('学名 / Scientific name',r.latin);row('グループ / Group',(GROUP_LABEL[g]||[g,g]).join(' / '));
  row('録音地 / Recorded at',r.location);row('国・地域 / Country',[m.recordedCountry,m.recordedArea].filter(Boolean).join(' · '));row('録音日 / Date',r.date);row('野外・飼育 / Wild or captive',m.wildOrCaptive||'');
  row('作品名 / Title',r.title);row('録音者・作者 / Recordist',r.author);row('ライセンス / License',r.license,r.licenseURL);row('区分 / Tier',rightsTierOf(r.license)+(rightsAllowed(id)?'':' · いまの商用モードでは鳴らしません / excluded by the current commercial mode'));
  row('出典 / Source',r.url,r.url);row('音声形式 / Format',fmtSource(id));row('加工 / Changes',r.changes||'抜粋（区間の切り出し）。音量は再生時に正規化 / Excerpt; loudness normalised at playback');row('メモ / Notes',r.notes||'')}
 if(p&&!p.user){row('写真 / Photo',p.file,p.page);row('写真の作者 / Photographer',p.author);row('写真のライセンス / Photo license',p.license,p.licenseURL||null);row('写真の同定 / Photo ID basis',p.from+'（学名 '+p.latin+' と完全一致）')}}
function bindSheet(){const d=$('tileSheet');if(!d)return;
 $('sheetClose').addEventListener('click',closeSheet);d.addEventListener('cancel',e=>{e.preventDefault();closeSheet()});d.addEventListener('click',e=>{if(e.target===d)closeSheet()});
 $('sheetPlay').addEventListener('click',()=>{if(sheetId)tileToggle(sheetId)});
 $('sheetVol').addEventListener('input',e=>{if(!sheetId)return;setTileVol(sheetId,e.target.value);$('sheetVolVal').textContent=e.target.value});
 $('sheetPan').addEventListener('input',e=>{if(!sheetId)return;setTilePan(sheetId,e.target.value/100);renderSheet()});
 $('sheetLoop').addEventListener('change',e=>{if(!sheetId)return;const s=tst(sheetId);s.loop=e.target.checked;if(s.voice&&!s.loop){/* いまの1回が終わったら止まる */}});
 $('sheetSetImage').addEventListener('click',()=>$('tileUserImage').click());
 $('tileUserImage').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f||!sheetId||!userSounds.has(sheetId))return;const u=userSounds.get(sheetId);if(u.img)URL.revokeObjectURL(u.img);u.img=URL.createObjectURL(f);buildTiles();renderSheet()});
 $('sheetRemoveUser').addEventListener('click',()=>{const id=sheetId;if(!id||!userSounds.has(id))return;tileStop(id,true);const u=userSounds.get(id);if(u.img)URL.revokeObjectURL(u.img);userSounds.delete(id);tracks.splice(0,tracks.length,...tracks.filter(t=>t.src!==id));closeSheet();buildTiles();renderTracks();renderTrackSources()})}

// ───────── 自分の音を読み込む（WAV・AIFF・MP3・M4A・FLAC。端末の外へは送らない） ─────────
function uniqueId(prefix,name){let id=prefix+':'+name,n=2;while(userSounds.has(id))id=prefix+':'+name+' ('+(n++)+')';return id}
function rmsOf(b){let q=0,n=0;const step=Math.max(1,Math.floor(b.length/400000));for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i+=step){q+=d[i]*d[i];n++}}return Math.sqrt(q/Math.max(1,n))}
function addUserSound(name,buffer,origin,extra={}){const id=uniqueId(origin==='mic'?'mic':origin==='bounce'?'bounce':'import',name);const rms=rmsOf(buffer);
 userSounds.set(id,{id,name,file:extra.file||name,buffer,origin,img:null,amp:clamp(.035/Math.max(1e-5,rms),.05,6),credits:extra.credits||new Set()});bufferOrigins.set(id,'import');return id}
// AIFF（非圧縮 PCM）の読み込み。Chrome は decodeAudioData で AIFF を読めないため自前で読む。AIFC の圧縮形式は扱わない。
function parseAiff(ab){const v=new DataView(ab);const s4=o=>String.fromCharCode(v.getUint8(o),v.getUint8(o+1),v.getUint8(o+2),v.getUint8(o+3));
 if(s4(0)!=='FORM'||!/^AIF[FC]$/.test(s4(8)))return null;let o=12,ch=0,frames=0,bits=0,sr=0,data=-1,comp='NONE';
 while(o+8<=ab.byteLength){const id=s4(o),len=v.getUint32(o+4);const b=o+8;
  if(id==='COMM'){ch=v.getUint16(b);frames=v.getUint32(b+2);bits=v.getUint16(b+6);const e=v.getUint16(b+8)&0x7fff,hi=v.getUint32(b+10),lo=v.getUint32(b+14);sr=(hi*2**32+lo)*2**(e-16383-63);if(s4(8)==='AIFC'&&len>=22)comp=s4(b+18)}
  if(id==='SSND')data=b+8+v.getUint32(b);o=b+len+(len&1)}
 if(data<0||!ch||!frames||!/^(NONE|twos|sowt)$/.test(comp)||![8,16,24,32].includes(bits))return null;
 const le=comp==='sowt',bps=bits/8,out=new AudioBuffer({length:frames,numberOfChannels:ch,sampleRate:Math.round(sr)}),full=2**(bits-1);
 for(let c=0;c<ch;c++){const d=out.getChannelData(c);for(let i=0;i<frames;i++){const p=data+(i*ch+c)*bps;let x;
  if(bits===8)x=v.getInt8(p);else if(bits===16)x=v.getInt16(p,le);else if(bits===24){x=le?(v.getUint8(p)|v.getUint8(p+1)<<8|v.getInt8(p+2)<<16):(v.getInt8(p)<<16|v.getUint8(p+1)<<8|v.getUint8(p+2))}else x=v.getInt32(p,le);d[i]=x/full}}
 return out}
async function decodeUserFile(f){if(f.size>300*1024*1024)throw Error(L('300MB を超えるファイルは読み込みません','Files over 300 MB are not loaded'));const ab=await f.arrayBuffer();
 try{return await ctx.decodeAudioData(ab.slice(0))}catch(e){const a=parseAiff(ab);if(a)return a;throw Error(L('このブラウザはこの形式を読み込めません（','This browser cannot decode this format (')+(f.type||f.name.split('.').pop())+')')}}
async function importFiles(files){if(!files||!files.length)return;await smpEnsureCtx();let ok=0;
 for(const f of files){try{const b=await decodeUserFile(f);if(b.duration>600)throw Error(L('10分を超える音声は読み込みません','Audio longer than 10 minutes is not loaded'));const id=addUserSound(f.name.replace(/\.[^.]+$/,''),b,'import',{file:f.name});ok++;focusId=id}
  catch(e){status(f.name+': '+(e.message||e.name))}}
 if(ok){tileFilter='user';renderFilters();buildTiles();renderTrackSources();status(L(ok+'件の音を読み込みました。タップで鳴ります（端末の外へは送信しません）。',ok+' sound(s) loaded. Tap to play (never uploaded).'))}}

function renderFilters(){const box=$('tileFilters');if(!box)return;box.textContent='';for(const [k,ja,en] of FILTERS){const b=el('button',{type:'button','aria-pressed':String(tileFilter===k),text:L(ja,en),'data-f':k});b.addEventListener('click',()=>{tileFilter=k;renderFilters();buildTiles()});box.append(b)}}

// ───────── マスター EQ（全体のロー・ミドル・ハイ） ─────────
function buildMasterEq(){const box=$('mixMasterEq');if(!box)return;box.textContent='';
 for(const key of ['low','mid','hi']){const c=MIX_CTRL[key],k=el('div',{class:'knob',tabindex:'0',role:'slider','data-k':key,'aria-label':'マスター '+c.label,'aria-valuemin':String(c.min),'aria-valuemax':String(c.max)});
  k.innerHTML='<span class="lbl">'+c.label+'</span><span class="dial"></span><span class="val"></span>';box.append(k);mixBind(k,'master',key,false);mixRenderCtl('master',key)}
 const rs=$('mixReset');if(rs){const prev=rs.onclick;rs.onclick=e=>{prev&&prev.call(rs,e);for(const k of ['low','mid','hi'])mixSet('master',k,.5)}}}

// ───────── マルチトラック（PRO の土台） ─────────
// トラック＝音（ライブラリの実録音・自分の音）＋開始位置・音量・定位・ミュート・ソロ・送り先。全トラックを同じ時刻に揃えて再生・ループする。
// 録音はマイク（トラックを鳴らしながら重ね録り可）か、いまの出音。ミックスダウンは 24-bit の WAV・AIFF（ミキサーの EQ・FX は含まない素の和）。
const tracks=[];let trkSeq=0;const trk={playing:false,t0:0,timer:0,voices:new Set(),loop:true,rec:null};
function trackLen(){let L0=0;for(const t of tracks){const b=t.buffer;if(b)L0=Math.max(L0,t.offset+b.duration)}return L0}
function audible(t){const solo=tracks.some(x=>x.solo);return !t.mute&&(!solo||t.solo)&&t.buffer}
async function addTrack(src){const t={id:++trkSeq,src,offset:0,vol:.8,pan:0,mute:false,solo:false,dest:'sampler',buffer:null};tracks.push(t);renderTracks();
 try{await smpEnsureCtx();t.buffer=await bufferOf(src);if(!userSounds.has(src)&&!rightsAllowed(src)){tracks.splice(tracks.indexOf(t),1);status(L('商用モードの対象外の録音はトラックに入れません。','Recordings excluded by the commercial mode cannot be added.'))}}
 catch(e){tracks.splice(tracks.indexOf(t),1);trkStatus(L('読み込みに失敗しました: ','Loading failed: ')+(e.message||e.name))}renderTracks()}
function trkDest(t){return t.dest==='master'?master._lim:mixLane('sampler')}
function trkSchedule(t0){for(const t of tracks){if(!audible(t))continue;if(!userSounds.has(t.src)&&!rightsAllowed(t.src))continue;const src=ctx.createBufferSource(),g=G(t.vol*ampOf(t.src)),pan=ctx.createStereoPanner?ctx.createStereoPanner():G(1);
  src.buffer=t.buffer;if(pan.pan)pan.pan.value=t.pan;src.connect(g);g.connect(pan);pan.connect(trkDest(t));const at=Math.max(ctx.currentTime,t0+t.offset);src.start(at);const v={src,g,pan,t};trk.voices.add(v);src.onended=()=>{trk.voices.delete(v);try{pan.disconnect()}catch(e){}};
  noteTile(t.src,noteRecUse)}}
async function trkPlay(){if(!tracks.some(t=>t.buffer)){trkStatus(L('トラックがありません。','No tracks yet.'));return}await smpEnsureCtx();trkStop(true);trk.playing=true;const len=trackLen();trk.t0=ctx.currentTime+.08;trkSchedule(trk.t0);
 const loopNext=()=>{if(!trk.playing||!trk.loop||trk.rec)return;trk.t0+=len;trkSchedule(trk.t0);trk.timer=setTimeout(loopNext,Math.max(50,(trk.t0+len-ctx.currentTime-.3)*1000))};
 trk.timer=setTimeout(()=>{if(trk.loop&&!trk.rec)loopNext();else if(!trk.rec)trk.timer=setTimeout(()=>trkStop(),Math.max(0,(trk.t0+len-ctx.currentTime)*1000)+80)},Math.max(50,(trk.t0+len-ctx.currentTime-.3)*1000));renderTransport()}
function trkStop(silent){clearTimeout(trk.timer);trk.playing=false;const t=ctx?ctx.currentTime:0;for(const v of trk.voices){try{v.g.gain.setTargetAtTime(0,t,.02);v.src.stop(t+.12)}catch(e){}}trk.voices.clear();if(!silent)renderTransport()}
function trkStatus(t){const s=$('trkStatus');if(s)s.textContent=t}
// 録音用の AudioWorklet（入力をそのまま 32-bit float で受け取る）
let recModule=null;
async function recNode(){if(!recModule){const code="class R extends AudioWorkletProcessor{process(i){const x=i[0];if(x&&x.length)this.port.postMessage(x.map(c=>c.slice(0)));return true}}registerProcessor('saww-rec',R)";recModule=ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code],{type:'text/javascript'})))}await recModule;return new AudioWorkletNode(ctx,'saww-rec',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]})}
async function trkRecord(kind){if(trk.rec){return trkRecStop()}await smpEnsureCtx();if(!ctx.audioWorklet){trkStatus(L('この環境は録音（AudioWorklet）に対応していません。','This environment does not support recording (AudioWorklet).'));return}
 let stream=null,srcNode;try{if(kind==='mic'){stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});srcNode=ctx.createMediaStreamSource(stream)}else srcNode=master._output}
 catch(e){trkStatus(L('マイクを使えません: ','Microphone unavailable: ')+(e.message||e.name));return}
 const node=await recNode(),sink=G(0),chunks=[];let frames=0;node.port.onmessage=e=>{if(!trk.rec)return;chunks.push(e.data);frames+=e.data[0].length;if(frames>ctx.sampleRate*300)trkRecStop()};
 srcNode.connect(node);node.connect(sink);sink.connect(ctx.destination);const credits=new Set();
 trk.rec={kind,stream,srcNode,node,sink,chunks,get frames(){return frames},credits,started:ctx.currentTime};
 if(kind==='bounce'){for(const id of playingIds())noteTile(id,(k,i)=>credits.add(k+':'+i));for(const id of activeBio.keys())credits.add('recording:'+id);for(const v of fieldVoices)credits.add('recording:'+v.id);for(const v of sampleVoices)credits.add('instrument:'+v.sid);for(const t of tracks)if(audible(t))noteTile(t.src,(k,i)=>credits.add(k+':'+i))}
 if(kind==='mic'&&tracks.some(t=>t.buffer))trkPlay();renderTransport();trkStatus(kind==='mic'?L('マイクで録音中…（もう一度押すと止まる）','Recording from mic… (press again to stop)'):L('いまの出音を録音中…（もう一度押すと止まる）','Recording the output… (press again to stop)'))}
function trkRecStop(){const r=trk.rec;if(!r)return;trk.rec=null;try{r.srcNode.disconnect(r.node)}catch(e){}try{r.node.disconnect()}catch(e){}try{r.sink.disconnect()}catch(e){}if(r.stream)r.stream.getTracks().forEach(t=>t.stop());
 if(r.kind==='mic')trkStop(true);const ch=r.kind==='mic'?1:Math.max(1,r.chunks[0]?.length||1),n=r.frames;if(n<ctx.sampleRate*.2){trkStatus(L('録音が短すぎます。','Recording too short.'));renderTransport();return}
 const b=new AudioBuffer({length:n,numberOfChannels:ch,sampleRate:ctx.sampleRate});for(let c=0;c<ch;c++){const d=b.getChannelData(c);let o=0;for(const k of r.chunks){const x=k[Math.min(c,k.length-1)];d.set(x.subarray(0,Math.min(x.length,n-o)),o);o+=x.length;if(o>=n)break}}
 const label=r.kind==='mic'?L('マイク録音 ','Mic take ')+(1+[...userSounds.values()].filter(u=>u.origin==='mic').length):L('出音の録音 ','Output take ')+(1+[...userSounds.values()].filter(u=>u.origin==='bounce').length);
 const id=addUserSound(label,b,r.kind,{credits:r.credits});addTrack(id);buildTiles();renderTrackSources();renderTransport();trkStatus(L(label+' をトラックと「自分の音」に追加しました（'+b.duration.toFixed(1)+'秒）。',label+' added to tracks and “My sounds” ('+b.duration.toFixed(1)+' s).'))}
async function trkMixdown(fmt){const len=trackLen();if(!len){trkStatus(L('トラックがありません。','No tracks yet.'));return}const sr=ctx?ctx.sampleRate:48000,oc=new OfflineAudioContext(2,Math.ceil(len*sr),sr),used=new Set();
 for(const t of tracks){if(!audible(t))continue;if(!userSounds.has(t.src)&&!rightsAllowed(t.src))continue;const s=oc.createBufferSource(),g=oc.createGain(),p=oc.createStereoPanner();s.buffer=t.buffer;g.gain.value=t.vol*ampOf(t.src);p.pan.value=t.pan;s.connect(g);g.connect(p);p.connect(oc.destination);s.start(t.offset);noteTile(t.src,(k,i)=>used.add(k+'|'+i))}
 const out=await oc.startRendering();let peak=0;for(let c=0;c<2;c++){const d=out.getChannelData(c);for(let i=0;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]))}const norm=peak>.98?.98/peak:1;
 const bytes=fmt==='aiff'?encodeAiff24(out,norm):encodeWav24(out,norm),stamp=new Date().toISOString().replace(/[:.]/g,'-'),name='saww_audio_ecosystem_mix_'+stamp+'.'+(fmt==='aiff'?'aif':'wav');
 downloadBlob(new Blob([bytes],{type:fmt==='aiff'?'audio/aiff':'audio/wav'}),name);
 const entries=attributionEntries([...used].map(k=>{const [kind,id]=k.split('|');return {kind,id,origin:userSounds.has(id)?'import':'embedded'}}));
 saveText(name.replace(/\.(wav|aif)$/,'')+'_credits.txt',[('ミックスダウン / Mixdown: '+name+' ('+(fmt==='aiff'?'AIFF':'WAV')+' 24-bit stereo, '+sr+' Hz, '+len.toFixed(2)+' s'+(norm<1?', ピーク '+(20*Math.log10(norm)).toFixed(1)+' dB で正規化':'')+')'),'',attributionText(entries,{scope:'export',date:new Date()})].join('\r\n'));
 trkStatus(L('ミックスダウンを書き出しました（'+(fmt==='aiff'?'AIFF':'WAV')+' 24-bit・'+len.toFixed(1)+'秒）。クレジットも保存しました。','Mixdown exported ('+(fmt==='aiff'?'AIFF':'WAV')+' 24-bit, '+len.toFixed(1)+' s). Credits saved too.'));return {name,len,sr,peak,norm,bytes:bytes.byteLength}}
function pcm24(out,norm){const n=out.length,ch=out.numberOfChannels,a=new Uint8Array(n*ch*3),d=[...Array(ch).keys()].map(c=>out.getChannelData(c));let o=0;
 for(let i=0;i<n;i++)for(let c=0;c<ch;c++){let x=Math.round(clamp(d[c][i]*norm,-1,1)*8388607);if(x<0)x+=16777216;a[o++]=x&255;a[o++]=(x>>8)&255;a[o++]=(x>>16)&255}return a}
function encodeWav24(out,norm){const ch=out.numberOfChannels,sr=out.sampleRate,data=pcm24(out,norm),b=new ArrayBuffer(44+data.length),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');v.setUint32(4,36+data.length,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,sr,true);v.setUint32(28,sr*ch*3,true);v.setUint16(32,ch*3,true);v.setUint16(34,24,true);w(36,'data');v.setUint32(40,data.length,true);new Uint8Array(b,44).set(data);return b}
function encodeAiff24(out,norm){const ch=out.numberOfChannels,sr=out.sampleRate,n=out.length,le=pcm24(out,norm);for(let i=0;i<le.length;i+=3){const t=le[i];le[i]=le[i+2];le[i+2]=t}
 const b=new ArrayBuffer(12+26+16+le.length),v=new DataView(b),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 w(0,'FORM');v.setUint32(4,4+26+16+le.length);w(8,'AIFF');w(12,'COMM');v.setUint32(16,18);v.setUint16(20,ch);v.setUint32(22,n);v.setUint16(26,24);
 // サンプルレートは 80-bit 拡張精度（指数 15bit・仮数 64bit、先頭ビットは明示）
 const ex=Math.floor(Math.log2(sr)),mant=sr/2**ex;v.setUint16(28,16383+ex);const hi=Math.floor(mant*2**31),lo=Math.round((mant*2**31-hi)*2**32);v.setUint32(30,hi>>>0);v.setUint32(34,lo>>>0);
 w(38,'SSND');v.setUint32(42,8+le.length);v.setUint32(46,0);v.setUint32(50,0);new Uint8Array(b,54).set(le);return b}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function renderTrackSources(){const sel=$('trkAddSrc');if(!sel)return;const cur=sel.value;sel.textContent='';
 const og1=el('optgroup',{label:L('自分の音','My sounds')});for(const u of userSounds.values())og1.append(el('option',{value:u.id,text:u.name}));if(og1.children.length)sel.append(og1);
 const og2=el('optgroup',{label:L('実録音ライブラリ','Recording library')});for(const r of recordings)og2.append(el('option',{value:r.id,text:r.jp}));sel.append(og2);if(cur)sel.value=cur}
function renderTransport(){const p=$('trkPlay'),m=$('trkMic'),b=$('trkBounce');if(!p)return;p.textContent=trk.playing?L('■ 停止','■ Stop'):L('▶ 全トラック再生','▶ Play all');p.setAttribute('aria-pressed',String(trk.playing));
 m.textContent=trk.rec&&trk.rec.kind==='mic'?L('■ 録音を止める','■ Stop recording'):L('● マイクで録音','● Record mic');m.setAttribute('aria-pressed',String(!!(trk.rec&&trk.rec.kind==='mic')));
 b.textContent=trk.rec&&trk.rec.kind==='bounce'?L('■ 録音を止める','■ Stop recording'):L('● いまの出音を録る','● Record the output');b.setAttribute('aria-pressed',String(!!(trk.rec&&trk.rec.kind==='bounce')));$('trkLen').textContent=trackLen().toFixed(1)+' s'}
function renderTracks(){const box=$('trkList');if(!box)return;box.textContent='';if(!tracks.length){box.append(el('p',{class:'micro',text:L('トラックはまだありません。下で音を選んで追加するか、録音してください。','No tracks yet. Add a sound below or record one.')}));renderTransport();return}
 for(const t of tracks){const name=nameOf(t.src);const row=el('div',{class:'trkRow','data-trk':String(t.id)});
  const ctl=(lab,input,out)=>el('label',{class:'trkCtl'},el('span',{text:lab}),input,out||null);
  const vol=el('input',{type:'range',min:'0',max:'150',value:String(Math.round(t.vol*100)),'aria-label':name+'の音量'}),volO=el('output',{text:String(Math.round(t.vol*100))});vol.oninput=()=>{t.vol=vol.value/100;volO.textContent=vol.value;for(const v of trk.voices)if(v.t===t)v.g.gain.setTargetAtTime(t.vol*ampOf(t.src),ctx.currentTime,.03)};
  const pan=el('input',{type:'range',min:'-100',max:'100',value:String(Math.round(t.pan*100)),'aria-label':name+'の定位'});pan.oninput=()=>{t.pan=pan.value/100;for(const v of trk.voices)if(v.t===t&&v.pan.pan)v.pan.pan.setTargetAtTime(t.pan,ctx.currentTime,.03)};
  const off=el('input',{type:'number',min:'0',max:'600',step:'0.1',value:String(t.offset),inputmode:'decimal','aria-label':name+'の開始位置（秒）'});off.onchange=()=>{t.offset=clamp(+off.value||0,0,600);renderTransport()};
  const mute=el('button',{type:'button','aria-pressed':String(t.mute),text:'M','aria-label':name+' ミュート'});mute.onclick=()=>{t.mute=!t.mute;renderTracks()};
  const solo=el('button',{type:'button','aria-pressed':String(t.solo),text:'S','aria-label':name+' ソロ'});solo.onclick=()=>{t.solo=!t.solo;renderTracks()};
  const dest=el('select',{'aria-label':name+'の送り先'},el('option',{value:'sampler',text:L('ミキサー：サンプラーch','Mixer: sampler ch')}),el('option',{value:'master',text:L('マスターへ直接','Direct to master')}));dest.value=t.dest;dest.onchange=()=>{t.dest=dest.value};
  const del=el('button',{type:'button',text:'×','aria-label':name+'を削除'});del.onclick=()=>{tracks.splice(tracks.indexOf(t),1);renderTracks()};
  const wave=el('canvas',{class:'trkWave',width:'300',height:'36','aria-hidden':'true'});
  row.append(el('div',{class:'trkHead'},el('span',{class:'trkName',text:t.id+' · '+name}),el('span',{class:'micro',text:t.buffer?t.buffer.duration.toFixed(1)+' s':L('読み込み中…','Loading…')}),mute,solo,del),wave,
   el('div',{class:'trkCtls'},ctl(L('音量','Vol'),vol,volO),ctl(L('定位','Pan'),pan),ctl(L('開始(秒)','Start (s)'),off),ctl(L('送り先','Route'),dest)));box.append(row);if(t.buffer)drawWave(wave,t.buffer)}
 renderTransport()}
function drawWave(cv,b){const c=cv.getContext('2d'),W=cv.width,H=cv.height,d=b.getChannelData(0),step=Math.max(1,Math.floor(d.length/W));c.clearRect(0,0,W,H);c.fillStyle='#8fc7a6';for(let x=0;x<W;x++){let mx=0;for(let i=x*step;i<(x+1)*step&&i<d.length;i+=4)mx=Math.max(mx,Math.abs(d[i]));const h=Math.max(1,mx*H);c.fillRect(x,(H-h)/2,1,h)}}

// ───────── リール作成（テンプレート・区画パネル・写真・ユーザー画像・共有） ─────────
// テンプレート：forest・ocean・night・wildlife は区画パネル（写真・スペクトラム・ステレオ・レベル・声の輪・スペクトログラム・データ・波形）、
// minimal は文字と波形だけ、waveform は周波数の稜線、spectrum は v0.31 の分析、abstract は v0.37 の「動き」。
const PAL={forest:{bg:'#06110c',panel:'rgba(10,26,19,.82)',line:'#2a4a37',dim:'#6f9a82',text:'#e8f3ec',acc:'#a6e6b8',acc2:'#e8c66a',hue:150},
 ocean:{bg:'#040b13',panel:'rgba(8,19,30,.82)',line:'#1f3d56',dim:'#6b97b5',text:'#e6f1f9',acc:'#86cdf2',acc2:'#f0d080',hue:200},
 night:{bg:'#06050c',panel:'rgba(13,11,24,.84)',line:'#2f2c4e',dim:'#8a84b8',text:'#eeeaff',acc:'#bcaaff',acc2:'#ffd27a',hue:255},
 wildlife:{bg:'#0b0b08',panel:'rgba(20,20,14,.8)',line:'#45422c',dim:'#a39f7e',text:'#f6f2e6',acc:'#f2c464',acc2:'#a6e6b8',hue:42},
 minimal:{bg:'#000000',panel:'rgba(6,6,6,.85)',line:'#2a2a2a',dim:'#8d8d8d',text:'#f4f4f4',acc:'#ffffff',acc2:'#bdbdbd',hue:0}};
const TEMPLATES={forest:['panels','forest'],ocean:['panels','ocean'],night:['panels','night'],wildlife:['panels','wildlife'],minimal:['minimal','minimal'],waveform:['wave','forest'],spectrum:['analysis',null],abstract:['motion',null]};
let reelTpl='forest',reelPal=PAL.forest,reelImgMode='auto',reelUserImg=null;const imgCache=new Map();
function canvasImage(url){let e=imgCache.get(url);if(e)return e;e={img:new Image(),ok:false,fail:false};e.img.crossOrigin='anonymous';e.img.referrerPolicy='no-referrer';e.img.onload=()=>{e.ok=true};e.img.onerror=()=>{e.fail=true};e.img.src=url;imgCache.set(url,e);return e}
function setTemplate(name){if(!TEMPLATES[name])return false;reelTpl=name;const [layout,pal]=TEMPLATES[name];if(pal)reelPal=PAL[pal];const sel=$('reelStyle');if(sel&&sel.value!==name)sel.value=name;reelSetStyle(layout);return true}
// いま映すもの：最後にタップした音 → 生き物の声 → 環境の音
function reelSubject(){const ids=playingIds();let id=focusId&&ids.includes(focusId)?focusId:ids.slice(-1)[0];
 if(!id){const now=reelNowPlaying();const b=now.find(n=>n.role==='bio')||now[0];id=b?b.id:null}return id}
function reelList(){const out=[],seen=new Set();for(const id of playingIds().reverse()){seen.add(id);out.push(id)}for(const n of reelNowPlaying())if(!seen.has(n.id)){seen.add(n.id);out.push(n.id)}return out}
const A={freq:null,wave:null,L:null,R:null,split:null,aL:null,aR:null,ring:new Float32Array(72),spec:null,ridge:[],onsets:0,flux:0,prev:null,lastOn:-9,t0:performance.now(),last:performance.now(),hist:[],peakHz:0,cent:0,rmsDb:-120};
function analyse(){if(!analyser||!ctx)return false;const N=analyser.frequencyBinCount;if(!A.freq||A.freq.length!==N){A.freq=new Uint8Array(N);A.prev=new Uint8Array(N)}if(!A.wave||A.wave.length!==analyser.fftSize)A.wave=new Float32Array(analyser.fftSize);
 analyser.getByteFrequencyData(A.freq);analyser.getFloatTimeDomainData(A.wave);
 if(!A.split&&master&&master._output){A.split=ctx.createChannelSplitter(2);A.aL=ctx.createAnalyser();A.aR=ctx.createAnalyser();A.aL.fftSize=A.aR.fftSize=1024;master._output.connect(A.split);A.split.connect(A.aL,0);A.split.connect(A.aR,1);A.L=new Float32Array(1024);A.R=new Float32Array(1024)}
 if(A.aL){A.aL.getFloatTimeDomainData(A.L);A.aR.getFloatTimeDomainData(A.R)}
 const ny=ctx.sampleRate/2;let mx=0,mi=0,fs=0,ws=0,fl=0;for(let i=2;i<N;i++){const v=A.freq[i];if(v>mx){mx=v;mi=i}fs+=i*v;ws+=v;const d=v-A.prev[i];if(d>0)fl+=d}A.prev.set(A.freq);
 A.peakHz=mi/N*ny;A.cent=ws?fs/ws/N*ny:0;fl/=N*255;const t=(performance.now()-A.t0)/1000;if(fl>A.flux*1.7+.004&&t-A.lastOn>.22&&A.flux>0){A.onsets++;A.lastOn=t}A.flux+=(fl-A.flux)*.08;
 let q=0;for(let i=0;i<A.wave.length;i++)q+=A.wave[i]*A.wave[i];A.rmsDb=20*Math.log10(Math.sqrt(q/A.wave.length)+1e-9);return true}
function band(f0,f1){if(!A.freq)return 0;const N=A.freq.length,ny=ctx.sampleRate/2,i0=Math.max(1,Math.round(f0/ny*N)),i1=Math.max(i0,Math.min(N-1,Math.round(f1/ny*N)));let s=0;for(let i=i0;i<=i1;i++)s+=A.freq[i];return s/(i1-i0+1)/255}
const MONO='ui-monospace,"SF Mono",Menlo,monospace',SANS='"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
function txt(c,s,x,y,font,color,align='left',maxW=9999){c.font=font;c.fillStyle=color;c.textAlign=align;c.fillText(reelFit(c,String(s),maxW),x,y)}
function frame(c,x,y,w,h,num,label,val,clear){const P=reelPal;if(!clear){c.fillStyle=P.panel;c.fillRect(x,y,w,h)}c.strokeStyle=P.line;c.lineWidth=1.5;c.strokeRect(x+.5,y+.5,w-1,h-1);
 c.strokeStyle=P.acc;c.lineWidth=2;const k=14;for(const [cx,cy,dx,dy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){c.beginPath();c.moveTo(cx+dx*k,cy);c.lineTo(cx,cy);c.lineTo(cx,cy+dy*k);c.stroke()}
 txt(c,num+'  '+label,x+16,y+30,'600 18px '+MONO,P.dim);const lw=c.measureText(num+'  '+label).width,rx=Math.min(x+w-16,REEL_SAFE.x1);if(val)txt(c,val,rx,y+30,'18px '+MONO,P.acc,'right',Math.max(40,rx-(x+16+lw+18)))}
function cover(c,img,x,y,w,h,zoom){const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;if(!iw||!ih)return;const s=Math.max(w/iw,h/ih)*zoom,dw=iw*s,dh=ih*s;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);c.restore()}
function bgImage(){if(reelImgMode==='mine'&&reelUserImg)return {img:canvasImage(reelUserImg),credit:L('画像：利用者','Image: user'),user:true};return null}
function reelBgDraw(c,alpha){const b=bgImage();if(!b||!b.img.ok)return;c.save();c.globalAlpha=alpha;cover(c,b.img.img,0,0,REEL_W,REEL_H,1.02);c.restore()}
function subjectPhoto(id){if(reelImgMode==='none')return null;if(reelImgMode==='mine'){const b=bgImage();return b?{e:b.img,credit:b.credit,user:true}:null}
 const p=id&&photoFor(id);if(!p)return null;const e=canvasImage(p.thumb);if(e.fail)return null;return {e,p,credit:p.user?L('画像：利用者','Image: user'):'PHOTO '+p.author+' · '+p.license+' · Wikimedia Commons'}}
function notePhoto(ph){const st=reelState;if(!st||!st.active||!ph||!ph.p||ph.p.user)return;st.photos=st.photos||new Map();if(!st.photos.has(ph.p.latin))st.photos.set(ph.p.latin,ph.p)}
function header(c,t){const P=reelPal,X=REEL_SAFE.x0,Y=REEL_SAFE.y0;txt(c,'saww audio ecosystem',X,Y+34,'600 34px '+MONO,P.text);txt(c,'nature as an instrument.',X,Y+70,'24px '+MONO,P.dim);
 const st=reelState,el2=st&&st.active?(performance.now()-st.startedAt)/1000:t;const tc='T+'+String(Math.floor(el2/60)).padStart(2,'0')+':'+(el2%60).toFixed(1).padStart(4,'0');
 txt(c,(st&&st.active?'● REC  ':'')+tc,REEL_SAFE.x1,Y+34,'600 28px '+MONO,st&&st.active?'#ff6b5e':P.acc,'right');txt(c,'TPL/'+reelTpl.toUpperCase()+' · '+new Date().toISOString().slice(0,10),REEL_SAFE.x1,Y+70,'20px '+MONO,P.dim,'right')}
function drawPanels(c){const P=reelPal,now=performance.now(),t=(now-A.t0)/1000;const ok=analyse();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
 c.fillStyle=P.bg;c.fillRect(0,0,REEL_W,REEL_H);reelBgDraw(c,.22);
 // 背景の格子
 c.strokeStyle=P.line;c.globalAlpha=.35;c.lineWidth=1;for(let x=40;x<REEL_W;x+=80){c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,REEL_H);c.stroke()}for(let y=0;y<REEL_H;y+=80){c.beginPath();c.moveTo(0,y+.5);c.lineTo(REEL_W,y+.5);c.stroke()}c.globalAlpha=1;
 header(c,t);const id=reelSubject(),r=id&&recordings.find(x=>x.id===id),u=id&&userSounds.get(id),m=(id&&wildMeta[id])||{};
 // 01 写真
 {const x=40,y=336,w=600,h=660;const ph=subjectPhoto(id);c.fillStyle=ph&&ph.e.ok?'#000':P.panel;c.fillRect(x,y,w,h);
  if(ph&&ph.e.ok){cover(c,ph.e.img,x,y,w,h,1.02+.05*((t/14)%1));notePhoto(ph)}else{// 統一プレースホルダー：音で揺れる等高線
   const cx=x+w/2,cy=y+h/2-40;c.lineWidth=1.4;for(let i=0;i<9;i++){c.beginPath();for(let k=0;k<=64;k++){const a=k/64*6.2832,v=A.freq?A.freq[2+((k*7+i*13)%60)]/255:0,rr=40+i*26+Math.sin(a*3+i+t*.4)*6+v*22;k?c.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr):c.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}c.closePath();c.strokeStyle='hsla('+P.hue+',45%,'+(72-i*5)+'%,'+(.6-i*.05).toFixed(2)+')';c.stroke()}
   txt(c,id?(u?'MY SOUND':'FIELD RECORDING · NO PHOTO'):'TAP A PHOTO TO PLAY',cx,y+h-170,'600 20px '+MONO,P.dim,'center')}
  const g=c.createLinearGradient(0,y+h-260,0,y+h);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.78)');c.fillStyle=g;c.fillRect(x,y+h-260,w,260);
  frame(c,x,y,w,h,'01','SPECIMEN',r?rightsTierOf(r.license)+'-TIER':u?'U-TIER':'',true);
  if(id){const latin=r?binomial(r.latin)||'':'';txt(c,nameOf(id),x+24,y+h-118,'700 54px '+SANS,'#ffffff','left',w-48);let yy=y+h-78;
   if(m.en||latin){c.font='500 26px '+SANS;const en=m.en||'';const ew=en?c.measureText(en+'  ').width:0;if(en)txt(c,en+'  ',x+24,yy,'500 26px '+SANS,'#e2ece6','left',w-48);if(latin)txt(c,latin,x+24+ew,yy,'italic 26px Georgia,"Times New Roman",serif','#d0ddd6','left',w-48-ew);yy+=34}
   txt(c,r?'REC  '+(r.location||'—'):(u?(u.origin==='mic'?'MIC RECORDING':'USER AUDIO'):''),x+24,yy,'20px '+SANS,'#c8d6cf','left',w-48)}
  if(ph&&ph.e.ok)txt(c,ph.credit,x+w-14,y+h-12,'14px '+MONO,'rgba(235,240,236,.8)','right',w-28)}
 // 02 スペクトラム
 {const x=656,y=336,w=384,h=208;frame(c,x,y,w,h,'02','SPECTRUM',A.peakHz?('PEAK '+(A.peakHz>=1000?(A.peakHz/1000).toFixed(2)+'k':Math.round(A.peakHz))+'Hz'):'');
  if(ok){const N=40,x0=x+16,bw=(w-32)/N,base=y+h-18,hh=h-64,lo=Math.log(60),hi=Math.log(16000);for(let i=0;i<N;i++){const v=band(Math.exp(lo+i/N*(hi-lo)),Math.exp(lo+(i+1)/N*(hi-lo)));const bh=Math.max(2,v*hh);c.fillStyle=i/N<.25?P.acc2:P.acc;c.globalAlpha=.35+.65*v;c.fillRect(x0+i*bw+1,base-bh,bw-2,bh)}c.globalAlpha=1;
   txt(c,'60',x0,y+h-2,'14px '+MONO,P.dim);txt(c,'1k',x0+(w-32)*(Math.log(1000)-lo)/(hi-lo),y+h-2,'14px '+MONO,P.dim,'center');txt(c,'16k',x+w-16,y+h-2,'14px '+MONO,P.dim,'right')}}
 // 03 ステレオ（位相）
 {const x=656,y=556,w=384,h=208;let corr=0;if(A.L){let lr=0,ll=0,rr=0;for(let i=0;i<A.L.length;i++){lr+=A.L[i]*A.R[i];ll+=A.L[i]*A.L[i];rr+=A.R[i]*A.R[i]}corr=ll&&rr?lr/Math.sqrt(ll*rr):0}
  frame(c,x,y,w,h,'03','STEREO',(corr>=0?'+':'')+corr.toFixed(2)+' CORR');const cx=x+w/2,cy=y+h/2+14,S=(h-60)/2;c.strokeStyle=P.line;c.beginPath();c.moveTo(cx-S,cy);c.lineTo(cx+S,cy);c.moveTo(cx,cy-S);c.lineTo(cx,cy+S);c.stroke();
  if(A.L){let pk=1e-3;for(let i=0;i<A.L.length;i+=2)pk=Math.max(pk,Math.abs(A.L[i]),Math.abs(A.R[i]));const k=S/Math.max(.05,pk)*.9;c.fillStyle=P.acc;c.globalAlpha=.55;for(let i=0;i<A.L.length;i+=2){const sx=(A.L[i]-A.R[i])*.7071*k,sy=(A.L[i]+A.R[i])*.7071*k;c.fillRect(cx+sx,cy-sy,2,2)}c.globalAlpha=1}}
 // 04 レベル（ミキサーのチャンネル）
 {const x=656,y=776,w=384,h=220;frame(c,x,y,w,h,'04','LEVELS',A.rmsDb>-119?A.rmsDb.toFixed(1)+' dBFS':'');const chs=[['BIO','bio'],['FLD','field'],['MUS','music'],['SMP','sampler'],['MST',null]];const bw=(w-40)/chs.length;
  chs.forEach(([lab,ch],i)=>{const db=ch?mixPeakDb(mixMeters[ch]):mixPeakDb(analyser),v=clamp((db+60)/60,0,1),bx=x+20+i*bw,top=y+48,bh=h-90;c.fillStyle=P.line;c.fillRect(bx+8,top,bw-16,bh);c.fillStyle=db>-6?'#ff8a6e':ch?P.acc:P.acc2;c.fillRect(bx+8,top+bh*(1-v),bw-16,bh*v);
   txt(c,lab,bx+bw/2,y+h-14,'15px '+MONO,P.dim,'center')})}
 // 05 声の輪（v0.37 の波形の輪を小さく）
 {const x=40,y=1012,w=420,h=300;frame(c,x,y,w,h,'05','VOICE RING','ONSETS '+A.onsets);const cx=x+w/2,cy=y+h/2+14,R0=78;
  if(A.freq){const K=A.ring.length,N=A.freq.length,ny=ctx.sampleRate/2,lo=Math.log(80),hi=Math.log(9000);for(let k=0;k<K;k++){const f=Math.exp(lo+k/(K-1)*(hi-lo)),v=A.freq[Math.min(N-1,Math.round(f/ny*N))]/255;A.ring[k]+=(v-A.ring[k])*(v>A.ring[k]?.5:.12)}
   c.beginPath();for(let i=0;i<=2*K;i++){const j=i%(2*K),k=j<K?j:2*K-1-j,a=t*.07+j/(2*K)*6.2832-Math.PI/2,rr=R0+A.ring[k]*62;i?c.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr):c.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}c.closePath();c.strokeStyle=P.acc;c.lineWidth=2.4;c.stroke();c.globalAlpha=.18;c.fillStyle=P.acc;c.fill();c.globalAlpha=1;
   c.beginPath();const WN=120,st=Math.max(1,Math.floor(A.wave.length/WN));for(let i=0;i<=WN;i++){const wv=clamp((A.wave[(i%WN)*st]||0)*6,-1,1),a=-t*.11+i/WN*6.2832,rr=R0*.62+wv*R0*.25;i?c.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr):c.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}c.strokeStyle=P.text;c.globalAlpha=.5;c.lineWidth=1.4;c.stroke();c.globalAlpha=1}}
 // 06 スペクトログラム
 {const x=476,y=1012,w=564,h=300;frame(c,x,y,w,h,'06','SPECTROGRAM','');const SW=w-4,SH=h-50;if(!A.spec||A.spec.width!==SW){A.spec=document.createElement('canvas');A.spec.width=SW;A.spec.height=SH;const s=A.spec.getContext('2d');s.fillStyle='#000';s.fillRect(0,0,SW,SH)}
  if(A.freq){const s=A.spec.getContext('2d'),step=3,N=A.freq.length,ny=ctx.sampleRate/2,lo=Math.log(50),hi=Math.log(Math.min(16000,ny));s.drawImage(A.spec,-step,0);for(let yy=0;yy<SH;yy+=2){const f=Math.exp(hi-(yy/SH)*(hi-lo)),v=A.freq[Math.min(N-1,Math.round(f/ny*N))]/255;s.fillStyle='hsl('+(P.hue+40-v*110)+','+(25+v*60)+'%,'+(3+v*62)+'%)';s.fillRect(SW-step,yy,step,2)}}
  c.drawImage(A.spec,x+2,y+46);txt(c,'16k',x+12,y+66,'14px '+MONO,P.dim);txt(c,'50',x+12,y+h-8,'14px '+MONO,P.dim)}
 // 07 データ
 {const x=40,y=1328,w=560,h=252;frame(c,x,y,w,h,'07','DATA','');const rows=[];const list=reelList();
  if(r){rows.push(['TAXON',binomial(r.latin)||r.latin]);rows.push(['PLACE',[m.recordedCountry,m.recordedArea].filter(Boolean).join(' · ')||r.location||'—']);rows.push(['BY',r.author+' · '+r.license]);const e=audioManifest.recordings[id]?.pcm;if(e)rows.push(['FORMAT',(e.format||'').toUpperCase()+' '+(e.bitDepth||'')+'bit · '+e.sampleRate/1000+'kHz · '+e.channels+'ch'])}
  else if(u)rows.push(['SOURCE',u.origin==='mic'?'MIC · USER':'USER AUDIO'],['LENGTH',u.buffer.duration.toFixed(1)+' s']);
  rows.push(['VOICES',list.length?list.slice(0,3).map(nameOf).join(' · ')+(list.length>3?' +'+(list.length-3):''):'—']);
  rows.push(['TEMPO',Math.round(+fx.bpm||90)+' BPM · '+($('chord')?.textContent||'')+' · CENT '+(A.cent/1000).toFixed(2)+'k']);
  rows.slice(0,6).forEach(([k,v],i)=>{txt(c,k,x+18,y+66+i*30,'600 17px '+MONO,P.dim);txt(c,v,x+130,y+66+i*30,'19px '+SANS,P.text,'left',w-150)});
  txt(c,({all:'ALL SOURCES',nosa:'NO CC BY-SA',cc0:'CC0 / PD ONLY'}[RIGHTS.mode])+' · FULL CREDITS IN CAPTION',x+18,y+h-14,'15px '+MONO,P.dim,'left',w-36)}
 // 08 波形
 {const x=616,y=1328,w=424,h=252;frame(c,x,y,w,h,'08','WAVEFORM','');if(A.wave){const pts=[];const W=w-32,cy=y+h/2+16,g=Math.min(8,.3/Math.max(.004,Math.sqrt(A.wave.reduce((s,v)=>s+v*v,0)/A.wave.length)));for(let i=0;i<W;i+=2)pts.push(clamp((A.wave[Math.floor(i/W*A.wave.length)]||0)*g,-1,1));
   A.hist.unshift(pts);if(A.hist.length>6)A.hist.pop();A.hist.forEach((p,j)=>{c.beginPath();p.forEach((v,i)=>{const px=x+16+i*2,py=cy-v*(h-80)/2-j*6;i?c.lineTo(px,py):c.moveTo(px,py)});c.strokeStyle=j?P.dim:P.acc;c.globalAlpha=j?.35/j:1;c.lineWidth=j?1:2;c.stroke()});c.globalAlpha=1}}
}
function drawRidge(c){const P=reelPal,t=(performance.now()-A.t0)/1000;const ok=analyse();c.setTransform(1,0,0,1,0,0);c.fillStyle=P.bg;c.fillRect(0,0,REEL_W,REEL_H);reelBgDraw(c,.25);header(c,t);
 if(ok&&A.freq){const N=96,lo=Math.log(60),hi=Math.log(14000),row=[];let mx=0;for(let i=0;i<N;i++){const v=band(Math.exp(lo+i/N*(hi-lo)),Math.exp(lo+(i+1)/N*(hi-lo)));row.push(v);mx=Math.max(mx,v)}A.rpk=Math.max(.12,(A.rpk||.3)*.995,mx);A.ridge.unshift(row.map(v=>v/A.rpk));if(A.ridge.length>40)A.ridge.pop()}
 // 周波数の稜線：手前（下）が新しい。奥の線は前の線で隠す
 const x0=60,W=REEL_W-120,base=1120,gap=16;for(let j=A.ridge.length-1;j>=0;j--){const row=A.ridge[j],by=base-j*gap,pts=row.map((v,i)=>{const u=i/(row.length-1),env=Math.pow(Math.sin(Math.PI*u),.8);return [x0+u*W,by-Math.pow(v,1.4)*260*env]});
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.lineTo(x0+W,by+gap*2);c.lineTo(x0,by+gap*2);c.closePath();c.fillStyle=P.bg;c.globalAlpha=1;c.fill();
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=j?P.text:P.acc;c.globalAlpha=j?Math.max(.18,1-j/40):1;c.lineWidth=j?1.5:2.8;c.stroke();c.globalAlpha=1}
 txt(c,'60 Hz',x0,base+40,'18px '+MONO,P.dim);txt(c,'14 kHz',x0+W,base+40,'18px '+MONO,P.dim,'right');txt(c,'FREQUENCY RIDGES · NEWEST AT FRONT',x0+W/2,base+40,'18px '+MONO,P.dim,'center');
 nameCard(c,1300)}
function drawMinimal(c){const P=reelPal,t=(performance.now()-A.t0)/1000;const ok=analyse();c.setTransform(1,0,0,1,0,0);c.fillStyle=P.bg;c.fillRect(0,0,REEL_W,REEL_H);reelBgDraw(c,.3);header(c,t);
 if(ok){const cy=820,W=REEL_W-120;c.beginPath();for(let i=0;i<W;i++){const v=clamp((A.wave[Math.floor(i/W*A.wave.length)]||0)*5,-1,1);i?c.lineTo(60+i,cy-v*220):c.moveTo(60+i,cy-v*220)}c.strokeStyle=P.text;c.lineWidth=2;c.stroke();
  c.strokeStyle=P.line;c.beginPath();c.moveTo(60,cy+300);c.lineTo(REEL_W-60,cy+300);c.stroke();const lo=Math.log(60),hi=Math.log(16000);for(let i=0;i<64;i++){const v=band(Math.exp(lo+i/64*(hi-lo)),Math.exp(lo+(i+1)/64*(hi-lo)));c.fillStyle=P.text;c.fillRect(60+i*(W/64),cy+300-v*90,W/64-4,v*90)}}
 nameCard(c,1300)}
function nameCard(c,y){const P=reelPal,id=reelSubject(),X=REEL_SAFE.x0,W=REEL_SAFE.x1-REEL_SAFE.x0;if(!id){txt(c,L('写真をタップして音を重ねる','Tap photos to layer sounds'),X,y,'600 44px '+SANS,P.text,'left',W);return}
 const r=recordings.find(x=>x.id===id),m=wildMeta[id]||{},ph=subjectPhoto(id);let NW=W;if(ph&&ph.e.ok){const s=150,cx=REEL_SAFE.x1-s/2,cy=y+18;c.save();c.beginPath();c.arc(cx,cy,s/2,0,6.2832);c.clip();cover(c,ph.e.img,cx-s/2,cy-s/2,s,s,1);c.restore();c.strokeStyle=P.acc;c.lineWidth=2;c.beginPath();c.arc(cx,cy,s/2,0,6.2832);c.stroke();notePhoto(ph);NW=W-s-24}
 txt(c,nameOf(id),X,y+40,'700 64px '+SANS,P.text,'left',NW);const latin=r&&binomial(r.latin);if(m.en||latin)txt(c,(m.en||'')+(latin?'  '+latin:''),X,y+88,'italic 30px Georgia,serif',P.dim,'left',NW);
 if(r)txt(c,'REC  '+(r.location||'—'),X,y+130,'24px '+SANS,P.dim,'left',W);if(r)txt(c,'"'+(r.title||'')+'" — '+(r.author||'')+' · '+r.license,X,y+166,'20px '+MONO,P.dim,'left',W);
 if(ph&&ph.e.ok)txt(c,ph.credit,X,y+196,'16px '+MONO,P.dim,'left',W);const list=reelList();if(list.length>1&&y+232<REEL_SAFE.y1-40)txt(c,'+ '+list.filter(x=>x!==id).slice(0,3).map(nameOf).join(' · '),X,y+232,'22px '+SANS,P.acc,'left',W);
 txt(c,({all:'ALL SOURCES',nosa:'NO CC BY-SA',cc0:'CC0 / PD ONLY'}[RIGHTS.mode])+' · FULL CREDITS IN CAPTION',X,REEL_SAFE.y1-14,'18px '+MONO,P.dim,'left',W)}
window.reelDrawStudio=(c,layout)=>{if(layout==='wave')drawRidge(c);else if(layout==='minimal')drawMinimal(c);else drawPanels(c)};
window.reelBgDraw=reelBgDraw;
window.reelPhotoCredits=st=>{const ps=st&&st.photos?[...st.photos.values()]:[];if(!ps.length)return [];return ['','── 写真のクレジット / Photo credits ──',...ps.map(p=>p.latin+': "'+p.file+'" — '+p.author+' · '+p.license+(p.licenseURL?' ('+p.licenseURL+')':'')+' · Wikimedia Commons: '+p.page)]};
let lastExport=null;
window.reelAfterExport=(st,blob)=>{const box=$('reelDone');if(!box)return;const type=blob.type,ext=/mp4/.test(type)?'mp4':'webm';const file=new File([blob],st.result.name,{type});lastExport={st,blob,file,text:st.result.text};
 const v=$('reelVideo');if(v.src)URL.revokeObjectURL(v.src);v.src=URL.createObjectURL(blob);box.hidden=false;
 const canShare=!!(navigator.canShare&&navigator.canShare({files:[file]}));$('reelShare').disabled=false;$('reelShare').dataset.mode=canShare?'files':'text';
 $('reelDoneInfo').textContent=(ext.toUpperCase())+' · '+REEL_W+'×'+REEL_H+' · '+st.duration.toFixed(1)+' s · '+(blob.size/1048576).toFixed(1)+' MB'+(ext==='mp4'?'':L(' · このブラウザは MP4 で録画できないため WebM です',' · This browser cannot record MP4, so this is WebM'))};
// キャプション：写真のタイルだけで作ったリール（自律演奏なし）は文面を合わせる。どちらにもアプリのリンクを入れる（新しい人がたどれるように）。
{const base=reelCaption;reelCaption=function(entries){const solo=!playing;return base(entries).map(l=>solo&&l==='自然の実録音を使って、その場で自律演奏したアンビエントです。'?'自然の実録音を写真から選んで、その場で重ねた音です。':solo&&l==='Generative ambient, played live with real field recordings of nature.'?'Real field recordings of nature, layered live by tapping photos.':l).concat(['','Made with saww audio ecosystem — nature as an instrument. '+APP_URL])}}
function shareText(){const r=lastExport;const cap=r?r.st.result.caption:'';return cap+'\n\n'+L('クレジットの全文は説明欄に貼ってください。','Paste the full credits into your caption.')+'\n'+APP_URL}
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const ta=el('textarea',{style:'position:fixed;left:-9999px'});ta.value=t;document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(e2){}ta.remove();return ok}}
function bindReel(){const sel=$('reelStyle');if(sel){sel.addEventListener('change',e=>setTemplate(e.target.value))}
 $('reelImage').addEventListener('change',e=>{reelImgMode=e.target.value;if(reelImgMode==='mine'&&!reelUserImg)$('reelImageFile').click();reelDraw()});
 $('reelImageFile').addEventListener('change',e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;if(reelUserImg)URL.revokeObjectURL(reelUserImg);reelUserImg=URL.createObjectURL(f);reelImgMode='mine';$('reelImage').value='mine';reelDraw()});
 $('reelSave').addEventListener('click',()=>{if(lastExport)downloadBlob(lastExport.blob,lastExport.file.name)});
 $('reelCopy').addEventListener('click',async()=>{if(!lastExport)return;const ok=await copyText(lastExport.text);$('reelDoneInfo').textContent=ok?L('クレジットをコピーしました。投稿の説明欄に貼ってください。','Credits copied. Paste them into your post’s caption.'):L('コピーできませんでした。下の「クレジットを保存」を使ってください。','Copy failed. Use “Save credits” below.')});
 $('reelShare').addEventListener('click',async()=>{if(!lastExport)return;try{if($('reelShare').dataset.mode==='files')await navigator.share({files:[lastExport.file],title:'saww audio ecosystem',text:shareText()});else if(navigator.share)await navigator.share({title:'saww audio ecosystem',text:shareText(),url:APP_URL});else{await copyText(shareText());$('reelDoneInfo').textContent=L('共有に対応していないため、キャプションとリンクをコピーしました。動画は「export video」で保存してください。','Sharing is not supported here, so the caption and link were copied. Save the video with “export video”.')}}catch(e){if(e.name!=='AbortError')$('reelDoneInfo').textContent=L('共有できませんでした: ','Could not share: ')+e.message}});
 $('reelTry').addEventListener('click',async()=>{const ok=await copyText(APP_URL);$('reelDoneInfo').textContent=ok?L('アプリのリンクをコピーしました：','App link copied: ')+APP_URL:APP_URL});
 $('tileToReel').addEventListener('click',()=>{const sec=$('reelSection');sec.scrollIntoView({behavior:'smooth',block:'start'});if(!reelPreviewOn)reelSetPreview(true)})}

// ───────── プラン（FREE / PRO）。課金は無効。表示と権限の定義だけ ─────────
// 料金は提案価格（未承認）。実際の決済・アクセス制御はサーバー側（Stripe と署名付きの権利情報）で行う設計で、この画面だけで機能を制限しない（docs/PRODUCT_TIERS.md）。
const ENTITLEMENT={plan:'beta',enforce:false};
window.sawwEntitlement={get plan(){return ENTITLEMENT.plan},enforce:false,allows:f=>true,tierOf:f=>(TIERS.features.find(x=>x.id===f)||{}).tier||'free'};
function buildPlans(){const box=$('plansBody');if(!box)return;box.textContent='';
 const cards=el('div',{class:'planCards'});for(const p of TIERS.plans){cards.append(el('div',{class:'planCard plan-'+p.id},el('div',{class:'planName',text:p.name}),el('div',{class:'planTag',text:p.tagline}),el('div',{class:'planPrice',text:p.price},el('span',{class:'micro',text:' '+p.period})),p.alt?el('div',{class:'micro',text:p.alt}):null,p.note_ja?el('div',{class:'micro planNote',text:L(p.note_ja,p.note_en)}):null))}
 box.append(cards);const tb=el('table',{class:'planTable'});tb.append(el('thead',{},el('tr',{},el('th',{text:L('機能','Feature')}),el('th',{text:'FREE'}),el('th',{text:'PRO'}))));const body=el('tbody');
 for(const f of TIERS.features)body.append(el('tr',{},el('td',{text:L(f.ja,f.en)}),el('td',{class:'mk',text:f.tier==='free'?'✓':'—'}),el('td',{class:'mk',text:'✓'})));tb.append(body);box.append(tb)
 for(const n of document.querySelectorAll('[data-tier="pro"]')){const host=n.querySelector('summary > span, .title')||n;if(!host.querySelector('.proChip'))host.append(el('span',{class:'proChip',text:'PRO',title:'PRO'}))}}

// ───────── 本体との接続 ─────────
window.studioActive=()=>playingIds().length>0;
window.studioSeed=fn=>{for(const id of playingIds())noteTile(id,fn);for(const v of trk.voices)noteTile(v.t.src,fn)};
window.studioNow=()=>playingIds().filter(id=>!userSounds.has(id));
window.__studioDebug={tiles:()=>tileIds().length,shown:()=>document.querySelectorAll('#tileGrid .tile').length,photos:()=>[...document.querySelectorAll('#tileGrid .tile img')].length,playing:playingIds,start:tileStart,stop:tileStop,toggle:tileToggle,stopAll:tileStopAll,photoFor,binomial,
 state:id=>{const s=tileState.get(id);return s?{vol:s.vol,pan:s.pan,loop:s.loop,on:!!s.voice}:null},setVol:setTileVol,setLoop:(id,v)=>{tst(id).loop=!!v},open:openSheet,close:closeSheet,filter:f=>{tileFilter=f;renderFilters();buildTiles()},
 addUser:(name,buffer,origin)=>{const id=addUserSound(name,buffer,origin||'import');buildTiles();renderTrackSources();return id},importFiles,parseAiff,users:()=>[...userSounds.keys()],
 tracks:()=>tracks.map(t=>({id:t.id,src:t.src,offset:t.offset,vol:t.vol,mute:t.mute,solo:t.solo,dest:t.dest,len:t.buffer?t.buffer.duration:null})),addTrack,trkPlay,trkStop,trkRecord,trkRecStop,trkMixdown,trk:()=>({playing:trk.playing,rec:trk.rec?trk.rec.kind:null,voices:trk.voices.size,len:trackLen()}),encodeWav24,encodeAiff24,
 setTemplate,template:()=>reelTpl,imgMode:v=>{if(v)reelImgMode=v;return reelImgMode},subject:reelSubject,photosUsed:()=>reelState&&reelState.photos?[...reelState.photos.keys()]:[],imgCache:()=>[...imgCache].map(([u,e])=>({u,ok:e.ok,fail:e.fail})),analyse:()=>{analyse();return {peakHz:A.peakHz,rmsDb:A.rmsDb,onsets:A.onsets}},
 entitlement:()=>window.sawwEntitlement,tiers:()=>TIERS};
function init(){renderFilters();buildTiles();bindSheet();buildMasterEq();renderTracks();renderTrackSources();buildPlans();bindReel();
 $('tileStopAll').addEventListener('click',tileStopAll);$('tileAddUser').addEventListener('click',()=>$('tileUserFile').click());$('tileUserFile').addEventListener('change',e=>{const fs=[...(e.target.files||[])];e.target.value='';importFiles(fs)});
 $('trkPlay').addEventListener('click',()=>trk.playing?trkStop():trkPlay());$('trkLoop').addEventListener('change',e=>{trk.loop=e.target.checked});$('trkMic').addEventListener('click',()=>trkRecord('mic'));$('trkBounce').addEventListener('click',()=>trkRecord('bounce'));
 $('trkAdd').addEventListener('click',()=>{const v=$('trkAddSrc').value;if(v)addTrack(v)});$('trkWav').addEventListener('click',()=>trkMixdown('wav').catch(e=>trkStatus(e.message)));$('trkAiff').addEventListener('click',()=>trkMixdown('aiff').catch(e=>trkStatus(e.message)));
 setTemplate('forest');
 // 言語を切り替えたら、自分で組み立てた文言（L()）を作り直す
 $('langToggle')?.addEventListener('click',()=>setTimeout(()=>{renderFilters();buildTiles();renderTracks();buildPlans();if(sheetId)renderSheet()},0))}
init();
})();
