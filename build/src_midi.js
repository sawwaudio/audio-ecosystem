/* saww audio ecosystem v0.46 — DJ ミキサー M5 第2段階：Web MIDI（docs/DJ_MIXER_SPEC.md）
   MIDI 機器（DJ コントローラ・キーボード・パッド）のつまみ・フェーダー・パッド・ボタンを、画面の操作部に「学習」で割り当てる。
   - 割り当てられる操作部：ミキサーのつまみ・フェーダー・MUTE、マスター EQ、チャンネルFXの種類、BEAT FX（効果・拍・オン／オフ・押している間だけ・つまみ）、
     サンプラー（パッド8個・始点／終点などのスライダー・ボタン）、自律演奏の開始ボタン。
   - CC（つまみ・フェーダー）とピッチベンドは連続値、ノートはボタン・パッド（押す／離す）。ボタンに CC を割り当てた場合は 64 以上で押す。
   - 割り当てはこの端末のブラウザ（localStorage 'ae-midi'）にだけ保存する。外部へは送信しない。SysEx は要求しない。
   - 音源・権利の扱いは変えない（パッドは smpTrigger を通るので、商用モードの対象外の録音は鳴らない）。
   v0.50（M5 の残り）：相対値を送るつまみ（無限に回るエンコーダー・ジョグ）は、割り当てごとに「動き方」を選ぶ（絶対値／相対：2の補数・64が中央・符号ビット）。
     ソフトテイクオーバー（入れた時だけ）：MIDI のつまみが画面の値に近づくか通り過ぎるまで値を変えない（つまみの位置のずれで値が飛ばない）。画面で値を変えたら、また拾い直す。
     保存は {v:1,maps,modes?,soft?}（modes・soft は既定でない時だけ書く。v0.46 の保存データもそのまま読める）。
   本体スクリプトの中（buildSampler の後）で実行する。build/src_midi.js と index.html の ae-midi の区間は同じ内容に保つ。 */
(()=>{'use strict';
const MIDI_KEY='ae-midi';
const midi={acc:null,learn:false,pending:null,maps:{},cc:{},lastAt:0,swallow:false,modes:{},soft:false,prev:{},picked:{},lastSet:{}};
const MIDI_MODES={abs:'絶対値',rel2c:'相対（2の補数）',relbin:'相対（64が中央）',relsign:'相対（符号ビット）'};
window.__midi=midi;
function midiLoad(){try{const o=JSON.parse(localStorage.getItem(MIDI_KEY)||'null');if(o&&o.v===1&&o.maps&&typeof o.maps==='object')for(const [k,t] of Object.entries(o.maps))if(/^(cc:\d+:\d+|note:\d+:\d+|pb:\d+)$/.test(k)&&midiValidTarget(t))midi.maps[k]=t;
  if(o&&o.v===1&&o.modes&&typeof o.modes==='object')for(const [k,m] of Object.entries(o.modes))if(midi.maps[k]&&midiCont(midi.maps[k])&&/^cc:/.test(k)&&MIDI_MODES[m]&&m!=='abs')midi.modes[k]=m;
  if(o&&o.v===1&&o.soft===true)midi.soft=true}catch(e){}}
function midiSave(){try{const o={v:1,maps:midi.maps};for(const k of Object.keys(midi.modes))if(!midi.maps[k]||midi.modes[k]==='abs')delete midi.modes[k];
 if(Object.keys(midi.modes).length)o.modes=midi.modes;if(midi.soft)o.soft=true;localStorage.setItem(MIDI_KEY,JSON.stringify(o))}catch(e){}}
const midiCont=t=>t.t==='mix'||t.t==='range';
function midiValidTarget(t){if(!t||typeof t!=='object')return false;
 if(t.t==='mix')return (t.ch==='master'||MIX_CH.includes(t.ch))&&!!MIX_CTRL[t.k];
 if(t.t==='range')return typeof t.id==='string'&&/^[\w-]+$/.test(t.id);
 if(t.t==='pad')return Number.isInteger(t.i)&&t.i>=0&&t.i<SMP_PADS;
 if(t.t==='hold')return true;
 if(t.t==='btn')return typeof t.sel==='string'&&/^(#[\w-]+|#(fxTypes|fxBeats|mixCfx) \[data-(type|beats|cfx)="[\w.-]+"\]|#mixGrid \[data-ch="\w+"\] \[data-k="mute"\])$/.test(t.sel);
 return false}
// 画面の要素 → 割り当て先
function midiResolve(el){if(!el||!el.closest||el.closest('#midiPanel'))return null;const studio=el.closest('#studioGroup');
 const k=el.closest('[data-k]');if(k){const strip=k.closest('#mixGrid [data-ch]');
  if(strip&&k.dataset.k==='mute')return {t:'btn',sel:'#mixGrid [data-ch="'+strip.dataset.ch+'"] [data-k="mute"]'};
  if(strip&&MIX_CTRL[k.dataset.k])return {t:'mix',ch:strip.dataset.ch,k:k.dataset.k};
  if(k.closest('#mixMasterEq')&&MIX_CTRL[k.dataset.k])return {t:'mix',ch:'master',k:k.dataset.k}}
 const pad=el.closest('#smpPads [data-pad]');if(pad)return {t:'pad',i:+pad.dataset.pad};
 if(el.closest('#fxHold'))return {t:'hold'};
 const rg=el.closest('input[type=range]');if(rg&&studio&&rg.id)return {t:'range',id:rg.id};
 const b=el.closest('button');if(!b||b.disabled)return null;if(b.id==='play')return {t:'btn',sel:'#play'};if(!studio)return null;
 if(b.dataset.type&&b.closest('#fxTypes'))return {t:'btn',sel:'#fxTypes [data-type="'+b.dataset.type+'"]'};
 if(b.dataset.beats&&b.closest('#fxBeats'))return {t:'btn',sel:'#fxBeats [data-beats="'+b.dataset.beats+'"]'};
 if(b.dataset.cfx&&b.closest('#mixCfx'))return {t:'btn',sel:'#mixCfx [data-cfx="'+b.dataset.cfx+'"]'};
 if(b.id)return {t:'btn',sel:'#'+b.id};return null}
function midiEl(t){try{if(t.t==='mix')return document.querySelector((t.ch==='master'?'#mixMasterEq':'#mixGrid [data-ch="'+t.ch+'"]')+' [data-k="'+t.k+'"]');
 if(t.t==='range')return document.getElementById(t.id);if(t.t==='pad')return document.querySelector('#smpPads [data-pad="'+t.i+'"]');if(t.t==='hold')return document.getElementById('fxHold');
 return document.querySelector(t.sel)}catch(e){return null}}
function midiTargetLabel(t){const el=midiEl(t);if(!el)return '（見つかりません）';if(t.t==='pad')return 'パッド'+(t.i+1);
 if(t.t==='range'){const l=document.querySelector('label[for="'+t.id+'"]');return (l&&l.textContent.trim())||t.id}
 return (el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ')}
function midiSrcLabel(key){const [kind,ch,n]=key.split(':');return kind==='cc'?'CC '+n+' · ch'+ch:kind==='note'?'ノート '+n+' · ch'+ch:'ピッチベンド · ch'+ch}
function midiStatus(s){const el=$('midiStatus');if(el)el.textContent=s}
// MIDI メッセージ（Uint8Array か配列）を処理する
function midiMsg(d){if(!d||d.length<2)return;const st=d[0]&0xf0,ch=(d[0]&15)+1;let key,kind,val=0;
 if(st===0xB0){key='cc:'+ch+':'+d[1];kind='cc';val=(d[2]||0)/127}
 else if(st===0x90&&(d[2]||0)>0){key='note:'+ch+':'+d[1];kind='on'}
 else if(st===0x80||st===0x90){key='note:'+ch+':'+d[1];kind='off'}
 else if(st===0xE0){key='pb:'+ch;kind='cc';val=(((d[2]||0)<<7)|(d[1]||0))/16383}
 else return;
 const now=performance.now();if(now-midi.lastAt>90){midi.lastAt=now;const l=$('midiLast');if(l)l.textContent=midiSrcLabel(key)}
 if(midi.learn&&midi.pending){if(kind==='off')return;const t=midi.pending;
  if(midiCont(t)&&kind!=='cc'){midiStatus('つまみ・フェーダーには、MIDI のつまみかフェーダー（CC）を動かしてください。');return}
  for(const [k,v] of Object.entries(midi.maps))if(JSON.stringify(v)===JSON.stringify(t))delete midi.maps[k];
  midi.maps[key]=t;delete midi.modes[key];delete midi.picked[key];delete midi.lastSet[key];midi.prev[key]=kind==='cc'?val:undefined;if(kind==='cc')midi.cc[key]=val;midiSave();midiSetPending(null);midiRender();midiStatus('「'+midiTargetLabel(t)+'」に '+midiSrcLabel(key)+' を割り当てました。');return}
 const t=midi.maps[key];if(!t)return;
 if(midiCont(t)){if(kind==='cc')midiApplyCont(t,val,key,d[2]||0);return}
 if(kind==='cc'){const prev=midi.cc[key]||0;midi.cc[key]=val;if(val>=.5&&prev<.5)midiPress(t,true);else if(val<.5&&prev>=.5)midiPress(t,false);return}
 midiPress(t,kind==='on')}
// 操作部のいまの値（0〜1）
function midiCur(t){if(t.t==='mix'){const c=MIX_CTRL[t.k],v=+mixSt(t.ch)[t.k];return c.max>c.min?clamp((v-c.min)/(c.max-c.min),0,1):0}
 const el=midiEl(t);if(!el)return null;const mn=+el.min||0,mx=el.max===''?100:+el.max;return mx>mn?clamp((+el.value-mn)/(mx-mn),0,1):0}
function midiSetRange(el,v){const mn=+el.min||0,mx=el.max===''?100:+el.max,step=+el.step||1;v=Math.round((v-mn)/step)*step+mn;v=clamp(+v.toFixed(6),mn,mx);
 if(+el.value===v)return;el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
// 相対値のつまみ：1回の目盛りで動く数（+ は右回り）
function midiRelTicks(mode,v){v=v|0;if(mode==='rel2c')return v===0?0:v<64?v:v-128;if(mode==='relbin')return v-64;if(mode==='relsign')return (v&63)*(v&64?-1:1);return 0}
function midiNudge(t,ticks){if(t.t==='mix'){const c=MIX_CTRL[t.k],v=+mixSt(t.ch)[t.k];mixSet(t.ch,t.k,v+ticks*(c.max-c.min)/64);return}
 const el=midiEl(t);if(!el||el.disabled)return;const mn=+el.min||0,mx=el.max===''?100:+el.max,step=+el.step||1;midiSetRange(el,+el.value+ticks*Math.max(step,(mx-mn)/64))}
function midiApplyCont(t,r,key,raw){r=clamp(r,0,1);const mode=(key&&midi.modes[key])||'abs';
 if(mode!=='abs'){const n=midiRelTicks(mode,raw);if(n)midiNudge(t,n);return}
 if(t.t==='range'){const el=midiEl(t);if(!el||el.disabled)return}
 if(midi.soft&&key){const cur=midiCur(t);if(cur!=null){const ls=midi.lastSet[key];if(midi.picked[key]&&(ls==null||Math.abs(cur-ls)>.015))midi.picked[key]=false;
  if(!midi.picked[key]){const prev=midi.prev[key];midi.prev[key]=r;if(!(Math.abs(r-cur)<=.03||(prev!=null&&(prev-cur)*(r-cur)<=0))){midiStatus('ソフトテイクオーバー：MIDI のつまみを画面の値（'+Math.round(cur*100)+'%）まで動かすと操作できます。');return}
   midi.picked[key]=true}}}
 if(key)midi.prev[key]=r;
 if(t.t==='mix'){const c=MIX_CTRL[t.k];mixSet(t.ch,t.k,c.min+r*(c.max-c.min))}else{const el=midiEl(t),mn=+el.min||0,mx=el.max===''?100:+el.max;midiSetRange(el,mn+r*(mx-mn))}
 if(key){const c=midiCur(t);if(c!=null)midi.lastSet[key]=c}}
function midiPress(t,down){if(t.t==='pad'){smpTrigger(t.i,down);return}
 if(t.t==='hold'){if(down)fxSet('held',true);else if(fx.held)fxSet('held',false);return}
 if(!down)return;const el=midiEl(t);if(el&&!el.disabled)el.click()}
function midiHook(){const acc=midi.acc;if(!acc)return;const names=[];for(const inp of acc.inputs.values()){inp.onmidimessage=e=>midiMsg(e.data);if(inp.state!=='disconnected')names.push(inp.name||inp.id)}
 midiStatus(names.length?'接続中の MIDI 入力：'+names.join('、'):'MIDI 入力が見つかりません。機器をつないでください。')}
async function midiConnect(){if(!navigator.requestMIDIAccess){midiStatus('このブラウザは Web MIDI に対応していません。');return}
 try{midi.acc=await navigator.requestMIDIAccess({sysex:false});midi.acc.onstatechange=midiHook;midiHook()}catch(e){midiStatus('MIDI 機器への接続が許可されませんでした。')}}
function midiSetPending(t,el){document.querySelectorAll('.midiPending').forEach(x=>x.classList.remove('midiPending'));midi.pending=t;if(t){const e=el||midiEl(t);if(e)e.classList.add('midiPending')}}
function midiSetLearn(on){midi.learn=!!on;midiSetPending(null);document.body.classList.toggle('midiLearn',midi.learn);const b=$('midiLearn');if(b)b.setAttribute('aria-pressed',String(midi.learn));
 midiStatus(midi.learn?'割り当てたい操作部（つまみ・フェーダー・パッド・ボタン）を押してください。':'学習を終えました。')}
function midiPick(e){if(!midi.learn)return;const el=e.target;if(el.closest&&el.closest('#midiPanel'))return;const t=midiResolve(el);
 if(!t){if(el.closest&&el.closest('#studioGroup')){e.preventDefault();e.stopPropagation();midi.swallow=true;midiStatus('この操作部は割り当てられません。')}return}
 e.preventDefault();e.stopPropagation();midi.swallow=true;midiSetPending(t,el.closest('[data-k],[data-pad],button,input')||el);
 midiStatus('「'+midiTargetLabel(t)+'」に割り当てます。MIDI のつまみ・フェーダーかパッド・ボタンを動かしてください。')}
function midiRender(){const ul=$('midiList');if(!ul)return;ul.textContent='';const keys=Object.keys(midi.maps);
 if(!keys.length){const li=document.createElement('li');li.className='micro';li.textContent='割り当てはまだありません。';ul.append(li);return}
 for(const key of keys){const li=document.createElement('li');li.dataset.key=key;const a=document.createElement('span');a.className='src';a.textContent=midiSrcLabel(key);
  const ar=document.createElement('span');ar.textContent=' → ';const b=document.createElement('span');b.className='dst';b.textContent=midiTargetLabel(midi.maps[key]);
  const x=document.createElement('button');x.type='button';x.textContent='✕';x.setAttribute('aria-label','割り当てを削除');x.onclick=()=>{delete midi.maps[key];delete midi.modes[key];midiSave();midiRender()};li.append(a,ar,b);
  if(/^cc:/.test(key)&&midiCont(midi.maps[key])){const sel=document.createElement('select');sel.className='mode';sel.setAttribute('aria-label','動き方');
   for(const [v,l] of Object.entries(MIDI_MODES)){const o=document.createElement('option');o.value=v;o.textContent=l;sel.append(o)}sel.value=midi.modes[key]||'abs';
   sel.onchange=()=>{if(sel.value==='abs')delete midi.modes[key];else midi.modes[key]=sel.value;delete midi.picked[key];midiSave()};li.append(sel)}
  li.append(x);ul.append(li)}}
function buildMidi(){const sec=$('mixerSection');if(!sec||$('midiPanel'))return;
 const css=document.createElement('style');css.id='ae-midi-css';css.textContent='#midiPanel{margin-top:12px;border-top:1px solid #2a352f;padding-top:10px}#midiList{list-style:none;margin:6px 0 0;padding:0;font-size:11px}#midiList li{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid #24302a}#midiList .src{color:var(--accent)}#midiList .dst{flex:1;min-width:0;overflow-wrap:anywhere}#midiList button{min-height:28px;padding:2px 9px}#midiList select.mode{min-height:28px;font-size:11px;max-width:100%}.midiSoftRow{display:flex;align-items:center;gap:6px;margin:4px 0}#midiLearn[aria-pressed="true"]{background:var(--accent);color:var(--bg)}body.midiLearn #studioGroup :is([data-k],[data-pad],#fxHold,input[type=range],#fxTypes button,#fxBeats button,#mixCfx button),body.midiLearn #play{outline:1px dashed var(--accent);outline-offset:2px}.midiPending{outline:2px solid #e8c36a!important;outline-offset:2px}';document.head.append(css);
 const p=document.createElement('div');p.id='midiPanel';p.setAttribute('role','group');p.setAttribute('aria-label','MIDI の割り当て');
 p.innerHTML='<div class="between"><span class="title">MIDI / コントローラ</span><span class="micro"><span>最後の入力</span> <span id="midiLast">—</span></span></div>'+
  '<div class="buttons"><button id="midiConnect" type="button">MIDI 機器に接続</button><button id="midiLearn" type="button" aria-pressed="false">割り当てを学習</button><button id="midiClear" type="button">割り当てをすべて消す</button></div>'+
  '<p class="micro" id="midiStatus" role="status" aria-live="polite">MIDI 機器は未接続です。</p><label class="micro midiSoftRow"><input id="midiSoft" type="checkbox"> ソフトテイクオーバー（MIDI のつまみが画面の値を通るまで動かさない）</label><ul id="midiList"></ul>'+
  '<details class="help"><summary>ⓘ 詳しく</summary><p class="micro">MIDI 機器（DJ コントローラ・キーボード・パッドなど）のつまみ・フェーダー・パッドで、ミキサー・BEAT FX・サンプラーを操作できます。「割り当てを学習」を押し、画面の操作部を押してから、MIDI 機器のつまみやパッドを動かすと割り当てられます。</p><p class="micro">割り当てはこの端末のブラウザにだけ保存され、外部へは送信しません。Web MIDI に対応したブラウザ（パソコンの Chrome・Edge など）で使えます。</p><p class="micro">無限に回るつまみ（エンコーダー・ジョグ）は、一覧の「動き方」で相対の方式を選んでください（機器の説明書に書かれている方式。迷ったら「相対（2の補数）」から試す）。ソフトテイクオーバーを入れると、MIDI のつまみの位置と画面の値がずれている時に、値が急に飛びません。</p></details>';
 const fxp=$('fxPanel');if(fxp&&fxp.parentElement===sec)fxp.after(p);else sec.append(p);
 $('midiConnect').onclick=midiConnect;$('midiLearn').onclick=()=>midiSetLearn(!midi.learn);$('midiSoft').checked=midi.soft;$('midiSoft').onchange=()=>{midi.soft=$('midiSoft').checked;midi.picked={};midiSave()};
 $('midiClear').onclick=()=>{midi.maps={};midi.cc={};midi.modes={};midi.picked={};midi.prev={};midi.lastSet={};midiSave();midiRender();midiStatus('割り当てをすべて消しました。')};
 document.addEventListener('pointerdown',midiPick,true);
 document.addEventListener('click',e=>{if(midi.swallow){midi.swallow=false;e.preventDefault();e.stopPropagation()}},true);
 document.addEventListener('keydown',e=>{if(!midi.learn)return;if(e.key==='Escape'){midiSetLearn(false);return}if((e.key==='Enter'||e.key===' ')&&document.activeElement&&midiResolve(document.activeElement)){midiPick({target:document.activeElement,preventDefault:()=>e.preventDefault(),stopPropagation:()=>e.stopPropagation()});midi.swallow=false}},true);
 midiLoad();$('midiSoft').checked=midi.soft;midiRender();setTimeout(midiRender,0)}
midi.handle=midiMsg;midi.resolve=midiResolve;midi.render=midiRender;midi.relTicks=midiRelTicks;
buildMidi();
})();
