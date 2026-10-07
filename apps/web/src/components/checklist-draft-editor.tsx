'use client';
import { useId } from 'react';
import type { ChecklistTemplateItem } from '@mobiflow/contracts';
import type { FieldErrors } from '@/lib/form-errors';

export function ChecklistDraftEditor({ items, onChange, disabled = false, errors = {} }: { items: ChecklistTemplateItem[]; onChange: (items: ChecklistTemplateItem[]) => void; disabled?: boolean; errors?: FieldErrors }) {
  const id = useId();
  function move(index: number, delta: number) { const copy = [...items]; [copy[index], copy[index + delta]] = [copy[index + delta]!, copy[index]!]; onChange(copy); }
  return <div className="checklist-draft-editor"><p>Tối đa 30 bước; mỗi bước tối đa 500 ký tự.</p><ol>{items.map((item, index) => <li key={index}>
    <label htmlFor={id + '-text-' + index}>Nội dung bước {index + 1}<textarea id={id + '-text-' + index} data-error-field={'content.items.' + index + '.text'} aria-invalid={!!errors['content.items.' + index + '.text']} aria-describedby={errors['content.items.' + index + '.text'] ? id + '-error-' + index : undefined} rows={2} value={item.text} required maxLength={1000} disabled={disabled} onChange={e => onChange(items.map((old, i) => i === index ? { ...old, text: e.target.value } : old))} /></label>
    {errors['content.items.' + index + '.text'] ? <p className="field-error" role="alert" id={id + '-error-' + index}>{errors['content.items.' + index + '.text']}</p> : null}
    <small>{Array.from(item.text).length} / 500 ký tự</small>
    <label><input type="checkbox" checked={item.required} disabled={disabled} onChange={e => onChange(items.map((old, i) => i === index ? { ...old, required: e.target.checked } : old))} />Bắt buộc bước {index + 1}</label>
    <div className="template-actions"><button type="button" aria-label={'Đưa bước ' + (index + 1) + ' lên'} disabled={disabled || index === 0} onClick={() => move(index, -1)}>Lên</button><button type="button" aria-label={'Đưa bước ' + (index + 1) + ' xuống'} disabled={disabled || index === items.length - 1} onClick={() => move(index, 1)}>Xuống</button><button type="button" aria-label={'Xóa bước ' + (index + 1)} disabled={disabled} onClick={() => onChange(items.filter((_, i) => i !== index))}>Xóa bước</button></div>
  </li>)}</ol>{errors['content.items'] ? <p className="field-error" role="alert" id={id + '-list-error'}>{errors['content.items']}</p> : null}<button type="button" data-error-field="content.items" aria-describedby={errors['content.items'] ? id + '-list-error' : undefined} disabled={disabled || items.length >= 30} onClick={() => onChange([...items, { text: '', required: true }])}>Thêm bước</button></div>;
}
