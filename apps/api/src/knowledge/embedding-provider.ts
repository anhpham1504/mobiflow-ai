import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import type {ApiEnvironment} from '@mobiflow/config';
import {boundedJson} from '../ai/ollama-provider.js';

export class KnowledgeFailure extends Error {
  constructor(readonly code:string,readonly retryable=false){super(code);}
}
export interface EmbeddingIdentity {provider:string;model:string;digest:string;dimension:number;revision:string;key:string}
export interface EmbeddingBatch {identity:EmbeddingIdentity;vectors:number[][];latencyMs:number}
export interface EmbeddingProvider {
  probe(signal:AbortSignal):Promise<EmbeddingBatch>;
  embedDocuments(texts:string[],signal:AbortSignal,expected?:EmbeddingIdentity):Promise<EmbeddingBatch>;
  embedQuery(text:string,signal:AbortSignal):Promise<EmbeddingBatch>;
}
export const EMBEDDING_PROVIDER=Symbol('EMBEDDING_PROVIDER');
export const KNOWLEDGE_WORKER_ENABLED=Symbol('KNOWLEDGE_WORKER_ENABLED');
export function validateVector(value:unknown,dimension?:number):number[] {
  if(!Array.isArray(value)||!value.length||value.length>2000||value.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e10)||!value.some(v=>v!==0))throw new KnowledgeFailure('INVALID_EMBEDDING');
  if(dimension!==undefined&&value.length!==dimension)throw new KnowledgeFailure('EMBEDDING_DIMENSION_MISMATCH');
  return value as number[];
}
export function identityKey(identity:Omit<EmbeddingIdentity,'key'>){return createHash('sha256').update(JSON.stringify(identity)).digest('hex');}
const inventorySchema=z.object({models:z.array(z.object({name:z.string(),digest:z.string().min(1)})).max(1000)});
const embeddingSchema=z.object({model:z.string(),embeddings:z.array(z.array(z.number())).min(1).max(16)});
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly env:ApiEnvironment){}
  probe(signal:AbortSignal){return this.embedDocuments(['Văn bản kiểm thử embedding tiếng Việt.'],signal);}
  embedQuery(text:string,signal:AbortSignal){return this.embedDocuments([text],signal);}
  async embedDocuments(texts:string[],signal:AbortSignal,expected?:EmbeddingIdentity):Promise<EmbeddingBatch>{
    if(!texts.length||texts.length>this.env.EMBEDDING_BATCH_SIZE||texts.some(t=>!t.trim()||Array.from(t).length>2000))throw new KnowledgeFailure('INVALID_EMBEDDING_INPUT');
    const started=performance.now();
    for(let attempt=0;attempt<2;attempt++){
      const timeout=AbortSignal.timeout(this.env.EMBEDDING_TIMEOUT_MS),combined=AbortSignal.any([signal,timeout]);
      try {
        const json=async(path:string,body?:object)=>{
          const response=await fetch(new URL(path,this.env.EMBEDDING_BASE_URL??this.env.OLLAMA_BASE_URL),{signal:combined,redirect:'error',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
          if(response.status===404)throw new KnowledgeFailure('EMBEDDING_MODEL_UNAVAILABLE');
          if(!response.ok)throw new KnowledgeFailure('EMBEDDING_UNAVAILABLE',response.status>=500||response.status===429);
          return boundedJson(response,2*1024*1024);
        };
        const inventory=()=>json('/api/tags').then(v=>inventorySchema.parse(v).models.find(m=>m.name===this.env.OLLAMA_EMBEDDING_MODEL));
        const model=await inventory();
        if(!model)throw new KnowledgeFailure('EMBEDDING_MODEL_UNAVAILABLE');
        const output=embeddingSchema.safeParse(await json('/api/embed',{model:model.name,input:texts,truncate:false,keep_alive:'5m'}));
        if(!output.success||output.data.model!==model.name||output.data.embeddings.length!==texts.length)throw new KnowledgeFailure('INVALID_EMBEDDING');
        const dimension=validateVector(output.data.embeddings[0],this.env.EMBEDDING_DIMENSION).length;
        const vectors=output.data.embeddings.map(v=>validateVector(v,dimension));
        const base={provider:'ollama',model:model.name,digest:model.digest,dimension,revision:this.env.EMBEDDING_INDEX_REVISION};
        const identity={...base,key:identityKey(base)};
        if((await inventory())?.digest!==model.digest||(expected&&expected.key!==identity.key))throw new KnowledgeFailure('INDEX_MODEL_MISMATCH');
        return {identity,vectors,latencyMs:Math.round(performance.now()-started)};
      } catch(error){
        if(signal.aborted)throw new KnowledgeFailure('KNOWLEDGE_CANCELED');
        const failure=timeout.aborted?new KnowledgeFailure('EMBEDDING_TIMEOUT',true):error instanceof KnowledgeFailure?error:new KnowledgeFailure('EMBEDDING_UNAVAILABLE',true);
        if(!failure.retryable||attempt===1)throw failure;
        try{await delay(1000,undefined,{signal});}catch{throw new KnowledgeFailure('KNOWLEDGE_CANCELED');}
      }
    }
    throw new KnowledgeFailure('EMBEDDING_UNAVAILABLE');
  }
}
