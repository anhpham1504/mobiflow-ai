'use client';
import { useId, useState } from 'react';
import { TemplateSelector } from './template-selector';

export function ResponseComposer({ title, label, disabled, run }: { title: string; label: string; disabled: boolean; run: (body: { body: string; sourceTemplateRevisionId?: string }, onUnavailable: () => void) => Promise<boolean> }) {
  const id = useId(), [body, setBody] = useState(''), [source, setSource] = useState<string | null>(null), [applying, setApplying] = useState(false);
  return <form className="action-form" onSubmit={async e => { e.preventDefault(); if (await run({ body, ...(source ? { sourceTemplateRevisionId: source } : {}) }, () => setSource(null))) { setBody(''); setSource(null); } }}>
    <fieldset disabled={disabled || applying}><legend>{title}</legend><TemplateSelector type="RESPONSE" context={title} hasDraft={!!body.trim()} disabled={disabled} onApplyingChange={setApplying} onApply={revision => { if (revision.type === 'RESPONSE') { setBody(revision.content.body); setSource(revision.id); } }} />
      <label htmlFor={id}>{label}<textarea id={id} name="body" rows={4} value={body} onChange={e => setBody(e.target.value)} required maxLength={8000} aria-describedby={id+'-limit'} /></label>
      <p id={id+'-limit'}>{Array.from(body).length} / 4.000 ký tự</p>
      {source ? <p>Bản nháp bắt đầu từ mẫu; nội dung bạn chỉnh sửa sẽ được gửi. <button type="button" onClick={() => setSource(null)}>Bỏ nguồn mẫu, giữ nội dung</button></p> : null}
      <button disabled={disabled || !body.trim() || Array.from(body).length>4000}>{title}</button>
    </fieldset>
  </form>;
}
