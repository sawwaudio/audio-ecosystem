import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {growthRoute} from './routes.mjs';
import {sync} from './readdy-sync.mjs';
const get=(url,options)=>growthRoute(new Request(new URL(url,'https://worker.example'),options),{});
test('six public collections, unknown and non-read requests denied',async()=>{
 for(const k of ['features','sounds','presets','media','releases','pricing'])assert.ok(Array.isArray(await(await get('/api/public/'+k)).json()));
 assert.equal((await get('/api/public/constructor')).status,404);
 assert.equal((await get('/api/public/pricing',{method:'POST'})).status,405);
});
test('unchanged content and upstream failure preserve previous proposal',async()=>{
 const dir=await mkdtemp(tmpdir()+'/saww-');
 try{assert.ok((await sync('https://worker.example',dir,get)).changed);assert.equal((await sync('https://worker.example',dir,get)).changed,false);
 await assert.rejects(sync('https://worker.example',dir,async()=>new Response(null,{status:503})));
 assert.equal((await sync('https://worker.example',dir,get)).changed,false)}finally{await rm(dir,{recursive:true,force:true})}
});
test('unique delivery, repeat browser, rejected billing event and unavailable metrics',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('schema.sql',import.meta.url),'utf8'));
 const D1={prepare:q=>({bind:(...p)=>({run:()=>db.prepare(q).run(...p)})})};
 const browser=crypto.randomUUID(),id=crypto.randomUUID();
 const post=(name,eventId,env={USAGE_DB:D1})=>growthRoute(new Request('https://worker.example/api/usage/events',{method:'POST',headers:{Origin:'https://sawwaudio.github.io','Content-Type':'application/json'},body:JSON.stringify({name,id:eventId,browser,source:'instagram'})}),env);
 assert.equal((await post('app_open',id,{})).status,503);
 assert.equal((await post('subscription_activated',id)).status,400);
 assert.equal((await post('app_open',id)).status,204);await post('app_open',id);await post('app_open',crypto.randomUUID());
 assert.equal(db.prepare('select count(*) n from usage_event').get().n,2);
 assert.equal(db.prepare('select active_browsers from daily_usage').get().active_browsers,1);
 db.close();
});

import {billingFact} from './billing-facts.mjs';
async function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(await readFile(new URL('schema.sql',import.meta.url),'utf8'));
 const D1={prepare:sql=>({bind:(...args)=>({run:()=>db.prepare(sql).run(...args),first:()=>db.prepare(sql).get(...args)})}),batch:async statements=>{db.exec('BEGIN');try{for(const s of statements)s.run();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}};
 return {db,env:{USAGE_DB:D1,READDY_DEMO_KEY:'fixture-readdy',RENDER_SERVICE_KEY:'fixture-engine'}};
}
test('service job replay, isolation, quota, claim and final state',async()=>{
 const {db,env}=await fixture(),base='https://worker.example',root='/api/integrations/readdy/demo-jobs';
 const post=(path,key,body={},id='request-01')=>growthRoute(new Request(base+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Idempotency-Key':id},body:JSON.stringify(body)}),env);
 const make=id=>post(root,'fixture-readdy',{preset:'rain-and-rock'},id);
 assert.equal((await post(root,'invalid')).status,401);
 assert.equal((await post(root,'fixture-readdy',{preset:'invalid'})).status,422);
 const first=await(await make('request-00')).json();assert.equal((await(await make('request-00')).json()).id,first.id);
 assert.equal((await post('/api/operator/demo/claim','fixture-readdy')).status,401);
 const claim=await(await post('/api/operator/demo/claim','fixture-engine')).json();
 assert.equal(claim.id,first.id);assert.equal((await post('/api/operator/demo/claim','fixture-engine')).status,204);
 const finish=(lease)=>post('/api/operator/demo/finish','fixture-engine',{id:first.id,lease,state:'review'});
 assert.equal((await finish('wrong')).status,409);assert.equal((await finish(claim.lease)).status,204);
 for(let i=1;i<12;i++)await make('request-'+String(i).padStart(2,'0'));
 assert.equal((await make('request-12')).status,429);db.close();
});
test('match verified paid checkout to a prior browser event and deduplicate',async()=>{
 const {db,env}=await fixture(),ref='abcdefghijklmnop',browser=crypto.randomUUID(),id=crypto.randomUUID();
 const event={name:'checkout_started',source:'readdy',browser,id,ref};
 const send=()=>growthRoute(new Request('https://example.org/api/usage/events',{method:'POST',headers:{Origin:'https://sawwaudio.github.io','Content-Type':'application/json'},body:JSON.stringify(event)}),env);
 await send();await send();
 const checkout={id:'evt_1',created:Math.floor(Date.now()/1000),livemode:false,type:'checkout.session.completed',data:{object:{client_reference_id:ref,payment_status:'paid'}}};
 await billingFact(env,checkout,false);assert.equal(db.prepare('select count(*) n from billing_fact').get().n,0);
 await billingFact(env,checkout,true);await billingFact(env,checkout,true);
 assert.deepEqual({...db.prepare('select source,browser,live from attributed_checkout').get()},{source:'readdy',browser,live:0});
 assert.equal(db.prepare('select count(*) n from billing_fact').get().n,1);db.close();
});
