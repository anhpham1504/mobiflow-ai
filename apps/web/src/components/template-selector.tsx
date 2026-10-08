'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { templateDetailResponseSchema, templateListResponseSchema, type TemplateRevision, type TemplateSummary, type TemplateType } from '@mobiflow/contracts';
import { api } from '@/lib/session';

export function TemplatePreview({ revision }: { revision: TemplateRevision }) {
  return <div className="template-preview"><strong>{revision.name} · Phiên bản {revision.revision}</strong>{revision.description ? <p className="preserve-text">{revision.description}</p> : null}
    {revision.type === 'RESPONSE' ? <p className="preserve-text">{revision.content.body}</p> : <ol>{revision.content.items.map((item, i) => <li key={i}>{item.text} {item.required ? '(bắt buộc)' : '(tùy chọn)'}</li>)}</ol>}</div>;
}

export function TemplateSelector({ type, hasDraft, disabled, onApply, onApplyingChange, context }: { type: TemplateType; hasDraft: boolean; disabled: boolean; onApply: (revision: TemplateRevision) => void; onApplyingChange: (applying: boolean) => void; context?: string }) {
  const label = type === 'RESPONSE' ? 'Mẫu phản hồi' : 'Mẫu checklist', id = useId();
  const [rows, setRows] = useState<TemplateSummary[]>([]), [next, setNext] = useState<string | null>(null), [selected, setSelected] = useState(''), [preview, setPreview] = useState<TemplateRevision | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [confirm, setConfirm] = useState(false), [notice, setNotice] = useState('');
  const selectionController = useRef<AbortController | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null), applyButton = useRef<HTMLButtonElement>(null);
  const returnApplyFocus = useRef(false);
  const fetchRows = useCallback((cursor?: string, signal?: AbortSignal) => api('/templates?type=' + type + '&status=ACTIVE&limit=20' + (search.trim() ? '&q=' + encodeURIComponent(search.trim()) : '') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), templateListResponseSchema, undefined, 'GET', signal), [type, search]);
  const load = async (cursor?: string) => {
    setLoading(true); setError('');
    try { const response = await fetchRows(cursor);
      setRows(old => cursor ? [...old, ...response.data] : response.data); setNext(response.page.nextCursor);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  // Search is explicit; typing never replaces a selected preview or an existing draft.
  useEffect(() => { const controller = new AbortController(); void fetchRows(undefined, controller.signal).then(response => { if (!controller.signal.aborted) { setRows(response.data); setNext(response.page.nextCursor); } }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [fetchRows]);
  useEffect(() => { if (confirm && !busy && !disabled) confirmButton.current?.focus(); else if (!confirm && !busy && !disabled && returnApplyFocus.current) { returnApplyFocus.current = false; applyButton.current?.focus(); } }, [confirm, busy, disabled]);
  useEffect(() => () => selectionController.current?.abort(), []);
  async function select(value: string) {
    selectionController.current?.abort(); const controller = new AbortController(); selectionController.current = controller;
    setSelected(value); setPreview(null); setConfirm(false); setNotice(''); setError('');
    if (!value) { setBusy(false); return; }
    setBusy(true);
    try { const response = await api('/templates/' + value, templateDetailResponseSchema, undefined, 'GET', controller.signal); if (controller.signal.aborted) return; if (response.data.status !== 'ACTIVE' || response.data.type !== type) throw new Error('Mẫu này không còn khả dụng. Chọn mẫu đang hoạt động.'); setPreview(response.data.current); }
    catch (e) { if (!controller.signal.aborted) setError((e as Error).message); } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function apply() {
    if (!preview || disabled || busy) return;
    setBusy(true); onApplyingChange(true); setError('');
    try {
      const response = await api('/templates/' + selected, templateDetailResponseSchema);
      if (response.data.status !== 'ACTIVE' || response.data.type !== type || response.data.current.id !== preview.id) throw new Error('Mẫu đã thay đổi hoặc lưu trữ. Xem lại mẫu trước khi áp dụng.');
      onApply(response.data.current); returnApplyFocus.current = true; setConfirm(false); setNotice('Đã chép vào bản nháp. Bạn có thể chỉnh sửa trước khi gửi hoặc lưu.');
    } catch (e) { returnApplyFocus.current = true; setConfirm(false); setError((e as Error).message); } finally { setBusy(false); onApplyingChange(false); }
  }
  return <section className="template-selector" aria-labelledby={id + '-heading'}>
    <h3 id={id + '-heading'}>{label}{context ? ' — ' + context : ''}</h3><p>Chỉ chuẩn bị bản nháp. Bạn quyết định nội dung và thực hiện thao tác tiếp theo.</p>
    <label htmlFor={id + '-search'}>Tìm {label.toLocaleLowerCase('vi')}<input id={id + '-search'} value={query} maxLength={120} onChange={e => { setQuery(e.target.value); }} disabled={disabled || busy} /></label>
    <button type="button" disabled={disabled || busy || loading} onClick={() => { setSelected(''); setPreview(null); setConfirm(false); setLoading(true); setError(''); if (query === search) void load(); else setSearch(query); }}>Tìm mẫu</button>
    {loading ? <p role="status">Đang tải mẫu…</p> : null}
    {!loading && !rows.length && !error ? <p>{type === 'RESPONSE' ? 'Chưa có mẫu phản hồi khả dụng.' : 'Chưa có mẫu checklist khả dụng.'} Bạn vẫn có thể nhập thủ công.</p> : null}
    {rows.length ? <label htmlFor={id + '-select'}>Chọn mẫu<select id={id + '-select'} value={selected} disabled={disabled || busy || loading} onChange={e => { void select(e.target.value); }}><option value="">Chọn mẫu để xem trước</option>{rows.map(row => <option key={row.id} value={row.id}>{row.name} · v{row.currentRevision}</option>)}</select></label> : null}
    {next ? <button type="button" disabled={disabled || busy || loading} onClick={() => { void load(next); }}>Xem thêm mẫu</button> : null}
    {busy ? <p role="status">Đang kiểm tra mẫu…</p> : null}
    {error ? <div className="form-error" role="alert"><p>{error}</p><button type="button" disabled={disabled || busy || loading} onClick={() => { if (selected) void select(selected); else void load(); }}>Thử lại tải mẫu</button></div> : null}
    {preview ? <><TemplatePreview revision={preview} /><button ref={applyButton} type="button" disabled={disabled || busy || confirm} onClick={() => { if (hasDraft) setConfirm(true); else void apply(); }}>Áp dụng vào bản nháp</button>
      <button type="button" disabled={disabled || busy} onClick={() => { setSelected(''); setPreview(null); setConfirm(false); }}>Bỏ chọn mẫu</button></> : null}
    {confirm ? <div className="template-confirm" role="group" aria-label="Xác nhận thay thế bản nháp"><p>Bản nháp hiện có sẽ được thay thế. Các thay đổi chưa lưu sẽ mất.</p><button ref={confirmButton} type="button" disabled={disabled || busy} onClick={() => { void apply(); }}>Xác nhận thay thế bản nháp</button><button type="button" disabled={busy} onClick={() => { returnApplyFocus.current = true; setConfirm(false); }}>Giữ bản nháp hiện tại</button></div> : null}
    {notice ? <p role="status">{notice}</p> : null}
  </section>;
}
