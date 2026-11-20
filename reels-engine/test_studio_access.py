import base64
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
import studio_access as access

class OwnerAccessTest(unittest.TestCase):
    def setUp(self):
        self.c=sqlite3.connect(':memory:')
        self.addCleanup(self.c.close)
    def test_launcher_and_session_are_separate(self):
        launch=access.grant(self.c,'launch',90)
        self.assertFalse(access.session_ok(self.c,launch))
        session=access.consume_login(self.c,launch)
        self.assertTrue(access.session_ok(self.c,session))
        self.assertIsNone(access.consume_login(self.c,launch))
        self.assertIsNone(access.consume_login(self.c,session))
    def test_expired_access(self):
        self.assertIsNone(access.consume_login(self.c,access.grant(self.c,'launch',-1)))
        self.assertFalse(access.session_ok(self.c,access.grant(self.c,'session',-1)))
    def test_studio_pass_is_scoped_and_signed(self):
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import ec,utils
        decode=lambda s:base64.urlsafe_b64decode(s+'='*(-len(s)%4))
        with tempfile.TemporaryDirectory() as folder:
            jwk=access.provision(folder)
            self.assertEqual(jwk,access.provision(folder))
            payload,sig=access.studio_url(folder).split('#saww-admin=')[1].split('.')
            n=lambda s:int.from_bytes(s,'big')
            key=ec.EllipticCurvePublicNumbers(n(decode(jwk['x'])),n(decode(jwk['y'])),ec.SECP256R1()).public_key()
            raw=decode(sig);key.verify(utils.encode_dss_signature(n(raw[:32]),n(raw[32:])),payload.encode(),ec.ECDSA(hashes.SHA256()))
            claims=json.loads(decode(payload))
            self.assertEqual((claims['aud'],claims['role'],claims['exp']-claims['iat']),(access.STUDIO,'studio-admin',3600))
            self.assertEqual((Path(folder)/'studio-owner.pem').stat().st_mode & 0o777,0o600)

class DevicePairTest(unittest.TestCase):
    def test_mac_pairing_ticket_cannot_sign_in_or_be_reused(self):
        with sqlite3.connect(':memory:') as db:
            ticket=access.grant(db,'device',180)
            self.assertFalse(access.session_ok(db,ticket))
            self.assertIsNone(access.consume_login(db,ticket))
            self.assertTrue(access.consume_device_ticket(db,ticket))
            self.assertFalse(access.consume_device_ticket(db,ticket))
            self.assertFalse(access.consume_device_ticket(db,access.grant(db,'device',-1)))
    def test_device_cert_is_bound_to_the_approved_public_key(self):
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        key=ec.generate_private_key(ec.SECP256R1()).public_key()
        code=access.b64(key.public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint))
        with tempfile.TemporaryDirectory() as folder:
            access.provision(folder)
            body=access.device_url(folder,code).split('#saww-device=')[1].split('.')[0]
            claims=json.loads(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
            self.assertEqual((claims['key'],claims['role'],claims['aud']),(code,'studio-device',access.STUDIO))
            with self.assertRaises(ValueError):access.device_url(folder,'invalid')
