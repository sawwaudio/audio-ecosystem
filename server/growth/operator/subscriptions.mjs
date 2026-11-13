// Operator-only snapshot. Restrict the key to read access for account and subscriptions.
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
const digest=value=>createHash('sha256').update(value).digest('hex');
export async function capture(db,prices,read,day=new Date().toISOString().slice(0,10)){
 if(!prices.length||prices.some(p=>!/^price_[A-Za-z0-9]+$/.test(p)))throw Error('Explicit Pro Price IDs required');
 const account=await read('/v1/account');
 if(!/^acct_[A-Za-z0-9]+$/.test(account.id))throw Error('Unknown Stripe account');
 const customers=new Set(),seen=new Set();let cursor='',monthly=0,known=true;
 do{
  const query=new URLSearchParams({status:'active',limit:'100'});
  if(cursor)query.set('starting_after',cursor);
  const page=await read('/v1/subscriptions?'+query);
  if(!Array.isArray(page.data)||typeof page.has_more!=='boolean')throw Error('Incomplete subscription page');
  for(const sub of page.data){
   if(sub.livemode!==true||sub.status!=='active'||!sub.id||seen.has(sub.id)||!Array.isArray(sub.items?.data)||sub.items.has_more!==false)throw Error('Incomplete or inconsistent subscription');
   seen.add(sub.id);
   const lines=sub.items.data.filter(i=>prices.includes(i.price?.id));
   if(!lines.length)continue;
   if(typeof sub.customer!=='string')throw Error('Missing customer');
   customers.add(digest(account.id+'|'+sub.customer));
   for(const {price,quantity} of lines){
    const {interval,interval_count,usage_type}=price.recurring||{};
    if(price.currency!=='usd'||usage_type!=='licensed'||!Number.isSafeInteger(price.unit_amount)||!Number.isSafeInteger(quantity)||!Number.isSafeInteger(interval_count)||interval_count<1||!['month','year'].includes(interval)){known=false;continue}
    monthly+=price.unit_amount*quantity/(interval_count*(interval==='year'?12:1));
   }
  }
  if(page.has_more&&!page.data.length)throw Error('Empty intermediate page');
  cursor=page.has_more?page.data.at(-1).id:'';
 }while(cursor);
 const scope=digest(account.id+'|'+[...new Set(prices)].sort().join(','));
 db.exec('CREATE TABLE IF NOT EXISTS subscription_snapshot(day TEXT, scope TEXT, customers TEXT NOT NULL, gross_monthly_cents INTEGER, PRIMARY KEY(day,scope))');
 db.prepare('INSERT OR REPLACE INTO subscription_snapshot VALUES(?,?,?,?)').run(day,scope,JSON.stringify([...customers].sort()),known?Math.round(monthly):null);
 return {day,activeCustomers:customers.size,grossMonthlyCents:known?Math.round(monthly):null};
}
export function summary(db,day=new Date().toISOString().slice(0,10)){
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='subscription_snapshot'").get())return {};
 const rows=db.prepare('SELECT * FROM subscription_snapshot WHERE day=?').all(day);
 if(rows.length!==1)return {};
 const row=rows[0],active=new Set(JSON.parse(row.customers));
 const prior=db.prepare("SELECT customers FROM subscription_snapshot WHERE scope=? AND day=date(?,'-30 days')").get(row.scope,day);
 const base=prior?JSON.parse(prior.customers):[];
 return {customers:active.size,grossMRR:row.gross_monthly_cents==null?null:'US$'+(row.gross_monthly_cents/100).toFixed(2),churn:base.length?(100*base.filter(id=>!active.has(id)).length/base.length).toFixed(1)+'%':null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const key=process.env.STRIPE_REPORT_KEY;
 if(!key?.startsWith('rk_live_')||!process.argv[2])throw Error('Pass the private database and a restricted live reporting key');
 const read=async path=>{
  const r=await fetch(new URL(path,'https://api.stripe.com'),{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('Stripe read HTTP '+r.status);
  return r.json();
 };
 const db=new DatabaseSync(process.argv[2]);
 try{console.log(await capture(db,(process.env.PRICE_IDS||'').split(',').filter(Boolean),read))}finally{db.close()}
}
