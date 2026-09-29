'use client';
import {useEffect,useState} from 'react';
import {aiExplanationSchema,aiJobResponseSchema,type RequestView} from '@mobiflow/contracts';
import type {z} from 'zod';
import {api,ApiFailure} from '@/lib/session';
import {SourceLink} from './knowledge';
const names:Record<string,string>={customer:'Khách hàng',location:'Địa điểm',affectedCount:'Số lượng ảnh hưởng',startedAt:'Thời điểm bắt đầu',impact:'Mức ảnh hưởng',description:'Mô tả chi tiết'};
const failureText=(code:string|null|undefined)=>code==='STALE_CONTEXT'?'Phân tích dựa trên phiên bản cũ đã được loại bỏ. Tin nhắn mới vẫn được giữ nguyên.':code==='AI_INVALID_OUTPUT'?'AI chưa tạo được kết quả hợp lệ. Không có quyết định nghiệp vụ nào được áp dụng.':code==='AI_TIMEOUT'?'Phân tích đã hết thời gian chờ. Bạn có thể thử lại hoặc xử lý thủ công.':code==='FORBIDDEN'?'Quyền của người khởi tạo đã thay đổi; kết quả không được công bố.':'AI local hiện không khả dụng. Yêu cầu đã được lưu an toàn. Có thể thử lại hoặc xử lý thủ công.';
export function AnalysisPanel({request,role,onFinished,disabled}:{request:RequestView;role:'USER'|'STAFF'|'MANAGER';onFinished:()=>void;disabled:boolean}){
  const [data,setData]=useState<z.infer<typeof aiExplanationSchema>['data']|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[paused,setPaused]=useState(false);
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined,hadActive=false,polls=0;const controller=new AbortController(),started=Date.now();
    async function poll(){
      try{
        const result=await api('/requests/'+request.id+'/ai/explanation',aiExplanationSchema,undefined,'GET',controller.signal);if(!active)return;
        setData(result.data);setError('');
        const running=['QUEUED','RUNNING'].includes(result.data.job?.status??'');
        if(running&&Date.now()-started<330000){hadActive=true;timer=setTimeout(()=>{void poll();},Math.min(5000,2000+polls++*500));}
        else if(running)setPaused(true);
        else if(hadActive||(result.data.job&&['SUCCEEDED','FAILED','CANCELED'].includes(result.data.job.status)&&(request.status==='AI_ANALYZING'||request.aiAnalysisStatus!==result.data.status))){onFinished();}
      }catch(e){if(active){setData(null);setError((e as Error).message);}}
    }
    void poll();return()=>{active=false;controller.abort();if(timer)clearTimeout(timer);};
  },[request.id,request.version,request.status,request.aiAnalysisStatus,role,revision,onFinished]);
  async function trigger(){
    if(busy||stale)return;setBusy(true);setError('');
    try{await api('/requests/'+request.id+'/ai/'+(data?.status==='FAILED'?'retry':'analyze'),aiJobResponseSchema,{expectedVersion:request.version});setPaused(false);setRevision(v=>v+1);}
    catch(e){setError((e as Error).message);if(e instanceof ApiFailure&&e.status===409)setStale(true);}
    finally{setBusy(false);}
  }
  const running=['QUEUED','RUNNING'].includes(data?.job?.status??'');
  return <section className="workflow-card ai-analysis" aria-labelledby="ai-intake-heading"><h2 id="ai-intake-heading">Phân tích AI hỗ trợ</h2>
    <p>Phân tích chỉ là đề xuất. Quản lý quyết định phân loại, ưu tiên và phân công.</p>
    <div role="status" aria-live="polite">{!data&&!error?'Đang tải trạng thái AI…':running?data?.job?.status==='QUEUED'?'AI đang chờ xử lý.':'AI đang phân tích…':data?.job?.status==='SUCCEEDED'?'Phân tích AI hoàn tất.':data?.job?.status==='FAILED'?failureText(data.job.errorCode):data?.job?.status==='CANCELED'?'Phân tích đã được hủy.':'Chưa có phân tích AI.'}</div>
    {paused?<p>Đã dừng theo dõi tự động sau thời hạn. Tải lại để kiểm tra trạng thái hiện tại.</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {data?.missingFields.length?<div><h3>Thông tin còn thiếu</h3><ul>{data.missingFields.map(f=><li key={f}>{names[f]}</li>)}</ul></div>:null}
    {data?.analysis&&role==='MANAGER'?<div><h3>AI đề xuất (chưa được duyệt)</h3><p>{data.analysis.category} / {data.analysis.subcategory} · Ưu tiên đề xuất: {data.analysis.prioritySuggestion}</p><p>{data.analysis.reasonSummary}</p><p>Độ tin cậy do mô hình tự báo cáo (chưa hiệu chuẩn): {Math.round(data.analysis.confidence*100)}%</p><dl>{Object.entries(data.analysis.entities).map(([k,v])=><div key={k}><dt>{names[k]}</dt><dd>{v??'Chưa được cung cấp'}</dd></div>)}</dl></div>:null}
    {data?.entities&&role==='STAFF'?<dl>{Object.entries(data.entities).map(([k,v])=><div key={k}><dt>{names[k]}</dt><dd>{v??'Chưa được cung cấp'}</dd></div>)}</dl>:null}
    {role!=='USER'&&data?.grounding?<div><h3>Nguồn tham chiếu</h3><p>{data.grounding.mode==='NON_RAG'?'Phân tích không dùng RAG':data.grounding.evidenceStatus==='UNAVAILABLE'?'Nguồn đã thay đổi hoặc bị vô hiệu hóa; không còn dùng cho kết luận hiện tại.':data.grounding.evidenceStatus==='SUFFICIENT'?'Có nguồn tham chiếu đã kiểm tra. Nội dung vẫn cần người phụ trách đánh giá.':'Không tìm thấy nguồn phù hợp. Không có hướng dẫn nghiệp vụ từ tài liệu.'}</p><ul>{data.grounding.citations.map(c=><li key={c.sourceId}><SourceLink source={c.source}/><blockquote className="preserve-text">{c.quote}</blockquote></li>)}</ul></div>:null}
    {role!=='STAFF'&&request.status==='NEW'&&!running?<button disabled={disabled||busy||stale} onClick={()=>{void trigger();}}>{busy?'Đang gửi…':data?.status==='FAILED'?'Thử phân tích lại':'Phân tích yêu cầu'}</button>:null}
    {error||paused||stale?<button onClick={()=>{setPaused(false);setStale(false);setRevision(v=>v+1);onFinished();}}>Tải lại trạng thái AI</button>:null}
  </section>;
}
