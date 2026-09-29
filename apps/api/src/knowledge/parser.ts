import {Worker} from 'node:worker_threads';
import {KnowledgeFailure} from './embedding-provider.js';
import {normalize,type PageText} from './chunker.js';
export const MAX_FILE_BYTES=10*1024*1024;
export interface UploadFile {originalname:string;mimetype:string;buffer:Buffer;size:number}
const forbiddenFileNameChar=(character:string)=>{const code=character.codePointAt(0)!;return code<=31||code===127||'/\\:'.includes(character);};
const forbiddenTextChar=(character:string)=>{const code=character.codePointAt(0)!;return code<=31&&code!==9&&code!==10&&code!==13;};
export function validateUpload(file:UploadFile|undefined){
  if(!file)throw new KnowledgeFailure('FILE_REQUIRED');
  if(!file.buffer.length)throw new KnowledgeFailure('EMPTY_DOCUMENT');
  if(file.buffer.length>MAX_FILE_BYTES)throw new KnowledgeFailure('FILE_TOO_LARGE');
  const name=file.originalname.normalize('NFC').trim();
  if(!name||name.length>255||Array.from(name).some(forbiddenFileNameChar)||name==='.'||name.includes('..'))throw new KnowledgeFailure('INVALID_FILENAME');
  const pdf=name.toLowerCase().endsWith('.pdf'),txt=name.toLowerCase().endsWith('.txt');
  if((pdf&&file.mimetype!=='application/pdf')||(txt&&file.mimetype!=='text/plain')||(!pdf&&!txt))throw new KnowledgeFailure('UNSUPPORTED_DOCUMENT');
  const hasPdf=file.buffer.subarray(0,5).toString('ascii')==='%PDF-';
  if(pdf&&!hasPdf||txt&&hasPdf)throw new KnowledgeFailure('INVALID_SIGNATURE');
  if(txt)parseText(file.buffer);
  return {name,mimeType:pdf?'application/pdf':'text/plain'};
}
export function parseText(bytes:Uint8Array):PageText[]{
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new KnowledgeFailure('INVALID_UTF8');}
  if(Array.from(text).some(forbiddenTextChar))throw new KnowledgeFailure('INVALID_TEXT');
  text=normalize(text);
  if(!text)throw new KnowledgeFailure('EMPTY_DOCUMENT');
  if(Array.from(text).length>2000000)throw new KnowledgeFailure('EXTRACTED_TEXT_TOO_LARGE');
  return [{pageNumber:null,text}];
}
export function extract(bytes:Uint8Array,mimeType:string,signal:AbortSignal):Promise<PageText[]>{
  if(signal.aborted)return Promise.reject(new KnowledgeFailure('KNOWLEDGE_CANCELED'));
  if(mimeType==='text/plain')return Promise.resolve(parseText(bytes));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./pdf-worker.js',import.meta.url),{workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:192,maxYoungGenerationSizeMb:32},stdout:true,stderr:true});
    // Parser diagnostics can contain source content; deliberately do not forward them.
    worker.stdout.resume();worker.stderr.resume();
    let settled=false;
    const finish=(pages?:PageText[],code?:string)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);void worker.terminate();if(pages)resolve(pages);else reject(new KnowledgeFailure(code??'INVALID_PDF'));};
    const abort=()=>finish(undefined,'KNOWLEDGE_CANCELED'),timer=setTimeout(()=>finish(undefined,'PDF_TIMEOUT'),30000);
    signal.addEventListener('abort',abort,{once:true});
    worker.once('message',(result:{pages?:PageText[];code?:string})=>finish(result.pages,result.code));
    worker.once('error',()=>finish());worker.once('exit',()=>finish());
  });
}
