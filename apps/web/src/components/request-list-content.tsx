'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { requestListSchema, dashboardResponseSchema, statuses, priorities, categories, requestFilterKeys, requestFiltersFromUrl,
  replaceRequestFilters, requestFilterSchema, requestFiltersAllowed, staffDirectorySchema,
  type RequestView, type Dashboard, type RequestFilters, type StaffOption, type SavedRequestView } from '@mobiflow/contracts';
import { SavedViews } from './saved-views';
import { DashboardMetrics } from './dashboard-metrics';
import { RequestCollection, statusLabels } from './request-list';
import { api, getProfile, serverProfile, subscribe } from '@/lib/session';
import { SessionGate } from './session-shell';
import { EmptyState, ErrorState, LoadingState, PageHeader } from './ui/patterns';
import { categoryLabels, priorityLabels } from '@/lib/presentation-labels';
import { advanceCursor, cursorPosition } from '@/lib/cursor-history';
import { useCursorHistory } from './cursor-history-provider';
type Props = { role: 'USER' | 'STAFF' | 'MANAGER'; approvals?: boolean };
const dashboardCopy = {
  USER: { title: 'Tổng quan', description: 'Theo dõi yêu cầu cá nhân và những việc đang cần bạn phản hồi.' },
  STAFF: { title: 'Tổng quan công việc', description: 'Ưu tiên công việc được phân công và các yêu cầu cần xử lý tiếp theo.' },
  MANAGER: { title: 'Tổng quan vận hành', description: 'Nắm nhanh tình hình yêu cầu, phê duyệt và SLA trong phạm vi hiện tại.' },
};
export function RequestList(props: Props) {
  return <Suspense fallback={<LoadingState label="Đang tải yêu cầu" />}><RequestListContent {...props} /></Suspense>;
}
function RequestListContent({ role, approvals = false }: Props) {
  const user = useSyncExternalStore(subscribe, getProfile, serverProfile), path = usePathname(), params = useSearchParams(), router = useRouter();
  const [revision, setRevision] = useState(0), [search, setSearch] = useState(() => params.get('search') ?? '');
  const { history: cursorHistory, setHistory: setCursorHistory } = useCursorHistory();
  const [staff, setStaff] = useState<StaffOption[]>([]), [directoryError, setDirectoryError] = useState(''), [formError, setFormError] = useState('');
  const url = params.toString();
  const parsed = useMemo(() => {
    try {
      const filters = requestFiltersFromUrl(new URLSearchParams(url));
      return requestFiltersAllowed(filters, role) ? { filters, error: '' } : { filters: {}, error: 'Bộ lọc không phù hợp với vai trò hiện tại.' };
    } catch { return { filters: {}, error: 'Bộ lọc trong địa chỉ không hợp lệ. Đặt lại để tiếp tục.' }; }
  }, [url, role]);
  const filters: RequestFilters = parsed.filters;
  useEffect(() => {
    const restore = () => setSearch(new URL(window.location.href).searchParams.get('search') ?? '');
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const endpoint = approvals ? '/manager/approvals' : role === 'USER' ? '/requests/mine' : role === 'STAFF' ? '/staff/work-queue' : '/manager/requests', isDashboard = path.endsWith('/dashboard');
  const query = new URLSearchParams({ ...filters, limit: '20', ...(params.get('cursor') ? { cursor: params.get('cursor')! } : {}) }).toString();
  const requestKey = endpoint + '?' + query + '#' + revision;
  const [result, setResult] = useState<{ key: string; rows: RequestView[]; next: string | null } | null>(null), [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null), [dashboardError, setDashboardError] = useState(''), [dashboardLoading, setDashboardLoading] = useState(true);
  const loading = result?.key !== requestKey && error?.key !== requestKey, rows = result?.key === requestKey ? result.rows : [], next = result?.key === requestKey ? result.next : null;
  useEffect(() => {
    if (!isDashboard || !user || user.role !== role) return;
    const controller = new AbortController();
    void api('/dashboard/' + role.toLowerCase(), dashboardResponseSchema, undefined, 'GET', controller.signal)
      .then(r => { if (r.data.role !== role) throw new Error('Dữ liệu tổng quan không hợp lệ.'); if (!controller.signal.aborted) { setDashboard(r.data); setDashboardError(''); } })
      .catch(e => { if (!controller.signal.aborted) setDashboardError(e.message); }).finally(() => { if (!controller.signal.aborted) setDashboardLoading(false); });
    return () => controller.abort();
  }, [isDashboard, revision, user, role]);
  useEffect(() => {
    if (!user || user.role !== role || parsed.error) return;
    const controller = new AbortController();
    void api(endpoint + '?' + query, requestListSchema, undefined, 'GET', controller.signal)
      .then(r => { if (!controller.signal.aborted) { setResult({ key: requestKey, rows: r.data, next: r.page.nextCursor }); setError(null); } })
      .catch(e => { if (!controller.signal.aborted) setError({ key: requestKey, message: e.message }); });
    return () => controller.abort();
  }, [endpoint, query, requestKey, user, role, parsed.error]);
  useEffect(() => {
    if (!user || user.role !== 'MANAGER') return;
    const controller = new AbortController();
    void api('/users/staff', staffDirectorySchema, undefined, 'GET', controller.signal)
      .then(r => { if (!controller.signal.aborted) { setStaff(r.data); setDirectoryError(''); } })
      .catch(() => { if (!controller.signal.aborted) setDirectoryError('Không tải được danh sách nhân sự. Các bộ lọc khác vẫn dùng được.'); });
    return () => controller.abort();
  }, [user]);
  const term = search.trim().toLocaleLowerCase('vi'), visible = term ? rows.filter(r => (r.publicCode + ' ' + r.title).toLocaleLowerCase('vi').includes(term)) : rows;
  const cursor = params.get('cursor'), scope = JSON.stringify([user?.id, role, path, endpoint, filters, term]);
  const position = cursorPosition(cursorHistory, scope, cursor);
  function searchParams(next: URLSearchParams) { if (search) next.set('search', search); else next.delete('search'); return next; }
  function navigate(next: URLSearchParams) { searchParams(next); setFormError(''); router.push(path + (next.size ? '?' + next.toString() : ''), { scroll: false }); }
  function commitSearch(value = search) {
    const current = new URL(window.location.href), next = current.searchParams;
    if (value) next.set('search', value); else next.delete('search');
    setSearch(value);
    window.history.replaceState(null, '', current.pathname + (next.size ? '?' + next.toString() : ''));
  }
  function apply(value: RequestFilters, viewId?: string) {
    setCursorHistory(null);
    const next = replaceRequestFilters(new URLSearchParams(url), value);
    if (viewId !== undefined) { if (viewId) next.set('view', viewId); else next.delete('view'); }
    navigate(next);
  }
  function choose(view: SavedRequestView) {
    if (view.availability === 'AVAILABLE') apply(view.filters, view.id);
    else { const next = new URLSearchParams(url); next.set('view', view.id); navigate(next); }
  }
  function reload() { setDashboardLoading(true); setDashboardError(''); setRevision(v => v + 1); }
  const heading = isDashboard ? dashboardCopy[role] : { title: approvals ? 'Phê duyệt yêu cầu' : role === 'STAFF' ? 'Công việc của tôi' : role === 'USER' ? 'Yêu cầu của tôi' : 'Quản lý yêu cầu', description: approvals ? 'Xem xét các phương án đang chờ quyết định của quản lý.' : 'Quản lý và theo dõi các yêu cầu trong phạm vi bạn được phép truy cập.' };
  const primary = role === 'USER' ? <Link className="button button-primary" href="/user/requests/new"><Plus size={17} />Tạo yêu cầu</Link> : role === 'MANAGER' ? <Link className={isDashboard?'button button-primary':'button button-secondary'} href={approvals ? '/manager/requests' : '/manager/approvals'}>{approvals ? 'Tất cả yêu cầu' : 'Chờ phê duyệt'}</Link> : isDashboard ? <Link className="button button-primary" href="/staff/work-queue">Mở công việc của tôi</Link> : undefined;
  return <SessionGate role={role}><PageHeader title={heading.title} description={heading.description} actions={primary} />
    {isDashboard ? <div className="dashboard-summary"><DashboardMetrics data={dashboard} loading={dashboardLoading} error={dashboardError} onRetry={reload} /></div> : null}
    {isDashboard ? <h2 className="section-title">{role === 'USER' ? 'Yêu cầu của tôi' : role === 'STAFF' ? 'Cần xử lý' : 'Yêu cầu gần đây'}</h2> : null}
    <form className="list-search" onSubmit={e => { e.preventDefault(); commitSearch(); }}>
      <label>Tìm trong trang<span className="search-control"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã hoặc tiêu đề" aria-describedby="page-search-hint" /></span></label>
      <p id="page-search-hint">Chỉ tìm trong các yêu cầu trên trang hiện tại.</p>
      {search ? <button type="button" className="button button-secondary" onClick={() => commitSearch('')}>Xóa tìm kiếm</button> : null}
    </form>
    <details className="list-controls" open={Object.keys(filters).length>0}><summary>Bộ lọc và chế độ xem đã lưu{Object.keys(filters).length ? ` · ${Object.keys(filters).length} bộ lọc đang áp dụng` : ''}</summary>
    {user?.role === role ? <SavedViews key={user.id + role} filters={filters} selectedId={params.get('view') ?? ''} onChoose={choose} onDeleted={() => { const next = new URLSearchParams(url); next.delete('view'); navigate(next); }} disabled={!!parsed.error} /> : null}
    <form key={JSON.stringify(filters)} className="filter-row request-filter-form" onSubmit={e => {
      e.preventDefault(); const values = new FormData(e.currentTarget), input: Record<string, string> = {};
      for (const key of requestFilterKeys) { const value = String(values.get(key) ?? ''); if (value) input[key] = key === 'from' || key === 'to' ? value + (value.length === 16 ? ':00Z' : 'Z') : value; }
      const checked = requestFilterSchema.safeParse(input);
      if (!checked.success) { setFormError('Khoảng thời gian không hợp lệ: thời điểm kết thúc phải sau bắt đầu.'); (e.currentTarget.elements.namedItem('from') as HTMLInputElement)?.focus(); return; }
      apply(checked.data);
    }}>
      <label>Trạng thái<select name="status" defaultValue={filters.status ?? ''}><option value="">Tất cả</option>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
      <label>Ưu tiên<select name="priority" defaultValue={filters.priority ?? ''}><option value="">Tất cả</option>{priorities.map(s => <option key={s} value={s}>{priorityLabels[s]}</option>)}</select></label>
      <label>Nhóm vấn đề<select name="category" defaultValue={filters.category ?? ''}><option value="">Tất cả</option>{categories.map(s => <option key={s} value={s}>{categoryLabels[s]}</option>)}</select></label>
      <label>Tạo từ (UTC)<input type="datetime-local" step="0.001" name="from" defaultValue={filters.from?.replace('Z', '') ?? ''} aria-invalid={!!formError} aria-describedby={formError ? 'request-filter-error' : undefined} /></label>
      <label>Tạo trước (UTC)<input type="datetime-local" step="0.001" name="to" defaultValue={filters.to?.replace('Z', '') ?? ''} aria-invalid={!!formError} aria-describedby={formError ? 'request-filter-error' : undefined} /></label>
      {formError ? <p className="field-error" role="alert" id="request-filter-error">{formError}</p> : null}
      {role === 'MANAGER' ? <label>Nhân sự phụ trách<select name="assigneeId" defaultValue={filters.assigneeId ?? ''}><option value="">Tất cả nhân sự</option>{staff.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label> : null}
      <div className="filter-actions"><button className="button button-primary"><SlidersHorizontal size={16} />Áp dụng</button><button className="button button-secondary" type="button" onClick={() => apply({}, '')}><RefreshCw size={16} />Đặt lại</button></div>
    </form>
    {directoryError ? <p role="status">{directoryError}</p> : null}
    </details>
    {parsed.error ? <ErrorState message={parsed.error} onRetry={() => apply({}, '')} /> : error?.key === requestKey ? <ErrorState message={error.message} onRetry={reload} /> : loading ? <LoadingState label="Đang tải yêu cầu" /> : visible.length === 0 ? <EmptyState title={Object.keys(filters).length || search ? 'Không có yêu cầu phù hợp' : role === 'STAFF' ? 'Hàng đợi đang trống' : approvals ? 'Không có yêu cầu chờ duyệt' : 'Chưa có yêu cầu'} description="Điều chỉnh hoặc đặt lại bộ lọc để xem thêm kết quả." /> : <RequestCollection rows={visible} role={role} />}
    {!loading && !parsed.error && error?.key !== requestKey ? <nav className="collection-footer request-pagination" aria-label="Phân trang yêu cầu">
      <p role="status">{position.page ? position.startsAtFirst ? `Trang ${position.page}` : position.page === 1 ? 'Trang hiện tại' : `Trang ${position.page} trong lượt xem này` : 'Trang hiện tại'} · {rows.length} yêu cầu trên trang này{term ? ` · ${visible.length} khớp tìm kiếm` : ''}{!next ? ' · Đã đến cuối danh sách' : ''}</p>
      <div className="pagination-actions"><button className="button button-secondary" disabled={!position.canPrevious} onClick={() => { const p = new URLSearchParams(url); if (position.previous) p.set('cursor', position.previous); else p.delete('cursor'); navigate(p); }}>Trang trước</button>
      {cursor && !position.canPrevious ? <button className="button button-secondary" onClick={() => { const p = new URLSearchParams(url); p.delete('cursor'); navigate(p); }}>Về trang đầu</button> : null}
      <button className="button button-secondary" disabled={!next} onClick={() => { if (!next) return; setCursorHistory(old => advanceCursor(old, scope, cursor, next)); const p = new URLSearchParams(url); p.set('cursor', next); navigate(p); }}>Trang tiếp theo</button></div>
    </nav> : null}
  </SessionGate>;
}
