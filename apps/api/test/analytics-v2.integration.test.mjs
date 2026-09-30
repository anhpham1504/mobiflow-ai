import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {URLSearchParams} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {parseApiEnvironment} from '@mobiflow/config';
import {analyticsResponseSchema,priorities,statuses} from '@mobiflow/contracts';
import {createApplication} from '../dist/app.js';
import {AnalyticsService} from '../dist/analytics/analytics.service.js';
import {analyticsQuery} from '../dist/analytics/analytics-query.js';
import {Prisma} from '../dist/generated/prisma/client.js';
import {assessSla} from '../dist/requests/sla-clock.js';
import {customFrom,customTo,customQuery,seedAnalyticsFixture} from './helpers/analytics-v2-fixture.mjs';

const url=process.env.M13_DATABASE_URL;
if(!url||new URL(url).pathname!=='/mobiflow_m13_test'||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Dedicated M13 loopback synthetic DB required');
const env=parseApiEnvironment({...process.env,NODE_ENV:'test',DATABASE_URL:url,AI_AUTO_ANALYZE:'false',AI_RAG_ENABLED:'false',WEB_ORIGIN:'http://localhost:3000'});

test('M13 real PostgreSQL analytics, filters, RBAC, OpenAPI and synthetic performance gate',async t=>{
  const s=await createApplication(env,{quiet:true,aiWorker:false,knowledgeWorker:false,log:entry=>{if(entry.status===500)console.log(entry);}});await s.app.listen(0,'127.0.0.1');
  t.after(async()=>{await s.app.close();await s.database.close();await s.prisma.$disconnect();});
  const db=s.prisma,fixture=await seedAnalyticsFixture(db,{bulk:true}),base=await s.app.getUrl(),service=s.app.get(AnalyticsService);
  async function call(token,query='',path='/api/v1/analytics'){
    const response=await fetch(base+path+(query?'?'+(typeof query==='string'?query:new URLSearchParams(query)):''),{headers:token?{Authorization:'Bearer '+token}:{}});
    return {status:response.status,body:await response.json(),headers:response.headers};
  }
  async function login(email){const r=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.WEB_ORIGIN,'X-CSRF-Protection':'1'},body:JSON.stringify({email,password:'MobiFlowDemo!2026'})});assert.equal(r.status,200);return (await r.json()).data.accessToken;}
  const manager=await login('manager@mobiflow.local'),user=await login('user@mobiflow.local'),staff=await login('staff.iot@mobiflow.local');
  const get=async(query=customQuery)=>{const r=await call(manager,query);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.headers.get('cache-control'),'no-store');return analyticsResponseSchema.parse(r.body).data;};
  const checks=[];
  async function check(name,work){await t.test(name,async()=>{try{await work();checks.push({name,result:'PASS'});}catch(error){checks.push({name,result:'FAIL'});throw error;}});}
  await check('MANAGER 200, USER/STAFF 403 and unauthenticated 401 over direct HTTP',async()=>{
    for(const [token,status] of [[null,401],[user,403],[staff,403],[manager,200]])assert.equal((await call(token,customQuery)).status,status);
  });
  await check('invalid, duplicate, unexpected and conflicting filters are HTTP 400 with safe error',async()=>{
    for(const query of ['from=invalid&to=2026-03-04','from=2026-02-29&to=2026-03-04','from=2026-03-04&to=2026-03-01','from=2026-01-01&to=2027-01-02','from=2026-01-01','priority=BAD','status=BAD','category=BAD','teamId=BAD','preset=year','preset=7d&preset=30d','priority=HIGH&priority=LOW','preset=7d&windowDays=7','preset=7d&from=2026-03-01&to=2026-03-04','role=MANAGER','limit=1','cursor=forged','from=2026-03-01&to=2026-03-04&owner=forged','windowDays=0','windowDays=366','windowDays=abc']){
      const result=await call(manager,query);assert.equal(result.status,400,query);assert.equal(result.body.error.code,'INVALID_INPUT');assert.equal(/SELECT|Prisma|stack|PRIVATE_PAYLOAD_M13/.test(JSON.stringify(result.body)),false);
    }
  });
  let actual;
  await check('calendar period, created/status/priority distributions, distinct historical resolutions, closure and zero-filled trends',async()=>{
    actual=await get();assert.equal(actual.period.from,customFrom.toISOString());assert.equal(actual.period.to,customTo.toISOString());assert.equal(actual.period.timeZone,'Asia/Ho_Chi_Minh');assert.equal(actual.period.days,3);
    for(const key of ['createdCount','resolvedCount','closedCount'])assert.equal(actual.operations[key],fixture.expected[key]);assert.equal(actual.operations.requestVolume,7);
    assert.deepEqual(actual.operations.statusDistribution,Object.fromEntries(statuses.map(key=>[key,{NEW:1,CLOSED:2,RESOLVED:2,IN_PROGRESS:1,CANCELED:1}[key]??0])));
    assert.deepEqual(actual.operations.priorityDistribution,{LOW:3,MEDIUM:1,HIGH:2,URGENT:1});
    assert.deepEqual(actual.trends,[{date:'2026-03-01',createdCount:5,resolvedCount:1},{date:'2026-03-02',createdCount:1,resolvedCount:4},{date:'2026-03-03',createdCount:1,resolvedCount:2}]);
    assert.equal(actual.trends.reduce((sum,row)=>sum+row.resolvedCount,0),7); // repeated cycle on a different day, distinct over the period = 6.
    assert.equal(actual.reopen.reopenedRequestCount,2);assert.equal(actual.reopen.resolvedRequestCount,6);assert.equal(actual.reopen.reopenRate,2/6);
    const holes=await get({from:'2026-02-28',to:'2026-03-05'});assert.equal(holes.trends.length,5);assert.equal(holes.trends.at(-1).resolvedCount,0);
  });
  await check('resolution midnight boundaries, same-day cycles and older-cycle reopen attribution are isolated and correct',async()=>{
    const teamId=randomUUID(),requestIds=[],rollback=new Error('M13 temporary lifecycle fixtures rollback');
    const at=seconds=>new Date(customFrom.getTime()+seconds*1000);
    try{
      await db.$transaction(async tx=>{
        await tx.team.create({data:{id:teamId,code:'M13_BOUNDARY_'+teamId,name:'Synthetic temporary lifecycle team'}});
        const request=async(priority,resolvedAt)=>{
          const id=randomUUID();requestIds.push(id);
          return tx.request.create({data:{id,publicCode:'M13E-'+id.slice(0,24),createdById:fixture.owner.id,currentAssigneeId:fixture.staff.id,teamId,
            title:'Synthetic lifecycle boundary',description:'Temporary isolated analytics lifecycle fixture',status:'RESOLVED',priority,createdAt:at(-86400),resolvedAt}});
        };
        const resolution=async(r,cycle,resolvedAt,reopenedAt=null)=>{
          const event=await tx.auditLog.create({data:{requestId:r.id,actorType:'STAFF',actorId:fixture.staff.id,action:'RESOLVE',resourceType:'Request',resourceId:r.id,
            requestCorrelationId:randomUUID(),outcome:'SUCCEEDED',createdAt:resolvedAt}});
          const record=await tx.requestResolution.create({data:{requestId:r.id,cycle,resolvedById:fixture.staff.id,rootCause:'Synthetic root cause',resolution:'Synthetic resolution',
            verification:'Synthetic verification',resolvedAt,reopenedAt,eventId:event.id}});
          if(r.resolvedAt.getTime()===resolvedAt.getTime())await tx.request.update({where:{id:r.id},data:{currentResolutionId:record.id}});
        };
        const inclusive=await request('LOW',customFrom),exclusive=await request('MEDIUM',customTo),repeated=await request('HIGH',at(10800)),older=await request('URGENT',at(18000));
        await resolution(inclusive,1,customFrom);await resolution(exclusive,1,customTo);
        await resolution(repeated,1,at(3600),at(7200));await resolution(repeated,2,at(10800));
        await resolution(older,1,at(-3600),at(14400));await resolution(older,2,at(18000));
        const aggregate=async(priority)=>{
          const [row]=await tx.$queryRaw(analyticsQuery({...customQuery,teamId,...(priority?{priority}:{})},customTo));return row;
        };
        const from=await aggregate('LOW');assert.equal(from.operations.resolvedCount,1);assert.equal(from.trends[0].resolvedCount,1);
        const to=await aggregate('MEDIUM');assert.equal(to.operations.resolvedCount,0);assert.equal(to.reopen.resolvedRequestCount,0);assert.ok(to.trends.every(row=>row.resolvedCount===0));
        const sameDay=await aggregate('HIGH');assert.equal(sameDay.operations.resolvedCount,1);assert.equal(sameDay.trends[0].resolvedCount,1);
        assert.deepEqual(sameDay.reopen,{reopenedRequestCount:1,resolvedRequestCount:1,reopenRate:1});
        const priorCycle=await aggregate('URGENT');assert.equal(priorCycle.operations.resolvedCount,1);assert.equal(priorCycle.trends[0].resolvedCount,1);
        assert.deepEqual(priorCycle.reopen,{reopenedRequestCount:0,resolvedRequestCount:1,reopenRate:0});
        const combined=await aggregate();assert.equal(combined.operations.resolvedCount,3);
        assert.deepEqual(combined.trends,[{date:'2026-03-01',createdCount:0,resolvedCount:3},{date:'2026-03-02',createdCount:0,resolvedCount:0},{date:'2026-03-03',createdCount:0,resolvedCount:0}]);
        assert.deepEqual(combined.reopen,{reopenedRequestCount:1,resolvedRequestCount:3,reopenRate:1/3});
        // Deliberate rollback prevents temporary rows from changing shared fixture totals or performance evidence.
        throw rollback;
      },{timeout:15000});
    }catch(error){if(error!==rollback)throw error;}
    assert.equal(await db.team.findUnique({where:{id:teamId}}),null);
    assert.equal(await db.request.count({where:{id:{in:requestIds}}}),0);
    assert.equal(await db.requestResolution.count({where:{requestId:{in:requestIds}}}),0);
    assert.equal(await db.auditLog.count({where:{requestId:{in:requestIds}}}),0);
  });
  await check('M12 completion denominator, deadline equality, pause/hold exclusions, sticky breach and malformed/canceled/reopened exclusion',async()=>{
    for(const key of ['slaEligibleCount','slaMetCount','slaBreachedCount'])assert.equal(actual.sla[key],fixture.expected[key]);assert.equal(actual.sla.slaComplianceRate,1/3);
    assert.ok(Math.abs(actual.sla.averageResolutionSeconds-fixture.expected.averageResolutionSeconds)<1e-8);
    const completions=fixture.rows.filter(row=>[1,2,3].some(index=>row.publicCode.endsWith('-'+index)));
    const clocks=await db.slaInstance.findMany({where:{requestId:{in:completions.map(row=>row.id)}}});
    assert.equal(clocks.filter(clock=>assessSla(clock,new Date(actual.period.asOf)).status==='MET').length,1);
    const effective=clocks.map(clock=>assessSla(clock,new Date(actual.period.asOf)).elapsedSeconds);
    assert.ok(effective.includes(300)&&effective.includes(301));
    assert.ok(Math.abs(actual.sla.averageResolutionSeconds-effective.reduce((sum,n)=>sum+n,0)/3)<1e-8);
    assert.ok(actual.sla.averageWallClockResolutionSeconds>actual.sla.averageResolutionSeconds);
  });
  await check('immutable feedback scores, real manager decisions and all six Copilot actions with pending/canceled/unclassified totals',async()=>{
    assert.deepEqual(actual.feedback,{feedbackCount:2,averageFeedbackScore:4,feedbackDistribution:{'1':0,'2':0,'3':1,'4':0,'5':1}});
    assert.deepEqual(actual.ai.recommendations,{generated:4,accepted:1,modified:1,rejected:1,denominator:3,acceptanceRate:1/3,modificationRate:1/3,rejectionRate:1/3});
    assert.equal(actual.copilot.copilotRuns,10);assert.equal(actual.copilot.successfulCopilotRuns,7);assert.equal(actual.copilot.failedCopilotRuns,1);assert.equal(actual.copilot.canceledCopilotRuns,1);assert.equal(actual.copilot.pendingCopilotRuns,1);assert.equal(actual.copilot.unclassifiedRuns,1);
    const actions=actual.copilot.copilotRunsByAction;assert.equal(actions.length,6);assert.equal(actions.find(row=>row.action==='FIND_SOP').runs,3);assert.equal(actions.find(row=>row.action==='SUMMARIZE_REQUEST').pending,1);
    assert.equal(actions.reduce((sum,row)=>sum+row.runs,0)+actual.copilot.unclassifiedRuns,10);
    assert.equal(actual.ai.runs.total,14);assert.equal(actual.ai.runs.succeeded,11);assert.equal(actual.ai.runs.failed,1);assert.equal(actual.ai.runs.p50LatencyMs,100);
  });
  await check('server filter intersection, single row and zero denominator samples',async()=>{
    const single=await get({...customQuery,from:'2026-03-03',priority:'LOW',status:'CLOSED',category:'NETWORK',teamId:fixture.team.id});
    assert.equal(single.operations.createdCount,1);assert.equal(single.operations.resolvedCount,1);assert.equal(single.sla.slaEligibleCount,0);assert.equal(single.sla.slaComplianceRate,null);assert.equal(single.sla.averageResolutionSeconds,null);assert.equal(single.feedback.averageFeedbackScore,null);assert.equal(single.ai.recommendations.acceptanceRate,null);
    for(const priority of priorities){const result=await get({...customQuery,priority});assert.equal(result.operations.createdCount,actual.operations.priorityDistribution[priority]);assert.equal(Object.entries(result.operations.priorityDistribution).filter(([key,value])=>key!==priority&&value).length,0);}
    assert.equal((await get({...customQuery,category:'BILLING'})).operations.createdCount,0);
    const filtered=await get({...customQuery,priority:'HIGH',status:'CLOSED',teamId:fixture.team.id});assert.equal(filtered.operations.createdCount,1);assert.equal(filtered.operations.resolvedCount,2);assert.equal(filtered.ai.recommendations.denominator,2);
  });
  await check('empty period has zeros and null rates/averages; missing days are zero-filled',async()=>{
    const empty=await get({from:'2040-01-01',to:'2040-01-08'});assert.equal(empty.operations.createdCount,0);assert.equal(empty.operations.resolvedCount,0);assert.equal(empty.sla.slaComplianceRate,null);assert.equal(empty.reopen.reopenRate,null);assert.equal(empty.feedback.averageFeedbackScore,null);assert.equal(empty.ai.recommendations.acceptanceRate,null);assert.equal(empty.ai.runs.p50LatencyMs,null);assert.equal(empty.copilot.copilotRuns,0);assert.equal(empty.trends.length,7);assert.ok(empty.trends.every(row=>row.createdCount===0&&row.resolvedCount===0));
  });
  await check('7/30/90 presets resolve in SQL; legacy alias and host/session timezone independence',async()=>{
    const counts=[];for(const days of [7,30,90]){const result=await get({preset:days+'d'});assert.equal(result.period.days,days);assert.equal(result.trends.length,days);assert.equal(new Date(result.period.to).getUTCHours(),17);counts.push(result.operations.createdCount);}
    assert.ok(counts[0]<counts[1]&&counts[1]<counts[2]);assert.deepEqual((await get({windowDays:'30'})).operations,(await get({preset:'30d'})).operations);
    await db.$transaction(async tx=>{await tx.$executeRaw`SET LOCAL TIME ZONE 'America/New_York'`;const [row]=await tx.$queryRaw(analyticsQuery(customQuery));assert.equal(row.from,customFrom.toISOString());assert.equal(row.to,customTo.toISOString());assert.deepEqual(row.trends,actual.trends);});
    const march=await service.dashboard(fixture.manager,{preset:'7d'},new Date('2026-03-03T17:00:00Z'));assert.equal(march.period.toDate,'2026-03-05');assert.equal(march.period.fromDate,'2026-02-26');
  });
  await check('no PII, prompts, raw records or results and no analytics-induced writes',async()=>{
    const serialized=JSON.stringify(actual);for(const text of ['PRIVATE_PAYLOAD_M13','PRIVATE_FEEDBACK_M13','passwordHash','safeResultJson','retrievalSnapshotJson','reasonSummary','publicCode','createdById'])assert.equal(serialized.includes(text),false,text);
    const before={history:await db.requestStatusHistory.count(),audit:await db.auditLog.count(),notifications:await db.notification.count()};await get();assert.deepEqual({history:await db.requestStatusHistory.count(),audit:await db.auditLog.count(),notifications:await db.notification.count()},before);
  });
  await check('OpenAPI operation, security, all query/response schemas and internal references are valid',async()=>{
    const doc=(await call(null,'','/api/docs-json')).body,op=doc.paths['/api/v1/analytics'].get;assert.equal(op.operationId,'getManagerAnalytics');assert.ok(op.security.some(item=>'bearer' in item));
    assert.deepEqual(op.parameters.map(item=>item.name).sort(),['category','from','preset','priority','status','teamId','to','windowDays']);for(const code of [200,400,401,403,429,500])assert.ok(op.responses[code]);
    const response=op.responses['200'].content['application/json'].schema;assert.ok(response.properties.data.properties.period);assert.ok(response.properties.data.properties.copilot);assert.ok(response.properties.data.properties.sla.properties.slaComplianceRate);
    const refs=[];const visit=value=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key==='$ref')refs.push(item);else visit(item);}};visit(doc);
    for(const ref of refs){assert.ok(ref.startsWith('#/'));assert.ok(ref.slice(2).split('/').reduce((value,key)=>value?.[key.replaceAll('~1','/').replaceAll('~0','~')],doc));}
  });
  const bulkQuery={from:'2030-01-01',to:'2030-01-02'},samples=[];let aggregateStatements=0,managerReads=0;
  await check('5,101-row metrics remain uncapped and one aggregate query handles the entire range',async()=>{
    const counted=new AnalyticsService({user:{findFirst:async input=>{managerReads++;return db.user.findFirst(input);}},$queryRaw:async query=>{aggregateStatements++;return db.$queryRaw(query);}});
    const result=await counted.dashboard(fixture.manager,bulkQuery);assert.equal(aggregateStatements,1);assert.equal(managerReads,1);
    for(const key of ['createdCount','resolvedCount','closedCount'])assert.equal(result.operations[key],5101);assert.equal(result.sla.slaEligibleCount,5101);assert.equal(result.sla.slaComplianceRate,1);assert.equal(result.sla.averageResolutionSeconds,300);assert.equal(result.feedback.feedbackCount,5101);assert.equal(result.feedback.averageFeedbackScore,4);assert.equal(result.ai.recommendations.generated,5101);assert.equal(result.ai.recommendations.modified,5101);assert.equal(result.ai.runs.total,5101);
    for(let i=0;i<11;i++){const start=performance.now();await get(bulkQuery);samples.push(Number((performance.now()-start).toFixed(3)));}
  });
  const [plan]=await db.$queryRaw(Prisma.sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${analyticsQuery(bulkQuery)}`),explain=plan['QUERY PLAN'][0];
  const sorted=[...samples].sort((a,b)=>a-b),migrations=(await db.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)[0].count;assert.equal(migrations,6);
  const evidence={checkedAt:new Date().toISOString(),result:checks.every(check=>check.result==='PASS')?'PASS':'FAIL',database:'mobiflow_m13_test',migrations,checks,synthetic:true,requestRows:await db.request.count(),runRows:await db.aiRun.count(),bulkCohort:5101,aggregateStatements,managerIdentityReads:managerReads,authQueriesIncluded:false,responseMs:samples,medianResponseMs:sorted[5],sql:{planningMs:explain['Planning Time'],executionMs:explain['Execution Time'],sharedHitBlocks:explain.Plan['Shared Hit Blocks']},customMetrics:{operations:actual.operations,sla:actual.sla,reopen:actual.reopen,feedback:actual.feedback,decisions:actual.ai.recommendations,copilot:actual.copilot},limitations:'Local single-client synthetic sample; not load/enterprise/model-quality evidence.'};
  mkdirSync('artifacts/m13',{recursive:true});writeFileSync('artifacts/m13/sql-plan.json',JSON.stringify(explain,null,2));mkdirSync('docs/v1.2/evidence',{recursive:true});writeFileSync('docs/v1.2/evidence/M13_DATABASE.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({...evidence,customMetrics:'docs/v1.2/evidence/M13_DATABASE.json'}));
});
