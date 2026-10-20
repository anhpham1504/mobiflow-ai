import {recommendationSchema,recommendationV2Schema,recommendationVersion,recommendationV2Version,recommendationEvidenceSchema,recommendationEvidenceV2Schema,type Recommendation,type RecommendationV2,type RecommendationEvidence,type RecommendationEvidenceV2,type AnyRecommendation} from '@mobiflow/contracts';
import {AiFailure} from './provider.js';
import {validateCitations} from '../knowledge/rag-output.js';
import {decideRecommendationEvidence,validateRecommendationEvidenceDecision,validateRecommendationEvidenceOutput,type RecommendationEvidenceDecision} from './recommendation-evidence-decision.js';
export function parseRecommendation(raw:string,evidence:RecommendationEvidence):Recommendation {
  if(Buffer.byteLength(raw)>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
  let json:unknown;try{json=JSON.parse(raw);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true);}
  const parsed=recommendationSchema.safeParse(json);if(!parsed.success)throw new AiFailure('AI_INVALID_OUTPUT',true,'Return exactly the provided recommendation schema.');
  const r=parsed.data;
  validateBindings(r,r.actions,evidence);
  return r;
}
type BoundSuggestion=Pick<Recommendation,'suggestedPriority'|'suggestedTeamId'|'suggestedStaffId'|'suggestedSlaMinutes'|'procedureSources'|'similarCaseAlert'|'evidenceStatus'>;
const fail=(rule='REFERENCE_MEMBERSHIP'):never=>{throw new AiFailure('INVALID_REFERENCE',true,rule+': Use only the supplied facts, candidate/source IDs, exact policy and similar count.');};
function validateBindings(r:BoundSuggestion,actions:Recommendation['actions'],evidence:RecommendationEvidence){
  if(new Set(r.procedureSources.map(s=>s.sourceId)).size!==r.procedureSources.length)fail();
  for(const ref of [...r.procedureSources,...actions.flatMap(a=>a.sourceIds.map(sourceId=>({sourceId})))]){
    const source=evidence.sources.find(s=>s.sourceId===ref.sourceId);if(!source)fail('SOURCE_MEMBERSHIP');
    // Reuse M5 source membership validation. M6 has references, not a model-authored quote field.
    validateCitations([{sourceId:ref.sourceId,quote:source!.excerpt.slice(0,100)}],evidence.sources);
  }
  if(actions.some(a=>a.sourceIds.some(id=>!r.procedureSources.some(s=>s.sourceId===id))))fail('ACTION_SOURCE_NOT_IN_PROCEDURE');
  const staff=evidence.candidates.candidates.find(c=>c.staffId===r.suggestedStaffId);
  if(r.suggestedStaffId!==null&&(!staff||staff.teamId!==r.suggestedTeamId))fail('STAFF_TEAM_MEMBERSHIP');
  if(r.suggestedTeamId!==null&&!evidence.candidates.candidates.some(c=>c.teamId===r.suggestedTeamId))fail();
  if(!evidence.candidates.candidates.length&&(r.suggestedTeamId!==null||r.suggestedStaffId!==null))fail();
  if(r.suggestedSlaMinutes!==(evidence.policy?.targetMinutes??null)||evidence.policy&&r.suggestedPriority!==evidence.policy.priority)fail('SLA_POLICY');
  if(r.similarCaseAlert.count!==evidence.similar.returnedCount||r.similarCaseAlert.detected!==(evidence.similar.returnedCount>0))fail('SIMILAR_COUNT');
  if(!evidence.sources.length&&(actions.length||r.procedureSources.length||r.evidenceStatus!=='INSUFFICIENT_EVIDENCE'))fail();
  if(r.evidenceStatus==='SUFFICIENT'&&!r.procedureSources.length)fail('SUFFICIENT_REQUIRES_SOURCE');
  if(r.evidenceStatus==='INSUFFICIENT_EVIDENCE'&&(actions.length||r.procedureSources.length))fail('INSUFFICIENT_REQUIRES_EMPTY_ACTIONS_AND_SOURCES');
}

export function parseRecommendationV2(raw:string,input:RecommendationEvidenceV2):RecommendationV2 {
  if(Buffer.byteLength(raw)>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
  const context=recommendationEvidenceV2Schema.safeParse(input);
  if(!context.success)throw new AiFailure('AI_INVALID_CONTEXT');
  const evidence=context.data,request=evidence.requestContext;
  if(request.version!==evidence.requestVersion)throw new AiFailure('AI_INVALID_CONTEXT');
  let json:unknown;try{json=JSON.parse(raw);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true);}
  const parsed=recommendationV2Schema.safeParse(json);
  if(!parsed.success)throw new AiFailure('AI_INVALID_OUTPUT',true,'Return exactly the provided recommendation.v2 schema; no confidence, commands, unknown keys or hidden reasoning.');
  const r=parsed.data;
  validateBindings(r,r.suggestedChecklist,evidence);
  if(r.classification.category!==evidence.analysis.category||r.classification.subcategory!==evidence.analysis.subcategory)fail('CLASSIFICATION_SNAPSHOT');
  const missing=[...evidence.analysis.missingFields].sort(),returned=r.missingInformation.map(m=>m.field).sort();
  if(JSON.stringify(missing)!==JSON.stringify(returned))fail('MISSING_INFORMATION_SNAPSHOT');
  const keys=new Set<string>(),referenceIds=new Set<string>();
  const requestFacts=[request.title,request.description,request.location,request.status,request.category,request.subcategory,request.priority,JSON.stringify({status:request.status,category:request.category,subcategory:request.subcategory,priority:request.priority,location:request.location,sla:request.sla}),...evidence.history.events.flatMap(event=>'body' in event.payload?[event.payload.body]:[])].filter((value):value is string=>value!==null);
  for(const item of r.evidence){
    const key=item.type+':'+item.referenceId;if(keys.has(key))fail('DUPLICATE_EVIDENCE');keys.add(key);
    let facts:string[]=[];
    if(item.type==='REQUEST'&&item.referenceId===request.id)facts=requestFacts;
    if(item.type==='KNOWLEDGE'){const source=evidence.sources.find(s=>s.sourceId===item.referenceId);if(source)facts=[source.excerpt];}
    if(item.type==='HISTORICAL_REQUEST'){const prior=evidence.similar.cases.find(c=>c.requestId===item.referenceId);if(prior)facts=[prior.title,prior.publicCode,prior.status,...(prior.category?[prior.category]:[]),...(prior.location?[prior.location]:[]),JSON.stringify({title:prior.title,status:prior.status,category:prior.category,location:prior.location})];}
    if(!facts.some(fact=>fact.includes(item.excerpt)))fail('EVIDENCE_EXCERPT_MEMBERSHIP');
    referenceIds.add(item.referenceId);
  }
  if(!r.evidence.some(item=>item.type==='REQUEST'&&item.referenceId===request.id))throw new AiFailure('INVALID_REFERENCE',true,'CURRENT_REQUEST_EVIDENCE_REQUIRED: Add an evidence item type REQUEST, referenceId '+request.id+', excerpt copied exactly from the supplied request title/description, relevance as a short explanation. Preserve any required KNOWLEDGE evidence.');
  if(r.procedureSources.some(ref=>!r.evidence.some(item=>item.type==='KNOWLEDGE'&&item.referenceId===ref.sourceId)))fail('PROCEDURE_EVIDENCE_REQUIRED');
  for(const warning of r.warnings){
    if(warning.referenceIds.some(id=>!referenceIds.has(id)))fail('WARNING_REFERENCE_MEMBERSHIP');
    if(warning.code==='MISSING_INFORMATION'&&(!missing.length||!warning.referenceIds.includes(request.id)))fail('MISSING_WARNING_SNAPSHOT');
    if(warning.code==='INSUFFICIENT_EVIDENCE'&&(r.evidenceStatus!=='INSUFFICIENT_EVIDENCE'||!warning.referenceIds.includes(request.id)))fail('INSUFFICIENT_WARNING_SNAPSHOT');
    if((warning.code==='SLA_AT_RISK'||warning.code==='SLA_BREACHED')&&(!warning.referenceIds.includes(request.id)||request.sla?.state!==(warning.code==='SLA_AT_RISK'?'AT_RISK':'BREACHED')))fail('CANONICAL_SLA_WARNING');
    if(warning.code==='WEAK_EVIDENCE'&&(r.evidenceStatus!=='INSUFFICIENT_EVIDENCE'||!warning.referenceIds.length))fail('WEAK_WARNING_SNAPSHOT');
    if(warning.code==='CONFLICTING_EVIDENCE'){
      const conflict=request.category!==null&&request.category!==evidence.analysis.category||request.subcategory!==null&&request.subcategory!==evidence.analysis.subcategory||request.location!==null&&evidence.analysis.entities.location!==null&&request.location!==evidence.analysis.entities.location;
      if(!conflict||warning.referenceIds.length<2||!warning.referenceIds.includes(request.id))fail('CONFLICT_WARNING_SNAPSHOT');
    }
  }
  if(missing.length&&!r.warnings.some(w=>w.code==='MISSING_INFORMATION'))throw new AiFailure('INVALID_REFERENCE',true,'MISSING_WARNING_REQUIRED: Add warning code MISSING_INFORMATION, text explaining the supplied missingFields, referenceIds ['+request.id+']. Include current REQUEST evidence.');
  if(r.evidenceStatus==='INSUFFICIENT_EVIDENCE'&&!r.warnings.some(w=>w.code==='INSUFFICIENT_EVIDENCE'))throw new AiFailure('INVALID_REFERENCE',true,'INSUFFICIENT_WARNING_REQUIRED: Add warning code INSUFFICIENT_EVIDENCE, text explaining unavailable procedural grounding, referenceIds ['+request.id+']. Keep procedureSources and suggestedChecklist empty. Include current REQUEST evidence.');
  if(r.recommendedAction.action==='RESOLVE'&&request.status!=='IN_PROGRESS')fail('RESOLVE_PREREQUISITES_UNAVAILABLE');
  return r;
}

// These source labels describe provenance, not a diagnosis or confidence claim.
export const recommendationEvidenceRelevance={
  REQUEST:'Dữ liệu yêu cầu hiện hành do người dùng cung cấp.',
  KNOWLEDGE:'Nguồn kiến thức được truy xuất để tham khảo.',
  HISTORICAL_REQUEST:'Ví dụ lịch sử; không xác nhận nguyên nhân hiện tại.',
} as const satisfies Record<RecommendationV2['evidence'][number]['type'],string>;
export const recommendationMissingPresentation={
  customer:{question:'Khách hàng hoặc tài khoản nào bị ảnh hưởng?',impact:'Cần xác định đối tượng cần hỗ trợ.'},
  location:{question:'Vị trí xảy ra sự cố là ở đâu?',impact:'Cần xác định phạm vi kiểm tra.'},
  affectedCount:{question:'Có bao nhiêu đối tượng bị ảnh hưởng?',impact:'Cần xác định quy mô ảnh hưởng.'},
  startedAt:{question:'Sự cố bắt đầu vào thời điểm nào?',impact:'Cần đối chiếu thời điểm xảy ra sự cố.'},
  impact:{question:'Sự cố ảnh hưởng đến hoạt động nào?',impact:'Cần xác định tác động để xem xét ưu tiên.'},
  description:{question:'Bạn có thể mô tả triệu chứng và cách tái hiện?',impact:'Cần dữ kiện để xác minh sự cố.'},
} as const satisfies Record<RecommendationV2['missingInformation'][number]['field'],{question:string;impact:string}>;

// When analysis says request facts are missing, keep the model-authored action
// free of supplied literals that could be reassigned to the missing role. The
// concrete questions remain in missingInformation, where the backend binds
// their field, wording and impact.
export const recommendationMissingActionText='Sau khi quản lý phê duyệt, phân công và nhân viên bắt đầu xử lý, nhân viên hỏi người dùng để bổ sung các thông tin còn thiếu đã liệt kê.';

const normalizedEntityText=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
const escapedPattern=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const customerAsDevice=(text:string,customer:string)=>{
  const narrative=normalizedEntityText(text),identifier=escapedPattern(normalizedEntityText(customer));
  // Synthetic and persisted request identifiers use Unicode letter/number/underscore
  // segments joined by dot or hyphen. A terminal dot/hyphen remains prose punctuation.
  // Require the complete literal so a customer code cannot match only one segment of
  // a distinct device identifier.
  const identifierAtom='[\\p{L}\\p{N}_]',wordCharacter='[\\p{L}\\p{N}_]';
  const completeIdentifier='(?<!'+identifierAtom+')(?<!'+identifierAtom+'[.-])'+identifier+'(?!'+identifierAtom+'|[.-]'+identifierAtom+')';
  const deviceRole='(?<!'+wordCharacter+')(?:thiet\\s+bi|device|he\\s+thong|system|sim|modem|router)(?!'+wordCharacter+')';
  const preRoleLabel='(?:(?<!'+wordCharacter+')ma(?!'+wordCharacter+')\\s+)?';
  const postRoleLabel='(?:\\s+(?<!'+wordCharacter+')(?:ma|id|so)(?!'+wordCharacter+'))?';
  const relation='(?:[-:,]|(?<!'+wordCharacter+')(?:la|is|as)(?!'+wordCharacter+'))';
  return new RegExp(preRoleLabel+deviceRole+postRoleLabel+'\\s*[:#-]?\\s*'+completeIdentifier,'u').test(narrative)
    ||new RegExp(completeIdentifier+'\\s*'+relation+'\\s*(?:(?:mot|an?)\\s+)?'+deviceRole,'u').test(narrative);
};

function validateRecommendationEntityRoles(result:RecommendationV2,input:RecommendationEvidenceV2){
  const customer=input.analysis.entities.customer;
  if(!customer)return;
  const narratives=[result.summary,result.recommendedAction.text,result.reasonSummary,...result.warnings.map(item=>item.text),...result.suggestedChecklist.map(item=>item.text)];
  if(narratives.some(text=>customerAsDevice(text,customer)))fail('ENTITY_ROLE_SUBSTITUTION');
}

export function parseRecommendationV2ForGeneration(raw:string,input:RecommendationEvidenceV2,decision:RecommendationEvidenceDecision=decideRecommendationEvidence(input)):RecommendationV2 {
  const result=parseRecommendationV2(raw,input);
  validateRecommendationEvidenceDecision(input,decision);
  validateRecommendationEvidenceOutput(result,decision);
  for(const item of result.evidence)if(item.relevance!==recommendationEvidenceRelevance[item.type])fail('EVIDENCE_RELEVANCE_PROVENANCE');
  for(const item of result.missingInformation){
    const expected=recommendationMissingPresentation[item.field];
    if(item.question!==expected.question||item.impact!==expected.impact)fail('MISSING_INFORMATION_PRESENTATION');
  }
  if(decision.missingFields.length&&result.recommendedAction.text!==recommendationMissingActionText)fail('MISSING_INFORMATION_ACTION_PRESENTATION');
  validateRecommendationEntityRoles(result,input);
  return result;
}

export function parseRecommendationForVersion(version:string,raw:string,evidence:RecommendationEvidence|RecommendationEvidenceV2,forGeneration=false):AnyRecommendation {
  if(version===recommendationV2Version){const parsed=recommendationEvidenceV2Schema.safeParse(evidence);if(!parsed.success)throw new AiFailure('AI_INVALID_CONTEXT');return forGeneration?parseRecommendationV2ForGeneration(raw,parsed.data):parseRecommendationV2(raw,parsed.data);}
  if(version===recommendationVersion){const parsed=recommendationEvidenceSchema.safeParse(evidence);if(!parsed.success)throw new AiFailure('AI_INVALID_CONTEXT');return parseRecommendation(raw,parsed.data);}
  throw new AiFailure('AI_UNSUPPORTED_SCHEMA');
}
