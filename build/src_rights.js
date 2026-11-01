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
 if(RIGHTS_MODES[mode])RIGHTS.mode=mode;try{localStorage.setItem('ae-rights',RIGHTS.mode)}catch(e){}
 for(const id of [...activeBio.keys()])if(!rightsAllowed(id))fadeResident(id);
 for(const v of [...fieldVoices])if(!rightsAllowed(v.id))stopFieldVoices(v.id);
 if(previewVoice&&!rightsAllowed(previewVoice.id))stopPreview();
 if(typeof resetBioSequence==='function'&&ctx)nextBioAt=ctx.currentTime+.1;
 renderRights();if(typeof updateFieldLevels==='function')updateFieldLevels();
}
$('rightsMode').onchange=e=>applyRights(e.target.value);
setInterval(renderRights,1500);renderRights();
window.__rightsDebug={get mode(){return RIGHTS.mode},set:m=>{applyRights(m);return RIGHTS.mode},allowed:rightsAllowed,tierOf:rightsTierOf,summary:rightsSummaryLine,
 pool:()=>ctx?candidatePool().map(x=>x.id):null,fieldOn:()=>fieldOn(),active:()=>({bio:[...activeBio.keys()],field:[...fieldVoices].map(v=>v.id),preview:previewVoice?.id||null})};
