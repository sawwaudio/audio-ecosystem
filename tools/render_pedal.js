// NATURE × PEDALS の音（2026-11-28 オーナー「エフェクター、ルーパー類使って音色変えて遊ぶ動画欲しい。どのエフェクター使ってるか、うるさすぎないかなどに配慮」）。
// 公開アプリのペダル（window.__pedals.makePedal。アプリと同じ処理）を OfflineAudioContext で鳴らし、実録音1件を加工した WAV を書く。
// v2（2026-11-28「俯瞰して神改善」）：
//  - 切り替えの台本（events）：各時刻に「オンにしておくもの」の一覧。最初から全部オン（完成形を最初の1秒で聴かせる）→ 全部オフ（元の録音）→ 1台ずつ足す → オフ/オンの聴き比べ。
//  - 先に preroll 秒だけ鳴らしてから切り取る（最初のコマから残響・ディレイが育った状態）。最後も全部オンで終わるので、繰り返し再生でつながる。
//  - うるささ：1回目に区間ごとの音量を測り、2回目はペダルが入っている区間を元の録音の音量にそろえる（0.5〜1.4倍）。最後に軽いリミッター。
//  - 同じ録音・同じペダルをアプリで鳴らす共有リンク（#p=…）も作る（ルーパーは共有リンクに入らない）。
// 使い方（アプリ本体のフォルダで python3 -m http.server 8765 を起動してから）：node tools/render_pedal.js job.json out.wav → 標準出力に JSON
// job.json：{"url":"http://localhost:8765/index.html?lang=en","rec":"loon-3","group":"species|field","start":3.0,"sec":22,"preroll":3,
//            "looper":{"from":0.4,"len":2.0,"bed":0.35}|null,"pedals":[{"id":"pitchdelay","v":{...}},...],
//            "events":[{"t":0,"on":["looper",0,1]},{"t":1.7,"on":[]},...]}   ← on の数字は pedals の番号
const {chromium} = require('playwright'); const fs = require('fs');
(async () => {
  const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), out = process.argv[3];
  const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(job.url || 'http://localhost:8765/index.html?lang=en'); await pg.waitForFunction(() => window.__pedals && window.__pedals.makePedal && window.__share, null, {timeout: 30000}); await pg.waitForTimeout(1500);
  const r = await pg.evaluate(async job => {
    const SR = 48000, man = JSON.parse(document.getElementById('ae-audio-manifest').textContent).recordings;
    const e = man[job.rec]; if (!e) throw Error('no recording ' + job.rec);
    const path = (e.pcm || e.compat).parts[0].path; const raw = await (await fetch(path)).arrayBuffer();
    const sec = job.sec, PR = job.preroll ?? 3, N = Math.ceil((sec + PR) * SR), ev = job.events.slice().sort((a, b) => a.t - b.t);
    const isOn = (t, k) => { let cur = ev[0].on; for (const x of ev) if (x.t <= t) cur = x.on; return cur.includes(k) };
    async function render(gains) {
      const oc = new OfflineAudioContext(2, N, SR); const ab = await oc.decodeAudioData(raw.slice(0)); await __pedals.ready(oc);
      const T = t => t + PR;  // 動画の時刻 → 描画の時刻
      const src = oc.createBufferSource(), sg = oc.createGain(), sum = oc.createGain(), comp = oc.createGain(), lim = oc.createDynamicsCompressor(), fade = oc.createGain();
      src.buffer = ab; src.connect(sg); sg.connect(sum);
      let lg = null;
      if (job.looper) { const L = job.looper, ls = oc.createBufferSource(); lg = oc.createGain(); ls.buffer = ab; ls.loop = true; ls.loopStart = job.start + L.from; ls.loopEnd = job.start + L.from + L.len;
        ls.connect(lg); lg.connect(sum); lg.gain.value = 0; ls.start(0, job.start + L.from) }
      let node = sum; const P = [];
      job.pedals.forEach((s, i) => { const def = __pedals.def[s.id], v = {}; for (const k of def.knobs) v[k.k] = k.def; if (def.steps) v[def.steps.k] = def.steps.def; Object.assign(v, s.v || {});
        const p = __pedals.makePedal(oc, s.id, v); p.ap(); node.connect(p.input); node = p.output; P.push(p) });
      node.connect(comp); comp.connect(lim); lim.connect(fade); fade.connect(oc.destination);
      lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.15;
      // 台本：preroll の頭（描画 0 秒）で最初の状態にし、各時刻で切り替える
      const apply = on => { P.forEach((p, i) => p.setOn(on.includes(i)));
        if (lg) { const t = oc.currentTime, lp = on.includes('looper'); lg.gain.cancelScheduledValues(t); lg.gain.setValueAtTime(lg.gain.value, t); lg.gain.linearRampToValueAtTime(lp ? 1 : 0, t + (lp ? 0.03 : 0.06));
          sg.gain.cancelScheduledValues(t); sg.gain.setValueAtTime(sg.gain.value, t); sg.gain.linearRampToValueAtTime(lp ? (job.looper.bed ?? 0.35) : 1, t + 0.3) } };
      const q = t => Math.round(t * SR / 128) * 128 / SR;
      oc.suspend(q(0.01)).then(() => { apply(ev[0].on); oc.resume() });
      for (const x of ev.slice(1)) oc.suspend(q(T(x.t))).then(() => { apply(x.on); oc.resume() });
      // 区間ごとの音量合わせ（2回目だけ）
      const mk = ev.map(x => x.t); comp.gain.value = gains ? gains[0] : 1;
      if (gains) mk.forEach((t, i) => { if (i) comp.gain.setTargetAtTime(gains[i], T(t), 0.12) });
      fade.gain.setValueAtTime(1, 0); fade.gain.setValueAtTime(1, T(sec) - 0.35); fade.gain.linearRampToValueAtTime(0, T(sec));
      src.start(Math.max(0, PR - job.start), Math.max(0, job.start - PR)); const buf = await oc.startRendering(); for (const p of P) try { p.stop() } catch (e) {} return buf }
    const mk = ev.map(x => x.t), ends = [...mk.slice(1), sec - 0.35];
    const seg = buf => { const L = buf.getChannelData(0), R = buf.getChannelData(1); return mk.map((t, i) => { const a = Math.floor((PR + t + (i ? 0.35 : 0.05)) * SR), z = Math.floor((PR + ends[i]) * SR); let s = 0; for (let k = a; k < z; k++) s += (L[k] * L[k] + R[k] * R[k]) / 2; return Math.sqrt(s / Math.max(1, z - a)) }) };
    const b1 = await render(null), r1 = seg(b1);
    // 基準＝元の録音（ペダルなし）のこの区間全体の音量
    const ab0 = await new OfflineAudioContext(2, SR, SR).decodeAudioData(raw.slice(0)); let ss = 0, nn = 0;
    for (let c = 0; c < ab0.numberOfChannels; c++) { const d = ab0.getChannelData(c), a0 = Math.floor(job.start * ab0.sampleRate), z0 = Math.min(d.length, a0 + Math.floor(sec * ab0.sampleRate)); for (let k = a0; k < z0; k++) { ss += d[k] * d[k]; nn++ } }
    const ref = Math.sqrt(ss / Math.max(1, nn));
    // 合わせる先：この動画の中の「元の録音だけ」の区間（BEFORE・BYPASS）の音量。聴き比べで、加工後が大きく（または小さく）聞こえないように
    const dryR = r1.filter((x, i) => ev[i].on.length === 0), tgt = dryR.length ? Math.sqrt(dryR.reduce((s, x) => s + x * x, 0) / dryR.length) : ref;
    const gains = r1.map((x, i) => ev[i].on.length === 0 ? 1 : Math.min(1.4, Math.max(0.4, tgt / Math.max(x, 1e-6))));
    const b2 = await render(gains), r2 = seg(b2);
    const o0 = Math.floor(PR * SR), M = N - o0, L = b2.getChannelData(0), R = b2.getChannelData(1), pcm = new Int16Array(M * 2); let peak = 0;
    for (let i = 0; i < M; i++) { const l = L[o0 + i], rr = R[o0 + i]; peak = Math.max(peak, Math.abs(l), Math.abs(rr)); pcm[2 * i] = Math.max(-32767, Math.min(32767, l * 32767)); pcm[2 * i + 1] = Math.max(-32767, Math.min(32767, rr * 32767)) }
    let bin = ''; const u8 = new Uint8Array(pcm.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    const db = x => +(20 * Math.log10(Math.max(x, 1e-6))).toFixed(1);
    // 共有リンク：この録音だけを鳴らし、アプリの合成音は止め、同じペダルを全体にかけた状態
    let link = null;
    try { const D = window.__audioEcosystemDebug, d = D.exportData();
      for (const k of Object.keys(d.species)) d.species[k].enabled = false; for (const k of Object.keys(d.field.levels)) d.field.levels[k] = 0;
      if (d.species[job.rec]) { d.species[job.rec].enabled = true; d.species[job.rec].level = 80; d.species[job.rec].rest = 2 } else if (job.rec in d.field.levels) d.field.levels[job.rec] = 80;
      for (const k of ['didge', 'organPedal', 'water', 'trees', 'wind', 'rain', 'river', 'fire', 'bubbles', 'avalanche', 'birds', 'insects', 'animals']) if (k in d.p) d.p[k] = 0;
      d.layers = {...(d.layers || {}), synthOff: true};
      d.pedals = {v: 2, target: 'master', chain: job.pedals.map(s => { const def = __pedals.def[s.id], v = {}; for (const k of def.knobs) v[k.k] = k.def; if (def.steps) v[def.steps.k] = def.steps.def; return {id: s.id, on: true, v: Object.assign(v, s.v || {})} })};
      D.applyData(d); await new Promise(r => setTimeout(r, 300)); const l = await __share.link(); link = typeof l === 'string' ? l : (l && (l.url || l.link)) || null } catch (err) { link = 'ERROR ' + err.message }
    return {b64: btoa(bin), sr: SR, marks: mk, ref_db: db(ref), target_db: db(tgt), before_db: r1.map(db), gains_db: gains.map(db), after_db: r2.map(db), peak_db: db(peak), path, link};
  }, job);
  const data = Buffer.from(r.b64, 'base64'), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(r.sr, 24); h.writeUInt32LE(r.sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(out, Buffer.concat([h, data])); delete r.b64; r.errors = errs; console.log(JSON.stringify(r)); await b.close();
})().catch(e => { console.error(e); process.exit(1) });
