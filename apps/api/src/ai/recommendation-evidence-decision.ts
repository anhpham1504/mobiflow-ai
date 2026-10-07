import {z} from 'zod';
import {analysisSchema,type RecommendationEvidenceV2,type RecommendationV2,type Source} from '@mobiflow/contracts';
import {AiFailure} from './provider.js';

// Internal recommendation policy; retrieval/currentness and authorization remain
// the responsibility of the existing tools and transactional publication guards.
export const recommendationEvidenceDecisionVersion='recommendation-evidence.v1';
const defaultMaxDistance=0.5;
export const recommendationEvidenceDecisionSchema=z.object({
  version:z.literal(recommendationEvidenceDecisionVersion),
  maxDistance:z.number().finite().min(0).max(2),
  evidenceStatus:z.enum(['SUFFICIENT','INSUFFICIENT_EVIDENCE']),
  evidenceReasonCode:z.enum(['RELEVANT_PROCEDURE_AVAILABLE','NO_ALLOWED_RELEVANT_PROCEDURE']),
  eligibleProcedureSourceIds:z.array(z.string().min(1).max(120)).max(5),
  selectedProcedureSourceIds:z.array(z.string().min(1).max(120)).max(1),
  missingFields:analysisSchema.shape.missingFields,
  allowedMainActions:z.array(z.enum(['START_WORK','REQUEST_USER_INFO','RESOLVE'])).min(1).max(3),
}).strict();
export type RecommendationEvidenceDecision=z.infer<typeof recommendationEvidenceDecisionSchema>;

const normalized=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase();
const scopes:Record<string,{category:string;subject:RegExp;condition:RegExp}>={
  IOT_CONNECTIVITY:{category:'NETWORK',subject:/\b(?:sim\b.*\biot|iot\b.*\bsim)\b/,condition:/\b(?:ket noi|song|mang|du lieu|apn)\b/},
  MOBILE_NETWORK:{category:'NETWORK',subject:/\b(?:dien thoai|di dong|thue bao)\b/,condition:/\b(?:song|dich vu mang|cuoc goi|du lieu|mang)\b/},
  DEVICE_CONFIGURATION:{category:'IOT',subject:/\b(?:thiet bi\b.*\biot|iot\b.*\bthiet bi)\b/,condition:/\bcau hinh\b/},
  BILLING_DISCREPANCY:{category:'BILLING',subject:/\b(?:cuoc|hoa don)\b/,condition:/\b(?:chenh lech|sai|doi soat)\b/},
  ACCESS_ISSUE:{category:'ACCOUNT',subject:/\b(?:dang nhap|truy cap)\b/,condition:/\b(?:khong\b.*\bduoc|loi|bi chan|bi khoa|tu choi)\b/},
  ACTIVATION:{category:'SERVICE',subject:/\bdich vu\b/,condition:/\bkich hoat\b/},
  INTERNAL_SUPPORT:{category:'OTHER',subject:/\bho tro\b/,condition:/\bnoi bo\b/},
};
const applicability=/\b(?:ap dung (?:cho|khi)|quy trinh (?:cho|xu ly)|khi)\b/;
const instruction=/\b(?:kiem tra|xac minh|xac nhan|doi chieu|ghi (?:lai|nhan)|thu thap|huong dan)\b/;
function affirmativeBefore(clause:string,index:number){return !/\b(?:khong|chua|never|not)\b/.test(clause.slice(0,index));}

function supportsProcedure(source:Source,category:string,subcategory:string){
  const scope=scopes[subcategory];if(!scope||scope.category!==category)return false;
  // Only explicit positive scope and instructions in the actual supplied excerpt
  // qualify. Titles, score, request IDs and keyword presence alone never do.
  const clauses=normalized(source.excerpt).split(/[.!?;\n]+/).map(clause=>clause.trim()).filter(Boolean);
  const declarations=clauses.flatMap(clause=>{
    const match=/\bphan loai(?: tham khao)?\s*:?\s*([a-z]+)\s*\/\s*([a-z_]+)\b/.exec(clause);
    return match&&affirmativeBefore(clause,match.index)?[{category:match[1]!.toUpperCase(),subcategory:match[2]!.toUpperCase()}]:[];
  });
  if(declarations.some(declaration=>declaration.category!==category||declaration.subcategory!==subcategory))return false;
  const hasInstruction=clauses.some(clause=>{const match=instruction.exec(clause);return match!==null&&!/\b(?:khong|chua|never|not)(?:\s+(?:duoc|can|nen|phai|tu|y|thuc|hien)){0,3}\s*$/.test(clause.slice(0,match.index));});
  if(!hasInstruction)return false;
  if(declarations.some(declaration=>declaration.category===category&&declaration.subcategory===subcategory))return true;
  return clauses.some(clause=>{
    const match=applicability.exec(clause);
    if(!match||!affirmativeBefore(clause,match.index))return false;
    const applied=clause.slice(match.index+match[0].length);
    // Scope describes the applicability condition, before its operational step.
    const step=instruction.exec(applied),condition=step?applied.slice(0,step.index):applied;
    return scope.subject.test(condition)&&scope.condition.test(condition);
  });
}

export function decideRecommendationEvidence(evidence:RecommendationEvidenceV2,maxDistance=defaultMaxDistance):RecommendationEvidenceDecision {
  if(!Number.isFinite(maxDistance)||maxDistance<0||maxDistance>2)throw new AiFailure('AI_INVALID_CONTEXT');
  const counts=new Map<string,number>();for(const source of evidence.sources)counts.set(source.sourceId,(counts.get(source.sourceId)??0)+1);
  const eligible=evidence.sources.filter(source=>counts.get(source.sourceId)===1&&!source.unavailableForLiveUse&&Number.isFinite(source.distance)&&source.distance<=maxDistance&&supportsProcedure(source,evidence.analysis.category,evidence.analysis.subcategory))
    .sort((a,b)=>a.distance-b.distance||(a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:0));
  const decision=recommendationEvidenceDecisionSchema.parse({
    version:recommendationEvidenceDecisionVersion,maxDistance,
    evidenceStatus:eligible.length?'SUFFICIENT':'INSUFFICIENT_EVIDENCE',
    evidenceReasonCode:eligible.length?'RELEVANT_PROCEDURE_AVAILABLE':'NO_ALLOWED_RELEVANT_PROCEDURE',
    eligibleProcedureSourceIds:eligible.map(source=>source.sourceId),selectedProcedureSourceIds:eligible.slice(0,1).map(source=>source.sourceId),
    missingFields:[...evidence.analysis.missingFields],
    allowedMainActions:evidence.analysis.missingFields.length?['REQUEST_USER_INFO']:['START_WORK','REQUEST_USER_INFO',...(evidence.requestContext.status==='IN_PROGRESS'?['RESOLVE']:[])],
  });
  Object.freeze(decision.eligibleProcedureSourceIds);Object.freeze(decision.selectedProcedureSourceIds);Object.freeze(decision.missingFields);Object.freeze(decision.allowedMainActions);
  return Object.freeze(decision);
}
const invalid=(rule:string):never=>{throw new AiFailure('INVALID_REFERENCE',true,rule+': Preserve the authoritative backend evidence decision, selected procedures, missing fields and allowed actions.');};
export function validateRecommendationEvidenceDecision(evidence:RecommendationEvidenceV2,decision:RecommendationEvidenceDecision,maxDistance=decision.maxDistance){
  const parsed=recommendationEvidenceDecisionSchema.safeParse(decision),expected=decideRecommendationEvidence(evidence,maxDistance);
  if(!parsed.success||JSON.stringify(parsed.data)!==JSON.stringify(expected))invalid('EVIDENCE_DECISION_CONTEXT_MISMATCH');
  return expected;
}
export function validateRecommendationEvidenceOutput(result:RecommendationV2,decision:RecommendationEvidenceDecision){
  if(result.evidenceStatus!==decision.evidenceStatus)invalid('EVIDENCE_DECISION_MISMATCH');
  if(JSON.stringify(result.procedureSources.map(source=>source.sourceId).sort())!==JSON.stringify([...decision.selectedProcedureSourceIds].sort()))invalid('PROCEDURE_DECISION_MEMBERSHIP');
  if(result.suggestedChecklist.some(item=>item.sourceIds.some(id=>!decision.selectedProcedureSourceIds.includes(id))))invalid('PROCEDURE_DECISION_MEMBERSHIP');
  if(!decision.allowedMainActions.includes(result.recommendedAction.action))invalid('ACTION_DECISION_SCOPE');
  if(decision.missingFields.length&&result.suggestedChecklist.length)invalid('MISSING_INFORMATION_BEFORE_PROCEDURE');
}
