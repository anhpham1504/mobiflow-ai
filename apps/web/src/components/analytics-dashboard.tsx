'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {analyticsQuerySchema,analyticsResponseSchema,categories,priorities,statuses,type AnalyticsData} from '@mobiflow/contracts';
import {api} from '@/lib/session';
import {categoryLabels,statusLabels} from '@/lib/presentation-labels';
import {EmptyState,ErrorState,LoadingState,PageHeader,priorityLabels} from './ui/patterns';
import {analyticsValidationErrors,focusFirstInvalid,type FieldErrors} from '@/lib/form-errors';

const numberFormat=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1});
const number=(value:number|null,suffix='')=>value===null?'Chưa có mẫu':`${numberFormat.format(value)}${suffix}`;
const percent=(value:number|null)=>value===null?'Chưa có mẫu':number(value*100,'%');
const duration=(value:number|null)=>{if(value===null)return 'Chưa có mẫu';const total=Math.round(value),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;return hours?`${hours} giờ ${minutes} phút`:minutes?`${minutes} phút ${seconds} giây`:`${seconds} giây`;};
const date=(value:string)=>value.split('-').reverse().join('/');

const actionLabels:Record<string,string>={SUMMARIZE_REQUEST:'Tóm tắt yêu cầu',FIND_SOP:'Tìm SOP',SUGGEST_NEXT_STEP:'Gợi ý bước tiếp theo',GENERATE_CHECKLIST:'Tạo checklist',FIND_SIMILAR_REQUESTS:'Tìm yêu cầu tương tự',EXPLAIN_CLASSIFICATION:'Giải thích phân loại'};
const initialFilters={preset:'30d',from:'',to:'',priority:'',status:'',teamId:'',category:''};

export function AnalyticsDashboard(){
  const [data,setData]=useState<AnalyticsData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  const [filters,setFilters]=useState(initialFilters),[query,setQuery]=useState('preset=30d'),[filterError,setFilterError]=useState('');
  const [invalid,setInvalid]=useState<FieldErrors>({}),formRef=useRef<HTMLFormElement>(null),dateErrorId=useId();
  const dateError=[...new Set([invalid.from,invalid.to].filter(Boolean))].join(' ');
  useEffect(()=>{if(formRef.current)focusFirstInvalid(formRef.current,invalid);},[invalid]);
  useEffect(()=>{
    const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
    void api('/analytics?'+query,analyticsResponseSchema,undefined,'GET',signal).then(result=>{if(!controller.signal.aborted)setData(result.data);})
      .catch(e=>{if(!controller.signal.aborted)setError((e as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[query,revision]);
  const apply=()=>{
    const values:Record<string,string>={};
    if(filters.preset==='custom'){values.from=filters.from;values.to=filters.to;}else values.preset=filters.preset;
    for(const key of ['priority','status','teamId','category'] as const)if(filters[key])values[key]=filters[key];
    const parsed=analyticsQuerySchema.safeParse(values);
    if(!parsed.success){const errors=analyticsValidationErrors(parsed.error.issues,values);setInvalid(errors);setFilterError(errors.from||errors.to?'':'Kiểm tra giá trị của bộ lọc trước khi áp dụng.');return;}
    setInvalid({});setFilterError('');setError('');setLoading(true);setQuery(new URLSearchParams(values).toString());setRevision(value=>value+1);
  };
  const field=(key:keyof typeof filters,value:string)=>setFilters(old=>({...old,[key]:value}));
  const hasActivity=data&&(data.operations.createdCount+data.operations.resolvedCount+data.operations.closedCount+data.sla.slaEligibleCount+data.ai.runs.total+data.ai.recommendations.generated+data.ai.recommendations.denominator+data.feedback.feedbackCount)>0;
  return <div className="analytics-page analytics-v2">
    <PageHeader title="Analytics vận hành" description="Theo dõi yêu cầu, hiệu quả SLA và việc sử dụng AI theo thời gian. Các chỉ số được tính từ dữ liệu đã lưu."/>
    <form ref={formRef} noValidate className="analytics-filters workflow-card" aria-label="Bộ lọc analytics" onSubmit={event=>{event.preventDefault();apply();}}>
      <div className="analytics-filter-fields">
        <label>Khoảng thời gian<select name="preset" value={filters.preset} onChange={event=>{const value=event.target.value;setInvalid({});setFilterError('');setFilters(old=>({...old,preset:value,...(value==='custom'&&data&&!old.from?{from:data.period.fromDate,to:data.period.toDate}:{})}));}}><option value="7d">7 ngày</option><option value="30d">30 ngày</option><option value="90d">90 ngày</option><option value="custom">Tùy chọn</option></select></label>
        {filters.preset==='custom'?<><label>Từ ngày (bao gồm)<input name="from" data-error-field="from" aria-invalid={!!invalid.from} type="date" required value={filters.from} onChange={event=>field('from',event.target.value)} aria-describedby={'analytics-date-hint'+(invalid.from?' '+dateErrorId:'')}/></label><label>Đến ngày (không gồm)<input name="to" data-error-field="to" aria-invalid={!!invalid.to} type="date" required value={filters.to} onChange={event=>field('to',event.target.value)} aria-describedby={'analytics-date-hint'+(invalid.to?' '+dateErrorId:'')}/></label>{dateError?<p className="field-error" role="alert" id={dateErrorId}>{dateError}</p>:null}</>:null}
        <details className="analytics-extra-filters"><summary>Bộ lọc bổ sung{[filters.priority,filters.status,filters.teamId,filters.category].filter(Boolean).length?` · ${[filters.priority,filters.status,filters.teamId,filters.category].filter(Boolean).length} đã chọn`:''}</summary><div className="analytics-extra-fields">
        <label>Ưu tiên<select name="priority" value={filters.priority} onChange={event=>field('priority',event.target.value)}><option value="">Tất cả</option>{priorities.map(value=><option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label>
        <label>Trạng thái<select name="status" value={filters.status} onChange={event=>field('status',event.target.value)}><option value="">Tất cả</option>{statuses.map(value=><option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        <label>Đội phụ trách<select name="teamId" value={filters.teamId} onChange={event=>field('teamId',event.target.value)}><option value="">Tất cả</option>{data?.filterOptions.teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <label>Danh mục<select name="category" value={filters.category} onChange={event=>field('category',event.target.value)}><option value="">Tất cả</option>{categories.map(value=><option key={value} value={value}>{categoryLabels[value]}</option>)}</select></label>
        </div></details>
      </div>
      <div className="analytics-filter-footer"><p id="analytics-date-hint">Ngày theo giờ Việt Nam. Từ ngày bao gồm, đến ngày không gồm; tối đa 365 ngày. Bộ lọc dùng trạng thái, ưu tiên và đội hiện tại.</p><div className="filter-actions"><button className="button button-primary" type="submit">Áp dụng</button><button className="button button-secondary" type="button" onClick={()=>{setFilters(initialFilters);setInvalid({});setFilterError('');setError('');setLoading(true);setQuery('preset=30d');setRevision(value=>value+1);}}>Đặt lại</button></div></div>
      {filterError?<p className="form-error" role="alert">{filterError}</p>:null}
      {dateError||filterError?<p role="status">Bộ lọc chưa được áp dụng. Kết quả bên dưới vẫn dùng bộ lọc đã áp dụng trước đó.</p>:null}
    </form>
    {loading?<LoadingState label="Đang tải analytics"/>:error?<ErrorState message={error} onRetry={()=>{setError('');setLoading(true);setRevision(value=>value+1);}}/>:data?<>
      <p className="analytics-period" data-testid="analytics-period"><strong>{date(data.period.fromDate)} – trước {date(data.period.toDate)}</strong><span>{data.period.days} ngày · Giờ Việt Nam</span><time dateTime={data.period.asOf}>Cập nhật {new Date(data.period.asOf).toLocaleString('vi-VN',{timeZone:data.period.timeZone})}</time></p>
      {hasActivity?<AnalyticsResults data={data}/>:<EmptyState title="Không có dữ liệu trong khoảng thời gian đã chọn" description="Thử chọn khoảng thời gian khác hoặc giảm bộ lọc."/>}
      <Evaluation data={data}/>
    </>:null}
  </div>;
}

function AnalyticsResults({data}:{data:AnalyticsData}){
  const {operations,sla,reopen,feedback,ai,copilot}=data,decisions=ai.recommendations;
  return <>
    <section className="analytics-overview" aria-label="Tổng quan vận hành">
      <div className="analytics-section-heading"><div><h2>Kết quả trong kỳ</h2><p>Yêu cầu mới tính theo ngày tạo. Đã giải quyết tính theo lịch sử xử lý, kể cả yêu cầu được mở lại.</p></div></div>
      <div className="analytics-kpi-grid"><Kpi metric="createdCount" label="Yêu cầu mới" value={number(operations.createdCount)}/><Kpi metric="resolvedCount" label="Đã giải quyết" value={number(operations.resolvedCount)}/><Kpi metric="slaComplianceRate" label="Tuân thủ SLA" value={percent(sla.slaComplianceRate)}/><Kpi metric="averageResolutionSeconds" label="Thời gian SLA hiệu dụng TB" value={duration(sla.averageResolutionSeconds)}/></div>
    </section>
    <section className="workflow-card analytics-section"><div className="analytics-section-heading"><div><h2>Xu hướng yêu cầu</h2><p>{number(operations.createdCount)} yêu cầu mới, {number(operations.resolvedCount)} yêu cầu được giải quyết trong kỳ. Mỗi yêu cầu được đếm một lần trong kỳ, nhưng có thể giải quyết ở nhiều ngày.</p></div><span className="badge badge-neutral">Theo ngày</span></div><RequestTrend trends={data.trends}/></section>
    <div className="analytics-content-grid">
      <section className="workflow-card analytics-section"><div className="analytics-section-heading"><div><h2>Phân bố yêu cầu</h2><p>Trạng thái và ưu tiên hiện tại của các yêu cầu được tạo trong kỳ.</p></div></div><div className="analytics-breakdown-grid"><Breakdown title="Theo trạng thái" values={operations.statusDistribution} labels={statusLabels}/><Breakdown title="Theo ưu tiên" values={operations.priorityDistribution} labels={priorityLabels}/></div><p className="scope-note">{number(operations.closedCount)} yêu cầu đóng trong kỳ, tính theo ngày đóng dù được tạo trước đó.</p></section>
      <section className="workflow-card analytics-section"><div className="analytics-section-heading"><div><h2>Hiệu quả SLA</h2><p>Các lần giải quyết còn hiệu lực trong kỳ; loại yêu cầu hủy và đã mở lại.</p></div></div><dl className="analytics-stat-grid"><Stat label="Có mẫu SLA hợp lệ" value={sla.slaEligibleCount}/><Stat label="Đạt SLA" value={sla.slaMetCount}/><Stat label="Vi phạm SLA" value={sla.slaBreachedCount}/><Stat label="Tỷ lệ tuân thủ" value={percent(sla.slaComplianceRate)}/></dl><p className="scope-note">Thời gian hiệu dụng bắt đầu từ phân công đầu tiên, trừ lúc chờ người dùng và chờ xác nhận của các vòng đã mở lại. {sla.slaEligibleCount?`Trung bình từ tạo đến giải quyết (thời gian thực): ${duration(sla.averageWallClockResolutionSeconds)}.`:'Chưa có lần giải quyết có SLA hợp lệ; chưa thể đánh giá tuân thủ.'}</p><div className="analytics-reopen"><h3>Mở lại sau giải quyết</h3><p><strong>{number(reopen.reopenedRequestCount)} / {number(reopen.resolvedRequestCount)}</strong> yêu cầu trong nhóm giải quyết của kỳ được mở lại trước cuối kỳ hoặc thời điểm cập nhật. Tỷ lệ: <strong>{percent(reopen.reopenRate)}</strong>.</p></div></section>
      <section className="workflow-card analytics-section analytics-ai-activity"><div className="analytics-section-heading"><div><h2>Đề xuất AI và quyết định quản lý</h2><p>Chỉ tính quyết định chấp nhận, sửa hoặc từ chối được lưu rõ ràng; không suy đoán từ tiến độ yêu cầu.</p></div></div><p className="analytics-decision-summary"><strong data-metric="recommendationsGenerated">{number(decisions.generated)}</strong> đề xuất được tạo · <strong>{number(decisions.denominator)}</strong> quyết định trong kỳ</p><div className="analytics-table-wrap"><table className="analytics-table"><caption>Phân bố quyết định trong kỳ</caption><thead><tr><th scope="col">Quyết định</th><th scope="col">Số lượng</th><th scope="col">Tỷ lệ</th></tr></thead><tbody>{[['Chấp nhận',decisions.accepted,decisions.acceptanceRate],['Sửa',decisions.modified,decisions.modificationRate],['Từ chối',decisions.rejected,decisions.rejectionRate]].map(([label,count,rate])=><tr key={String(label)}><th scope="row">{label}</th><td>{number(count as number)}</td><td>{percent(rate as number|null)}</td></tr>)}</tbody></table></div><p className="scope-note">Ngày tạo đề xuất và ngày quyết định được lọc riêng. Tỷ lệ dùng {number(decisions.denominator)} quyết định làm mẫu; không chứng minh tính đúng phổ quát của AI.</p><h3>Hoạt động AI đã lưu</h3><dl className="analytics-stat-grid"><Stat label="Tổng lượt chạy" value={ai.runs.total}/><Stat label="Thành công" value={ai.runs.succeeded}/><Stat label="Thất bại" value={ai.runs.failed}/><Stat label="Độ trễ p50" value={number(ai.runs.p50LatencyMs,' ms')}/></dl></section>
      <section className="workflow-card analytics-section"><div className="analytics-section-heading"><div><h2>Phản hồi người dùng</h2><p>Điểm 1–5 do người gửi đánh giá sau khi đóng; không gán điểm cho yêu cầu chưa có phản hồi.</p></div></div><dl className="analytics-stat-grid"><Stat label="Số phản hồi" value={feedback.feedbackCount}/><Stat label="Điểm trung bình" value={number(feedback.averageFeedbackScore)}/></dl>{feedback.feedbackCount?<Breakdown title="Phân bố điểm" values={feedback.feedbackDistribution} labels={{'1':'1 điểm','2':'2 điểm','3':'3 điểm','4':'4 điểm','5':'5 điểm'}}/>:<p className="scope-note">Chưa có phản hồi được gửi trong kỳ.</p>}</section>
    </div>
    <section className="workflow-card analytics-section"><div className="analytics-section-heading"><div><h2>Sử dụng Copilot</h2><p>Sáu thao tác cố định; đếm lượt đã lưu theo ngày tạo lượt, bao gồm lượt đang chờ và hủy.</p></div></div><p className="analytics-copilot-summary"><strong>{number(copilot.copilotRuns)}</strong> lượt · {number(copilot.successfulCopilotRuns)} thành công · {number(copilot.failedCopilotRuns)} thất bại · {number(copilot.canceledCopilotRuns)} hủy · {number(copilot.pendingCopilotRuns)} đang chờ</p><div className="analytics-table-wrap"><table className="analytics-table"><caption>Lượt Copilot theo thao tác</caption><thead><tr><th scope="col">Thao tác</th><th scope="col">Lượt</th><th scope="col">Thành công</th><th scope="col">Thất bại</th></tr></thead><tbody>{copilot.copilotRunsByAction.map(row=><tr key={row.action}><th scope="row">{actionLabels[row.action]}</th><td>{number(row.runs)}</td><td>{number(row.succeeded)}</td><td>{number(row.failed)}</td></tr>)}</tbody></table></div>{copilot.unclassifiedRuns?<p className="scope-note">{number(copilot.unclassifiedRuns)} lượt cũ thiếu thao tác hợp lệ; chỉ nằm trong tổng lượt.</p>:null}</section>
  </>;
}

function RequestTrend({trends}:{trends:AnalyticsData['trends']}){
  const id=useId(),max=Math.max(1,...trends.flatMap(row=>[row.createdCount,row.resolvedCount]));
  const points=(key:'createdCount'|'resolvedCount')=>trends.map((row,index)=>`${40+(trends.length===1?.5:index/(trends.length-1))*730},${170-row[key]/max*140}`).join(' ');
  return <><div className="analytics-trend-legend"><span><i aria-hidden="true"/>Yêu cầu mới (đường liền)</span><span><i className="resolved" aria-hidden="true"/>Đã giải quyết (đường nét đứt)</span></div><svg className="analytics-trend" viewBox="0 0 800 210" role="img" aria-labelledby={id+'-title '+id+'-description'}><title id={id+'-title'}>Xu hướng yêu cầu theo ngày</title><desc id={id+'-description'}>Đường liền biểu diễn yêu cầu mới, đường nét đứt biểu diễn yêu cầu giải quyết. Số liệu từng ngày có trong bảng bên dưới.</desc><line x1="40" x2="770" y1="170" y2="170" className="trend-axis"/><text x="12" y="175">0</text><text x="12" y="35">{max}</text><polyline points={points('createdCount')} className="trend-created"/><polyline points={points('resolvedCount')} className="trend-resolved"/>{trends.length===1?<>{(['createdCount','resolvedCount'] as const).map((key,index)=><circle key={key} data-series={key} cx="405" cy={170-trends[0]![key]/max*140} r={index===0?6:9} className={index===0?'trend-created':'trend-resolved'}/>)}</>:null}<text x="40" y="200">{date(trends[0]!.date)}</text><text x="770" y="200" textAnchor="end">{date(trends.at(-1)!.date)}</text></svg><details className="analytics-trend-data"><summary>Xem số liệu từng ngày</summary><div className="analytics-table-wrap analytics-day-table"><table className="analytics-table"><caption>Số lượng theo ngày Việt Nam</caption><thead><tr><th scope="col">Ngày</th><th scope="col">Yêu cầu mới</th><th scope="col">Đã giải quyết</th></tr></thead><tbody>{trends.map(row=><tr key={row.date}><th scope="row">{date(row.date)}</th><td>{number(row.createdCount)}</td><td>{number(row.resolvedCount)}</td></tr>)}</tbody></table></div></details></>;
}

function Evaluation({data}:{data:AnalyticsData}){
  const latest=data.evaluations[0];
  return <section className="workflow-card analytics-section analytics-evaluation"><div className="analytics-section-heading"><div><h2>Đánh giá phát triển gần nhất</h2><p>Bằng chứng synthetic/dev, độc lập với kỳ và bộ lọc vận hành ở trên.</p></div>{latest?<span className="badge badge-primary">{latest.mode==='LIVE_OLLAMA'?'Ollama thật':'Ngoại tuyến'}</span>:null}</div>{latest?<><div className="evaluation-identity"><strong>{latest.datasetVersion}</strong><span>{latest.model}</span></div><dl className="evaluation-stat-grid"><Stat label="Khớp nhãn synthetic" value={`${latest.passed.count}/${latest.totalCases}`}/><Stat label="Schema hợp lệ" value={latest.schemaValid.count}/><Stat label="Nguồn tham chiếu" value={latest.referenceValid.rate===null?'Không áp dụng':latest.referenceValid.count}/><Stat label="Độ trễ p50" value={number(latest.latency.p50,' ms')}/></dl><p className="notice analytics-limitation">Giới hạn: {latest.totalCases} ca synthetic có nhãn theo đặc tả, không phải dữ liệu khách hàng thật, độ tin cậy đã hiệu chuẩn hay độ chính xác tổng quát.</p></>:<p>Chưa có bằng chứng đánh giá phát triển được ghi nhận.</p>}</section>;
}
function Breakdown({title,values,labels}:{title:string;values:Record<string,number>;labels:Record<string,string>}){return <div className="analytics-breakdown"><h3>{title}</h3><ul>{Object.entries(values).map(([key,value])=><li key={key}><span>{labels[key]??key}</span><strong>{number(value)}</strong></li>)}</ul></div>;}
function Kpi({metric,label,value}:{metric:string;label:string;value:React.ReactNode}){return <article className="analytics-kpi" data-metric={metric}><span>{label}</span><strong>{value}</strong></article>;}
function Stat({label,value}:{label:string;value:React.ReactNode}){return <div className="analytics-stat"><dt>{label}</dt><dd>{value}</dd></div>;}
