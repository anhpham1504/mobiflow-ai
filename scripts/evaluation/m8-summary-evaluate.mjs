import {parseApiEnvironment} from '@mobiflow/config';
import {PrismaService} from '../../apps/api/dist/database/prisma.service.js';
import {OllamaProvider} from '../../apps/api/dist/ai/ollama-provider.js';
import {normalizedFailure} from '../../apps/api/dist/ai/provider.js';
import {parseSummaryOutput} from '../../apps/api/dist/ai/operational-output.js';
import {resolutionSummaryPromptVersion,summaryFormat,summaryMessages} from '../../apps/api/dist/ai/prompts/copilot.js';
import {resolutionSummaryFacts,summaryEventLabels,validateSummaryFacts} from '../../apps/api/dist/ai/resolution-summary-facts.js';
import {saveEvidence} from '../verification/evidence.mjs';

const env=parseApiEnvironment(process.env),prisma=new PrismaService(env.DATABASE_URL),provider=new OllamaProvider(env);
try{
  const prior=await prisma.aiRun.findFirstOrThrow({where:{purpose:'RESOLUTION_SUMMARY',...(process.env.M8_SUMMARY_REQUEST_ID?{requestId:process.env.M8_SUMMARY_REQUEST_ID}:{status:'FAILED'})},orderBy:{createdAt:'desc'}});
  const resolution=await prisma.requestResolution.findUniqueOrThrow({where:{id:prior.resolutionId},include:{request:true}});
  const audits=await prisma.auditLog.findMany({where:{requestId:resolution.requestId,outcome:'SUCCEEDED',createdAt:{lte:resolution.resolvedAt},action:{in:Object.keys(summaryEventLabels)}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:50});
  const context=resolutionSummaryFacts(resolution,audits.reverse().map(event=>({eventId:event.id,action:event.action,actorType:event.actorType,at:event.createdAt.toISOString()}))),events=context.events;
  const allowed=new Set(events.map(event=>event.eventId));
  let repair,output,status='FAILED',errorCode=null,validationCategory=null,attempts=0,firstAttemptValid=false,referenceValid=false,ordered=false;const attemptOutcomes=[];
  const began=performance.now(),signal=AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS);
  for(let attempt=0;attempt<2;attempt++){
    attempts=attempt+1;
    const attemptStarted=performance.now(),outcome={ordinal:attempt+1,status:'FAILED'};attemptOutcomes.push(outcome);
    try{
      const generated=await provider.generateStructured(summaryMessages(context,[...allowed],repair),summaryFormat(context),signal);
      output=parseSummaryOutput(generated.raw);
      validateSummaryFacts(output,context,generated.raw);
      const indices=output.timeline.map(item=>events.findIndex(event=>event.eventId===item.eventId));
      referenceValid=indices.every(index=>index>=0);
      ordered=referenceValid&&indices.every((index,i)=>i===0||index>=indices[i-1]);
      if(!referenceValid||!ordered)throw new Error(referenceValid?'EVENT_ORDER':'EVENT_MEMBERSHIP');
      status='SUCCEEDED';outcome.status='SUCCEEDED';outcome.identity=generated.identity;firstAttemptValid=attempt===0;errorCode=null;validationCategory=null;break;
    }catch(error){
      const failure=normalizedFailure(error);errorCode=failure.code;validationCategory=failure.repairFeedback?.split(':')[0]??failure.code;
      outcome.errorCode=errorCode;outcome.validationCategory=validationCategory;
      if(!failure.retryable||attempt===1)break;
      repair={raw:failure.invalidOutput,feedback:failure.repairFeedback||failure.code};
    }finally{outcome.elapsedMs=Math.round(performance.now()-attemptStarted);}
  }
  const result={at:new Date().toISOString(),requestId:resolution.requestId,model:env.OLLAMA_MODEL,promptVersion:resolutionSummaryPromptVersion,schemaVersion:'resolution-summary.m8.v3',structuredOutput:'Ollama /api/chat format=bounded resolution-summary JSON Schema; stream=false; think=false',status,errorCode,validationCategory,attempts,firstAttemptValid,repairCount:attempts-1,schemaValid:status==='SUCCEEDED',referenceValid,chronological:ordered,factBound:status==='SUCCEEDED',latencyMs:Math.round(performance.now()-began),input:{eventCount:events.length},output:output?{timelineItems:output.timeline.length,executiveSummaryChars:output.executiveSummary.length}:null,limitations:'One synthetic resolution using the same provider, prompt, schema and factual validator as the worker. Attributed executive text and event labels are constrained generation, not unconstrained model summary accuracy. No raw prompt or model text retained.'};
  result.attemptOutcomes=attemptOutcomes;
  await saveEvidence((process.env.AI_EVAL_EVIDENCE_ROOT??'docs/verification/evidence')+'/M8_SUMMARY_EVAL.json',result);console.log(JSON.stringify(result));
  if(status!=='SUCCEEDED'||!referenceValid||!ordered)process.exitCode=1;
}finally{await prisma.$disconnect();}
