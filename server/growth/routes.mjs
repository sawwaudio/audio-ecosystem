import {demoJobs,renderQueue} from './readdy-jobs.mjs';
import catalog from './catalog.json' with {type:'json'};
const events=new Set(['app_open','audio_started','recording_imported','export_completed','reels_exported','checkout_started']);
const sources=new Set(['instagram','readdy','youtube','direct','other']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function growthRoute(req,env){
 const queue=await renderQueue(req,env);if(queue)return queue;
 const demo=await demoJobs(req,env);if(demo)return demo;
 const path=new URL(req.url).pathname;
 if(path.startsWith('/api/public/')){
  const key=path.slice('/api/public/'.length);
  if(!Object.hasOwn(catalog,key))return new Response(null,{status:404});
  if(req.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
  return Response.json(catalog[key],{headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'public,max-age=300'}});
 }
 if(path!=='/api/usage/events')return null;
 const origin=req.headers.get('Origin');
 if(origin!=='https://sawwaudio.github.io')return new Response(null,{status:403});
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type',Vary:'Origin'};
 const respond=status=>new Response(null,{status,headers});
 if(req.method==='OPTIONS')return respond(204);
 if(req.method!=='POST')return respond(405);
 if(!env.USAGE_DB)return respond(503);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return respond(415);
 if(Number(req.headers.get('content-length'))>512)return respond(413);
 const body=await req.text();if(body.length>512)return respond(413);
 let e;try{e=JSON.parse(body)}catch{return respond(400)}
 if(!e||!uuid.test(e.id)||!uuid.test(e.browser)||!events.has(e.name)||!sources.has(e.source))return respond(400);
 const insert=env.USAGE_DB.prepare('INSERT INTO usage_event(id,browser,name,source) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(e.id,e.browser,e.name,e.source);
 if(e.name==='checkout_started'&&/^[a-z0-9]{12,40}$/.test(e.ref||'')){
  const link=env.USAGE_DB.prepare('INSERT OR IGNORE INTO checkout_start(event_id,ref) SELECT id,? FROM usage_event WHERE id=? AND browser=? AND name=?').bind(e.ref,e.id,e.browser,e.name);
  await env.USAGE_DB.batch([insert,link]);
 }else await insert.run();
 return respond(204);
}
