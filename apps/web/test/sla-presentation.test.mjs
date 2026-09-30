import test from 'node:test';
import assert from 'node:assert/strict';
import {slaPresentation} from '../src/lib/sla-presentation.ts';

test('M12 UI renders authoritative states even where old 30 minute threshold disagrees',()=>{
  const base={state:'SAFE',remainingSeconds:900,breachedBySeconds:0,breachedAt:null,stopReason:null};
  assert.deepEqual(slaPresentation(base),{tone:'success',text:'Còn 15 phút',label:'Trong thời hạn'});
  assert.equal(slaPresentation({...base,state:'AT_RISK',remainingSeconds:3600}).tone,'warning');
  assert.equal(slaPresentation({...base,state:'PAUSED',remainingSeconds:-100,breachedAt:'historical'}).text,'Đang tạm dừng');
  assert.equal(slaPresentation({...base,state:'MET'}).text,'Hoàn thành trong SLA');
  assert.equal(slaPresentation({...base,state:'BREACHED',breachedBySeconds:0}).text,'Từng quá hạn');
  assert.equal(slaPresentation({...base,state:'BREACHED',breachedBySeconds:61}).text,'Quá hạn 2 phút');
  assert.equal(slaPresentation({...base,stopReason:'CANCELED'}).text,'Đã dừng');
});
