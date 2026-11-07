// PRO の証明に使う鍵の組を作る（一度だけ。秘密の鍵はサーバーの secret に、公開鍵はアプリの data/product_tiers.json に入れる）。
// 使い方：node server/keygen.mjs
const { subtle } = globalThis.crypto;
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const kid = 'saww-' + new Date().toISOString().slice(0, 10);
const priv = { ...(await subtle.exportKey('jwk', kp.privateKey)), kid };
const pub = await subtle.exportKey('jwk', kp.publicKey);
console.log('── 1) 秘密の鍵：誰にも見せない。次のコマンドで貼り付ける ──');
console.log('   npx wrangler secret put ENT_PRIVATE_JWK');
console.log(JSON.stringify(priv));
console.log('\n── 2) 公開鍵：data/product_tiers.json の billing.publicKey に入れる（見られても問題ない）──');
console.log(JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y, kid }));
