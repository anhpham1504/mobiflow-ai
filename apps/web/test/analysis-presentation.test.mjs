import test from 'node:test';
import assert from 'node:assert/strict';
import {aiExplanationSchema} from '@mobiflow/contracts';
import {analysisRunning,analysisStatusText} from '../src/lib/analysis-presentation.ts';

test('STAFF explanation with private job omitted still reports the actual analysis status and polls while running',()=>{
  const staff=status=>aiExplanationSchema.parse({data:{status,job:null,missingFields:[]},requestId:'11111111-1111-4111-8111-111111111111'}).data;
  assert.equal(analysisStatusText(staff('SUCCEEDED'),''),'Phân tích AI hoàn tất.');
  assert.equal(analysisRunning(staff('SUCCEEDED')),false);
  assert.equal(analysisRunning(staff('RUNNING')),true);
  assert.equal(analysisStatusText(staff('RUNNING'),''),'AI đang phân tích…');
  assert.equal(analysisStatusText(staff('NOT_STARTED'),''),'Chưa có phân tích AI.');
  assert.ok(analysisStatusText(staff('FAILED'),'').includes('AI local hiện không khả dụng'));
  assert.equal(analysisStatusText(null,''),'Đang tải trạng thái AI…');
  assert.equal(analysisStatusText(null,'Network error'),'Chưa tải được trạng thái AI.');
});
