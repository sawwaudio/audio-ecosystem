import hashlib
import hmac
import io
import json
import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import server as s

class Flow(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.enter(patch.object(s,"DB",self.tmp.name+"/billing.db"))
        self.enter(patch.object(s,"PRICE","price_test"))
        self.enter(patch.dict(os.environ,STRIPE_WEBHOOK_SECRET="test_signature"))
        self.mail=self.enter(patch.object(s,"send_token"))
        self.remote=self.enter(patch.object(s,"stripe",side_effect=self.stripe))
        with sqlite3.connect(s.DB) as db:
            db.executescript(s.schema)
        self.status="active"
        self.end=s.now()+500
        self.cancel=False
        self.completed=False
        self.cookie=""
    def enter(self,p):
        self.addCleanup(p.stop)
        return p.start()
    def stripe(self,path,fields=None,key=None):
        if path.startswith("prices/"):
            return dict(active=True,livemode=False,currency="usd",unit_amount=999,recurring=dict(interval="month",interval_count=1,usage_type="licensed"))
        if path=="customers":return {"id":"cus_1"}
        if path.startswith("subscriptions?"):return dict(has_more=False,data=[{"status":self.status}] if self.completed else [])
        if path.startswith("checkout/sessions"):return dict(id="cs_1",status="complete" if self.completed else "open",url="https://example.test/pay")
        if path=="billing_portal/sessions":
            self.assertEqual(fields["customer"],"cus_1")
            return {"url":"https://example.test/manage"}
        if path.startswith("subscriptions/sub_1?"):
            return dict(latest_invoice={"status":"paid"},customer="cus_1",livemode=False,status=self.status,items={"data":[{"price":{"id":s.PRICE},"current_period_end":self.end}]},cancel_at_period_end=self.cancel)
        raise AssertionError(path)
    def call(self,path,data=None,status=200,signature="",origin=None):
        raw=json.dumps(data).encode() if data is not None else b""
        env=dict(PATH_INFO="/api/"+path,REQUEST_METHOD="POST" if data is not None else "GET",CONTENT_LENGTH=str(len(raw)),HTTP_ORIGIN=origin or s.ORIGIN,HTTP_COOKIE=self.cookie,HTTP_STRIPE_SIGNATURE=signature)
        env["wsgi.input"]=io.BytesIO(raw)
        response=[]
        result=b"".join(s.app(env,lambda st,h:response.extend([st,h])))
        self.assertEqual(int(response[0][:3]),status,result)
        for k,v in response[1]:
            if k=="Set-Cookie":self.cookie=v.split(";")[0]
        return json.loads(result)
    def login(self):
        self.call("login",{"email":"a@example.test"})
        token=self.mail.call_args.args[1]
        self.call("verify",{"token":token})
        self.call("verify",{"token":token},401)
    def event(self,kind,id):
        obj={"id":"sub_1","customer":"cus_1","subscription":"sub_1"}
        event={"id":id,"type":kind,"livemode":False,"data":{"object":obj}}
        ts=str(s.now())
        sig=hmac.new(b"test_signature",ts.encode()+b"."+json.dumps(event).encode(),hashlib.sha256).hexdigest()
        self.call("webhook",event,signature="t="+ts+",v1="+sig)
    def test_lifecycle(self):
        self.assertFalse(self.call("me")["signedIn"])
        self.call("checkout",{},401)
        self.login()
        audio={"frames":48000,"sampleRate":48000}
        self.call("export-header",audio,403)
        self.call("checkout",{},403,origin="https://example.test")
        self.assertEqual(self.call("checkout",{}),self.call("checkout",{}))
        self.assertFalse(self.call("me")["pro"])
        self.completed=True
        self.event("checkout.session.completed","e1")
        self.event("checkout.session.completed","e1")
        self.assertTrue(self.call("me")["pro"])
        self.assertEqual(bytes(self.call("export-header",audio)["header"])[:4],b"RIFF")
        self.call("checkout",{},409)
        first_device=self.cookie
        self.cookie=""
        self.login()
        self.assertNotEqual(self.cookie,first_device)
        self.assertTrue(self.call("me")["pro"])
        self.call("portal",{})
        self.status="past_due"
        self.event("invoice.payment_failed","e2")
        self.call("export-header",audio,403)
        self.status="active"
        self.event("invoice.paid","e3")
        self.cancel=True
        self.event("customer.subscription.updated","e4")
        self.assertEqual(self.call("me")["cancel"],self.end)
        with patch.object(s,"now",return_value=self.end+1):
            self.call("export-header",audio,403)
        self.status="canceled"
        self.event("customer.subscription.deleted","e5")
        self.event("customer.subscription.created","late")
        self.assertFalse(self.call("me")["pro"])
        self.call("logout",{})
        self.assertFalse(self.call("me")["signedIn"])
        self.cookie=first_device
        self.assertTrue(self.call("me")["signedIn"])
    def test_invalid_signature(self):
        self.call("webhook",{},400)
    def test_webhook_retry(self):
        self.login()
        self.call("checkout",{})
        self.remote.side_effect=TimeoutError
        with self.assertRaises(AssertionError):
            self.event("invoice.paid","retry")
        self.remote.side_effect=self.stripe
        self.event("invoice.paid","retry")
        self.assertTrue(self.call("me")["pro"])

if __name__=="__main__":
    unittest.main()
