export type FieldErrors = Record<string, string>;

// Shared schemas remain the validators; this only maps their paths to UI fields.
export function fieldErrors(issues: readonly { path: readonly PropertyKey[] }[], messages: FieldErrors): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join('.');
    errors[path] = messages[path] ?? messages[path.replace(/\.\d+\./g, '.*.')] ?? 'Kiểm tra giá trị của trường này.';
  }
  return errors;
}

export function focusFirstInvalid(form: HTMLFormElement, errors: FieldErrors) {
  const field = Array.from(form.querySelectorAll<HTMLElement>('[data-error-field]')).find(element => {
    const path = element.dataset.errorField!;
    return Object.keys(errors).some(error => error === path || path.startsWith(error + '.'));
  });
  field?.focus();
}

type ValidationIssue = { path: readonly PropertyKey[]; code: string };

export function routingValidationErrors(issues: readonly ValidationIssue[]): FieldErrors {
  const fieldIssues = issues.map(issue => issue.path[0] === 'conditions' && issue.path.length === 2 ? { ...issue, path: [...issue.path, 'values'] } : issue);
  return fieldErrors(fieldIssues, {
    name: 'Tên quy tắc cần từ 1 đến 120 ký tự.',
    description: 'Mô tả quy tắc cần từ 1 đến 500 ký tự.',
    priority: 'Ưu tiên quy tắc phải là số nguyên từ 1 đến 10000.',
    'target.id': 'Chọn nhóm đủ điều kiện.',
    conditions: 'Quy tắc cần từ 1 đến 10 điều kiện hợp lệ.',
    'conditions.*.values': 'Chọn giá trị hợp lệ; EQ có một giá trị, IN có từ 1 đến 20 giá trị.',
  });
}

export function analyticsValidationErrors(issues: readonly ValidationIssue[], values: { from?: string; to?: string }): FieldErrors {
  const fieldIssues = issues.map(issue => issue.code === 'custom' && issue.path[0] === 'from' && values.from && !values.to ? { ...issue, path: ['to'] } : issue);
  const errors = fieldErrors(fieldIssues, {
    from: 'Chọn ngày bắt đầu hợp lệ.',
    to: 'Chọn ngày kết thúc hợp lệ.',
  });
  // The shared schema reports relational range errors at `to`; both dates
  // describe that range, with `from` first in the form's reading order.
  if (issues.some(issue => issue.code === 'custom' && issue.path[0] === 'to')) {
    errors.from = errors.to = 'Ngày bắt đầu phải trước ngày kết thúc; khoảng thời gian không quá 365 ngày.';
  }
  return errors;
}
