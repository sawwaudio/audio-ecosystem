// v0.24 AUDIO SOURCE UI — source switch, coverage, audit table, hash verification.
const sourceAudit=JSON.parse($('ae-source-audit').textContent);
function sourceCoverage(){const R=Object.values(audioManifest.recordings),I=Object.values(audioManifest.instruments);return {rec:R.length,recPcm:R.filter(m=>m.pcm).length,recOrig:R.filter(m=>m.original).length,inst:I.length,instPcm:I.filter(m=>m.pcm).length}}
function fmtRate(n){return n?(n%1000?(n/1000).toFixed(1):n/1000)+'kHz':'—'}
function renderSourceStatus(name,info){
 const c=sourceCoverage();$('sourceMode').value=sourceMode;$('sourceBadge').textContent=SOURCE_LABEL[sourceMode];
 $('sourceCoverage').textContent=sourceMode==='pcm'?'PCM WAV：自然録音 '+c.recPcm+'/'+c.rec+' · 楽器 '+c.instPcm+'/'+c.inst+'。残り'+(c.rec-c.recPcm)+'録音は原本を保持していないため互換MP3で再生します（MP3からのWAV化は音質改善にならないため行いません）。'
  :sourceMode==='original'?'原本ファイル：自然録音 '+c.recOrig+'/'+c.rec+'（Ogg Vorbis / Opus / FLAC）。楽器は原本がWAVのためPCM WAV。原本を読み込めない場合は、原本から作ったPCM WAV、次に互換MP3の順で代替します。'
  :'互換MP3：v0.23と同じ 44.1kHz / モノラル / 128kbps。比較・互換確認用。';
 if(name&&info){const fell=info.key!==sourceMode&&!(sourceMode==='original'&&info.key==='pcm'&&!info.failedFirst);$('sourceLast').textContent='最後の読み込み：'+name+' — '+SOURCE_LABEL[info.key]+' · '+info.codec+' · '+fmtRate(info.sampleRate)+' · '+(info.channels===2?'ステレオ':info.channels===1?'モノラル':info.channels+'ch')+(fell?(info.failedFirst?'（原本を読み込めず '+SOURCE_LABEL[info.key]+' で代替）':'（指定形式なし → '+SOURCE_LABEL[info.key]+'）'):'')}
}
function setSourceMode(mode){
 if(!SOURCE_LABEL[mode]||mode===sourceMode){renderSourceStatus();return}
 sourceMode=mode;try{localStorage.setItem('ae-source-mode',mode)}catch(e){}
 stopPreview();stopBioVoices();stopFieldVoices();stopSampleVoices();
 for(const id of [...speciesBuffers.keys()])if(bufferOrigins.get(id)!=='import'){speciesBuffers.delete(id);bufferOrigins.delete(id);bufferGains.delete(id);bufferSources.delete(id)}
 instrumentBuffers.clear();instrumentGains.clear();instrumentSources.clear();instrumentUse.clear();
 $('sourceLast').textContent='音源を '+SOURCE_LABEL[mode]+' に切り替えました。次に鳴る音から反映されます。';renderSourceStatus();
 if(playing&&ctx)Promise.all(instrumentSamples.filter(r=>r.kind==='harp').map(m=>instrumentBuffer(m).catch(()=>null)));
}
$('sourceMode').onchange=e=>setSourceMode(e.target.value);
function renderAudit(){
 const t=document.createElement('table'),head=t.createTHead().insertRow();for(const h of ['状態','名称','原典','v0.24 PCM WAV','互換MP3','備考'])head.append(Object.assign(document.createElement('th'),{textContent:h}));
 const tb=t.createTBody();
 for(const a of sourceAudit){const tr=tb.insertRow(),cell=(txt,cls)=>{const td=tr.insertCell();if(cls)td.className=cls;td.textContent=txt;return td};
  const st=cell('','n');st.append(Object.assign(document.createElement('span'),{className:'st st-'+a.masterStatus,textContent:a.masterStatus}));
  const nm=cell(a.kind==='instrument'?a.id:a.name);if(a.latin)nm.append(document.createElement('br'),Object.assign(document.createElement('span'),{className:'sub',textContent:a.latin}));
  cell(a.sourceFormat+' · '+fmtRate(a.sourceRate)+' · '+a.sourceChannels+'ch · '+Number(a.sourceDuration).toFixed(1)+'s');
  cell(a.pcmPath||'—');cell(a.compat);cell(a.note)}
 $('auditTable').replaceChildren(t);
}
$('auditPanel').addEventListener('toggle',()=>{if($('auditPanel').open&&!$('auditTable').firstChild)renderAudit()});
$('exportAudit').onclick=()=>{const keys=[...new Set(sourceAudit.flatMap(Object.keys))],esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"',csv='﻿'+[keys.map(esc).join(','),...sourceAudit.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='source_audit_v0_24.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
function manifestFiles(){const out=[];for(const kind of ['recordings','instruments'])for(const [id,m] of Object.entries(audioManifest[kind]))for(const [key,e] of Object.entries(m))for(const p of entryParts(e))out.push({kind,id,key,path:p.path,bytes:p.bytes,sha256:p.sha256});return out}
async function verifyHashes(filter){
 if(!(window.crypto&&crypto.subtle))throw Error('このページではSHA-256検証を使えません（HTTPSが必要）');
 const files=manifestFiles().filter(f=>!filter||filter(f)),bad=[];let done=0,bytes=0;
 for(const f of files){try{const buf=await fetchPart(f),h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))].map(b=>b.toString(16).padStart(2,'0')).join('');bytes+=buf.byteLength;if(h!==f.sha256)bad.push(f.path+'（不一致）')}catch(e){bad.push(f.path+'（'+e.message+'）')}
  done++;$('verifyStatus').textContent='検証中 '+done+' / '+files.length+' · '+(bytes/1048576).toFixed(1)+'MB'}
 $('verifyStatus').textContent=bad.length?'不一致・失敗 '+bad.length+'件：'+bad.join(' / '):'全'+files.length+'ファイルのSHA-256一致（'+(bytes/1048576).toFixed(1)+'MB）';
 return {files:files.length,bytes,bad};
}
$('verifyHashes').onclick=()=>{$('verifyHashes').disabled=true;verifyHashes().catch(e=>$('verifyStatus').textContent=e.message).finally(()=>$('verifyHashes').disabled=false)};
renderSourceStatus();
window.__sourceDebug={get mode(){return sourceMode},setSourceMode,manifest:audioManifest,log:()=>sourceLog.slice(),failures:()=>Object.fromEntries(sourceFailures),instruments:()=>[...instrumentSources].map(([id,s])=>({id,...s})),verifyHashes,manifestFiles,joinWav,memory:()=>({pcmBytes:pcmBytes(),budget:PCM_BUDGET,species:speciesBuffers.size,instruments:instrumentBuffers.size})};
