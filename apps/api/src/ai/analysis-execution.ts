import {setTimeout as delay} from 'node:timers/promises';
import {AiFailure,normalizedFailure,parseAnalysis,type AiProvider} from './provider.js';
import type {AnalysisInput} from './prompts/request-analysis.js';
import {parseRagOutput} from '../knowledge/rag-output.js';
export async function executeAnalysis(provider:AiProvider,input:AnalysisInput,signal:AbortSignal,onAttempt:(attempt:number)=>Promise<void>=async()=>{},maxAttempts=2){
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>2)throw new AiFailure('AI_INVALID_ATTEMPT_LIMIT');
  const started=performance.now();let firstAttemptValid=false,feedback='';
  for(let attempt=0;attempt<maxAttempts;attempt++){
    if(signal.aborted)throw new AiFailure('AI_CANCELED');
    await onAttempt(attempt);
    try{
      const generation=await provider.generate(input,signal,attempt>0?feedback||true:false);
      const parsed=input.retrieval?parseRagOutput(generation.raw,input.retrieval,[input.title,input.description,...input.messages.map(message=>message.body)].join('\n')):{analysis:parseAnalysis(generation.raw)};firstAttemptValid=attempt===0;
      return {...parsed,identity:generation.identity,outputSize:generation.outputSize,retryCount:attempt,latencyMs:Math.round(performance.now()-started),firstAttemptValid};
    }catch(error){
      const failure=normalizedFailure(error,signal);
      feedback=failure.repairFeedback;
      if(!failure.retryable||attempt===maxAttempts-1||signal.aborted)throw failure;
      try{await delay(1000,undefined,{signal});}catch{throw new AiFailure('AI_CANCELED');}
    }
  }
  throw new AiFailure('AI_ANALYSIS_FAILED');
}
