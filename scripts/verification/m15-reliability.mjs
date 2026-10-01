import {runM15FailureMatrix} from '../../apps/api/test/helpers/m15-reliability-fixture.mjs';
import {saveEvidence} from './evidence.mjs';

const report={startedAt:new Date().toISOString(),kind:'development/synthetic evidence',method:'Real owning service/provider/parser/auth/state-machine code; deterministic in-memory repositories and loopback HTTP fault servers. Database fault/rollback is injected; no real PostgreSQL integration claim.',rows:[],result:'FAIL'};
try{report.rows=await runM15FailureMatrix();report.result=report.rows.every(row=>row.status==='PASS')?'PASS':'FAIL';}
catch(error){report.failure={message:error.message};}
report.finishedAt=new Date().toISOString();
report.limitations='In-memory repository predicates/transactions cannot prove actual PostgreSQL locking/isolation or browser behavior. M14 real PostgreSQL/browser history is preserved. Fault tests prove exact bounded implementation behavior under the documented injected conditions.';
await saveEvidence('docs/v1.2/evidence/M15_FAILURE_MATRIX.json',report);
console.log(JSON.stringify(report));
if(report.result!=='PASS')process.exitCode=1;
