import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analysisMessages,formatFor} from '../../apps/api/dist/ai/prompts/request-analysis.js';
import {recommendationV2Format,recommendationV2Messages} from '../../apps/api/dist/ai/prompts/recommendation.js';
import {copilotFormat,copilotMessages} from '../../apps/api/dist/ai/prompts/copilot.js';

const maxOutputTokens=1200,cacheMissInputPerMillion=.30,outputPerMillion=1.20;
const ids={request:'10000000-0000-4000-8000-000000000001',analysis:'10000000-0000-4000-8000-000000000002',document:'10000000-0000-4000-8000-000000000003',chunk:'10000000-0000-4000-8000-000000000004',staff:'10000000-0000-4000-8000-000000000005'};
const sourceId=`KD-${ids.document}-G1-C0`;
const title='Synthetic Canary: 17 thiết bị IoT mất kết nối';
const description='Một công ty hư cấu báo 17 thiết bị IoT mất kết nối từ 08:00 tại Khu thử nghiệm Zeta.';
const excerpt='Synthetic demo procedure, not an actual enterprise SOP. Áp dụng cho SIM IoT bị mất kết nối dữ liệu: kiểm tra trạng thái SIM và cấu hình APN, ghi lại kết quả trước khi đề xuất xử lý. Phân loại tham khảo: NETWORK / IOT_CONNECTIVITY.';
const analysis={intent:'REPORT_INCIDENT',category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',entities:{customer:null,location:'Khu thử nghiệm Zeta',affectedCount:17,startedAt:'08:00'},missingFields:[],confidence:.8,reasonSummary:'Nhiều thiết bị IoT hư cấu mất kết nối; cần con người xác minh.'};
const source={sourceId,chunkId:ids.chunk,documentId:ids.document,generation:1,title:'SOP-IOT-04 Synthetic Canary',pageNumber:1,section:'Kiểm tra kết nối',excerpt,contentHash:'a'.repeat(64),score:.95,distance:.05};

const intake={title,description,messages:[],historyTruncated:false,retrieval:{sources:[]}};
const recommendationEvidence={analysisId:ids.analysis,analysis,requestVersion:1,retrievedAt:'2026-10-23T00:00:00.000Z',sources:[source],similar:{cases:[],windowMinutes:30,returnedCount:0,truncated:false},candidates:{candidates:[],scoringVersion:'staff.v1'},workload:{workloads:[],asOf:'2026-10-23T00:00:00.000Z'},policy:null,history:{events:[],truncated:false},embeddingIdentity:{provider:'postgresql',model:'lexical-fts',digest:'synthetic-canary',dimension:1024,revision:'v1',key:'synthetic-canary'},requestContext:{id:ids.request,version:1,status:'TRIAGED',title,description,category:null,subcategory:null,priority:'MEDIUM',location:'Khu thử nghiệm Zeta',sla:null}};
const copilotContext={request:{id:ids.request,title,description,status:'ASSIGNED',version:2,category:'NETWORK',subcategory:'IOT_CONNECTIVITY',priority:'HIGH',assignee:{id:ids.staff,displayName:'Nhân viên synthetic'}},sla:null,analysis:{id:ids.analysis,category:'NETWORK',subcategory:'IOT_CONNECTIVITY',prioritySuggestion:'HIGH',reasonSummary:analysis.reasonSummary},checklist:null,resolution:null,messages:[],history:[],sources:[{sourceId,title:source.title,excerpt}],similarCases:[]};
const allowed={sourceIds:[sourceId],eventIds:[],caseIds:[]};
const forbiddenInternalNote='CANARY_INTERNAL_NOTE_FORBIDDEN';

const cases=[
  {caseId:'CASE_1_INTAKE',messages:analysisMessages(intake),format:formatFor(intake)},
  {caseId:'CASE_2_RECOMMENDATION',messages:recommendationV2Messages(recommendationEvidence.requestContext,recommendationEvidence),format:recommendationV2Format(recommendationEvidence)},
  {caseId:'CASE_3_COPILOT_FIND_SOP',messages:copilotMessages('FIND_SOP',copilotContext,allowed),format:copilotFormat('FIND_SOP',allowed)},
];

const projections=cases.map(item=>{
  const schema=JSON.stringify(item.format);
  const outbound=[{role:'system',content:'Return exactly one JSON object matching OUTPUT_JSON_SCHEMA. Do not include Markdown or extra text. OUTPUT_JSON_SCHEMA='+schema},...item.messages];
  assert.equal(JSON.stringify(outbound).includes(forbiddenInternalNote),false);
  const body=JSON.stringify({model:'deepseek-flash',thinking:{type:'disabled'},messages:outbound,response_format:{type:'json_object'},stream:false,temperature:0,max_tokens:maxOutputTokens});
  const bodyBytes=Buffer.byteLength(body,'utf8'),inputCharacters=Array.from(JSON.stringify(outbound)).length;
  const reservedUpperBoundUsd=(bodyBytes*cacheMissInputPerMillion+maxOutputTokens*outputPerMillion)/1_000_000;
  return {caseId:item.caseId,bodySha256:createHash('sha256').update(body).digest('hex'),bodyBytes,inputCharacters,maxOutputTokens,reservedUpperBoundUsd,thinking:'disabled',jsonMode:true,stream:false,temperature:0,forbiddenInternalNoteExcluded:true};
});
const totalReservedUpperBoundUsd=projections.reduce((sum,item)=>sum+item.reservedUpperBoundUsd,0);
assert.ok(totalReservedUpperBoundUsd<=.10,'Dry-run reservations exceed the owner-approved session budget');
console.log(JSON.stringify({status:'PASS',pricing:{cacheMissInputPerMillionUsd:cacheMissInputPerMillion,outputPerMillionUsd:outputPerMillion,basis:'peak rates; one UTF-8 request byte conservatively reserved as one input token'},maxHttpAttempts:3,budgetUsd:.10,projections,totalReservedUpperBoundUsd},null,2));
