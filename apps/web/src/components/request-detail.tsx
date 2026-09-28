'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {requestResponseSchema,historyResponseSchema,staffDirectorySchema,finalDecisionSchema,taxonomy,categories,priorities,type RequestView,type HistoryEvent,type StaffOption,type FinalDecision} from '@mobiflow/contracts';
import {api,ApiFailure,getProfile,serverProfile,subscribe} from '@/lib/session';
import {SessionGate} from './session-shell';
import {formatTime,statusLabels} from './request-list';
const eventLabels:Record<string,string>={CREATE:'Tiếp nhận yêu cầu',MANUAL_TRIAGE:'Phân loại thủ công',SUBMIT_FOR_APPROVAL:'Gửi phương án để duyệt',APPROVE_AND_ASSIGN:'Duyệt và phân công',REJECT_APPROVAL:'Từ chối phương án',START_WORK:'Bắt đầu xử lý',REQUEST_USER_INFO:'Yêu cầu bổ sung thông tin',USER_PROVIDE_INFO:'Người gửi đã bổ sung',RESOLVE:'Hoàn tất xử lý',USER_REOPEN:'Yêu cầu xử lý lại',USER_CONFIRM:'Xác nhận và đóng',CANCEL:'Hủy yêu cầu',REASSIGN:'Phân công lại',PRIORITY:'Đổi ưu tiên',MESSAGE:'Tin nhắn',CHECKLIST_ADD:'Thêm bước xử lý',CHECKLIST_EDIT:'Cập nhật checklist'};

type Field={name:string;label:string;min?:number;max?:number};
function ActionForm({title,fields=[],run,disabled,button=title}:{title:string;fields?:Field[];run:(values:Record<string,string>)=>Promise<boolean>;disabled:boolean;button?:string}){
  return <form className="action-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;if(await run(Object.fromEntries(new FormData(form)) as Record<string,string>))form.reset();}}>
    <fieldset disabled={disabled}><legend>{title}</legend>{fields.map(f=><label key={f.name}>{f.label}<textarea name={f.name} required minLength={f.min??1} maxLength={f.max??2000} rows={3}/></label>)}<button>{button}</button></fieldset>
  </form>;
}
function ManagerPlan({request,staff,run,disabled}:{request:RequestView;staff:StaffOption[];run:(suffix:string,body:unknown)=>Promise<boolean>;disabled:boolean}){
  const [category,setCategory]=useState<keyof typeof taxonomy>((request.manualDraft?.category??'NETWORK') as keyof typeof taxonomy);
  const draft=request.manualDraft;
  const [validation,setValidation]=useState('');
  return <form className="action-form" onSubmit={async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget),selected=String(f.get('assignment')).split('|');
    const decision={category,subcategory:String(f.get('subcategory')),priority:String(f.get('priority')),teamId:selected[0],staffId:selected[1],actions:String(f.get('actions')).split('\n').map(s=>s.trim()).filter(Boolean).map(text=>({text,required:true,sourceIds:[],provenance:'HUMAN'})),acknowledgedMissingFields:[],reason:String(f.get('reason'))};
    const checked=finalDecisionSchema.safeParse(decision);if(!checked.success){setValidation('Kiểm tra nhóm/phân loại, nhân sự, tối đa 30 bước (500 ký tự/bước) và lý do.');return;}
    setValidation('');await run('triage',{finalDecision:checked.data});
  }}><fieldset disabled={disabled}><legend>Chuẩn bị phân loại thủ công</legend>
    <p>Đây là bản nháp. Phân công và ưu tiên chỉ có hiệu lực sau khi gửi duyệt và xác nhận duyệt.</p>
    <label>Nhóm vấn đề<select value={category} onChange={e=>setCategory(e.target.value as keyof typeof taxonomy)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Phân loại chi tiết<select name="subcategory" key={category} defaultValue={draft?.category===category?draft.subcategory:taxonomy[category][0]}>{taxonomy[category].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Ưu tiên đề xuất<select name="priority" defaultValue={draft?.priority??'MEDIUM'}>{priorities.map(p=><option key={p}>{p}</option>)}</select></label>
    <label>Nhóm / Nhân sự xử lý<select name="assignment" required defaultValue={draft?draft.teamId+'|'+draft.staffId:''}><option value="">Chọn nhân sự đủ điều kiện</option>{staff.filter(s=>s.available).flatMap(s=>s.teams.map(t=><option key={t.id+s.id} value={t.id+'|'+s.id}>{t.name} / {s.displayName}</option>))}</select></label>
    <label>Các bước xử lý (mỗi dòng một bước bắt buộc)<textarea name="actions" rows={4} defaultValue={draft?.actions.map(a=>a.text).join('\n')??''}/></label>
    <label>Lý do phương án / lý do để trống checklist<textarea name="reason" required maxLength={2000} defaultValue={draft?.reason??''}/></label>
    {validation?<p role="alert">{validation}</p>:null}<button>Lưu bản nháp</button>
  </fieldset></form>;
}
export function RequestDetail({id,role}:{id:string;role:'USER'|'STAFF'|'MANAGER'}){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile);
  const [request,setRequest]=useState<RequestView|null>(null),[events,setEvents]=useState<HistoryEvent[]>([]),[staff,setStaff]=useState<StaffOption[]>([]),[historyNext,setHistoryNext]=useState<string|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[revision,setRevision]=useState(0),[notice,setNotice]=useState('');
  useEffect(()=>{
    if(!user||user.role!==role)return;let active=true;const controller=new AbortController();
    const jobs=[api('/requests/'+id,requestResponseSchema,undefined,'GET',controller.signal),api('/requests/'+id+'/history',historyResponseSchema,undefined,'GET',controller.signal)] as const;
    void Promise.all(jobs).then(([r,h])=>{if(active){setRequest(r.data);setEvents(h.data);setHistoryNext(h.page.nextCursor);setError('');setStale(false);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    if(role==='MANAGER')void api('/users/staff',staffDirectorySchema,undefined,'GET',controller.signal).then(r=>{if(active)setStaff(r.data);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;controller.abort();};
  },[id,user,role,revision]);
  const reload=()=>{setLoading(true);setRevision(v=>v+1);};
  async function mutate(path:string,body:unknown={},method='POST') {
    if(!request||busy||stale)return false;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await api(path,requestResponseSchema,{...(body as Record<string,unknown>),expectedVersion:request.version},method);
      setRequest(result.data);setNotice('Đã lưu thay đổi.');
      const h=await api('/requests/'+id+'/history',historyResponseSchema);setEvents(h.data);setHistoryNext(h.page.nextCursor);
      return true;
    }catch(e){setError((e as Error).message);if(e instanceof ApiFailure&&e.status===409)setStale(true);return false;}
    finally{setBusy(false);}
  }
  const action=(suffix:string,body:unknown={})=>mutate('/requests/'+id+'/'+suffix,body);
  const managerAction=(suffix:string,body:unknown)=>mutate('/manager/requests/'+id+'/'+suffix,body);
  const reviewBody=request?{reviewKind:'MANUAL',manualDraftRevision:request.pendingDraftRevision}:{};
  const disabled=busy||stale;
  const reason=[{name:'reason',label:'Lý do'}];
  return <SessionGate role={role}>
    {loading?<p role="status">Đang tải yêu cầu…</p>:null}
    {error?<div role="alert" className="form-error">{error}<button onClick={reload}>Tải lại dữ liệu</button></div>:null}
    {notice?<p role="status" className="success-notice">{notice}</p>:null}
    {!loading&&request?<><div className="workflow-heading"><div><p className="eyebrow">{request.publicCode}</p><h1>{request.title}</h1><span className="status-pill">{statusLabels[request.status]} · {request.priority}</span></div><button onClick={reload} disabled={busy}>Tải lại</button></div>
      <div className="detail-grid"><section className="workflow-card"><h2>Nội dung yêu cầu</h2><p className="preserve-text">{request.description}</p><p>Phân công: {request.currentAssignee?.displayName??'Chưa phân công'}</p><p>Nhóm vấn đề đã duyệt: {request.category??'Chưa duyệt'} {request.subcategory??''}</p><p>Tiếp nhận: {formatTime(request.createdAt)}</p></section>
      <section className="workflow-card"><h2>Thời hạn xử lý</h2>{request.sla?<><p><strong>{request.sla.status}</strong> · {request.sla.stopReason==='CLOSED'?'Đã hoàn tất và xác nhận':request.sla.stopReason==='CANCELED'?'Đã dừng do hủy':request.sla.pausedAt?'Tạm dừng: chờ bạn bổ sung':request.sla.resolvedHoldAt?'Dừng đếm: chờ xác nhận':'Đang tính thời gian xử lý'}</p><p>Hạn dự kiến: {formatTime(request.sla.dueAt)}</p><p>Ngân sách còn lại tại lần tải: {Math.ceil(request.sla.remainingSeconds/60)} phút</p>{request.sla.breachedAt?<p>Đã ghi nhận quá hạn: {formatTime(request.sla.breachedAt)}</p>:null}</>:<p>SLA bắt đầu sau lần phân công đầu tiên.</p>}</section></div>
      {request.currentResolution?<section className="workflow-card"><h2>Kết quả xử lý lần {request.currentResolution.cycle}</h2><h3>Nguyên nhân</h3><p>{request.currentResolution.rootCause}</p><h3>Khắc phục</h3><p>{request.currentResolution.resolution}</p><h3>Kiểm chứng</h3><p>{request.currentResolution.verification}</p></section>:null}
      <section className="workflow-card"><h2>Thao tác</h2>{stale?<p>Hãy tải lại dữ liệu trước khi thực hiện thao tác tiếp.</p>:null}
      {role==='MANAGER'&&['NEW','TRIAGED'].includes(request.status)?<ManagerPlan key={id+':'+request.manualDraftRevision} request={request} staff={staff} run={managerAction} disabled={disabled}/>:null}
      {role==='MANAGER'&&request.status==='TRIAGED'&&request.manualDraft?<ActionForm title="Gửi duyệt phương án" disabled={disabled} run={()=>managerAction('submit-approval',{manualDraftRevision:request.manualDraftRevision})}/>:null}
      {role==='MANAGER'&&request.status==='PENDING_APPROVAL'&&request.manualDraft?<><ManualReview draft={request.manualDraft} staff={staff}/><ActionForm title="Duyệt và phân công" disabled={disabled} run={()=>mutate('/manager/approvals/'+id+'/accept',{...reviewBody,acknowledgedMissingFields:request.manualDraft!.acknowledgedMissingFields})}/><ActionForm title="Từ chối phương án" fields={reason} disabled={disabled} run={values=>mutate('/manager/approvals/'+id+'/reject',{...reviewBody,...values})}/></>:null}
      {role==='STAFF'&&request.status==='ASSIGNED'?<ActionForm title="Bắt đầu xử lý" disabled={disabled} run={()=>action('start')}/>:null}
      {role==='STAFF'&&request.status==='IN_PROGRESS'?<><ActionForm title="Yêu cầu bổ sung thông tin" fields={[{name:'body',label:'Câu hỏi gửi người yêu cầu',max:4000}]} disabled={disabled} run={v=>action('request-info',v)}/><ActionForm title="Hoàn tất xử lý" fields={[{name:'rootCause',label:'Nguyên nhân',min:10,max:4000},{name:'resolution',label:'Cách khắc phục',min:10,max:4000},{name:'verification',label:'Kết quả kiểm chứng',min:10,max:4000}]} disabled={disabled} run={v=>action('resolve',v)}/></>:null}
      {role==='USER'&&request.status==='WAITING_USER'?<ActionForm title="Cung cấp thông tin" fields={[{name:'body',label:'Thông tin bổ sung',max:4000}]} disabled={disabled} run={v=>action('provide-info',v)}/>:null}
      {role==='USER'&&request.status==='RESOLVED'?<><ActionForm title="Xác nhận đã giải quyết" disabled={disabled} run={()=>action('confirm')}/><ActionForm title="Yêu cầu xử lý lại" fields={reason} disabled={disabled} run={v=>action('reopen',v)}/></>:null}
      {role==='MANAGER'&&['ASSIGNED','IN_PROGRESS','WAITING_USER'].includes(request.status)?<><form className="action-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget),[teamId,staffId]=String(f.get('assignment')).split('|');await managerAction('reassign',{teamId,staffId,reason:String(f.get('reason'))});}}><fieldset disabled={disabled}><legend>Phân công lại</legend><label>Nhân sự nhận bàn giao<select name="assignment" required><option value="">Chọn nhân sự</option>{staff.filter(s=>s.available).flatMap(s=>s.teams.map(t=><option key={t.id+s.id} value={t.id+'|'+s.id}>{t.name} / {s.displayName}</option>))}</select></label><label>Lý do bàn giao<textarea name="reason" required maxLength={2000}/></label><button>Phân công lại</button></fieldset></form><form className="action-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await managerAction('priority',{priority:f.get('priority'),reason:f.get('reason')});}}><fieldset disabled={disabled}><legend>Đổi ưu tiên</legend><label>Ưu tiên mới<select name="priority">{priorities.map(p=><option key={p}>{p}</option>)}</select></label><label>Lý do đổi ưu tiên<textarea name="reason" required maxLength={2000}/></label><button>Lưu ưu tiên</button></fieldset></form></>:null}
      {((role==='USER'&&['NEW','AI_ANALYZING','TRIAGED','PENDING_APPROVAL'].includes(request.status))||(role==='MANAGER'&&!['RESOLVED','CLOSED','CANCELED'].includes(request.status)))?<ActionForm title="Hủy yêu cầu" fields={reason} disabled={disabled} run={v=>action('cancel',v)}/>:null}
      {['CLOSED','CANCELED'].includes(request.status)?<p>Yêu cầu đã kết thúc. Lịch sử được giữ nguyên.</p>:null}
      </section>
      {request.checklist?<section className="workflow-card"><h2>Checklist đã duyệt</h2>{request.checklist.items.length===0?<p>Phương án không có bước bắt buộc.</p>:request.checklist.items.map(item=><div className="checklist-row" key={item.id}><p>{item.text} {item.required?'(bắt buộc)':''} · {item.completedAt?'Đã hoàn thành':item.waivedAt?'Đã miễn: '+item.waiverReason:'Chưa hoàn thành'}</p>{role==='STAFF'&&request.status==='IN_PROGRESS'?<><button disabled={disabled} onClick={()=>{void mutate('/requests/'+id+'/checklist/'+item.id,{operation:item.completedAt?'UNCOMPLETE':'COMPLETE'},'PATCH');}}>{item.completedAt?'Bỏ hoàn thành':'Đánh dấu hoàn thành'}</button>{!item.completedAt&&!item.waivedAt?<ActionForm title="Miễn bước này" fields={[{name:'reason',label:'Lý do miễn bước'}]} disabled={disabled} run={v=>mutate('/requests/'+id+'/checklist/'+item.id,{...v,operation:'WAIVE'},'PATCH')}/>:null}</>:null}</div>)}</section>:null}
      <section className="workflow-card"><h2>Trao đổi và dòng thời gian</h2><ol className="timeline">{events.map(event=><li key={event.id}><small>{formatTime(event.createdAt)} · {event.actorType}</small><strong>{eventLabels[event.action]??event.action}</strong>{event.histories.map((h,i)=><p key={i}>{h.fromStatus?statusLabels[h.fromStatus]+' → ':''}{statusLabels[h.toStatus]}</p>)}{event.resolutions.map((r,i)=><div key={i}><p>Kết quả lần {r.cycle}: {r.rootCause}</p><p>{r.resolution}</p><p>{r.verification}</p></div>)}{event.messages.map((m,i)=><p className="preserve-text" key={i}>{m.body}</p>)}</li>)}</ol>{historyNext?<button onClick={()=>{void api('/requests/'+id+'/history?cursor='+encodeURIComponent(historyNext),historyResponseSchema).then(h=>{setEvents(old=>[...h.data,...old]);setHistoryNext(h.page.nextCursor);}).catch(e=>setError(e.message));}}>Xem lịch sử trước đó</button>:null}
      {!['CLOSED','CANCELED'].includes(request.status)?<ActionForm title="Gửi tin nhắn" fields={[{name:'body',label:'Nội dung tin nhắn',max:4000}]} disabled={disabled} run={v=>action('messages',v)}/>:null}</section>
    </>:null}
  </SessionGate>;
}
function ManualReview({draft,staff}:{draft:FinalDecision;staff:StaffOption[]}){
  return <div><h3>Phương án thủ công chờ duyệt</h3><p>{draft.category} / {draft.subcategory} · {draft.priority}</p><p>Nhân sự: {staff.find(s=>s.id===draft.staffId)?.displayName??draft.staffId}</p><ul>{draft.actions.map((a,i)=><li key={i}>{a.text} {a.required?'(bắt buộc)':''}</li>)}</ul><p>Lý do: {draft.reason}</p><p>Duyệt sẽ áp dụng phân công và bắt đầu SLA theo chính sách hiện hành.</p></div>;
}

