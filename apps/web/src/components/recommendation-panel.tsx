'use client';
import {useEffect,useState} from 'react';
import {recommendationResponseSchema,requestResponseSchema,staffDirectorySchema,finalDecisionSchema,taxonomy,categories,priorities,type RequestView,type StaffOption} from '@mobiflow/contracts';
import type {z} from 'zod';
import {api,ApiFailure} from '@/lib/session';
import {SourceLink} from './knowledge';
import {formatTime} from './request-list';
export function RecommendationPanel({request,onFinished,disabled}:{request:RequestView;onFinished:()=>void;disabled:boolean}){
  const [data,setData]=useState<z.infer<typeof recommendationResponseSchema>['data']>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[conflict,setConflict]=useState(false),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true);
  const [staff,setStaff]=useState<StaffOption[]>([]);
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined,wasRunning=false;const abort=new AbortController(),started=Date.now();
    async function poll(){try{
      const r=await api('/manager/requests/'+request.id+'/ai/recommendation',recommendationResponseSchema,undefined,'GET',abort.signal);if(!active)return;
      setData(r.data);setLoading(false);setError('');
      const running=r.data&&['QUEUED','RUNNING'].includes(r.data.status);
      if(running&&Date.now()-started<330000){wasRunning=true;timer=setTimeout(()=>{void poll();},3000);}
      else if(wasRunning){onFinished();}
    }catch(e){if(active){setData(null);setLoading(false);setError((e as Error).message);}}}
    void poll();void api('/users/staff',staffDirectorySchema,undefined,'GET',abort.signal).then(x=>{if(active)setStaff(x.data);}).catch(()=>{});return()=>{active=false;abort.abort();if(timer)clearTimeout(timer);};
  },[request.id,request.version,revision,onFinished]);
  async function trigger(){setBusy(true);setError('');try{const r=await api('/manager/requests/'+request.id+'/ai/recommend',recommendationResponseSchema,{expectedVersion:request.version});setData(r.data);setRevision(v=>v+1);}catch(e){setError((e as Error).message);if(e instanceof ApiFailure&&e.status===409)setConflict(true);}finally{setBusy(false);}}
  const running=!!data&&['QUEUED','RUNNING'].includes(data.status),r=data?.recommendation,e=data?.evidence;
  return <section className="workflow-card" aria-labelledby="recommendation-heading">
    <h2 id="recommendation-heading">Đề xuất AI và quyết định của quản lý</h2><p>Đề xuất chỉ là thông tin hỗ trợ. Chỉ quyết định xác nhận của quản lý mới phân công và bắt đầu SLA.</p>
    <p role="status" aria-live="polite">{loading?'Đang tải đề xuất…':running?'AI đang tổng hợp nguồn và dữ liệu nghiệp vụ…':data?.status==='FAILED'?'Chưa tạo được đề xuất. Có thể thử lại hoặc tiếp tục phương án thủ công.':data?.status==='CANCELED'?'Lượt đề xuất đã được hủy.':r?'Đề xuất đang chờ quyết định của quản lý.':'Chưa có đề xuất.'}</p>
    {error?<p role="alert">{error}</p>:null}
    {data?.stale||conflict?<p role="alert">Dữ liệu đã thay đổi. Đề xuất này không còn hiện hành; tải lại để kiểm tra. {data?.staleReasons.join(', ')}</p>:null}
    {data?.errorCode?<p>Mã trạng thái: {data.errorCode}</p>:null}
    {request.status==='TRIAGED'&&request.aiAnalysisStatus==='SUCCEEDED'?<button disabled={disabled||busy||running||conflict} onClick={()=>{void trigger();}}>{busy?'Đang gửi…':'Tạo đề xuất AI'}</button>:null}
    <button disabled={busy} onClick={()=>{setConflict(false);setRevision(v=>v+1);onFinished();}}>Tải lại đề xuất</button>
    {r&&e?<>
      <h3>AI đề xuất — chưa được duyệt</h3><p>Ưu tiên: {r.suggestedPriority} · SLA đề xuất: {r.suggestedSlaMinutes??'Chưa có chính sách'} phút</p>
      <p>Nhân sự đề xuất: {e.candidates.candidates.find(c=>c.staffId===r.suggestedStaffId)?.displayName??'Chưa có ứng viên'}</p><p>{r.reasonSummary}</p>
      <p>Độ tin cậy do mô hình tự báo cáo (chưa hiệu chuẩn): {r.confidence}. Không phải điểm tương đồng.</p>
      <p>{r.evidenceStatus==='SUFFICIENT'?'Có tham chiếu nguồn; quản lý cần kiểm tra nội dung.':'Chưa đủ bằng chứng; không có hướng dẫn nghiệp vụ từ AI.'}</p>
      <p>Thông tin còn thiếu: {e.analysis.missingFields.join(', ')||'Không có trường được đánh dấu thiếu'}</p>
      <h3>Nguồn và các bước đề xuất</h3><ul>{r.procedureSources.map(ref=>{const source=e.sources.find(s=>s.sourceId===ref.sourceId);return source?<li key={ref.sourceId}><SourceLink source={source}/></li>:null;})}</ul>
      <ol>{r.actions.map((a,i)=><li key={i}>{a.text}</li>)}</ol>
      <h3>Ứng viên và khối lượng công việc</h3><p>Snapshot: {formatTime(e.workload.asOf)}. Khối lượng công việc không phản ánh năng lực nhân sự.</p>
      {e.candidates.candidates.length?<ul>{e.candidates.candidates.map(c=><li key={c.staffId}>{c.displayName} · kỹ năng {c.skillCodes.join(', ')} · {c.activeWorkload} yêu cầu đang xử lý · điểm xếp hạng {c.score.toFixed(3)}</li>)}</ul>:<p>Không có nhân sự đủ điều kiện.</p>}
      <h3>Các yêu cầu có thể liên quan</h3><p>{e.similar.returnedCount} kết quả trong {e.similar.windowMinutes} phút{e.similar.truncated?' (đã giới hạn số kết quả)':''}. Đây không phải kết luận sự cố diện rộng.</p>
      <ul>{e.similar.cases.map(c=><li key={c.requestId}><a href={'/manager/requests/'+c.requestId}>{c.publicCode}: {c.title}</a> · điểm tương đồng kết hợp {c.score.toFixed(3)}</li>)}</ul>
      <p>Mô hình: {data?.model} · Thời gian: {data?.latencyMs} ms · {data?.toolCalls.length} lượt tool.</p>
      {request.status==='PENDING_APPROVAL'&&request.reviewKind==='AI'&&request.pendingRecommendationId===data?.recommendationId?<AiReview request={request} data={data} staff={staff} disabled={disabled||busy||conflict||data.stale} setBusy={setBusy} setError={setError} setConflict={setConflict} onFinished={onFinished}/>:null}
    </>:null}
  </section>;
}

function AiReview({request,data,staff,disabled,setBusy,setError,setConflict,onFinished}:{request:RequestView;data:NonNullable<z.infer<typeof recommendationResponseSchema>['data']>;staff:StaffOption[];disabled:boolean;setBusy:(v:boolean)=>void;setError:(v:string)=>void;setConflict:(v:boolean)=>void;onFinished:()=>void}){
  const r=data.recommendation!,e=data.evidence!,[category,setCategory]=useState<keyof typeof taxonomy>(e.analysis.category as keyof typeof taxonomy),[validation,setValidation]=useState('');
  const identity={reviewKind:'AI',recommendationId:data.recommendationId};
  async function decide(path:string,body:Record<string,unknown>){if(!window.confirm('Xác nhận quyết định này? Hệ thống sẽ kiểm tra lại dữ liệu hiện hành trước khi áp dụng.'))return;setBusy(true);setError('');try{await api('/manager/approvals/'+request.id+'/'+path,requestResponseSchema,{expectedVersion:request.version,...identity,...body});onFinished();}catch(err){setError((err as Error).message);if(err instanceof ApiFailure&&err.status===409)setConflict(true);}finally{setBusy(false);}}
  const acceptBlocked=disabled||r.evidenceStatus!=='SUFFICIENT'||!r.suggestedStaffId||!r.suggestedTeamId||!e.policy;
  return <div className="ai-review-grid"><section aria-labelledby="ai-original"><h3 id="ai-original">AI đề xuất — bản gốc</h3><p>{e.analysis.category} / {e.analysis.subcategory} · {r.suggestedPriority}</p><p>{e.candidates.candidates.find(c=>c.staffId===r.suggestedStaffId)?.displayName??'Không có nhân sự hợp lệ'}</p><button disabled={acceptBlocked} onClick={()=>{void decide('accept',{acknowledgedMissingFields:[]});}}>Chấp nhận đề xuất</button>{r.evidenceStatus!=='SUFFICIENT'?<p role="alert">Không thể chấp nhận trực tiếp khi bằng chứng chưa đủ. Hãy sửa bằng phương án do quản lý lập hoặc từ chối.</p>:null}</section>
    <form onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget),assignment=String(f.get('assignment')).split('|'),decision={category,subcategory:String(f.get('subcategory')),priority:String(f.get('priority')),teamId:assignment[0],staffId:assignment[1],actions:String(f.get('actions')).split('\n').map(x=>x.trim()).filter(Boolean).map(text=>({text,required:true,sourceIds:[],provenance:'HUMAN'})),acknowledgedMissingFields:f.getAll('acknowledgedMissingFields').map(String),reason:String(f.get('reason'))};const parsed=finalDecisionSchema.safeParse(decision);if(!parsed.success){setValidation('Kiểm tra phân loại, nhân sự, các bước và lý do thay đổi.');return;}setValidation('');void decide('modify',{finalDecision:parsed.data});}}><fieldset disabled={disabled}><legend>Quyết định của quản lý — sửa đề xuất</legend><label>Nhóm vấn đề<select value={category} onChange={x=>setCategory(x.target.value as keyof typeof taxonomy)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label><label>Phân loại chi tiết<select name="subcategory" key={category} defaultValue={category===e.analysis.category?e.analysis.subcategory:taxonomy[category][0]}>{taxonomy[category].map(x=><option key={x}>{x}</option>)}</select></label><label>Ưu tiên cuối cùng<select name="priority" defaultValue={r.suggestedPriority}>{priorities.map(x=><option key={x}>{x}</option>)}</select></label><label>Nhóm / nhân sự cuối cùng<select name="assignment" required defaultValue={(r.suggestedTeamId??'')+'|'+(r.suggestedStaffId??'')}><option value="">Chọn nhân sự đủ điều kiện</option>{staff.filter(x=>x.available).flatMap(x=>x.teams.map(t=><option key={t.id+x.id} value={t.id+'|'+x.id}>{t.name} / {x.displayName}</option>))}</select></label><label>Kế hoạch do quản lý xác nhận<textarea name="actions" required rows={5} defaultValue={r.actions.map(x=>x.text).join('\n')}/></label><label>Lý do sửa<textarea name="reason" required maxLength={2000}/></label><fieldset><legend>Xác nhận thông tin còn thiếu</legend>{e.analysis.missingFields.filter(x=>x==='location'||x==='startedAt').map(x=><label key={x}><input type="checkbox" name="acknowledgedMissingFields" value={x}/> Tôi xác nhận tiếp tục dù thiếu {x}</label>)}</fieldset>{validation?<p role="alert">{validation}</p>:null}<button>Sửa và phê duyệt</button></fieldset></form>
    <form onSubmit={event=>{event.preventDefault();const reason=String(new FormData(event.currentTarget).get('reason'));void decide('reject',{reason});}}><fieldset disabled={disabled}><legend>Từ chối đề xuất AI</legend><p>Yêu cầu không bị hủy; nó trở về bước phân loại để quản lý xử lý thủ công hoặc tạo đề xuất mới.</p><label>Lý do từ chối<textarea name="reason" required maxLength={2000}/></label><button>Từ chối đề xuất AI</button></fieldset></form>
  </div>;
}
