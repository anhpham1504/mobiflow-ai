'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {CheckCircle2,Clock3,FileText,ShieldCheck} from 'lucide-react';
import {createRequestSchema,requestResponseSchema,type RequestView} from '@mobiflow/contracts';
import {api,requestLink} from '@/lib/session';
import {SessionGate} from './session-shell';
import {PageHeader,PriorityBadge,SlaIndicator,StatusBadge} from './ui/patterns';
import {fieldErrors,focusFirstInvalid,type FieldErrors} from '@/lib/form-errors';
import {statusLabels} from '@/lib/presentation-labels';
export {statusLabels} from '@/lib/presentation-labels';
export const formatTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
export {RequestList} from './request-list-content';
export function RequestCollection({rows,role}:{rows:RequestView[];role:'USER'|'STAFF'|'MANAGER'}){return <><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Mã / Yêu cầu</th><th>Trạng thái</th><th>Ưu tiên</th><th>Phụ trách</th><th>SLA</th><th>Cập nhật</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><Link className="request-title" href={requestLink(role,r.id)}>{r.title}<small>{r.publicCode}</small></Link></td><td><StatusBadge status={r.status} label={statusLabels[r.status]??r.status}/></td><td><PriorityBadge priority={r.priority}/></td><td>{r.currentAssignee?.displayName??'Chưa phân công'}</td><td><SlaIndicator sla={r.sla}/></td><td>{formatTime(r.updatedAt??r.createdAt)}</td></tr>)}</tbody></table></div><div className="request-cards">{rows.map(r=><article className="request-card" key={r.id}><div className="request-card-top"><small>{r.publicCode}</small><StatusBadge status={r.status} label={statusLabels[r.status]??r.status}/></div><h2><Link className="request-title" href={requestLink(role,r.id)}>{r.title}</Link></h2><dl><dt>Ưu tiên</dt><dd><PriorityBadge priority={r.priority}/></dd><dt>Phụ trách</dt><dd>{r.currentAssignee?.displayName??'Chưa phân công'}</dd><dt>SLA</dt><dd><SlaIndicator sla={r.sla}/></dd></dl><footer>Cập nhật {formatTime(r.updatedAt??r.createdAt)}</footer></article>)}</div></>}
export function CreateRequest(){
  const [error,setError]=useState(''),[invalid,setInvalid]=useState<FieldErrors>({}),[busy,setBusy]=useState(false),[description,setDescription]=useState(''),router=useRouter();
  return <SessionGate role="USER"><div className="create-request-page"><PageHeader title="Tạo yêu cầu mới" description="Cung cấp bối cảnh bạn đang có. Bộ phận phụ trách sẽ tiếp nhận và phối hợp các bước tiếp theo."/><div className="create-request-layout">
    <form className="workflow-card request-create-form" onSubmit={async e=>{
      e.preventDefault();if(busy)return;
      const form=e.currentTarget,f=new FormData(form),payload={description:String(f.get('description')),...(f.get('title')?{title:String(f.get('title'))}:{})};
      const parsed=createRequestSchema.safeParse(payload);
      if(!parsed.success){const errors=fieldErrors(parsed.error.issues,{title:'Tiêu đề cần từ 1 đến 160 ký tự nếu được nhập.',description:'Mô tả cần từ 10 đến 10.000 ký tự.'});setInvalid(errors);setError('');focusFirstInvalid(form,errors);return;}
      setInvalid({});setBusy(true);setError('');
      try{const r=await api('/requests',requestResponseSchema,parsed.data);router.push('/user/requests/'+r.data.id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
    }}>
      <div className="request-form-heading"><div><h2>Thông tin yêu cầu</h2><p>Chỉ mô tả những gì bạn quan sát được; không cần tự xác định nguyên nhân.</p></div><FileText size={22} aria-hidden="true"/></div>
      <label><span className="field-label">Tiêu đề <span className="optional-label">Không bắt buộc</span></span><input name="title" data-error-field="title" aria-invalid={!!invalid.title} aria-describedby={invalid.title?'request-title-error':undefined} maxLength={160} placeholder="Ví dụ: 17 SIM IoT mất kết nối"/></label>
      {invalid.title?<p id="request-title-error" className="field-error" role="alert">{invalid.title}</p>:null}
      <label htmlFor="request-description">Mô tả yêu cầu<textarea id="request-description" data-error-field="description" aria-invalid={!!invalid.description} aria-describedby={'request-description-hint request-description-count'+(invalid.description?' request-description-error':'')} name="description" minLength={10} maxLength={10000} required rows={10} value={description} onChange={event=>setDescription(event.target.value)} placeholder="Mô tả sự việc đang xảy ra, thời điểm bắt đầu, phạm vi ảnh hưởng và các biểu hiện bạn quan sát được."/><span className="field-meta"><span id="request-description-hint">Tối thiểu 10 ký tự. Không nhập mật khẩu hoặc thông tin bí mật.</span><span id="request-description-count">{description.length.toLocaleString('vi-VN')}/10.000</span></span></label>
      {invalid.description?<p id="request-description-error" className="field-error" role="alert">{invalid.description}</p>:null}
      {error?<p role="alert" className="form-error">{error}</p>:null}
      <div className="request-form-actions"><Link className="button button-secondary" href="/user/requests">Quay lại</Link><button type="submit" className="button button-primary" disabled={busy}>{busy?'Đang gửi…':'Gửi yêu cầu'}</button></div>
    </form>
    <aside className="request-create-guide" aria-label="Hướng dẫn tạo yêu cầu"><section className="workflow-card request-guide-card"><h2>Mô tả để được hỗ trợ nhanh hơn</h2><ul><li><Clock3 size={18} aria-hidden="true"/><span><strong>Thời điểm</strong><small>Vấn đề bắt đầu khi nào, còn tiếp diễn hay không?</small></span></li><li><ShieldCheck size={18} aria-hidden="true"/><span><strong>Phạm vi ảnh hưởng</strong><small>Dịch vụ, địa điểm hoặc số lượng đối tượng bị ảnh hưởng.</small></span></li><li><CheckCircle2 size={18} aria-hidden="true"/><span><strong>Biểu hiện thực tế</strong><small>Thông báo lỗi, hành vi bất thường và bước đã thử.</small></span></li></ul></section><section className="request-next-step"><h2>Sau khi gửi</h2><p>Yêu cầu được ghi nhận ngay. AI có thể hỗ trợ trích xuất dữ kiện khi khả dụng, nhưng người phụ trách vẫn kiểm tra và quyết định cách xử lý.</p></section></aside>
  </div></div></SessionGate>;
}
