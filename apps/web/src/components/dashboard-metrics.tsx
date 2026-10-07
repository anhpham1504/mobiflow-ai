import type {Dashboard} from '@mobiflow/contracts';
import {ErrorState,LoadingState} from './ui/patterns';

export function DashboardMetrics({data,loading,error,onRetry}:{data:Dashboard|null;loading:boolean;error:string;onRetry:()=>void}){
  if(error)return <ErrorState message={error} onRetry={onRetry}/>;
  if(loading||!data)return <LoadingState label="Đang tải tổng quan"/>;
  const m=data.metrics;
  const attention:[string,number][] = data.role==='USER'?[
    ['Cần phản hồi',data.metrics.waitingForUser],['Chờ xác nhận',data.metrics.resolved],
  ]:data.role==='STAFF'?[
    ['Công việc đang hoạt động',data.metrics.active],['SLA có nguy cơ',m.slaAtRisk],['SLA quá hạn',m.slaBreached],
  ]:[['Chờ duyệt',data.metrics.pendingApproval],['Chưa phân công',data.metrics.unassigned],['SLA quá hạn',m.slaBreached]];
  const supporting:[string,number][] = data.role==='USER'?[
    ['Đang mở',data.metrics.openRequests],['Đang xử lý',data.metrics.inProgress],['Đã đóng',data.metrics.closed],['SLA có nguy cơ',m.slaAtRisk],['SLA quá hạn',m.slaBreached],
  ]:data.role==='STAFF'?[
    ['Được phân công',data.metrics.assignedToMe],['Chờ bổ sung',data.metrics.waitingForUser],['Đã giải quyết hôm nay',data.metrics.resolvedToday],
  ]:[['Đang mở',data.metrics.open],['SLA có nguy cơ',m.slaAtRisk],['Đã giải quyết hôm nay',data.metrics.resolvedToday]];
  return <section className="dashboard-metrics" aria-label="Tổng quan trong phạm vi được phép" aria-live="polite">
    <h2 className="dashboard-attention-title">{data.role==='USER'?'Cần bạn phản hồi':data.role==='STAFF'?'Công việc và thời hạn':'Phê duyệt và điều phối'}</h2>
    <div className="metric-grid" style={{'--metric-columns':attention.length} as React.CSSProperties}>{attention.map(([label,value])=><article key={label} className={value>0&&label==='SLA quá hạn'?'metric-danger':value>0&&label==='SLA có nguy cơ'?'metric-warning':undefined}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <dl className="dashboard-supporting">{supporting.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="dashboard-scope">Số liệu trong phạm vi được phép. “Hôm nay” tính theo ngày Việt Nam.</p>
  </section>;
}
