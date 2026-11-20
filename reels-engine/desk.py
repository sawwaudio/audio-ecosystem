"""Local operator station. Run with a dedicated OS account; never proxy this port."""
import datetime as dt
import hashlib
import weekly
import studio_access
import re
import json
import os
import secrets
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.parse as url
import urllib.request as http
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=Path(os.getenv('SAE_ROOT',HERE.parent))
STATE=Path(os.environ.get('REELS_STATE',Path.home()/'Library/Application Support/saww-reels'))
PORT=int(os.environ.get('REELS_PORT',8769))
ORIGIN=f'http://127.0.0.1:{PORT}'
JST=dt.timezone(dt.timedelta(hours=9))
def db():
 STATE.mkdir(parents=True,exist_ok=True,mode=0o700)
 c=sqlite3.connect(STATE/'queue.sqlite',timeout=10)
 c.row_factory=sqlite3.Row
 c.executescript("""CREATE TABLE IF NOT EXISTS jobs(
 day TEXT PRIMARY KEY,series TEXT,seed INTEGER,state TEXT,folder TEXT,caption TEXT,
 container TEXT,media TEXT,reason TEXT DEFAULT '',metrics TEXT DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),mode TEXT,paused INTEGER);
 INSERT OR IGNORE INTO settings VALUES(1,'APPROVAL',0);""")
 if 'approval' not in {r[1] for r in c.execute('pragma table_info(jobs)')}:
  c.execute('alter table jobs add column approval integer default 0')
  c.execute("update jobs set approval=1 where state='approved'");c.commit()
 return c
def config(name):
 value=os.getenv(name)
 if value:return value
 file=STATE/'meta-config.json'
 if not file.is_file():raise RuntimeError('Meta設定が必要です。管理用READMEを参照してください。')
 return json.loads(file.read_text())[name]

def graph(path,data=None):
 version=config('IG_API_VERSION');token=credential()
 target='https://graph.facebook.com/'+version+'/'+path
 req=http.Request(target,data=url.urlencode(data).encode() if data is not None else None,headers={'Authorization':'Bearer '+token})
 with http.urlopen(req,timeout=25) as response:return json.load(response)
def account():
 me=graph(config('IG_USER_ID')+'?fields=id,username')
 if me['username'].lower()!='saww_audio_ecosystem':raise ValueError('Unexpected publishing account')
 return str(me['id'])
def stamp(day):return '#sae'+day.replace('-','')
def artifact(job,ext):
 return Path(job['folder'])/(job['series']+ext)
def enqueue(c,day,series,seed,folder):
 report=json.loads((folder/(series+'.json')).read_text())
 if report['qa']!='decoded' or report['sha256']!=hashlib.sha256((folder/(series+'.mp4')).read_bytes()).hexdigest(): raise ValueError('Quality check failed')
 c.execute('INSERT INTO jobs(day,series,seed,state,folder,caption) VALUES(?,?,?,?,?,?)',(day,series,seed,'review',str(folder.resolve()),report['caption']))
 c.commit()
def plan(c,date):
 from render import LIBRARY,render
 if c.execute('select 1 from jobs where day=?',(str(date),)).fetchone():return
 history=list(c.execute('select series from jobs where day>=? and day<? order by day desc',(str(date-dt.timedelta(days=30)),str(date))))
 recent=[r[0] for r in history]
 series=weekly.select(c,date,LIBRARY,recent)
 folder=STATE/str(date);seed=date.toordinal()
 if series in ('make','create'):
  subprocess.run(['node',str(HERE/'capture.cjs'),str(folder)],check=True,timeout=100)
 sources=[]
 for previous in c.execute('select * from jobs where day>=? and day<? order by day desc',(str(date-dt.timedelta(days=30)),str(date))):
  sources.extend(entry['id'] for entry in json.loads(artifact(previous,'.json').read_text())['rights'])
 render(series,ROOT,folder,folder,seed,sources)
 enqueue(c,str(date),series,seed,folder)
def credential():
 token=os.getenv('IG_ACCESS_TOKEN')
 if token:return token
 result=subprocess.run(['/usr/bin/security','find-generic-password','-a','meta','-s','saww-reels','-w'],capture_output=True,text=True)
 token=result.stdout.strip() if result.returncode==0 else None
 if not token:raise RuntimeError('Meta credential required')
 return token

def upload_media(job,uri):
 dest=url.urlsplit(uri)
 if dest.scheme!='https' or dest.netloc!='rupload.facebook.com' or not dest.path.startswith('/ig-api-upload/'):
  raise ValueError('Unexpected Meta upload destination')
 data=artifact(job,'.mp4').read_bytes()
 if hashlib.sha256(data).hexdigest()!=json.loads(artifact(job,'.json').read_text())['sha256']:raise ValueError('Artifact changed after approval')
 req=http.Request(uri,data,headers={'Authorization':'OAuth '+credential(),'Content-Type':'application/octet-stream','offset':'0','file_size':str(len(data))})
 with http.urlopen(req,timeout=240) as res:
  if json.load(res).get('success') is not True:raise ValueError('Upload rejected')

def tick(c,now,api=graph,identity=account,upload=upload_media,manual=False):
 day=str(now.date());mode,paused=c.execute('select mode,paused from settings').fetchone()
 if paused or mode=='DRAFT':return
 job=c.execute('select * from jobs where day=?',(day,)).fetchone()
 if not job:return
 state=job['state']
 def update(new,**fields):
  allowed={'container','media','reason'}
  assert fields.keys()<=allowed
  cur=c.execute('update jobs set state=?'+''.join(','+k+'=?' for k in fields)+' where day=? and state=?',(new,*fields.values(),day,state))
  c.commit();return cur.rowcount==1
 if state in ('uncertain','publishing'):
  uid=identity();items=api(uid+'/media?fields=id,caption&limit=50')['data']
  matches=[m['id'] for m in items if stamp(day) in m.get('caption','').split()]
  if len(matches)==1:update('published',media=matches[0],reason='')
  return
 if state=='review':return
 if state in ('approved','review'):
  if not manual and not (now.hour==19 or now.hour==18 and now.minute>=50):return
  uid=identity()
  if not update('creating'):return
  if state=='approved':
   c.execute('update jobs set approval=1 where day=?',(day,));c.commit()
  try:
   media=api(uid+'/media',dict(media_type='REELS',share_to_feed='false',upload_type='resumable',thumb_offset='1000',caption=job['caption']+'\n'+stamp(day)))
   c.execute("update jobs set container=? where day=?",(media['id'],day));c.commit()
   upload(job,media['uri'])
   c.execute("update jobs set state='processing',container=? where day=? and state='creating'",(media['id'],day))
  except Exception as e:
   c.execute("update jobs set state='failed',reason=? where day=?",(type(e).__name__+' creating container',day))
  c.commit();return
 if state!='processing':return
 code=api(job['container']+'?fields=status_code')['status_code']
 if code in ('ERROR','EXPIRED'):update('failed',reason=code);return
 if code!='FINISHED' or (not manual and now.hour!=19):return
 uid=identity()
 c.execute('BEGIN IMMEDIATE')
 mode,paused=c.execute('select mode,paused from settings').fetchone()
 if not manual or paused or mode=='DRAFT' or not job['approval']:
  c.rollback();return
 if not update('publishing'):return
 try:
  mid=api(uid+'/media_publish',{'creation_id':job['container']})['id']
  c.execute("update jobs set state='published',media=? where day=?",(mid,day))
 except Exception as e:
  c.execute("update jobs set state='uncertain',reason=? where day=?",(type(e).__name__+'; reconcile before retry',day))
 c.commit()
def insights(c):
 for j in c.execute("select day,media from jobs where state='published'"):
  metrics={}
  for name in ('views','reach','saved','shares','comments','profile_visits'):
   try:
    items=graph(j['media']+'/insights?metric='+name)['data']
    metrics[name]=items[0]['values'][0]['value'] if items else None
   except (KeyError,IndexError,http.HTTPError):metrics[name]=None
  c.execute('update jobs set metrics=? where day=?',(json.dumps(metrics),j['day']))
 c.commit()

def recover(c):
 # A stopped create/upload has no publish request. Keep the old ID for audit.
 c.execute("update jobs set state='failed',reason='Interrupted before publication' where state='creating'")
 c.commit()

def reconcile_previous(c,today,api=graph,identity=account):
 pending=list(c.execute("select day from jobs where day<? and state in ('uncertain','publishing') order by day",(str(today),)))
 if not pending:return
 uid=identity();items=api(uid+'/media?fields=id,caption&limit=100')['data']
 for row in pending:
  day=row['day'];matches=[m['id'] for m in items if stamp(day) in m.get('caption','').split()]
  if len(matches)==1:
   c.execute("update jobs set state='published',media=?,reason='' where day=? and state in ('uncertain','publishing')",(matches[0],day))
 c.commit()

def clockloop():
 last_report=None
 while True:
  try:
   with db() as c:
    now=dt.datetime.now(JST);tick(c,now)
    if not c.execute('select paused from settings').fetchone()[0]:
     for offset in [0,1]:plan(c,now.date()+dt.timedelta(days=offset))
     reconcile_previous(c,now.date())
     if now.hour>=20 and last_report!=now.date():
      insights(c);last_report=now.date()
  except Exception as e:print(type(e).__name__,str(e)[:150],file=sys.stderr,flush=True)
  time.sleep(50)
class Handler(BaseHTTPRequestHandler):
 def operator(self):
  cookie=SimpleCookie();cookie.load(self.headers.get('Cookie',''))
  if 'operator' not in cookie:return False
  with db() as c:return studio_access.session_ok(c,cookie['operator'].value)
 def log_message(self,fmt,*args):
  pass
 def reply(self,body,mime='application/json',code=200):
  self.send_response(code);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('X-Frame-Options','DENY');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_GET(self):
  if self.headers.get('Host')!=f'127.0.0.1:{PORT}':return self.send_error(403)
  if self.path=='/finish-device':
   return self.reply((HERE/'finish-device.html').read_bytes(),'text/html; charset=utf-8')
  if self.path=='/access':
   return self.reply(b"""<!doctype html><meta charset=utf-8><body><script>
   (async()=>{
    const fragment=location.hash.slice(1),direct=fragment.startsWith('studio.');
    history.replaceState(null,'','/access');
    const r=await fetch('/access',{method:'POST',headers:{'Content-Type':'text/plain'},body:direct?fragment.slice(7):fragment});
    if(!r.ok)throw Error();
    if(!direct){location.replace('/');return}
    const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'studio'})});
    if(!response.ok)throw Error();
    location.replace((await response.json()).url)
   })().catch(()=>document.body.textContent='Reopen SAE from the local launcher.');
   </script>""",'text/html; charset=utf-8')
  if not self.operator():return self.reply('このMacで「投稿管理を開く.command」を開いてください。'.encode(),'text/plain; charset=utf-8',403)
  with db() as c:
   if self.path=='/':return self.reply((HERE/'admin.html').read_bytes(),'text/html; charset=utf-8')
   if self.path=='/api':
    jobs=[dict(j) for j in c.execute('select * from jobs order by day desc limit 60')]
    for j in jobs:
     j['rights']=json.loads(artifact(j,'.json').read_text())['rights'];j.pop('folder')
    return self.reply(json.dumps({'settings':dict(c.execute('select * from settings').fetchone()),'jobs':sorted(jobs,key=lambda j:(j['day']<str(dt.datetime.now(JST).date()),j['day'])),'weekly':weekly.summary(c,dt.date.today()-dt.timedelta(days=7),dt.date.today()+dt.timedelta(days=1))}).encode())
   if self.path.startswith('/video/'):
    j=c.execute('select * from jobs where day=?',(self.path[7:],)).fetchone()
    if j:return self.reply(artifact(j,'.mp4').read_bytes(),'video/mp4')
   self.send_error(404)
 def do_POST(self):
  if self.path=='/finish-device' and self.headers.get('Origin')==ORIGIN and self.headers.get('Host')==ORIGIN[7:] and self.headers.get('Content-Type')=='application/json':
   try:
    n=int(self.headers.get('Content-Length','0'))
    if not 0<n<512:return self.send_error(400)
    data=json.loads(self.rfile.read(n))
    with db() as c:
     if not studio_access.consume_device_ticket(c,data['ticket']):return self.send_error(403)
     link=studio_access.device_url(STATE,data['code'])
    return self.reply(json.dumps({'url':link}).encode())
   except (ValueError,KeyError,TypeError):return self.send_error(400)
  if self.path=='/access' and self.headers.get('Origin')==ORIGIN and self.headers.get('Host')==ORIGIN[7:]:
   n=int(self.headers.get('Content-Length','0'))
   if not 0<n<=120:return self.send_error(403)
   with db() as c:session=studio_access.consume_login(c,self.rfile.read(n).decode('ascii',errors='replace'))
   if not session:return self.send_error(403)
   self.send_response(204);self.send_header('Set-Cookie','operator='+session+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+str(studio_access.SESSION_TTL));self.end_headers();return
  if not self.operator() or self.path!='/api' or self.headers.get('Origin')!=ORIGIN or self.headers.get('Host')!=ORIGIN[7:] or self.headers.get('Content-Type')!='application/json':return self.send_error(403)
  try:
   n=int(self.headers['Content-Length']);assert 0<n<=12000
   data=json.loads(self.rfile.read(n));op=data['action'];day=data.get('day')
   with db() as c:
    if op=='studio':
     ticket=studio_access.grant(c,'device',180)
     return self.reply(json.dumps({'url':studio_access.STUDIO+'#saww-register='+ticket}).encode())
    if op=='pair-device':
     return self.reply(json.dumps({'url':studio_access.device_url(STATE,data['code'])}).encode())
    if op in ('pause','resume'):c.execute('update settings set paused=?',(op=='pause',))
    elif op=='mode':
     mode=data['mode']
     if mode not in ('DRAFT','APPROVAL','AUTO'):raise ValueError('mode')
     if mode=='AUTO' and not c.execute("select 1 from jobs where state='published' and media is not null").fetchone():raise ValueError('First complete an approved test publication')
     c.execute('update settings set mode=?',(mode,))
    elif op in ('approve','save'):
     text=data['caption'];assert 0<len(text)<2120
     j=c.execute('select * from jobs where day=?',(day,)).fetchone()
     for r in json.loads(artifact(j,'.json').read_text())['rights']:
      if not all(r[k] in text for k in ('author','license','url','licenseURL')):raise ValueError('Keep required credits')
     c.execute("update jobs set state=?,caption=? where day=? and state in ('review','approved')",('approved' if op=='approve' else 'review',text,day))
     if op=='approve' and j['state']=='processing' and text==j['caption']:
      c.execute('update jobs set approval=1 where day=?',(day,))
    elif op=='regenerate':
     j=c.execute('select * from jobs where day=?',(day,)).fetchone()
     if not j or j['state'] not in ('review','approved','failed'):raise ValueError('Job already in flight')
     seed=secrets.randbelow(2**31);folder=STATE/(day+'-'+str(seed));series=j['series']
     from render import render
     if series in ('make','create'):subprocess.run(['node',str(HERE/'capture.cjs'),str(folder)],check=True,timeout=100)
     render(series,ROOT,folder,folder,seed)
     cur=c.execute("delete from jobs where day=? and state=? and seed=?",(day,j['state'],j['seed']))
     if cur.rowcount!=1:raise ValueError('Concurrent change')
     enqueue(c,day,series,seed,folder)
    elif op=='insights':
     insights(c)
    elif op=='publish':tick(c,dt.datetime.now(JST),manual=True)
    else:raise ValueError('action')
    c.commit()
   self.reply(b'{}')
  except Exception as e:self.reply(json.dumps({'error':str(e)[:180]}).encode(),code=400)
if __name__=='__main__':
 if sys.argv[1:] in (['open'],['studio']):
  import webbrowser
  with db() as c:ticket=studio_access.grant(c,'launch',90)
  webbrowser.open(ORIGIN+'/access#'+('studio.' if sys.argv[1]=='studio' else '')+ticket)
 elif sys.argv[1:]==['check-meta']:
  print('Connected to @saww_audio_ecosystem, ID',account())
 else:
  server=ThreadingHTTPServer(('127.0.0.1',PORT),Handler)
  with db() as c:recover(c)
  threading.Thread(target=clockloop,daemon=True).start()
  server.serve_forever()
