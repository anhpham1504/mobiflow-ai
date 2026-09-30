import type {RequestView} from '@mobiflow/contracts';

// Presentation only: the backend state is authoritative; no client risk threshold.
export function slaPresentation(sla:NonNullable<RequestView['sla']>){
  const labels={SAFE:'Trong thời hạn',AT_RISK:'Nguy cơ quá SLA',BREACHED:'Quá SLA',PAUSED:'Tạm dừng SLA',MET:'Hoàn thành trong SLA'};
  const tones={SAFE:'success',AT_RISK:'warning',BREACHED:'danger',PAUSED:'neutral',MET:'success'};
  const label=labels[sla.state],tone=tones[sla.state];
  if(sla.stopReason==='CANCELED')return {tone,text:'Đã dừng',label:label+' trước khi hủy'};
  if(sla.state==='PAUSED')return {tone,text:'Đang tạm dừng',label:sla.breachedAt?'Tạm dừng · từng quá SLA':label};
  if(sla.state==='MET')return {tone,text:label,label:sla.stopReason==='CLOSED'?'Đã xác nhận':'Chờ xác nhận'};
  if(sla.state==='BREACHED')return {tone,text:sla.breachedBySeconds>0?`Quá hạn ${Math.ceil(sla.breachedBySeconds/60)} phút`:'Từng quá hạn',label};
  return {tone,text:`Còn ${Math.ceil(Math.max(0,sla.remainingSeconds)/60)} phút`,label};
}
