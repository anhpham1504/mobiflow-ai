'use client';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createTemplateSchema, createTemplateRevisionSchema, templateDetailResponseSchema, templateHistoryResponseSchema, templateListResponseSchema, type ChecklistTemplateItem, type TemplateDetail, type TemplateRevision, type TemplateSummary, type TemplateType } from '@mobiflow/contracts';
import { api, getProfile, serverProfile, subscribe } from '@/lib/session';
import { SessionGate } from './session-shell';
import { PageHeader } from './ui/patterns';
import { ChecklistDraftEditor } from './checklist-draft-editor';
import { TemplatePreview } from './template-selector';
import { formatTime } from './request-list';
import { fieldErrors, focusFirstInvalid, type FieldErrors } from '@/lib/form-errors';

function TemplateEditor({ current, onSaved, onCancel }: { current: TemplateDetail | null; onSaved: (detail: TemplateDetail) => void; onCancel: () => void }) {
  const [type, setType] = useState<TemplateType>(current?.type ?? 'RESPONSE'), [items, setItems] = useState<ChecklistTemplateItem[]>(current?.current.type === 'CHECKLIST' ? current.current.content.items : [{ text: '', required: true }]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [invalid, setInvalid] = useState<FieldErrors>({}), id = useId();
  async function save(form: HTMLFormElement) {
    const values = new FormData(form), input = { type, name: String(values.get('name')), ...(String(values.get('description')).trim() ? { description: String(values.get('description')) } : {}), content: type === 'RESPONSE' ? { body: String(values.get('body')) } : { items }, ...(current ? { expectedRevision: current.currentRevision } : {}) };
    const checked = (current ? createTemplateRevisionSchema : createTemplateSchema).safeParse(input);
    if (!checked.success) {
      const errors = fieldErrors(checked.error.issues, { name: 'Tên mẫu cần từ 1 đến 120 ký tự.', description: 'Mô tả tối đa 500 ký tự.', 'content.body': 'Phản hồi cần từ 1 đến 4.000 ký tự.', 'content.items': 'Checklist cần từ 1 đến 30 bước.', 'content.items.*.text': 'Nội dung bước cần từ 1 đến 500 ký tự.' });
      setInvalid(errors); setError(''); focusFirstInvalid(form, errors); return;
    }
    setInvalid({}); setBusy(true); setError('');
    try { const response = await api(current ? '/templates/' + current.id + '/revisions' : '/templates', templateDetailResponseSchema, checked.data, 'POST'); onSaved(response.data); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="workflow-card"><form className="action-form" onKeyDown={e => { if (e.key === 'Escape' && !busy) { e.preventDefault(); onCancel(); } }} onSubmit={e => { e.preventDefault(); void save(e.currentTarget); }}><fieldset disabled={busy}>
    <legend>{current ? 'Tạo phiên bản mới' : 'Tạo mẫu'}</legend><p>Chỉ lưu mẫu vào thư viện. Nội dung sẽ cần con người kiểm tra và thực hiện thao tác nghiệp vụ.</p>
    {current ? <p>Loại: {type === 'RESPONSE' ? 'Phản hồi' : 'Checklist'} · Dựa trên phiên bản {current.currentRevision}</p> : <label>Loại mẫu<select value={type} onChange={e => setType(e.target.value as TemplateType)}><option value="RESPONSE">Phản hồi</option><option value="CHECKLIST">Checklist</option></select></label>}
    <label>Tên mẫu<input name="name" data-error-field="name" aria-invalid={!!invalid.name} aria-describedby={invalid.name ? id + '-name-error' : undefined} required maxLength={240} defaultValue={current?.name ?? ''} autoFocus /></label>
    {invalid.name ? <p className="field-error" role="alert" id={id + '-name-error'}>{invalid.name}</p> : null}
    <label>Mô tả (không bắt buộc)<textarea name="description" data-error-field="description" aria-invalid={!!invalid.description} aria-describedby={invalid.description ? id + '-description-error' : undefined} rows={2} maxLength={1000} defaultValue={current?.description ?? ''} /></label>
    {invalid.description ? <p className="field-error" role="alert" id={id + '-description-error'}>{invalid.description}</p> : null}
    {type === 'RESPONSE' ? <><label>Nội dung phản hồi<textarea name="body" data-error-field="content.body" aria-invalid={!!invalid['content.body']} aria-describedby={invalid['content.body'] ? id + '-body-error' : undefined} rows={6} maxLength={8000} required defaultValue={current?.current.type === 'RESPONSE' ? current.current.content.body : ''} /></label>{invalid['content.body'] ? <p className="field-error" role="alert" id={id + '-body-error'}>{invalid['content.body']}</p> : null}</> : <ChecklistDraftEditor items={items} onChange={setItems} disabled={busy} errors={invalid} />}
    {error ? <p className="form-error" role="alert">{error} Nếu phiên bản đã thay đổi, đóng biểu mẫu và tải lại để xem trước khi sửa tiếp.</p> : null}
    <div className="template-actions"><button disabled={busy}>{busy ? 'Đang lưu…' : current ? 'Lưu phiên bản mới' : 'Lưu mẫu'}</button><button type="button" disabled={busy} onClick={onCancel}>Đóng biểu mẫu</button></div>
  </fieldset></form></section>;
}

export function TemplateManagement() {
  const profile = useSyncExternalStore(subscribe, getProfile, serverProfile);
  return <SessionGate role="MANAGER">{profile?.role === 'MANAGER' ? <ManagementContent key={profile.id} /> : null}</SessionGate>;
}
function ManagementContent() {
  const [rows, setRows] = useState<TemplateSummary[]>([]), [next, setNext] = useState<string | null>(null), [type, setType] = useState(''), [status, setStatus] = useState('ACTIVE'), [q, setQ] = useState(''), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [detail, setDetail] = useState<TemplateDetail | null>(null), [editing, setEditing] = useState(false), [creating, setCreating] = useState(false);
  const [history, setHistory] = useState<TemplateRevision[]>([]), [historyNext, setHistoryNext] = useState<string | null>(null), [historyLoaded, setHistoryLoaded] = useState(false), [confirmArchive, setConfirmArchive] = useState(false);
  const archiveButton = useRef<HTMLButtonElement>(null), confirmButton = useRef<HTMLButtonElement>(null);
  const returnArchiveFocus = useRef(false);
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  const closeEditor = () => { setEditing(false); setCreating(false); requestAnimationFrame(() => editorTrigger.current?.focus()); };
  const fetchRows = useCallback((cursor?: string, signal?: AbortSignal) => api('/templates?status=' + status + '&limit=20' + (type ? '&type=' + type : '') + (search ? '&q=' + encodeURIComponent(search) : '') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), templateListResponseSchema, undefined, 'GET', signal), [type, status, search]);
  const load = async (cursor?: string) => {
    setLoading(true); setError('');
    try { const result = await fetchRows(cursor); setRows(old => cursor ? [...old, ...result.data] : result.data); setNext(result.page.nextCursor); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); void fetchRows(undefined, controller.signal).then(result => { if (!controller.signal.aborted) { setRows(result.data); setNext(result.page.nextCursor); } }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [fetchRows]);
  useEffect(() => { if (confirmArchive && !busy) confirmButton.current?.focus(); else if (!confirmArchive && !busy && !editing && returnArchiveFocus.current) { returnArchiveFocus.current = false; archiveButton.current?.focus(); } }, [confirmArchive, busy, editing]);
  async function open(id: string) {
    setBusy(true); setError(''); setDetail(null); setHistory([]); setHistoryLoaded(false); setHistoryNext(null); setConfirmArchive(false); setEditing(false); setCreating(false);
    try { setDetail((await api('/templates/' + id, templateDetailResponseSchema)).data); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function loadHistory(cursor?: string) {
    if (!detail) return; setBusy(true); setError('');
    try { const result = await api('/templates/' + detail.id + '/revisions?limit=20' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), templateHistoryResponseSchema); setHistory(old => cursor ? [...old, ...result.data] : result.data); setHistoryNext(result.page.nextCursor); setHistoryLoaded(true); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function archive() {
    if (!detail) return; setBusy(true); setError('');
    try { const result = await api('/templates/' + detail.id + '/archive', templateDetailResponseSchema, { expectedRevision: detail.currentRevision }, 'POST'); setDetail(result.data); setConfirmArchive(false); setNotice('Đã lưu trữ mẫu. Lịch sử và các nguồn mẫu đã sử dụng được giữ nguyên.'); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function saved(result: TemplateDetail) { setDetail(result); setEditing(false); setCreating(false); setHistory([]); setHistoryLoaded(false); setHistoryNext(null); setNotice('Đã lưu mẫu phiên bản ' + result.currentRevision + '.'); void load(); }
  return <><PageHeader title="Mẫu phản hồi và checklist" description="Thư viện nội bộ để chuẩn bị bản nháp. Mỗi phiên bản được giữ nguyên để tra cứu lịch sử." actions={<button disabled={busy} onClick={e => { editorTrigger.current = e.currentTarget; setCreating(true); setEditing(false); setDetail(null); setError(''); setNotice(''); }}>Tạo mẫu</button>} />
    <section className="workflow-card"><form className="template-filters" onSubmit={e => { e.preventDefault(); setLoading(true); setError(''); if (q.trim() === search) void load(); else setSearch(q.trim()); }}><label>Tìm theo tên hoặc mô tả<input maxLength={120} value={q} onChange={e => setQ(e.target.value)} /></label><label>Loại<select value={type} onChange={e => { setLoading(true); setError(''); setType(e.target.value); }}><option value="">Tất cả</option><option value="RESPONSE">Phản hồi</option><option value="CHECKLIST">Checklist</option></select></label><label>Trạng thái<select value={status} onChange={e => { setLoading(true); setError(''); setStatus(e.target.value); }}><option value="ACTIVE">Đang hoạt động</option><option value="ARCHIVED">Đã lưu trữ</option></select></label><button disabled={loading}>Tìm kiếm</button></form>
      {loading ? <p role="status">Đang tải thư viện mẫu…</p> : null}{!loading && !rows.length && !error ? <p>Chưa có mẫu nào. Dùng “Tạo mẫu” để chuẩn bị mẫu mới.</p> : null}
      <ul className="template-list">{rows.map(row => <li key={row.id}><div><strong>{row.name}</strong><p>{row.type === 'RESPONSE' ? 'Phản hồi' : 'Checklist'} · Phiên bản {row.currentRevision} · {row.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ'}</p>{row.description ? <p>{row.description}</p> : null}</div><button disabled={busy} onClick={() => { void open(row.id); }} aria-label={'Xem mẫu ' + row.name}>Xem mẫu</button></li>)}</ul>
      {next ? <button disabled={loading || busy} onClick={() => { void load(next); }}>Xem thêm</button> : null}</section>
    {error ? <div className="form-error" role="alert"><p>{error}</p><button disabled={busy || loading} onClick={() => { if (detail) void open(detail.id); else void load(); }}>Tải lại mẫu</button></div> : null}
    {busy ? <p role="status">Đang tải hoặc lưu mẫu…</p> : null}{notice ? <p role="status" className="success-notice">{notice}</p> : null}
    {creating ? <TemplateEditor key="create" current={null} onSaved={saved} onCancel={closeEditor} /> : null}
    {detail ? <section className="workflow-card"><h2>Chi tiết mẫu</h2><p>{detail.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã lưu trữ — chỉ tra cứu lịch sử'} · {formatTime(detail.updatedAt)}</p><TemplatePreview revision={detail.current} />
      <div className="template-actions">{detail.status === 'ACTIVE' ? <><button disabled={busy || editing || confirmArchive} onClick={e => { editorTrigger.current = e.currentTarget; setEditing(true); }}>Tạo phiên bản mới</button><button ref={archiveButton} disabled={busy || editing || confirmArchive} onClick={() => setConfirmArchive(true)}>Lưu trữ mẫu</button></> : null}<button disabled={busy} onClick={() => { void loadHistory(); }}>Xem lịch sử phiên bản</button><button disabled={busy} onClick={() => { void open(detail.id); }}>Tải lại chi tiết</button></div>
      {confirmArchive ? <div className="template-confirm" role="group" aria-label="Xác nhận lưu trữ mẫu"><p>Mẫu sẽ không còn được chọn cho bản nháp mới. Lịch sử được giữ nguyên; không thể khôi phục mẫu trong phiên bản này.</p><button ref={confirmButton} disabled={busy} onClick={() => { void archive(); }}>Xác nhận lưu trữ</button><button disabled={busy} onClick={() => { returnArchiveFocus.current = true; setConfirmArchive(false); }}>Giữ mẫu hoạt động</button></div> : null}
      {historyLoaded ? <div className="template-history"><h3>Lịch sử phiên bản</h3>{history.map(revision => <article key={revision.id}><TemplatePreview revision={revision} /><small>{formatTime(revision.createdAt)}</small></article>)}{historyNext ? <button disabled={busy} onClick={() => { void loadHistory(historyNext); }}>Xem phiên bản trước</button> : null}</div> : null}
    </section> : null}
    {editing && detail ? <TemplateEditor key={detail.current.id} current={detail} onSaved={saved} onCancel={closeEditor} /> : null}
  </>;
}
