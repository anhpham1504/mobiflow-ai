'use client';
import {useEffect,useRef,useState} from 'react';
import {recommendationResponseSchema,requestResponseSchema,staffDirectorySchema,finalDecisionSchema,isRecommendationV2,recommendationActions,taxonomy,categories,priorities,type RequestView,type StaffOption,type FinalDecision,type RecommendationV2} from '@mobiflow/contracts';
import type {z} from 'zod';
import {api,ApiFailure} from '@/lib/session';
import {SourceLink} from './knowledge';
import {formatTime} from './request-list';
import {AiPanelHeader} from './ui/patterns';

type RecommendationJob=NonNullable<z.infer<typeof recommendationResponseSchema>['data']>;
const decisionLabels={PENDING:'Chưa review',ACCEPTED:'Đã chấp nhận đề xuất',MODIFIED:'Đã chỉnh sửa đề xuất',REJECTED:'Đã từ chối đề xuất'};
const nextStepLabels={START_WORK:'Bắt đầu xử lý sau khi được phân công',REQUEST_USER_INFO:'Yêu cầu bổ sung thông tin khi đang xử lý',RESOLVE:'Hoàn tất xử lý sau khi kiểm chứng'};
const missingFieldLabels={customer:'Thông tin người yêu cầu',location:'Địa điểm',affectedCount:'Số người / thiết bị bị ảnh hưởng',startedAt:'Thời điểm bắt đầu',impact:'Mức ảnh hưởng',description:'Mô tả vấn đề'};

export function RecommendationPanel(props:{request:RequestView;onFinished:()=>void;disabled:boolean}){
  return <RecommendationContent key={props.request.id+':'+props.request.version} {...props}/>;
}

function RecommendationContent({request,onFinished,disabled}:{request:RequestView;onFinished:()=>void;disabled:boolean}){
  const [data,setData]=useState<RecommendationJob|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[conflict,setConflict]=useState(false),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[permissionLost,setPermissionLost]=useState(false);
  const [staff,setStaff]=useState<StaffOption[]>([]),operation=useRef<AbortController|null>(null),pollEpoch=useRef(0);
  useEffect(()=>{
    const controller=new AbortController();operation.current=controller;
    return()=>{controller.abort();if(operation.current===controller)operation.current=null;};
  },[request.id,request.version]);
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined,wasRunning=false;
    const controller=new AbortController(),started=Date.now(),epoch=++pollEpoch.current;
    async function poll(){try{
      const r=await api('/manager/requests/'+request.id+'/ai/recommendation',recommendationResponseSchema,undefined,'GET',AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));if(!active||epoch!==pollEpoch.current)return;
      setData(r.data);setLoading(false);setError('');setPermissionLost(false);
      const running=r.data&&['QUEUED','RUNNING'].includes(r.data.status);
      if(running){wasRunning=true;if(Date.now()-started<330000)timer=setTimeout(()=>{void poll();},3000);else setError('Đề xuất vẫn đang xử lý. Tải lại để kiểm tra kết quả mới nhất.');}
      else if(wasRunning)onFinished();
    }catch(e){if(active&&epoch===pollEpoch.current){setData(null);setLoading(false);setError((e as Error).message);if(e instanceof ApiFailure&&[401,403].includes(e.status))setPermissionLost(true);}}}
    void poll();
    void api('/users/staff',staffDirectorySchema,undefined,'GET',controller.signal).then(x=>{if(active)setStaff(x.data);}).catch(e=>{if(active&&e instanceof ApiFailure&&[401,403].includes(e.status)){setData(null);setPermissionLost(true);setError(e.message);}});
    return()=>{active=false;controller.abort();if(timer)clearTimeout(timer);};
  },[request.id,request.version,revision,onFinished]);
  function reportFailure(e:unknown){setError((e as Error).message);if(e instanceof ApiFailure){if(e.status===409)setConflict(true);if([401,403,404].includes(e.status))setData(null);if([401,403].includes(e.status))setPermissionLost(true);}}
  async function trigger(){
    const controller=operation.current;if(!controller||controller.signal.aborted||busy)return;
    ++pollEpoch.current;setBusy(true);setError('');
    try{const r=await api('/manager/requests/'+request.id+'/ai/recommend',recommendationResponseSchema,{expectedVersion:request.version},'POST',AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));if(controller.signal.aborted)return;setData(r.data);setRevision(v=>v+1);}
    catch(e){if(!controller.signal.aborted)reportFailure(e);}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  async function decide(path:string,body:Record<string,unknown>){
    const controller=operation.current;if(!controller||controller.signal.aborted||busy||!data?.recommendationId)return;
    const advisory=!!data.recommendation&&isRecommendationV2(data.recommendation);
    if(!window.confirm(advisory?'Ghi nhận quyết định review? Quyết định này không thực hiện đề xuất và không phân công yêu cầu.':'Xác nhận quyết định này? Hệ thống sẽ kiểm tra lại dữ liệu hiện hành trước khi áp dụng.'))return;
    ++pollEpoch.current;setBusy(true);setError('');
    try{
      await api('/manager/approvals/'+request.id+'/'+path,requestResponseSchema,{expectedVersion:request.version,reviewKind:'AI',recommendationId:data.recommendationId,...body},'POST',AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]));
      if(controller.signal.aborted)return;setLoading(true);setRevision(v=>v+1);onFinished();
    }catch(e){if(!controller.signal.aborted)reportFailure(e);}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const running=!!data&&['QUEUED','RUNNING'].includes(data.status),r=data?.recommendation,e=data?.evidence,v2=!!r&&isRecommendationV2(r);
  const reviewPending=v2?data?.reviewStatus==='PENDING':request.status==='PENDING_APPROVAL'&&request.reviewKind==='AI'&&request.pendingRecommendationId===data?.recommendationId;
  const reviewDisabled=disabled||busy||loading||permissionLost||conflict||!!data?.stale;
  const status=loading?'Đang tải đề xuất…':permissionLost?'Phiên hiện tại không có quyền xem đề xuất.':running?'AI đang tổng hợp nguồn và dữ liệu nghiệp vụ…':data?.status==='FAILED'?'Chưa tạo được đề xuất. Có thể thử lại hoặc tiếp tục phương án thủ công.':data?.status==='CANCELED'?'Lượt đề xuất đã được hủy.':r?(data?.reviewStatus?decisionLabels[data.reviewStatus]:'Đề xuất đã được lưu.'): 'Chưa có đề xuất.';
  return <section className="workflow-card ai-panel recommendation-panel" aria-label="Đề xuất AI và quyết định của quản lý" aria-busy={loading||busy||running}>
    <AiPanelHeader title="Đề xuất điều phối" description="AI tổng hợp để quản lý xem xét. Quyết định review V2 ghi nhận ý kiến; áp dụng phương án qua quy trình duyệt nghiệp vụ riêng."/>
    <p role="status" aria-live="polite">{status}</p>
    {error?<p role="alert">{error}</p>:null}
    {data?.stale||conflict?<p className="notice" role="alert"><strong>Đề xuất đã cũ.</strong> Yêu cầu hoặc căn cứ đã thay đổi. Bản gốc vẫn được giữ để đối chiếu; hãy tải lại và tạo đề xuất mới trước khi review.</p>:null}
    {data?.errorCode?<p>Mã trạng thái: {data.errorCode}</p>:null}
    <div className="recommendation-actions">
      {!permissionLost&&request.status==='TRIAGED'&&request.aiAnalysisStatus==='SUCCEEDED'?<button className="button button-primary" disabled={disabled||busy||running||conflict||loading} onClick={()=>{void trigger();}}>{busy?'Đang gửi…':'Tạo đề xuất AI'}</button>:null}
      <button className="button button-secondary" disabled={busy} onClick={()=>{setLoading(true);setConflict(false);setRevision(v=>v+1);onFinished();}}>Tải lại đề xuất</button>
    </div>
    {r&&e&&data?<>
      <div className="recommendation-provenance"><span>{data.schemaVersion}</span><span>Tạo lúc <time dateTime={data.finishedAt??data.createdAt}>{formatTime(data.finishedAt??data.createdAt)}</time></span><span>Ngữ cảnh yêu cầu v{data.contextVersion}</span></div>
      {isRecommendationV2(r)?<V2Suggestion recommendation={r} data={data} request={request}/>:<V1Suggestion data={data}/>}
      <p className="recommendation-runtime">Mô hình: {data.model??'Chưa ghi nhận'} · Thời gian: {data.latencyMs??'Chưa ghi nhận'} ms</p>
      {data.reviewStatus&&data.reviewStatus!=='PENDING'?<ReviewResult data={data} staff={staff}/>:null}
      {reviewPending?<AiReview key={data.recommendationId} data={data} staff={staff} disabled={reviewDisabled} decide={decide}/>:null}
      {v2&&['NEW','TRIAGED'].includes(request.status)?<p className="recommendation-handoff">Để sử dụng phương án, quản lý chuẩn bị bản nháp, gửi duyệt rồi xác nhận phân công trong <a href="#manual-request-plan">phần phân loại thủ công</a>.</p>:null}
    </>:null}
  </section>;
}

function V2Suggestion({recommendation:r,data,request}:{recommendation:RecommendationV2;data:RecommendationJob;request:RequestView}){
  const e=data.evidence!;
  return <article className="recommendation-original" aria-label="Đề xuất AI — bản gốc">
    <h3>Đề xuất AI — bản gốc</h3>
    <p className="preserve-text recommendation-summary">{r.summary}</p>
    <dl className="recommendation-facts"><div><dt>Phân loại đề xuất</dt><dd>{r.classification.category} / {r.classification.subcategory}</dd></div><div><dt>Ưu tiên đề xuất</dt><dd>{r.classification.priority}</dd></div><div><dt>Nhân sự đề xuất</dt><dd>{e.candidates.candidates.find(c=>c.staffId===r.suggestedStaffId)?.displayName??'Chưa có ứng viên'}</dd></div><div><dt>SLA đề xuất theo chính sách</dt><dd>{r.suggestedSlaMinutes===null?'Chưa có chính sách':r.suggestedSlaMinutes+' phút'}</dd></div></dl>
    <section className="recommendation-next"><h3>Bước tiếp theo được đề xuất</h3><strong>{nextStepLabels[r.recommendedAction.action]}</strong><p className="preserve-text">{r.recommendedAction.text}</p><p>Đây là hướng dẫn để con người xem xét khi workflow cho phép. Yêu cầu hiện ở trạng thái {request.status}; AI chưa thực hiện bước này.</p></section>
    <h3>Lý do đề xuất</h3><p className="preserve-text">{r.reasonSummary}</p>
    <section><h3>Căn cứ của đề xuất</h3><p>{r.evidenceStatus==='SUFFICIENT'?'Có nguồn nghiệp vụ tham chiếu; quản lý cần kiểm tra nội dung.':'Chưa đủ bằng chứng nghiệp vụ. Thông tin từ yêu cầu vẫn có thể dùng để tổng hợp và hỏi thêm.'}</p>
      {r.evidence.length?<ul className="recommendation-evidence">{r.evidence.map((item,i)=>{
        const source=item.type==='KNOWLEDGE'?e.sources.find(s=>s.sourceId===item.referenceId):undefined;
        const related=item.type==='HISTORICAL_REQUEST'?e.similar.cases.find(c=>c.requestId===item.referenceId):undefined;
        return <li key={item.type+item.referenceId+i}><strong>{item.type==='REQUEST'?'Yêu cầu hiện tại':item.type==='KNOWLEDGE'?'SOP / tri thức':'Yêu cầu lịch sử'}</strong><div>{source?<SourceLink source={source}/>:related?<a href={'/manager/requests/'+related.requestId}>{related.publicCode}: {related.title}</a>:<span>{request.publicCode}</span>}</div><blockquote className="preserve-text">{item.excerpt}</blockquote><p className="preserve-text">Liên quan: {item.relevance}</p></li>;
      })}</ul>:<p>Không có trích dẫn đủ điều kiện trong đề xuất này.</p>}
    </section>
    <section><h3>Thông tin cần bổ sung</h3>{r.missingInformation.length?<ul className="recommendation-missing">{r.missingInformation.map(item=><li key={item.field}><strong>{missingFieldLabels[item.field]}</strong><p className="preserve-text">Câu hỏi: {item.question}</p><p className="preserve-text">Ảnh hưởng: {item.impact}</p></li>)}</ul>:<p>Phân tích hiện tại không đánh dấu thông tin còn thiếu.</p>}</section>
    <section><h3>Checklist đề xuất</h3>{r.suggestedChecklist.length?<ol className="recommendation-checklist">{r.suggestedChecklist.map((item,i)=><li key={i}><p className="preserve-text">{item.text}</p><div className="recommendation-source-links">{item.sourceIds.map(id=>{const source=e.sources.find(s=>s.sourceId===id);return source?<SourceLink key={id} source={source}/>:null;})}</div></li>)}</ol>:<p>Chưa có checklist được hỗ trợ bởi nguồn nghiệp vụ.</p>}</section>
    <section><h3>Cảnh báo</h3>{r.warnings.length?<ul className="recommendation-warnings">{r.warnings.map((item,i)=><li key={item.code+i}>{item.text}</li>)}</ul>:<p>Không có cảnh báo được ghi nhận trong ngữ cảnh tạo đề xuất.</p>}</section>
  </article>;
}

function V1Suggestion({data}:{data:RecommendationJob}){
  const r=data.recommendation!,e=data.evidence!;if(isRecommendationV2(r))return null;
  return <article aria-label="Đề xuất AI V1 — bản gốc"><h3>Đề xuất AI V1 — bản gốc</h3><p>Ưu tiên: {r.suggestedPriority} · SLA đề xuất: {r.suggestedSlaMinutes??'Chưa có chính sách'} phút</p>
    <p>Nhân sự đề xuất: {e.candidates.candidates.find(c=>c.staffId===r.suggestedStaffId)?.displayName??'Chưa có ứng viên'}</p><p className="preserve-text">{r.reasonSummary}</p>
    <p>Độ tin cậy do mô hình tự báo cáo (chưa hiệu chuẩn): {r.confidence}. Không phải điểm tương đồng.</p><p>{r.evidenceStatus==='SUFFICIENT'?'Có tham chiếu nguồn; quản lý cần kiểm tra nội dung.':'Chưa đủ bằng chứng; không có hướng dẫn nghiệp vụ từ AI.'}</p>
    <p>Thông tin còn thiếu: {e.analysis.missingFields.join(', ')||'Không có trường được đánh dấu thiếu'}</p>
    <h3>Nguồn và các bước đề xuất</h3><ul>{r.procedureSources.map(ref=>{const source=e.sources.find(s=>s.sourceId===ref.sourceId);return source?<li key={ref.sourceId}><SourceLink source={source}/></li>:null;})}</ul><ol>{r.actions.map((a,i)=><li key={i}>{a.text}</li>)}</ol>
    <h3>Ứng viên và khối lượng công việc</h3><p>Snapshot: {formatTime(e.workload.asOf)}. Khối lượng công việc không phản ánh năng lực nhân sự.</p>{e.candidates.candidates.length?<ul>{e.candidates.candidates.map(c=><li key={c.staffId}>{c.displayName} · kỹ năng {c.skillCodes.join(', ')} · {c.activeWorkload} yêu cầu đang xử lý · điểm xếp hạng {c.score.toFixed(3)}</li>)}</ul>:<p>Không có nhân sự đủ điều kiện.</p>}
    <h3>Các yêu cầu có thể liên quan</h3><p>{e.similar.returnedCount} kết quả trong {e.similar.windowMinutes} phút{e.similar.truncated?' (đã giới hạn số kết quả)':''}. Đây không phải kết luận sự cố diện rộng.</p><ul>{e.similar.cases.map(c=><li key={c.requestId}><a href={'/manager/requests/'+c.requestId}>{c.publicCode}: {c.title}</a> · điểm tương đồng kết hợp {c.score.toFixed(3)}</li>)}</ul>
  </article>;
}

function ReviewResult({data,staff}:{data:RecommendationJob;staff:StaffOption[]}){
  const final=data.finalDecision,v2=!!data.recommendation&&isRecommendationV2(data.recommendation);
  const changes=data.managerChanges,rejectReason=changes&&typeof changes==='object'&&'reason' in changes&&typeof changes.reason==='string'&&changes.reason.length<=2000?changes.reason:null;
  return <section className="recommendation-decision" aria-label="Quyết định của quản lý"><h3>Quyết định của quản lý</h3><p><strong>{data.reviewStatus?decisionLabels[data.reviewStatus]:'Chưa review'}</strong></p><p>Người review: {data.reviewerId??'Chưa ghi nhận'} · {data.reviewedAt?<time dateTime={data.reviewedAt}>{formatTime(data.reviewedAt)}</time>:'Chưa ghi nhận thời điểm'}</p>{v2?<p>Quyết định này chỉ ghi nhận ý kiến review. Đề xuất chưa được thực hiện.</p>:null}
    {data.reviewStatus==='REJECTED'&&rejectReason?<p className="preserve-text">Lý do từ chối: {rejectReason}</p>:null}
    {final?<HumanPlan decision={final} staff={staff}/>:null}
  </section>;
}

function HumanPlan({decision,staff}:{decision:FinalDecision;staff:StaffOption[]}){
  return <div><h4>Phương án được quản lý ghi nhận riêng</h4><p>{decision.category} / {decision.subcategory} · {decision.priority}</p><p>Nhân sự: {staff.find(s=>s.id===decision.staffId)?.displayName??decision.staffId}</p><ol>{decision.actions.map((item,i)=><li key={i}>{item.text} <small>({item.provenance==='HUMAN'?'Nội dung do quản lý lập':'Nội dung AI được quản lý xác nhận'})</small></li>)}</ol><p className="preserve-text">Lý do: {decision.reason}</p>{decision.acknowledgedMissingFields.length?<p>Đã xác nhận tiếp tục dù thiếu: {decision.acknowledgedMissingFields.join(', ')}</p>:null}</div>;
}

function AiReview({data,staff,disabled,decide}:{data:RecommendationJob;staff:StaffOption[];disabled:boolean;decide:(path:string,body:Record<string,unknown>)=>Promise<void>}){
  const r=data.recommendation!,e=data.evidence!,v2=isRecommendationV2(r),[category,setCategory]=useState<keyof typeof taxonomy>(e.analysis.category as keyof typeof taxonomy),[validation,setValidation]=useState('');
  const acceptBlocked=disabled||(!v2&&(r.evidenceStatus!=='SUFFICIENT'||!r.suggestedStaffId||!r.suggestedTeamId||!e.policy));
  return <div className="ai-review-grid"><section aria-label="Chấp nhận đề xuất AI"><h3>Review đề xuất AI</h3><p>{v2?'Chấp nhận chỉ ghi nhận sự đồng ý. Đề xuất chưa được thực hiện.':'Chấp nhận V1 sẽ áp dụng phương án, phân công và bắt đầu SLA sau khi kiểm tra nghiệp vụ.'}</p>{v2?<form onSubmit={event=>{event.preventDefault();void decide('accept',{acknowledgedMissingFields:new FormData(event.currentTarget).getAll('acknowledgedMissingFields').map(String)});}}><fieldset disabled={acceptBlocked}>{e.analysis.missingFields.length?<fieldset><legend>Xác nhận dữ liệu còn thiếu trước khi chấp nhận</legend>{e.analysis.missingFields.map(field=><label key={field}><input type="checkbox" name="acknowledgedMissingFields" value={field} required/> Tôi hiểu đề xuất đang thiếu {missingFieldLabels[field].toLowerCase()}</label>)}</fieldset>:null}<button>Chấp nhận đề xuất</button></fieldset></form>:<button disabled={acceptBlocked} onClick={()=>{void decide('accept',{acknowledgedMissingFields:[]});}}>Chấp nhận đề xuất</button>}{!v2&&r.evidenceStatus!=='SUFFICIENT'?<p role="alert">Không thể chấp nhận trực tiếp khi bằng chứng chưa đủ. Hãy sửa bằng phương án do quản lý lập hoặc từ chối.</p>:null}</section>
    <form onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget),assignment=String(f.get('assignment')).split('|'),decision={category,subcategory:String(f.get('subcategory')),priority:String(f.get('priority')),teamId:assignment[0],staffId:assignment[1],actions:String(f.get('actions')).split('\n').map(x=>x.trim()).filter(Boolean).map(text=>({text,required:true,sourceIds:[],provenance:'HUMAN'})),acknowledgedMissingFields:f.getAll('acknowledgedMissingFields').map(String),reason:String(f.get('reason'))};const parsed=finalDecisionSchema.safeParse(decision);if(!parsed.success){setValidation('Kiểm tra phân loại, nhân sự, tối đa 30 bước (500 ký tự/bước) và lý do thay đổi.');return;}setValidation('');void decide('modify',{finalDecision:parsed.data});}}><fieldset disabled={disabled}><legend>Quyết định của quản lý — sửa đề xuất</legend><p>{v2?'Bản sửa được lưu riêng với người review và thời điểm. Phân công và checklist chỉ có hiệu lực qua quy trình duyệt nghiệp vụ.':'Bản sửa được lưu riêng với đề xuất gốc. Phê duyệt sẽ áp dụng phương án đã sửa.'}</p><label>Nhóm vấn đề<select value={category} onChange={x=>setCategory(x.target.value as keyof typeof taxonomy)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label><label>Phân loại chi tiết<select name="subcategory" key={category} defaultValue={category===e.analysis.category?e.analysis.subcategory:taxonomy[category][0]}>{taxonomy[category].map(x=><option key={x}>{x}</option>)}</select></label><label>Ưu tiên cuối cùng<select name="priority" defaultValue={r.suggestedPriority}>{priorities.map(x=><option key={x}>{x}</option>)}</select></label><label>Nhóm / nhân sự cuối cùng<select name="assignment" required defaultValue={(r.suggestedTeamId??'')+'|'+(r.suggestedStaffId??'')}><option value="">Chọn nhân sự đủ điều kiện</option>{staff.filter(x=>x.available).flatMap(x=>x.teams.map(t=><option key={t.id+x.id} value={t.id+'|'+x.id}>{t.name} / {x.displayName}</option>))}</select></label><label>Kế hoạch do quản lý xác nhận<textarea name="actions" rows={5} defaultValue={recommendationActions(r).map(x=>x.text).join('\n')}/></label><label>Lý do sửa<textarea name="reason" required maxLength={2000}/></label><fieldset><legend>Xác nhận thông tin còn thiếu</legend>{e.analysis.missingFields.filter(x=>v2||x==='location'||x==='startedAt').map(x=><label key={x}><input type="checkbox" name="acknowledgedMissingFields" value={x} required={v2}/> Tôi xác nhận tiếp tục dù thiếu {missingFieldLabels[x].toLowerCase()}</label>)}</fieldset>{validation?<p role="alert">{validation}</p>:null}<button>{v2?'Lưu chỉnh sửa đề xuất':'Sửa và phê duyệt'}</button></fieldset></form>
    <form onSubmit={event=>{event.preventDefault();const reason=String(new FormData(event.currentTarget).get('reason'));void decide('reject',{reason});}}><fieldset disabled={disabled}><legend>Từ chối đề xuất AI</legend><p>{v2?'Ghi nhận lý do từ chối và giữ nguyên đề xuất gốc. Yêu cầu tiếp tục ở trạng thái hiện tại.':'Yêu cầu không bị hủy; nó trở về bước phân loại để quản lý xử lý thủ công hoặc tạo đề xuất mới.'}</p><label>Lý do từ chối<textarea name="reason" required maxLength={2000}/></label><button>Từ chối đề xuất AI</button></fieldset></form>
  </div>;
}
