// Process one queued job in a local SQLite instance of the integration schema.
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {inspectDemo} from './audio-qa.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const [file,output]=process.argv.slice(2);
if(!file||!output)throw Error('Pass the queue database and private output directory');
const remote=file.startsWith('https://');
const db=remote?null:new DatabaseSync(file);
async function api(action,body){
 const response=await fetch(new URL('/api/operator/demo/'+action,file),{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+process.env.RENDER_SERVICE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)throw Error('Queue HTTP '+response.status);
 return response.status===204?null:response.json();
}
if(remote&&!process.env.RENDER_SERVICE_KEY)throw Error('RENDER_SERVICE_KEY required');
db?.exec('PRAGMA busy_timeout=5000');
const job=remote?await api('claim',{}):db.prepare("UPDATE demo_job SET state='rendering',updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM demo_job WHERE state='queued' AND preset='rain-and-rock' ORDER BY created_at,id LIMIT 1) RETURNING id,preset").get();
async function finish(state){
 if(remote)await api('finish',{id:job.id,lease:job.lease,state});
 else db.prepare("UPDATE demo_job SET state=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(state,job.id);
}
if(job){
 if(!/^[a-f0-9-]{36}$/.test(job.id)||job.preset!=='rain-and-rock')throw Error('Invalid render job');
 const dir=path.resolve(output,job.id,job.lease||'local');
 try{
  mkdirSync(dir,{recursive:true});
  execFileSync(process.execPath,[fileURLToPath(new URL('render.cjs',import.meta.url)),dir],{stdio:'inherit',timeout:120000});
  const input=path.join(dir,'capture.mp4');
  execFileSync(process.env.FFMPEG||'ffmpeg',['-v','error','-i',input,'-vn','-c:a','pcm_s24le','-ar','48000',path.join(dir,'demo.wav')]);
  const quality=inspectDemo(readFileSync(path.join(dir,'demo.wav')));
  writeFileSync(path.join(dir,'audio-qa.json'),JSON.stringify(quality,null,2));
 }catch(error){
  await finish('failed');
  throw error;
 }
 await finish('review');
}
