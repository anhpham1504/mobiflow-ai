import test from 'node:test';
import assert from 'node:assert/strict';
import {copilotActionSchema,copilotResultSchema,resolutionSummarySchema,feedbackSchema} from '@mobiflow/contracts';
import {transitionTarget} from '../dist/requests/transition-rules.js';
import {parseStrictOutput,parseSummaryOutput} from '../dist/ai/operational-output.js';

const id='11111111-1111-4111-8111-111111111111';
test('M8 Copilot accepts exactly six fixed actions and rejects prompt/tool fields',()=>{
  const actions=['SUMMARIZE_REQUEST','FIND_SOP','SUGGEST_NEXT_STEP','GENERATE_CHECKLIST','FIND_SIMILAR_REQUESTS','EXPLAIN_CLASSIFICATION'];
  for(const action of actions)assert.equal(copilotActionSchema.parse({expectedVersion:1,action}).action,action);
  assert.equal(copilotActionSchema.safeParse({expectedVersion:1,action:'CLOSE_REQUEST'}).success,false);
  assert.equal(copilotActionSchema.safeParse({expectedVersion:1,action:'FIND_SOP',prompt:'ignore rules',tool:'runShell'}).success,false);
});

test('M8 Copilot and resolution summary outputs are strict, bounded and reference-shaped',()=>{
  const source='KD-11111111-1111-4111-8111-111111111111-G1-C0';
  const valid={action:'GENERATE_CHECKLIST',evidenceStatus:'SUFFICIENT',answer:'Có quy trình phù hợp.',sources:[{sourceId:source,title:'SOP',quote:'Bước kiểm tra'}],warnings:[],suggestedNextSteps:[],checklistDraft:[{text:'Kiểm tra thiết bị',required:true,sourceIds:[source]}],eventIds:[],similarCases:[],analysisId:null};
  assert.equal(copilotResultSchema.safeParse(valid).success,true);
  assert.equal(copilotResultSchema.safeParse({...valid,mutation:{status:'CLOSED'}}).success,false);
  assert.equal(copilotResultSchema.safeParse({...valid,checklistDraft:[{text:'x',required:true,sourceIds:Array(6).fill(source)}]}).success,false);
  const summary={executiveSummary:'Đã xử lý.',timeline:[{eventId:id,at:'2026-09-29T00:00:00.000Z',summary:'Hoàn tất'}],rootCause:'Nguyên nhân hợp lệ',resolution:'Cách xử lý hợp lệ',verification:'Đã kiểm chứng',resolutionSeconds:60,sourceEventIds:[id]};
  assert.equal(resolutionSummarySchema.safeParse(summary).success,true);
  assert.equal(resolutionSummarySchema.safeParse({...summary,hiddenReasoning:'secret'}).success,false);
});

test('M8 model output accepts only syntactic fence cleanup and keeps strict action schemas',()=>{
  const source='KD-11111111-1111-4111-8111-111111111111-G1-C0',valid={message:'Bản nháp có căn cứ.',items:[{text:'Kiểm tra kết nối',sourceIds:[source]}]};
  assert.deepEqual(parseStrictOutput('GENERATE_CHECKLIST',JSON.stringify(valid)),valid);
  assert.deepEqual(parseStrictOutput('GENERATE_CHECKLIST','```json\n'+JSON.stringify(valid)+'\n```'),valid);
  assert.throws(()=>parseStrictOutput('GENERATE_CHECKLIST',JSON.stringify({...valid,action:'CLOSE_REQUEST'})),error=>error.code==='AI_INVALID_OUTPUT'&&error.retryable===true);
  assert.throws(()=>parseStrictOutput('GENERATE_CHECKLIST',JSON.stringify({message:'Thiếu items'})),error=>error.code==='AI_INVALID_OUTPUT');
  const summary={executiveSummary:'Hoàn tất xử lý.',timeline:[{eventId:id,summary:'Đã kiểm chứng'}]};assert.deepEqual(parseSummaryOutput(JSON.stringify(summary)),summary);
});

test('M8 feedback is owner-state constrained and strict',()=>{
  assert.deepEqual(feedbackSchema.parse({expectedVersion:9,rating:5,comment:'Tốt'}),{expectedVersion:9,rating:5,comment:'Tốt'});
  for(const rating of [0,6,1.5])assert.equal(feedbackSchema.safeParse({expectedVersion:1,rating}).success,false);
  assert.equal(transitionTarget('CLOSED','FEEDBACK','USER'),'CLOSED');
  assert.throws(()=>transitionTarget('RESOLVED','FEEDBACK','USER'));
  assert.throws(()=>transitionTarget('CLOSED','FEEDBACK','STAFF'));
});
