import {createHash} from 'node:crypto';
import {factRetentionSchema,type FactRetention} from '@mobiflow/contracts';
import type {AnalysisInput} from './prompts/request-analysis.js';
import {AiFailure} from './provider.js';

const secret=/\b(?:sk|ds)-[A-Za-z0-9_-]{16,}\b/gu;
const secretLike=/^(?:sk|ds)-[A-Za-z0-9_-]{16,}$/iu;
const email=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const phone=/(?<![\p{L}\p{N}])(?:\+?\d[\d .()-]{7,}\d)(?![\p{L}\p{N}])/gu;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const separatedIdentifier=/\b(?=[A-Za-z0-9][A-Za-z0-9._/-]{2,127}\b)(?=[A-Za-z0-9._/-]*[A-Za-z])(?=[A-Za-z0-9._/-]*\d)[A-Za-z][A-Za-z0-9]*(?:[-_/][A-Za-z0-9]+)+\b/gu;
const compactIdentifier=/\b(?=[A-Za-z0-9]{4,32}\b)(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*\d)[A-Za-z]{1,10}\d{2,}\b/gu;
const observationPattern=/\b(?:offline|online|working|restored|recovered|failed|failure|down|unavailable|binh thuong|hoat dong|khoi phuc|mat ket noi|khong ket noi|khong truyen|khong dong bo|khong su dung duoc|loi|nguon dien)\b/u;
const attemptPattern=/\b(?:da thu|da tung|thu khoi dong|attempted|tried|restarted|restart(?:ed)?|khoi dong lai|reset(?:ted)?)\b/u;
const noImprovementPattern=/\b(?:khong cai thien|khong khac phuc|khong giai quyet|van (?:loi|offline|khong)|did not (?:help|improve|fix)|no improvement|still (?:failed|offline|down))\b/u;
const failedPattern=/\b(?:khong thanh cong|that bai|failed|failure|could not|cannot)\b/u;
const succeededPattern=/\b(?:thanh cong|da khac phuc|da xu ly|succeeded|fixed|resolved)\b/u;
const explicitConflictPattern=/\b(?:khac biet|mau thuan|trai nguoc|khong nhat quan|conflict|contradict(?:ion|ory)?|inconsistent|discrepancy)\b/u;
const positiveStatePattern=/\b(?:binh thuong|hoat dong|khoi phuc|working|restored|recovered|online)\b/u;
const negativeStatePattern=/\b(?:offline|mat ket noi|khong ket noi|khong truyen|khong dong bo|loi|failed|failure|down|unavailable)\b/u;

const fold=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('vi').replace(/đ/gu,'d').replace(/\s+/gu,' ').trim();
const safe=(value:string)=>value.trim().replace(secret,'[REDACTED_SECRET]').replace(email,'[REDACTED_EMAIL]').replace(phone,candidate=>candidate.replace(/\D/gu,'').length>=9?'[REDACTED_PHONE]':candidate);
const key=(value:string)=>fold(value.normalize('NFC'));
function unique<T>(values:T[],identity:(value:T)=>string,limit:number){const seen=new Set<string>(),result:T[]=[];for(const value of values){const id=identity(value);if(!id||seen.has(id))continue;seen.add(id);result.push(value);if(result.length===limit)break;}return result;}
function sentences(value:string){return value.split(/(?<=[.!?])\s+|[\r\n]+|;\s*/u).map(safe).filter(Boolean).map(value=>Array.from(value).length<=1000?value:Array.from(value).slice(0,1000).join('').trim());}
function sourceText(input:AnalysisInput){return [input.title,input.description,...input.messages.map(message=>message.body)].join('\n');}
function technicalIdentifiers(value:string){
  const candidates=[...(value.match(separatedIdentifier)??[]),...(value.match(compactIdentifier)??[])];
  return unique(candidates.filter(candidate=>!uuid.test(candidate)&&!secretLike.test(candidate)),candidate=>candidate,16);
}
function attemptOutcome(value:string):FactRetention['troubleshootingAttempts'][number]['outcome']{
  const normalized=fold(value);if(noImprovementPattern.test(normalized))return 'NO_IMPROVEMENT';if(failedPattern.test(normalized))return 'FAILED';if(succeededPattern.test(normalized))return 'SUCCEEDED';return 'UNKNOWN';
}
export function extractFactRetention(input:AnalysisInput):FactRetention{
  const original=sourceText(input),parts=sentences(original),normalized=parts.map(fold);
  const observations=unique(parts.filter((_,index)=>observationPattern.test(normalized[index]!)),key,16).map(text=>({text,provenance:'USER_REPORTED' as const}));
  const troubleshootingAttempts=unique(parts.filter((_,index)=>attemptPattern.test(normalized[index]!)),key,12).map(action=>({action,outcome:attemptOutcome(action),provenance:'USER_REPORTED' as const}));
  const explicitIndexes=normalized.flatMap((value,index)=>explicitConflictPattern.test(value)?[index]:[]);
  const positive=normalized.findIndex(value=>positiveStatePattern.test(value)),negative=normalized.findIndex(value=>negativeStatePattern.test(value));
  const contradictionEvidence:string[][]=[];
  for(const index of explicitIndexes)contradictionEvidence.push(parts.slice(Math.max(0,index-2),index+1));
  if(positive>=0&&negative>=0&&positive!==negative)contradictionEvidence.push([parts[positive]!,parts[negative]!]);
  else if(positive>=0&&positive===negative&&/\b(?:nhung|tuy nhien|but|however|yet)\b/u.test(normalized[positive]!))contradictionEvidence.push([parts[positive]!]);
  const contradictions=unique(contradictionEvidence.map(evidence=>({description:'Các quan sát do người dùng cung cấp có dấu hiệu mâu thuẫn và cần được xác minh.',evidence:unique(evidence,key,4),provenance:'USER_REPORTED' as const})).filter(item=>item.evidence.length),item=>item.evidence.map(key).join('|'),8);
  return factRetentionSchema.parse({
    schemaVersion:'fact-retention.v1',source:'BACKEND_LITERAL_EXTRACTION',sourceTextHash:createHash('sha256').update(original).digest('hex'),
    observations,
    identifiers:technicalIdentifiers(original).map(value=>({value,kind:'TECHNICAL_IDENTIFIER' as const,provenance:'USER_REPORTED' as const})),
    troubleshootingAttempts,contradictions,
  });
}
export function validateFactRetention(input:AnalysisInput,value:unknown):FactRetention{
  const actual=factRetentionSchema.parse(value),expected=extractFactRetention(input);
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new AiFailure('AI_FACT_RETENTION_INVALID');
  return actual;
}
export function factRetentionFromStored(value:unknown):FactRetention|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const parsed=factRetentionSchema.safeParse((value as {factRetention?:unknown}).factRetention);return parsed.success?parsed.data:undefined;
}
