// saww audio ecosystem — 通信を減らすための保存（Service Worker・v0.53）
// オーナー要望（2026-11-07「ネットが弱いとすごい重い」）。
// - 音源（audio/・instruments/）・書体・写真（CORS で読んだもの）は、一度読んだらこの端末に保存し、次からは通信なしで使う（cache-first）。
//   ファイル名に版や SHA-256 は入っていないが、音源ファイルは差し替えない運用（新しい音は新しい名前）なので古くならない。
// - ページ本体は通信を優先し、4秒で返らない・つながらない時だけ保存した版を出す（最新版がすぐ見られるように）。
// - 範囲指定（Range）の読み込み・POST・中身の見えない応答（opaque）は保存しない。保存は最大 MAX 件まで（古い順に消す）。
const PAGE = 'saww-page-1', MEDIA = 'saww-media-1', MAX = 700;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('saww-') && k !== PAGE && k !== MEDIA) await caches.delete(k);
  await self.clients.claim();
})()));
const isMedia = u => /\/(audio|instruments)\/.+\.(mp3|flac|ogg|opus|wav|m4a)$/i.test(u.pathname) ||
  u.hostname === 'fonts.gstatic.com' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'upload.wikimedia.org';
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (r.mode === 'navigate') e.respondWith(page(r));
  else if (isMedia(u)) e.respondWith(media(r));
});
async function page(r) {
  const c = await caches.open(PAGE);
  const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()).catch(() => {}); return res; });
  net.catch(() => {});
  const late = new Promise(ok => setTimeout(ok, 4000));
  try {
    const res = await Promise.race([net, late.then(() => null)]);
    if (res) return res;
    return (await c.match(r, { ignoreSearch: true })) || await net;
  } catch (err) {
    const hit = await c.match(r, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
async function media(r) {
  const c = await caches.open(MEDIA);
  const hit = await c.match(r);
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok && (res.type === 'basic' || res.type === 'cors')) c.put(r, res.clone()).then(() => trim(c)).catch(() => {});
  return res;
}
async function trim(c) {
  const ks = await c.keys();
  for (let i = 0; i < ks.length - MAX; i++) await c.delete(ks[i]);
}
self.addEventListener('message', e => {
  if (e.data === 'saww-clear') e.waitUntil(caches.delete(MEDIA).then(() => e.source && e.source.postMessage('saww-cleared')));
});
