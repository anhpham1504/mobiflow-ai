'use client';
import { useEffect, useRef, useState } from 'react';
import { createSavedViewSchema, savedViewDeletedSchema, savedViewListSchema, savedViewResponseSchema, sameRequestFilters,
  type RequestFilters, type SavedRequestView } from '@mobiflow/contracts';
import { api, ApiFailure } from '@/lib/session';

function failure(error: unknown) {
  if (error instanceof ApiFailure) {
    if (error.code === 'SAVED_VIEW_NAME_CONFLICT') return 'Tên chế độ xem đã được sử dụng. Chọn tên khác.';
    if (error.code === 'SAVED_VIEW_LIMIT') return 'Bạn đã lưu 50 chế độ xem. Xóa một chế độ xem trước khi tạo thêm.';
    if (error.code === 'STALE_SAVED_VIEW') return 'Chế độ xem đã thay đổi ở nơi khác. Hủy và tải lại trước khi sửa hoặc xóa.';
  }
  return error instanceof Error ? error.message : 'Không thể tải chế độ xem. Bạn vẫn có thể lọc thủ công.';
}
export function SavedViews({ filters, selectedId, onChoose, onDeleted, disabled = false }: {
  filters: RequestFilters; selectedId: string; onChoose: (view: SavedRequestView) => void; onDeleted: () => void; disabled?: boolean;
}) {
  const [rows, setRows] = useState<SavedRequestView[]>([]), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<SavedRequestView | null>(null), [mode, setMode] = useState<'create' | 'update' | 'delete'>('create'), [formError, setFormError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), selector = useRef<HTMLSelectElement>(null), form = useRef<HTMLFormElement>(null), generation = useRef(0);
  const restoreFocus = useRef<string | null>(null);
  const selected = rows.find(row => row.id === selectedId), dirty = selected?.availability === 'AVAILABLE' && !sameRequestFilters(filters, selected.filters);
  useEffect(() => {
    const controller = new AbortController();
    void api('/saved-request-views', savedViewListSchema, undefined, 'GET', controller.signal)
      .then(result => { if (!controller.signal.aborted) { setRows(result.data); setError(''); } })
      .catch(e => { if (!controller.signal.aborted) setError(failure(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    // Navigation can move focus after a mutation; wait for its selected-view state to commit.
    if (busy || loading || restoreFocus.current === null || restoreFocus.current !== selectedId) return;
    const frame = requestAnimationFrame(() => { selector.current?.focus(); restoreFocus.current = null; });
    return () => cancelAnimationFrame(frame);
  }, [busy, loading, selectedId]);
  async function choose(id: string) {
    if (!id || busy) return;
    const ticket = ++generation.current; setBusy(true); setError(''); setNotice('');
    try {
      const result = await api('/saved-request-views/' + id, savedViewResponseSchema);
      if (generation.current !== ticket) return;
      setRows(old => old.map(row => row.id === id ? result.data : row));
      onChoose(result.data);
      setNotice(result.data.availability === 'AVAILABLE' ? 'Đã áp dụng chế độ xem.' : 'Chế độ xem không còn khả dụng. Bạn có thể thay toàn bộ bộ lọc hoặc xóa.');
    } catch (e) { if (generation.current === ticket) setError(failure(e)); }
    finally { if (generation.current === ticket) setBusy(false); }
  }
  function open(next: typeof mode) {
    setMode(next); setEditing(next === 'create' ? null : selected ?? null); setFormError('');
    requestAnimationFrame(() => { form.current?.reset(); dialog.current?.showModal(); });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const payload = createSavedViewSchema.safeParse({ name: new FormData(event.currentTarget).get('name'), filters });
    if (mode !== 'delete' && !payload.success) { setFormError('Nhập tên từ 1 đến 80 ký tự và kiểm tra bộ lọc.'); (event.currentTarget.elements.namedItem('name') as HTMLInputElement)?.focus(); return; }
    if (mode !== 'create' && !editing) return;
    const ticket = generation.current; setBusy(true); setFormError('');
    try {
      if (mode === 'delete' && editing) {
        await api('/saved-request-views/' + editing.id, savedViewDeletedSchema, { expectedVersion: editing.version }, 'DELETE');
        if (generation.current !== ticket) return;
        restoreFocus.current = '';
        setRows(old => old.filter(row => row.id !== editing.id)); onDeleted(); setNotice('Đã xóa chế độ xem.');
      } else if (payload.success) {
        const result = mode === 'update' && editing
          ? await api('/saved-request-views/' + editing.id, savedViewResponseSchema, { ...payload.data, expectedVersion: editing.version }, 'PUT')
          : await api('/saved-request-views', savedViewResponseSchema, payload.data);
        if (generation.current !== ticket) return;
        restoreFocus.current = result.data.id;
        setRows(old => mode === 'create' ? [result.data, ...old] : old.map(row => row.id === result.data.id ? result.data : row));
        onChoose(result.data); setNotice(mode === 'create' ? 'Đã lưu chế độ xem.' : 'Đã cập nhật chế độ xem.');
      }
      dialog.current?.close();
    } catch (e) { if (generation.current === ticket) setFormError(failure(e)); }
    finally { if (generation.current === ticket) setBusy(false); }
  }
  return <section className="saved-views" aria-label="Chế độ xem đã lưu">
    <div className="saved-views-controls"><label htmlFor="saved-view-selector">Chế độ xem đã lưu<select ref={selector} id="saved-view-selector" value={selected?.id ?? ''} disabled={loading || busy} onChange={e => { void choose(e.target.value); }}>
      <option value="">Chọn chế độ xem</option>{rows.map(row => <option key={row.id} value={row.id}>{row.name}{row.availability === 'UNAVAILABLE' ? ' — Không khả dụng' : ''}</option>)}
    </select></label><div className="filter-actions"><button className="button button-secondary" type="button" disabled={busy || !selected} onClick={() => { if (selected) void choose(selected.id); }}>Áp dụng chế độ xem</button><button className="button button-secondary" type="button" disabled={busy || disabled} onClick={() => open('create')}>Lưu chế độ xem</button>
      <button className="button button-secondary" type="button" disabled={busy || !selected || disabled} onClick={() => open('update')}>Cập nhật chế độ xem</button>
      <button className="button button-ghost" type="button" disabled={busy || !selected} onClick={() => open('delete')}>Xóa chế độ xem</button>
      <button className="button button-ghost" type="button" disabled={busy} onClick={() => { setLoading(true); setRefresh(n => n + 1); }}>Tải lại chế độ xem</button></div></div>
    <p className="saved-view-help">Chỉ lưu bộ lọc đã áp dụng. Tìm trong trang không được lưu. Thứ tự: mới nhất trước.</p>
    {loading ? <p role="status">Đang tải chế độ xem…</p> : !rows.length && !error ? <p>Bạn chưa lưu chế độ xem nào.</p> : null}
    {dirty ? <p role="status">Đã chỉnh sửa — chưa lưu thay đổi.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}{error ? <p role="alert">{error} Bạn vẫn có thể lọc thủ công.</p> : null}
    <dialog ref={dialog} className="saved-view-dialog" aria-labelledby="saved-view-title" onCancel={e => { if (busy) e.preventDefault(); }}>
      <form ref={form} key={mode + ':' + (editing?.id ?? '') + ':' + (editing?.version ?? '')} onSubmit={submit}>
        <h2 id="saved-view-title">{mode === 'delete' ? 'Xóa chế độ xem?' : mode === 'update' ? 'Cập nhật chế độ xem' : 'Lưu chế độ xem'}</h2>
        {mode === 'delete' ? <p>Xóa “{editing?.name}”? Các yêu cầu vẫn được giữ nguyên.</p> : <><label htmlFor="saved-view-name">Tên chế độ xem<input id="saved-view-name" name="name" required defaultValue={editing?.name ?? ''} aria-invalid={!!formError} aria-describedby={'saved-view-name-hint' + (formError ? ' saved-view-form-error' : '')} /></label><p id="saved-view-name-hint">1–80 ký tự. Bộ lọc đã áp dụng sẽ thay toàn bộ định nghĩa đang lưu.</p></>}
        {formError ? <p id="saved-view-form-error" role="alert">{formError}</p> : null}
        <div className="filter-actions"><button className={mode === 'delete' ? 'button button-danger' : 'button button-primary'} type="submit" disabled={busy}>{busy ? 'Đang lưu…' : mode === 'delete' ? 'Xác nhận xóa' : 'Lưu'}</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => dialog.current?.close()}>Hủy</button></div>
      </form>
    </dialog>
  </section>;
}
