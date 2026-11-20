import datetime as dt
import tempfile
import unittest
from pathlib import Path
import desk
class QueueTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  desk.STATE=Path(self.tmp.name);self.c=desk.db();self.addCleanup(self.c.close)
  self.now=dt.datetime(2026,11,10,19,tzinfo=desk.JST);self.calls=[]
  self.c.execute("insert into jobs(day,series,state,caption) values('2026-11-10','make','review','demo')");self.c.commit()
 def api(self,path,data=None):
  self.calls.append(path)
  if path=='acct/media':
   self.assertEqual(data['share_to_feed'],'false');return {'id':'C','uri':'https://rupload.facebook.com/ig-api-upload/test'}
  if path=='acct/media_publish':
   if getattr(self,'lost',False):raise TimeoutError()
   return {'id':'M'}
  if 'fields=status' in path:return {'status_code':getattr(self,'status','FINISHED')}
  return {'data':[{'id':'M','caption':'demo #sae20261110'}]}
 def tick(self,h=19,m=0,manual=False):
  desk.tick(self.c,self.now.replace(hour=h,minute=m),self.api,lambda:'acct',lambda *args:None,manual=manual)
 def change(self,sql):self.c.execute(sql);self.c.commit()
 def test_clock(self):
  self.tick();self.assertFalse(self.calls)
  self.change("update jobs set state='approved'");self.tick(18,49);self.assertFalse(self.calls)
  self.tick(18,50);self.tick(18,59);self.assertNotIn('acct/media_publish',self.calls)
  self.tick();self.assertNotIn('acct/media_publish', self.calls);self.tick(manual=True);self.tick(manual=True);self.assertEqual(self.calls.count('acct/media_publish'),1)
  self.assertEqual(self.c.execute('select media from jobs').fetchone()[0],'M')
 def test_lost_response(self):
  self.lost=True;self.change("update jobs set state='approved'");self.tick();self.tick(manual=True);self.tick()
  self.assertEqual(self.c.execute('select state,media from jobs').fetchone()[:],('published','M'))
  self.assertEqual(self.calls.count('acct/media_publish'),1)
 def test_paused_and_draft(self):
  self.change("update jobs set state='approved'");self.change('update settings set paused=1');self.tick()
  self.change("update settings set paused=0, mode='DRAFT'");self.tick();self.assertFalse(self.calls)
 def test_error(self):
  self.status='ERROR';self.change("update jobs set state='approved'");self.tick();self.tick();self.tick()
  self.assertEqual(self.c.execute('select state from jobs').fetchone()[0],'failed');self.assertNotIn('acct/media_publish',self.calls)
 def test_midnight_recovery(self):
  self.change("update jobs set state='uncertain'")
  desk.reconcile_previous(self.c,self.now.date()+dt.timedelta(days=1),self.api,lambda:'acct')
  self.assertEqual(self.c.execute('select media from jobs').fetchone()[0],'M')
  self.assertNotIn('acct/media_publish',self.calls)
 def test_switch_from_auto(self):
  self.change("update settings set mode='AUTO'");self.tick(18,55)
  self.change("update settings set mode='APPROVAL'");self.tick()
  self.assertNotIn('acct/media_publish',self.calls)
 def test_crash_while_uploading(self):
  self.change("update jobs set state='creating'");desk.recover(self.c)
  self.assertEqual(self.c.execute('select state from jobs').fetchone()[0],'failed')
if __name__=='__main__':unittest.main()
