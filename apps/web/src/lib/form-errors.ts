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
