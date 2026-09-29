'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {createRequestSchema,requestResponseSchema,requestListSchema,statuses,priorities,categories,type RequestView} from '@mobiflow/contracts';
import {api,getProfile,serverProfile,subscribe,requestLink} from '@/lib/session';
import {SessionGate} from './session-shell';
export const statusLabels:Record<string,string>={NEW:'Mới tiếp nhận',AI_ANALYZING:'Đang phân tích',TRIAGED:'Đã phân loại',PENDING_APPROVAL:'Chờ duyệt',ASSIGNED:'Đã phân công',IN_PROGRESS:'Đang xử lý',WAITING_USER:'Chờ bổ sung',RESOLVED:'Chờ xác nhận',CLOSED:'Đã đóng',CANCELED:'Đã hủy'};
export const formatTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
export function RequestList({role,approvals=false}:{role:'USER'|'STAFF'|'MANAGER';approvals?:boolean}){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile),[rows,setRows]=useState<RequestView[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[next,setNext]=useState<string|null>(null),[query,setQuery]=useState(''),[revision,setRevision]=useState(0);
  const endpoint=approvals?'/manager/approvals':role==='USER'?'/requests/mine':role==='STAFF'?'/staff/work-queue':'/manager/requests';
  useEffect(()=>{
    if(!user||user.role!==role)return;let active=true;const controller=new AbortController();
    void api(endpoint+'?limit=20'+query,requestListSchema,undefined,'GET',controller.signal).then(r=>{if(active){setRows(r.data);setNext(r.page.nextCursor);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[endpoint,query,revision,user,role]);
  function reload(){setLoading(true);setRevision(v=>v+1);}
  return <SessionGate role={role}><div className="workflow-heading"><div><p className="eyebrow">{role} / CÔNG VIỆC</p><h1>{approvals?'Duyệt yêu cầu':role==='STAFF'?'Hàng đợi xử lý':role==='USER'?'Yêu cầu của tôi':'Quản lý yêu cầu'}</h1></div>{role==='USER'?<Link className="action-link" href="/user/requests/new">Tạo yêu cầu</Link>:null}{role==='MANAGER'?<Link href={approvals?'/manager/requests':'/manager/approvals'}>{approvals?'Tất cả yêu cầu':'Chờ duyệt'}</Link>:null}</div>
    <form className="filter-row" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget),q=new URLSearchParams();for(const key of ['status','priority','category'])if(f.get(key))q.set(key,String(f.get(key)));setLoading(true);setQuery('&'+q.toString());setRevision(v=>v+1);}}>
      <label>Trạng thái<select name="status"><option value="">Tất cả</option>{statuses.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
      <label>Ưu tiên<select name="priority"><option value="">Tất cả</option>{priorities.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Nhóm vấn đề<select name="category"><option value="">Tất cả</option>{categories.map(s=><option key={s}>{s}</option>)}</select></label>
      <button>Lọc yêu cầu</button><button type="button" onClick={reload}>Tải lại</button>
    </form>
    {error?<div role="alert" className="form-error">{error}<button onClick={reload}>Thử lại</button></div>:null}
    {loading?<p role="status">Đang tải yêu cầu…</p>:rows.length===0?<div className="workflow-card"><h2>{query?'Không có yêu cầu khớp bộ lọc':role==='STAFF'?'Hàng đợi hiện đang trống':approvals?'Không có yêu cầu chờ duyệt':'Chưa có yêu cầu'}</h2><p>{query?'Bỏ bộ lọc để xem toàn bộ phạm vi bạn được phép truy cập.':role==='USER'?'Tạo yêu cầu mới khi bạn cần hỗ trợ.':'Các yêu cầu phù hợp sẽ xuất hiện tại đây.'}</p>{query?<button onClick={()=>{setLoading(true);setQuery('');}}>Bỏ bộ lọc</button>:role==='USER'?<Link className="action-link" href="/user/requests/new">Tạo yêu cầu</Link>:null}</div>:<ul className="request-list">{rows.map(r=><li key={r.id}><Link href={requestLink(role,r.id)}><small>{r.publicCode}</small><h2>{r.title}</h2></Link><span className="status-pill">{statusLabels[r.status]} · {r.priority}</span><p>{r.currentAssignee?.displayName??'Chưa phân công'} · {formatTime(r.createdAt)}</p>{r.sla?<p>SLA: {r.sla.status} · {r.sla.pausedAt?'Đang tạm dừng':r.sla.resolvedHoldAt?'Chờ xác nhận':formatTime(r.sla.dueAt)}</p>:null}</li>)}</ul>}
    {next&&!loading?<button onClick={()=>{setLoading(true);setQuery(q=>q.replace(/&cursor=[^&]*/,'')+'&cursor='+encodeURIComponent(next));}}>Trang tiếp theo</button>:null}
  </SessionGate>;
}
export function CreateRequest(){
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),router=useRouter();
  return <SessionGate role="USER"><h1>Tạo yêu cầu</h1><p>Mô tả sự cố và thông tin bạn biết để bộ phận phụ trách xử lý.</p><form className="workflow-card" onSubmit={async e=>{
    e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget),payload={description:String(f.get('description')),...(f.get('title')?{title:String(f.get('title'))}:{})};
    const parsed=createRequestSchema.safeParse(payload);if(!parsed.success){setError('Mô tả cần từ 10 đến 10.000 ký tự; tiêu đề tối đa 160 ký tự.');return;}
    setBusy(true);setError('');try{const r=await api('/requests',requestResponseSchema,parsed.data);router.push('/user/requests/'+r.data.id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }}><label>Tiêu đề (không bắt buộc)<input name="title" maxLength={160}/></label><label>Mô tả yêu cầu<textarea name="description" minLength={10} maxLength={10000} required rows={7}/></label>{error?<p role="alert" className="form-error">{error}</p>:null}<button disabled={busy}>{busy?'Đang gửi…':'Gửi yêu cầu'}</button></form></SessionGate>;
}

