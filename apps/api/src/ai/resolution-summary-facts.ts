import {z} from 'zod';
import {AiFailure} from './provider.js';
import {summaryModelSchema} from './operational-output.js';

// Only public business events enter a customer-visible resolution summary.
// A completed classification is advisory; it never establishes a root cause.
export const summaryEventLabels:Record<string,string>={
  CREATE:'Người dùng đã gửi yêu cầu.',
  START_AI_ANALYSIS:'AI bắt đầu phân tích dữ kiện được cung cấp.',
  COMPLETE_AI_ANALYSIS:'AI đã ghi nhận phân loại và đề xuất ưu tiên; chưa xác minh nguyên nhân.',
  MANUAL_TRIAGE:'Quản lý đã ghi nhận phân loại thủ công.',
  SUBMIT_FOR_APPROVAL:'Phương án đã được gửi chờ quản lý duyệt.',
  APPROVE_AND_ASSIGN:'Quản lý đã duyệt và phân công xử lý.',
  REJECT_APPROVAL:'Quản lý đã từ chối phương án.',
  REASSIGN:'Quản lý đã thay đổi phân công.',
  PRIORITY:'Quản lý đã thay đổi độ ưu tiên.',
  START_WORK:'Nhân viên đã ghi nhận bắt đầu xử lý.',
  REQUEST_USER_INFO:'Nhân viên đã yêu cầu người dùng bổ sung thông tin.',
  USER_PROVIDE_INFO:'Người dùng đã gửi thông tin bổ sung.',
  MESSAGE:'Đã lưu trao đổi về yêu cầu.',
  CHECKLIST_ADD:'Đã lưu các mục checklist.',
  CHECKLIST_EDIT:'Đã cập nhật bản ghi checklist.',
  RESOLVE:'Nhân viên đã gửi bản ghi nguyên nhân, xử lý và kiểm chứng.',
  USER_REOPEN:'Người dùng đã yêu cầu xử lý lại.',
};
const actorRoles:Record<string,string[]>={CREATE:['USER'],START_AI_ANALYSIS:['SYSTEM'],COMPLETE_AI_ANALYSIS:['SYSTEM','AI'],MANUAL_TRIAGE:['MANAGER'],SUBMIT_FOR_APPROVAL:['MANAGER','SYSTEM'],APPROVE_AND_ASSIGN:['MANAGER'],REJECT_APPROVAL:['MANAGER'],REASSIGN:['MANAGER'],PRIORITY:['MANAGER'],START_WORK:['STAFF'],REQUEST_USER_INFO:['STAFF'],USER_PROVIDE_INFO:['USER'],CHECKLIST_ADD:['STAFF'],CHECKLIST_EDIT:['STAFF'],RESOLVE:['STAFF'],USER_REOPEN:['USER']};
type Event={eventId:string;action:string;at:string;actorType?:string};
export type SummaryFacts={executiveSummary:string;events:(Event&{summary:string})[]};
export function resolutionSummaryFacts(resolution:{rootCause:string;resolution:string;verification:string},events:Event[]):SummaryFacts{
  // Copy whole, attributed fields within the existing presentation bound. Longer
  // facts remain available verbatim in the staff resolution, never truncated into
  // a different claim or replaced with a model-inferred conclusion.
  let executiveSummary='Theo bản ghi xử lý do nhân viên gửi:';
  for(const [label,value] of [['Nguyên nhân',resolution.rootCause],['Xử lý',resolution.resolution],['Kiểm chứng',resolution.verification]]){
    const next=` ${label}: ${JSON.stringify(value)}.`;
    if(executiveSummary.length+next.length+68<=800)executiveSummary+=next;
  }
  executiveSummary+=' Chi tiết nguyên văn nằm trong bản ghi xử lý của nhân viên.';
  const publicEvents=events.filter(event=>Object.hasOwn(summaryEventLabels,event.action));
  if(publicEvents.some((event,i)=>!Number.isFinite(Date.parse(event.at))||(i>0&&Date.parse(event.at)<Date.parse(publicEvents[i-1]!.at))||(event.actorType&&actorRoles[event.action]&&!actorRoles[event.action]!.includes(event.actorType)))||new Set(publicEvents.map(event=>event.eventId)).size!==publicEvents.length)throw new AiFailure('SUMMARY_FACTS_INCONSISTENT');
  const names:Record<string,string>={USER:'Người dùng',STAFF:'Nhân viên',MANAGER:'Quản lý'};
  return {executiveSummary,events:publicEvents.map(event=>({...event,summary:event.action==='MESSAGE'&&event.actorType&&names[event.actorType]?`${names[event.actorType]} đã gửi trao đổi về yêu cầu.`:summaryEventLabels[event.action]!}))};
}
export function summaryFactsFormat(facts:SummaryFacts){
  if(!facts.events.length)throw new AiFailure('SUMMARY_FACTS_UNAVAILABLE');
  const items=facts.events.map(event=>z.object({eventId:z.literal(event.eventId),summary:z.literal(event.summary)}).strict());
  return z.toJSONSchema(z.object({executiveSummary:z.literal(facts.executiveSummary),timeline:z.array(items.length===1?items[0]!:z.union(items)).min(1).max(8)}).strict(),{target:'draft-7'});
}
export function validateSummaryFacts(output:z.infer<typeof summaryModelSchema>,facts:SummaryFacts,raw:string){
  const fail=(category:string):never=>{throw new AiFailure('INVALID_REFERENCE',true,`${category}: Use the exact supplied factual text and event order.`,raw.slice(0,6000));};
  if(output.executiveSummary!==facts.executiveSummary)fail('SUMMARY_FACT_MISMATCH');
  const indices=output.timeline.map(item=>{
    const index=facts.events.findIndex(event=>event.eventId===item.eventId);
    if(index<0)fail('EVENT_MEMBERSHIP');
    if(item.summary!==facts.events[index]!.summary)fail('EVENT_FACT_MISMATCH');
    return index;
  });
  if(indices.some((index,i)=>i>0&&index<=indices[i-1]!))fail('EVENT_ORDER');
}
