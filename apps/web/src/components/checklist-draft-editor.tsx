'use client';
import { useId } from 'react';
import type { ChecklistTemplateItem } from '@mobiflow/contracts';

export function ChecklistDraftEditor({ items, onChange, disabled = false }: { items: ChecklistTemplateItem[]; onChange: (items: ChecklistTemplateItem[]) => void; disabled?: boolean }) {
  const id = useId();
  function move(index: number, delta: number) { const copy = [...items]; [copy[index], copy[index + delta]] = [copy[index + delta]!, copy[index]!]; onChange(copy); }
  return <div className="checklist-draft-editor"><p>Tối đa 30 bước; mỗi bước tối đa 500 ký tự.</p><ol>{items.map((item, index) => <li key={index}>
    <label htmlFor={id + '-text-' + index}>Nội dung bước {index + 1}<textarea id={id + '-text-' + index} rows={2} value={item.text} required maxLength={1000} disabled={disabled} onChange={e => onChange(items.map((old, i) => i === index ? { ...old, text: e.target.value } : old))} /></label>
    <small>{Array.from(item.text).length} / 500 ký tự</small>
    <label><input type="checkbox" checked={item.required} disabled={disabled} onChange={e => onChange(items.map((old, i) => i === index ? { ...old, required: e.target.checked } : old))} />Bắt buộc bước {index + 1}</label>
    <div className="template-actions"><button type="button" aria-label={'Đưa bước ' + (index + 1) + ' lên'} disabled={disabled || index === 0} onClick={() => move(index, -1)}>Lên</button><button type="button" aria-label={'Đưa bước ' + (index + 1) + ' xuống'} disabled={disabled || index === items.length - 1} onClick={() => move(index, 1)}>Xuống</button><button type="button" aria-label={'Xóa bước ' + (index + 1)} disabled={disabled} onClick={() => onChange(items.filter((_, i) => i !== index))}>Xóa bước</button></div>
  </li>)}</ol><button type="button" disabled={disabled || items.length >= 30} onClick={() => onChange([...items, { text: '', required: true }])}>Thêm bước</button></div>;
}
