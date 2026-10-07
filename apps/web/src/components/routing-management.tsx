'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ROUTING_FIELD_DEFINITIONS, routingFields, routingStatuses, createRoutingRuleSchema, createRoutingRevisionSchema, routingListResponseSchema, routingDetailResponseSchema, routingHistoryResponseSchema, routingTargetsResponseSchema, type RoutingCondition, type RoutingRule, type RoutingRevision, type RoutingTargetView } from '@mobiflow/contracts';
import { api, getProfile, serverProfile, subscribe } from '@/lib/session';
import { SessionGate } from './session-shell';
import { PageHeader } from './ui/patterns';
import { formatTime } from './request-list';
import {categoryLabels,priorityLabels,subcategoryLabels} from '@/lib/presentation-labels';
const routingLabels={category:categoryLabels,subcategory:subcategoryLabels,priority:priorityLabels};

const fieldLabels = { category: 'Nhóm vấn đề', subcategory: 'Phân loại chi tiết', priority: 'Mức ưu tiên yêu cầu' };
const statusLabels = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Chưa hoạt động', ARCHIVED: 'Đã lưu trữ' };
const firstCondition: RoutingCondition = { field: 'priority', operator: 'EQ', values: ['MEDIUM'] };
function RuleDefinition({ revision, targets }: { revision: RoutingRevision; targets: RoutingTargetView[] }) {
  return <div><h3>{revision.name}</h3>{revision.description ? <p className="preserve-text">{revision.description}</p> : null}<p>Phiên bản {revision.revision} · Ưu tiên {revision.priority} · {formatTime(revision.createdAt)}</p><p>Nhóm: {targets.find(target => target.id === revision.target.id)?.displayName ?? 'Nhóm hiện không khả dụng'} <small>({revision.target.id})</small></p><ul>{revision.conditions.map((condition, index) => <li key={index}>{fieldLabels[condition.field]} {condition.operator==='EQ'?'bằng':'thuộc'} {condition.values.map(value=>routingLabels[condition.field][value]??value).join(', ')}</li>)}</ul></div>;
}
function RuleEditor({ current, targets, onSaved, onClose }: { current: RoutingRule | null; targets: RoutingTargetView[]; onSaved: (rule: RoutingRule) => void; onClose: () => void }) {
  const [conditions, setConditions] = useState<RoutingCondition[]>(current?.current.conditions ?? [firstCondition]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const update = (index: number, condition: RoutingCondition) => setConditions(old => old.map((item, i) => i === index ? condition : item));
  async function save(form: HTMLFormElement) {
    const f = new FormData(form), input = { name: String(f.get('name')), ...(String(f.get('description')).trim() ? { description: String(f.get('description')) } : {}), priority: Number(f.get('priority')), target: { type: 'TEAM', id: String(f.get('target')) }, conditions, ...(current ? { expectedRevision: current.currentRevision, expectedRuleVersion: current.version } : {}) };
    const checked = (current ? createRoutingRevisionSchema : createRoutingRuleSchema).safeParse(input);
    if (!checked.success) { setError('Kiểm tra tên, nhóm đủ điều kiện, ưu tiên 1–10000 và 1–10 điều kiện với giá trị hợp lệ.'); return; }
    setBusy(true); setError('');
    try { onSaved((await api(current ? '/routing-rules/' + current.id + '/revisions' : '/routing-rules', routingDetailResponseSchema, checked.data)).data); }
    catch (e) { setError((e as Error).message + ' Nếu quy tắc đã thay đổi, đóng biểu mẫu và tải lại trước khi sửa tiếp.'); }
    finally { setBusy(false); }
  }
  return <section className="workflow-card"><form className="action-form" onKeyDown={e => { if (e.key === 'Escape' && !busy) { e.preventDefault(); onClose(); } }} onSubmit={e => { e.preventDefault(); void save(e.currentTarget); }}><fieldset disabled={busy}>
    <legend>{current ? 'Tạo phiên bản quy tắc mới' : 'Tạo quy tắc'}</legend><p>{current ? 'Phiên bản đã lưu được giữ nguyên trong lịch sử.' : 'Quy tắc mới chưa hoạt động. Bạn cần kích hoạt sau khi kiểm tra.'}</p>
    <label>Tên quy tắc<input name="name" required maxLength={240} autoFocus defaultValue={current?.current.name ?? ''} /></label>
    <label>Mô tả quy tắc<textarea name="description" maxLength={1000} defaultValue={current?.current.description ?? ''} /></label>
    <label>Ưu tiên quy tắc<input name="priority" type="number" min={1} max={10000} step={1} required defaultValue={current?.current.priority ?? 10} /></label><p>Số nhỏ hơn có ưu tiên cao hơn. Các điều kiện kết hợp bằng AND.</p>
    <label>Nhóm gợi ý<select name="target" required defaultValue={current?.current.target.id ?? ''}><option value="">Chọn nhóm đủ điều kiện</option>{targets.map(target => <option key={target.id} value={target.id}>{target.displayName}</option>)}</select></label>
    {conditions.map((condition, index) => <fieldset className="routing-condition" key={index}><legend>Điều kiện {index + 1}</legend>
      <label>Trường {index + 1}<select value={condition.field} onChange={e => { const field = e.target.value as typeof routingFields[number]; update(index, { field, operator: 'EQ', values: [ROUTING_FIELD_DEFINITIONS[field].options[0]!] } as RoutingCondition); }}>{routingFields.map(field => <option key={field} value={field}>{fieldLabels[field]}</option>)}</select></label>
      <label>Toán tử {index + 1}<select value={condition.operator} onChange={e => update(index, { ...condition, operator: e.target.value as 'EQ' | 'IN', values: condition.values.slice(0, 1) } as RoutingCondition)}><option value="EQ">EQ — bằng</option><option value="IN">IN — thuộc tập giá trị</option></select></label>
      <label>Giá trị {index + 1}<select key={condition.field + condition.operator} multiple={condition.operator === 'IN'} value={condition.operator === 'IN' ? condition.values : condition.values[0]} required onChange={e => update(index, { ...condition, values: Array.from(e.target.selectedOptions, option => option.value) } as RoutingCondition)}>{ROUTING_FIELD_DEFINITIONS[condition.field].options.map(option => <option key={option} value={option}>{routingLabels[condition.field][option]??option}</option>)}</select></label>
      {condition.operator === 'IN' ? <p>Chọn nhiều giá trị bằng Ctrl hoặc Shift trên bàn phím.</p> : null}
      <button type="button" disabled={conditions.length <= 1} onClick={() => setConditions(old => old.filter((_, i) => i !== index))}>Xóa điều kiện {index + 1}</button>
    </fieldset>)}
    <button type="button" disabled={conditions.length >= 10} onClick={() => setConditions(old => [...old, firstCondition])}>Thêm điều kiện</button>
    {error ? <p role="alert" className="form-error">{error}</p> : null}
    <div className="template-actions"><button>{busy ? 'Đang lưu…' : current ? 'Lưu phiên bản quy tắc' : 'Lưu quy tắc'}</button><button type="button" onClick={onClose}>Đóng biểu mẫu</button></div>
  </fieldset></form></section>;
}
export function RoutingManagement() {
  const profile = useSyncExternalStore(subscribe, getProfile, serverProfile);
  return <SessionGate role="MANAGER">{profile?.role === 'MANAGER' ? <Management key={profile.id} /> : null}</SessionGate>;
}
function Management() {
  const [rows, setRows] = useState<RoutingRule[]>([]), [targets, setTargets] = useState<RoutingTargetView[]>([]), [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState(''), [search, setSearch] = useState(''), [q, setQ] = useState(''), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<RoutingRule | null>(null), [editor, setEditor] = useState<'create' | 'revise' | null>(null), [history, setHistory] = useState<RoutingRevision[]>([]), [historyNext, setHistoryNext] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), detailHeading = useRef<HTMLHeadingElement>(null), generation = useRef(0);
  const createTrigger = useRef<HTMLButtonElement>(null), reviseTrigger = useRef<HTMLButtonElement>(null), editorOrigin = useRef<'create' | 'revise'>('create');
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) }).toString();
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    void Promise.all([api('/routing-rules?' + query, routingListResponseSchema, undefined, 'GET', signal), api('/routing-rules/targets', routingTargetsResponseSchema, undefined, 'GET', signal)])
      .then(([list, eligible]) => { if (!controller.signal.aborted) { setRows(list.data); setNext(list.page.nextCursor); setTargets(eligible.data); setError(''); } })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message); setRows([]); setDetail(null); setEditor(null); setTargets([]); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, refresh]);
  useEffect(() => () => { generation.current++; }, []);
  async function read(id: string) {
    const ticket = ++generation.current; setBusy(true); setError(''); setEditor(null); setHistory([]); setHistoryNext(null);
    try { const result = await api('/routing-rules/' + id, routingDetailResponseSchema); if (generation.current === ticket) { setDetail(result.data); requestAnimationFrame(() => detailHeading.current?.focus()); } }
    catch (e) { if (generation.current === ticket) { setError((e as Error).message); setDetail(null); } }
    finally { if (generation.current === ticket) setBusy(false); }
  }
  async function lifecycle(command: 'activate' | 'deactivate' | 'archive') {
    if (!detail || busy) return; setBusy(true); setError('');
    try { const result = await api('/routing-rules/' + detail.id + '/' + command, routingDetailResponseSchema, { expectedRevision: detail.currentRevision, expectedRuleVersion: detail.version }); setDetail(result.data); setRefresh(n => n + 1); setNotice('Đã cập nhật trạng thái quy tắc.'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); dialog.current?.close(); }
  }
  async function moreHistory(cursor?: string) {
    if (!detail || busy) return; const id = detail.id; setBusy(true);
    try { const result = await api('/routing-rules/' + id + '/revisions' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), routingHistoryResponseSchema); setHistory(old => cursor ? [...old, ...result.data] : result.data); setHistoryNext(result.page.nextCursor); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function more() {
    if (!next || busy) return; setBusy(true);
    try { const result = await api('/routing-rules?' + query + '&cursor=' + encodeURIComponent(next), routingListResponseSchema); setRows(old => [...old, ...result.data]); setNext(result.page.nextCursor); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const closeEditor = () => { setEditor(null); requestAnimationFrame(() => (editorOrigin.current === 'create' ? createTrigger : reviseTrigger).current?.focus()); };
  return <>
    <PageHeader title="Quy tắc định tuyến" description="Gợi ý nhóm từ thông tin đã lưu; quản lý vẫn kiểm tra và xác nhận phân công." actions={<button ref={createTrigger} disabled={busy || loading} onClick={() => { editorOrigin.current = 'create'; setDetail(null); setEditor('create'); setNotice(''); }}>Tạo quy tắc</button>} />
    <form className="filter-bar" onSubmit={e => { e.preventDefault(); setLoading(true); setQ(search); setRefresh(n => n + 1); }}><label>Tìm quy tắc<input value={search} maxLength={120} disabled={busy} onChange={e => setSearch(e.target.value)} /></label><label>Trạng thái quy tắc<select value={status} disabled={busy} onChange={e => { setLoading(true); setStatus(e.target.value); }}>{['', ...routingStatuses].map(value => <option key={value} value={value}>{value ? statusLabels[value as keyof typeof statusLabels] : 'Tất cả trạng thái'}</option>)}</select></label><button disabled={busy}>Tìm kiếm</button><button type="button" disabled={busy} onClick={() => { setLoading(true); setRefresh(n => n + 1); }}>Tải lại danh sách</button></form>
    {loading ? <p role="status">Đang tải quy tắc…</p> : null}{error ? <p role="alert" className="form-error">{error} <button onClick={() => { setLoading(true); setRefresh(n => n + 1); }}>Thử lại</button></p> : null}{notice ? <p role="status">{notice}</p> : null}
    {editor ? <RuleEditor key={editor + (detail?.id ?? '') + (detail?.version ?? 0)} current={editor === 'revise' ? detail : null} targets={targets} onClose={closeEditor} onSaved={rule => { setDetail(rule); setEditor(null); setHistory([]); setHistoryNext(null); setRefresh(n => n + 1); setNotice('Đã lưu quy tắc.'); requestAnimationFrame(() => detailHeading.current?.focus()); }} /> : null}
    {!loading && !rows.length && !error ? <p>Chưa có quy tắc phù hợp. Bạn vẫn có thể phân công thủ công.</p> : null}
    <div className="routing-list">{rows.map(rule => <article className="workflow-card" key={rule.id}><h2>{rule.current.name}</h2><p>{statusLabels[rule.status]} · Phiên bản {rule.currentRevision} · Ưu tiên {rule.current.priority}</p><button disabled={busy} onClick={() => { void read(rule.id); }}>Xem quy tắc: {rule.current.name}</button></article>)}</div>
    {next ? <button disabled={busy || loading} onClick={() => { void more(); }}>Xem thêm quy tắc</button> : null}
    {detail && !editor ? <section className="workflow-card routing-detail"><h2 ref={detailHeading} tabIndex={-1}>Chi tiết quy tắc</h2><p>{statusLabels[detail.status]}</p><RuleDefinition revision={detail.current} targets={targets} />
      <div className="template-actions"><button disabled={busy} onClick={() => { void read(detail.id); }}>Tải lại quy tắc</button>{detail.status !== 'ARCHIVED' ? <><button disabled={busy} onClick={() => { editorOrigin.current = 'revise'; setEditor('revise'); }} ref={reviseTrigger}>Tạo phiên bản mới</button><button disabled={busy} onClick={() => { void lifecycle(detail.status === 'ACTIVE' ? 'deactivate' : 'activate'); }}>{detail.status === 'ACTIVE' ? 'Ngừng hoạt động' : 'Kích hoạt'}</button><button disabled={busy} onClick={() => dialog.current?.showModal()}>Lưu trữ quy tắc</button></> : null}<button disabled={busy} onClick={() => { void moreHistory(); }}>Xem lịch sử phiên bản</button></div>
      {history.length ? <section aria-label="Lịch sử phiên bản quy tắc"><h3>Lịch sử phiên bản</h3>{history.map(revision => <RuleDefinition key={revision.id} revision={revision} targets={targets} />)}{historyNext ? <button disabled={busy} onClick={() => { void moreHistory(historyNext); }}>Xem phiên bản trước</button> : null}</section> : null}
      <dialog ref={dialog} className="routing-confirm" aria-labelledby="routing-archive-title"><h2 id="routing-archive-title">Lưu trữ quy tắc?</h2><p>{detail.current.name} sẽ ngừng được đánh giá. Lịch sử được giữ nguyên và không thể khôi phục hoạt động.</p><div className="template-actions"><button disabled={busy} onClick={() => { void lifecycle('archive'); }}>Xác nhận lưu trữ</button><button disabled={busy} onClick={() => dialog.current?.close()}>Hủy lưu trữ</button></div></dialog>
    </section> : null}
  </>;
}
