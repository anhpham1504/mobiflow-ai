import type {HistoryEvent,RequestStatus} from '@mobiflow/contracts';
import {Clock3,History,UserRound} from 'lucide-react';
import {chronologicalEvents,splitAuditEvents} from '@/lib/audit-presentation';
import {actorLabels,eventLabels} from '@/lib/presentation-labels';
import {formatTime,statusLabels} from './request-list';
import {StatusBadge} from './ui/patterns';

export function AuditTimeline({events,status,hasOlder,onLoadOlder}:{events:HistoryEvent[];status:RequestStatus;hasOlder:boolean;onLoadOlder:()=>void}){
  const {business,technical}=splitAuditEvents(events),chronological=chronologicalEvents(business),newestId=business.at(-1)?.id;
  return <section className="workflow-card audit-timeline" id="request-timeline" tabIndex={-1} aria-labelledby="request-timeline-title">
    <div className="audit-timeline-heading"><div><h2 id="request-timeline-title"><History size={19} aria-hidden="true"/>Dòng thời gian kiểm soát</h2><p>Các sự kiện nghiệp vụ đã ghi nhận, từ tiếp nhận đến trạng thái hiện tại.</p></div><StatusBadge status={status} label={statusLabels[status]??status}/></div>
    {chronological.length?<ol className="timeline timeline-audit">{chronological.map(event=>{
      const current=event.id===newestId;
      return <li key={event.id} className={current?'is-current':undefined}>
        <div className="timeline-event-heading"><div><time dateTime={event.createdAt}><Clock3 size={14} aria-hidden="true"/>{formatTime(event.createdAt)}</time><span><UserRound size={14} aria-hidden="true"/>{actorLabels[event.actorType]}</span></div>{current?<span className="badge badge-info">Mới nhất</span>:null}</div>
        <strong>{eventLabels[event.action]??'Hoạt động được ghi nhận'}</strong>
        {event.histories.map((item,index)=><p className="timeline-transition" key={index}>{item.fromStatus?<><span>{statusLabels[item.fromStatus]}</span><span aria-hidden="true">→</span></>:null}<strong>{statusLabels[item.toStatus]}</strong></p>)}
        {event.resolutions.map((resolution,index)=><div className="timeline-event-detail" key={index}><p><strong>Kết quả xử lý lần {resolution.cycle}</strong></p><p>Nguyên nhân: {resolution.rootCause}</p><p>Khắc phục: {resolution.resolution}</p><p>Kiểm chứng: {resolution.verification}</p></div>)}
        {event.messages.map((message,index)=><p className="timeline-event-detail preserve-text" key={index}>{message.body}</p>)}
        {!eventLabels[event.action]?<details className="event-code"><summary>Chi tiết kỹ thuật</summary><code>{event.action}</code></details>:null}
      </li>;
    })}</ol>:<p className="audit-timeline-empty">Chưa có sự kiện nghiệp vụ nào được ghi nhận.</p>}
    {technical.length?<details className="technical-audit"><summary>Chi tiết kỹ thuật · {technical.length} sự kiện</summary><ol>{chronologicalEvents(technical).map(event=><li key={event.id}><time dateTime={event.createdAt}>{formatTime(event.createdAt)}</time><strong>{eventLabels[event.action]??event.action}</strong><span>{actorLabels[event.actorType]}</span></li>)}</ol></details>:null}
    {hasOlder?<button className="button button-secondary" onClick={onLoadOlder}>Tải sự kiện cũ hơn</button>:<p className="audit-timeline-end">Đã hiển thị toàn bộ lịch sử khả dụng.</p>}
  </section>;
}
