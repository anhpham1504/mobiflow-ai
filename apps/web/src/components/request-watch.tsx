'use client';
import { useEffect, useRef, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { watchStateResponseSchema } from '@mobiflow/contracts';
import { api, ApiFailure } from '@/lib/session';

export function RequestWatch({ requestId }: { requestId: string }) {
  const [watching, setWatching] = useState(false), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(true);
  const [error, setError] = useState(''), [denied, setDenied] = useState(false), [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const button = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false);
  const path = '/requests/' + requestId + '/watch';
  useEffect(() => {
    if (!busy && restoreFocus.current) {
      restoreFocus.current = false;
      if (document.activeElement === document.body || document.activeElement === button.current) button.current?.focus();
    }
  }, [busy]);
  useEffect(() => {
    const controller = new AbortController();
    void api(path, watchStateResponseSchema, undefined, 'GET', controller.signal)
      .then(result => { if (!controller.signal.aborted) { setWatching(result.data.watching); setLoaded(true); setDenied(false); setError(''); } })
      .catch(failure => { if (!controller.signal.aborted) { setError('Không thể tải trạng thái theo dõi. Vui lòng thử lại.'); if (failure instanceof ApiFailure && [401, 403, 404].includes(failure.status)) { setLoaded(false); setDenied(true); } } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [path, revision]);
  async function toggle() {
    if (pending.current || busy || !loaded || denied) return;
    pending.current = true; restoreFocus.current = document.activeElement === button.current; setBusy(true); setError('');
    try { const result = await api(path, watchStateResponseSchema, {}, watching ? 'DELETE' : 'PUT'); setWatching(result.data.watching); }
    catch (failure) { setError('Không thể đổi trạng thái theo dõi. Vui lòng thử lại.'); if (failure instanceof ApiFailure && [401, 403, 404].includes(failure.status)) { setLoaded(false); setDenied(true); } }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="request-watch">
    <button ref={button} type="button" className="button button-secondary" aria-pressed={watching} disabled={busy || !loaded || denied} onClick={() => { void toggle(); }}>
      <Eye size={16} aria-hidden="true" />{busy ? 'Đang tải theo dõi…' : watching ? 'Đang theo dõi · Bỏ theo dõi' : 'Theo dõi'}
    </button>
    {error ? <div role="alert" className="form-error"><p>{error}</p><button type="button" className="button button-secondary" disabled={busy} onClick={() => { setBusy(true); setRevision(value => value + 1); }}><RefreshCw size={16} aria-hidden="true" />Tải lại theo dõi</button></div> : null}
  </div>;
}
