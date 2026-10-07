import {z} from 'zod';
import {recommendationEvidenceDecisionSchema} from './recommendation-evidence-decision.js';
// Backend authorization metadata is never model context or public evidence.
const authorizationSchema=z.object({initiatingSessionId:z.uuid()}).strict();
export function recommendationSnapshot(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return {evidence:value,authorization:null,evidenceDecision:null};
  const {_authorization,_evidenceDecision,...evidence}=value as Record<string,unknown>;
  const auth=authorizationSchema.safeParse(_authorization);
  const decision=recommendationEvidenceDecisionSchema.safeParse(_evidenceDecision);
  return {evidence,authorization:auth.success?auth.data:null,evidenceDecision:decision.success?decision.data:null};
}
