'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { MAX_NOTE_MENTIONS, mentionCandidateListSchema, type MentionCandidate } from '@mobiflow/contracts';
import { api, ApiFailure } from '@/lib/session';

export function MentionSelector({ requestId, selected, onChange, disabled, onDenied }: { requestId: string; selected: MentionCandidate[]; onChange: (rows: MentionCandidate[]) => void; disabled: boolean; onDenied: () => void }) {
  const id = useId(), input = useRef<HTMLInputElement>(null);
  const [q, setQuery] = useState(''), [rows, setRows] = useState<MentionCandidate[]>([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const denied = useRef(onDenied); useEffect(() => { denied.current = onDenied; }, [onDenied]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api('/requests/' + requestId + '/mention-candidates?q=' + encodeURIComponent(q), mentionCandidateListSchema, undefined, 'GET', controller.signal)
        .then(result => { if (!controller.signal.aborted) { setRows(result.data); setError(''); setActive(-1); } })
        .catch(failure => { if (!controller.signal.aborted) { setRows([]); setError('Không thể tải người có thể nhắc đến. Vui lòng thử lại.'); if (failure instanceof ApiFailure && [401, 403, 404].includes(failure.status)) denied.current(); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestId, q, revision]);
  function select(row: MentionCandidate) {
    const exists = selected.some(user => user.id === row.id);
    if (exists) onChange(selected.filter(user => user.id !== row.id));
    else if (selected.length < MAX_NOTE_MENTIONS) onChange([...selected, row]);
    input.current?.focus();
  }
  return <div className="mention-selector">
    <label htmlFor={id}>Nhắc đến</label>
    <p id={id + '-help'} className="mention-help">Chọn người nhận thông báo. Chỉ gõ @tên trong nội dung sẽ không gửi thông báo.</p>
    {selected.length ? <ul className="mention-chips" aria-label="Người đã chọn">{selected.map(user => <li key={user.id} data-mention-id={user.id}>
      <span>{user.displayName}</span><button type="button" disabled={disabled} aria-label={'Bỏ nhắc ' + user.displayName} onClick={() => { onChange(selected.filter(row => row.id !== user.id)); input.current?.focus(); }}>×</button>
    </li>)}</ul> : null}
    <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id + '-list'} aria-activedescendant={open && active >= 0 && rows[active] ? id + '-option-' + active : undefined}
      aria-describedby={id + '-help ' + id + '-state'} autoComplete="off" value={q} disabled={disabled} maxLength={160} placeholder="Tìm người được phân quyền…"
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onChange={event => { setQuery(Array.from(event.target.value).slice(0, 80).join('')); setRows([]); setActive(-1); setLoading(true); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(current => rows.length ? current < 0 ? event.key === 'ArrowDown' ? 0 : rows.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length : -1); }
        else if (event.key === 'Enter' && open) { event.preventDefault(); if (rows[active]) select(rows[active]); }
      }} />
    <p id={id + '-state'} role="status" className="mention-help">{loading ? 'Đang tìm người có thể nhắc đến…' : selected.length + ' / ' + MAX_NOTE_MENTIONS + ' người đã chọn.'}</p>
    {error ? <div role="alert" className="form-error"><p>{error}</p><button type="button" className="button button-secondary" disabled={disabled || loading} onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Tải lại người nhận</button></div> : null}
    {open ? <div id={id + '-list'} role="listbox" aria-label="Người có thể nhắc đến" aria-multiselectable="true" className="mention-options">
      {rows.map((row, index) => <div role="option" id={id + '-option-' + index} key={row.id} data-candidate-id={row.id} aria-selected={selected.some(user => user.id === row.id)}
        aria-disabled={disabled || (!selected.some(user => user.id === row.id) && selected.length >= MAX_NOTE_MENTIONS)} className={active === index ? 'is-active' : ''}
        onMouseDown={event => event.preventDefault()} onClick={() => { if (!disabled) select(row); }}>
        <span>{row.displayName}</span><small>{row.role === 'MANAGER' ? 'Quản lý' : 'Nhân viên'}</small>
      </div>)}
    </div> : null}
    {open && !loading && !error && !rows.length ? <p className="mention-help">Không có người phù hợp trong phạm vi yêu cầu.</p> : null}
  </div>;
}
