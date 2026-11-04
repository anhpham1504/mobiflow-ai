import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';

test('manager and staff analysis UI labels backend-owned retained facts without claiming verification',async()=>{
  const source=await readFile(new URL('../src/components/analysis-panel.tsx',import.meta.url),'utf8');
  assert.match(source,/role!=='USER'&&data\?\.factRetention/u);
  for(const label of ['Dữ kiện giữ nguyên từ yêu cầu','Nguồn: người dùng báo cáo','Mã kỹ thuật','Quan sát được báo cáo','Thao tác đã thử','Thông tin cần đối chiếu'])assert.ok(source.includes(label));
  assert.ok(source.includes('không phải nguyên nhân đã được xác minh'));
  assert.ok(source.includes('attemptOutcomeLabels[item.outcome]'));
});
