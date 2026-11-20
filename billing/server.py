"""Same-origin sandbox billing API. Run behind HTTPS with a persistent private DB."""
import contextlib
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from email.message import EmailMessage
from http.cookies import SimpleCookie
from pathlib import Path
from wsgiref.simple_server import make_server

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = os.getenv("APP_ORIGIN", "http://localhost:8049").rstrip("/")
PRICE = os.getenv("STRIPE_PRICE_ID", "")
DB = os.getenv("BILLING_DB", "")
now = lambda: int(time.time())
digest = lambda s: hashlib.sha256(s.encode()).hexdigest()
schema = """
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,created_at INTEGER);
CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY,email TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,uid TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS limits(bucket TEXT PRIMARY KEY,count INTEGER,expires INTEGER);
CREATE TABLE IF NOT EXISTS customers(uid TEXT PRIMARY KEY,customer TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS checkout(uid TEXT PRIMARY KEY,nonce TEXT,sid TEXT);
CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,customer TEXT,price TEXT,status TEXT,period_end INTEGER,cancel_at INTEGER,updated INTEGER);
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,kind TEXT,processed INTEGER);
"""

class Failure(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)

def stripe(path, fields=None, key=None):
    secret = os.environ.get("STRIPE_SECRET_KEY", "")
    if not secret.startswith(("rk_test_", "sk_test_")):
        raise Failure("503 Service Unavailable", "Stripe Sandbox is unavailable")
    headers = {"Authorization": "Bearer " + secret, "Stripe-Version":"2026-09-30.endive"}
    if key:
        headers["Idempotency-Key"] = key
    data = None if fields is None else urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request("https://api.stripe.com/v1/" + path, data, headers)
    with urllib.request.urlopen(req, timeout=12) as response:
        return json.load(response)

def validate_price(p):
    if not (p["active"] and not p["livemode"] and p["currency"] == "usd" and
            p["unit_amount"] == 999 and p["recurring"]["interval"] == "month" and
            p["recurring"]["interval_count"] == 1 and p["recurring"]["usage_type"] == "licensed"):
        raise ValueError("unexpected monthly price")

def verify(raw, header):
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    parts = [p.split("=",1) for p in header.split(",") if "=" in p]
    ts = dict(parts).get("t","")
    if not secret or not ts.isdigit() or abs(now()-int(ts)) > 300:
        raise Failure("400 Bad Request","invalid signature")
    signature = hmac.new(secret.encode(), ts.encode()+b"."+raw, hashlib.sha256).hexdigest()
    if not any(k=="v1" and hmac.compare_digest(signature,v) for k,v in parts):
        raise Failure("400 Bad Request","invalid signature")

def subscription(db, sid, customer):
    sub = stripe("subscriptions/"+urllib.parse.quote(sid,safe="")+"?expand%5B%5D=latest_invoice")
    if sub["livemode"] or sub["customer"] != customer:
        raise ValueError("subscription ownership mismatch")
    item = next((i for i in sub["items"]["data"] if i["price"]["id"] == PRICE), None)
    paid = (sub.get("latest_invoice") or {}).get("status") == "paid"
    end = item["current_period_end"] if item and paid else 0
    cancel = sub.get("cancel_at") or (end if sub["cancel_at_period_end"] else 0)
    db.execute("INSERT OR REPLACE INTO subscriptions VALUES(?,?,?,?,?,?,?)",
               (sid,customer,PRICE if item else "",sub["status"],end,cancel,now()))

def webhook(db, event):
    if event["livemode"]:
        raise Failure("400 Bad Request","sandbox events only")
    if db.execute("SELECT 1 FROM events WHERE id=?", (event["id"],)).fetchone():
        return
    obj, kind = event["data"]["object"], event["type"]
    customer = obj.get("customer")
    sid = None
    if kind.startswith("customer.subscription."):
        sid = obj["id"]
    elif kind.startswith("checkout.session."):
        sid = obj.get("subscription")
    elif kind in ("invoice.paid","invoice.payment_failed"):
        sid = (((obj.get("parent") or {}).get("subscription_details") or {}).get("subscription") or obj.get("subscription"))
    if sid and db.execute("SELECT 1 FROM customers WHERE customer=?", (customer,)).fetchone():
        subscription(db,sid,customer)
    db.execute("INSERT INTO events VALUES(?,?,?)",(event["id"],kind,now()))

def plan(db,uid):
    row = db.execute("""SELECT status,period_end,cancel_at FROM subscriptions JOIN customers USING(customer)
        WHERE uid=? AND price=? ORDER BY (status='active' AND period_end>? AND (cancel_at=0 OR cancel_at>?)) DESC, updated DESC LIMIT 1""",
        (uid,PRICE,now(),now())).fetchone()
    active = bool(row and row[0]=="active" and row[1]>now() and (not row[2] or row[2]>now()))
    return dict(pro=active,status=row[0] if row else None,end=row[1] if row else None,
                cancel=row[2] if row else None,canUseProfessionalExport=active)

def rate(db,bucket,max_count):
    db.execute("DELETE FROM limits WHERE expires<=?",(now(),))
    db.execute("INSERT INTO limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1",(bucket,now()+900))
    if db.execute("SELECT count FROM limits WHERE bucket=?",(bucket,)).fetchone()[0]>max_count:
        raise Failure("429 Too Many Requests","Try again later")

def send_token(email,token):
    message=EmailMessage()
    message["To"]=email
    message["From"]=os.environ["MAIL_FROM"]
    message["Subject"]="saww audio ecosystem sign-in"
    message.set_content("Open this one-time sign-in link within 15 minutes:\n"+ORIGIN+"/billing/#token="+token)
    with smtplib.SMTP_SSL(os.environ["SMTP_HOST"],int(os.getenv("SMTP_PORT","465")),timeout=10) as smtp:
        smtp.login(os.environ["SMTP_USER"],os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)

def checkout(db,uid,email):
    if not PRICE:
        raise Failure("503 Service Unavailable","Sandbox price is not configured")
    validate_price(stripe("prices/"+PRICE))
    row = db.execute("SELECT customer FROM customers WHERE uid=?",(uid,)).fetchone()
    if row:
        customer=row[0]
    else:
        customer=stripe("customers",{"email":email},"customer-"+uid)["id"]
        db.execute("INSERT INTO customers VALUES(?,?)",(uid,customer))
        db.commit()
        db.execute("BEGIN IMMEDIATE")
    row=db.execute("SELECT nonce,sid FROM checkout WHERE uid=?",(uid,)).fetchone()
    if row and row[1]:
        previous=stripe("checkout/sessions/"+row[1])
        if previous["status"]=="open":
            return previous["url"]
        row=None
    subs=stripe("subscriptions?"+urllib.parse.urlencode({"customer":customer,"status":"all","limit":100}))
    if subs["has_more"] or any(s["status"] not in ("canceled","incomplete_expired") for s in subs["data"]):
        raise Failure("409 Conflict","Manage the existing subscription in Billing")
    if not row:
        nonce=secrets.token_hex(16)
        db.execute("INSERT OR REPLACE INTO checkout VALUES(?,?,NULL)",(uid,nonce))
        db.commit()
        db.execute("BEGIN IMMEDIATE")
        row=db.execute("SELECT nonce,sid FROM checkout WHERE uid=?",(uid,)).fetchone()
    session=stripe("checkout/sessions",{"customer":customer,"mode":"subscription","line_items[0][price]":PRICE,
        "line_items[0][quantity]":1,"success_url":ORIGIN+"/billing/?result=success","cancel_url":ORIGIN+"/billing/?result=cancel",
        "integration_identifier":"saww_audio_ndqxtjka"},"checkout-"+row[0])
    db.execute("UPDATE checkout SET sid=? WHERE uid=?",(session["id"],uid))
    return session["url"]

def route(env,db,headers):
    path=env["PATH_INFO"]
    method=env["REQUEST_METHOD"]
    n=int(env.get("CONTENT_LENGTH") or 0)
    if n<0 or n>1048576:
        raise Failure("413 Payload Too Large","request too large")
    raw=env["wsgi.input"].read(n)
    if path=="/api/webhook" and method=="POST":
        verify(raw,env.get("HTTP_STRIPE_SIGNATURE",""))
        webhook(db,json.loads(raw))
        return {}
    if method=="POST" and env.get("HTTP_ORIGIN")!=ORIGIN:
        raise Failure("403 Forbidden","invalid origin")
    data=json.loads(raw or b"{}")
    cookie=SimpleCookie()
    cookie.load(env.get("HTTP_COOKIE",""))
    token=cookie.get("saww_session")
    session_hash=digest(token.value if token else "")
    user=db.execute("SELECT id,email FROM users JOIN sessions ON uid=id WHERE hash=? AND expires>?",(session_hash,now())).fetchone()
    cookie_attrs="; HttpOnly; SameSite=Lax; Path=/"+("; Secure" if ORIGIN.startswith("https://") else "")
    if path=="/api/login" and method=="POST":
        email=str(data.get("email","")).strip().lower()
        if len(email)>254 or not re.fullmatch(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}",email):
            raise Failure("400 Bad Request","invalid email")
        rate(db,"email-"+digest(email),4)
        rate(db,"ip-"+digest(env.get("REMOTE_ADDR","")),40)
        token=secrets.token_urlsafe(32)
        db.execute("INSERT INTO tokens VALUES(?,?,?)",(digest(token),email,now()+900))
        send_token(email,token)
        return {}
    if path=="/api/verify" and method=="POST":
        key=digest(str(data.get("token","")))
        row=db.execute("SELECT email FROM tokens WHERE hash=? AND expires>?",(key,now())).fetchone()
        if not row:
            raise Failure("401 Unauthorized","sign-in link expired or already used")
        db.execute("DELETE FROM tokens WHERE hash=? OR expires<=?",(key,now()))
        db.execute("INSERT OR IGNORE INTO users VALUES(?,?,?)",(secrets.token_hex(16),row[0],now()))
        uid=db.execute("SELECT id FROM users WHERE email=?",row).fetchone()[0]
        token=secrets.token_urlsafe(32)
        db.execute("INSERT INTO sessions VALUES(?,?,?)",(digest(token),uid,now()+30*86400))
        headers.append(("Set-Cookie","saww_session="+token+"; Max-Age=2592000"+cookie_attrs))
        return {}
    if path=="/api/me" and method=="GET":
        return dict(signedIn=bool(user),**plan(db,user[0] if user else ""))
    if not user:
        raise Failure("401 Unauthorized","Sign in to use Pro")
    uid,email=user
    if path=="/api/logout" and method=="POST":
        db.execute("DELETE FROM sessions WHERE hash=?",(session_hash,))
        headers.append(("Set-Cookie","saww_session=; Max-Age=0"+cookie_attrs))
        return {}
    if path=="/api/checkout" and method=="POST":
        return {"url":checkout(db,uid,email)}
    if path=="/api/portal" and method=="POST":
        row=db.execute("SELECT customer FROM customers WHERE uid=?",(uid,)).fetchone()
        if not row:
            raise Failure("404 Not Found","No billing account")
        return {"url":stripe("billing_portal/sessions",{"customer":row[0],"return_url":ORIGIN+"/billing/"})["url"]}
    if path=="/api/export-header" and method=="POST":
        import struct
        if not plan(db,uid)["pro"]:
            raise Failure("403 Forbidden","WAV export requires Pro")
        frames,rate_hz=data.get("frames"),data.get("sampleRate")
        if type(frames)!=int or type(rate_hz)!=int or not (8000<=rate_hz<=384000 and 0<frames<=rate_hz*60):
            raise Failure("400 Bad Request","invalid audio format")
        size=frames*4
        return {"header":list(struct.pack("<4sI4s4sIHHIIHH4sI",b"RIFF",36+size,b"WAVE",b"fmt ",16,1,2,rate_hz,rate_hz*4,4,16,b"data",size))}
    raise Failure("404 Not Found","unknown endpoint")

def app(env,start):
    headers=[("Cache-Control","no-store"),("Referrer-Policy","no-referrer"),("X-Content-Type-Options","nosniff")]
    path=env["PATH_INFO"]
    if not path.startswith("/api/"):
        import mimetypes
        name={"/":"index.html","/billing/":"billing/pricing.html"}.get(path,path.lstrip("/"))
        file=(ROOT/name).resolve()
        allowed=file in (ROOT/"index.html",ROOT/"billing/pricing.html") or any(ROOT/d in file.parents for d in ("audio","instruments","data"))
        if not allowed or not file.is_file():
            start("404 Not Found",headers)
            return [b""]
        start("200 OK",headers+[("Content-Type",mimetypes.guess_type(str(file))[0] or "application/octet-stream")])
        stream=file.open("rb")
        return env.get("wsgi.file_wrapper",__import__("wsgiref.util",fromlist=["FileWrapper"]).FileWrapper)(stream)
    status="200 OK"
    try:
        with contextlib.closing(sqlite3.connect(DB,timeout=20)) as db, db:
            if env["REQUEST_METHOD"]=="POST":
                db.execute("BEGIN IMMEDIATE")
            result=route(env,db,headers)
    except Failure as error:
        status,result=error.status,{"error":str(error)}
    except Exception as error:
        print("billing request failed:",type(error).__name__,file=sys.stderr)
        status,result="503 Service Unavailable",{"error":"Billing service unavailable"}
    start(status,headers+[("Content-Type","application/json")])
    return [json.dumps(result).encode()]

if __name__=="__main__":
    if not DB or not Path(DB).is_absolute() or ROOT in Path(DB).resolve().parents:
        sys.exit("Set BILLING_DB to an absolute private path outside the repository")
    os.umask(0o077)
    with contextlib.closing(sqlite3.connect(DB)) as db:
        db.executescript(schema)
    make_server("127.0.0.1",int(os.getenv("PORT","8049")),app).serve_forever()
