import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,basename,join} from 'node:path';
import {createHash} from 'node:crypto';
// Generated reports may replace the latest pointer only after retaining old bytes.
export async function saveEvidence(path,value){
  await mkdir(dirname(path),{recursive:true});
  let previous;
  try{previous=await readFile(path);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous){const history=join(dirname(path),'iterations');await mkdir(history,{recursive:true});await writeFile(join(history,basename(path).replace(/\.json$/, '')+'-'+createHash('sha256').update(previous).digest('hex').slice(0,12)+'.json'),previous);}
  await writeFile(path,JSON.stringify(value,null,2)+'\n');
}
