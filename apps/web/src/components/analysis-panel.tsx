'use client';
import {useEffect,useState} from 'react';
import {aiExplanationSchema,aiJobResponseSchema,type RequestView} from '@mobiflow/contracts';
import type {z} from 'zod';
import {api,ApiFailure} from '@/lib/session';
import {analysisRunning,analysisStatusText} from '@/lib/analysis-presentation';
import {SourceLink} from './knowledge';
import {classificationLabel,priorityLabels} from '@/lib/presentation-labels';
import {AiPanelHeader} from './ui/patterns';
import {BookOpenCheck,ClipboardList,Route,ShieldCheck,Sparkles,UserRoundCheck} from 'lucide-react';
const names:Record<string,string>={customer:'Khách hàng',location:'Địa điểm',affectedCount:'Số lượng ảnh hưởng',startedAt:'Thời điểm bắt đầu',impact:'Mức ảnh hưởng',description:'Mô tả chi tiết'};
const attemptOutcomeLabels={NO_IMPROVEMENT:'Không cải thiện',FAILED:'Không thành công',SUCCEEDED:'Được báo cáo thành công',UNKNOWN:'Chưa rõ kết quả'} as const;
const routingReasonLabels:Record<string,string>={GROUNDED_RAG:'Có nguồn RAG phù hợp',EXACT_SKILL_MATCH:'Đủ kỹ năng yêu cầu',TEAM_MATCH:'Đúng nhóm phụ trách',AVAILABLE:'Nhân sự đang khả dụng',LOWEST_WORKLOAD:'Tải công việc thấp nhất',STABLE_TIE_BREAK:'Phân xử hòa bằng mã ổn định',SLA_POLICY_MATCH:'Có chính sách SLA phù hợp',DEFAULT_TEAM_MAPPING:'Dùng ánh xạ nhóm nghiệp vụ chuẩn',ROUTING_RULE_MATCH:'Khớp quy tắc định tuyến',WEAK_RAG_GROUNDING:'Chưa đủ nguồn RAG',MISSING_ROUTING_FACT:'Thiếu dữ kiện điều phối',AMBIGUOUS_TEAM:'Nhóm xử lý chưa rõ',ROUTING_RULE_CONFLICT:'Quy tắc định tuyến xung đột',INVALID_ROUTING_TARGET:'Nhóm đích không còn hợp lệ',NO_ELIGIBLE_STAFF:'Không có nhân sự đủ điều kiện',MISSING_SLA_POLICY:'Thiếu chính sách SLA',ROUTING_TECHNICAL_FAILURE:'Lỗi kỹ thuật khi điều phối'};
type Explanation=z.infer<typeof aiExplanationSchema>['data'];

function analysisStage(data:Explanation|null,error:string){
  if(error)return {label:'Chưa tải được',tone:'attention'};
  if(!data)return {label:'Đang tải',tone:'active'};
  if(analysisRunning(data))return {label:data.job?.status==='QUEUED'?'Đang chờ':'Đang phân tích',tone:'active'};
  const status=data.job?.status??data.status;
  if(status==='SUCCEEDED')return {label:'Đã hoàn tất',tone:'complete'};
  if(status==='FAILED'||status==='CANCELED')return {label:'Đã dừng an toàn',tone:'attention'};
  return {label:'Chưa bắt đầu',tone:'pending'};
}

function evidenceStage(data:Explanation|null,role:'USER'|'STAFF'|'MANAGER'){
  if(role==='USER')return {label:'Theo quyền truy cập',detail:'Nguồn nghiệp vụ nội bộ chỉ hiển thị cho vai trò được phép.',tone:'neutral'};
  if(!data?.grounding)return {label:'Chưa có bằng chứng',detail:'Chưa có dữ liệu nguồn cho lần phân tích hiện tại.',tone:'pending'};
  if(data.grounding.mode==='NON_RAG')return {label:'Không dùng RAG',detail:'Lần phân tích này không sử dụng nguồn tri thức.',tone:'neutral'};
  if(data.grounding.evidenceStatus==='SUFFICIENT')return {label:`${data.grounding.citations.length} nguồn phù hợp`,detail:'Có trích dẫn để người phụ trách đối chiếu.',tone:'complete'};
  if(data.grounding.evidenceStatus==='UNAVAILABLE')return {label:'Nguồn không còn hiệu lực',detail:'Nguồn đã thay đổi hoặc bị vô hiệu hóa.',tone:'attention'};
  return {label:'Chưa đủ bằng chứng',detail:'Không dùng hướng dẫn nghiệp vụ khi chưa có nguồn phù hợp.',tone:'attention'};
}

function routingStage(request:RequestView,role:'USER'|'STAFF'|'MANAGER'){
  const routing=role==='MANAGER'?request.autoRouting:null;
  if(routing?.outcome==='MANAGER_REVIEW_REQUIRED')return {label:'Cần quản lý xem xét',detail:'Hệ thống đã dừng tự động điều phối và chuyển sang quy trình có người kiểm soát.',tone:'attention'};
  if(request.currentAssignee)return {label:'Đã phân công',detail:`Người phụ trách: ${request.currentAssignee.displayName}.`,tone:'complete'};
  if(['TRIAGED','PENDING_APPROVAL'].includes(request.status))return {label:'Chờ quyết định',detail:'Chưa có người phụ trách cho đến khi quy trình duyệt hoàn tất.',tone:'active'};
  return {label:'Chưa điều phối',detail:'Kết quả điều phối chỉ xuất hiện khi đủ dữ kiện và điều kiện nghiệp vụ.',tone:'pending'};
}

function humanStage(request:RequestView){
  if(request.status==='CLOSED')return {label:'Người dùng đã xác nhận',detail:'Yêu cầu đã đóng sau xác nhận của người yêu cầu.',tone:'complete'};
  if(request.status==='RESOLVED')return {label:'Chờ người dùng xác nhận',detail:'Kết quả xử lý chưa tự động đóng yêu cầu.',tone:'active'};
  if(request.status==='PENDING_APPROVAL')return {label:'Quản lý quyết định',detail:'Phương án đang chờ vai trò được ủy quyền duyệt.',tone:'active'};
  return {label:'Vai trò được ủy quyền',detail:'Các hành động được bảo vệ vẫn do con người thực hiện.',tone:'neutral'};
}
export function AnalysisPanel({request,role,onFinished,disabled}:{request:RequestView;role:'USER'|'STAFF'|'MANAGER';onFinished:()=>void;disabled:boolean}){
  const [data,setData]=useState<z.infer<typeof aiExplanationSchema>['data']|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[paused,setPaused]=useState(false);
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined,hadActive=false,polls=0;const controller=new AbortController(),started=Date.now();
    async function poll(){
      try{
        const result=await api('/requests/'+request.id+'/ai/explanation',aiExplanationSchema,undefined,'GET',controller.signal);if(!active)return;
        setData(result.data);setError('');
        const running=analysisRunning(result.data);
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
  const running=analysisRunning(data);
  const analysis=analysisStage(data,error),evidence=evidenceStage(data,role),routing=routingStage(request,role),human=humanStage(request);
  const stages=[
    {title:'Yêu cầu',label:'Đã ghi nhận',detail:`Phiên bản ${request.version} được lưu trước khi xử lý.`,tone:'complete',Icon:ClipboardList},
    {title:'Phân tích',label:analysis.label,detail:analysisStatusText(data,error),tone:analysis.tone,Icon:Sparkles},
    {title:'Bằng chứng',label:evidence.label,detail:evidence.detail,tone:evidence.tone,Icon:BookOpenCheck},
    {title:'Kiểm soát',label:'Ràng buộc backend',detail:'Cấu trúc, phân loại, nguồn và ngữ cảnh được kiểm tra trước khi ảnh hưởng workflow.',tone:'neutral',Icon:ShieldCheck},
    {title:'Điều phối',label:routing.label,detail:routing.detail,tone:routing.tone,Icon:Route},
    {title:'Hành động',label:human.label,detail:human.detail,tone:human.tone,Icon:UserRoundCheck},
  ];
  return <section className="workflow-card ai-analysis decision-explanation" id="request-decision" tabIndex={-1} aria-label="Giải thích quyết định"><AiPanelHeader title="Giải thích quyết định" description="Theo dõi cách yêu cầu đi từ phân tích và bằng chứng đến điều phối có kiểm soát."/>
    <ol className="decision-pipeline" aria-label="Chuỗi quyết định từ yêu cầu đến hành động của con người">{stages.map(({title,label,detail,tone,Icon})=><li key={title} data-tone={tone}><span className="decision-stage-icon" aria-hidden="true"><Icon size={17}/></span><div><small>{title}</small><strong>{label}</strong><p>{detail}</p></div></li>)}</ol>
    <p className="human-control-boundary"><ShieldCheck size={18} aria-hidden="true"/><span><strong>Ranh giới kiểm soát của con người</strong> AI không trực tiếp duyệt, phân công, giải quyết hoặc đóng yêu cầu. Các thao tác được bảo vệ chỉ do vai trò được ủy quyền thực hiện.</span></p>
    {role==='MANAGER'&&request.autoRouting?<section className={'routing-decision '+(request.autoRouting.outcome==='MANAGER_REVIEW_REQUIRED'?'routing-decision-review':'routing-decision-assigned')} aria-label="Kết quả điều phối có kiểm soát">
      <div className="routing-decision-heading"><span className="badge">{request.autoRouting.outcome==='MANAGER_REVIEW_REQUIRED'?'Cần quản lý xem xét':'Đã điều phối theo quy tắc'}</span><div><h3>{request.autoRouting.outcome==='MANAGER_REVIEW_REQUIRED'?'Tự động hóa đã dừng an toàn':'Kết quả điều phối xác định'}</h3><p>{request.autoRouting.outcome==='MANAGER_REVIEW_REQUIRED'?'Hệ thống không tạo phân công tùy ý khi chưa đủ điều kiện. Quản lý kiểm tra căn cứ và quyết định bước tiếp theo.':'Hệ thống đã chọn người đủ điều kiện bằng quy tắc nghiệp vụ và dữ liệu tải công việc hiện hành.'}</p></div></div>
      <dl className="routing-decision-facts"><div><dt>Yêu cầu năng lực do ứng dụng xác định</dt><dd>{request.autoRouting.requiredSkills.join(', ')||'Chưa xác định'}</dd></div><div><dt>Nhóm phù hợp</dt><dd>{request.autoRouting.recommendedTeamCode??'Chưa xác định'}</dd></div><div><dt>Ứng viên đủ điều kiện</dt><dd>{request.autoRouting.candidateCount}</dd></div><div><dt>Kết quả</dt><dd>{request.currentAssignee?.displayName??'Chưa phân công'}</dd></div></dl>
      <div className="routing-reasons"><h3>Căn cứ điều phối</h3><ul>{request.autoRouting.reasons.map(reason=><li key={reason}>{routingReasonLabels[reason]??reason}</li>)}</ul></div>
    </section>:null}
    <div role="status" aria-live="polite">{analysisStatusText(data,error)}</div>
    {paused?<p>Đã dừng theo dõi tự động sau thời hạn. Tải lại để kiểm tra trạng thái hiện tại.</p>:null}
    {error?<p role="alert">{error}</p>:null}
    {data?.missingFields.length?<div><h3>Thông tin còn thiếu</h3><ul>{data.missingFields.map(f=><li key={f}>{names[f]}</li>)}</ul></div>:null}
    {data?.analysis&&role==='MANAGER'?<div><h3>Kết quả phân tích AI</h3><p>{classificationLabel(data.analysis.category,data.analysis.subcategory)} · Ưu tiên AI đề xuất: {priorityLabels[data.analysis.prioritySuggestion]} (không tự động áp dụng)</p><p>{data.analysis.reasonSummary}</p><p>Độ tin cậy do mô hình tự báo cáo (chưa hiệu chuẩn): {Math.round(data.analysis.confidence*100)}%</p><dl>{Object.entries(data.analysis.entities).map(([k,v])=><div key={k}><dt>{names[k]}</dt><dd>{v??'Chưa được cung cấp'}</dd></div>)}</dl></div>:null}
    {data?.entities&&role==='STAFF'?<dl>{Object.entries(data.entities).map(([k,v])=><div key={k}><dt>{names[k]}</dt><dd>{v??'Chưa được cung cấp'}</dd></div>)}</dl>:null}
    {role!=='USER'&&data?.factRetention&&(data.factRetention.observations.length||data.factRetention.identifiers.length||data.factRetention.troubleshootingAttempts.length||data.factRetention.contradictions.length)?<section className="analysis-evidence" aria-labelledby="retained-facts-title"><div className="analysis-evidence-heading"><div><h3 id="retained-facts-title">Dữ kiện giữ nguyên từ yêu cầu</h3><p>Các mục dưới đây do backend trích từ nội dung người dùng, không phải nguyên nhân đã được xác minh hoặc suy luận của mô hình.</p></div><span className="badge badge-info">Nguồn: người dùng báo cáo</span></div>
      {data.factRetention.identifiers.length?<div><h4>Mã kỹ thuật</h4><ul>{data.factRetention.identifiers.map(item=><li key={item.value}><code>{item.value}</code></li>)}</ul></div>:null}
      {data.factRetention.observations.length?<div><h4>Quan sát được báo cáo</h4><ul>{data.factRetention.observations.map(item=><li key={item.text} className="preserve-text">{item.text}</li>)}</ul></div>:null}
      {data.factRetention.troubleshootingAttempts.length?<div><h4>Thao tác đã thử</h4><ul>{data.factRetention.troubleshootingAttempts.map(item=><li key={item.action}><span className="preserve-text">{item.action}</span> — <strong>{attemptOutcomeLabels[item.outcome]}</strong></li>)}</ul></div>:null}
      {data.factRetention.contradictions.length?<div><h4>Thông tin cần đối chiếu</h4><ul>{data.factRetention.contradictions.map((item,index)=><li key={index}><span>{item.description}</span><ul>{item.evidence.map(evidence=><li key={evidence} className="preserve-text">{evidence}</li>)}</ul></li>)}</ul></div>:null}
    </section>:null}
    {role!=='USER'&&data?.grounding?<section className="analysis-evidence" aria-labelledby="analysis-evidence-title"><div className="analysis-evidence-heading"><div><h3 id="analysis-evidence-title">Bằng chứng tham chiếu</h3><p>{data.grounding.mode==='NON_RAG'?'Phân tích không dùng RAG':data.grounding.evidenceStatus==='UNAVAILABLE'?'Nguồn đã thay đổi hoặc bị vô hiệu hóa; không còn dùng cho kết luận hiện tại.':data.grounding.evidenceStatus==='SUFFICIENT'?'Có nguồn tham chiếu để đối chiếu. Nội dung vẫn cần người phụ trách đánh giá.':'Không tìm thấy nguồn phù hợp. Không có hướng dẫn nghiệp vụ từ tài liệu.'}</p></div><span className="badge badge-info">{data.grounding.citations.length} trích dẫn</span></div>{data.grounding.citations.length?<ol className="analysis-citations">{data.grounding.citations.map(c=><li key={c.sourceId}><SourceLink source={c.source}/><blockquote className="preserve-text">{c.quote}</blockquote></li>)}</ol>:<p className="analysis-evidence-empty">Không có trích dẫn được công bố cho lần phân tích này.</p>}</section>:null}
    {role!=='STAFF'&&request.status==='NEW'&&!running?<button disabled={disabled||busy||stale} onClick={()=>{void trigger();}}>{busy?'Đang gửi…':data?.status==='FAILED'?'Thử phân tích lại':'Phân tích yêu cầu'}</button>:null}
    {error||paused||stale?<button onClick={()=>{setPaused(false);setStale(false);setRevision(v=>v+1);onFinished();}}>Tải lại trạng thái AI</button>:null}
  </section>;
}
