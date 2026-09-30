import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsQuerySchema,analyticsMaxDays} from '@mobiflow/contracts';
import {analyticsQuery} from '../dist/analytics/analytics-query.js';
import {AnalyticsService} from '../dist/analytics/analytics.service.js';

test('M13 canonical filters accept calendar presets, custom leap ranges and real enum/UUID filters',()=>{
  for(const query of [{},{preset:'7d'},{preset:'30d'},{preset:'90d'},{windowDays:'365'},{from:'2024-02-29',to:'2024-03-01'},{from:'2026-01-01',to:'2027-01-01',priority:'HIGH',status:'CLOSED',category:'NETWORK',teamId:'11111111-1111-4111-8111-111111111111'}])assert.equal(analyticsQuerySchema.safeParse(query).success,true,JSON.stringify(query));
  assert.equal(analyticsMaxDays,365);
});
test('M13 invalid dates, reversed/unsupported ranges, duplicate types and unknown filters fail closed',()=>{
  assert.equal(analyticsQuerySchema.safeParse({from:'0000-01-01',to:'0000-01-02'}).success,false);
  for(const query of [{from:'2026-02-29',to:'2026-03-01'},{from:'2026-13-01',to:'2027-01-01'},{from:'invalid',to:'2026-03-01'},{from:'2026-01-01'},{to:'2026-03-01'},{from:'2026-03-01',to:'2026-03-01'},{from:'2026-03-02',to:'2026-03-01'},{from:'2026-01-01',to:'2027-01-02'},{from:'2026-01-01T00:00:00Z',to:'2026-02-01'},{preset:'365d'},{preset:'7d',windowDays:'7'},{preset:'7d',from:'2026-01-01',to:'2026-01-08'},{windowDays:'0'},{windowDays:'366'},{windowDays:'1.5'},{windowDays:' 30'},{windowDays:'1e1'},{windowDays:30},{priority:'NOW'},{status:'DONE'},{category:'CUSTOM'},{teamId:'NETWORK_OPERATIONS'},{preset:['7d','30d']},{priority:['HIGH','LOW']},{limit:'1'},{role:'MANAGER'},{asOf:'2026-01-01'},{from:'2026-01-01',to:'2026-01-02',unexpected:'true'}])assert.equal(analyticsQuerySchema.safeParse(query).success,false,JSON.stringify(query));
});
test('M13 query binds filter values and emits one timezone-explicit aggregate without raw record payloads',()=>{
  const query=analyticsQuery({from:'2026-03-01',to:'2026-03-04',priority:'HIGH',status:'CLOSED',category:'NETWORK',teamId:'11111111-1111-4111-8111-111111111111'});
  for(const value of ['2026-03-01','2026-03-04','11111111-1111-4111-8111-111111111111','Asia/Ho_Chi_Minh']){assert.ok(query.values.includes(value));assert.equal(query.text.includes(value),false);}
  assert.match(query.text,/generate_series/);assert.match(query.text,/COUNT\(DISTINCT/);assert.match(query.text,/RequestResolution/);
  assert.equal(/description|passwordHash|safeResultJson|retrievalSnapshotJson/.test(query.text),false);
});
test('M13 service refuses USER, STAFF and inactive/stale managers before aggregate execution',async()=>{
  let count=0;const service=new AnalyticsService({user:{findFirst:async()=>null},$queryRaw:async()=>{count++;throw new Error('Must not execute');}});
  for(const role of ['USER','STAFF','MANAGER'])await assert.rejects(service.dashboard({id:'11111111-1111-4111-8111-111111111111',role},{}),error=>error.status===403);
  assert.equal(count,0);
});
