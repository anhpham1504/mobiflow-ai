import { z } from 'zod';
import type { ApiEnvironment } from '@mobiflow/config';
import { AiFailure, type AiProvider } from './provider.js';
import { analysisMessages,outputFormat,type AnalysisInput } from './prompts/request-analysis.js';

export async function boundedJson(response:Response,maxBytes:number):Promise<unknown>{
  if(!response.body)throw new AiFailure('AI_INVALID_OUTPUT',true);
  const reader=response.body.getReader();const parts:Uint8Array[]=[];let size=0;
  try {while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>maxBytes)throw new AiFailure('AI_OUTPUT_TOO_LARGE');parts.push(chunk.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new AiFailure('AI_INVALID_OUTPUT',true);}
}
const tags=z.object({models:z.array(z.object({name:z.string(),digest:z.string().min(1)})).max(1000)});
const chat=z.object({model:z.string(),done:z.literal(true),done_reason:z.string().optional(),message:z.object({content:z.string()})});
export class OllamaProvider implements AiProvider {
  constructor(private readonly env:ApiEnvironment){}
  async generate(input:AnalysisInput,signal:AbortSignal,repair:boolean|string=false){
    const deadline=AbortSignal.timeout(this.env.AI_ATTEMPT_TIMEOUT_MS),combined=AbortSignal.any([signal,deadline]);
    try{
      const messages=analysisMessages(input,repair);
      const inventory=await fetch(new URL('/api/tags',this.env.OLLAMA_BASE_URL),{signal:combined,redirect:'error'});
      if(!inventory.ok)throw new AiFailure('AI_PROVIDER_UNAVAILABLE',true);
      const installed=tags.parse(await boundedJson(inventory,1048576)).models.find(m=>m.name===this.env.OLLAMA_MODEL);
      if(!installed)throw new AiFailure('AI_MODEL_UNAVAILABLE');
      const response=await fetch(new URL('/api/chat',this.env.OLLAMA_BASE_URL),{method:'POST',signal:combined,redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:this.env.OLLAMA_MODEL,messages,format:outputFormat,stream:false,think:false,options:{temperature:this.env.AI_TEMPERATURE,num_predict:this.env.AI_MAX_OUTPUT_TOKENS,seed:42,num_ctx:16384}})});
      if(response.status===404)throw new AiFailure('AI_MODEL_UNAVAILABLE');
      if(!response.ok)throw new AiFailure('AI_PROVIDER_UNAVAILABLE',response.status>=500||response.status===429);
      // Bound the transport envelope too; reasoning fields never leave this adapter.
      const result=chat.safeParse(await boundedJson(response,65536));
      if(!result.success||result.data.model!==installed.name||result.data.done_reason==='length')throw new AiFailure('AI_INVALID_OUTPUT',true);
      const raw=result.data.message.content,outputSize=Buffer.byteLength(raw,'utf8');
      if(outputSize>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
      return {raw,outputSize,identity:{provider:'ollama',model:installed.name,digest:installed.digest}};
    }catch(error){
      if(signal.aborted)throw new AiFailure('AI_CANCELED');
      if(deadline.aborted)throw new AiFailure('AI_TIMEOUT',true);
      if(error instanceof AiFailure)throw error;
      if(error instanceof Error&&error.message==='CONTEXT_TOO_LARGE')throw new AiFailure('CONTEXT_TOO_LARGE');
      throw new AiFailure('AI_PROVIDER_UNAVAILABLE',true);
    }
  }
}
