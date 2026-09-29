import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
/* global FormData, Blob */
import {createHash} from 'node:crypto';
import {login,call,command,waitDocument,base} from '../verification/m5-client.mjs';
const manifest=JSON.parse(await readFile('datasets/knowledge/manifest.json','utf8')),token=await login(),results=[];
for(const item of manifest){
  const bytes=await readFile('datasets/knowledge/'+item.file),sha256=createHash('sha256').update(bytes).digest('hex');
  let document;let cursor='';
  do{const r=await call(token,'/knowledge/documents?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));if(r.status!==200)throw Error('List failed');document=r.result.data.find(d=>d.sha256===sha256);cursor=r.result.page.nextCursor;}while(!document&&cursor);
  if(!document){const form=new FormData();form.set('title',item.title);form.set('file',new Blob([bytes],{type:item.file.endsWith('.pdf')?'application/pdf':'text/plain'}),item.file);let r=await call(token,'/knowledge/documents',form);if(r.status===429){await delay(Math.min(60000,(r.retryAfter+1)*1000));r=await call(token,'/knowledge/documents',form);}if(r.status!==202)throw Error('Upload failed '+JSON.stringify(r.result));document=r.result.data;}
  if(document.status==='DISABLED'||document.status==='FAILED'){let r=await call(token,'/knowledge/documents/'+document.id+'/reindex',{expectedVersion:document.version});if(r.status===429){await delay(Math.min(60000,(r.retryAfter+1)*1000));r=await call(token,'/knowledge/documents/'+document.id+'/reindex',{expectedVersion:document.version});}if(r.status!==202)throw Error('Reindex failed');}
  document=await waitDocument(token,document.id);if(document.status!=='READY')throw Error('Document '+item.code+' '+document.status+' '+document.errorCode);
  results.push({...item,documentId:document.id,sha256,generation:document.activeGeneration,chunks:document.chunkCount,pages:document.pageCount,index:document.index});console.log(JSON.stringify(results.at(-1)));
}
await mkdir('artifacts/m5',{recursive:true});await writeFile('artifacts/m5/corpus.json',JSON.stringify({at:new Date().toISOString(),base,documents:results},null,2)+'\n');
await command(token,'/knowledge/documents/'+results[0].documentId);
