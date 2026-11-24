// v0.84 録音の買い取り（2026-11-24 オーナー指示）
// 「SAE ユーザーから質の良い録音を集めたい。課金ユーザーに限り、音源を1ドルで買い取る（質は自分で確かめて可否を決める）。
//   買い取った分は課金と相殺する。月に5ドルまで」
//
// 流れ：
//   1. 課金中（SEMI-PRO・PRO）の人がアプリから録音を送る（POST /recordings）。証明（JWT）と Stripe の契約状態で確かめる。
//   2. オーナーがアプリの管理者モードで聴いて、採用・不採用を決める（/admin/recordings…）。管理者は、アプリと同じ署名の管理者パス、
//      または登録済み端末の証明＋その端末の鍵の署名で確かめる。
//   3. 採用すると、その人の Stripe の残高に -US$1 を付ける（次回以降の請求から差し引かれる。現金は払わない）。
//      1人あたり、採用は日本時間の暦月で5本（US$5）まで。STRIPE_CREDIT_KEY（Customers の書き込みだけの制限付きキー）が無い間は、
//      採用を記録し、オーナーが Stripe の画面で残高を付ける（管理画面に顧客へのリンクを出す）。
// 保存：KV（1本 20MB まで）。不採用は30日、審査待ちと採用は消さない（採用分はオーナーが音源に取り込んだ後に消す）。
// 利用者の声や個人情報を集めないため、送る前に「自分で録った・人の声や音楽が入っていない」の確認を必須にする。

export const REC_MAX_BYTES = 20 * 1024 * 1024;
export const REC_PER_MONTH_APPROVED = 5;   // 採用（= US$1）の上限、暦月（日本時間）
export const REC_PER_MONTH_SUBMIT = 15;    // 送れる本数の上限、暦月（迷惑な大量送信を防ぐ）
export const REC_CREDIT_CENTS = 100;
export const REC_TERMS_VERSION = '2026-11-25';
const AUDIO_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/flac', 'audio/x-flac', 'audio/aiff', 'audio/x-aiff', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/opus', 'audio/webm']);
const STUDIO_PUBLIC_KEY = { kty: 'EC', crv: 'P-256', x: 'n9AJGHmG7scZ-sSMfgY60Q12HGtxBWAXGNnVGzi1ZsE', y: '_V3fn6OoOlvSlJxpX5I9bz2C-U-Ia7sKnFUtscsHNu4' };
const STUDIO_AUDIENCES = ['https://sawwaudio.github.io/audio-ecosystem/', 'https://sawwaudio.github.io/audio-ecosystem-sounds-1/'];
const enc = new TextEncoder(), dec = new TextDecoder();
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
const b64uText = s => btoa(String.fromCharCode(...enc.encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64uJSON = s => JSON.parse(dec.decode(unb64u(s)));
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
export const monthJST = (t = Date.now() / 1000) => { const d = new Date((t + 9 * 3600) * 1000); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); };

function corsFor(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allow = String(env.ALLOWED_ORIGINS || (env.APP_URL ? new URL(env.APP_URL).origin : '')).split(',').map(s => s.trim()).filter(Boolean);
  if (env.TEST_ORIGIN) allow.push(env.TEST_ORIGIN);
  return allow.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Saww-Admin, X-Saww-Meta', 'Access-Control-Max-Age': '600', Vary: 'Origin' } : {};
}
const out = (obj, status, h) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(h || {}) } });

// ── 管理者の確認 ──
// X-Saww-Admin: "pass.<管理者パス>" または "device.<端末の証明>.<時刻>.<署名>"（署名 = 端末の鍵で `${時刻}.${METHOD}.${path}`）
export async function verifyAdmin(req, env) {
  const h = req.headers.get('X-Saww-Admin') || '';
  const key = await crypto.subtle.importKey('jwk', env.STUDIO_PUBLIC_KEY_JWK ? JSON.parse(env.STUDIO_PUBLIC_KEY_JWK) : STUDIO_PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const aud = env.STUDIO_AUDIENCES ? String(env.STUDIO_AUDIENCES).split(',') : STUDIO_AUDIENCES;
  const algo = { name: 'ECDSA', hash: 'SHA-256' }, t = Date.now() / 1000;
  try {
    if (h.startsWith('pass.')) {
      const [body, sig] = h.slice(5).split('.');
      if (!body || !sig || h.length > 2100) return false;
      if (!(await crypto.subtle.verify(algo, key, unb64u(sig), enc.encode(body)))) return false;
      const c = fromB64uJSON(body);
      return c.role === 'studio-admin' && aud.includes(c.aud) && Number.isSafeInteger(c.exp) && Number.isSafeInteger(c.iat) && c.iat <= t + 30 && c.exp > t && c.exp - c.iat <= 3600;
    }
    if (h.startsWith('device.')) {
      const [grantB, grantSig, ts, reqSig] = h.slice(7).split('.');
      if (!grantB || !grantSig || !ts || !reqSig || h.length > 3000) return false;
      if (!(await crypto.subtle.verify(algo, key, unb64u(grantSig), enc.encode(grantB)))) return false;
      const g = fromB64uJSON(grantB);
      if (g.role !== 'studio-device' || !aud.includes(g.aud) || typeof g.key !== 'string') return false;
      const n = Number(ts);
      if (!Number.isFinite(n) || Math.abs(t - n) > 120) return false;
      const dk = await crypto.subtle.importKey('raw', unb64u(g.key), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const path = new URL(req.url).pathname;
      return await crypto.subtle.verify(algo, dk, unb64u(reqSig), enc.encode(ts + '.' + req.method + '.' + path));
    }
  } catch (e) { return false; }
  return false;
}

async function listAll(env, prefix, limit = 1000) {
  const keys = []; let cursor;
  do { const r = await env.SAWW_KV.list({ prefix, cursor, limit: Math.min(1000, limit - keys.length) }); keys.push(...r.keys); cursor = r.list_complete ? null : r.cursor; } while (cursor && keys.length < limit);
  return keys;
}
const getRec = async (env, id) => JSON.parse((await env.SAWW_KV.get('recsub:' + id)) || 'null');
const putRec = (env, r, ttl) => env.SAWW_KV.put('recsub:' + r.id, JSON.stringify(r), ttl ? { expirationTtl: ttl } : undefined);
async function counts(env, cus, month) {
  const keys = await listAll(env, 'recby:' + cus + ':' + month + ':', 200);
  let submitted = 0, approved = 0;
  for (const k of keys) { submitted++; if (k.metadata && k.metadata.status === 'approved') approved++; }
  return { submitted, approved };
}
const publicView = r => ({ id: r.id, title: r.title, place: r.place, recordedOn: r.recordedOn, status: r.status, note: r.status === 'rejected' ? r.note || '' : '', at: r.at, decidedAt: r.decidedAt || null, credit: r.status === 'approved' ? r.credit || null : null });

// Stripe の残高に -US$1（請求から差し引き）。冪等キーで二重に付けない
async function creditCustomer(env, rec) {
  if (!env.STRIPE_CREDIT_KEY) return { mode: 'manual' };
  const body = new URLSearchParams({ amount: String(-REC_CREDIT_CENTS), currency: 'usd', description: 'saww audio ecosystem recording purchase ' + rec.id, 'metadata[recording]': rec.id });
  const r = await fetch((env.STRIPE_API || 'https://api.stripe.com') + '/v1/customers/' + encodeURIComponent(rec.cus) + '/balance_transactions', { method: 'POST', headers: { Authorization: 'Bearer ' + env.STRIPE_CREDIT_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': 'saww-rec-' + rec.id }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { mode: 'error', error: (j.error && j.error.message) || ('stripe ' + r.status) };
  return { mode: 'auto', txn: j.id };
}

// deps: { readToken, freshRec, isPro }
export async function recordingsRoute(req, env, deps) {
  const url = new URL(req.url), path = url.pathname;
  if (!(path === '/recordings' || path.startsWith('/recordings/') || path.startsWith('/admin/recordings'))) return null;
  const h = corsFor(env, req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

  // ── 利用者：送る ──
  if (path === '/recordings' && req.method === 'POST') {
    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const pl = await deps.readToken(env, tok);
    if (!pl || !pl.sub || pl.typ || pl.exp < Date.now() / 1000) return out({ ok: false, error: 'token' }, 401, h);
    const rec = await deps.freshRec(env, pl.sub, 3600);
    if (!deps.isPro(rec)) return out({ ok: false, error: 'plan' }, 403, h);
    let meta;
    try { meta = fromB64uJSON(req.headers.get('X-Saww-Meta') || ''); } catch (e) { return out({ ok: false, error: 'meta' }, 400, h); }
    const type = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPES.has(type)) return out({ ok: false, error: 'type' }, 415, h);
    const len = Number(req.headers.get('Content-Length') || 0);
    if (len > REC_MAX_BYTES) return out({ ok: false, error: 'size' }, 413, h);
    if (!meta || meta.terms !== REC_TERMS_VERSION || meta.own !== true || meta.noPeople !== true || meta.license !== true) return out({ ok: false, error: 'terms' }, 400, h);
    const title = clip(meta.title, 120);
    if (title.length < 2) return out({ ok: false, error: 'title' }, 400, h);
    const month = monthJST();
    const c = await counts(env, pl.sub, month);
    if (c.submitted >= REC_PER_MONTH_SUBMIT) return out({ ok: false, error: 'limit', month, ...c }, 429, h);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > REC_MAX_BYTES) return out({ ok: false, error: 'size' }, 413, h);
    const id = crypto.randomUUID();
    const r = { id, cus: pl.sub, plan: rec.plan === 'semi' ? 'semi' : 'pro', month, at: Math.floor(Date.now() / 1000), status: 'pending', type, size: buf.byteLength,
      title, place: clip(meta.place, 120), recordedOn: clip(meta.recordedOn, 20), credit: clip(meta.creditName, 60), gear: clip(meta.gear, 120), memo: clip(meta.memo, 500), terms: REC_TERMS_VERSION, name: clip(meta.fileName, 120) };
    await env.SAWW_KV.put('recaudio:' + id, buf, { metadata: { type } });
    await putRec(env, r);
    await env.SAWW_KV.put('recby:' + pl.sub + ':' + month + ':' + id, '1', { metadata: { status: 'pending' } });
    await env.SAWW_KV.put('recq:' + String(r.at).padStart(12, '0') + ':' + id, '1', { metadata: { status: 'pending' } });
    return out({ ok: true, id, month, submitted: c.submitted + 1, approved: c.approved, limit: REC_PER_MONTH_APPROVED }, 200, h);
  }
  // ── 利用者：自分の送った録音 ──
  if (path === '/recordings/mine' && req.method === 'POST') {
    let body = {}; try { body = await req.json(); } catch (e) {}
    const pl = await deps.readToken(env, body.token);
    if (!pl || !pl.sub || pl.typ) return out({ ok: false, error: 'token' }, 401, h);
    const month = monthJST();
    const keys = await listAll(env, 'recby:' + pl.sub + ':', 200);
    const items = [];
    for (const k of keys.slice(-60)) { const r = await getRec(env, k.name.split(':').pop()); if (r) items.push(publicView(r)); }
    items.sort((a, b) => b.at - a.at);
    const c = await counts(env, pl.sub, month);
    return out({ ok: true, month, ...c, limit: REC_PER_MONTH_APPROVED, items }, 200, h);
  }

  // ── 管理者 ──
  if (path.startsWith('/admin/recordings')) {
    if (!(await verifyAdmin(req, env))) return out({ ok: false, error: 'admin' }, 401, h);
    const parts = path.split('/').filter(Boolean); // admin, recordings, :id?, audio?
    if (parts.length === 2 && req.method === 'GET') {
      const status = url.searchParams.get('status') || 'pending';
      const keys = await listAll(env, 'recq:', 500);
      const items = [];
      for (const k of keys.reverse()) {
        if (status !== 'all' && (!k.metadata || k.metadata.status !== status)) continue;
        const r = await getRec(env, k.name.split(':').pop()); if (!r) continue;
        const c = await counts(env, r.cus, r.month);
        items.push({ ...r, monthApproved: c.approved, stripeUrl: 'https://dashboard.stripe.com/customers/' + r.cus });
        if (items.length >= 50) break;
      }
      return out({ ok: true, items, autoCredit: !!env.STRIPE_CREDIT_KEY, limit: REC_PER_MONTH_APPROVED }, 200, h);
    }
    const id = parts[2];
    if (!/^[0-9a-f-]{36}$/.test(id || '')) return out({ ok: false, error: 'id' }, 400, h);
    const r = await getRec(env, id);
    if (!r) return out({ ok: false, error: 'missing' }, 404, h);
    if (parts[3] === 'audio' && req.method === 'GET') {
      const a = await env.SAWW_KV.getWithMetadata('recaudio:' + id, { type: 'arrayBuffer' });
      if (!a || !a.value) return out({ ok: false, error: 'missing' }, 404, h);
      return new Response(a.value, { headers: { 'Content-Type': (a.metadata && a.metadata.type) || r.type || 'application/octet-stream', 'Cache-Control': 'no-store', ...h } });
    }
    if (parts.length === 3 && req.method === 'POST') {
      let body = {}; try { body = await req.json(); } catch (e) {}
      if (r.status !== 'pending') return out({ ok: false, error: 'decided', status: r.status }, 409, h);
      const qKey = 'recq:' + String(r.at).padStart(12, '0') + ':' + id, byKey = 'recby:' + r.cus + ':' + r.month + ':' + id;
      if (body.action === 'reject') {
        r.status = 'rejected'; r.note = clip(body.note, 300); r.decidedAt = Math.floor(Date.now() / 1000);
        const ttl = 30 * 86400;
        await putRec(env, r, ttl);
        await env.SAWW_KV.put('recaudio:' + id, (await env.SAWW_KV.get('recaudio:' + id, { type: 'arrayBuffer' })) || new ArrayBuffer(0), { expirationTtl: ttl, metadata: { type: r.type } });
        await env.SAWW_KV.put(qKey, '1', { metadata: { status: 'rejected' }, expirationTtl: ttl });
        await env.SAWW_KV.put(byKey, '1', { metadata: { status: 'rejected' }, expirationTtl: ttl });
        return out({ ok: true, status: 'rejected' }, 200, h);
      }
      if (body.action === 'approve') {
        const c = await counts(env, r.cus, r.month);
        if (c.approved >= REC_PER_MONTH_APPROVED) return out({ ok: false, error: 'limit', approved: c.approved, limit: REC_PER_MONTH_APPROVED }, 409, h);
        const cr = await creditCustomer(env, r);
        if (cr.mode === 'error') return out({ ok: false, error: 'stripe', detail: cr.error }, 502, h);
        r.status = 'approved'; r.note = clip(body.note, 300); r.decidedAt = Math.floor(Date.now() / 1000); r.creditMode = cr.mode; if (cr.txn) r.creditTxn = cr.txn;
        await putRec(env, r);
        await env.SAWW_KV.put(qKey, '1', { metadata: { status: 'approved' } });
        await env.SAWW_KV.put(byKey, '1', { metadata: { status: 'approved' } });
        return out({ ok: true, status: 'approved', credit: cr.mode, txn: cr.txn || null, stripeUrl: 'https://dashboard.stripe.com/customers/' + r.cus, monthApproved: c.approved + 1 }, 200, h);
      }
      return out({ ok: false, error: 'action' }, 400, h);
    }
  }
  return out({ ok: false, error: 'not found' }, 404, h);
}
export { b64uText };
