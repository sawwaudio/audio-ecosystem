// v0.24 AUDIO SOURCE LAYER — audio lives in separate files described by data/audio_manifest.json.
// pcm: Linear PCM WAV (VCSL masters / bit-exact FLAC decode / decode of the lossy ORIGINAL, never of the MP3)
// original: the archived original bytes (Ogg Vorbis / Opus / FLAC) · compat: v0.23 MP3, always kept as fallback.
const audioManifest=JSON.parse($('ae-audio-manifest').textContent);
const SOURCE_LABEL={pcm:'PCM WAV',original:'原本ファイル',compat:'互換MP3'};
let sourceMode='pcm';try{const s=localStorage.getItem('ae-source-mode');if(SOURCE_LABEL[s])sourceMode=s}catch(e){}
const bufferGains=new Map(),bufferSources=new Map(),instrumentGains=new Map(),instrumentSources=new Map(),instrumentUse=new Map(),sourceFailures=new Map(),sourceLog=[];
function sourceCandidates(kind,id){const m=audioManifest[kind]&&audioManifest[kind][id];if(!m)return [];const order=sourceMode==='pcm'?['pcm','compat']:sourceMode==='original'?['original','pcm','compat']:['compat'];/* instruments: the VCSL original IS the PCM WAV */return order.filter(k=>m[k]).map(k=>({key:k,entry:m[k]}))}
function entryParts(e){return e.parts||[{path:e.path,bytes:e.bytes,sha256:e.sha256,frames:Math.round((e.duration||0)*(e.sampleRate||44100))}]}
async function fetchPart(part){const res=await fetch(part.path);if(!res.ok)throw Error('HTTP '+res.status+' '+part.path);const buf=await res.arrayBuffer();if(part.bytes&&buf.byteLength!==part.bytes)throw Error('サイズ不一致 '+part.path);return buf}
// Concatenate the data chunks of WAV parts that share one fmt chunk, so a long take decodes (and resamples) as ONE buffer: no seam.
function joinWav(buffers){
 if(buffers.length===1)return buffers[0];let fmt=null;const datas=[];
 for(const b of buffers){const v=new DataView(b);let o=12,f=null,d=null;while(o+8<=b.byteLength){const tag=String.fromCharCode(v.getUint8(o),v.getUint8(o+1),v.getUint8(o+2),v.getUint8(o+3)),n=v.getUint32(o+4,true);if(tag==='fmt ')f=new Uint8Array(b,o+8,n);if(tag==='data'){d=new Uint8Array(b,o+8,Math.min(n,b.byteLength-o-8));break}o+=8+n+(n&1)}
  if(!f||!d)throw Error('WAV構造エラー');if(fmt&&fmt.join()!==f.join())throw Error('WAV分割ファイルの形式不一致');fmt=f;datas.push(d)}
 const total=datas.reduce((n,d)=>n+d.length,0),out=new Uint8Array(20+fmt.length+8+total),v=new DataView(out.buffer),w4=(o,s)=>{for(let i=0;i<4;i++)out[o+i]=s.charCodeAt(i)};
 w4(0,'RIFF');v.setUint32(4,out.length-8,true);w4(8,'WAVE');w4(12,'fmt ');v.setUint32(16,fmt.length,true);out.set(fmt,20);let o=20+fmt.length;w4(o,'data');v.setUint32(o+4,total,true);o+=8;for(const d of datas){out.set(d,o);o+=d.length}return out.buffer}
async function decodeSource(kind,id){
 let lastError=null;
 for(const {key,entry} of sourceCandidates(kind,id)){
  try{const parts=await Promise.all(entryParts(entry).map(fetchPart)),bytes=entry.format==='wav'?joinWav(parts):parts[0],buffer=await ctx.decodeAudioData(bytes);return {buffer,key,entry,gain:entry.gain||1,kind,id}}
  catch(e){lastError=e;sourceFailures.set(kind+':'+id+':'+key,(e&&e.message)||String(e))}
 }
 throw lastError||Error('音源がありません');
}
function sourceInfo(d){const e=d.entry;return {key:d.key,requested:sourceMode,codec:e.codec||e.format,sampleRate:e.sampleRate,channels:e.channels,bitDepth:e.bitDepth||null,lossless:!!e.lossless,failedFirst:sourceFailures.has(d.kind+':'+d.id+':'+sourceMode)}}
function evictInstruments(bytes,keep){if(pcmBytes()+bytes<=PCM_BUDGET)return;const busy=new Set([...sampleVoices].map(v=>v.sid));for(const [id] of [...instrumentUse].sort((a,b)=>a[1]-b[1])){if(pcmBytes()+bytes<=PCM_BUDGET)break;if(id===keep||busy.has(id))continue;instrumentBuffers.delete(id);instrumentGains.delete(id);instrumentSources.delete(id);instrumentUse.delete(id)}}
const PREVIEW_MIME={wav:'audio/wav',mp3:'audio/mpeg',vorbis:'audio/ogg; codecs="vorbis"',opus:'audio/ogg; codecs="opus"',flac:'audio/flac'};
function pickPreview(id){for(const {key,entry} of sourceCandidates('recordings',id)){if(key!=='compat'&&!nativePreview.canPlayType(PREVIEW_MIME[entry.format]||''))continue;return {key,entry,parts:entryParts(entry)}}return null}
function noteSource(name,d){const i=sourceInfo(d);sourceLog.push({name,...i,time:Date.now()});if(sourceLog.length>40)sourceLog.shift();if(typeof renderSourceStatus==='function')renderSourceStatus(name,i)}
