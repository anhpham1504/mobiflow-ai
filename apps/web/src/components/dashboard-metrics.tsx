import type {Dashboard} from '@mobiflow/contracts';
import {ErrorState,LoadingState} from './ui/patterns';

export function DashboardMetrics({data,loading,error,onRetry}:{data:Dashboard|null;loading:boolean;error:string;onRetry:()=>void}){
  if(error)return <ErrorState message={error} onRetry={onRetry}/>;
  if(loading||!data)return <LoadingState label="Đang tải tổng quan"/>;
  const m=data.metrics;
  const entries:[string,number][] = data.role==='USER'?[
    ['Đang mở',data.metrics.openRequests],['Đang xử lý',data.metrics.inProgress],['Cần phản hồi',data.metrics.waitingForUser],
    ['Chờ xác nhận',data.metrics.resolved],['Đã đóng',data.metrics.closed],
  ]:data.role==='STAFF'?[
    ['Được phân công',data.metrics.assignedToMe],['Công việc đang hoạt động',data.metrics.active],['Chờ bổ sung',data.metrics.waitingForUser],['Đã giải quyết hôm nay',data.metrics.resolvedToday],
  ]:[['Đang mở',data.metrics.open],['Chờ duyệt',data.metrics.pendingApproval],['Chưa phân công',data.metrics.unassigned],['Đã giải quyết hôm nay',data.metrics.resolvedToday]];
  entries.push(['SLA có nguy cơ',m.slaAtRisk],['SLA quá hạn',m.slaBreached]);
  return <section className="metric-grid" aria-label="Tổng quan trong phạm vi được phép" aria-live="polite">
    {entries.map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{label.includes('hôm nay')?'Theo ngày Việt Nam':'Toàn bộ phạm vi được phép'}</small></article>)}
  </section>;
}
