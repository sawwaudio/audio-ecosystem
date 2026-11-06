/* saww audio ecosystem v0.46 — DJ ミキサー M5 第2段階：Web MIDI（docs/DJ_MIXER_SPEC.md）
   MIDI 機器（DJ コントローラ・キーボード・パッド）のつまみ・フェーダー・パッド・ボタンを、画面の操作部に「学習」で割り当てる。
   - 割り当てられる操作部：ミキサーのつまみ・フェーダー・MUTE、マスター EQ、チャンネルFXの種類、BEAT FX（効果・拍・オン／オフ・押している間だけ・つまみ）、
     サンプラー（パッド8個・始点／終点などのスライダー・ボタン）、自律演奏の開始ボタン。
   - CC（つまみ・フェーダー）とピッチベンドは連続値、ノートはボタン・パッド（押す／離す）。ボタンに CC を割り当てた場合は 64 以上で押す。
   - 割り当てはこの端末のブラウザ（localStorage 'ae-midi'）にだけ保存する。外部へは送信しない。SysEx は要求しない。
   - 音源・権利の扱いは変えない（パッドは smpTrigger を通るので、商用モードの対象外の録音は鳴らない）。
   本体スクリプトの中（buildSampler の後）で実行する。build/src_midi.js と index.html の ae-midi の区間は同じ内容に保つ。 */
(()=>{'use strict';
const MIDI_KEY='ae-midi';
const midi={acc:null,learn:false,pending:null,maps:{},cc:{},lastAt:0,swallow:false};
window.__midi=midi;
function midiLoad(){try{const o=JSON.parse(localStorage.getItem(MIDI_KEY)||'null');if(o&&o.v===1&&o.maps&&typeof o.maps==='object')for(const [k,t] of Object.entries(o.maps))if(/^(cc:\d+:\d+|note:\d+:\d+|pb:\d+)$/.test(k)&&midiValidTarget(t))midi.maps[k]=t}catch(e){}}
function midiSave(){try{localStorage.setItem(MIDI_KEY,JSON.stringify({v:1,maps:midi.maps}))}catch(e){}}
function midiValidTarget(t){if(!t||typeof t!=='object')return false;
 if(t.t==='mix')return (t.ch==='master'||MIX_CH.includes(t.ch))&&!!MIX_CTRL[t.k];
 if(t.t==='range')return typeof t.id==='string'&&/^[\w-]+$/.test(t.id);
 if(t.t==='pad')return Number.isInteger(t.i)&&t.i>=0&&t.i<SMP_PADS;
 if(t.t==='hold')return true;
 if(t.t==='btn')return typeof t.sel==='string'&&/^(#[\w-]+|#(fxTypes|fxBeats|mixCfx) \[data-(type|beats|cfx)="[\w.-]+"\]|#mixGrid \[data-ch="\w+"\] \[data-k="mute"\])$/.test(t.sel);
 return false}
const midiCont=t=>t.t==='mix'||t.t==='range';
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
  midi.maps[key]=t;if(kind==='cc')midi.cc[key]=val;midiSave();midiSetPending(null);midiRender();midiStatus('「'+midiTargetLabel(t)+'」に '+midiSrcLabel(key)+' を割り当てました。');return}
 const t=midi.maps[key];if(!t)return;
 if(midiCont(t)){if(kind==='cc')midiApplyCont(t,val);return}
 if(kind==='cc'){const prev=midi.cc[key]||0;midi.cc[key]=val;if(val>=.5&&prev<.5)midiPress(t,true);else if(val<.5&&prev>=.5)midiPress(t,false);return}
 midiPress(t,kind==='on')}
function midiApplyCont(t,r){r=clamp(r,0,1);if(t.t==='mix'){const c=MIX_CTRL[t.k];mixSet(t.ch,t.k,c.min+r*(c.max-c.min));return}
 const el=midiEl(t);if(!el||el.disabled)return;const mn=+el.min||0,mx=el.max===''?100:+el.max,step=+el.step||1;let v=mn+r*(mx-mn);v=Math.round((v-mn)/step)*step+mn;v=clamp(v,mn,mx);
 if(+el.value===v)return;el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
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
  const x=document.createElement('button');x.type='button';x.textContent='✕';x.setAttribute('aria-label','割り当てを削除');x.onclick=()=>{delete midi.maps[key];midiSave();midiRender()};li.append(a,ar,b,x);ul.append(li)}}
function buildMidi(){const sec=$('mixerSection');if(!sec||$('midiPanel'))return;
 const css=document.createElement('style');css.id='ae-midi-css';css.textContent='#midiPanel{margin-top:12px;border-top:1px solid #2a352f;padding-top:10px}#midiList{list-style:none;margin:6px 0 0;padding:0;font-size:11px}#midiList li{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid #24302a}#midiList .src{color:var(--accent)}#midiList .dst{flex:1;min-width:0;overflow-wrap:anywhere}#midiList button{min-height:28px;padding:2px 9px}#midiLearn[aria-pressed="true"]{background:var(--accent);color:var(--bg)}body.midiLearn #studioGroup :is([data-k],[data-pad],#fxHold,input[type=range],#fxTypes button,#fxBeats button,#mixCfx button),body.midiLearn #play{outline:1px dashed var(--accent);outline-offset:2px}.midiPending{outline:2px solid #e8c36a!important;outline-offset:2px}';document.head.append(css);
 const p=document.createElement('div');p.id='midiPanel';p.setAttribute('role','group');p.setAttribute('aria-label','MIDI の割り当て');
 p.innerHTML='<div class="between"><span class="title">MIDI / コントローラ</span><span class="micro"><span>最後の入力</span> <span id="midiLast">—</span></span></div>'+
  '<div class="buttons"><button id="midiConnect" type="button">MIDI 機器に接続</button><button id="midiLearn" type="button" aria-pressed="false">割り当てを学習</button><button id="midiClear" type="button">割り当てをすべて消す</button></div>'+
  '<p class="micro" id="midiStatus" role="status" aria-live="polite">MIDI 機器は未接続です。</p><ul id="midiList"></ul>'+
  '<details class="help"><summary>ⓘ 詳しく</summary><p class="micro">MIDI 機器（DJ コントローラ・キーボード・パッドなど）のつまみ・フェーダー・パッドで、ミキサー・BEAT FX・サンプラーを操作できます。「割り当てを学習」を押し、画面の操作部を押してから、MIDI 機器のつまみやパッドを動かすと割り当てられます。</p><p class="micro">割り当てはこの端末のブラウザにだけ保存され、外部へは送信しません。Web MIDI に対応したブラウザ（パソコンの Chrome・Edge など）で使えます。</p></details>';
 const fxp=$('fxPanel');if(fxp&&fxp.parentElement===sec)fxp.after(p);else sec.append(p);
 $('midiConnect').onclick=midiConnect;$('midiLearn').onclick=()=>midiSetLearn(!midi.learn);$('midiClear').onclick=()=>{midi.maps={};midi.cc={};midiSave();midiRender();midiStatus('割り当てをすべて消しました。')};
 document.addEventListener('pointerdown',midiPick,true);
 document.addEventListener('click',e=>{if(midi.swallow){midi.swallow=false;e.preventDefault();e.stopPropagation()}},true);
 document.addEventListener('keydown',e=>{if(!midi.learn)return;if(e.key==='Escape'){midiSetLearn(false);return}if((e.key==='Enter'||e.key===' ')&&document.activeElement&&midiResolve(document.activeElement)){midiPick({target:document.activeElement,preventDefault:()=>e.preventDefault(),stopPropagation:()=>e.stopPropagation()});midi.swallow=false}},true);
 midiLoad();midiRender();setTimeout(midiRender,0)}
midi.handle=midiMsg;midi.resolve=midiResolve;midi.render=midiRender;
buildMidi();
})();
