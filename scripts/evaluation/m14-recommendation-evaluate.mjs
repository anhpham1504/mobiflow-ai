import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import os from 'node:os';
import {parseApiEnvironment} from '@mobiflow/config';
import {recommendationSchema,recommendationV2Schema,recommendationResponseSchema} from '@mobiflow/contracts';
import {OllamaProvider} from '../../apps/api/dist/ai/ollama-provider.js';
import {AiFailure} from '../../apps/api/dist/ai/provider.js';
import {recommendationMessages,recommendationMessagesV2,recommendationFormat,recommendationFormatV2,recommendationPromptVersion,recommendationPromptV2Version} from '../../apps/api/dist/ai/prompts/recommendation.js';
import {parseRecommendation,parseRecommendationV2ForGeneration} from '../../apps/api/dist/ai/recommendation-output.js';
import {decideRecommendationEvidence} from '../../apps/api/dist/ai/recommendation-evidence-decision.js';
import {recommendationSnapshot} from '../../apps/api/dist/ai/recommendation-snapshot.js';
import {createRecommendationHarness,businessSnapshot,syntheticAnalysis} from '../../apps/api/test/helpers/recommendation-v2-fixture.mjs';
import {withM14Database} from '../verification/m14-database.mjs';
import {saveEvidence} from '../verification/evidence.mjs';
import {m14Dataset} from './m14-cases.mjs';

const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const env=parseApiEnvironment(process.env),provider=new OllamaProvider(env),results=[];
const datasetHash=hash(m14Dataset),startedAt=new Date().toISOString(),evaluationId=startedAt.replace(/[:.]/g,'-')+'-'+randomUUID();
const evaluationPath='docs/v1.2/evidence/runs/M14_RECOMMENDATION_EVAL-'+evaluationId+'.json';
const attemptRoot='docs/v1.2/evidence/attempts/'+evaluationId;
const source='# SOP tổng hợp M14\nKhi thiết bị IoT mất kết nối, kiểm tra trạng thái SIM và cấu hình APN, ghi lại kết quả kiểm tra. Chỉ nhân viên được phân công mới thực hiện sau khi quản lý duyệt phương án. Nếu chưa rõ địa điểm hoặc thời điểm bắt đầu, hỏi bổ sung trước khi đánh giá phạm vi sự cố.';
let inventory,ollamaVersion,actualModel,actualEmbeddingModel;
try{
  const response=await fetch(new URL('/api/tags',env.OLLAMA_BASE_URL),{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw new Error('Ollama inventory unavailable');inventory=await response.json();actualModel=inventory.models?.find(model=>model.name===env.OLLAMA_MODEL);if(!actualModel?.digest)throw new Error('Configured Ollama model is absent');
  actualEmbeddingModel=inventory.models?.find(model=>model.name===env.OLLAMA_EMBEDDING_MODEL);if(!actualEmbeddingModel?.digest)throw new Error('Configured Ollama embedding model is absent');
  const version=await fetch(new URL('/api/version',env.OLLAMA_BASE_URL),{signal:AbortSignal.timeout(10000),redirect:'error'});if(!version.ok)throw new Error('Ollama version unavailable');ollamaVersion=(await version.json()).version;
}catch(error){const report={evaluationId,startedAt,checkedAt:new Date().toISOString(),result:'NOT_RUN',datasetVersion:m14Dataset.version,datasetHash,configuredModel:env.OLLAMA_MODEL,configuredEmbeddingModel:env.OLLAMA_EMBEDDING_MODEL,error:error.message,results:[],limitations:'Actual Ollama unavailable. No fixture result is substituted.'};await saveEvidence(evaluationPath,report);await saveEvidence('docs/v1.2/evidence/M14_RECOMMENDATION_EVAL.json',report);throw error;}
const metadata={evaluationId,startedAt,datasetVersion:m14Dataset.version,datasetHash,orderedCaseIds:m14Dataset.cases.map(c=>c.id),orderWithinCase:['recommendation.v1','recommendation.v2'],synthetic:true,procedureCorpus:{sourceHash:hash(source),policy:'One unchanged synthetic SOP document; each harness disables the corpus and knowledge cases reactivate/reindex it through DocumentService and real ingestion.'},provider:'ollama',model:{name:actualModel.name,digest:actualModel.digest},embeddingModel:{name:actualEmbeddingModel.name,digest:actualEmbeddingModel.digest},ollamaVersion,prompts:{v1:recommendationPromptVersion,v2:recommendationPromptV2Version,sourceHash:hash(await readFile('apps/api/src/ai/prompts/recommendation.ts','utf8'))},schemaSourceHash:hash(await readFile('packages/contracts/src/recommendation.ts','utf8')),environment:{node:process.version,platform:process.platform,arch:process.arch,cpus:os.cpus().length,totalMemoryBytes:os.totalmem(),temperature:env.AI_TEMPERATURE,outputTokenBound:env.AI_MAX_OUTPUT_TOKENS,attemptTimeoutMs:env.AI_ATTEMPT_TIMEOUT_MS,runTimeoutMs:env.AI_RUN_TIMEOUT_MS,attemptBound:2,retryDelayMs:1000,seed:42,contextTokens:16384},analysisPolicy:'Hand-authored validated synthetic analysis; no live analysis-accuracy claim. Actual Ollama embeddings and real PostgreSQL tools supply each frozen retrieval context.'};
async function persist(status){const report={...metadata,checkedAt:new Date().toISOString(),result:status,results,metrics:metrics(),limitations:'Six ordered synthetic/development cases with one configured local model and one run per version per case. Context IDs/timestamps are run-specific and hashed; each frozen synthetic snapshot is retained. V1 lacks dedicated next-step/missing-question fields; comparison reports this contract difference. Parser membership establishes grounding/reference safety, not semantic correctness or production accuracy. Attempt files retain the provider structured-content field only, including failed/truncated synthetic output; no hidden reasoning field or private prompt is captured. Semantic actionability has not been human-scored. No composite quality/confidence/production effectiveness claim.'};await saveEvidence(evaluationPath,report);await saveEvidence('docs/v1.2/evidence/M14_RECOMMENDATION_EVAL.json',report);}
function metrics(){return Object.fromEntries(['recommendation.v1','recommendation.v2'].map(version=>{
  const rows=results.flatMap(r=>r.versions??[]).filter(r=>r.schemaVersion===version),times=rows.map(r=>r.modelTotalMs).filter(Number.isFinite).sort((a,b)=>a-b);
  return [version,{cases:rows.length,succeeded:rows.filter(r=>r.status==='SUCCEEDED').length,failed:rows.filter(r=>r.status==='FAILED').length,schemaValid:rows.filter(r=>r.schemaValid).length,referenceValid:rows.filter(r=>r.referenceValid).length,actionVocabularyValid:version==='recommendation.v2'?rows.filter(r=>r.actionVocabularyValid).length:null,expectedMainStep:version==='recommendation.v2'?rows.filter(r=>r.expectedMainStep).length:null,missingFieldCoverage:version==='recommendation.v2'?rows.filter(r=>r.missingFieldCoverage).length:null,firstAttemptValid:rows.filter(r=>r.attempts.length===1&&r.status==='SUCCEEDED').length,repairCount:rows.reduce((n,r)=>n+Math.max(0,r.attempts.length-1),0),attempts:rows.reduce((n,r)=>n+r.attempts.length,0),schemaValidAttempts:rows.reduce((n,r)=>n+r.attempts.filter(a=>a.schemaValid).length,0),referenceValidAttempts:rows.reduce((n,r)=>n+r.attempts.filter(a=>a.referenceValid).length,0),modelP50Ms:times[Math.ceil(times.length*.5)-1]??null,modelP95Ms:times[Math.ceil(times.length*.95)-1]??null}];
}));}
await persist('IN_PROGRESS');
try{
  await withM14Database(async({databaseUrl})=>{
    let sopDocumentId;
    for(const c of m14Dataset.cases){
      const caseStart=performance.now(),s=await createRecommendationHarness(databaseUrl,{embeddingProvider:null});let restoreTeam;
      const row={id:c.id,inputHash:hash(c),expectedNextStep:c.expectedNextStep,versions:[]};results.push(row);
      try{
        if(c.knowledge){
          if(!sopDocumentId)sopDocumentId=(await s.upload(source,'SOP kiểm tra IoT — synthetic M14')).id;
          else{const doc=await s.docs.detail(sopDocumentId,s.manager.actor);assert.equal(doc.sha256,hash(source),'Synthetic SOP content must remain unchanged');assert.equal(doc.status,'DISABLED','Harness must isolate the previous corpus');await s.docs.command(doc.id,s.manager.actor,doc.version,'reindex',randomUUID());await s.ingestion.tick();}
          const doc=await s.docs.detail(sopDocumentId,s.manager.actor);assert.equal(doc.status,'READY');assert.equal(doc.sha256,hash(source));row.procedureCorpus={documentId:doc.id,sourceHash:doc.sha256,activeGeneration:doc.activeGeneration};
        }
        if(c.noCandidate){await s.prisma.team.update({where:{code:'NETWORK_OPERATIONS'},data:{active:false}});restoreTeam=()=>s.prisma.team.update({where:{code:'NETWORK_OPERATIONS'},data:{active:true}});}
        const analysis={...syntheticAnalysis,entities:{...syntheticAnalysis.entities,...(c.missing.includes('location')?{location:null}:{}),...(c.missing.includes('startedAt')?{startedAt:null}:{})},missingFields:c.missing};
        const request=await s.create(c.description,analysis),businessBefore=await businessSnapshot(s.prisma,request.id),captureStart=performance.now(),capture=await s.recommend(request);
        assert.equal(capture.status,'SUCCEEDED','Real context capture failed: '+capture.errorCode);const {evidence,authorization:captureAuthorization}=recommendationSnapshot(capture.retrievalSnapshotJson);assert.ok(captureAuthorization,'Context capture must retain backend-only authorization metadata');assert.ok(captureAuthorization.initiatingSessionId===s.manager.actor.sessionId,'Context capture authorization must match its initiating session');assert.equal('_authorization' in evidence,false);assert.equal(JSON.stringify(evidence).includes(s.manager.actor.sessionId),false);
        row.contextCapture={runId:capture.id,testOnlyStructuredOutput:true,authorizationMetadataExcluded:true,durationMs:Math.round(performance.now()-captureStart),embeddingIdentity:evidence.embeddingIdentity,sourceIds:evidence.sources.map(source=>source.sourceId),sourceCount:evidence.sources.length,candidateCount:evidence.candidates.candidates.length,contextHash:hash(evidence)};
        assert.equal(evidence.embeddingIdentity.provider,'ollama');assert.equal(evidence.embeddingIdentity.model,env.OLLAMA_EMBEDDING_MODEL);assert.equal(evidence.embeddingIdentity.digest,actualEmbeddingModel.digest);assert.equal(evidence.sources.length>0,!!c.knowledge);assert.equal(evidence.requestVersion,request.version);assert.equal(evidence.requestContext.id,request.id);assert.equal(evidence.requestContext.version,request.version);assert.equal(evidence.requestContext.status,request.status);assert.equal(evidence.requestContext.description,request.description);assert.equal(evidence.requestContext.title,request.title);assert.deepEqual([...evidence.analysis.missingFields].sort(),[...c.missing].sort());if(c.noCandidate)assert.equal(evidence.candidates.candidates.length,0);
        const evidenceDecision=decideRecommendationEvidence(evidence,env.RAG_MAX_DISTANCE);
        const {requestContext,...v1Evidence}=evidence;row.requestId=request.id;row.commonContextHash=hash(v1Evidence);row.v2RequestContextHash=hash(requestContext);
        row.contextCapture.artifactPath=attemptRoot+'/'+c.id+'-context.json';await saveEvidence(row.contextCapture.artifactPath,{evaluationId,caseId:c.id,synthetic:true,input:c,commonContextHash:row.commonContextHash,v2RequestContextHash:row.v2RequestContextHash,evidence});
        for(const schemaVersion of ['recommendation.v1','recommendation.v2']){
          const v2=schemaVersion==='recommendation.v2',versionResult={schemaVersion,promptVersion:v2?recommendationPromptV2Version:recommendationPromptVersion,status:'FAILED',schemaValid:false,referenceValid:false,actionVocabularyValid:v2?false:null,missingFieldCoverage:v2?false:null,expectedMainStep:v2?false:null,attempts:[]};row.versions.push(versionResult);let repair='',valid,validGeneration;
          const modelStart=performance.now(),runDeadlineAt=Date.now()+env.AI_RUN_TIMEOUT_MS,runSignal=AbortSignal.timeout(env.AI_RUN_TIMEOUT_MS);versionResult.deadlineAt=new Date(runDeadlineAt).toISOString();
          for(let attempt=0;attempt<2;attempt++){
            const attemptStart=performance.now(),outcome={ordinal:attempt+1,schemaValid:false,referenceValid:false,artifactPath:attemptRoot+'/'+c.id+'-'+schemaVersion+'-'+(attempt+1)+'.json'};versionResult.attempts.push(outcome);versionResult.schemaValid=false;versionResult.referenceValid=false;
            try{
              if(runSignal.aborted||Date.now()>=runDeadlineAt)throw new AiFailure('AI_TIMEOUT');
              const messages=v2?recommendationMessagesV2(request,evidence,repair||attempt>0,evidenceDecision):recommendationMessages(request,v1Evidence,repair||attempt>0),format=v2?recommendationFormatV2(evidence,evidenceDecision):recommendationFormat(v1Evidence);outcome.inputHash=hash(messages);outcome.formatHash=hash(format);
              const promptText=JSON.stringify(messages);assert.equal(promptText.includes(s.manager.actor.sessionId),false,'Backend session ID must not enter model context');assert.equal(promptText.includes('_authorization'),false);assert.equal(promptText.includes('initiatingSessionId'),false);outcome.authorizationMetadataExcluded=true;
              const generation=await provider.generateStructured(messages,format,runSignal);outcome.modelIdentity=generation.identity;outcome.outputSize=generation.outputSize;outcome.outputHash=hash(generation.raw);outcome.structuredOutput=generation.raw;assert.equal(generation.identity.model,actualModel.name);assert.equal(generation.identity.digest,actualModel.digest);
              let parsed;try{parsed=JSON.parse(generation.raw);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true,'Return one valid JSON object.');}
              outcome.schemaValid=(v2?recommendationV2Schema:recommendationSchema).safeParse(parsed).success;versionResult.schemaValid=outcome.schemaValid;
              valid=v2?parseRecommendationV2ForGeneration(generation.raw,evidence,evidenceDecision):parseRecommendation(generation.raw,v1Evidence);outcome.referenceValid=true;versionResult.schemaValid=true;versionResult.referenceValid=true;versionResult.status='SUCCEEDED';versionResult.recommendation=valid;validGeneration=generation;delete versionResult.errorCode;
              if(v2){versionResult.actionVocabularyValid=['START_WORK','REQUEST_USER_INFO','RESOLVE'].includes(valid.recommendedAction.action);versionResult.expectedMainStep=valid.recommendedAction.action===c.expectedNextStep;versionResult.missingFieldCoverage=JSON.stringify(valid.missingInformation.map(m=>m.field).sort())===JSON.stringify([...c.missing].sort());versionResult.noConfidence=!('confidence' in valid);versionResult.proceduralEvidence=valid.evidenceStatus;}
              break;
            }catch(error){outcome.errorCode=runSignal.aborted?'AI_TIMEOUT':error instanceof AiFailure?error.code:'EVALUATION_ERROR';outcome.validationRule=error instanceof AiFailure?error.repairFeedback.split(':')[0]||error.code:error.message;outcome.repairFeedback=error instanceof AiFailure?error.repairFeedback:'';if(error instanceof AiFailure&&error.invalidOutput){outcome.structuredOutput=error.invalidOutput;outcome.outputHash=hash(error.invalidOutput);outcome.outputIsTruncated=true;}repair=outcome.repairFeedback;versionResult.errorCode=outcome.errorCode;if(!(error instanceof AiFailure)||!error.retryable||attempt===1||runSignal.aborted)break;await delay(1000,undefined,{signal:runSignal}).catch(()=>{});}
            finally{outcome.durationMs=Math.round(performance.now()-attemptStart);outcome.deadlineExceeded=runSignal.aborted;await saveEvidence(outcome.artifactPath,{evaluationId,caseId:c.id,schemaVersion,synthetic:true,contextHash:row.contextCapture.contextHash,...outcome});}
          }
          versionResult.modelTotalMs=Math.round(performance.now()-modelStart);
          versionResult.generationStatus=versionResult.status;
          assert.equal(hash(evidence),row.contextCapture.contextHash,'Frozen evidence changed between V1/V2 attempts');
          if(v2&&valid&&validGeneration){
            try{
            const publicationStart=performance.now(),run=await s.service.schedule(request.id,s.manager.actor,request.version,randomUUID());
            const {authorization}=recommendationSnapshot(run.retrievalSnapshotJson);assert.ok(authorization,'New queue authorization metadata is required');assert.ok(authorization.initiatingSessionId===s.manager.actor.sessionId,'Publication authorization must match the newly queued initiating session');
            await s.prisma.aiRun.update({where:{id:run.id},data:{status:'RUNNING',startedAt:new Date(runDeadlineAt-env.AI_RUN_TIMEOUT_MS),deadlineAt:new Date(runDeadlineAt),leaseUntil:new Date(runDeadlineAt),retrievalSnapshotJson:{...evidence,_authorization:authorization,_evidenceDecision:evidenceDecision},inputSize:JSON.stringify(recommendationMessagesV2(request,evidence,false,evidenceDecision)).length,retryCount:versionResult.attempts.length-1}});
            const recommendationId=await s.machine.publishRecommendation(run.id,valid,validGeneration.identity,validGeneration.outputSize,versionResult.modelTotalMs);
            versionResult.persistenceMs=Math.round(performance.now()-publicationStart);versionResult.actualPublishedRunId=run.id;versionResult.actualPublishedRecommendationId=recommendationId;
            const apiStart=performance.now(),response=await s.call(s.manager.token,'/manager/requests/'+request.id+'/ai/recommendation?aiRunId='+run.id);assert.equal(response.status,200);const job=recommendationResponseSchema.parse(response.body).data;assert.deepEqual(job.recommendation,valid);assert.equal(job.schemaVersion,schemaVersion);assert.equal(job.recommendationId,recommendationId);assert.equal(job.reviewStatus,'PENDING');assert.equal(job.stale,false);assert.equal(JSON.stringify(response.body).includes(authorization.initiatingSessionId),false,'Backend session ID must not appear in public response');assert.equal(JSON.stringify(response.body).includes('_authorization'),false);versionResult.apiReadMs=Math.round(performance.now()-apiStart);assert.deepEqual(await businessSnapshot(s.prisma,request.id),businessBefore);versionResult.artifactOnlyPublication=true;
            }catch(error){versionResult.status='FAILED';versionResult.errorCode=error.code??'PERSISTENCE_ERROR';versionResult.publicationError=error.message;}
          }
          await persist('IN_PROGRESS');console.log(JSON.stringify({caseId:c.id,schemaVersion,status:versionResult.status,errorCode:versionResult.errorCode??null,attempts:versionResult.attempts.length,modelTotalMs:versionResult.modelTotalMs}));
        }
        row.totalMs=Math.round(performance.now()-caseStart);await persist('IN_PROGRESS');
      }catch(error){row.setupOrPersistenceError=error.message;row.totalMs=Math.round(performance.now()-caseStart);await persist('FAIL');throw error;}
      finally{try{if(restoreTeam)await restoreTeam();}finally{await s.close();}}
    }
  });
  const v2=results.flatMap(r=>r.versions).filter(r=>r.schemaVersion==='recommendation.v2');
  const pass=results.length===m14Dataset.cases.length&&v2.length===m14Dataset.cases.length&&v2.every(r=>r.status==='SUCCEEDED'&&r.schemaValid&&r.referenceValid&&r.actionVocabularyValid&&r.missingFieldCoverage&&r.noConfidence&&r.artifactOnlyPublication);
  await persist(pass?'PASS':'FAIL');if(!pass)throw new Error('M14 live V2 schema/reference/action/missing-field/publication gate failed; retained actual failures require review');
}catch(error){await persist('FAIL');throw error;}
