// Prepare a reviewable content snapshot. The Readdy publisher consumes approved snapshots.
import {readFile,writeFile,rename,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export async function sync(base,dir,request=fetch){
 const data={};
 for(const key of ['features','sounds','presets','media','releases','pricing']){
  const response=await request(new URL('/api/public/'+key,base));
  if(!response.ok)throw Error(key+' HTTP '+response.status);
  const value=await response.json();if(!Array.isArray(value))throw Error('Invalid '+key);
  data[key]=value;
 }
 const body=JSON.stringify(data,null,2)+'\n',digest=createHash('sha256').update(body).digest('hex');
 await mkdir(dir,{recursive:true});
 const target=path.join(dir,'readdy-review.json');
 let previous;
 try{previous=await readFile(target,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
 if(previous===body)return {changed:false,digest};
 const tmp=await mkdtemp(path.join(dir,'.sync-'));
 try{await writeFile(path.join(tmp,'data'),body);await rename(path.join(tmp,'data'),target)}
 finally{await rm(tmp,{recursive:true,force:true})}
 return {changed:true,digest};
}
if(process.argv[1]&&import.meta.url===(await import('node:url')).pathToFileURL(process.argv[1]).href){
 console.log(await sync(process.argv[2],process.argv[3]));
}
