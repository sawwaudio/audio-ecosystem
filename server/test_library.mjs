// アカウントのライブラリ（server/library.mjs）のテスト。Stripe は偽物、KV はメモリ。
// 使い方：node server/test_library.mjs
import worker from './worker.js';
import { monthJST, REC_TERMS_VERSION } from './recordings.mjs';
const { subtle } = crypto, enc = new TextEncoder();
const R = {}, fail = []; const ok = (k, c) => { R[k] = !!c; if (!c) fail.push(k) };
const T = () => Math.floor(Date.now() / 1000);
const b64u = b => Buffer.from(b).toString('base64url');
// 課金サーバーの鍵（証明）と、管理者の鍵（アプリの管理者パス・端末）
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = { ...(await subtle.exportKey('jwk', kp.privateKey)), kid: 'test' };
const studio = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const studioPub = await subtle.exportKey('jwk', studio.publicKey);
const other = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const AUD = 'https://app.example/';
// KV（list・metadata・arrayBuffer に対応）
const kv = new Map();
const KV = {
  get: async (k, o) => { const e = kv.get(k); if (!e) return null; if (o && (o === 'arrayBuffer' || o.type === 'arrayBuffer')) return e.v; return typeof e.v === 'string' ? e.v : null },
  getWithMetadata: async (k, o) => { const e = kv.get(k); return e ? { value: e.v, metadata: e.m || null } : { value: null, metadata: null } },
  put: async (k, v, o = {}) => { kv.set(k, { v, m: o.metadata, ttl: o.expirationTtl }) },
  delete: async k => kv.delete(k),
  list: async ({ prefix = '', limit = 1000, cursor } = {}) => { const all = [...kv.keys()].filter(k => k.startsWith(prefix)).sort(); const s = Number(cursor || 0), keys = all.slice(s, s + limit).map(name => ({ name, metadata: kv.get(name).m })); return { keys, list_complete: s + limit >= all.length, cursor: String(s + limit) } }
};
const baseEnv = { SAWW_KV: KV, APP_URL: AUD, ALLOWED_ORIGINS: 'https://app.example', STRIPE_SECRET_KEY: 'rk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test',
  ENT_PRIVATE_JWK: JSON.stringify(priv), MAGIC_SECRET: 'magic-secret-0123456789', STRIPE_API: 'https://stripe.mock', PRICE_IDS: 'price_pro', SEMI_PRICE_IDS: 'price_semi',
  STUDIO_PUBLIC_KEY_JWK: JSON.stringify({ kty: 'EC', crv: 'P-256', x: studioPub.x, y: studioPub.y }), STUDIO_AUDIENCES: AUD };
// 偽の Stripe
const subs = {}, balance = [];
const add = (cus, price, status = 'active') => { subs['sub_' + cus] = { id: 'sub_' + cus, customer: cus, status, items: { data: [{ price: { id: price }, current_period_end: T() + 30 * 86400 }] } } };
add('cus_pro', 'price_pro'); add('cus_semi', 'price_semi'); add('cus_gone', 'price_pro', 'canceled');
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); let m;
  if (u.host !== 'stripe.mock') return new Response('{}', { status: 404 });
  if ((m = u.pathname.match(/^\/v1\/customers\/([^/]+)\/balance_transactions$/)) && init.method === 'POST') {
    if (init.headers.Authorization !== 'Bearer rk_credit_x') return new Response('{"error":{"message":"bad key"}}', { status: 401 });
    const p = new URLSearchParams(init.body); const idem = init.headers['Idempotency-Key'];
    const prev = balance.find(b => b.idem === idem); if (prev) return Response.json(prev);
    const t = { id: 'cbtxn_' + (balance.length + 1), customer: m[1], amount: Number(p.get('amount')), currency: p.get('currency'), idem }; balance.push(t); return Response.json(t);
  }
  if (init.headers && init.headers.Authorization !== 'Bearer rk_test_x') return new Response('{}', { status: 401 });
  if (u.pathname === '/v1/subscriptions') return Response.json({ data: Object.values(subs).filter(s => s.customer === u.searchParams.get('customer')) });
  if ((m = u.pathname.match(/^\/v1\/customers\/(.+)$/))) return Response.json({ id: m[1], email: m[1] + '@example.com' });
  return new Response('{}', { status: 404 });
};
// 証明（JWT）を課金サーバーと同じ鍵で作る
const signJWT = async p => { const h = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'test' })), b = b64u(JSON.stringify(p)); const s = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(h + '.' + b)); return h + '.' + b + '.' + b64u(s) };
const token = (cus, plan = 'pro') => signJWT({ sub: cus, plan, st: 'active', pe: T() + 86400 * 30, iat: T(), exp: T() + 86400 * 30 });
// KV に契約の記録を置く（freshRec が使う）
const putCus = (cus, plan, status = 'active') => kv.set('cus:' + cus, { v: JSON.stringify({ cus, sub: 'sub_' + cus, status, pe: T() + 30 * 86400, pro: status !== 'canceled', plan, at: T(), email: cus + '@example.com' }) });
putCus('cus_pro', 'pro'); putCus('cus_semi', 'semi'); putCus('cus_gone', 'pro', 'canceled');
const meta = (o = {}) => b64u(JSON.stringify({ title: '朝の森の鳥', place: '長野県', recordedOn: '2026-11-20', creditName: 'Taro', fileName: 'mori.wav', terms: REC_TERMS_VERSION, own: true, noPeople: true, license: true, ...o }));
const wav = (n = 2048) => new Uint8Array(n).fill(7);
const call = (env, method, path, { body, headers = {} } = {}) => worker.fetch(new Request('https://billing.example' + path, { method, headers: { Origin: 'https://app.example', ...headers }, body }), env);
const send = async (env, tok, o = {}, bytes = wav(), type = 'audio/wav') => { const r = await call(env, 'POST', '/recordings', { body: bytes, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': type, 'X-Saww-Meta': meta(o), 'Content-Length': String(bytes.length) } }); return { status: r.status, body: await r.json(), cors: r.headers.get('Access-Control-Allow-Origin') } };
// 管理者のヘッダー
const passHdr = async (key = studio.privateKey, claims = {}) => { const body = b64u(JSON.stringify({ role: 'studio-admin', aud: AUD, iat: T(), exp: T() + 600, ...claims })); return 'pass.' + body + '.' + b64u(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(body))) };
const dev = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const devPub = b64u(await subtle.exportKey('raw', dev.publicKey));
const grantB = b64u(JSON.stringify({ role: 'studio-device', aud: AUD, key: devPub })), grantS = b64u(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, studio.privateKey, Buffer.from(grantB)));
const devHdr = async (method, path, ts = T(), key = dev.privateKey) => 'device.' + grantB + '.' + grantS + '.' + ts + '.' + b64u(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(ts + '.' + method + '.' + path)));
const admin = async (env, method, path, body, hdr) => { const r = await call(env, method, path, { body: body && JSON.stringify(body), headers: { 'X-Saww-Admin': hdr || await passHdr(), 'Content-Type': 'application/json' } }); const ct = r.headers.get('Content-Type') || ''; return { status: r.status, body: ct.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer()), type: ct } };


const env = { ...baseEnv };
const tPro = await token('cus_pro'), tSemi = await token('cus_semi', 'semi'), tGone = await token('cus_gone');
const J = async r => ({ status: r.status, body: await r.json().catch(() => null), cors: r.headers.get('Access-Control-Allow-Origin') });
const auth = t => ({ Authorization: 'Bearer ' + t });
const preset = (o = {}) => JSON.stringify({ name: '朝の森', data: { format: 'audio-ecosystem-preset', schema: 1, p: { a: 1 }, ...o } });
const pcm = (len, v = 1000) => { const b = new Int16Array(len * 2).fill(v); return new Uint8Array(b.buffer) };
const lmeta = (o = {}) => b64u(JSON.stringify({ name: 'LOOP 11/26 · CH1', sr: 48000, len: 4800, ...o }));
// プリセット
ok('preflight', (await call(env, 'OPTIONS', '/library/preset/a1')).headers.get('Access-Control-Allow-Methods').includes('PUT'));
let r = await J(await call(env, 'PUT', '/library/preset/p1', { body: preset(), headers: { ...auth(tPro), 'Content-Type': 'application/json' } }));
ok('preset_save', r.status === 200 && r.body.ok && r.body.name === '朝の森' && r.cors === 'https://app.example');
ok('preset_semi_ok', (await call(env, 'PUT', '/library/preset/s1', { body: preset(), headers: auth(tSemi) })).status === 200);
ok('preset_canceled_refused', (await call(env, 'PUT', '/library/preset/g1', { body: preset(), headers: auth(tGone) })).status === 403);
ok('preset_no_token', (await call(env, 'PUT', '/library/preset/x1', { body: preset() })).status === 401);
ok('preset_bad_data', (await call(env, 'PUT', '/library/preset/x2', { body: JSON.stringify({ name: 'x', data: { format: 'other' } }), headers: auth(tPro) })).status === 400);
ok('preset_too_big', (await call(env, 'PUT', '/library/preset/x3', { body: preset({ big: 'a'.repeat(210 * 1024) }), headers: auth(tPro) })).status === 413);
ok('bad_id', (await call(env, 'PUT', '/library/preset/..%2Fx', { body: preset(), headers: auth(tPro) })).status === 404);
r = await J(await call(env, 'GET', '/library/preset/p1', { headers: auth(tPro) }));ok('preset_get', r.status === 200 && r.body.data.p.a === 1 && r.body.name === '朝の森');
ok('preset_other_user', (await call(env, 'GET', '/library/preset/p1', { headers: auth(tSemi) })).status === 404);
// ループ
const put = (t, id, bytes, m = lmeta()) => call(env, 'PUT', '/library/loop/' + id, { body: bytes, headers: { ...auth(t), 'Content-Type': 'application/octet-stream', 'X-Saww-Meta': m, 'Content-Length': String(bytes.length) } });
ok('loop_save', (await put(tPro, 'l1', pcm(4800))).status === 200);
ok('loop_semi_refused', (await J(await put(tSemi, 'l2', pcm(4800)))).body.error === 'plan_pro');
ok('loop_size_mismatch', (await put(tPro, 'l3', pcm(4000))).status === 413);
ok('loop_bad_meta', (await put(tPro, 'l4', pcm(4800), lmeta({ sr: 5 }))).status === 400 && (await put(tPro, 'l5', pcm(4800), 'zz')).status === 400);
ok('loop_too_long', (await put(tPro, 'l6', pcm(10), lmeta({ len: 48000 * 61 }))).status === 400);
let g = await call(env, 'GET', '/library/loop/l1', { headers: auth(tPro) });const gb = new Uint8Array(await g.arrayBuffer());
const gm = JSON.parse(Buffer.from(g.headers.get('X-Saww-Meta'), 'base64url'));
ok('loop_get', g.status === 200 && gb.length === 4800 * 4 && new Int16Array(gb.buffer)[7] === 1000 && gm.sr === 48000 && gm.len === 4800 && g.headers.get('Access-Control-Expose-Headers') === 'X-Saww-Meta');
// 一覧
r = await J(await call(env, 'GET', '/library', { headers: auth(tPro) }));
ok('list', r.status === 200 && r.body.presets.length === 1 && r.body.presets[0].id === 'p1' && r.body.loops.length === 1 && r.body.loops[0].len === 4800 && r.body.used.loopBytes === 19200 && r.body.limits.loops === 20);
ok('list_canceled_ok', (await call(env, 'GET', '/library', { headers: auth(tGone) })).status === 200);
// 上限：20本・合計 80MB
for (let i = 2; i <= 20; i++) await put(tPro, 'm' + i, pcm(4800));
ok('loop_count_limit', (await J(await put(tPro, 'm21', pcm(4800)))).body.error === 'limit');
ok('loop_overwrite_ok', (await put(tPro, 'l1', pcm(4800, 5))).status === 200);
for (let i = 2; i <= 20; i++) await call(env, 'DELETE', '/library/loop/m' + i, { headers: auth(tPro) });
const big = 48000 * 60;for (let i = 0; i < 7; i++) await put(tPro, 'b' + i, pcm(big), lmeta({ len: big }));
ok('loop_quota', (await J(await put(tPro, 'b9', pcm(big), lmeta({ len: big })))).body.error === 'quota');
// 削除
ok('delete', (await call(env, 'DELETE', '/library/preset/p1', { headers: auth(tPro) })).status === 200 && (await call(env, 'GET', '/library/preset/p1', { headers: auth(tPro) })).status === 404);
// 既存の経路は壊れていない
ok('routes_kept', (await call(env, 'OPTIONS', '/recordings')).status === 204);
console.log(JSON.stringify(R, null, 1)); console.log(fail.length ? 'FAIL: ' + fail.join(', ') : 'ALL PASS'); process.exit(fail.length ? 1 : 0);
