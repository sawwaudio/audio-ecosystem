// ペダルで遊ぶ動画の音（2026-11-28 オーナー「エフェクター、ルーパー類使って音色変えて遊ぶ動画欲しい。どのエフェクター使ってるか、うるさすぎないかなどに配慮」）。
// 公開アプリのペダル（window.__pedals.makePedal。アプリの音と同じ処理）を OfflineAudioContext で鳴らし、実録音1件を加工した WAV を書く。
// うるささへの配慮：1回目に区間ごとの音量を測り、2回目は区間ごとに出口の音量を元の音（ペダルなし）にそろえる（±6 dB まで）。最後に軽いリミッター。
// 使い方（アプリ本体のフォルダで python3 -m http.server 8765 を起動してから）：
//   node tools/render_pedal.js job.json out.wav   → 標準出力に区間ごとの音量（JSON）
// job.json：{"url":"http://localhost:8765/index.html","rec":"blackbird","start":3.0,"sec":22,"fade":1.5,
//            "looper":{"at":2.5,"len":2.0,"bed":0.35}|null,"steps":[{"t":2.5,"id":"memorydelay","v":{...}},...]}
const {chromium} = require('playwright'); const fs = require('fs');
(async () => {
  const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), out = process.argv[3];
  const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(job.url || 'http://localhost:8765/index.html?lang=en'); await pg.waitForFunction(() => window.__pedals && window.__pedals.makePedal, null, {timeout: 30000});
  const r = await pg.evaluate(async job => {
    const SR = 48000, man = JSON.parse(document.getElementById('ae-audio-manifest').textContent).recordings;
    const e = man[job.rec]; if (!e) throw Error('no recording ' + job.rec);
    const path = (e.pcm || e.compat).parts[0].path; const raw = await (await fetch(path)).arrayBuffer();
    const sec = job.sec, N = Math.ceil(sec * SR);
    const marks = [0, ...[...new Set([...(job.steps || []).map(s => s.t), ...(job.looper ? [job.looper.at] : [])])].sort((a, b) => a - b), sec - (job.fade || 1.5)];
    async function render(gains) {
      const oc = new OfflineAudioContext(2, N, SR); const ab = await oc.decodeAudioData(raw.slice(0)); await __pedals.ready(oc);
      const src = oc.createBufferSource(), sg = oc.createGain(), sum = oc.createGain(), comp = oc.createGain(), lim = oc.createDynamicsCompressor(), fade = oc.createGain();
      src.buffer = ab; src.connect(sg); sg.connect(sum);
      // ルーパー：それまでに鳴った len 秒をすくって繰り返す（元の音は bed の大きさで下に残す）
      if (job.looper) { const L = job.looper; if (job.start + L.at - L.len < 0) throw Error('looper starts before the excerpt'); const ls = oc.createBufferSource(), lg = oc.createGain(); ls.buffer = ab; ls.loop = true; ls.loopStart = job.start + L.at - L.len; ls.loopEnd = job.start + L.at; ls.connect(lg); lg.connect(sum); lg.gain.value = 0;
        ls.start(L.at, job.start + L.at - L.len); lg.gain.setValueAtTime(0, L.at); lg.gain.linearRampToValueAtTime(1, L.at + 0.03); sg.gain.setValueAtTime(1, L.at); sg.gain.linearRampToValueAtTime(L.bed ?? 0.35, L.at + 0.4) }
      let node = sum; const P = [];
      for (const s of job.steps || []) { const def = __pedals.def[s.id], v = {}; for (const k of def.knobs) v[k.k] = k.def; if (def.steps) v[def.steps.k] = def.steps.def; Object.assign(v, s.v || {});
        const p = __pedals.makePedal(oc, s.id, v); p.ap(); node.connect(p.input); node = p.output; P.push([s, p]) }
      node.connect(comp); comp.connect(lim); lim.connect(fade); fade.connect(oc.destination);
      lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.15;
      // 区間ごとの音量合わせ（2回目だけ）。切り替えの前後 0.4 秒でなめらかに
      comp.gain.value = gains ? gains[0] : 1; if (gains) marks.slice(1, -1).forEach((t, i) => comp.gain.setTargetAtTime(gains[i + 1], t, 0.25));
      const fs_ = job.fade || 1.5; fade.gain.setValueAtTime(0, 0); fade.gain.linearRampToValueAtTime(1, 0.12); fade.gain.setValueAtTime(1, sec - fs_); fade.gain.linearRampToValueAtTime(0, sec);
      for (const [s, p] of P) oc.suspend(Math.round(s.t * SR / 128) * 128 / SR).then(() => { p.setOn(true); oc.resume() });
      src.start(0, job.start); const buf = await oc.startRendering(); for (const [, p] of P) try { p.stop() } catch (e) {} return buf }
    const seg = buf => { const L = buf.getChannelData(0), R = buf.getChannelData(1); return marks.slice(0, -1).map((t, i) => { const a = Math.floor((t + (i ? 0.6 : 0.2)) * SR), z = Math.floor(marks[i + 1] * SR); let s = 0; for (let k = a; k < z; k++) s += (L[k] * L[k] + R[k] * R[k]) / 2; return Math.sqrt(s / Math.max(1, z - a)) }) };
    const b1 = await render(null), r1 = seg(b1);
    // 基準＝元の録音（ペダルなし）のこの区間全体の音量。ペダルを足した区間はこれにそろえる（元の音だけの最初の区間はそのまま）
    const ab0 = await new OfflineAudioContext(2, SR, SR).decodeAudioData(raw.slice(0)); let ss = 0, nn = 0;
    for (let c = 0; c < ab0.numberOfChannels; c++) { const d = ab0.getChannelData(c), a0 = Math.floor(job.start * ab0.sampleRate), z0 = Math.min(d.length, a0 + Math.floor(sec * ab0.sampleRate)); for (let k = a0; k < z0; k++) { ss += d[k] * d[k]; nn++ } }
    const ref = Math.sqrt(ss / Math.max(1, nn));
    const gains = r1.map((x, i) => i === 0 ? 1 : Math.min(1.4, Math.max(0.5, ref / Math.max(x, 1e-6))));
    const b2 = await render(gains), r2 = seg(b2);
    const L = b2.getChannelData(0), R = b2.getChannelData(1), pcm = new Int16Array(N * 2); let peak = 0;
    for (let i = 0; i < N; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); pcm[2 * i] = Math.max(-32767, Math.min(32767, L[i] * 32767)); pcm[2 * i + 1] = Math.max(-32767, Math.min(32767, R[i] * 32767)) }
    let bin = ''; const u8 = new Uint8Array(pcm.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    const db = x => +(20 * Math.log10(Math.max(x, 1e-6))).toFixed(1);
    return {b64: btoa(bin), sr: SR, marks, ref_db: db(ref), before_db: r1.map(db), gains_db: gains.map(db), after_db: r2.map(db), peak_db: db(peak), path};
  }, job);
  const data = Buffer.from(r.b64, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(r.sr, 24); h.writeUInt32LE(r.sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(out, Buffer.concat([h, data])); delete r.b64; r.errors = errs; console.log(JSON.stringify(r)); await b.close();
})().catch(e => { console.error(e); process.exit(1) });
