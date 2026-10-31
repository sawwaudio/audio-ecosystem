#!/usr/bin/env python3
"""Build dist/index.html (v0.24) from the v0.23 app code.

Every patch is an exact string replacement that must match exactly once,
so an unexpected v0.23 variant fails loudly instead of silently diverging.
"""
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, 'dist')
js = open(os.path.join(ROOT, 'app.js'), encoding='utf-8').read()
body = open(os.path.join(ROOT, 'body.html'), encoding='utf-8').read()


def rep(src, old, new, label):
    n = src.count(old)
    if n != 1:
        raise SystemExit(f'patch {label}: expected 1 match, got {n}')
    return src.replace(old, new)


# ---------- 1. metadata out of code, into JSON ----------
lines = js.split('\n')
assert lines[279].startswith('const recordings=[') and lines[280].startswith('const instrumentSamples=[')
lines[279] = "const recordings=JSON.parse($('ae-recordings').textContent);"
lines[280] = "const instrumentSamples=JSON.parse($('ae-instruments').textContent);\n" + open(os.path.join(ROOT, 'src_source_layer.js'), encoding='utf-8').read()
js = '\n'.join(lines)

# ---------- 2. species decode via source layer ----------
js = rep(js,
 "evictFor(Math.ceil(((r.embeddedDuration||r.duration)+.1)*ctx.sampleRate*1*4));const text=$('preview-'+id).textContent.trim(),raw=atob(text),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);let b;try{b=await ctx.decodeAudioData(bytes.buffer)}catch(e){throw Error(r.jp+' の読み込みに失敗しました。このブラウザの音声形式対応を確認してください。')}evictFor(b.length*b.numberOfChannels*4);speciesBuffers.set(id,b);bufferOrigins.set(id,'embedded');",
 "const est=sourceCandidates('recordings',id)[0]?.entry;evictFor(Math.ceil(((est?.duration||r.embeddedDuration||r.duration)+.1)*ctx.sampleRate*(est?.channels||1)*4));let d;try{d=await decodeSource('recordings',id)}catch(e){throw Error(r.jp+' の読み込みに失敗しました（'+(e.message||e.name)+'）。'+(location.protocol==='file:'?'v0.24は音源を別ファイルから読み込むため、ローカルサーバー経由で開いてください。':'このブラウザの音声形式対応を確認してください。'))}const b=d.buffer;evictFor(b.length*b.numberOfChannels*4);speciesBuffers.set(id,b);bufferOrigins.set(id,'embedded');bufferGains.set(id,d.gain);bufferSources.set(id,sourceInfo(d));noteSource(r.jp,d);",
 'loadOne')

# ---------- 3. loudness: per-source matched gain ----------
js = rep(js, "(bufferOrigins.get(id)==='embedded'?(recordings.find(r=>r.id===id)?.performanceGain||1):1)",
         "(bufferOrigins.get(id)==='embedded'?(bufferGains.get(id)??recordings.find(r=>r.id===id)?.performanceGain??1):1)", 'bioGain')
js = rep(js, "const amp=.5*(r.performanceGain||1);", "const amp=.5*(bufferGains.get(id)??r.performanceGain??1);", 'fieldGain')

# ---------- 4. unified memory (species + instruments, LRU) ----------
js = rep(js, "function pcmBytes(){return [...speciesBuffers.values()].reduce(",
         "function pcmBytes(){return [...speciesBuffers.values(),...instrumentBuffers.values()].reduce(", 'pcmBytes')
js = rep(js, "function evictFor(bytes){for(const [id,b] of speciesBuffers){",
         "function evictFor(bytes,keepInstrument){for(const [id,b] of speciesBuffers){", 'evictSig')
js = rep(js, "speciesBuffers.delete(id);bufferOrigins.delete(id)}if(pcmBytes()+bytes>PCM_BUDGET)throw Error(",
         "speciesBuffers.delete(id);bufferOrigins.delete(id);bufferGains.delete(id);bufferSources.delete(id)}evictInstruments(bytes,keepInstrument);if(pcmBytes()+bytes>PCM_BUDGET)throw Error(", 'evictBody')

# ---------- 5. audition: native <audio> on PCM / original / MP3 ----------
js = rep(js, "const r=recordings.find(x=>x.id===id),encoded=$('preview-'+id);if(!r||!encoded){",
         "const r=recordings.find(x=>x.id===id),pick=r&&pickPreview(id);if(!r||!pick){", 'previewPick')
js = rep(js, "nativePreview.src='data:audio/mpeg;base64,'+encoded.textContent.trim();nativePreview.volume=.8;",
         "let partIndex=0,partOffset=0;nativePreview.src=pick.parts[0].path;nativePreview.volume=.8;const label=SOURCE_LABEL[pick.key];", 'previewSrc')
js = rep(js, "previewMessage('再生中：'+r.jp)};", "previewMessage('再生中：'+r.jp+' · '+label)};", 'previewPlaying')
js = rep(js, "previewMessage(r.jp+' '+nativePreview.currentTime.toFixed(1)+' / '+Math.round(nativePreview.duration||r.duration)+'秒')};",
         "previewMessage(r.jp+' · '+label+' '+(partOffset+nativePreview.currentTime).toFixed(1)+' / '+Math.round(pick.entry.duration||r.duration)+'秒')};", 'previewTime')
js = rep(js, "nativePreview.onended=()=>{if(token===previewEpoch){previewMessage('再生終了：'+r.jp);previewVoice=null}};",
         "nativePreview.onended=()=>{if(token!==previewEpoch)return;if(partIndex<pick.parts.length-1){partOffset+=pick.parts[partIndex].frames/pick.entry.sampleRate;partIndex++;nativePreview.src=pick.parts[partIndex].path;nativePreview.play().catch(()=>previewMessage('続きの再生待ち：下のプレイヤーの▶を押してください'));return}previewMessage('再生終了：'+r.jp+' · '+label);previewVoice=null};", 'previewEnded')

# ---------- 6. instruments ----------
js = rep(js, "const raw=atob($('instrument-'+meta.id).textContent.trim()),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const b=await ctx.decodeAudioData(bytes.buffer);instrumentBuffers.set(meta.id,b);return b",
         "const d=await decodeSource('instruments',meta.id),b=d.buffer;evictFor(b.length*b.numberOfChannels*4,meta.id);instrumentBuffers.set(meta.id,b);instrumentGains.set(meta.id,d.gain);instrumentSources.set(meta.id,sourceInfo(d));instrumentUse.set(meta.id,performance.now());noteSource(meta.original,d);return b", 'instrumentBuffer')
js = rep(js, "const meta=nearestSample(kind,midi),buffer=instrumentBuffers.get(meta.id);if(!buffer)return false;",
         "const meta=nearestSample(kind,midi),buffer=instrumentBuffers.get(meta.id);if(!buffer){if(ctx)instrumentBuffer(meta).catch(()=>{});return false}instrumentUse.set(meta.id,performance.now());", 'playSampleLazy')
js = rep(js, "amp=.45*velocity/Math.sqrt(Math.max(1,sampleVoices.size));",
         "amp=.45*velocity*(instrumentGains.get(meta.id)||1)/Math.sqrt(Math.max(1,sampleVoices.size));", 'playSampleGain')
js = rep(js, "const v={source,gain,pan};sampleVoices.add(v);", "const v={source,gain,pan,sid:meta.id};sampleVoices.add(v);", 'sampleVoiceId')
# start(): do not block forever on harp downloads (WAV is ~16 MB)
js = rep(js, "await Promise.all(instrumentSamples.filter(r=>r.kind==='harp').map(instrumentBuffer));",
         "{const harp=Promise.all(instrumentSamples.filter(r=>r.kind==='harp').map(m=>instrumentBuffer(m).catch(()=>null)));$('message').textContent='ハープ実録音を読み込み中（'+SOURCE_LABEL[sourceMode]+'）…';await Promise.race([harp,new Promise(r=>setTimeout(r,6000))]);harp.then(()=>{$('message').textContent='ハープ実録音：読み込み完了（'+SOURCE_LABEL[sourceMode]+'）'})}", 'startHarp')

# ---------- 7. labels / version ----------
js = rep(js, "$('realStatus').textContent='32録音を内蔵 / 必要な音だけ読み込み';", "$('realStatus').textContent='32録音 / 必要な音だけ外部ファイルから読み込み（'+SOURCE_LABEL[sourceMode]+'）';", 'loadEmbedded')
js = rep(js, "engine:'v0.23'", "engine:'v0.24',sourceMode", 'presetEngine')
js = rep(js, "decoded:()=>[...speciesBuffers].map(([id,b])=>({id,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate}))",
         "decoded:()=>[...speciesBuffers].map(([id,b])=>({id,duration:b.duration,channels:b.numberOfChannels,sampleRate:b.sampleRate,source:bufferSources.get(id)||null}))", 'debugDecoded')
js = rep(js, "window.__previewDebug=", open(os.path.join(ROOT, 'src_source_ui.js'), encoding='utf-8').read() + '\n' + open(os.path.join(ROOT, 'src_geo.js'), encoding='utf-8').read() + '\n' + open(os.path.join(ROOT, 'src_db.js'), encoding='utf-8').read() + "\nwindow.__previewDebug=", 'sourceUI')

# ---------- 8. HTML ----------
body = re.sub(r'<script type="application/octet-stream" id="[^"]+">\[\[B64:\d+\]\]</script>\s*', '', body)
assert 'octet-stream' not in body
body = rep(body, '<title>AUDIO ECOSYSTEM v0.23 — Bioacoustic Atlas</title>', '<title>AUDIO ECOSYSTEM v0.24 — Bioacoustic Atlas</title>', 'title')
body = rep(body, '<div class="micro">v0.23 · REAL RECORDINGS · 25 CORE LAYERS</div>', '<div class="micro">v0.24 · REAL RECORDINGS · PCM WAV · 25 CORE LAYERS</div>', 'header')
body = rep(body, '</style>', open(os.path.join(ROOT, 'src_source.css'), encoding='utf-8').read() + '</style>', 'css')
body = rep(body, '<details class="scenePresets"><summary>シーン設定', open(os.path.join(ROOT, 'src_geo.html'), encoding='utf-8').read() + '<details class="scenePresets"><summary>シーン設定', 'geoPanel')
body = rep(body, '<section id="performance">', open(os.path.join(ROOT, 'src_source.html'), encoding='utf-8').read() + '<section id="performance">', 'sourceSection')

data = os.path.join(D, 'data')
def inline(id_, path):
    txt = json.dumps(json.load(open(os.path.join(data, path), encoding='utf-8')), ensure_ascii=False, separators=(',', ':'))
    return f'<script type="application/json" id="{id_}">' + txt.replace('</', '<\\/') + '</script>\n'

html = (body + inline('ae-recordings', 'recording_licenses.json') + inline('ae-instruments', 'instrument_samples.json')
        + inline('ae-audio-manifest', 'audio_manifest.json') + inline('ae-wildlife-meta', 'wildlife_meta.json') + inline('ae-wildlife-db', 'wildlife_master_db.json') + inline('ae-source-audit', 'source_audit.json')
        + '<script>\n' + js + '\n</script>\n</body></html>\n')
open(os.path.join(D, 'index.html'), 'w', encoding='utf-8').write(html)
print('index.html', len(html.encode()))
