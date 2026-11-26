// v0.89 アカウントのライブラリ（☁）— プリセット（SEMI-PRO・PRO）とルーパーのループ（PRO）を課金のアカウントに保存し、ほかの端末でも使う。
// 課金サーバーの /library（server/library.mjs）。サーバーが対応していない間・課金していない人には、欄を出さない（一覧が取れた時だけ出す）。
(()=>{'use strict';
const api=p=>BILL.apiBase.replace(/\/$/,'')+p,tok=()=>{try{return localStorage.getItem(PRO_KEY)||''}catch(e){return ''}},$=id=>document.getElementById(id);
const b64u=s=>{const b=new TextEncoder().encode(s);let t='';for(const x of b)t+=String.fromCharCode(x);return btoa(t).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64u=s=>{const t=atob(String(s).replace(/-/g,'+').replace(/_/g,'/'));const b=new Uint8Array(t.length);for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i);return new TextDecoder().decode(b)};
let lib=null;const H=()=>({Authorization:'Bearer '+tok()});
const ERR={plan:'ご契約中の方だけが保存できます。',plan_pro:'ループの保存は PRO だけです。',limit:'保存できる数の上限です。古いものを消してください。',quota:'ループの保存容量（80MB）を超えます。古いものを消してください。',size:'大きすぎて保存できません。'};
const msg=(id,...t)=>{const m=$(id);if(m){m.textContent='';for(const x of t)m.append(document.createTextNode(x))}};
const el=(t,cls,txt)=>{const n=document.createElement(t);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
const pad=n=>String(n).padStart(2,'0'),stamp=()=>{const d=new Date();return pad(d.getMonth()+1)+'/'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function show(on){for(const id of ['cloudPresets','cloudLoops']){const b=$(id);if(b)b.hidden=!on}for(const b of document.querySelectorAll('.lpCloud'))b.hidden=!on}
async function refresh(){if(!BILL.apiBase||!tok()){lib=null;show(false);return null}
 try{const r=await fetch(api('/library'),{headers:H()});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok){lib=null;show(false);return null}lib=j;show(true);render();return j}catch(e){lib=null;show(false);return null}}
function render(){if(!lib)return;const pl=$('cloudPresetList'),ll=$('cloudLoopList');
 if(pl){pl.textContent='';if(!lib.presets.length)pl.append(el('p','micro','まだありません。'));for(const p of lib.presets){const row=el('div','cloudRow');row.append(el('span','cloudName',p.name));const ld=el('button',null,'読み込む');ld.type='button';ld.onclick=()=>loadPreset(p.id);row.append(ld,delBtn(()=>delItem('preset',p.id)));pl.append(row)}}
 if(ll){ll.textContent='';if(!lib.loops.length)ll.append(el('p','micro','まだありません。'));for(const p of lib.loops){const row=el('div','cloudRow');row.append(el('span','cloudName',p.name),el('span','micro',(p.len/p.sr).toFixed(1)+' s'));const ld=el('button',null,'読み込む');ld.type='button';ld.onclick=()=>loadLoop(p.id);row.append(ld,delBtn(()=>delItem('loop',p.id)));ll.append(row)}
  const used=el('p','micro');used.dataset.i18nSkip='';used.textContent=(lib.used.loopBytes/1048576).toFixed(1)+' / '+Math.round(lib.limits.totalLoopBytes/1048576)+' MB · '+lib.loops.length+' / '+lib.limits.loops;ll.append(used)}}
function delBtn(fn){const b=el('button','cloudDel','削除');b.type='button';b.onclick=()=>{if(b.dataset.sure)fn();else{b.dataset.sure='1';b.textContent='本当に削除';setTimeout(()=>{if(b.isConnected){delete b.dataset.sure;b.textContent='削除'}},4000)}};return b}
async function delItem(kind,id){try{await fetch(api('/library/'+kind+'/'+id),{method:'DELETE',headers:H()})}catch(e){}await refresh()}
async function savePreset(){const name=($('cloudPresetName').value||'').trim()||'PRESET '+stamp();msg('cloudPresetMsg','保存しています…');
 try{const d=window.__audioEcosystemDebug.exportData();const r=await fetch(api('/library/preset/'+newId()),{method:'PUT',headers:{...H(),'Content-Type':'application/json'},body:JSON.stringify({name,data:d})});const j=await r.json().catch(()=>({}));
  if(r.ok&&j.ok){msg('cloudPresetMsg','アカウントに保存しました。ほかの端末でも読み込めます。');$('cloudPresetName').value='';await refresh()}else msg('cloudPresetMsg',ERR[j.error]||'保存できませんでした。')}catch(e){msg('cloudPresetMsg','保存できませんでした。電波を確かめてください。')}}
async function loadPreset(id){msg('cloudPresetMsg','読み込んでいます…');try{const r=await fetch(api('/library/preset/'+id),{headers:H()});const j=await r.json();if(!r.ok||!j.ok)throw 0;const notes=window.__audioEcosystemDebug.applyData(j.data);msg('cloudPresetMsg','読み込みました。');try{presetMessage(['読み込みました。',...(notes||[])])}catch(e){}}catch(e){msg('cloudPresetMsg','読み込めませんでした。')}}
async function saveLoop(i){const L=window.__looper,p=L&&L.pcm(i);if(!p)return;const n=p.l.length,pcm=new Int16Array(n*2);for(let j=0;j<n;j++){const a=Math.max(-1,Math.min(1,p.l[j])),b=Math.max(-1,Math.min(1,p.r[j]));pcm[2*j]=a<0?a*32768:a*32767;pcm[2*j+1]=b<0?b*32768:b*32767}
 msg('cloudLoopMsg','アカウントに保存しています…');try{const r=await fetch(api('/library/loop/'+newId()),{method:'PUT',headers:{...H(),'Content-Type':'application/octet-stream','X-Saww-Meta':b64u(JSON.stringify({name:'LOOP '+stamp()+' · CH'+(i+1),sr:p.sr,len:n}))},body:pcm.buffer});const j=await r.json().catch(()=>({}));
  if(r.ok&&j.ok){msg('cloudLoopMsg','アカウントに保存しました。ほかの端末でも読み込めます。');await refresh()}else msg('cloudLoopMsg',ERR[j.error]||'保存できませんでした。')}catch(e){msg('cloudLoopMsg','保存できませんでした。電波を確かめてください。')}}
async function loadLoop(id){const L=window.__looper;if(!L)return;let i=L.firstEmpty();if(i<0)i=5;msg('cloudLoopMsg','読み込んでいます…');
 try{const r=await fetch(api('/library/loop/'+id),{headers:H()});if(!r.ok)throw 0;const m=JSON.parse(unb64u(r.headers.get('X-Saww-Meta')||''));const pcm=new Int16Array(await r.arrayBuffer()),n=pcm.length/2,l=new Float32Array(n),rr=new Float32Array(n);for(let j=0;j<n;j++){l[j]=pcm[2*j]/32768;rr[j]=pcm[2*j+1]/32768}
  if(await L.loadPCM(i,l,rr,m.sr))msg('cloudLoopMsg','CH'+(i+1)+' · ','読み込みました。');}catch(e){msg('cloudLoopMsg','読み込めませんでした。')}}
function wire(){const b=$('cloudPresetSave');if(b&&!b.dataset.w){b.dataset.w='1';b.onclick=savePreset}for(const id of ['presetSection','samplerSection']){const d=$(id);if(d&&!d.dataset.cloudW){d.dataset.cloudW='1';d.addEventListener('toggle',()=>{if(d.open)refresh()})}}}
document.addEventListener('saww:lang',()=>setTimeout(render,0));
const boot=()=>{wire();refresh();setTimeout(refresh,2500)};if(document.readyState==='complete')setTimeout(boot,0);else window.addEventListener('load',()=>setTimeout(boot,0));
window.__cloud={refresh,savePreset,loadPreset,saveLoop,loadLoop,state:()=>lib};
})();
