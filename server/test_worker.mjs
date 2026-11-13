// 課金の確認サーバー（server/worker.js）のテスト。Stripe と Resend は偽物（fetch を差し替え）、KV はメモリ。
// 使い方：node server/test_worker.mjs
import worker, { verifyStripeSignature } from './worker.js';
const { subtle } = crypto, enc = new TextEncoder();
const R = {}, fail = [];const ok = (k, c) => { R[k] = !!c; if (!c) fail.push(k) };
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = { ...(await subtle.exportKey('jwk', kp.privateKey)), kid: 'test' };
const kv = new Map();
const KV = { get: async k => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v) }, delete: async k => kv.delete(k) };
const T = () => Math.floor(Date.now() / 1000);
const env = { SAWW_KV: KV, APP_URL: 'https://app.example/', ALLOWED_ORIGINS: 'https://app.example', STRIPE_SECRET_KEY: 'rk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test',
  ENT_PRIVATE_JWK: JSON.stringify(priv), MAGIC_SECRET: 'magic-secret-0123456789', RESEND_API_KEY: 're_test', MAIL_FROM: 'saww <login@example.com>', STRIPE_API: 'https://stripe.mock', RESEND_API: 'https://resend.mock', PRICE_IDS: 'price_pro' };
// 偽の Stripe
const subs = { sub_1: { id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [{ price: { id: 'price_pro' }, current_period_end: T() + 30 * 86400 }] } } };
const sessions = { cs_test_aaaaaaaaaaaa: { id: 'cs_test_aaaaaaaaaaaa', status: 'complete', mode: 'subscription', subscription: 'sub_1', customer_details: { email: 'Owner@Example.com' } },
  cs_test_bbbbbbbbbbbb: { id: 'cs_test_bbbbbbbbbbbb', status: 'open', mode: 'subscription', subscription: null } };
const mails = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.host === 'resend.mock') { mails.push(JSON.parse(init.body)); return new Response('{"id":"m"}', { status: 200 }) }
  if (u.host !== 'stripe.mock' || init.headers.Authorization !== 'Bearer rk_test_x') return new Response('{}', { status: 401 });
  let m;
  if ((m = u.pathname.match(/^\/v1\/checkout\/sessions\/(.+)$/))) { const s = sessions[m[1]]; if (!s) return new Response('{}', { status: 404 }); return Response.json({ ...s, subscription: s.subscription && (u.searchParams.get('expand[]') === 'subscription' ? subs[s.subscription] : s.subscription) }) }
  if ((m = u.pathname.match(/^\/v1\/subscriptions\/(.+)$/))) return Response.json(subs[m[1]]);
  if (u.pathname === '/v1/subscriptions') return Response.json({ data: Object.values(subs).filter(s => s.customer === u.searchParams.get('customer')) });
  if ((m = u.pathname.match(/^\/v1\/customers\/(.+)$/))) return Response.json({ id: m[1], email: 'owner@example.com' });
  return new Response('{}', { status: 404 });
};
const call = (method, path, body, headers = {}) => worker.fetch(new Request('https://billing.example' + path, { method, headers: { Origin: 'https://app.example', ...headers }, body }), env);
const sigHdr = async (body, secret = 'whsec_test', t = T()) => { const k = await subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const s = new Uint8Array(await subtle.sign('HMAC', k, enc.encode(t + '.' + body))); return 't=' + t + ',v1=' + [...s].map(x => x.toString(16).padStart(2, '0')).join('') };
const payload = tok => JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
const verifyES = async tok => { const [h, p, s] = tok.split('.'); const pub = await subtle.importKey('jwk', await subtle.exportKey('jwk', kp.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, Buffer.from(s, 'base64url'), enc.encode(h + '.' + p)) };

// 1. Webhook の署名
const ev = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: sessions.cs_test_aaaaaaaaaaaa } });
ok('sig_ok', await verifyStripeSignature(ev, await sigHdr(ev), 'whsec_test'));
ok('sig_bad_secret', !(await verifyStripeSignature(ev, await sigHdr(ev, 'whsec_other'), 'whsec_test')));
ok('sig_old', !(await verifyStripeSignature(ev, await sigHdr(ev, 'whsec_test', T() - 1000), 'whsec_test')));
ok('webhook_rejects', (await call('POST', '/stripe/webhook', ev, { 'Stripe-Signature': 't=1,v1=00' })).status === 400);
const w = await call('POST', '/stripe/webhook', ev, { 'Stripe-Signature': await sigHdr(ev) });
const rec = JSON.parse(kv.get('cus:cus_1') || 'null');
ok('webhook_saves', w.status === 200 && rec && rec.status === 'active' && rec.email === 'owner@example.com' && kv.get('email:owner@example.com') === 'cus_1' && rec.pro);
ok('webhook_dup', (await (await call('POST', '/stripe/webhook', ev, { 'Stripe-Signature': await sigHdr(ev) })).json()).dup === true);
// 2. 支払い後の移動先：証明を付けてアプリへ
const a = await call('GET', '/activate?session_id=cs_test_aaaaaaaaaaaa');
const loc = a.headers.get('Location') || '', tok = (loc.match(/#saww-pro=(.+)$/) || [])[1];
R.token = tok && payload(tok);
ok('activate', a.status === 303 && loc.startsWith('https://app.example/#saww-pro=') && (await verifyES(tok)) && R.token.plan === 'pro' && R.token.sub === 'cus_1' && R.token.exp <= T() + 40 * 86400 + 5);
ok('activate_pending', (await call('GET', '/activate?session_id=cs_test_bbbbbbbbbbbb')).headers.get('Location') === 'https://app.example/#saww-billing=pending');
ok('activate_bad', (await call('GET', '/activate?session_id=hack')).headers.get('Location') === 'https://app.example/#saww-billing=error');
// 3. メールでログイン：会員にだけ送る・返事は同じ・1分に1回
const l1 = await call('POST', '/login', JSON.stringify({ email: ' OWNER@example.com ' }), { 'Content-Type': 'application/json' });
const l2 = await call('POST', '/login', JSON.stringify({ email: 'stranger@example.com' }), { 'Content-Type': 'application/json' });
const l3 = await call('POST', '/login', JSON.stringify({ email: 'owner@example.com' }), { 'Content-Type': 'application/json' });
ok('login_same_reply', l1.status === 200 && l2.status === 200 && (await l1.text()) === (await l2.text()) && l1.headers.get('Access-Control-Allow-Origin') === 'https://app.example');
ok('login_mail_once', mails.length === 1 && mails[0].to[0] === 'owner@example.com' && /\/magic\?t=/.test(mails[0].text) && l3.status === 200);
ok('login_bad_email', (await call('POST', '/login', JSON.stringify({ email: 'x' }))).status === 400);
// 4. ログイン用リンク：証明が出る・2回目は使えない・改ざんは拒否
const link = mails[0].text.match(/https:\/\/billing\.example\/magic\?t=\S+/)[0];
const m1 = await call('GET', link.replace('https://billing.example', ''));
const m2 = await call('GET', link.replace('https://billing.example', ''));
ok('magic', /#saww-pro=/.test(m1.headers.get('Location')) && m2.headers.get('Location') === 'https://app.example/#saww-billing=link');
ok('magic_tamper', (await call('GET', '/magic?t=' + link.split('t=')[1].replace(/^./, 'A'))).headers.get('Location') === 'https://app.example/#saww-billing=link');
// 5. 更新：有料のあいだは新しい証明、解約されたら free
const r1 = await (await call('POST', '/refresh', JSON.stringify({ token: tok }))).json();
ok('refresh_pro', r1.plan === 'pro' && (await verifyES(r1.token)));
subs.sub_1 = { ...subs.sub_1, status: 'canceled' };
const del = JSON.stringify({ id: 'evt_2', type: 'customer.subscription.deleted', data: { object: subs.sub_1 } });
await call('POST', '/stripe/webhook', del, { 'Stripe-Signature': await sigHdr(del) });
const r2 = await (await call('POST', '/refresh', JSON.stringify({ token: tok }))).json();
ok('refresh_canceled', r2.plan === 'free' && r2.status === 'canceled' && !r2.token);
ok('refresh_forged', (await call('POST', '/refresh', JSON.stringify({ token: tok.slice(0, -4) + 'AAAA' }))).status === 401);
// 6. 別の価格（PRO 以外）の購読は PRO にしない
subs.sub_2 = { id: 'sub_2', customer: 'cus_2', status: 'active', items: { data: [{ price: { id: 'price_other' }, current_period_end: T() + 86400 }] } };
const e3 = JSON.stringify({ id: 'evt_3', type: 'customer.subscription.created', data: { object: subs.sub_2 } });
await call('POST', '/stripe/webhook', e3, { 'Stripe-Signature': await sigHdr(e3) });
ok('other_price', JSON.parse(kv.get('cus:cus_2')).pro === false);
// 7. 旧い API の版（current_period_end が購読そのものにある）
subs.sub_3 = { id: 'sub_3', customer: 'cus_3', status: 'trialing', current_period_end: T() + 5 * 86400, items: { data: [{ price: { id: 'price_pro' } }] } };
const e4 = JSON.stringify({ id: 'evt_4', type: 'customer.subscription.updated', data: { object: subs.sub_3 } });
await call('POST', '/stripe/webhook', e4, { 'Stripe-Signature': await sigHdr(e4) });
ok('old_api_period', JSON.parse(kv.get('cus:cus_3')).pe === subs.sub_3.current_period_end);

// v0.69 SEMI-PRO：SEMI_PRICE_IDS の価格は plan 'semi'。PRICE_IDS は 'pro'。どちらでもない価格は無料。
{
  const env2 = { ...env, PRICE_IDS: 'price_pro', SEMI_PRICE_IDS: 'price_semi' };
  subs.sub_s = { id: 'sub_s', customer: 'cus_s', status: 'active', items: { data: [{ price: { id: 'price_semi' }, current_period_end: T() + 30 * 86400 }] } };
  subs.sub_x = { id: 'sub_x', customer: 'cus_x', status: 'active', items: { data: [{ price: { id: 'price_other' }, current_period_end: T() + 30 * 86400 }] } };
  sessions.cs_test_semi00000000 = { id: 'cs_test_semi00000000', status: 'complete', mode: 'subscription', subscription: 'sub_s', customer_details: { email: 'semi@example.com' } };
  sessions.cs_test_other0000000 = { id: 'cs_test_other0000000', status: 'complete', mode: 'subscription', subscription: 'sub_x', customer_details: { email: 'x@example.com' } };
  const c2 = (method, path, body) => worker.fetch(new Request('https://billing.example' + path, { method, headers: { Origin: 'https://app.example' }, body }), env2);
  const s1 = await c2('GET', '/activate?session_id=cs_test_semi00000000');
  const st = ((s1.headers.get('Location') || '').match(/#saww-pro=(.+)$/) || [])[1];
  R.semi = st && payload(st);
  ok('semi_activate', !!st && (await verifyES(st)) && R.semi.plan === 'semi' && R.semi.sub === 'cus_s');
  const sr = await (await c2('POST', '/refresh', JSON.stringify({ token: st }))).json();
  ok('semi_refresh', sr.plan === 'semi' && !!sr.token && payload(sr.token).plan === 'semi');
  const s2 = await c2('GET', '/activate?session_id=cs_test_other0000000');
  ok('other_price_not_paid', !(s2.headers.get('Location') || '').includes('#saww-pro='));
  subs.sub_p = { id: 'sub_p', customer: 'cus_p', status: 'active', items: { data: [{ price: { id: 'price_pro' }, current_period_end: T() + 30 * 86400 }] } };
  sessions.cs_test_pro000000000 = { id: 'cs_test_pro000000000', status: 'complete', mode: 'subscription', subscription: 'sub_p', customer_details: { email: 'p@example.com' } };
  const p1 = await c2('GET', '/activate?session_id=cs_test_pro000000000');
  const pt = ((p1.headers.get('Location') || '').match(/#saww-pro=(.+)$/) || [])[1];
  ok('pro_still_pro', !!pt && payload(pt).plan === 'pro');
}
console.log(JSON.stringify(R, null, 1)); console.log(fail.length ? 'FAIL: ' + fail.join(', ') : 'ALL PASS'); process.exit(fail.length ? 1 : 0);
