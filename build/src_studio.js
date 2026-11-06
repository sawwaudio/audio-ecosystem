/* saww audio ecosystem v0.43〜v0.45 — 写真で選ぶ音（See it. Tap it. Hear it.）・マスター EQ・リール作成・マルチトラック・プラン
   v0.45：写真のタイルを「音場」の唯一の入口にした（自律演奏の参加・環境音の層もタイルで切り替える）。下の再生バー。
   本体スクリプト（音声エンジン・音源ライブラリ）の後に読み込む。本体の関数と変数（ctx, master, recordings, loadOne, mixLane など）をそのまま使い、
   音声エンジンと音源の対応は変えない。build/integrate_v043.py が index.html の <script id="ae-studio"> にこのファイルを埋め込む。 */
(()=>{'use strict';
const VER='v0.49';
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
// v0.48：生き物は鳥・虫・両生類・哺乳類・水の生き物、それ以外の環境の録音は「環境音」（data/sound_categories.json。台帳の記載から決め、推測しない）
const CATS=(()=>{try{return JSON.parse($('ae-categories').textContent).categories}catch(e){return {}}})();
const GROUP_LABEL={birds:['鳥','BIRD'],insects:['虫','INSECT'],amphibians:['両生類','AMPHIBIAN'],mammals:['哺乳類','MAMMAL'],aquatic:['水の生き物','WATER LIFE'],ambience:['環境音','AMBIENCE'],animals:['動物','ANIMAL'],landscape:['水・環境','AMBIENCE'],user:['自分の音','MY SOUND']};
function groupOf(id){if(userSounds.has(id))return 'user';const c=CATS[id];if(c)return c.cat;const r=recordings.find(x=>x.id===id);return r?(r.kind==='landscape'?'ambience':r.group==='animals'?'mammals':r.group):'ambience'}
// 統一したプレースホルダー（写真がない音）。色はグループごと、線は同じ型。
const PH_HUE={birds:210,insects:42,amphibians:95,mammals:22,aquatic:185,ambience:150,animals:22,landscape:165,user:265};
const GROUP_COLOR={birds:'#8fb3d6',insects:'#e6c27a',amphibians:'#a9c47f',mammals:'#cf8e6a',aquatic:'#7fbab6',ambience:'#b9b3a3',animals:'#cf8e6a',landscape:'#8ec3a0',user:'#b5a6d6'};
// 環境音の図：録音の名前から種類（雨・水の流れ・波と岩・風と森・火・嵐・氷）を選び、細い線で描く。音の正体を推測するものではなく、名前の言葉で選ぶだけ
function ambKind(id){const n=nameOf(id);return /雷|嵐/.test(n)?'storm':/雨/.test(n)?'rain':/氷/.test(n)?'ice':/火|暖炉/.test(n)?'fire':/波|潮|岩|入り江|海岸/.test(n)?'sea':/川|渓流|小川|急流|滝|水|湿原/.test(n)?'water':'wind'}
function ambSVG(id){const k=ambKind(id),c='hsla(48,40%,82%,.85)',st='fill="none" stroke="'+c+'" stroke-width="2.2" stroke-linecap="round"';let d='';
 if(k==='rain')for(let i=0;i<9;i++){const x=22+(i%5)*19+(i>4?9:0),y=30+(i>4?26:0)+(i*7)%11;d+='<path d="M'+x+' '+y+'l-5 12" '+st+'/>'}
 else if(k==='water'||k==='ice')for(let i=0;i<4;i++){const y=40+i*13;d+='<path d="M14 '+y+'q11 -7 23 0t23 0t23 0t23 0" '+st+' opacity="'+(1-i*.18)+'"/>'}
 else if(k==='sea')d='<path d="M10 74q12 -18 26 -6t26 -4t26 -6t24 8" '+st+'/><path d="M10 88q14 -10 28 -2t28 -2t28 -2t18 4" '+st+' opacity=".6"/><path d="M30 60q8 -14 22 -12" '+st+' opacity=".7"/>'
 else if(k==='fire')d='<path d="M60 92c-16 -6 -18 -24 -6 -38c2 10 8 12 10 4c6 8 14 18 8 28c-2 4 -6 6 -12 6z" '+st+'/>'
 else if(k==='storm')d='<path d="M30 52q4 -16 20 -14q6 -12 22 -6q14 0 14 14q8 4 4 12h-58q-10 -2 -2 -6z" '+st+'/><path d="M58 70l-8 14h10l-6 14" '+st+'/>'
 else d='<path d="M14 50q20 -10 40 0t40 -2" '+st+'/><path d="M24 66q18 -8 36 0t40 0" '+st+' opacity=".7"/><path d="M34 82q14 -6 28 0t26 0" '+st+' opacity=".5"/>';
 return '<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="ag-'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(150,14%,17%)"/><stop offset="1" stop-color="hsl(150,16%,9%)"/></linearGradient></defs><rect width="120" height="120" fill="url(#ag-'+id+')"/>'+d+'</svg>'}
function placeholderSVG(id,g){if(g==='ambience')return ambSVG(id);if(g!=='user'&&recordings.some(r=>r.id===id))return illustSVG(id,nameOf(id),g);let h=0;for(const ch of id)h=(h*31+ch.charCodeAt(0))>>>0;const hue=PH_HUE[g]??180,rot=h%360,rings=[];
 for(let i=0;i<7;i++){const r=14+i*11,wob=2+((h>>(i*3))&7)*.6;let d='';for(let k=0;k<=48;k++){const a=k/48*6.2832,rr=r+Math.sin(a*3+i+rot)*wob;d+=(k?'L':'M')+(60+Math.cos(a)*rr).toFixed(1)+' '+(60+Math.sin(a)*rr).toFixed(1)}rings.push('<path d="'+d+'Z" fill="none" stroke="hsla('+hue+',45%,'+(70-i*5)+'%,'+(0.55-i*.06).toFixed(2)+')" stroke-width="1"/>')}
 return '<svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="120" height="120" fill="hsl('+hue+',30%,9%)"/>'+rings.join('')+'<circle cx="60" cy="60" r="3" fill="hsl('+hue+',60%,75%)"/></svg>'}

// ───────── 音を鳴らす（写真のタイル） ─────────
// タップで実録音をループ再生（切れ目はクロスフェード）。もう一度タップで止める。いくつでも重ねられる（同時に鳴らす数は 12 まで）。
// 行き先はミキサーのチャンネル：生き物の声→「生き物」、環境の録音→「環境音」、自分の音→「サンプラー」。EQ・FX・録音・リールにそのまま入る。
const userSounds=new Map();const tileState=new Map();let focusId=null;const TILE_MAX=12;
function tst(id){let s=tileState.get(id);if(!s){s={id,vol:70,pan:0,loop:true,rest:null,voice:null,loading:false};tileState.set(id,s)}return s}
// v0.49：音ごとの「音量」と「休み（鳴き終わってから次に鳴くまで）」。ループの時も自律演奏の時も同じ設定が効く。
// 休み：null＝おまかせ（ループは休まない・自律演奏は約12秒）、0＝休まない、5〜60秒。音量 0〜100（自律演奏の生き物の音量は ×0.5、環境の層は ×0.65 で、既定の釣り合いを保つ）
const REST_OPTS=[[null,'おまかせ','Auto'],[0,'休まない','No rest'],[5,'5秒','5 s'],[15,'15秒','15 s'],[30,'30秒','30 s'],[60,'60秒','60 s']];
function restLoop(id){const r=tst(id).rest;return r==null?0:r}
function setSoundVol(id,v){v=clamp(Math.round(+v),0,100);setTileVol(id,v);const k=engineKind(id);
 if(k==='bio'){speciesSettings[id].level=Math.round(v*.5);updateBioMix()}else if(k==='field'){const lv=Math.round(v*.65);if((fieldConfig.levels[id]||0)>0&&lv>0)setFieldLevel(id,lv);if(lv>0)lastFieldLevel.set(id,lv)}}
function setSoundRest(id,r){const s=tst(id);s.rest=r==null||r===''?null:clamp(+r,0,90);if(engineKind(id)==='bio')speciesSettings[id].rest=s.rest==null?12:Math.max(1,s.rest)}
function restSelect(id,cls){const sel=el('select',{class:cls||'restSel','aria-label':L('休み（鳴き終わってから次まで）','Rest (after each call)')});const cur=tst(id).rest;
 for(const [v,ja,en] of REST_OPTS){const o=el('option',{value:v==null?'':String(v),text:L(ja,en)});if((v==null&&cur==null)||(v!=null&&cur===v))o.selected=true;sel.append(o)}
 sel.addEventListener('change',()=>{setSoundRest(id,sel.value===''?null:+sel.value);if(sheetId===id)renderSheet();renderDockPanel(true)});return sel}
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
   const rs=restLoop(id),next=rs>0?t+d+rs:t+d-fade;if(s.loop)v.timer=setTimeout(()=>spawn(next,false),Math.max(0,(next-ctx.currentTime-.4)*1000));else v.timer=setTimeout(()=>{if(s.voice===v&&!s.loop)tileStop(id)},Math.max(0,(t+d-ctx.currentTime)*1000))};
  spawn(ctx.currentTime+.03,true);if(userSounds.has(id))bufferOrigins.set(id,'import');noteTile(id,noteRecUse);
  status(nameOf(id)+' を再生中');}
 catch(e){s.loading=false;s.voice=null;status(L('読み込みに失敗しました: ','Loading failed: ')+(e.message||e.name))}
 finally{renderTile(id);renderCount()}}
function tileStop(id,fast){const s=tileState.get(id);if(!s)return;s.loading=false;const v=s.voice;if(!v){renderTile(id);return}s.voice=null;clearTimeout(v.timer);
 const t=ctx.currentTime,tc=fast?.02:.12;for(const n of v.srcs){try{n.env.gain.cancelScheduledValues(t);n.env.gain.setValueAtTime(n.env.gain.value,t);n.env.gain.setTargetAtTime(0,t,tc);n.src.stop(t+tc*6)}catch(e){}}
 setTimeout(()=>{for(const x of [v.out,v.pan,v.wet,v.an])try{x.disconnect()}catch(e){}},tc*7000+100);if(focusId===id)focusId=playingIds().slice(-1)[0]||null;renderTile(id);renderCount()}
// ───────── 写真のタイル＝音場（v0.45）─────────
// タイルが音を選ぶ唯一の入口。自律演奏が止まっている時はタップした音をループで鳴らし、
// 自律演奏中は、生き物の声は「参加する／しない」（休みを挟んで鳴く）、環境の録音は環境層のオン／オフをタイルで切り替える。
// 自律演奏を始める時、ループで鳴っていた音はそのまま自律演奏の参加メンバーに引き継ぐ（同じ音を二重に鳴らさない）。
const REC=new Map(recordings.map(r=>[r.id,r]));
function engineKind(id){if(userSounds.has(id))return null;const r=REC.get(id);if(!r)return null;if(r.fieldBed)return 'field';if(r.kind!=='landscape'&&speciesSettings[id])return 'bio';return null}
function member(id){const k=engineKind(id);if(k==='bio')return !!speciesSettings[id].enabled;if(k==='field')return !fieldConfig.legacy&&(fieldConfig.levels[id]||0)>0;return false}
const autoOn=()=>playing;
function isOn(id){const s=tileState.get(id);return !!(s&&(s.voice||s.loading))||(autoOn()&&member(id)&&rightsAllowed(id))}
function isSounding(id){const s=tileState.get(id);if(s&&s.voice)return true;if(!autoOn())return false;if(activeBio.has(id))return true;for(const v of fieldVoices)if(v.id===id)return true;return false}
const lastFieldLevel=new Map();
function fieldLevelFor(id){return lastFieldLevel.get(id)||fieldDefaults[id]||45}
function setMember(id,on){const k=engineKind(id);
 if(k==='bio'){const v=speciesSettings[id];if(!!v.enabled===on)return;v.enabled=on;if(!on)fadeResident(id);else residentDue.set(id,(ctx?.currentTime||0)+.1);renderBio();syncEcosystem()}
 else if(k==='field'){const cur=fieldConfig.levels[id]||0;if(on===(cur>0))return;if(!on)lastFieldLevel.set(id,cur);setFieldLevel(id,on?fieldLevelFor(id):0)}}
// 自律演奏を始める直前：ループで鳴っている音を参加メンバーに引き継ぐ（鳴っている音がなければ、いまの参加メンバーのまま）
function handOverToAuto(){const ids=playingIds().filter(id=>engineKind(id));if(!ids.length)return;const want=new Set(ids);
 for(const [id,v] of Object.entries(speciesSettings))if(engineKind(id)==='bio')v.enabled=want.has(id);
 for(const r of recordings)if(r.fieldBed){const cur=fieldConfig.levels[r.id]||0;if(want.has(r.id)){if(!cur)fieldConfig.levels[r.id]=fieldLevelFor(r.id)}else if(cur){lastFieldLevel.set(r.id,cur);fieldConfig.levels[r.id]=0}}
 syncFields();renderBio();syncEcosystem();for(const id of ids)tileStop(id,true);
 status(L(ids.length+'音を自律演奏に引き継ぎました',ids.length+' sound(s) handed over to auto-play'))}
document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('#play')&&!playing&&!starting&&!pausing)handOverToAuto()},true);
function tileToggle(id){const s=tst(id);if(s.voice||s.loading){tileStop(id);return}
 if(autoOn()&&engineKind(id)){
  if(!rightsAllowed(id)){status(L('この録音は商用モードの対象外のため鳴らしません（代用しません）。','This recording is excluded by the commercial mode, so it will not play (no substitute).'));return}
  const on=!member(id);setMember(id,on);if(on)focusId=id;status(nameOf(id)+(on?' を自律演奏に加えました':' を自律演奏から外しました'));renderTile(id);renderCount();return}
 tileStart(id)}
// v0.49：下のバーの「鳴っている音」：鳴っている音をまとめて見て、音量・休みを変えたり、✕ で外したりする
let dockPanelOpen=false,dockPanelKey='';
function removeSound(id){const s=tileState.get(id);if(s&&(s.voice||s.loading))tileStop(id);else if(autoOn()&&member(id))setMember(id,false);renderTile(id);renderCount();renderDockPanel(true)}
function renderDockPanel(force){const box=$('dockPanel'),btn=$('dockList');if(!box)return;box.hidden=!dockPanelOpen;if(btn)btn.setAttribute('aria-expanded',String(dockPanelOpen));if(!dockPanelOpen)return;
 const ids=onIds(),key=ids.join('|')+'#'+lang();if(!force&&key===dockPanelKey)return;dockPanelKey=key;const list=$('dockPanelList');list.textContent='';
 if(!ids.length){list.append(el('p',{class:'micro',text:L('いまは何も鳴っていません。写真や環境音をタップしてください。','Nothing is playing. Tap a photo or an ambience.')}));return}
 for(const id of ids){const g=groupOf(id),s=tst(id),p=photoFor(id);const thumb=p?el('img',{src:p.small,alt:'',class:'dpThumb',referrerpolicy:'no-referrer'}):el('span',{class:'dpThumb ph',html:placeholderSVG(id,g)});
  const vol=el('input',{type:'range',min:'0',max:'100',step:'1',value:String(s.vol),'aria-label':nameOf(id)+L('の音量',' volume')});const vv=el('output',{class:'value',text:String(s.vol)});
  vol.addEventListener('input',()=>{setSoundVol(id,vol.value);vv.textContent=vol.value});
  const x=el('button',{type:'button',class:'dpRemove','aria-label':nameOf(id)+L('を外す',' — remove'),text:'✕'});x.addEventListener('click',()=>removeSound(id));
  const row=el('div',{class:'dpRow','data-id':id,'data-group':g},thumb,el('div',{class:'dpMain'},el('div',{class:'dpName',text:nameOf(id)}),el('div',{class:'dpCtl'},el('label',{class:'dpVol'},vol,vv),g==='ambience'?null:restSelect(id))),x);list.append(row)}}
// 下の再生バー：止める（タイル・自律演奏・トラック・パッド）と、リールへ
function stopEverything(){tileStopAll();if(playing)pause().catch(()=>{});if(trk.playing)trkStop();if(typeof smpStopAll==='function')try{smpStopAll()}catch(e){}renderDock()}
function onIds(){return tileIds().filter(isOn)}
function renderDock(){const d=$('dock');if(!d)return;const on=onIds(),show=on.length>0||autoOn()||trk.playing;if(d.hidden===show)d.hidden=!show;document.body.classList.toggle('docked',show);if(!show){if(dockPanelOpen){dockPanelOpen=false;renderDockPanel()}return}renderDockPanel();const dl=$('dockListN');if(dl)dl.textContent=String(on.length);
 const sound=on.filter(isSounding),names=(sound.length?sound:on).slice(-2).map(nameOf);
 const parts=[on.length?on.length+'音を再生中':'自律演奏中'];if(on.length&&autoOn())parts.push('自律演奏');if(names.length)parts.push(names.join(' ＋ '));
 const txt=parts.join(' · ');const el=$('dockText');if(el&&el.dataset.ja!==txt){el.dataset.ja=txt;el.textContent=txt}}
function tileStopAll(){for(const id of playingIds())tileStop(id);for(const s of tileState.values())s.loading=false;renderAllTiles()}
function setTileVol(id,v){const s=tst(id);s.vol=clamp(+v,0,100);if(s.voice)s.voice.out.gain.setTargetAtTime(s.vol/100,ctx.currentTime,.05)}
function setTilePan(id,v){const s=tst(id);s.pan=clamp(+v,-1,1);if(s.voice&&s.voice.pan.pan)s.voice.pan.pan.setTargetAtTime(s.pan,ctx.currentTime,.05)}
// 商用モードが変わったら、対象外になった音を止める（代用しない）
setInterval(()=>{for(const id of playingIds())if(!userSounds.has(id)&&!rightsAllowed(id))tileStop(id,true);renderRightsDim();document.body.classList.toggle('live',autoOn()||playingIds().length>0);if(autoOn()||document.querySelector('#tileSection .tile.auto'))for(const tile of document.querySelectorAll('#tileSection .tile'))renderTile(tile.dataset.id);renderCount()},400);

// ───────── タイルの画面 ─────────
const FILTERS=[['all','すべて','All'],['birds','鳥','Birds'],['insects','虫','Insects'],['amphibians','両生類','Amphibians'],['mammals','哺乳類','Mammals'],['aquatic','水の生き物','Water life'],['japan','日本','Japan'],['photo','写真あり','With photos'],['user','自分の音','My sounds'],['playing','再生中','Playing']];
let tileFilter='all',tileShowAll=false,soundTab='creatures';const TILE_PAGE=12; // 最初は12枚だけ見せる（スクロールせずにリール作成まで届くように）。残りは「すべて表示」
function tileIds(){const lib=recordings.map(r=>r.id);const order=id=>{const p=photoFor(id)?0:1,r=recordings.find(x=>x.id===id),k=r.kind==='species'?0:r.kind==='mixed'?1:2;return p*10+k};
 const sorted=lib.slice().sort((a,b)=>order(a)-order(b));return [...userSounds.keys(),...sorted]}
// 生き物の分類の絞り込み（鳥〜水の生き物）は生き物の欄だけに効く。環境音の欄は「日本・写真あり・自分の音・再生中」だけ効く
const CREATURE_FILTERS=['birds','insects','amphibians','mammals','aquatic'];
function matches(id){const g=groupOf(id);if(tileFilter==='all')return true;if(g==='ambience'&&CREATURE_FILTERS.includes(tileFilter))return true;if(tileFilter==='user')return g==='user';if(tileFilter==='playing')return isOn(id);if(tileFilter==='photo')return !!photoFor(id);
 if(tileFilter==='japan'){const r=recordings.find(x=>x.id===id),m=wildMeta[id]||{};return !!r&&(r.japanRecording===true||(m.recordedRegions||[]).includes('japan')||m.japanNative===true)}
 return g===tileFilter}
function subOf(id){const u=userSounds.get(id);if(u)return u.origin==='mic'?L('マイク録音','Mic recording'):u.origin==='bounce'?L('出音の録音','Output recording'):L('読み込んだ音','Imported audio');
 const r=recordings.find(x=>x.id===id);const b=binomial(r.latin);if(b)return b;const m=wildMeta[id]||{};return m.recordedCountry||''}
function makeTile(id,uid){const g=groupOf(id),p=photoFor(id),r=recordings.find(x=>x.id===id);
  const img=p?el('img',{src:p.small,alt:'',loading:'lazy',decoding:'async',referrerpolicy:'no-referrer'}):el('span',{class:'ph',html:placeholderSVG(id,g)});
  if(p)img.addEventListener('error',()=>{img.replaceWith(el('span',{class:'ph',html:placeholderSVG(id,g)}))},{once:true});
  const tierLetter=r?rightsTierOf(r.license):'U';
  const play=el('button',{type:'button',class:'tilePlay','aria-pressed':'false','data-id':id},el('span',{class:'tileImg'},img,!p&&g!=='ambience'?el('span',{class:'phLabel',text:GROUP_LABEL[g]?GROUP_LABEL[g][1]:''}):null),
   el('canvas',{class:'tileWave',width:'120',height:'26','aria-hidden':'true'}),el('span',{class:'tileText'},el('span',{class:'tileName',id:'tn-'+uid,text:nameOf(id)}),el('span',{class:'tileSub','data-i18n-skip':/^[A-Z]/.test(subOf(id))?'':false,text:subOf(id)})),
   el('span',{class:'tileTier tier'+tierLetter,'aria-hidden':'true',text:tierLetter}));
  const info=el('button',{type:'button',class:'tileInfo','aria-labelledby':'ti-'+uid+' tn-'+uid,'data-id':id},el('span',{'aria-hidden':'true',text:'i'}),el('span',{id:'ti-'+uid,hidden:true,text:'詳細'}));
  const tile=el('div',{class:'tile'+(g==='ambience'?' amb':''),'data-id':id,'data-group':g},play,info);bindTile(tile,id);return tile}
function buildTiles(){const grid=$('tileGrid'),amb=$('ambGrid');if(!grid)return;grid.textContent='';if(amb)amb.textContent='';
 const all=tileIds().filter(matches),ids=all.filter(id=>groupOf(id)!=='ambience'),ambIds=all.filter(id=>groupOf(id)==='ambience'),cols=Math.max(1,(getComputedStyle(grid).gridTemplateColumns||'').split(' ').filter(Boolean).length||2),page=Math.ceil(TILE_PAGE/cols)*cols,cut=tileShowAll?ids.length:Math.min(ids.length,page);/* 列数に合わせて行をそろえる（2列なら12枚、5列なら15枚） */
 let uid=0;for(const id of ids.slice(0,cut)){uid++;grid.append(makeTile(id,uid));renderTile(id)}
 if(amb){for(const id of ambIds){uid++;amb.append(makeTile(id,uid));renderTile(id)}}renderTabs(ids.length,ambIds.length)
 if(!grid.children.length)grid.append(el('p',{class:'micro',text:tileFilter==='user'?L('まだありません。「＋ 自分の音を追加」から読み込めます。','Nothing yet. Add one with “＋ Add my sound”.'):L('該当する音がありません。','No sounds match.')}));
 if(ids.length>page){const more=el('button',{type:'button',class:'tileMore','aria-expanded':String(tileShowAll),text:tileShowAll?L('少なく表示','Show fewer'):L('すべて表示（'+ids.length+'）','Show all ('+ids.length+')')});
  more.addEventListener('click',()=>{tileShowAll=!tileShowAll;buildTiles();if(!tileShowAll)$('tileSection').scrollIntoView({block:'start'})});grid.append(more)}
 renderCount();renderRightsDim()}
function renderTabs(nc,na){const a=$('tabCreatures'),b=$('tabAmbience');if(!a)return;const on=soundTab==='ambience';a.setAttribute('aria-selected',String(!on));b.setAttribute('aria-selected',String(on));
 $('creaturePane').hidden=on;$('ambSection').hidden=!on;const pc=onIds().filter(id=>groupOf(id)!=='ambience').length,pa=onIds().filter(id=>groupOf(id)==='ambience').length;
 const ca=$('tabCreaturesN'),cb=$('tabAmbienceN');if(ca)ca.textContent=pc?L(pc+'音',pc+' on'):'';if(cb)cb.textContent=pa?L(pa+'音',pa+' on'):''}
function setTab(t){soundTab=t;renderTabs()}
function bindTile(tile,id){const play=tile.querySelector('.tilePlay'),info=tile.querySelector('.tileInfo');let timer=0,long=false,sx=0,sy=0;
 play.addEventListener('pointerdown',e=>{long=false;sx=e.clientX;sy=e.clientY;clearTimeout(timer);timer=setTimeout(()=>{long=true;openSheet(id)},520)});
 play.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-sx,e.clientY-sy)>12)clearTimeout(timer)});
 for(const ev of ['pointerup','pointercancel','pointerleave'])play.addEventListener(ev,()=>clearTimeout(timer));
 play.addEventListener('contextmenu',e=>e.preventDefault());
 play.addEventListener('click',e=>{if(long){long=false;e.preventDefault();return}tileToggle(id)});
 play.addEventListener('keydown',e=>{if(e.key==='i'||e.key==='I'||(e.key==='Enter'&&e.shiftKey)){e.preventDefault();openSheet(id)}});
 info.addEventListener('click',()=>openSheet(id))}
function renderTile(id){const s=tileState.get(id);for(const tile of document.querySelectorAll('.tile[data-id="'+CSS.escape(id)+'"]')){const b=tile.querySelector('.tilePlay'),on=isOn(id),ld=!!(s&&s.loading),snd=isSounding(id),auto=on&&!(s&&(s.voice||s.loading));
  if(tile.classList.contains('on')!==on)tile.classList.toggle('on',on);if(tile.classList.contains('loading')!==ld)tile.classList.toggle('loading',ld);if(tile.classList.contains('sounding')!==snd)tile.classList.toggle('sounding',snd);if(tile.classList.contains('auto')!==auto)tile.classList.toggle('auto',auto);
  if(b.getAttribute('aria-pressed')!==String(on))b.setAttribute('aria-pressed',String(on));
  b.setAttribute('aria-label',nameOf(id))}
 if(sheetId===id)renderSheet()}
function renderAllTiles(){for(const id of tileIds())renderTile(id);renderCount()}
function renderCount(){renderDock();renderTabs();const c=$('tileCount');if(c){const n=onIds().length;c.textContent=n?L(n+'音を再生中',n+' playing'):L(recordings.length+'録音',recordings.length+' recordings')}const tr=$('tileToReel');if(tr)tr.disabled=!onIds().length&&!autoOn()}
function renderRightsDim(){for(const tile of document.querySelectorAll('.tile')){const id=tile.dataset.id;const blocked=!userSounds.has(id)&&!rightsAllowed(id);if(tile.classList.contains('blocked')!==blocked)tile.classList.toggle('blocked',blocked)}}
// 再生中のタイルに小さな波形（周波数の棒）を描く
let paintAt=0;function paintTiles(now){requestAnimationFrame(paintTiles);if(now-paintAt<40)return;paintAt=now;
 const ids=autoOn()?[...document.querySelectorAll('#tileSection .tile.sounding')].map(t=>t.dataset.id):playingIds();let mf=null;
 for(const id of ids){const s=tileState.get(id),v=s&&s.voice;const cv=document.querySelector('.tile[data-id="'+CSS.escape(id)+'"] .tileWave');if(!cv)continue;let f;
  if(v){f=v.fbuf||(v.fbuf=new Uint8Array(v.an.frequencyBinCount));v.an.getByteFrequencyData(f)}else{if(!analyser)continue;if(!mf){mf=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(mf)}f=mf}
  const c=cv.getContext('2d'),W=cv.width,H=cv.height;c.clearRect(0,0,W,H);
  const N=20,bw=W/N;c.fillStyle=GROUP_COLOR[groupOf(id)]||'#ffd447';for(let i=0;i<N;i++){const k=Math.floor(Math.pow(i/N,1.6)*f.length*.7)+1,val=f[k]/255,h=Math.max(1.5,val*H);c.fillRect(i*bw+1,(H-h)/2,bw-2,h)}}}
requestAnimationFrame(paintTiles);

// ───────── 詳細シート（長押し・i ボタン） ─────────
let sheetId=null;
function openSheet(id){sheetId=id;const d=$('tileSheet');renderSheet();if(d.showModal&&!d.open)d.showModal();else d.setAttribute('open','');setTimeout(()=>$('sheetPlay')?.focus(),30)}
function closeSheet(){const d=$('tileSheet');if(d.open&&d.close)d.close();else d.removeAttribute('open');const id=sheetId;sheetId=null;const b=document.querySelector('.tile[data-id="'+CSS.escape(id||'')+'"] .tilePlay');if(b)b.focus()}
function fmtSource(id){const e=audioManifest.recordings[id];const pc=e&&(e.pcm||e.compat);if(!pc)return '';return (pc.codec||pc.format||'')+' · '+(pc.sampleRate/1000)+' kHz · '+pc.channels+'ch · '+(pc.duration||0).toFixed(1)+' s'}
function renderSheet(){const id=sheetId;if(!id)return;const s=tst(id),u=userSounds.get(id),r=recordings.find(x=>x.id===id),m=wildMeta[id]||{},p=photoFor(id),g=groupOf(id);
 $('sheetName').textContent=nameOf(id);$('sheetLatin').textContent=r?(binomial(r.latin)||r.latin||''):subOf(id);
 const ph=$('sheetPhoto');ph.textContent='';ph.append(p?el('img',{src:p.thumb,alt:L(nameOf(id)+'の写真',(m.en||nameOf(id))+' photo'),referrerpolicy:'no-referrer'}):el('span',{class:'ph',html:placeholderSVG(id,g)}));
 $('sheetPhotoCredit').textContent=!p&&g!=='user'?(g==='ambience'?L('図：環境音の種類を表す線画','Drawing: shows the kind of ambience'):L('イラスト：録音の名前と分類から描いた絵です（実写ではありません）','Illustration drawn from the recording’s name and category (not a photo)')):p&&!p.user?L('写真：','Photo: ')+p.author+' · '+p.license+' · Wikimedia Commons':p&&p.user?L('画像：利用者が設定','Image: set by you'):L('写真なし（統一プレースホルダー）','No photo (standard placeholder)');
 const pb=$('sheetPlay'),on=isOn(id);pb.textContent=on?L('■ 停止','■ Stop'):s.loading?L('読み込み中…','Loading…'):L('▶ 再生','▶ Play');pb.setAttribute('aria-pressed',String(on));
 $('sheetVol').value=String(s.vol);$('sheetVolVal').textContent=String(s.vol);$('sheetPan').value=String(Math.round(s.pan*100));$('sheetPanVal').textContent=s.pan===0?'C':(s.pan<0?'L':'R')+Math.round(Math.abs(s.pan)*100);$('sheetLoop').checked=s.loop;
 {const g2=groupOf(id),row=$('sheetRestRow');if(row){row.hidden=g2==='ambience';const box=$('sheetRestBox');if(box){box.textContent='';box.append(restSelect(id,'restSel sheetRestSel'))}}}
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
 $('sheetVol').addEventListener('input',e=>{if(!sheetId)return;setSoundVol(sheetId,e.target.value);$('sheetVolVal').textContent=e.target.value;renderDockPanel(true)});
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

function renderFilters(){const box=$('tileFilters');if(!box)return;box.textContent='';for(const [k,ja,en] of FILTERS){const b=el('button',{type:'button','aria-pressed':String(tileFilter===k),text:L(ja,en),'data-f':k});b.addEventListener('click',()=>{tileFilter=k;tileShowAll=false;renderFilters();buildTiles()});box.append(b)}}

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
const TEMPLATES={nature:['nature','nature:dark'],'nature-paper':['nature','nature:paper'],'pop-sunny':['pop','pop:sunny'],'pop-candy':['pop','pop:candy'],'pop-lagoon':['pop','pop:lagoon'],'pop-jungle':['pop','pop:jungle'],'pop-night':['pop','pop:night'],forest:['panels','forest'],ocean:['panels','ocean'],night:['panels','night'],wildlife:['panels','wildlife'],minimal:['minimal','minimal'],waveform:['wave','forest'],spectrum:['analysis',null],abstract:['motion',null]};
let reelTpl='forest',reelPal=PAL.forest,reelImgMode='auto',reelUserImg=null;const imgCache=new Map();
function canvasImage(url){let e=imgCache.get(url);if(e)return e;e={img:new Image(),ok:false,fail:false};e.img.crossOrigin='anonymous';e.img.referrerPolicy='no-referrer';e.img.onload=()=>{e.ok=true};e.img.onerror=()=>{e.fail=true};e.img.src=url;imgCache.set(url,e);return e}
function setTemplate(name){if(!TEMPLATES[name])return false;reelTpl=name;const [layout,pal]=TEMPLATES[name];if(pal&&pal.startsWith('pop:')){popPal=POP[pal.slice(4)];popFonts()}else if(pal&&pal.startsWith('nature:')){natMode=pal.slice(7);natFonts()}else if(pal)reelPal=PAL[pal];const sel=$('reelStyle');if(sel&&sel.value!==name)sel.value=name;reelSetStyle(layout);return true}
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
 const p=id&&photoFor(id);if(!p)return illustImage(id);const e=canvasImage(p.thumb);if(e.fail)return null;return {e,p,credit:p.user?L('画像：利用者','Image: user'):'PHOTO '+p.author+' · '+p.license+' · Wikimedia Commons'}}
// 写真がない時のリール用の絵（イラスト・環境音の線画）。実写ではないことをクレジットに書く
const illCache=new Map();
function illustImage(id){if(!id||userSounds.has(id))return null;let u=illCache.get(id);if(!u){u='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(placeholderSVG(id,groupOf(id)).replace('<svg ','<svg width="800" height="800" '));illCache.set(id,u)}
 const e=canvasImage(u);if(e.fail)return null;return {e,illust:true,credit:L('イラスト：saww audio ecosystem（実写ではありません）','Illustration: saww audio ecosystem (not a photo)')}}
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
// ───────── リール：ポップ（v0.47）─────────
// 図鑑をリソグラフ（多色の版ずれ印刷）で刷ったような、はっきりした色の見た目。主役は「音で咲く花」：
// 生き物の写真を丸く切り抜き、その周りの花びら（周波数ごとの強さ）が開閉して回る。名前の文字は音で弾み、
// 鳴き始め（音の立ち上がり）で紙吹雪、低い音で背景の色の塊が揺れる。鳴いている生き物が替わると写真が弾んで入れ替わる。
// 文字は SNS の画面部品に隠れにくい範囲（REEL_SAFE）に置く。録音と写真のクレジットは映像の中にも入れる。
var POP={sunny:{bg:'#FFD447',bg2:'#FFB81F',ink:'#1F1A3D',paper:'#FFF7DB',a:'#FF4F9A',b:'#2E6BFF',c:'#1FBF86',dark:false},
 candy:{bg:'#FF8AC4',bg2:'#FF5FAE',ink:'#2B1242',paper:'#FFF0F7',a:'#FFE500',b:'#2FD9A6',c:'#6B5CFF',dark:false},
 lagoon:{bg:'#1F44D9',bg2:'#1733A8',ink:'#FFF7E3',paper:'#FFF7E3',a:'#FFDB3D',b:'#FF5CA6',c:'#5CF0C6',dark:true},
 jungle:{bg:'#17A866',bg2:'#0E8350',ink:'#0D251A',paper:'#F3FFE6',a:'#FF7A1A',b:'#FFE14D',c:'#FF5CA6',dark:false},
 night:{bg:'#2B1259',bg2:'#1C0A3E',ink:'#F7F0FF',paper:'#F7F0FF',a:'#B8FF3B',b:'#FF4FD8',c:'#3BE6FF',dark:true}};
var popPal=POP.sunny;
const DISPLAY='"Dela Gothic One","Hiragino Sans","Noto Sans JP",system-ui,sans-serif',ROUND='"M PLUS Rounded 1c","Hiragino Maru Gothic ProN","Hiragino Sans",system-ui,sans-serif';
let popFontReq='';
function popFonts(extra){if(!document.fonts||!document.fonts.load)return;const t='saww audio ecosystem 実録音 いま鳴いている 鳥 虫 動物 水 環境 0123456789 '+(extra||'');if(t===popFontReq)return;popFontReq=t;
 try{document.fonts.load('400 120px "Dela Gothic One"',t).catch(()=>{});document.fonts.load('800 40px "M PLUS Rounded 1c"',t).catch(()=>{});document.fonts.load('500 30px "M PLUS Rounded 1c"',t).catch(()=>{})}catch(e){}}
const PS={pet:new Float32Array(28),kick:0,onsets:0,subj:null,subjAt:0,conf:[],grain:null,blobs:[[.18,.2,.34],[.86,.46,.3],[.3,.86,.38]],lastT:0};
function popGrain(){if(PS.grain)return PS.grain;const g=document.createElement('canvas');g.width=g.height=256;const x=g.getContext('2d'),d=x.createImageData(256,256);let s=7;for(let i=0;i<d.data.length;i+=4){s=(s*16807)%2147483647;const v=s%255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}x.putImageData(d,0,0);PS.grain=g;return g}
function rrect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function elastic(u){u=clamp(u,0,1);return u===1?1:1-Math.pow(2,-9*u)*Math.cos(u*Math.PI*3.2)}
function popName(id){const r=recordings.find(x=>x.id===id),m=wildMeta[id]||{};const en=lang()==='en';const nm=(en?(m.en||(window.__i18n?__i18n.t(nameOf(id)):nameOf(id))):nameOf(id)).replace(/[（(][^）)]*[）)]/g,'').trim();
 return {r,m,name:nm,sub:en?(r&&binomial(r.latin)||''):(m.en||''),latin:r&&binomial(r.latin)||'',loc:r?(en&&window.__i18n?__i18n.t(r.location||''):(r.location||'')):'',g:groupOf(id)}}
function drawPop(c){const P=popPal,now=performance.now(),t=(now-A.t0)/1000,dt=Math.min(.1,Math.max(0,t-PS.lastT));PS.lastT=t;const ok=analyse();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
 const X0=REEL_SAFE.x0,X1=REEL_SAFE.x1,Y0=REEL_SAFE.y0,Y1=REEL_SAFE.y1,W=X1-X0,CX=(X0+X1)/2,CY=Y0+520;
 const low=ok?band(40,220):0,mid=ok?band(400,2500):0,high=ok?band(3000,9000):0;
 if(ok&&A.onsets!==PS.onsets){PS.onsets=A.onsets;PS.kick=1;for(let i=0;i<12&&PS.conf.length<90;i++){const a=Math.random()*6.283,sp=260+Math.random()*420;PS.conf.push({x:CX+Math.cos(a)*250,y:CY+Math.sin(a)*250,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-200,r:Math.random()*6.283,vr:(Math.random()-.5)*8,k:Math.floor(Math.random()*3),col:[P.a,P.b,P.c,P.paper][Math.floor(Math.random()*4)],life:1.4+Math.random()*.8})}}
 PS.kick=Math.max(0,PS.kick-dt*3.2);
 const id=reelSubject();if(id!==PS.subj){PS.subj=id;PS.subjAt=t;if(id)popFonts(nameOf(id)+' '+((wildMeta[id]||{}).en||''))}
 // 1. 地の色と、低い音で揺れる色の塊（平らな版の色）
 c.fillStyle=P.bg;c.fillRect(0,0,REEL_W,REEL_H);
 PS.blobs.forEach(([bx,by,br],i)=>{const col=[P.bg2,P.a,P.c][i];const R=REEL_W*br*(1+.18*low+.04*Math.sin(t*.7+i*2));const x=REEL_W*bx+60*Math.sin(t*.23+i),y=REEL_H*by+50*Math.cos(t*.19+i*1.7);
  c.globalAlpha=i===0?1:.22;c.fillStyle=col;c.beginPath();for(let k=0;k<=48;k++){const a=k/48*6.2832,w=1+.08*Math.sin(a*3+t*.9+i)+.05*Math.sin(a*5-t*.6);const px=x+Math.cos(a)*R*w,py=y+Math.sin(a)*R*w;k?c.lineTo(px,py):c.moveTo(px,py)}c.closePath();c.fill()});c.globalAlpha=1;
 // 2. 上の帯：アプリ名と録画の時間
 const st=reelState,tc=st&&st.active?((now-st.t0)/1000):t;c.font='800 30px '+ROUND;const nameW=c.measureText('saww audio ecosystem').width+48;rrect(c,X0,Y0,nameW,58,29);c.fillStyle=P.ink;c.fill();txt(c,'saww audio ecosystem',X0+24,Y0+39,'800 30px '+ROUND,P.bg);
 const tcs=(st&&st.active?'● ':'')+String(Math.floor(tc/60)).padStart(2,'0')+':'+String(Math.floor(tc%60)).padStart(2,'0');c.font='800 28px '+ROUND;const tw=c.measureText(tcs).width+40;rrect(c,X1-tw,Y0,tw,58,29);c.fillStyle=st&&st.active?P.a:P.paper;c.fill();txt(c,tcs,X1-20,Y0+39,'800 28px '+ROUND,'#1F1A3D','right');
 // 3. 花びら（周波数）。地の上に版ずれの影、その上に3色で
 const N=PS.pet.length,rot=t*.18+PS.kick*.12,pop=elastic((t-PS.subjAt)/.7),R0=230*(.62+.38*pop)*(1+.05*PS.kick);
 if(ok&&A.freq){const F=A.freq.length;for(let i=0;i<N;i++){const k=Math.floor(Math.pow((i%(N/2))/(N/2),1.7)*F*.55)+2;const v=A.freq[k]/255;PS.pet[i]+=(v-PS.pet[i])*.25}}else for(let i=0;i<N;i++)PS.pet[i]+=((.18+.08*Math.sin(t*1.3+i))-PS.pet[i])*.05;
 const petal=(i,len,off)=>{const a=rot+i/N*6.2832,w=6.2832/N*.62;const x0=CX+Math.cos(a)*(R0*.9),y0=CY+Math.sin(a)*(R0*.9),tip=R0+len;c.beginPath();c.moveTo(CX+Math.cos(a-w)*R0*.86+off,CY+Math.sin(a-w)*R0*.86+off);
  c.quadraticCurveTo(CX+Math.cos(a-w*1.3)*(R0+len*.7)+off,CY+Math.sin(a-w*1.3)*(R0+len*.7)+off,CX+Math.cos(a)*tip+off,CY+Math.sin(a)*tip+off);c.quadraticCurveTo(CX+Math.cos(a+w*1.3)*(R0+len*.7)+off,CY+Math.sin(a+w*1.3)*(R0+len*.7)+off,CX+Math.cos(a+w)*R0*.86+off,CY+Math.sin(a+w)*R0*.86+off);c.closePath()};
 for(let i=0;i<N;i++){const len=34+175*PS.pet[i]*(.7+.3*pop);petal(i,len,10);c.fillStyle=P.ink;c.globalAlpha=P.dark?.35:.9;c.fill();c.globalAlpha=1;petal(i,len,0);c.fillStyle=[P.a,P.b,P.c][i%3];c.fill()}
 // 4. 写真（丸く切り抜き、版ずれの色を後ろに）
 const ph=id?subjectPhoto(id):null;c.fillStyle=P.c;c.beginPath();c.arc(CX+16,CY+16,R0,0,6.2832);c.fill();
 c.save();c.beginPath();c.arc(CX,CY,R0,0,6.2832);c.clip();c.fillStyle=P.paper;c.fillRect(CX-R0,CY-R0,R0*2,R0*2);
 if(ph&&ph.e.ok){cover(c,ph.e.img,CX-R0,CY-R0,R0*2,R0*2,1.06+.05*PS.kick);notePhoto(ph)}else{c.strokeStyle=P.ink;c.globalAlpha=.25;c.lineWidth=6;for(let k=1;k<6;k++){c.beginPath();c.arc(CX,CY,R0*k/6*(1+.03*Math.sin(t*2+k)),0,6.2832);c.stroke()}c.globalAlpha=1}
 c.restore();c.lineWidth=12;c.strokeStyle=P.ink;c.beginPath();c.arc(CX,CY,R0,0,6.2832);c.stroke();
 // 5. ステッカー：グループ（回転した角丸）と、回る丸い「実録音」
 if(id){const nm=popName(id),gl=(GROUP_LABEL[nm.g]||['',''])[lang()==='en'?1:0];if(gl){c.save();c.translate(CX-R0*.82,CY-R0*.86);c.rotate(-.14+.04*Math.sin(t*1.7));c.font='900 34px '+ROUND;const w=c.measureText(gl).width+48;rrect(c,-w/2,-32,w,64,18);c.fillStyle=P.b;c.fill();c.lineWidth=6;c.strokeStyle=P.ink;c.stroke();txt(c,gl,0,12,'900 34px '+ROUND,P.dark?P.ink:P.paper,'center');c.restore()}}
 {c.save();c.translate(CX+R0*.9,CY+R0*.78);c.rotate(t*.35);c.beginPath();c.arc(0,0,84,0,6.2832);c.fillStyle=P.a;c.fill();c.lineWidth=6;c.strokeStyle=P.ink;c.stroke();
  const ring=L('実録音 ・ 本物の自然の音 ・ ','REAL FIELD RECORDING · ');c.font='800 21px '+ROUND;c.fillStyle=P.ink;c.textAlign='center';const chars=[...ring],n=chars.length;for(let k=0;k<n;k++){c.save();c.rotate(k/n*6.2832);c.fillText(chars[k],0,-56);c.restore()}
  c.rotate(-t*.35);txt(c,'♪',0,14,'900 44px '+ROUND,P.ink,'center');c.restore()}
 // 6. 名前（音で弾む文字）と、英名・学名・録音地
 let y=Y0+520+230+128;if(id){const nm=popName(id);let fs=112;c.font='400 '+fs+'px '+DISPLAY;while(c.measureText(nm.name).width>W&&fs>72){fs-=4;c.font='400 '+fs+'px '+DISPLAY}
  let lines=[nm.name];if(c.measureText(nm.name).width>W){const cs=[...nm.name],half=cs.length/2;let cut=Math.round(half);const sp=nm.name.split(' ');if(sp.length>1){let acc=0,best=1,bd=1e9;for(let k=1;k<sp.length;k++){acc+=sp[k-1].length+1;if(Math.abs(acc-half)<bd){bd=Math.abs(acc-half);best=k}}lines=[sp.slice(0,best).join(' '),sp.slice(best).join(' ')]}else lines=[cs.slice(0,cut).join(''),cs.slice(cut).join('')];
   while((Math.max(...lines.map(l=>c.measureText(l).width))>W||fs>92)&&fs>40){fs-=4;c.font='400 '+fs+'px '+DISPLAY}y-=fs*.3}
  c.textAlign='left';const F=A.freq?A.freq.length:1;let k=0;const total=[...nm.name].length;
  for(const line of lines){const tw2=c.measureText(line).width;let x=CX-tw2/2;for(const ch of [...line]){const cw=c.measureText(ch).width,v=A.freq?A.freq[Math.floor(Math.pow((k+1)/(total+1),1.6)*F*.4)+2]/255:0,drop=clamp((t-PS.subjAt-k*.05)/.45,0,1),dy=-34*v*v-10*PS.kick+(1-elastic(drop))*-90;
   c.globalAlpha=drop>0?1:0;c.fillStyle=P.ink;c.fillText(ch,x+5,y+dy+5);c.fillStyle=P.dark?P.a:P.paper;c.fillText(ch,x,y+dy);c.globalAlpha=1;x+=cw;k++}y+=fs*1.02}
  y+=56-fs*1.02;if(nm.sub)txt(c,nm.sub,CX,y,'800 40px '+ROUND,P.ink,'center',W);y+=46;if(nm.latin&&nm.latin!==nm.sub&&nm.latin!==nm.name)txt(c,nm.latin,CX,y,'italic 32px Georgia,serif',P.ink,'center',W);y+=48;
  if(nm.loc){c.font='700 28px '+ROUND;const lt=reelFit(c,nm.loc,W-60),lw=c.measureText(lt).width+44;rrect(c,CX-lw/2,y-34,lw,50,25);c.fillStyle=P.paper;c.fill();c.lineWidth=4;c.strokeStyle=P.ink;c.stroke();txt(c,lt,CX,y,'700 28px '+ROUND,'#1F1A3D','center')}}
 else{txt(c,L('写真をタップして','Tap a photo'),CX,y,'400 84px '+DISPLAY,P.ink,'center',W);txt(c,L('音を重ねよう','to layer sounds'),CX,y+100,'400 84px '+DISPLAY,P.ink,'center',W)}
 // 7. 声の線（いまの波形を太い線で）
 const wy=Y1-232;if(ok&&A.wave){c.lineWidth=10;c.lineCap='round';c.lineJoin='round';c.strokeStyle=P.ink;c.beginPath();const n=64,step=Math.floor(A.wave.length/n);let pk=.02;for(let i=0;i<A.wave.length;i+=8)pk=Math.max(pk,Math.abs(A.wave[i]));for(let i=0;i<=n;i++){let s2=0;for(let k=0;k<step;k++)s2+=A.wave[Math.min(A.wave.length-1,i*step+k)]||0;const v=s2/step/pk;const px=X0+i/n*W,py=wy+v*60;i?c.lineTo(px,py):c.moveTo(px,py)}c.stroke()}
 // 8. いっしょに鳴っている音（小さなステッカー）
 const others=reelList().filter(x=>x!==id).slice(0,3);let cx2=X0;others.forEach((o,k)=>{const nm=popName(o).name;c.font='800 26px '+ROUND;const lbl=reelFit(c,'+ '+nm,W/3-10),w=c.measureText(lbl).width+36;if(cx2+w>X1)return;rrect(c,cx2,Y1-186,w,48,24);c.fillStyle=[P.a,P.b,P.c][k%3];c.fill();c.lineWidth=4;c.strokeStyle=P.ink;c.stroke();txt(c,lbl,cx2+18,Y1-153,'800 26px '+ROUND,'#1F1A3D');cx2+=w+12});
 // 9. 紙吹雪（鳴き始めに飛ぶ）
 for(const q of PS.conf){q.vy+=900*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.r+=q.vr*dt;q.life-=dt;c.save();c.globalAlpha=clamp(q.life,0,1);c.translate(q.x,q.y);c.rotate(q.r);c.fillStyle=q.col;
  if(q.k===0){c.beginPath();c.arc(0,0,11,0,6.2832);c.fill()}else if(q.k===1){c.fillRect(-14,-6,28,12)}else{c.beginPath();c.moveTo(0,-14);c.lineTo(13,10);c.lineTo(-13,10);c.closePath();c.fill()}c.restore()}PS.conf=PS.conf.filter(q=>q.life>0&&q.y<REEL_H+40);
 // 10. クレジット（録音と写真）
 if(id){const r=recordings.find(x=>x.id===id);const cr=[r?'"'+(r.title||'')+'" — '+(r.author||'')+' · '+r.license:'',ph&&ph.e.ok?ph.credit:''].filter(Boolean);cr.forEach((s3,k)=>txt(c,s3,X0,Y1-100+k*28,'600 20px '+ROUND,P.ink,'left',W))}
 txt(c,({all:L('すべての素材','All sources'),nosa:L('BY-SA を除く','No CC BY-SA'),cc0:L('CC0・PD のみ','CC0 / PD only')}[RIGHTS.mode])+L('　クレジットの全文は説明欄に','  Full credits in caption'),X0,Y1-14,'700 20px '+ROUND,P.ink,'left',W);
 // 11. 印刷のざらつき
 c.save();c.globalAlpha=P.dark?.05:.07;c.globalCompositeOperation='multiply';const pat=c.createPattern(popGrain(),'repeat');c.fillStyle=pat;c.fillRect(0,0,REEL_W,REEL_H);c.restore()}
// ───────── リール：自然（v0.48・既定）─────────
// 生き物の写真が主役。写真を大きく見せ、ゆっくり寄って流す（音で少し明るむ）。色は写真から取る：地の色＝写真の暗い色、
// 差し色＝写真の中のいちばん鮮やかな色（1色だけ）。音は、写真の下端に生える細い線（周波数）と光の波形、鳴き始めの波紋で表す。
// 文字は図鑑の1ページのように：通し番号・和名（明朝）・学名（イタリック）・英名・録音地・クレジット。替わる時は1行ずつ静かに浮かぶ。
// 「紙」は明るい紙の地に写真を図版のように置く版。
var natMode='dark';const NAT_SERIF='"Shippori Mincho B1","Hiragino Mincho ProN","Yu Mincho",serif',NAT_SANS='"Zen Kaku Gothic New","Hiragino Sans","Noto Sans JP",system-ui,sans-serif',NAT_ITAL='"Cormorant Garamond",Georgia,serif';
const NAT_GROUP={birds:[[24,34,40],[143,179,214]],insects:[[33,32,22],[230,194,122]],amphibians:[[24,32,22],[169,196,127]],mammals:[[36,28,24],[207,142,106]],aquatic:[[16,30,34],[127,186,182]],ambience:[[22,28,26],[185,179,163]],animals:[[36,28,24],[207,142,106]],landscape:[[20,32,30],[142,195,160]],user:[[30,28,38],[181,166,214]]};
const NS={subj:null,subjAt:-9,prev:null,prevAt:-9,ripples:[],onsets:0,kick:0,lastT:0,wave:null,pal:new Map(),grass:new Float32Array(72)};
let natFontReq='';function natFonts(extra){if(!document.fonts||!document.fonts.load)return;const t='saww audio ecosystem 鳥 虫 動物 水 環境 録音 No.0123456789 '+(extra||'');if(t===natFontReq)return;natFontReq=t;
 try{document.fonts.load('600 100px "Shippori Mincho B1"',t).catch(()=>{});document.fonts.load('500 30px "Zen Kaku Gothic New"',t).catch(()=>{});document.fonts.load('italic 600 44px "Cormorant Garamond"','Abcdefghijklmnopqrstuvwxyz').catch(()=>{})}catch(e){}}
// 写真の色：小さく縮めて、暗い色（地）と鮮やかな色（差し色）を取る。読めない時はグループの色。
function natPalette(e,g){const key=e&&e.ok?e.img.src:'g:'+g;let p=NS.pal.get(key);if(p)return p;const [d0,a0]=NAT_GROUP[g]||NAT_GROUP.landscape;p={dark:d0,acc:a0};
 if(e&&e.ok){try{const cv=document.createElement('canvas');cv.width=cv.height=40;const x=cv.getContext('2d');x.drawImage(e.img,0,0,40,40);const d=x.getImageData(0,0,40,40).data,px=[];
  for(let i=0;i<d.length;i+=4){const r=d[i],g2=d[i+1],b=d[i+2],mx=Math.max(r,g2,b),mn=Math.min(r,g2,b),l=(mx+mn)/510,s2=mx===mn?0:(mx-mn)/(255-Math.abs(mx+mn-255));px.push({r,g:g2,b,l,s:s2})}
  px.sort((a,b)=>a.l-b.l);const dk=px.slice(0,Math.floor(px.length*.3)),avg=k=>dk.reduce((n,q)=>n+q[k],0)/dk.length;const dark=[avg('r'),avg('g'),avg('b')].map(v=>Math.round(v*.55+8));
  let best=null;for(const q of px)if(q.l>.32&&q.l<.78){const sc=q.s*(1-Math.abs(q.l-.55));if(!best||sc>best.sc)best={...q,sc}}
  let acc=a0;if(best&&best.s>.22){const L=(best.r+best.g+best.b)/3,boost=v=>Math.round(clamp(L+(v-L)*1.15+(170-L)*.35,0,255));acc=[boost(best.r),boost(best.g),boost(best.b)]}
  p={dark,acc};NS.pal.set(key,p)}catch(err){NS.pal.set(key,p)}}else NS.pal.set(key,p);return p}
const rgb=(a,al)=>al==null?'rgb('+a.join(',')+')':'rgba('+a.join(',')+','+al+')';
function natIndex(id){const i=recordings.findIndex(r=>r.id===id);return i<0?'—':'No.'+String(i+1).padStart(3,'0')}
function drawNature(c){const now=performance.now(),t=(now-A.t0)/1000,dt=Math.min(.1,Math.max(0,t-NS.lastT));NS.lastT=t;const ok=analyse();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
 const paper=natMode==='paper',X0=REEL_SAFE.x0,X1=REEL_SAFE.x1,Y0=REEL_SAFE.y0,Y1=REEL_SAFE.y1,W=X1-X0;
 const id=reelSubject();if(id!==NS.subj){NS.prev=NS.subj;NS.prevAt=t;NS.subj=id;NS.subjAt=t;if(id)natFonts(nameOf(id)+' '+((wildMeta[id]||{}).en||''))}
 if(ok&&A.onsets!==NS.onsets){NS.onsets=A.onsets;NS.kick=1;if(NS.ripples.length<6)NS.ripples.push({t,x:540,y:paper?640:600})}NS.kick=Math.max(0,NS.kick-dt*1.6);
 const g=id?groupOf(id):'landscape',ph=id?subjectPhoto(id):null,pal=natPalette(ph&&ph.e,g),acc=pal.acc,dark=pal.dark;
 const ink=paper?[31,36,32]:[241,236,224],bg=paper?[243,239,230]:dark,muted=paper?[96,104,96]:[200,198,186];
 c.fillStyle=rgb(bg);c.fillRect(0,0,REEL_W,REEL_H);
 // 1. 写真（ゆっくり寄って流す・音で少し明るむ・替わる時は重ねてにじませる）
 const PX=paper?60:0,PY=paper?250:0,PW=paper?REEL_W-120:REEL_W,PH=paper?780:1200;
 const draw=(sid,al,born)=>{const p2=sid?subjectPhoto(sid):null;if(!p2||!p2.e.ok)return false;const u=(t-born),z=1.06+.06*((u*.03)%1),dx=Math.sin(u*.05)*20,dy=Math.cos(u*.04)*14;
  c.save();c.globalAlpha=al;c.beginPath();c.rect(PX,PY,PW,PH);c.clip();c.translate(dx,dy);cover(c,p2.e.img,PX-20,PY-20,PW+40,PH+40,z+.012*NS.kick);c.restore();return true};
 const fade=clamp((t-NS.subjAt)/1.2,0,1);let shown=false;if(NS.prev&&fade<1)draw(NS.prev,1-fade,NS.prevAt-20);shown=draw(id,fade<1&&NS.prev?fade:1,NS.subjAt);
 if(ph&&ph.e.ok)notePhoto(ph);
 if(!shown){c.save();c.beginPath();c.rect(PX,PY,PW,PH);c.clip();const gr=c.createRadialGradient(540,PY+PH*.45,40,540,PY+PH*.45,PH*.8);gr.addColorStop(0,rgb(acc,.28));gr.addColorStop(1,rgb(dark));c.fillStyle=gr;c.fillRect(PX,PY,PW,PH);
  c.strokeStyle=rgb(acc,.35);c.lineWidth=2;for(let k=1;k<7;k++){c.beginPath();c.arc(540,PY+PH*.45,k*70*(1+.02*Math.sin(t+k)),0,6.2832);c.stroke()}c.restore()}
 if(NS.kick>0){c.save();c.globalCompositeOperation='screen';c.globalAlpha=.10*NS.kick;c.fillStyle=rgb(acc);c.fillRect(PX,PY,PW,PH);c.restore()}
 if(!paper){let gr=c.createLinearGradient(0,0,0,420);gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gr;c.fillRect(0,0,REEL_W,420);
  gr=c.createLinearGradient(0,PH-420,0,PH);gr.addColorStop(0,rgb(bg,0));gr.addColorStop(1,rgb(bg,1));c.fillStyle=gr;c.fillRect(0,PH-420,REEL_W,421)}
 else{c.strokeStyle=rgb(ink,.85);c.lineWidth=2;c.strokeRect(PX+.5,PY+.5,PW-1,PH-1)}
 // 2. 鳴き始めの波紋（細い光の輪）
 for(const r of NS.ripples){const u=(t-r.t)/2.6;if(u>1)continue;c.save();c.beginPath();c.rect(PX,PY,PW,PH);c.clip();c.strokeStyle=rgb(acc,.55*(1-u));c.lineWidth=2.5;c.beginPath();c.arc(r.x,r.y,60+u*520,0,6.2832);c.stroke();c.restore()}NS.ripples=NS.ripples.filter(r=>t-r.t<2.6);
 // 3. 写真の下端に生える細い線（周波数）と、光の波形
 const base=paper?PY+PH-24:PH-200,n=NS.grass.length;if(ok&&A.freq){const F=A.freq.length;for(let i=0;i<n;i++){const k=Math.floor(Math.pow(i/n,1.8)*F*.6)+2;NS.grass[i]+=(A.freq[k]/255-NS.grass[i])*.3}}
 c.save();c.strokeStyle=rgb(paper?[255,255,255]:acc,paper?.85:.75);c.lineWidth=2;c.lineCap='round';for(let i=0;i<n;i++){const x=X0+i/(n-1)*W,h=6+150*NS.grass[i]*NS.grass[i]+4*Math.sin(t*1.3+i*.7);c.beginPath();c.moveTo(x,base);c.lineTo(x+Math.sin(t*.8+i)*3,base-h);c.stroke()}c.restore();
 if(ok&&A.wave){const wy=base+(paper?0:36);let pk=.02;for(let i=0;i<A.wave.length;i+=8)pk=Math.max(pk,Math.abs(A.wave[i]));const pts=[],m=96,step=Math.floor(A.wave.length/m);for(let i=0;i<=m;i++){let s2=0;for(let k=0;k<step;k++)s2+=A.wave[Math.min(A.wave.length-1,i*step+k)]||0;pts.push([X0+i/m*W,wy+s2/step/pk*26])}
  const line=(w,al)=>{c.lineWidth=w;c.strokeStyle=rgb(paper?[255,255,255]:acc,al);c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke()};line(8,.12);line(2,.9)}
 // 4. 上：アプリ名と時間
 const st=reelState,tc=st&&st.active?((now-st.t0)/1000):t;const top=paper?Y0-20:Y0;const hc=paper?ink:[255,255,255];
 // ロゴ（v0.49。ヘッダーと同じ画像。丸く切り抜く）。読み込み前は文字だけ
 const lg=document.querySelector('img.brandLogo'),le=lg&&lg.src?canvasImage(lg.src):null,LX=le&&le.ok?X0+92:X0;
 if(le&&le.ok){c.save();c.beginPath();c.arc(X0+38,top+34,38,0,Math.PI*2);c.clip();c.drawImage(le.img,X0,top-4,76,76);c.restore();c.lineWidth=1.5;c.strokeStyle=rgb(hc,.35);c.beginPath();c.arc(X0+38,top+34,38,0,Math.PI*2);c.stroke()}
 txt(c,'saww audio ecosystem',LX,top+30,'500 30px '+NAT_SANS,rgb(hc,.92));txt(c,'nature as an instrument.',LX,top+66,'italic 600 28px '+NAT_ITAL,rgb(paper?muted:[255,255,255],.75));
 txt(c,(st&&st.active?'● ':'')+String(Math.floor(tc/60)).padStart(2,'0')+':'+String(Math.floor(tc%60)).padStart(2,'0'),X1,top+30,'500 28px '+NAT_SANS,st&&st.active?rgb(acc):rgb(hc,.85),'right');
 // 5. 図鑑の1ページ：番号・和名・学名・英名・録音地・クレジット（替わる時に1行ずつ浮かぶ）
 let y=paper?PY+PH+56:1110;const rise=k=>{const u=clamp((t-NS.subjAt-.25-k*.12)/.7,0,1),e=1-Math.pow(1-u,3);c.globalAlpha=e;return (1-e)*24};
 if(id){const r=recordings.find(x=>x.id===id),m=wildMeta[id]||{},en=lang()==='en',gl=(GROUP_LABEL[g]||['',''])[en?1:0];
  const name=(en?(m.en||nameOf(id)):nameOf(id)).replace(/[（(][^）)]*[）)]/g,'').trim(),latin=r&&binomial(r.latin)||'',sub=en?'':(m.en||'');
  let o=rise(0);txt(c,natIndex(id)+'　'+gl,X0,y+o,'500 26px '+NAT_SANS,rgb(acc));c.fillStyle=rgb(acc);c.fillRect(X0,y+o+16,56,3);
  o=rise(1);let fs=104;c.font='600 '+fs+'px '+NAT_SERIF;while(c.measureText(name).width>W&&fs>58){fs-=4;c.font='600 '+fs+'px '+NAT_SERIF}y+=fs+26;txt(c,name,X0,y+o,'600 '+fs+'px '+NAT_SERIF,rgb(ink),'left',W);
  if(latin&&latin!==name){o=rise(2);y+=58;txt(c,latin,X0,y+o,'italic 600 46px '+NAT_ITAL,rgb(ink,.9),'left',W)}
  if(sub){o=rise(3);y+=46;txt(c,sub,X0,y+o,'500 30px '+NAT_SANS,rgb(muted),'left',W)}
  o=rise(4);y+=paper?54:62;c.fillStyle=rgb(ink,.25);c.fillRect(X0,y+o-30,W,1);
  if(r){const loc=en&&window.__i18n?__i18n.t(r.location||''):(r.location||'');txt(c,(loc||'—')+(r.date?'　'+String(r.date).slice(0,4):''),X0,y+o+8,'500 28px '+NAT_SANS,rgb(ink,.9),'left',W);
   o=rise(5);txt(c,'"'+(r.title||'')+'" — '+(r.author||'')+' · '+r.license,X0,y+o+48,'400 21px '+NAT_SANS,rgb(muted),'left',W);if(ph&&ph.e.ok)txt(c,ph.credit,X0,y+o+78,'400 21px '+NAT_SANS,rgb(muted),'left',W)}
  c.globalAlpha=1;const others=reelList().filter(x=>x!==id).slice(0,3).map(x=>(en?((wildMeta[x]||{}).en||nameOf(x)):nameOf(x)).replace(/[（(][^）)]*[）)]/g,'').trim());
  if(others.length){const yy=Math.min(Y1-56,y+136);c.fillStyle=rgb(acc);c.beginPath();c.arc(X0+7,yy-9,6,0,6.2832);c.fill();txt(c,L('ともに鳴く　','With　')+others.join('、'),X0+24,yy,'500 26px '+NAT_SANS,rgb(ink,.9),'left',W-24)}}
 else{txt(c,L('写真をタップして、音を重ねる','Tap a photo to layer sounds'),X0,y+120,'600 64px '+NAT_SERIF,rgb(ink),'left',W)}
 c.globalAlpha=1;txt(c,({all:L('すべての素材','All sources'),nosa:L('BY-SA を除く','No CC BY-SA'),cc0:L('CC0・PD のみ','CC0 / PD only')}[RIGHTS.mode])+L('　クレジットの全文は説明欄に','  Full credits in caption'),X0,Y1-14,'400 20px '+NAT_SANS,rgb(muted),'left',W);
 // 6. 粒子（ごく薄いフィルムの粒）
 c.save();c.globalAlpha=paper?.05:.06;c.globalCompositeOperation=paper?'multiply':'overlay';c.fillStyle=c.createPattern(popGrain(),'repeat');c.fillRect(0,0,REEL_W,REEL_H);c.restore()}
window.reelDrawStudio=(c,layout)=>{if(layout==='nature'){drawNature(c);return}if(layout==='pop'){drawPop(c);return}if(layout==='wave')drawRidge(c);else if(layout==='minimal')drawMinimal(c);else drawPanels(c)};
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

// ───────── 実録音の楽器層（v0.45）─────────
// 低音ドローン：ディジュリドゥ・パイプオルガンのペダル（持続音を切れ目なくつなぐ）、自然の低音（CC0 の波の録音の低域だけ）、
//              ティンパニのロール・ゴング・ピアノ最低音域（ときどき1回鳴らす）。音高のある楽器はいまの和音の根音へ ±6 半音以内で速度変換。
// 打撃・脈動：フレームドラム・カホン・ダルブッカ・スリットドラム・コンガを、短いフレーズ（1〜4打、BEAT FX のテンポの8分）で鳴らす。
// どれも VCSL（CC0）の実録音（build/import_vcsl_v045.py）。合成音で代用しない。出力はミキサーの「音楽」チャンネル。
// base：既存の層（低音ドローン・ハープ・ピアノ）と同じ音量感になるよう、ソロ試聴のピーク・RMS を測ってそろえた値
var REAL_DEF={didge:{mode:'loop',base:.3},organPedal:{mode:'loop',base:.27},natureLow:{mode:'loop',rec:'waves-big-lagoon',base:1.4},
 timpaniRoll:{mode:'event',base:.15},gong:{mode:'event',base:.15},pianoLow:{mode:'event',base:.17},
 frameDrum:{mode:'hit',base:.3},cajon:{mode:'hit',base:.26},darbuka:{mode:'hit',base:.32},slitDrum:{mode:'hit',base:.24},conga:{mode:'hit',base:.3},
 // v0.49 旋律（build/import_vcsl_v049.py）：いまの和音の音を range（midi）の中へオクターブで移し、1〜phrase 音の短いフレーズにする
 kalimba:{mode:'melody',base:.36,range:[69,86],phrase:3},marimba:{mode:'melody',base:.3,range:[62,93],phrase:4},
 tubularBells:{mode:'melody',base:.2,range:[60,77],phrase:1},glockenspiel:{mode:'melody',base:.16,range:[79,101],phrase:2}};
function isRealLayer(k){return !!(REAL_DEF&&REAL_DEF[k])}
function isRealLoop(k){return isRealLayer(k)&&REAL_DEF[k].mode==='loop'}
function realSamples(k){return instrumentSamples.filter(x=>x.kind===k)}
function realLevel(k){return auditionKey===k?Math.max(.55,p[k]/100):p[k]/100}
// 和音の根音に合わせる：候補の中から移調が最小のサンプルと速度
function realPick(k){const list=realSamples(k);if(!list.length)return null;if(!list[0].pitched)return {meta:list[Math.floor(Math.random()*list.length)],rate:1};
 const root=chords[chordIndex].root;let best=null;for(const m of list){const d0=((root-m.midi)%12+12)%12,d=d0>6?d0-12:d0;if(!best||Math.abs(d)<Math.abs(best.d))best={meta:m,d}}return {meta:best.meta,rate:2**(best.d/12)}}
const realVoices=new Set();
// v0.49 密度（重なり）：合成音・楽器（実録音）それぞれの倍率。本体の tick() が層ごとに __boostOf(key) を掛け、同時発音の上限は __boostCap() 倍
let synthBoost=1,instrBoost=1;
try{const b=JSON.parse(localStorage.getItem('saww.boost')||'{}');if(b.s>=.5&&b.s<=4)synthBoost=b.s;if(b.i>=.5&&b.i<=4)instrBoost=b.i}catch(e){}
function layerIsReal(k){return !!REAL_DEF[k]||k==='harp'||k==='vibes'}
function layerIsSynth(k){return !layerIsReal(k)&&['low','music','rhythm'].some(g=>groups[g].some(x=>x[0]===k))}
function boostCap(){return Math.min(2.2,Math.max(1,synthBoost,instrBoost))}
window.__boostOf=k=>layerIsReal(k)?instrBoost:layerIsSynth(k)?synthBoost:1;window.__boostCap=boostCap;
function realOut(k,pan){const out=G(0),pn=ctx.createStereoPanner?ctx.createStereoPanner():G(1),wet=G(.2);if(pn.pan)pn.pan.value=pan||0;out.connect(pn);pn.connect(mixLane('music'));pn.connect(wet);wet.connect(mixLane('music','wet'));return {out,nodes:[out,pn,wet]}}
function realPlay(k,meta,t,lvl,pan,rate){const b=instrumentBuffers.get(meta.id);if(!b)return false;
 if(realVoices.size>=12*boostCap()){const old=realVoices.values().next().value;try{old.env.gain.setTargetAtTime(0,ctx.currentTime,.03);old.src.stop(ctx.currentTime+.2)}catch(e){}realVoices.delete(old)}
 const d=REAL_DEF[k],{out,nodes}=realOut(k,pan),src=ctx.createBufferSource(),env=G(0),dur=b.duration/rate,amp=d.base*lvl*(instrumentGains.get(meta.id)||1);
 src.buffer=b;src.playbackRate.value=rate;src.connect(env);env.connect(out);out.gain.value=1;
 const fade=d.mode==='hit'?.05:Math.min(3,dur*.2);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(amp,t+(d.mode==='hit'?.003:.02));env.gain.setValueAtTime(amp,Math.max(t+.03,t+dur-fade));env.gain.linearRampToValueAtTime(0,t+dur);
 src.start(t);src.stop(t+dur+.05);const v={k,src,env};realVoices.add(v);src.onended=()=>{realVoices.delete(v);detach(src,env,...nodes)};instrumentUse.set(meta.id,performance.now());noteRecUse('instrument',meta.id);point(k);return true}
// 本体の trigger() から呼ばれる（打撃・ときどき鳴らす低音）。読み込み前なら読み込んでから鳴らす（1.5秒以内に間に合った時だけ）。
function realLayerHit(k,t,gesture){const d=REAL_DEF[k];if(!ctx||d.mode==='loop')return false;if(p[k]===0&&auditionKey!==k)return false;
 const lvl=realLevel(k),go=(when)=>{if(d.mode==='hit'){const beat=60/((typeof fx!=='undefined'&&fx.bpm)||84)/2,n=1+Math.floor(Math.random()*4);let at=when;
   for(let i=0;i<n;i++){const pk=realPick(k);if(pk&&!realPlay(k,pk.meta,at,lvl*(i===0?1:R(.45,.85)),R(-.35,.35),2**(R(-.25,.25)/12)))break;at+=beat*(Math.random()<.3?2:1)}}
  else if(d.mode==='melody'){const beat=60/((typeof fx!=='undefined'&&fx.bpm)||84)/2,n=1+Math.floor(Math.random()*d.phrase),pan=R(-.5,.5);let at=when;
   for(let i=0;i<n;i++){let m=69+12*Math.log2(randomPitch()/440);while(m<d.range[0])m+=12;while(m>d.range[1])m-=12;const meta=nearestSample(k,m);
    if(!realPlay(k,meta,at,lvl*(i===0?1:R(.55,.85)),pan+R(-.12,.12),2**((m-meta.midi)/12)))break;at+=beat*(Math.random()<.35?2:1)}}
  else{const pk=realPick(k);if(pk)realPlay(k,pk.meta,when,lvl,R(-.25,.25),pk.rate)}};
 const need=realSamples(k).filter(m=>!instrumentBuffers.has(m.id));
 if(!need.length){go(t);return true}
 Promise.all(need.map(m=>instrumentBuffer(m))).then(()=>{if(playing&&ctx.currentTime<t+1.5)go(Math.max(t,ctx.currentTime+.03))}).catch(e=>{$('message').textContent='楽器の読み込みに失敗しました: '+e.message});return true}
// 持続音（ディジュリドゥ・オルガンのペダル・自然の低音）。本体の tick() から100ミリ秒ごとに呼ばれる。
const realLoops=new Map();
function realLoopTick(){if(!ctx)return;const t=ctx.currentTime;for(const [k,d] of Object.entries(REAL_DEF)){if(d.mode!=='loop')continue;
 const want=playing&&(auditionKey?auditionKey===k:p[k]>0)&&(!d.rec||rightsAllowed(d.rec));let v=realLoops.get(k);
 if(want&&!v)v=realLoopStart(k);else if(!want&&v){realLoopStop(k);v=null}
 if(v)v.out.gain.setTargetAtTime(realLevel(k)*d.base,t,.8)}}
function realLoopStart(k){const d=REAL_DEF[k],{out,nodes}=realOut(k,0),v={k,out,nodes,srcs:new Set(),timer:0,alive:true,head:out};
 if(d.rec){const lp=ctx.createBiquadFilter(),lp2=ctx.createBiquadFilter(),hp=ctx.createBiquadFilter();lp.type=lp2.type='lowpass';lp.frequency.value=lp2.frequency.value=170;lp.Q.value=lp2.Q.value=.6;hp.type='highpass';hp.frequency.value=26;hp.Q.value=.7;
  lp.connect(lp2);lp2.connect(hp);hp.connect(out);v.head=lp;v.nodes.push(lp,lp2,hp)}
 realLoops.set(k,v);
 const load=d.rec?loadOne(d.rec).then(b=>{v.recBuf=b}):Promise.all(realSamples(k).map(m=>instrumentBuffer(m)));
 load.then(()=>{if(v.alive)realSpawn(v,ctx.currentTime+.05,true)}).catch(e=>{realLoops.delete(k);$('message').textContent='楽器の読み込みに失敗しました: '+e.message});return v}
function realSpawn(v,t,first){if(!v.alive||!ctx)return;const d=REAL_DEF[v.k];let b,gain,rate=1,id;
 if(d.rec){b=v.recBuf;gain=bufferGains.get(d.rec)??1;id=d.rec;if(!b)return}else{const pk=realPick(v.k);b=pk&&instrumentBuffers.get(pk.meta.id);if(!b)return;gain=instrumentGains.get(pk.meta.id)||1;rate=pk.rate;id=pk.meta.id}
 const D=b.duration,a=d.rec?0:Math.min(1,D*.1),e=d.rec?D:D-Math.min(1.5,D*.12),len=e-a,real=len/rate,fade=Math.min(2.5,real/4);
 const src=ctx.createBufferSource(),env=G(0);src.buffer=b;src.playbackRate.value=rate;src.connect(env);env.connect(v.head);
 env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(gain,t+(first?1.2:fade));env.gain.setValueAtTime(gain,Math.max(t+fade+.01,t+real-fade));env.gain.linearRampToValueAtTime(0,t+real);
 src.start(t,a,len);src.stop(t+real+.05);const n={src,env};v.srcs.add(n);src.onended=()=>{v.srcs.delete(n);detach(src,env)};
 if(d.rec)noteRecUse('recording',id);else{noteRecUse('instrument',id);instrumentUse.set(id,performance.now())}
 const next=t+real-fade;v.timer=setTimeout(()=>realSpawn(v,next,false),Math.max(0,(next-ctx.currentTime-.5)*1000))}
function realLoopStop(k){const v=realLoops.get(k);if(!v)return;realLoops.delete(k);v.alive=false;clearTimeout(v.timer);if(!ctx)return;const t=ctx.currentTime;
 v.out.gain.cancelScheduledValues(t);v.out.gain.setTargetAtTime(0,t,.35);for(const n of v.srcs)try{n.src.stop(t+2.5)}catch(e){}setTimeout(()=>detach(...v.nodes),3000)}
function realLoopStopAll(){for(const k of [...realLoops.keys()])realLoopStop(k);for(const v of realVoices)try{v.src.stop()}catch(e){}realVoices.clear()}
function realSeed(fn){for(const [k,v] of realLoops){const d=REAL_DEF[k];if(d.rec)fn('recording',d.rec);else for(const m of realSamples(k))if(instrumentBuffers.has(m.id))fn('instrument',m.id)}}
// 本体（別の即時関数）から呼ぶ入口
window.__real={is:isRealLayer,isLoop:isRealLoop,hit:realLayerHit,tick:realLoopTick,stopAll:realLoopStopAll};
window.__realDebug={def:REAL_DEF,loops:()=>[...realLoops.keys()],voices:()=>[...realVoices].map(v=>v.k),hit:(k,t)=>realLayerHit(k,t??ctx.currentTime+.05),pick:realPick,samples:k=>realSamples(k).map(m=>m.id),stopAll:realLoopStopAll};

// ───────── 本体との接続 ─────────
window.studioActive=()=>playingIds().length>0;
window.studioSeed=fn=>{realSeed(fn);for(const id of playingIds())noteTile(id,fn);for(const v of trk.voices)noteTile(v.t.src,fn)};
window.studioNow=()=>playingIds().filter(id=>!userSounds.has(id));
window.__studioDebug={tiles:()=>tileIds().length,shown:()=>document.querySelectorAll('#tileGrid .tile').length,photos:()=>[...document.querySelectorAll('#tileGrid .tile img')].length,playing:playingIds,start:tileStart,stop:tileStop,toggle:tileToggle,stopAll:tileStopAll,photoFor,binomial,
 state:id=>{const s=tileState.get(id);return s?{vol:s.vol,pan:s.pan,loop:s.loop,on:!!s.voice}:null},isOn,isSounding,member,engineKind,setMember,setSoundVol,setSoundRest,removeSound,restOf:id=>tst(id).rest,setTab,dockPanel:v=>{dockPanelOpen=!!v;renderDockPanel(true);return [...document.querySelectorAll('#dockPanelList .dpRow')].map(r=>r.dataset.id)},natPal:id=>{const ph=subjectPhoto(id);return natPalette(ph&&ph.e,groupOf(id))},fieldLevel:id=>fieldConfig.levels[id]||0,stopEverything,dock:()=>({hidden:$('dock').hidden,text:$('dockText').textContent}),setVol:setTileVol,setLoop:(id,v)=>{tst(id).loop=!!v},open:openSheet,close:closeSheet,filter:f=>{tileFilter=f;renderFilters();buildTiles()},showAll:v=>{tileShowAll=!!v;buildTiles();return document.querySelectorAll('#tileGrid .tile').length},
 addUser:(name,buffer,origin)=>{const id=addUserSound(name,buffer,origin||'import');buildTiles();renderTrackSources();return id},importFiles,parseAiff,users:()=>[...userSounds.keys()],
 tracks:()=>tracks.map(t=>({id:t.id,src:t.src,offset:t.offset,vol:t.vol,mute:t.mute,solo:t.solo,dest:t.dest,len:t.buffer?t.buffer.duration:null})),addTrack,trkPlay,trkStop,trkRecord,trkRecStop,trkMixdown,trk:()=>({playing:trk.playing,rec:trk.rec?trk.rec.kind:null,voices:trk.voices.size,len:trackLen()}),encodeWav24,encodeAiff24,
 setTemplate,template:()=>reelTpl,imgMode:v=>{if(v)reelImgMode=v;return reelImgMode},subject:reelSubject,photosUsed:()=>reelState&&reelState.photos?[...reelState.photos.keys()]:[],imgCache:()=>[...imgCache].map(([u,e])=>({u,ok:e.ok,fail:e.fail})),analyse:()=>{analyse();return {peakHz:A.peakHz,rmsDb:A.rmsDb,onsets:A.onsets}},
 entitlement:()=>window.sawwEntitlement,tiers:()=>TIERS};
// ───────── v0.49 楽器（実録音）と合成音（シンセ）の整理 ─────────
// オーナー要望（2026-11-06 20:05「楽器は全部楽器でまとめる。合成音も必要」）。本体が作ったつまみの行（.control）を移すだけで、値・保存・MIDI 割り当ては変わらない。
// 振り分けは自動：本体の groups の low / music / rhythm のうち、実録音（REAL_DEF・ハープ・ヴィブラフォン）は「楽器」、それ以外は「合成音」。
// 毎日の自動作業で楽器を足すときは groups の該当する群（低音＝low・旋律＝music・打楽器＝rhythm）と REAL_DEF に足せば、ここで正しい欄に入る。
const LAYER_SECS=[['low','低音','持続音'],['music','旋律','旋律'],['rhythm','打楽器','打撃']];
const shortLabel=s=>s.replace(/（実録音）|（合成）|^実録音/g,'').replace('（波の実録音・低域）','（波・低域）');
function boostRow(id,label,val,set){const row=document.createElement('div');row.className='control boostRow';
 row.innerHTML=`<div><label for="${id}">${label}</label><input type="range" id="${id}" min="50" max="400" step="10" value="${Math.round(val*100)}"></div><span class="value" id="${id}V">${Math.round(val*100)}%</span>`;
 const inp=row.querySelector('input');inp.addEventListener('input',()=>{const v=Number(inp.value)/100;set(v);$(id+'V').textContent=inp.value+'%';try{localStorage.setItem('saww.boost',JSON.stringify({s:synthBoost,i:instrBoost}))}catch(e){}});
 inp.addEventListener('dblclick',()=>{inp.value=100;inp.dispatchEvent(new Event('input'))});return row}
function layerSub(title,keys){const box=document.createElement('div');box.className='layerSub';box.dataset.n=keys.length;
 box.innerHTML=`<div class="layerSubHead"><span class="layerSubTitle">${title}</span><span class="micro">${keys.length}</span></div>`;
 for(const k of keys){const row=$('param-'+k)?.closest('.control');if(!row)continue;const lab=row.querySelector('label');if(lab)lab.textContent=shortLabel(lab.textContent);row.dataset.layer=k;box.append(row)}return box}
function organizeLayers(){const sp=$('synthPanel');if(!sp||$('instrPanel'))return;
 const keysOf=(g,real)=>groups[g].map(x=>x[0]).filter(k=>layerIsReal(k)===real);
 const ip=document.createElement('details');ip.id='instrPanel';ip.className='sub';
 const nI=LAYER_SECS.reduce((n,[g])=>n+keysOf(g,true).length,0),nS=LAYER_SECS.reduce((n,[g])=>n+keysOf(g,false).length,0);
 ip.innerHTML=`<summary><span>楽器（実録音）</span><span class="micro"><span id="instrCount">${nI}</span> · <span>低音 · 旋律 · 打楽器 ▾</span></span></summary><div class="layerBody" id="instrBody"></div>`;
 sp.before(ip);const ib=ip.querySelector('#instrBody');
 ib.append(boostRow('instrBoost','楽器の密度・重なり',instrBoost,v=>{instrBoost=v}));
 for(const [g,ja] of LAYER_SECS){const ks=keysOf(g,true);if(ks.length)ib.append(layerSub(ja,ks))}
 // 合成音：題名と小見出しを付け直し、つまみ（合成音の密度）を先頭に
 const sum=sp.querySelector(':scope>summary');if(sum)sum.innerHTML=`<span>合成音（シンセ）</span><span class="micro"><span id="synthCount">${nS}</span> · <span>持続音 · 旋律 · 打撃 · 試聴 ▾</span></span>`;
 const blk=sp.querySelector(':scope>.synthBlock');
 const sb=document.createElement('div');sb.className='layerBody';sb.id='synthBody';sb.append(boostRow('synthBoost','合成音の密度・重なり',synthBoost,v=>{synthBoost=v}));
 for(const [g,,ja] of LAYER_SECS){const ks=keysOf(g,false);if(ks.length)sb.append(layerSub(ja,ks))}
 (blk||sum).after(sb);
 // 元の小見出し（DRONES など。中身は上へ移した）は畳んで隠す。試聴の欄は残す
 for(const g of ['low','music','rhythm']){const d=$(g+'Controls')?.closest('details');if(d&&d!==sp)d.hidden=true}
 // 全体の音量・響き（MASTER ENVIRONMENT）は「全体の音量・活動量・同時発音数」へ移す（合成音だけでなく全部に効くため）
 const mixAll=[...document.querySelectorAll('#performance details.sub>summary')].find(s=>s.textContent.trim().startsWith('全体の音量'));
 if(blk&&mixAll){const t=blk.querySelector('.title');if(t)t.textContent='全体の音・響き・変化';const m=blk.querySelector('.between .micro');if(m)m.textContent='';blk.classList.add('masterBlock');mixAll.parentElement.append(blk)}}
function init(){organizeLayers();renderFilters();buildTiles();bindSheet();buildMasterEq();renderTracks();renderTrackSources();buildPlans();bindReel();
 $('tileStopAll').addEventListener('click',stopEverything);
 $('dockList')?.addEventListener('click',()=>{dockPanelOpen=!dockPanelOpen;renderDockPanel(true)});$('dockPanelClose')?.addEventListener('click',()=>{dockPanelOpen=false;renderDockPanel()});
 $('tabCreatures')?.addEventListener('click',()=>setTab('creatures'));$('tabAmbience')?.addEventListener('click',()=>setTab('ambience'));$('tileAddUser').addEventListener('click',()=>$('tileUserFile').click());$('tileUserFile').addEventListener('change',e=>{const fs=[...(e.target.files||[])];e.target.value='';importFiles(fs)});
 $('trkPlay').addEventListener('click',()=>trk.playing?trkStop():trkPlay());$('trkLoop').addEventListener('change',e=>{trk.loop=e.target.checked});$('trkMic').addEventListener('click',()=>trkRecord('mic'));$('trkBounce').addEventListener('click',()=>trkRecord('bounce'));
 $('trkAdd').addEventListener('click',()=>{const v=$('trkAddSrc').value;if(v)addTrack(v)});$('trkWav').addEventListener('click',()=>trkMixdown('wav').catch(e=>trkStatus(e.message)));$('trkAiff').addEventListener('click',()=>trkMixdown('aiff').catch(e=>trkStatus(e.message)));
 {const lg=document.querySelector('img.brandLogo');if(lg&&lg.src)canvasImage(lg.src)} // リールの見出しのロゴを先に読み込む
 setTemplate('nature');natFonts();
 // 言語を切り替えたら、自分で組み立てた文言（L()）を作り直す
 $('langToggle')?.addEventListener('click',()=>setTimeout(()=>{renderFilters();buildTiles();renderTracks();buildPlans();if(sheetId)renderSheet()},0))}
init();
})();
