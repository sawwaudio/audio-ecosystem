/* v0.88 6ch ルーパー（サンプラーと同じ欄。2026-11-26 オーナー「6chルーパーに音保存出来るようにする / これはエフェクター類と区別して、サンプラーとルーパーを一緒にする」）
   ・録る音：いま聞こえている音（ペダルを通った後・リミッターの後）。ただしルーパー自身の音は入れない（重ねても二重にならない）。
     録る場所は master._limTrim（リミッターの後）。ルーパーの音は master._output に直接足す（安全のためのコンプを通す）。録音の書き出し・リールにはルーパーの音も入る。
   ・1ch の操作：● 録る（空→録音、もう一度で確定してループ開始）／重ねる（再生中に押すと重ね録り、もう一度で確定）、▶/■、↶ ひとつ戻す、× 消す、速さ ½・1・2、⇄ 逆再生、音量。
   ・保存：この端末の IndexedDB（'saww-looper'）。名前・長さ・サンプルレート・左右の波形。読み込み・削除（2回押しで確定）。WAV の書き出しは書き出しの権限（exportGate 'audio'）に従う。
   ・1本は最大60秒。 */
(()=>{'use strict';
const N=6,MAXS=60,$=id=>document.getElementById(id);
const chs=[...Array(N)].map((_,i)=>({i,buf:null,rbuf:null,vol:.9,speed:1,rev:false,state:'empty',src:null,g:null,t0:0,off0:0,undo:null}));
let bus=null,cap=null,capWait=null,capJob=null;const ctxOk=()=>{try{return typeof ctx!=='undefined'&&ctx&&master&&master._limTrim?ctx:null}catch(e){return null}};
async function ensure(){if(bus)return true;const c=ctxOk();if(!c)return false;await window.__pedals.ready(c);if(bus)return true;
 const comp=c.createDynamicsCompressor();comp.threshold.value=-4;comp.ratio.value=10;comp.attack.value=.003;comp.release.value=.15;bus=c.createGain();bus.connect(comp);comp.connect(master._output);
 cap=new AudioWorkletNode(c,'saww-cap',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});const mute=c.createGain();mute.gain.value=0;master._limTrim.connect(cap);cap.connect(mute);mute.connect(c.destination);
 cap.port.onmessage=e=>{const d=e.data||{};if(d.l&&capJob)capJob.parts.push(d);if(d.done&&capWait){const w=capWait;capWait=null;w()}};
 for(const ch of chs){ch.g=c.createGain();ch.g.gain.value=ch.vol;ch.g.connect(bus)}return true}
const len=ch=>ch.buf?ch.buf.duration:0;
// 自律演奏を止めていても、ルーパーは鳴らし続ける（pause() はルーパーが動いている間は ctx を止めない）
const active=()=>chs.some(c=>c.state==='play'||c.state==='rec'||c.state==='dub');
function wake(){const c=ctxOk();if(!c)return;try{if(c.state!=='running')c.resume()}catch(e){}const g=master._output.gain;if(g.value<.5){g.cancelScheduledValues(c.currentTime);g.setTargetAtTime(1,c.currentTime,.02)}}
function phase(ch){if(!ch.src)return ch.off0||0;const c=ctxOk(),L=len(ch);let p=(ch.off0+(c.currentTime-ch.t0)*ch.speed)%L;if(p<0)p+=L;return ch.rev?L-p:p} // 正方向の位置（秒）
function stopSrc(ch){if(ch.src){const s=ch.src;ch.off0=phase(ch);ch.src=null;try{s.stop()}catch(e){}try{s.disconnect()}catch(e){}}}
function startSrc(ch,fwd){const c=ctxOk();if(!c||!ch.buf)return;stopSrc(ch);const L=len(ch);fwd=((fwd%L)+L)%L;const b=ch.rev?(ch.rbuf||(ch.rbuf=reversed(c,ch.buf))):ch.buf,off=ch.rev?L-fwd:fwd;
 const s=c.createBufferSource();s.buffer=b;s.loop=true;s.playbackRate.value=ch.speed;s.connect(ch.g);s.start(c.currentTime+.005,Math.min(off,L-1e-4));ch.src=s;ch.t0=c.currentTime+.005;ch.off0=off}
function reversed(c,b){const r=c.createBuffer(b.numberOfChannels,b.length,b.sampleRate);for(let k=0;k<b.numberOfChannels;k++){const a=b.getChannelData(k),d=r.getChannelData(k);for(let i=0,n=a.length;i<n;i++)d[i]=a[n-1-i]}return r}
function capStart(kind,ch){capJob={kind,ch,parts:[],fwd0:kind==='dub'?phase(ch):0};cap.port.postMessage({on:true})}
function capStop(){return new Promise(res=>{const job=capJob;capWait=()=>{capJob=null;res(job)};cap.port.postMessage({on:false});setTimeout(()=>{if(capWait){const w=capWait;capWait=null;w()}},400)})}
function joinParts(parts,maxFrames){let n=0;for(const p of parts)n+=p.l.length;n=Math.min(n,maxFrames);const l=new Float32Array(n),r=new Float32Array(n);let o=0;for(const p of parts){if(o>=n)break;const k=Math.min(p.l.length,n-o);l.set(p.l.subarray(0,k),o);r.set(p.r.subarray(0,k),o);o+=k}return {l,r,n}}
async function rec(i){const ch=chs[i];if(!(await ensure())){say('先に ▶ 自律演奏を始めてください（いま鳴っている音を録ります）。');return}const c=ctxOk();wake();
 if(capJob&&capJob.ch!==ch){say('ほかのチャンネルが録音中です。');return}
 if(ch.state==='empty'){capStart('new',ch);ch.state='rec'}
 else if(ch.state==='rec'){const job=await capStop();const {l,r,n}=joinParts(job.parts,MAXS*c.sampleRate);if(n<c.sampleRate*.1){ch.state='empty';say('短すぎるので録り直してください。');render();return}
  const b=c.createBuffer(2,n,c.sampleRate);b.copyToChannel(l,0);b.copyToChannel(r,1);ch.buf=b;ch.rbuf=null;ch.undo=null;ch.state='play';startSrc(ch,0)}
 else if(ch.state==='play'||ch.state==='stop'){if(ch.state==='stop')startSrc(ch,ch.off0||0);capStart('dub',ch);ch.state='dub'}
 else if(ch.state==='dub'){const job=await capStop();const {l,r,n}=joinParts(job.parts,MAXS*4*c.sampleRate);const old=ch.buf,L=old.length,b=c.createBuffer(2,L,old.sampleRate);
  const ol=old.getChannelData(0),or=old.getChannelData(1),nl=b.getChannelData(0),nr=b.getChannelData(1);nl.set(ol);nr.set(or);let at=Math.floor(job.fwd0*old.sampleRate);
  // 重ねた音は、押した時のループの位置から足していく（逆再生・速さを変えている時は、聞こえた位置に合わせて足す）
  const step=ch.rev?-ch.speed:ch.speed;for(let j=0;j<n;j++){const p=((Math.floor(at+j*step)%L)+L)%L;nl[p]+=l[j];nr[p]+=r[j]}
  const fwd=phase(ch);ch.undo=old;ch.buf=b;ch.rbuf=null;ch.state='play';startSrc(ch,fwd)}
 render()}
function play(i){const ch=chs[i];if(!ch.buf)return;wake();if(ch.state==='play'||ch.state==='dub'){if(ch.state==='dub'){rec(i);return}stopSrc(ch);ch.state='stop'}else{startSrc(ch,ch.off0||0);ch.state='play'}render()}
function undo(i){const ch=chs[i];if(!ch.undo||capJob)return;const fwd=phase(ch),was=ch.state;[ch.buf,ch.undo]=[ch.undo,ch.buf];ch.rbuf=null;if(was==='play')startSrc(ch,fwd);render()}
function clear(i){const ch=chs[i];if(capJob&&capJob.ch===ch){cap.port.postMessage({on:false});capJob=null}stopSrc(ch);ch.buf=ch.rbuf=ch.undo=null;ch.off0=0;ch.state='empty';render()}
function setSpeed(i,s){const ch=chs[i];const fwd=phase(ch);ch.speed=s;if(ch.src)startSrc(ch,fwd);render()}
function setRev(i){const ch=chs[i];const fwd=phase(ch);ch.rev=!ch.rev;if(ch.src)startSrc(ch,fwd);render()}
function setVol(i,v){const ch=chs[i];ch.vol=Math.max(0,Math.min(1.5,v));const c=ctxOk();if(ch.g&&c)ch.g.gain.setTargetAtTime(ch.vol,c.currentTime,.02);render()}
// ── 保存（IndexedDB） ──
let dbp=null;const db=()=>dbp||(dbp=new Promise((res,rej)=>{const q=indexedDB.open('saww-looper',1);q.onupgradeneeded=()=>q.result.createObjectStore('loops',{keyPath:'id'});q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}));
const tx=async(mode,fn)=>{const d=await db();return new Promise((res,rej)=>{const t=d.transaction('loops',mode),s=t.objectStore('loops'),r=fn(s);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error)})};
const pad=n=>String(n).padStart(2,'0');
async function save(i){const ch=chs[i];if(!ch.buf)return;const d=new Date(),name='LOOP '+pad(d.getMonth()+1)+'/'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+' · CH'+(i+1);
 try{await tx('readwrite',s=>s.put({id:'L'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,created:d.toISOString(),sr:ch.buf.sampleRate,len:ch.buf.length,l:ch.buf.getChannelData(0).slice(0),r:ch.buf.getChannelData(1).slice(0)}));say('この端末に保存しました。');await list()}catch(e){say('保存できませんでした（端末の空き容量を確かめてください）。')}}
async function loadInto(id,i){if(!(await ensure())){say('先に ▶ 自律演奏を始めてください。');return}const c=ctxOk();wake();try{const rec=await tx('readonly',s=>s.get(id));if(!rec)return;const ch=chs[i];clear(i);const b=c.createBuffer(2,rec.len,rec.sr);b.copyToChannel(rec.l,0);b.copyToChannel(rec.r,1);ch.buf=b;ch.state='play';startSrc(ch,0);render()}catch(e){say('読み込めませんでした。')}}
async function del(id){try{await tx('readwrite',s=>s.delete(id));await list()}catch(e){}}
let saved=[];async function list(){try{saved=(await tx('readonly',s=>s.getAll()))||[];saved.sort((a,b)=>b.created<a.created?-1:1)}catch(e){saved=[]}renderLib();return saved.map(x=>({id:x.id,name:x.name,sec:+(x.len/x.sr).toFixed(2)}))}
async function wav(i){const ch=chs[i];if(!ch.buf)return;if(window.exportGate&&!(await window.exportGate('audio',say)))return;const b=ch.buf,n=b.length,l=b.getChannelData(0),r=b.getChannelData(1),inter=new Float32Array(n*2);for(let j=0;j<n;j++){inter[2*j]=l[j];inter[2*j+1]=r[j]}
 const blob=encodeWav([inter],n,b.sampleRate),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='saww-loop-ch'+(i+1)+'.wav';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
// ── 画面 ──
const say=t=>{const m=$('lpMsg');if(m)m.textContent=t};
const el=(t,cls,txt)=>{const n=document.createElement(t);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
const STATE={empty:'空',rec:'録音中',play:'再生中',stop:'止めた',dub:'重ね録り中'};
function build(){const box=$('lpChannels');if(!box||box.dataset.built)return;box.dataset.built='1';
 chs.forEach(ch=>{const i=ch.i,card=el('div','lpCh');card.dataset.ch=String(i);
  const head=el('div','lpHead');head.append(el('strong','lpNum','CH'+(i+1)),el('span','micro lpState'),el('span','micro lpLen'));card.append(head);
  const bar=el('div','lpBar');bar.append(el('span','lpFill'));card.append(bar);
  const row=el('div','lpRow');const mk=(cls,txt,fn,lab)=>{const b=el('button',cls,txt);b.type='button';if(lab)b.setAttribute('aria-label',lab);b.onclick=fn;row.append(b);return b};
  mk('lpRec','●',()=>rec(i),'録る・重ねる');mk('lpPlay','▶',()=>play(i),'再生・止める');mk('lpUndo','↶',()=>undo(i),'ひとつ戻す');mk('lpClear','×',()=>clear(i),'消す');card.append(row);
  const row2=el('div','lpRow');for(const s of [.5,1,2]){const b=el('button','lpSpd',s===.5?'½':String(s));b.type='button';b.dataset.s=String(s);b.setAttribute('aria-label',(s===.5?'½':s)+'×');b.onclick=()=>setSpeed(i,s);row2.append(b)}
  const rv=el('button','lpRev','⇄');rv.type='button';rv.setAttribute('aria-label','逆再生');rv.onclick=()=>setRev(i);row2.append(rv);
  const vol=el('input','lpVol');vol.type='range';vol.min='0';vol.max='150';vol.value=String(Math.round(ch.vol*100));vol.setAttribute('aria-label','音量');vol.oninput=()=>setVol(i,+vol.value/100);row2.append(vol);card.append(row2);
  const sv=el('button','lpSave','保存');sv.type='button';sv.onclick=()=>save(i);const wv=el('button','lpWav','WAV');wv.type='button';wv.setAttribute('aria-label','WAV で書き出す');wv.onclick=()=>wav(i);row.append(sv,wv);
  box.append(card)});
 render();list();tick()}
function render(){for(const ch of chs){const card=document.querySelector('.lpCh[data-ch="'+ch.i+'"]');if(!card)continue;card.dataset.state=ch.state;card.querySelector('.lpState').textContent=STATE[ch.state];card.querySelector('.lpLen').textContent=ch.buf?len(ch).toFixed(1)+' s':'';
  const has=!!ch.buf;card.querySelector('.lpPlay').disabled=!has;card.querySelector('.lpUndo').disabled=!ch.undo||ch.state==='dub';card.querySelector('.lpClear').disabled=ch.state==='empty';card.querySelector('.lpSave').disabled=!has;card.querySelector('.lpWav').disabled=!has;
  card.querySelector('.lpRec').setAttribute('aria-pressed',String(ch.state==='rec'||ch.state==='dub'));card.querySelector('.lpPlay').textContent=ch.state==='play'||ch.state==='dub'?'■':'▶';
  for(const b of card.querySelectorAll('.lpSpd'))b.setAttribute('aria-pressed',String(+b.dataset.s===ch.speed));card.querySelector('.lpRev').setAttribute('aria-pressed',String(ch.rev))}}
function tick(){for(const ch of chs){const f=document.querySelector('.lpCh[data-ch="'+ch.i+'"] .lpFill');if(f)f.style.width=(ch.src&&len(ch)?Math.min(100,phase(ch)/len(ch)*100):0)+'%'}requestAnimationFrame(tick)}
function renderLib(){const box=$('lpLib');if(!box)return;box.textContent='';if(!saved.length){box.append(el('p','micro','保存したループはまだありません。'));return}
 for(const s of saved){const row=el('div','lpLibRow');row.append(el('span','lpLibName',s.name),el('span','micro',(s.len/s.sr).toFixed(1)+' s'));const sel=el('select','lpLibCh');sel.setAttribute('aria-label','読み込むチャンネル');for(let i=0;i<N;i++){const o=document.createElement('option');o.value=String(i);o.textContent='CH'+(i+1);sel.append(o)}const firstEmpty=chs.findIndex(c=>c.state==='empty');if(firstEmpty>=0)sel.value=String(firstEmpty);
  const ld=el('button',null,'読み込む');ld.type='button';ld.onclick=()=>loadInto(s.id,+sel.value);const dl=el('button','lpDel','削除');dl.type='button';dl.onclick=()=>{if(dl.dataset.sure){del(s.id)}else{dl.dataset.sure='1';dl.textContent='本当に削除';setTimeout(()=>{if(dl.isConnected){delete dl.dataset.sure;dl.textContent='削除'}},4000)}};row.append(sel,ld,dl);box.append(row)}}
document.addEventListener('saww:lang',()=>setTimeout(()=>{render();renderLib()},0));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
window.__looper={active,rec,play,undo,clear,setSpeed,setRev,setVol,save,loadInto,del,list,wav,ensure,state:()=>chs.map(c=>({state:c.state,len:+len(c).toFixed(3),speed:c.speed,rev:c.rev,undo:!!c.undo,phase:+phase(c).toFixed(3)})),buffer:i=>chs[i].buf};
})();
