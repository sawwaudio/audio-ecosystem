// 録音の買い取り（server/recordings.mjs）のテスト。Stripe は偽物、KV はメモリ（list・metadata・期限つき）。
// 使い方：node server/test_recordings.mjs
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
// 1. 送れる人・送れない人
const s1 = await send(env, tPro);
ok('pro_can_submit', s1.status === 200 && s1.body.ok && /^[0-9a-f-]{36}$/.test(s1.body.id) && s1.cors === 'https://app.example');
ok('semi_can_submit', (await send(env, tSemi)).status === 200);
ok('canceled_refused', (await send(env, tGone)).status === 403);
ok('no_token_refused', (await send(env, '')).status === 401);
ok('forged_token_refused', (await send(env, tPro.slice(0, -6) + 'AAAAAA')).status === 401);
ok('terms_required', (await send(env, tPro, { license: false })).status === 400 && (await send(env, tPro, { noPeople: false })).status === 400 && (await send(env, tPro, { terms: 'old' })).status === 400);
ok('title_required', (await send(env, tPro, { title: ' ' })).status === 400);
ok('audio_only', (await send(env, tPro, {}, wav(), 'video/mp4')).status === 415 && (await send(env, tPro, {}, wav(), 'application/zip')).status === 415);
ok('size_limit', (await send(env, tPro, {}, new Uint8Array(20 * 1024 * 1024 + 1))).status === 413);
ok('preflight', (await call(env, 'OPTIONS', '/recordings', { headers: { 'Access-Control-Request-Method': 'POST' } })).headers.get('Access-Control-Allow-Headers').includes('X-Saww-Meta'));
// 2. 自分の一覧
const mine = await (await call(env, 'POST', '/recordings/mine', { body: JSON.stringify({ token: tPro }), headers: { 'Content-Type': 'application/json' } })).json();
ok('mine_list', mine.ok && mine.items.length === 1 && mine.items[0].status === 'pending' && mine.submitted === 1 && mine.approved === 0 && mine.limit === 5 && !('cus' in mine.items[0]));
// 3. 管理者：確認できない人は入れない
ok('admin_requires_pass', (await admin(env, 'GET', '/admin/recordings', null, 'pass.x.y')).status === 401 && (await admin(env, 'GET', '/admin/recordings', null, await passHdr(other.privateKey))).status === 401);
ok('admin_expired_pass', (await admin(env, 'GET', '/admin/recordings', null, await passHdr(studio.privateKey, { iat: T() - 7200, exp: T() - 10 }))).status === 401);
ok('admin_device_ok', (await admin(env, 'GET', '/admin/recordings', null, await devHdr('GET', '/admin/recordings'))).status === 200);
ok('admin_device_wrong_path', (await admin(env, 'GET', '/admin/recordings', null, await devHdr('POST', '/admin/recordings'))).status === 401);
ok('admin_device_old', (await admin(env, 'GET', '/admin/recordings', null, await devHdr('GET', '/admin/recordings', T() - 600))).status === 401);
ok('admin_device_wrong_key', (await admin(env, 'GET', '/admin/recordings', null, await devHdr('GET', '/admin/recordings', T(), other.privateKey))).status === 401);
// 4. 審査：聴く・採用（手動の相殺）・不採用
const q = await admin(env, 'GET', '/admin/recordings');
ok('admin_queue', q.status === 200 && q.body.items.length === 2 && q.body.items.every(i => i.status === 'pending' && /dashboard\.stripe\.com\/customers\//.test(i.stripeUrl)) && q.body.autoCredit === false);
const audio = await admin(env, 'GET', '/admin/recordings/' + s1.body.id + '/audio');
ok('admin_audio', audio.status === 200 && audio.type === 'audio/wav' && audio.body.length === 2048 && audio.body[0] === 7);
const ap = await admin(env, 'POST', '/admin/recordings/' + s1.body.id, { action: 'approve', note: 'きれい' });
ok('approve_manual', ap.status === 200 && ap.body.status === 'approved' && ap.body.credit === 'manual' && balance.length === 0);
ok('no_double_decision', (await admin(env, 'POST', '/admin/recordings/' + s1.body.id, { action: 'approve' })).status === 409);
const mine2 = await (await call(env, 'POST', '/recordings/mine', { body: JSON.stringify({ token: tPro }), headers: { 'Content-Type': 'application/json' } })).json();
ok('mine_shows_approved', mine2.items[0].status === 'approved' && mine2.approved === 1);
const semiId = q.body.items.find(i => i.cus === 'cus_semi').id;
const rj = await admin(env, 'POST', '/admin/recordings/' + semiId, { action: 'reject', note: '風の音が強い' });
ok('reject', rj.status === 200 && kv.get('recsub:' + semiId).ttl === 30 * 86400 && kv.get('recaudio:' + semiId).ttl === 30 * 86400);
const mineS = await (await call(env, 'POST', '/recordings/mine', { body: JSON.stringify({ token: tSemi }), headers: { 'Content-Type': 'application/json' } })).json();
ok('reject_note_visible', mineS.items[0].status === 'rejected' && mineS.items[0].note === '風の音が強い');
// 5. 自動の相殺（STRIPE_CREDIT_KEY がある時）と月5本の上限
const env2 = { ...baseEnv, STRIPE_CREDIT_KEY: 'rk_credit_x' };
const ids = [];
for (let i = 0; i < 5; i++) ids.push((await send(env2, tPro, { title: '録音 ' + i })).body.id);
let approvedNow = 1; const results = [];
for (const id of ids) { const r = await admin(env2, 'POST', '/admin/recordings/' + id, { action: 'approve' }); results.push(r.status); if (r.status === 200) approvedNow++ }
ok('auto_credit', balance.length === 4 && balance.every(b => b.amount === -100 && b.currency === 'usd' && b.customer === 'cus_pro'));
ok('monthly_cap_5', results.join() === '200,200,200,200,409' && approvedNow === 5);
const capped = await admin(env2, 'POST', '/admin/recordings/' + ids[4], { action: 'approve' });
ok('cap_message', capped.status === 409 && capped.body.error === 'limit' && capped.body.approved === 5);
ok('cap_reject_still_ok', (await admin(env2, 'POST', '/admin/recordings/' + ids[4], { action: 'reject', note: '今月の上限' })).status === 200);
// 6. Stripe が失敗したら採用にしない
const env3 = { ...baseEnv, STRIPE_CREDIT_KEY: 'rk_wrong' };
const id3 = (await send(env3, tSemi, { title: '川の音' })).body.id;
const f3 = await admin(env3, 'POST', '/admin/recordings/' + id3, { action: 'approve' });
ok('stripe_error_keeps_pending', f3.status === 502 && JSON.parse(kv.get('recsub:' + id3).v).status === 'pending');
// 7. 送れる本数の上限（月15本）
for (let i = 0; i < 9; i++) await send(env, tPro, { title: 'extra ' + i });
const over = await send(env, tPro, { title: 'over' });
ok('submit_cap_15', over.status === 429 && over.body.error === 'limit');
ok('month_jst', monthJST(Date.UTC(2026, 10, 30, 15, 30) / 1000) === '2026-12' && monthJST(Date.UTC(2026, 10, 30, 14, 59) / 1000) === '2026-11');
// 8. 既存の入口はそのまま
ok('routes_kept', (await call(env, 'GET', '/')).status === 200);
console.log(JSON.stringify(R, null, 1)); console.log(fail.length ? 'FAIL: ' + fail.join(', ') : 'ALL PASS'); process.exit(fail.length ? 1 : 0);
