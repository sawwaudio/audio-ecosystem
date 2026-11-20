"""Owner sessions for the loopback desk and scoped, signed SAE studio passes."""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import time

STUDIO = 'https://sawwaudio.github.io/audio-ecosystem-sounds-1/'
PASS_TTL = 3600
SESSION_TTL = 8 * 3600

def b64(value):
    return base64.urlsafe_b64encode(value).decode('ascii').rstrip('=')

def fingerprint(value):
    return hashlib.sha256(value.encode('ascii')).hexdigest()

def setup_sessions(c):
    c.execute('CREATE TABLE IF NOT EXISTS access_grants(digest TEXT PRIMARY KEY, kind TEXT NOT NULL, expires INTEGER NOT NULL)')

def grant(c, kind, lifetime):
    now = int(time.time())
    value = secrets.token_urlsafe(32)
    setup_sessions(c)
    c.execute('DELETE FROM access_grants WHERE expires<=?', (now,))
    c.execute('INSERT INTO access_grants VALUES(?,?,?)', (fingerprint(value),kind,now+lifetime))
    return value

def consume_login(c, value):
    if not valid_format(value):
        return None
    setup_sessions(c)
    used = c.execute("DELETE FROM access_grants WHERE digest=? AND kind='launch' AND expires>?",(fingerprint(value),int(time.time())))
    return grant(c,'session',SESSION_TTL) if used.rowcount == 1 else None

def valid_format(value):
    return len(value)==43 and value.isascii() and all(ch.isalnum() or ch in '_-' for ch in value)

def session_ok(c,value):
    if not valid_format(value):
        return False
    setup_sessions(c)
    return bool(c.execute("SELECT 1 FROM access_grants WHERE digest=? AND kind='session' AND expires>?",(fingerprint(value),int(time.time()))).fetchone())

def provision(state):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    path = Path(state)/'studio-owner.pem'
    if not path.exists():
        key=ec.generate_private_key(ec.SECP256R1())
        with os.fdopen(os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600),'wb') as f:
            f.write(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    key=serialization.load_pem_private_key(path.read_bytes(),password=None)
    n=key.public_key().public_numbers()
    return {'kty':'EC','crv':'P-256','x':b64(n.x.to_bytes(32,'big')),'y':b64(n.y.to_bytes(32,'big'))}

def signed_claims(state, claims):
    from cryptography.hazmat.primitives import hashes,serialization
    from cryptography.hazmat.primitives.asymmetric import ec,utils
    key=serialization.load_pem_private_key((Path(state)/'studio-owner.pem').read_bytes(),password=None)
    payload=b64(json.dumps(claims,separators=(',',':')).encode())
    r,s=utils.decode_dss_signature(key.sign(payload.encode(),ec.ECDSA(hashes.SHA256())))
    return payload+'.'+b64(r.to_bytes(32,'big')+s.to_bytes(32,'big'))

def studio_url(state):
    now=int(time.time())
    return STUDIO+'#saww-admin='+signed_claims(state,{'aud':STUDIO,'role':'studio-admin','iat':now,'exp':now+PASS_TTL})

def device_url(state,code):
    from cryptography.hazmat.primitives.asymmetric import ec
    import re
    if not isinstance(code,str) or not re.fullmatch(r'[A-Za-z0-9_-]{87}',code):
        raise ValueError('登録するブラウザーの登録コードを入力してください。')
    raw=base64.urlsafe_b64decode(code+'=')
    if raw[0]!=4 or b64(raw)!=code:
        raise ValueError('登録コードを確認してください。')
    ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(),raw)
    claims={'aud':STUDIO,'role':'studio-device','key':code,'iat':int(time.time())}
    return STUDIO+'#saww-device='+signed_claims(state,claims)

def consume_device_ticket(c,ticket):
    if not valid_format(ticket):
        return False
    setup_sessions(c)
    return c.execute("DELETE FROM access_grants WHERE digest=? AND kind='device' AND expires>?",(fingerprint(ticket),int(time.time()))).rowcount==1
