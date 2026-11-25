/* v0.86 共有リンク — いまの音の組み合わせ（プリセット。ミキサー・エフェクト・サンプラー・ペダル込み）を、URL の # の後ろに入れて渡す。
   目的地（claude/VISION.md）の「聴く人 → 作る人」をつなぐ：リール・ショート・ライブの説明欄から、同じ音をアプリでそのまま鳴らせる。
   - # の後ろはサーバーに送られない（GitHub Pages のログにも残らない）。短縮はしない（課金サーバーが要るため、今は使わない）。
   - 中身は exportData() から、権利の一覧（rights）と作成日時を除いたもの。生き物・環境音・音色（p）の設定は、ページを開いた時の値との差だけを入れる（同じ版のアプリなら初期値は同じ）。
   - 圧縮（deflate-raw）して base64url にする。圧縮に対応しないブラウザは圧縮なし（先頭 z＝圧縮、j＝なし）。
   - 開く側：applyData() でそのまま検証・適用する（ファイルのプリセットと同じ検査を通る。商用モードは今より緩くはならない）。展開後 200KB を超えるものは開かない。
   - 自分で追加した音（インポート）は相手の端末に無いので鳴らない。
   - 作るのは無料（書き出しではないため）。開いた人は、PRO の機能の設定もそのまま聴ける（触るには PRO が要る）。 */
(()=>{'use strict';
const MAX=200000;let base=null;
const b64u=b=>{let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const unb64u=s=>{if(!/^[A-Za-z0-9_-]*$/.test(s))throw Error('壊れたリンク');const t=atob(s.replace(/-/g,'+').replace(/_/g,'/'));const b=new Uint8Array(t.length);for(let i=0;i<t.length;i++)b[i]=t.charCodeAt(i);return b};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// 生き物の設定は、適用に使う3つだけを比べて送る（license などは送らない）
const norm=v=>({level:v.level,enabled:v.enabled,rest:v.rest??12});
function initBase(){if(base)return;const d=exportData();base={species:Object.fromEntries(Object.entries(d.species).map(([id,v])=>[id,norm(v)])),field:d.field.levels,p:{...d.p}}}
function snapshot(){initBase();const d=exportData();delete d.rights;delete d.created;delete d.format;delete d.schema;
 const sp={};for(const [id,v] of Object.entries(d.species)){const n=norm(v);if(!same(n,base.species[id]))sp[id]=n}d.species=sp;
 const pp={};for(const [k,v] of Object.entries(d.p))if(!same(v,base.p[k]))pp[k]=v;d.p=pp;
 const fl={};for(const [id,v] of Object.entries(d.field.levels))if(v!==base.field[id])fl[id]=v;d.field={legacy:d.field.legacy,levels:fl};return d}
function expand(o){initBase();if(!o||typeof o!=='object'||Array.isArray(o))throw Error('壊れたリンク');const d={...o,format:'audio-ecosystem-preset',schema:1};d.p={...base.p,...(o.p&&typeof o.p==='object'&&!Array.isArray(o.p)?o.p:{})};
 const sp=JSON.parse(JSON.stringify(base.species));if(o.species&&typeof o.species==='object')for(const [id,v] of Object.entries(o.species))if(sp[id])sp[id]=v;d.species=sp;
 const fl={...base.field};const f=o.field&&typeof o.field==='object'?o.field:{};if(f.levels&&typeof f.levels==='object')for(const [id,v] of Object.entries(f.levels))if(id in fl)fl[id]=v;d.field={legacy:f.legacy===true,levels:fl};return d}
async function pack(o){const raw=new TextEncoder().encode(JSON.stringify(o));
 if(typeof CompressionStream!=='undefined'){try{const z=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());return 'z'+b64u(z)}catch(e){}}
 return 'j'+b64u(raw)}
async function unpack(code){if(typeof code!=='string'||code.length<2||code.length>MAX)throw Error('壊れたリンク');const k=code[0],b=unb64u(code.slice(1));let raw;
 if(k==='j')raw=b;else if(k==='z'){if(typeof DecompressionStream==='undefined')throw Error('このブラウザでは開けません');
  const rd=new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let n=0;
  for(;;){const {done,value}=await rd.read();if(done)break;n+=value.length;if(n>MAX){try{rd.cancel()}catch(e){}throw Error('大きすぎるリンク')}parts.push(value)}
  raw=new Uint8Array(n);let o=0;for(const p of parts){raw.set(p,o);o+=p.length}}
 else throw Error('壊れたリンク');return JSON.parse(new TextDecoder().decode(raw))}
const appBase=()=>location.origin+location.pathname.replace(/index\.html$/,'');
async function link(){return appBase()+'#p='+await pack(snapshot())}
async function open(code){const d=expand(await unpack(code));return applyData(d)}
function say(parts){try{presetMessage(parts)}catch(e){$('message').textContent=parts.join(' ')}}
async function make(){const btn=$('shareLink'),out=$('shareOut');btn.disabled=true;try{const url=await link();out.hidden=false;const inp=$('shareUrl');inp.value=url;
  let copied=false;try{await navigator.clipboard.writeText(url);copied=true}catch(e){}
  $('shareNote').textContent=copied?'リンクをコピーしました。リールやショートの説明欄、メッセージに貼ってください。':'下のリンクをコピーして、説明欄やメッセージに貼ってください。';
  if($('shareNative'))$('shareNative').hidden=!navigator.share}
 catch(e){say(['共有リンクを作れませんでした: '+e.message])}finally{btn.disabled=false}}
function wire(){const b=$('shareLink');if(!b||b.dataset.wired)return;b.dataset.wired='1';b.addEventListener('click',make);
 $('shareCopy').addEventListener('click',async()=>{const v=$('shareUrl').value;let ok=false;try{await navigator.clipboard.writeText(v);ok=true}catch(e){$('shareUrl').select();try{ok=document.execCommand('copy')}catch(e2){}}$('shareNote').textContent=ok?'コピーしました。':'リンクを長押し（右クリック）してコピーしてください。'});
 $('shareBannerPlay').addEventListener('click',()=>{$('shareBanner').hidden=true;const pb=$('play');if(pb&&!playing)pb.click()});$('shareBannerClose').addEventListener('click',()=>{$('shareBanner').hidden=true});
 $('shareNative').addEventListener('click',()=>{const v=$('shareUrl').value;if(navigator.share)navigator.share({title:'saww audio ecosystem',text:'この音をアプリで鳴らす',url:v}).catch(()=>{})})}
// 開く側：#p= があれば、初期値を控えてから適用し、# を消す（再読み込みで二重に掛からないように）
async function boot(){initBase();wire();const h=location.hash;if(!h.startsWith('#p='))return;
 try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
 try{const notes=await open(h.slice(3));document.body.classList.add('fromShare');
  say(['共有された音の組み合わせを開きました。▶ 再生で鳴らします。',...notes]);const bn=$('shareBanner');if(bn){bn.hidden=false}window.__shareOpened=true}
 catch(e){say(['共有リンクを開けませんでした: '+e.message]);window.__shareOpened=false}}
// リールのクレジット（説明欄用）に「この音をアプリで鳴らす」を足す
window.reelShareLine=async()=>{try{return await link()}catch(e){return ''}};
window.__share={link,open,pack,unpack,snapshot,expand};
if(document.readyState==='complete')setTimeout(boot,0);else window.addEventListener('load',()=>setTimeout(boot,0));
})();
