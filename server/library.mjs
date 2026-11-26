// v0.89 アカウントのライブラリ（2026-11-26 オーナー「ループ・プリセットをアカウントに保存する … 強化してゆく」）
// 課金中の人が、プリセット（SEMI-PRO・PRO）とルーパーのループ（PRO）を、課金のアカウント（Stripe の顧客）に保存して、ほかの端末でも使えるようにする。
// 目的：作った物がアカウントに溜まるほど、乗り換えにくくなる（真似されにくい強みの一つ。claude/VISION.md）。
//
// 保存：KV。キー lib:<顧客>:p:<id>（プリセットの JSON）／lib:<顧客>:l:<id>（ループ。16bit のステレオを交互に並べた生の PCM）。名前などはキーのメタデータに入れる。
// 上限：プリセット 100件（1件 200KB まで）、ループ 20本・合計 80MB（1本 60秒・12MB まで）。
// 経路：
//   GET    /library                     一覧（プリセットとループ。中身は含まない）
//   PUT    /library/preset/<id>         {name, data}
//   GET    /library/preset/<id>
//   PUT    /library/loop/<id>           生の PCM（application/octet-stream）＋ X-Saww-Meta（base64url の JSON {name, sr, len}）
//   GET    /library/loop/<id>           生の PCM（X-Saww-Meta を付けて返す）
//   DELETE /library/preset/<id> ・ /library/loop/<id>
// 確かめ方：Authorization: Bearer <課金の証明>。契約が有効か（1時間ごとに Stripe で確かめた記録）を見る。解約後も、一覧・読み込み・削除はできる（保存だけできなくなる）。
export const LIB_LIMITS = { presets: 100, presetBytes: 200 * 1024, loops: 20, loopBytes: 12 * 1024 * 1024, totalLoopBytes: 80 * 1024 * 1024 };
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const enc = new TextEncoder(), dec = new TextDecoder();
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), c => c.charCodeAt(0));
const b64uText = s => { const b = enc.encode(s); let t = ''; for (const x of b) t += String.fromCharCode(x); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
function corsFor(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allow = String(env.ALLOWED_ORIGINS || (env.APP_URL ? new URL(env.APP_URL).origin : '')).split(',').map(s => s.trim()).filter(Boolean);
  if (env.TEST_ORIGIN) allow.push(env.TEST_ORIGIN);
  return allow.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Saww-Meta', 'Access-Control-Expose-Headers': 'X-Saww-Meta', 'Access-Control-Max-Age': '600', Vary: 'Origin' } : {};
}
const out = (obj, status, h) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(h || {}) } });
async function listAll(env, prefix) { const keys = []; let cursor; do { const r = await env.SAWW_KV.list({ prefix, cursor }); keys.push(...r.keys); cursor = r.list_complete ? null : r.cursor; } while (cursor); return keys; }
export async function libraryRoute(req, env, deps) {
  const url = new URL(req.url), path = url.pathname;
  if (!(path === '/library' || path.startsWith('/library/'))) return null;
  const h = corsFor(env, req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const pl = await deps.readToken(env, tok);
  if (!pl || !pl.sub || pl.typ || pl.exp < Date.now() / 1000) return out({ ok: false, error: 'token' }, 401, h);
  const cus = pl.sub, base = 'lib:' + cus + ':';
  if (path === '/library' && req.method === 'GET') {
    const keys = await listAll(env, base);
    const presets = [], loops = [];
    for (const k of keys) { const m = k.metadata || {}; const id = k.name.slice(base.length + 2); if (k.name.startsWith(base + 'p:')) presets.push({ id, name: m.name || '', created: m.created || 0, size: m.size || 0 }); else if (k.name.startsWith(base + 'l:')) loops.push({ id, name: m.name || '', sr: m.sr, len: m.len, created: m.created || 0, size: m.size || 0 }); }
    presets.sort((a, b) => b.created - a.created); loops.sort((a, b) => b.created - a.created);
    return out({ ok: true, presets, loops, limits: LIB_LIMITS, used: { loopBytes: loops.reduce((s, x) => s + (x.size || 0), 0) } }, 200, h);
  }
  const m = path.match(/^\/library\/(preset|loop)\/([^/]+)$/);
  if (!m || !ID.test(m[2])) return out({ ok: false, error: 'path' }, 404, h);
  const kind = m[1], id = m[2], key = base + (kind === 'preset' ? 'p:' : 'l:') + id;
  if (req.method === 'GET') {
    if (kind === 'preset') { const t = await env.SAWW_KV.get(key); let v = null; try { v = t ? JSON.parse(t) : null; } catch (e) {} return v ? out({ ok: true, id, ...v }, 200, h) : out({ ok: false, error: 'missing' }, 404, h); }
    const r = await env.SAWW_KV.getWithMetadata(key, 'arrayBuffer'); if (!r || !r.value) return out({ ok: false, error: 'missing' }, 404, h);
    const md = r.metadata || {};
    return new Response(r.value, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Saww-Meta': b64uText(JSON.stringify({ name: md.name, sr: md.sr, len: md.len })), ...h } });
  }
  if (req.method === 'DELETE') { await env.SAWW_KV.delete(key); return out({ ok: true }, 200, h); }
  if (req.method !== 'PUT') return out({ ok: false, error: 'method' }, 405, h);
  // 保存は契約中だけ（プリセット：SEMI-PRO・PRO、ループ：PRO）
  const rec = await deps.freshRec(env, cus, 3600);
  if (!deps.isPro(rec)) return out({ ok: false, error: 'plan' }, 403, h);
  if (kind === 'loop' && rec.plan === 'semi') return out({ ok: false, error: 'plan_pro' }, 403, h);
  const keys = await listAll(env, base + (kind === 'preset' ? 'p:' : 'l:'));
  const exists = keys.some(k => k.name === key);
  const created = Math.floor(Date.now() / 1000);
  if (kind === 'preset') {
    if (!exists && keys.length >= LIB_LIMITS.presets) return out({ ok: false, error: 'limit' }, 429, h);
    const text = await req.text();
    if (enc.encode(text).length > LIB_LIMITS.presetBytes) return out({ ok: false, error: 'size' }, 413, h);
    let body; try { body = JSON.parse(text); } catch (e) { return out({ ok: false, error: 'json' }, 400, h); }
    if (!body || typeof body.data !== 'object' || Array.isArray(body.data) || body.data.format !== 'audio-ecosystem-preset') return out({ ok: false, error: 'data' }, 400, h);
    const name = clip(body.name, 80) || 'Preset';
    const val = JSON.stringify({ name, created, data: body.data });
    await env.SAWW_KV.put(key, val, { metadata: { name, created, size: val.length } });
    return out({ ok: true, id, name, created }, 200, h);
  }
  let meta; try { meta = JSON.parse(dec.decode(unb64u(req.headers.get('X-Saww-Meta') || ''))); } catch (e) { return out({ ok: false, error: 'meta' }, 400, h); }
  const sr = Number(meta && meta.sr), len = Number(meta && meta.len);
  if (!(sr >= 8000 && sr <= 192000 && Number.isInteger(sr)) || !(len > 0 && Number.isInteger(len) && len <= sr * 60)) return out({ ok: false, error: 'meta' }, 400, h);
  const declared = Number(req.headers.get('Content-Length') || 0);
  if (declared > LIB_LIMITS.loopBytes) return out({ ok: false, error: 'size' }, 413, h);
  const buf = await req.arrayBuffer();
  if (buf.byteLength !== len * 4 || buf.byteLength > LIB_LIMITS.loopBytes) return out({ ok: false, error: 'size' }, 413, h);
  const used = keys.filter(k => k.name !== key).reduce((s, k) => s + ((k.metadata && k.metadata.size) || 0), 0);
  if (!exists && keys.length >= LIB_LIMITS.loops) return out({ ok: false, error: 'limit' }, 429, h);
  if (used + buf.byteLength > LIB_LIMITS.totalLoopBytes) return out({ ok: false, error: 'quota' }, 429, h);
  const name = clip(meta.name, 80) || 'Loop';
  await env.SAWW_KV.put(key, buf, { metadata: { name, sr, len, created, size: buf.byteLength } });
  return out({ ok: true, id, name, created }, 200, h);
}
