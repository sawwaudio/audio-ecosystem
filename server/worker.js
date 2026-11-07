// saww audio ecosystem — 課金の確認サーバー（Cloudflare Workers）v0.57
// オーナー要望（2026-11-07 16:31）「無料版と有料版で区別するシステム」。Stripe の支払いリンク（月額）を使う。
// 役目：Stripe の知らせ（Webhook）で「誰が有料会員か」を記録し、有料の人に署名付きの「PRO の証明」（ES256 の JWT）を発行する。
//       アプリは公開鍵でその証明を確かめる（電波がなくても確かめられる）。秘密の鍵・Stripe の鍵はこのサーバーの中にだけ置く。
// 領収書のメールは Stripe が送る（Dashboard の設定。server/README.md）。このサーバーが送るメールは「ログイン用のリンク」だけ。
//
// 入口
//   POST /stripe/webhook   Stripe の Webhook（署名を確かめる）。checkout.session.completed・customer.subscription.*・invoice.paid
//   GET  /activate?session_id=cs_…   支払いリンクの「支払い後の移動先」。支払いを確かめて、証明を付けてアプリへ戻す
//   POST /login  {email}   購入したメールアドレスへログイン用のリンクを送る（有料会員でなくても同じ返事。登録の有無を漏らさない）
//   GET  /magic?t=…        ログイン用リンクの行き先。証明を付けてアプリへ戻す（1回だけ使える・20分）
//   POST /refresh {token}  証明の更新（更新・解約を反映）。有料でなくなっていれば plan:'free'
//
// env（wrangler.toml と secret）
//   SAWW_KV（KV）、APP_URL（例 https://sawwaudio.github.io/audio-ecosystem-sounds-1/）、ALLOWED_ORIGINS（カンマ区切り。既定は APP_URL のオリジン）
//   secret: STRIPE_SECRET_KEY（読み取り専用の制限付きキーで足りる）、STRIPE_WEBHOOK_SECRET、ENT_PRIVATE_JWK（server/keygen.mjs で作る）、
//           MAGIC_SECRET（長い乱数）、RESEND_API_KEY、MAIL_FROM（例 "saww audio ecosystem <login@example.com>"）
//   任意: PRICE_IDS（PRO として認める Stripe の価格 ID。カンマ区切り。空なら有効な定期購読はすべて PRO）、STRIPE_API・RESEND_API（テスト用の差し替え）

const ACTIVE = new Set(['active', 'trialing', 'past_due']);  // past_due は Stripe の再請求の間も使えるようにする（期限＋猶予まで）
const GRACE = 3 * 86400, MAX_TOKEN = 40 * 86400, MAGIC_TTL = 20 * 60, REFRESH_WINDOW = 60 * 86400;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const now = () => Math.floor(Date.now() / 1000);
const normEmail = e => String(e || '').trim().toLowerCase();
const okEmail = e => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e) && e.length <= 254;

// ── 署名 ──
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
const hex = a => [...a].map(x => x.toString(16).padStart(2, '0')).join('');
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

// Stripe-Signature: t=…,v1=…（https://docs.stripe.com/webhooks#verify-manually）
export async function verifyStripeSignature(body, header, secret, tolerance = 300) {
  if (!header || !secret) return false;
  const parts = {};
  const v1 = [];
  for (const kv of header.split(',')) { const [k, v] = kv.split('='); if (k === 't') parts.t = v; if (k === 'v1') v1.push(v); }
  if (!parts.t || !v1.length || Math.abs(now() - Number(parts.t)) > tolerance) return false;
  const want = hex(await hmac(secret, parts.t + '.' + body));
  return v1.some(s => safeEq(s, want));
}

let keyCache = null;
async function privKey(env) {
  if (keyCache && keyCache.src === env.ENT_PRIVATE_JWK) return keyCache;
  const jwk = JSON.parse(env.ENT_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const vkey = await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  keyCache = { src: env.ENT_PRIVATE_JWK, key, vkey, kid: jwk.kid || 'saww-1' };
  return keyCache;
}
export async function signToken(env, payload) {
  const k = await privKey(env);
  const h = b64u(enc.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: k.kid }))), p = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.key, enc.encode(h + '.' + p));
  return h + '.' + p + '.' + b64u(sig);
}
async function readToken(env, tok) {
  const [h, p, s] = String(tok || '').split('.');
  if (!h || !p || !s) return null;
  const k = await privKey(env);
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.vkey, unb64u(s), enc.encode(h + '.' + p)).catch(() => false);
  if (!ok) return null;
  try { return JSON.parse(dec.decode(unb64u(p))); } catch (e) { return null; }
}

// ── Stripe・KV ──
async function stripe(env, path) {
  const r = await fetch((env.STRIPE_API || 'https://api.stripe.com') + path, { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
  if (!r.ok) throw new Error('stripe ' + r.status);
  return r.json();
}
// API の版によって current_period_end は購読そのもの（旧）か、明細（2025-03-31 以降）にある
function periodEnd(sub) {
  if (sub.current_period_end) return sub.current_period_end;
  const ends = ((sub.items && sub.items.data) || []).map(i => i.current_period_end).filter(Boolean);
  return ends.length ? Math.max(...ends) : 0;
}
function priceOk(env, sub) {
  const want = String(env.PRICE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!want.length) return true;
  return ((sub.items && sub.items.data) || []).some(i => i.price && want.includes(i.price.id));
}
async function saveSub(env, sub, email) {
  const cus = typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id;
  if (!cus) return null;
  const rec = { cus, sub: sub.id, status: sub.status, pe: periodEnd(sub), pro: priceOk(env, sub), at: now() };
  const old = JSON.parse((await env.SAWW_KV.get('cus:' + cus)) || 'null');
  rec.email = normEmail(email || (old && old.email) || (sub.customer && sub.customer.email) || '');
  if (!rec.email) { try { rec.email = normEmail((await stripe(env, '/v1/customers/' + cus)).email); } catch (e) {} }
  await env.SAWW_KV.put('cus:' + cus, JSON.stringify(rec));
  if (rec.email) await env.SAWW_KV.put('email:' + rec.email, cus);
  return rec;
}
const isPro = rec => !!rec && rec.pro && ACTIVE.has(rec.status) && rec.pe + GRACE > now();
async function issue(env, rec) {
  const t = now();
  return signToken(env, { sub: rec.cus, plan: 'pro', st: rec.status, pe: rec.pe, iat: t, exp: Math.min(rec.pe + GRACE, t + MAX_TOKEN) });
}
// KV の記録が古い（12時間以上）時は Stripe に聞き直す
async function freshRec(env, cus) {
  let rec = JSON.parse((await env.SAWW_KV.get('cus:' + cus)) || 'null');
  if (rec && now() - rec.at < 12 * 3600) return rec;
  try {
    const list = await stripe(env, '/v1/subscriptions?status=all&limit=10&customer=' + encodeURIComponent(cus));
    const subs = (list.data || []).sort((a, b) => (ACTIVE.has(b.status) - ACTIVE.has(a.status)) || (periodEnd(b) - periodEnd(a)));
    if (subs[0]) rec = await saveSub(env, subs[0], rec && rec.email);
  } catch (e) { /* Stripe に届かない時は記録のまま */ }
  return rec;
}

// ── HTTP ──
function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allow = String(env.ALLOWED_ORIGINS || new URL(env.APP_URL).origin).split(',').map(s => s.trim());
  return allow.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
}
const json = (obj, status, h) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(h || {}) } });
const back = (env, frag) => new Response(null, { status: 303, headers: { Location: env.APP_URL + '#' + frag, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });

async function webhook(req, env) {
  const body = await req.text();
  if (!(await verifyStripeSignature(body, req.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET))) return json({ error: 'bad signature' }, 400);
  const ev = JSON.parse(body), o = ev.data && ev.data.object;
  if (await env.SAWW_KV.get('ev:' + ev.id)) return json({ ok: true, dup: true });
  if (ev.type === 'checkout.session.completed' && o.mode === 'subscription' && o.subscription) {
    const sub = await stripe(env, '/v1/subscriptions/' + o.subscription);
    await saveSub(env, sub, (o.customer_details && o.customer_details.email) || o.customer_email);
  } else if (/^customer\.subscription\.(created|updated|deleted|paused|resumed)$/.test(ev.type)) {
    await saveSub(env, o);
  } else if (ev.type === 'invoice.paid' && (o.subscription || (o.parent && o.parent.subscription_details))) {
    const sid = o.subscription || o.parent.subscription_details.subscription;
    await saveSub(env, await stripe(env, '/v1/subscriptions/' + sid), o.customer_email);
  }
  await env.SAWW_KV.put('ev:' + ev.id, '1', { expirationTtl: 7 * 86400 });
  return json({ ok: true });
}

async function activate(req, env) {
  const id = new URL(req.url).searchParams.get('session_id') || '';
  if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,}$/.test(id)) return back(env, 'saww-billing=error');
  let s;
  try { s = await stripe(env, '/v1/checkout/sessions/' + id + '?expand[]=subscription'); } catch (e) { return back(env, 'saww-billing=error'); }
  if (s.status !== 'complete' || !s.subscription) return back(env, 'saww-billing=pending');
  const sub = typeof s.subscription === 'string' ? await stripe(env, '/v1/subscriptions/' + s.subscription) : s.subscription;
  const rec = await saveSub(env, sub, (s.customer_details && s.customer_details.email) || s.customer_email);
  if (!isPro(rec)) return back(env, 'saww-billing=pending');
  return back(env, 'saww-pro=' + (await issue(env, rec)));
}

async function login(req, env) {
  let email = '';
  try { email = normEmail((await req.json()).email); } catch (e) {}
  if (!okEmail(email)) return json({ ok: false, error: 'email' }, 400, cors(env, req));
  const reply = json({ ok: true }, 200, cors(env, req));   // 会員かどうかに関わらず同じ返事
  if (await env.SAWW_KV.get('rl:' + email)) return reply;   // 同じアドレスへは1分に1回まで
  await env.SAWW_KV.put('rl:' + email, '1', { expirationTtl: 60 });
  const cus = await env.SAWW_KV.get('email:' + email);
  const rec = cus && (await freshRec(env, cus));
  if (!isPro(rec)) return reply;
  const body = b64u(enc.encode(JSON.stringify({ c: rec.cus, e: email, exp: now() + MAGIC_TTL })));
  const t = body + '.' + b64u(await hmac(env.MAGIC_SECRET, body));
  const link = new URL('/magic?t=' + t, req.url).toString();
  const html = `<p>saww audio ecosystem にログインするためのリンクです（20分間・1回だけ使えます）。</p><p><a href="${link}">ログインする</a></p><p>心当たりがない場合は、このメールを無視してください。</p><hr><p>This link signs you in to saww audio ecosystem (valid for 20 minutes, once).</p>`;
  const text = 'saww audio ecosystem にログインするためのリンク（20分間・1回だけ）：\n' + link + '\n\n心当たりがない場合は無視してください。\nSign-in link (20 minutes, once): ' + link;
  await fetch((env.RESEND_API || 'https://api.resend.com') + '/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: 'saww audio ecosystem へのログイン', html, text })
  }).catch(() => {});
  return reply;
}

async function magic(req, env) {
  const t = new URL(req.url).searchParams.get('t') || '';
  const [body, sig] = t.split('.');
  if (!body || !sig || !safeEq(sig, b64u(await hmac(env.MAGIC_SECRET, body)))) return back(env, 'saww-billing=link');
  let m; try { m = JSON.parse(dec.decode(unb64u(body))); } catch (e) { return back(env, 'saww-billing=link'); }
  if (!m.exp || m.exp < now() || (await env.SAWW_KV.get('used:' + sig))) return back(env, 'saww-billing=link');
  await env.SAWW_KV.put('used:' + sig, '1', { expirationTtl: MAGIC_TTL + 120 });
  const rec = await freshRec(env, m.c);
  if (!isPro(rec)) return back(env, 'saww-billing=inactive');
  return back(env, 'saww-pro=' + (await issue(env, rec)));
}

async function refresh(req, env) {
  let tok = '';
  try { tok = (await req.json()).token; } catch (e) {}
  const pl = await readToken(env, tok);
  if (!pl || !pl.sub || pl.exp + REFRESH_WINDOW < now()) return json({ ok: false, plan: 'free', error: 'token' }, 401, cors(env, req));
  const rec = await freshRec(env, pl.sub);
  if (!isPro(rec)) return json({ ok: true, plan: 'free', status: rec ? rec.status : 'none' }, 200, cors(env, req));
  return json({ ok: true, plan: 'pro', token: await issue(env, rec) }, 200, cors(env, req));
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    try {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
      if (pathname === '/stripe/webhook' && req.method === 'POST') return await webhook(req, env);
      if (pathname === '/activate' && req.method === 'GET') return await activate(req, env);
      if (pathname === '/login' && req.method === 'POST') return await login(req, env);
      if (pathname === '/magic' && req.method === 'GET') return await magic(req, env);
      if (pathname === '/refresh' && req.method === 'POST') return await refresh(req, env);
      if (pathname === '/' ) return json({ ok: true, service: 'saww-billing' });
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server' }, 500, cors(env, req));
    }
  }
};
