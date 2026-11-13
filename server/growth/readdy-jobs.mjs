// Service-only API. The request contains a preset, never a URL or render command.
const root='/api/integrations/readdy/demo-jobs';
export async function demoJobs(req,env){
 const path=new URL(req.url).pathname;
 if(path!==root&&!path.startsWith(root+'/'))return null;
 if(!env.READDY_DEMO_KEY||!env.USAGE_DB)return new Response(null,{status:503});
 if(req.headers.get('Authorization')!=='Bearer '+env.READDY_DEMO_KEY)return new Response(null,{status:401});
 const db=env.USAGE_DB;
 if(path===root&&req.method==='POST'){
  const key=req.headers.get('Idempotency-Key');
  if(!/^[a-zA-Z0-9_-]{8,64}$/.test(key||''))return new Response(null,{status:400});
  let body;try{body=await req.json()}catch{return new Response(null,{status:400})}
  if(body?.preset!=='rain-and-rock')return new Response(null,{status:422});
  const id=crypto.randomUUID();
  await db.prepare(`INSERT OR IGNORE INTO demo_job(id,request_key,preset)
   SELECT ?,?,? WHERE (SELECT count(*) FROM demo_job WHERE created_at>=datetime('now','-1 day'))<12`).bind(id,key,body.preset).run();
  const row=await db.prepare('SELECT id,state FROM demo_job WHERE request_key=?').bind(key).first();
  return row?Response.json(row,{status:202}):new Response(null,{status:429});
 }
 if(req.method==='GET'&&/^[-0-9a-f]{36}$/.test(path.slice(root.length+1))){
  const row=await db.prepare('SELECT id,preset,state,created_at,updated_at FROM demo_job WHERE id=?').bind(path.slice(root.length+1)).first();
  return row?Response.json(row):new Response(null,{status:404});
 }
 return new Response(null,{status:405});
}

export async function renderQueue(req,env){
 const path=new URL(req.url).pathname;
 if(!['/api/operator/demo/claim','/api/operator/demo/finish'].includes(path))return null;
 if(!env.RENDER_SERVICE_KEY||!env.USAGE_DB)return new Response(null,{status:503});
 if(req.headers.get('Authorization')!=='Bearer '+env.RENDER_SERVICE_KEY)return new Response(null,{status:401});
 if(req.method!=='POST')return new Response(null,{status:405});
 if(path.endsWith('/claim')){
  const lease=crypto.randomUUID();
  const row=await env.USAGE_DB.prepare(`UPDATE demo_job SET state='rendering',updated_at=CURRENT_TIMESTAMP,lease=?
   WHERE id=(SELECT id FROM demo_job WHERE state='queued' OR
   (state='rendering' AND updated_at<datetime('now','-15 minutes')) ORDER BY created_at,id LIMIT 1)
   RETURNING id,preset,lease`).bind(lease).first();
  return row?Response.json(row):new Response(null,{status:204});
 }
 let result;try{result=await req.json()}catch{return new Response(null,{status:400})}
 if(!result||!['review','failed'].includes(result.state)||typeof result.lease!=='string')return new Response(null,{status:400});
 const done=await env.USAGE_DB.prepare("UPDATE demo_job SET state=?,lease=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease=? AND state='rendering' RETURNING id").bind(result.state,result.id,result.lease).first();
 return new Response(null,{status:done?204:409});
}
