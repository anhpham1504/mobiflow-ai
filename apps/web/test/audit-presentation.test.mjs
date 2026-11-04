import test from 'node:test';
import assert from 'node:assert/strict';
import {appendOlderEvents,chronologicalEvents,splitAuditEvents} from '../src/lib/audit-presentation.ts';

test('audit presentation preserves the API chronological order and prepends older pages',()=>{
  const current=[{id:'middle'},{id:'newest'}],older=[{id:'oldest'},{id:'older'}];
  const accumulated=appendOlderEvents(current,older);
  assert.deepEqual(accumulated.map(x=>x.id),['oldest','older','middle','newest']);
  assert.deepEqual(chronologicalEvents(accumulated).map(x=>x.id),['oldest','older','middle','newest']);
  assert.deepEqual(current.map(x=>x.id),['middle','newest']);
  assert.deepEqual(older.map(x=>x.id),['oldest','older']);
});

test('audit presentation keeps workflow milestones visible and moves infrastructure events to technical detail',()=>{
  const events=[{action:'CONFIRM'},{action:'KNOWLEDGE_RETRIEVED'},{action:'START_AI_ANALYSIS'},{action:'AI_ANALYSIS_QUEUED'}];
  const result=splitAuditEvents(events);
  assert.deepEqual(result.business.map(x=>x.action),['CONFIRM','START_AI_ANALYSIS']);
  assert.deepEqual(result.technical.map(x=>x.action),['KNOWLEDGE_RETRIEVED','AI_ANALYSIS_QUEUED']);
});
