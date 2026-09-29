import {parseApiEnvironment} from '@mobiflow/config';
import {PrismaService} from '../../apps/api/dist/database/prisma.service.js';
import {OllamaProvider} from '../../apps/api/dist/ai/ollama-provider.js';
import {normalizedFailure} from '../../apps/api/dist/ai/provider.js';
import {parseSummaryOutput} from '../../apps/api/dist/ai/operational-output.js';
import {resolutionSummaryPromptVersion,summaryFormat,summaryMessages} from '../../apps/api/dist/ai/prompts/copilot.js';
import {saveEvidence} from '../verification/evidence.mjs';

const env=parseApiEnvironment(process.env),prisma=new PrismaService(env.DATABASE_URL),provider=new OllamaProvider(env);
try{
  const prior=await prisma.aiRun.findFirstOrThrow({where:{purpose:'RESOLUTION_SUMMARY',status:'FAILED'},orderBy:{createdAt:'desc'}});
  const resolution=await prisma.requestResolution.findUniqueOrThrow({where:{id:prior.resolutionId},include:{request:{include:{latestAnalysis:true,assignments:{orderBy:{assignedAt:'asc'}},checklist:{include:{items:{orderBy:{ordinal:'asc'}}}},audits:{where:{outcome:'SUCCEEDED'},orderBy:{createdAt:'asc'},take:50}}}}});
  const events=resolution.request.audits.filter(event=>event.createdAt<=resolution.resolvedAt).map(event=>({eventId:event.id,action:event.action,at:event.createdAt.toISOString()}));
  const allowed=new Set(events.map(event=>event.eventId));
  const context={request:{createdAt:resolution.request.createdAt,title:resolution.request.title,description:resolution.request.description,category:resolution.request.category,priority:resolution.request.priority},analysis:resolution.request.latestAnalysis?{reasonSummary:resolution.request.latestAnalysis.reasonSummary}:null,assignments:resolution.request.assignments.map(item=>({staffId:item.staffId,assignedAt:item.assignedAt,endedAt:item.endedAt})),checklist:resolution.request.checklist?.items.map(item=>({text:item.text,completedAt:item.completedAt,waivedAt:item.waivedAt})),resolution:{id:resolution.id,cycle:resolution.cycle,rootCause:resolution.rootCause,resolution:resolution.resolution,verification:resolution.verification,resolvedAt:resolution.resolvedAt},events};
  let repair,output,status='FAILED',errorCode=null,validationCategory=null,attempts=0,firstAttemptValid=false,referenceValid=false,ordered=false;
  const began=performance.now();
  for(let attempt=0;attempt<2;attempt++){
    attempts=attempt+1;
    try{
      const generated=await provider.generateStructured(summaryMessages(context,[...allowed],repair),summaryFormat(),AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS));
      output=parseSummaryOutput(generated.raw);
      const indices=output.timeline.map(item=>events.findIndex(event=>event.eventId===item.eventId));
      referenceValid=indices.every(index=>index>=0);
      ordered=referenceValid&&indices.every((index,i)=>i===0||index>=indices[i-1]);
      if(!referenceValid||!ordered)throw new Error(referenceValid?'EVENT_ORDER':'EVENT_MEMBERSHIP');
      status='SUCCEEDED';firstAttemptValid=attempt===0;errorCode=null;validationCategory=null;break;
    }catch(error){
      const failure=normalizedFailure(error);errorCode=failure.code;validationCategory=failure.repairFeedback?.split(':')[0]??failure.code;
      if(!failure.retryable||attempt===1)break;
      repair={raw:failure.invalidOutput,feedback:failure.repairFeedback||failure.code};
    }
  }
  const result={at:new Date().toISOString(),model:env.OLLAMA_MODEL,promptVersion:resolutionSummaryPromptVersion,schemaVersion:'resolution-summary.m8.v3',structuredOutput:'Ollama /api/chat format=bounded resolution-summary JSON Schema; stream=false; think=false',status,errorCode,validationCategory,attempts,firstAttemptValid,repairCount:attempts-1,schemaValid:status==='SUCCEEDED',referenceValid,chronological:ordered,latencyMs:Math.round(performance.now()-began),input:{eventCount:events.length,checklistItemCount:context.checklist?.length??0},output:output?{timelineItems:output.timeline.length,executiveSummaryChars:output.executiveSummary.length}:null,limitations:'One synthetic browser-created resolution using the same provider, prompt, schema and bounded context as the production worker. No raw prompt or model text retained.'};
  await saveEvidence('docs/verification/evidence/M8_SUMMARY_EVAL.json',result);console.log(JSON.stringify(result));
  if(status!=='SUCCEEDED'||!referenceValid||!ordered)process.exitCode=1;
}finally{await prisma.$disconnect();}
