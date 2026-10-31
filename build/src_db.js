// v0.24 WILDLIFE SOUND MASTER DATABASE viewer (data/wildlife_master_db.json, inlined)
const wildDb=JSON.parse($('ae-wildlife-db').textContent);
const DB_STATUS={'in-app':'収録済','verified':'確認済候補','partial':'一部未確認','excluded':'不採用','not-found':'未発見','pending-list':'リスト待ち'};
const yn=v=>v===true?'はい':v===false?'いいえ':'未確認';
function renderDb(){
 const c=wildDb.statusCounts;$('dbSummary').textContent=Object.entries(DB_STATUS).map(([k,l])=>l+' '+(c[k]||0)).join(' · ')+' — 調査日 '+wildDb.surveyed;
 const f=$('dbFilter').value,t=document.createElement('table'),h=t.createTHead().insertRow();for(const x of ['No','状態','対象','日本分布 / 固有','候補（形式・ライセンス・録音地）'])h.append(Object.assign(document.createElement('th'),{textContent:x}));
 const tb=t.createTBody();
 for(const r of wildDb.targets.filter(r=>f==='all'||r.status===f)){const tr=tb.insertRow(),cell=(v,cls)=>{const td=tr.insertCell();if(cls)td.className=cls;if(v!=null)td.textContent=v;return td};
  cell(String(r.no),'n');const s=cell('','n');s.append(Object.assign(document.createElement('span'),{className:'st st-db-'+r.status,textContent:DB_STATUS[r.status]}));
  const n=cell(r.jp);if(r.latin)n.append(document.createElement('br'),Object.assign(document.createElement('span'),{className:'sub',textContent:r.latin}));
  cell(yn(r.japanNative)+' / '+yn(r.japanEndemic),'n');
  const cc=cell(null);if(r.note)cc.append(Object.assign(document.createElement('div'),{className:'sub',textContent:r.note}));
  for(const k of r.candidates||[]){const d=document.createElement('div');d.style.marginTop='4px';const a=Object.assign(document.createElement('a'),{href:k.url,textContent:k.title,target:'_blank',rel:'noopener'});a.style.color='#b5d6be';d.append(a,document.createElement('br'),Object.assign(document.createElement('span'),{className:'sub',textContent:[k.format,k.license+(k.licenseOK==='yes'?' ✓':k.licenseOK==='no'?' ✕':' ?'),k.recordedCountry&&('録音:'+k.recordedCountry)].filter(Boolean).join(' · ')}));cc.append(d)}}
 $('dbTable').replaceChildren(t);
}
$('dbPanel').addEventListener('toggle',()=>{if($('dbPanel').open)renderDb()});$('dbFilter').onchange=renderDb;
$('dbExport').onclick=()=>{const rows=[['No','状態','対象','学名','日本分布','日本固有','候補','形式','ライセンス','採用可否','録音国','URL']];for(const r of wildDb.targets)for(const k of (r.candidates&&r.candidates.length?r.candidates:[{}]))rows.push([r.no,DB_STATUS[r.status],r.jp,r.latin,yn(r.japanNative),yn(r.japanEndemic),k.title||'',k.format||'',k.license||'',k.licenseOK||'',k.recordedCountry||'',k.url||'']);const csv='﻿'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='wildlife_master_db_v0_24.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
