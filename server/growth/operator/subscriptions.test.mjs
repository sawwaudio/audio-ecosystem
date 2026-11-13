import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {capture,summary} from './subscriptions.mjs';
const db=()=>new DatabaseSync(':memory:');
const item=(id,customer,interval)=>({id,customer,livemode:true,status:'active',items:{has_more:false,data:[{quantity:1,price:{id:'price_pro',currency:'usd',unit_amount:interval==='year'?9999:999,recurring:{interval,interval_count:1,usage_type:'licensed'}}}]}});
const source=(...pages)=>async path=>path==='/v1/account'?{id:'acct_example'}:pages.shift();
const page=(data,has_more=false)=>({data,has_more});
test('paginate, deduplicate customers, normalize annual amount and compare a 30-day cohort',async()=>{
 const d=db(),a=item('sub_a','cus_a','month'),b=item('sub_b','cus_b','year'),prices=['price_pro'];
 await capture(d,prices,source(page([a],true),page([b])),'2026-10-11');
 await capture(d,prices,source(page([b,{...a,customer:'cus_b'}])),'2026-11-10');
 assert.deepEqual(summary(d,'2026-11-10'),{customers:1,grossMRR:'US$18.32',churn:'50.0%'});
});
test('incomplete pagination leaves previous snapshot intact',async()=>{
 const d=db(),prices=['price_pro'];await capture(d,prices,source(page([])),'2026-11-10');
 await assert.rejects(capture(d,prices,source(page([],true)),'2026-11-10'));
 assert.equal(summary(d,'2026-11-10').customers,0);assert.deepEqual(summary(d,'2026-11-11'),{});
});
