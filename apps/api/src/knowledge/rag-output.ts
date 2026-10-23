import {z} from 'zod';
import {analysisSchema,citationSchema,type Source} from '@mobiflow/contracts';
import {AiFailure,parseAnalysis} from '../ai/provider.js';
import type {Retrieval} from './retriever.js';
import {isTitleOnlyEvidence,isWholeWordSpan} from './excerpt.js';
export const ragOutputSchema=z.object({analysis:analysisSchema,citations:z.array(citationSchema).max(5)}).strict();
const genericTokens=new Set(['bao','can','cao','cho','cua','dan','dich','duoc','ghi','hang','hien','ho','huong','khach','khong','kiem','khao','lieu','mot','nguoi','nhan','nhung','nay','phan','tham','thong','the','tiep','tin','tra','tro','tai','toi','van','viec','voi','xac','xin','yeu']);
const evidenceTokens=(value:string)=>new Set((value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('vi').match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu)??[]).filter(token=>Array.from(token).length>=3&&!genericTokens.has(token)));
export function citationHasRequestTerm(quote:string,originalText:string){const requestTokens=evidenceTokens(originalText);return [...evidenceTokens(quote)].filter(token=>requestTokens.has(token)).length>=2;}
export function parseRagOutput(raw:string,retrieval:Retrieval,originalText?:string){
  if(Buffer.byteLength(raw)>32768)throw new AiFailure('AI_OUTPUT_TOO_LARGE');
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new AiFailure('AI_INVALID_OUTPUT',true);}
  const parsed=ragOutputSchema.safeParse(value);if(!parsed.success)throw new AiFailure('AI_INVALID_OUTPUT',true,'Return only the strict analysis and citations objects; respect null/missing consistency.');
  validateCitations(parsed.data.citations,retrieval.sources);
  if(originalText&&parsed.data.citations.length)for(const citation of parsed.data.citations)if(!citationHasRequestTerm(citation.quote,originalText))throw new AiFailure('INVALID_CITATION',true,'Each citation quote needs a concrete non-generic term also present in the original request; otherwise omit the citation.');
  return {analysis:parseAnalysis(JSON.stringify(parsed.data.analysis)),grounding:{mode:'RAG' as const,evidenceStatus:parsed.data.citations.length?'SUFFICIENT' as const:'INSUFFICIENT_EVIDENCE' as const,citations:parsed.data.citations},retrieval};
}
export function validateCitations(citations:z.infer<typeof citationSchema>[],sources:Source[]){
  if(new Set(citations.map(c=>c.sourceId)).size!==citations.length)throw new AiFailure('INVALID_CITATION',true);
  for(const citation of citations){const source=sources.find(s=>s.sourceId===citation.sourceId);if(!source||!source.excerpt.includes(citation.quote)||!isWholeWordSpan(source.excerpt,citation.quote)||Array.from(citation.quote.trim()).length<20||isTitleOnlyEvidence(citation.quote,source)||evidenceTokens(citation.quote).size<2)throw new AiFailure('INVALID_CITATION',true,'Cite a substantive exact whole-word span from supplied source content; titles, labels and partial words are not evidence.');}
}
