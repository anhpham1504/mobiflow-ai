import {recommendationSchema,type Recommendation,type RecommendationEvidence} from '@mobiflow/contracts';
import {AiFailure} from './provider.js';
import {validateCitations} from '../knowledge/rag-output.js';
export function parseRecommendation(raw:string,evidence:RecommendationEvidence):Recommendation {
  if(Buffer.byteLength(raw)>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
  let json:unknown;try{json=JSON.parse(raw);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true);}
  const parsed=recommendationSchema.safeParse(json);if(!parsed.success)throw new AiFailure('AI_INVALID_OUTPUT',true,'Return exactly the provided recommendation schema.');
  const r=parsed.data,fail=(rule='REFERENCE_MEMBERSHIP')=>{throw new AiFailure('INVALID_REFERENCE',true,rule+': Use only supplied candidate/source IDs, exact SLA policy minutes and exact similar count.');};
  if(new Set(r.procedureSources.map(s=>s.sourceId)).size!==r.procedureSources.length)fail();
  for(const ref of [...r.procedureSources,...r.actions.flatMap(a=>a.sourceIds.map(sourceId=>({sourceId})))]){
    const source=evidence.sources.find(s=>s.sourceId===ref.sourceId);if(!source)fail('SOURCE_MEMBERSHIP');
    // Reuse M5 source membership validation. M6 has references, not a model-authored quote field.
    validateCitations([{sourceId:ref.sourceId,quote:source!.excerpt.slice(0,100)}],evidence.sources);
  }
  if(r.actions.some(a=>a.sourceIds.some(id=>!r.procedureSources.some(s=>s.sourceId===id))))fail('ACTION_SOURCE_NOT_IN_PROCEDURE');
  const staff=evidence.candidates.candidates.find(c=>c.staffId===r.suggestedStaffId);
  if(r.suggestedStaffId!==null&&(!staff||staff.teamId!==r.suggestedTeamId))fail('STAFF_TEAM_MEMBERSHIP');
  if(r.suggestedTeamId!==null&&!evidence.candidates.candidates.some(c=>c.teamId===r.suggestedTeamId))fail();
  if(!evidence.candidates.candidates.length&&(r.suggestedTeamId!==null||r.suggestedStaffId!==null))fail();
  if(r.suggestedSlaMinutes!==(evidence.policy?.targetMinutes??null)||evidence.policy&&r.suggestedPriority!==evidence.policy.priority)fail('SLA_POLICY');
  if(r.similarCaseAlert.count!==evidence.similar.returnedCount||r.similarCaseAlert.detected!==(evidence.similar.returnedCount>0))fail('SIMILAR_COUNT');
  if(!evidence.sources.length&&(r.actions.length||r.procedureSources.length||r.evidenceStatus!=='INSUFFICIENT_EVIDENCE'))fail();
  if(r.evidenceStatus==='SUFFICIENT'&&!r.procedureSources.length)fail('SUFFICIENT_REQUIRES_SOURCE');
  if(r.evidenceStatus==='INSUFFICIENT_EVIDENCE'&&(r.actions.length||r.procedureSources.length))fail('INSUFFICIENT_REQUIRES_EMPTY_ACTIONS_AND_SOURCES');
  return r;
}
