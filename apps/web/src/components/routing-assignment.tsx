'use client';
import { useEffect, useRef, useState } from 'react';
import { routingEvaluationResponseSchema, type RoutingEvaluation, type StaffOption } from '@mobiflow/contracts';
import { api } from '@/lib/session';

export function RoutingAssignmentFields({ requestId, requestVersion, staff, initial = '', disabled, label, onApplyingChange }: {
  requestId: string; requestVersion: number; staff: StaffOption[]; initial?: string; disabled: boolean; label: string; onApplyingChange: (busy: boolean) => void;
}) {
  const [teamId, setTeamId] = useState(initial.split('|')[0] ?? ''), [assignment, setAssignment] = useState(initial);
  const [result, setResult] = useState<RoutingEvaluation | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const staffControl = useRef<HTMLSelectElement>(null), controller = useRef<AbortController | null>(null), running = useRef(false), currentVersion = useRef(requestVersion);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { currentVersion.current = requestVersion; }, [requestVersion]);
  const teams = [...new Map(staff.filter(person => person.available).flatMap(person => person.teams.map(team => [team.id, team] as const))).values()];
  async function evaluate(apply: boolean) {
    if (running.current || disabled) return;
    running.current = true; setBusy(true); setError(''); setNotice(''); if (apply) onApplyingChange(true);
    const read = new AbortController(); controller.current = read;
    try {
      const next = (await api('/requests/' + requestId + '/routing/evaluate', routingEvaluationResponseSchema, {}, 'POST', AbortSignal.any([read.signal, AbortSignal.timeout(15000)]))).data;
      if (read.signal.aborted) return;
      setResult(next);
      if (next.requestVersion !== currentVersion.current) { setError('Yêu cầu đã thay đổi. Tải lại và kiểm tra trước khi áp dụng hoặc phân công.'); return; }
      if (apply) {
        if (JSON.stringify(next) !== JSON.stringify(result)) { setNotice('Quy tắc hoặc nhóm đã thay đổi. Hãy xem gợi ý mới rồi áp dụng lại.'); return; }
        if (next.status !== 'MATCH' || !next.suggestedTarget) return;
        if (!teams.some(team => team.id === next.suggestedTarget!.id)) { setError('Danh sách nhóm đã thay đổi. Tải lại để chọn nhân sự hiện tại.'); return; }
        setTeamId(next.suggestedTarget.id); setAssignment('');
        setNotice('Đã điền nhóm vào bản nháp từ lần đánh giá này. Hãy chọn nhân sự và xác nhận thao tác; bạn có thể đổi nhóm.');
        requestAnimationFrame(() => staffControl.current?.focus());
      }
    } catch { if (!read.signal.aborted) { setResult(null); setError('Không thể tải gợi ý định tuyến. Bạn vẫn có thể phân công thủ công.'); } }
    finally { if (!read.signal.aborted) { running.current = false; setBusy(false); if (apply) onApplyingChange(false); } }
  }
  return <>
    <section className="routing-card" aria-label="Gợi ý định tuyến">
      <h3>Gợi ý định tuyến</h3><p>Quy tắc dựa trên thông tin đã lưu. Nhóm gợi ý cần được bạn xem xét và xác nhận.</p>
      <button type="button" disabled={busy || disabled} onClick={() => { void evaluate(false); }}>{busy ? 'Đang đánh giá…' : result ? 'Đánh giá lại' : 'Đánh giá định tuyến'}</button>
      {busy ? <p role="status">Đang kiểm tra quy tắc và nhóm hiện tại…</p> : null}
      {error ? <p role="alert">{error} <button type="button" disabled={busy || disabled} onClick={() => { void evaluate(false); }}>Thử lại gợi ý</button></p> : null}
      {notice ? <p role="status">{notice}</p> : null}
      {result ? <div className="routing-result">
        <p role="status"><strong>{result.status}</strong> · Thông tin tại phiên bản yêu cầu {result.requestVersion}</p>
        {result.status === 'MATCH' ? <p>Nhóm gợi ý: <strong>{result.suggestedTarget?.displayName}</strong></p> : result.status === 'CONFLICT' ? <p>Các quy tắc cùng mức ưu tiên đề xuất nhóm khác nhau. Vui lòng phân công thủ công hoặc điều chỉnh quy tắc.</p> : <p>{result.diagnostic === 'INVALID_TARGET' ? 'Nhóm của quy tắc phù hợp không còn đủ điều kiện. Hãy phân công thủ công.' : 'Không có quy tắc định tuyến phù hợp. Bạn vẫn có thể phân công thủ công.'}</p>}
        <ul>{result.ruleRevisions.map(rule => <li key={rule.revisionId}><strong>{rule.name}</strong> · Phiên bản {rule.revision} · Ưu tiên {rule.priority} · {rule.target.displayName}<ul>{rule.explanation.map((item, index) => <li key={index}>{item.field} {item.operator} {item.expected.join(', ')} · Giá trị: {item.actual ?? 'Chưa có'}</li>)}</ul></li>)}</ul>
        {result.status === 'MATCH' ? <button type="button" disabled={busy || disabled || result.requestVersion !== requestVersion} onClick={() => { void evaluate(true); }}>Áp dụng vào biểu mẫu</button> : null}
      </div> : null}
    </section>
    <label>Nhóm xử lý<select name="teamId" value={teamId} disabled={disabled} onChange={event => { setTeamId(event.target.value); setAssignment(''); }}><option value="">Tất cả nhóm đủ điều kiện</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
    <label>{label}<select ref={staffControl} name="assignment" required value={assignment} disabled={disabled} onChange={event => { setAssignment(event.target.value); setTeamId(event.target.value.split('|')[0] ?? ''); }}>
      <option value="">Chọn nhân sự đủ điều kiện</option>{staff.filter(person => person.available).flatMap(person => person.teams.filter(team => !teamId || team.id === teamId).map(team => <option key={team.id + person.id} value={team.id + '|' + person.id}>{team.name} / {person.displayName}</option>))}
    </select></label>
  </>;
}

export function ReassignmentForm({ requestId, requestVersion, staff, disabled, run }: { requestId: string; requestVersion: number; staff: StaffOption[]; disabled: boolean; run: (body: unknown) => Promise<boolean> }) {
  const [applying, setApplying] = useState(false);
  return <form className="action-form" onSubmit={async event => { event.preventDefault(); if (applying) return; const form = new FormData(event.currentTarget), [teamId, staffId] = String(form.get('assignment')).split('|'); await run({ teamId, staffId, reason: String(form.get('reason')) }); }}>
    <fieldset disabled={disabled || applying}><legend>Phân công lại</legend>
      <RoutingAssignmentFields requestId={requestId} requestVersion={requestVersion} staff={staff} disabled={disabled} label="Nhân sự nhận bàn giao" onApplyingChange={setApplying} />
      <label>Lý do bàn giao<textarea name="reason" required maxLength={2000} /></label><button>Phân công lại</button>
    </fieldset>
  </form>;
}
