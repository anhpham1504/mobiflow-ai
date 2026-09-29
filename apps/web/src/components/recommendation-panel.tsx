'use client';
import {useEffect,useState} from 'react';
import {recommendationResponseSchema,type RequestView} from '@mobiflow/contracts';
import type {z} from 'zod';
import {api,ApiFailure} from '@/lib/session';
import {SourceLink} from './knowledge';
import {formatTime} from './request-list';
export function RecommendationPanel({request,onFinished,disabled}:{request:RequestView;onFinished:()=>void;disabled:boolean}){
  const [data,setData]=useState<z.infer<typeof recommendationResponseSchema>['data']>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[conflict,setConflict]=useState(false),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined,wasRunning=false;const abort=new AbortController(),started=Date.now();
    async function poll(){try{
      const r=await api('/manager/requests/'+request.id+'/ai/recommendation',recommendationResponseSchema,undefined,'GET',abort.signal);if(!active)return;
      setData(r.data);setLoading(false);setError('');
      const running=r.data&&['QUEUED','RUNNING'].includes(r.data.status);
      if(running&&Date.now()-started<330000){wasRunning=true;timer=setTimeout(()=>{void poll();},3000);}
      else if(wasRunning){onFinished();}
    }catch(e){if(active){setData(null);setLoading(false);setError((e as Error).message);}}}
    void poll();return()=>{active=false;abort.abort();if(timer)clearTimeout(timer);};
  },[request.id,request.version,revision,onFinished]);
  async function trigger(){setBusy(true);setError('');try{const r=await api('/manager/requests/'+request.id+'/ai/recommend',recommendationResponseSchema,{expectedVersion:request.version});setData(r.data);setRevision(v=>v+1);}catch(e){setError((e as Error).message);if(e instanceof ApiFailure&&e.status===409)setConflict(true);}finally{setBusy(false);}}
  const running=!!data&&['QUEUED','RUNNING'].includes(data.status),r=data?.recommendation,e=data?.evidence;
  return <section className="workflow-card" aria-labelledby="recommendation-heading">
    <h2 id="recommendation-heading">Đề xuất có căn cứ</h2><p>Thông tin hỗ trợ quản lý. Chưa phân công, chưa áp dụng ưu tiên hoặc SLA. Chức năng duyệt đề xuất AI chưa khả dụng.</p>
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
    </>:null}
  </section>;
}
