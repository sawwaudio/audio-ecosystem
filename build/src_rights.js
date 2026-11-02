// v0.27 商用モード（ライセンス区分フィルター） — docs/COMMERCIAL_POLICY.md 4-1
// 区分 A：CC0・パブリックドメイン・自前（表記不要） / B：CC BY（表記必要） / C：CC BY-SA（継承あり。販売版・リールでは使わない）
// 自律演奏の生物音・環境層・試聴・実録音ライブラリの▶・WAV書き出しのすべてに効く（発音の入口で判定する）。
// 対象外の素材は他の素材や合成音で代用せず、鳴らさない。理由は画面に表示する。利用者がインポートした音声は利用者の責任として常に許可する。
var RIGHTS={mode:'all'};
const RIGHTS_MODES={all:'すべての素材（CC BY-SA を含む）',nosa:'BY-SAを除く（販売・リール用）',cc0:'CC0・パブリックドメインのみ（表記不要）'};
const RIGHTS_TIER_LABEL={A:'A 表記不要（CC0・PD）',B:'B 表記必要（CC BY）',C:'C 継承あり（CC BY-SA）',X:'区分不明'};
try{const m=localStorage.getItem('ae-rights');if(RIGHTS_MODES[m])RIGHTS.mode=m}catch(e){}
function rightsTierOf(lic){lic=String(lic||'').trim();if(/BY-SA/i.test(lic))return 'C';if(/\b(NC|ND)\b/i.test(lic))return 'X';if(/^CC BY\b/i.test(lic))return 'B';if(/^(CC0|Public domain|PD\b|owned)/i.test(lic))return 'A';return 'X'}
function rightsTierAllowed(tier,mode){mode=mode||((typeof RIGHTS==='object'&&RIGHTS)?RIGHTS.mode:'all');if(mode==='all')return true;if(mode==='nosa')return tier==='A'||tier==='B';return tier==='A'}
function rightsAllowed(id){
 if(typeof bufferOrigins!=='undefined'&&bufferOrigins.get(id)==='import')return true; // 利用者の音声：権利は利用者が確認（クレジットに別記）
 const r=recordings.find(x=>x.id===id);if(!r)return true; // 録音のない合成音（コードで生成）は区分の対象外
 return rightsTierAllowed(rightsTierOf(r.license));
}
for(const r of recordings)r.rightsTier=rightsTierOf(r.license);
for(const s of instrumentSamples)s.rightsTier=rightsTierOf(s.license||'CC0');
function rightsSummaryLine(entries){
 const c={A:0,B:0,C:0,X:0,U:0};for(const e of entries){if(e.imported)c.U++;else c[rightsTierOf(e.license)]++}
 return ['商用モード / Commercial mode: '+RIGHTS_MODES[RIGHTS.mode]+' / '+{all:'All sources (including CC BY-SA)',nosa:'Excluding BY-SA (for sale & reels)',cc0:'CC0 / public domain only (no attribution needed)'}[RIGHTS.mode],
  'ライセンス区分 / Rights tiers: A（CC0・PD・表記不要 / no attribution）'+c.A+'件 · B（CC BY・表記必要 / attribution）'+c.B+'件 · C（CC BY-SA・継承あり / share-alike）'+c.C+'件'+(c.X?' · 区分不明 / unknown '+c.X+'件':'')+(c.U?' · 利用者の音声 / user-imported '+c.U+'件':'')]}
function renderRights(){
 const sel=$('rightsMode');if(sel)sel.value=RIGHTS.mode;
 const ok=recordings.filter(r=>rightsAllowed(r.id)),blocked=recordings.length-ok.length,beds=ok.filter(r=>r.fieldBed).length;
 const enabled=Object.entries(speciesSettings).filter(([id,v])=>v.enabled&&recordings.some(r=>r.id===id)),enabledOk=enabled.filter(([id])=>rightsAllowed(id));
 const bedsOn=Object.entries(fieldConfig.levels).filter(([,l])=>l>0).map(([id])=>id),bedsOk=bedsOn.filter(rightsAllowed);
 const parts=['使える実録音 '+ok.length+'/'+recordings.length+'件（環境層 '+beds+'件）'];
 if(blocked)parts.push('対象外の'+blocked+'件は代用せず鳴らしません。');
 if(enabled.length&&!enabledOk.length)parts.push('参加中の生き物はすべて対象外のため、生物の声は無音です（代用しません）。');
 else if(enabled.length>enabledOk.length)parts.push('参加中の'+(enabled.length-enabledOk.length)+'件は対象外のため鳴りません。');
 if(bedsOn.length&&!bedsOk.length&&!fieldConfig.legacy)parts.push('選んだ環境層はすべて対象外のため、環境層は無音です（代用しません）。');
 const out=$('rightsResult');if(!out)return;const key=parts.join('|');if(out.dataset.key===key)return;out.dataset.key=key;
 out.replaceChildren(...parts.flatMap((t,i)=>i?[' ',Object.assign(document.createElement('span'),{textContent:t})]:[Object.assign(document.createElement('span'),{textContent:t})]));
}
function applyRights(mode){
 if(mode==='all'&&RIGHTS.mode!=='all'&&typeof reelGuard==='function'&&reelGuard())return; // v0.31 リール録画中は BY-SA を戻さない
 if(RIGHTS_MODES[mode])RIGHTS.mode=mode;try{localStorage.setItem('ae-rights',RIGHTS.mode)}catch(e){}
 for(const id of [...activeBio.keys()])if(!rightsAllowed(id))fadeResident(id);
 for(const v of [...fieldVoices])if(!rightsAllowed(v.id))stopFieldVoices(v.id);
 if(previewVoice&&!rightsAllowed(previewVoice.id))stopPreview();
 if(typeof resetBioSequence==='function'&&ctx)nextBioAt=ctx.currentTime+.1;
 renderRights();decorateRights();if(typeof updateFieldLevels==='function')updateFieldLevels();
}
// v0.29 区分バッジ（A/B/C）：生き物の一覧・環境層スライダー・監査表に表示し、いまの商用モードで鳴らない素材を薄く表示する（鳴らない理由を見える化）。
const RIGHTS_TIER_SHORT={A:'表記不要（CC0・PD）',B:'表記必要（CC BY）',C:'継承あり（CC BY-SA）',X:'区分不明'};
if(typeof sourceAudit!=='undefined')for(const a of sourceAudit)a.rightsTier=rightsTierOf(a.license||(a.kind==='instrument'?'CC0':''));
function rightsBadgeEl(tier){const b=document.createElement('span');b.className='rightsBadge tier-'+tier;b.textContent=tier;b.title=RIGHTS_TIER_LABEL[tier];return b}
function rightsLineEl(id,tier){const p=document.createElement('p');p.className='micro rightsLine';p.dataset.rightsLine=id;
 const l=document.createElement('span');l.textContent=RIGHTS_TIER_SHORT[tier];const off=document.createElement('span');off.className='rightsOff';off.textContent='商用モードの対象外（鳴りません）';off.hidden=true;
 p.append(rightsBadgeEl(tier),' ',l,' ',off);return p}
function rightsMark(el,id){const v=rightsAllowed(id)?'0':'1';if(el.dataset.rightsBlocked!==v)el.dataset.rightsBlocked=v;const off=el.querySelector('.rightsOff');if(off&&off.hidden!==(v==='0'))off.hidden=v==='0'}
function decorateRights(){
 for(const row of document.querySelectorAll('article.resident')){const id=row.dataset.residentId,r=recordings.find(x=>x.id===id);if(!r)continue;
  if(!row.querySelector('.rightsLine')){const h=row.querySelector('h3');if(h)h.after(rightsLineEl(id,r.rightsTier));else row.prepend(rightsLineEl(id,r.rightsTier))}rightsMark(row,id)}
 for(const r of recordings.filter(x=>x.fieldBed)){const inp=$('field-'+r.id),label=inp&&inp.closest('label');if(!label)continue;if(!label.querySelector('.rightsLine'))label.append(rightsLineEl(r.id,r.rightsTier));rightsMark(label,r.id)}
 for(const tr of document.querySelectorAll('#auditTable tr[data-rights-id]'))if(tr.dataset.rightsKind==='recording')rightsMark(tr,tr.dataset.rightsId);
}
// v0.30 プリセットに商用モードと区分・帰属情報を含める（バックログ0③・3②）。
// 書き出し：rightsMode と rights（参加・選択中の実録音素材ごとの区分・ライセンス・作者・出典・帰属表示の要否）を追加。schema は 1 のまま（追加項目のみ）。
// 読み込み：プリセットの商用モードが「いまの設定と同じか厳しい」時だけ適用する。緩いモードのプリセットで BY-SA が鳴り出すことはない。
const RIGHTS_STRICT={all:0,nosa:1,cc0:2};
function presetSourceIds(){
 const ids=Object.entries(speciesSettings).filter(([id,v])=>v.enabled&&recordings.some(r=>r.id===id)).map(([id])=>id);
 if(!fieldConfig.legacy)for(const [id,l] of Object.entries(fieldConfig.levels))if(l>0&&recordings.some(r=>r.id===id))ids.push(id);
 return [...new Set(ids)]}
function presetRightsBlock(){
 const ids=presetSourceIds(),tiers={A:0,B:0,C:0,X:0,U:0};
 const entries=attributionEntries(ids.map(id=>({kind:'recording',id,origin:(typeof bufferOrigins!=='undefined'&&bufferOrigins.get(id))||'embedded'})));
 const sources=entries.map(e=>{if(e.imported){tiers.U++;return {id:e.id,tier:'U',imported:true}}
  const tier=rightsTierOf(e.license);tiers[tier]++;
  return {id:e.id,name:e.name,en:e.en,latin:e.latin,tier,license:e.license,licenseURL:e.licenseURL,title:e.title,author:e.author,url:e.url,attributionRequired:needsAttribution(e.license),playsInMode:rightsAllowed(e.id)}});
 return {mode:RIGHTS.mode,modeLabel:RIGHTS_MODES[RIGHTS.mode],tiers,sources,
  notice:'このプリセットで参加・選択している実録音素材です（実際に鳴るかは自律演奏と地域フィルターによる）。書き出した音を公開・配布する場合は attributionRequired が true の素材の作品名・作者・出典・ライセンスを表示してください。tier U は利用者がインポートした音声で、権利は利用者が確認します。 / Field recordings enabled or selected in this preset (whether each is heard depends on autonomous play and the region filter). If you publish or share exported audio, credit the title, author, source and license of every source with attributionRequired = true. Tier U is user-imported audio; its rights are the user’s responsibility.'}}
function presetRightsCheck(data){if(data.rightsMode!==undefined&&!RIGHTS_MODES[data.rightsMode])throw Error('不正な商用モード')}
function presetRightsApply(data){const notes=[];
 if(data.rightsMode!==undefined){
  if(RIGHTS_STRICT[data.rightsMode]>=RIGHTS_STRICT[RIGHTS.mode]){if(data.rightsMode!==RIGHTS.mode){applyRights(data.rightsMode);notes.push('プリセットの商用モード（'+RIGHTS_MODES[RIGHTS.mode]+'）を適用しました。')}}
  else notes.push('いまの商用モード（'+RIGHTS_MODES[RIGHTS.mode]+'）の方がプリセット（'+RIGHTS_MODES[data.rightsMode]+'）より厳しいため、いまの設定のままにしました。')}
 renderRights();decorateRights();
 const blocked=presetSourceIds().filter(id=>!rightsAllowed(id)).length;if(blocked)notes.push('このプリセットの素材のうち'+blocked+'件は商用モードの対象外のため鳴りません（代用しません）。');
 return notes}
function presetMessage(parts){$('message').replaceChildren(...parts.flatMap((t,i)=>{const s=Object.assign(document.createElement('span'),{textContent:t});return i?[' ',s]:[s]}))}
$('rightsMode').onchange=e=>applyRights(e.target.value);
setInterval(renderRights,1500);renderRights();decorateRights();
window.__rightsDebug={get mode(){return RIGHTS.mode},set:m=>{applyRights(m);return RIGHTS.mode},allowed:rightsAllowed,tierOf:rightsTierOf,summary:rightsSummaryLine,presetBlock:()=>presetRightsBlock(),presetIds:()=>presetSourceIds(),
 badges:()=>[...document.querySelectorAll('[data-rights-blocked]')].map(e=>({id:e.dataset.residentId||e.dataset.rightsId||e.querySelector('[data-rights-line]')?.dataset.rightsLine,tier:e.querySelector('.rightsBadge')?.textContent,blocked:e.dataset.rightsBlocked==='1',where:e.matches('article')?'resident':e.matches('tr')?'audit':'field'})),
 pool:()=>ctx?candidatePool().map(x=>x.id):null,fieldOn:()=>fieldOn(),active:()=>({bio:[...activeBio.keys()],field:[...fieldVoices].map(v=>v.id),preview:previewVoice?.id||null})};
