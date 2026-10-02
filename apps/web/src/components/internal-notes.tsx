'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { RefreshCw, StickyNote } from 'lucide-react';
import { createInternalNoteSchema, INTERNAL_NOTE_MAX_LENGTH, internalNoteListSchema, internalNoteResponseSchema, type InternalNote, type RequestStatus } from '@mobiflow/contracts';
import { api, ApiFailure } from '@/lib/session';
import { formatTime } from './request-list';
import { LoadingState } from './ui/patterns';

export function InternalNotes({ requestId, status }: { requestId: string; status: RequestStatus }) {
  const labelId = useId();
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState('');
  const [body, setBody] = useState('');
  const [createError, setCreateError] = useState('');
  const [notice, setNotice] = useState('');
  const [posting, setPosting] = useState(false);
  const [denied, setDenied] = useState(false);
  const submitting = useRef(false);
  const lastCursor = useRef<string | undefined>(undefined);
  const path = '/requests/' + requestId + '/internal-notes';
  const readOnly = status === 'CLOSED' || status === 'CANCELED';
  const bodyLength = Array.from(body).length;

  const load = useCallback((cursor?: string, signal?: AbortSignal) => {
    lastCursor.current = cursor;
    return api(path + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), internalNoteListSchema, undefined, 'GET', signal).then(result => {
      if (signal?.aborted) return;
      setNotes(current => cursor ? [...current, ...result.data.filter(note => !current.some(old => old.id === note.id))] : result.data);
      setNext(result.page.nextCursor);
      setLoaded(true);
      setDenied(false);
    }).catch(error => {
      if (signal?.aborted) return;
      setListError('Không thể tải ghi chú nội bộ. Vui lòng thử lại.');
      if (error instanceof ApiFailure && [401, 403, 404].includes(error.status)) {
        setNotes([]); setNext(null); setLoaded(false); setDenied(true);
      }
    }).finally(() => {
      if (!signal?.aborted) setLoading(false);
    });
  }, [path]);

  function startLoad(cursor?: string) {
    setLoading(true);
    setListError('');
    void load(cursor);
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || loading || readOnly || denied) return;
    const input = createInternalNoteSchema.safeParse({ body });
    if (!input.success) { setCreateError('Nhập nội dung ghi chú từ 1 đến 4.000 ký tự.'); return; }
    submitting.current = true;
    setPosting(true); setCreateError(''); setNotice('');
    try {
      const result = await api(path, internalNoteResponseSchema, input.data);
      setNotes(current => [result.data, ...current.filter(note => note.id !== result.data.id)]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)));
      setLoaded(true);
      setBody('');
      setNotice('Đã thêm ghi chú nội bộ.');
    } catch (error) {
      setCreateError(error instanceof ApiFailure && error.code === 'INVALID_STATE'
        ? 'Yêu cầu đã đóng hoặc hủy. Hãy tải lại chi tiết để xem trạng thái mới.'
        : 'Không thể thêm ghi chú. Nội dung được giữ lại để bạn thử lại.');
      if (error instanceof ApiFailure && [401, 403, 404].includes(error.status)) {
        setNotes([]); setNext(null); setLoaded(false); setDenied(true);
      }
    } finally { submitting.current = false; setPosting(false); }
  }

  return <section className="workflow-card internal-notes" aria-labelledby={labelId + '-heading'}>
    <div className="internal-notes-heading">
      <div><h2 id={labelId + '-heading'}><StickyNote size={18} aria-hidden="true" />Ghi chú nội bộ</h2>
        <p id={labelId + '-helper'}>Chỉ nhân sự được phân quyền mới có thể xem các ghi chú này.</p></div>
      <button className="button button-secondary" type="button" onClick={() => startLoad()} disabled={loading || posting} aria-label="Tải lại ghi chú nội bộ"><RefreshCw size={16} aria-hidden="true" />Tải lại</button>
    </div>
    {loading ? <LoadingState label="Đang tải ghi chú nội bộ" /> : null}
    {listError ? <div className="form-error internal-notes-error" role="alert"><p>{listError}</p><button className="button button-secondary" type="button" disabled={loading || posting} onClick={() => startLoad(lastCursor.current)}>Thử lại</button></div> : null}
    {loaded && !denied ? notes.length === 0 && !loading
      ? <p className="internal-notes-empty">Chưa có ghi chú nội bộ.</p>
      : <ol className="internal-notes-list" aria-label="Ghi chú mới nhất trước">{notes.map(note => <li key={note.id}>
        <div className="internal-note-meta"><strong>{note.author.displayName}</strong><time dateTime={note.createdAt}>{formatTime(note.createdAt)}</time></div>
        <p className="preserve-text internal-note-body">{note.body}</p>
      </li>)}</ol> : null}
    {next && !denied ? <button className="button button-secondary" type="button" disabled={loading || posting} onClick={() => startLoad(next)}>Xem ghi chú trước đó</button> : null}
    {notice ? <p className="success-notice" role="status">{notice}</p> : null}
    {readOnly ? <p className="internal-notes-readonly">Yêu cầu đã đóng hoặc hủy. Ghi chú nội bộ chỉ có thể xem.</p>
      : <form className="internal-notes-composer" onSubmit={submit}>
        <label htmlFor={labelId + '-body'}>Nội dung ghi chú</label>
        <textarea id={labelId + '-body'} name="body" rows={4} required maxLength={INTERNAL_NOTE_MAX_LENGTH * 2}
          placeholder="Thêm ghi chú nội bộ..." value={body} onChange={event => { setBody(event.target.value); setCreateError(Array.from(event.target.value).length > INTERNAL_NOTE_MAX_LENGTH ? 'Giới hạn 4.000 ký tự. Vui lòng rút gọn ghi chú.' : ''); }}
          disabled={posting || denied} aria-invalid={createError ? true : undefined}
          aria-describedby={labelId + '-helper ' + labelId + '-limit' + (createError ? ' ' + labelId + '-error' : '')} />
        <div className="internal-notes-footer"><span id={labelId + '-limit'}>{bodyLength} / 4.000 ký tự</span>
          <button className="button" disabled={loading || posting || denied || !body.trim() || bodyLength > INTERNAL_NOTE_MAX_LENGTH}>{posting ? 'Đang thêm ghi chú…' : 'Thêm ghi chú'}</button></div>
        {createError ? <p id={labelId + '-error'} className="form-error" role="alert">{createError}</p> : null}
      </form>}
  </section>;
}
