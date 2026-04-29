const inputClass = 'w-full h-10 px-3 rounded-md border border-border bg-muted/30 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all';

export default function CustomFieldRenderer({ field, value, onChange, disabled = false }) {
  const id = `cf-${field.field_key}`;
  const v = value ?? '';

  function set(next) {
    onChange?.(field.field_key, next);
  }

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground mb-1 block">
        {field.label}{field.required && <span className="text-red-500"> *</span>}
      </label>
      {renderInput()}
    </div>
  );

  function renderInput() {
    switch (field.type) {
      case 'number':
        return (
          <input
            id={id}
            type="number"
            disabled={disabled}
            required={field.required}
            value={v}
            onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
            className={inputClass}
          />
        );
      case 'date':
        return (
          <input
            id={id}
            type="date"
            disabled={disabled}
            required={field.required}
            value={v}
            onChange={(e) => set(e.target.value)}
            className={inputClass}
          />
        );
      case 'select': {
        const choices = field.options?.choices || [];
        return (
          <select
            id={id}
            disabled={disabled}
            required={field.required}
            value={v}
            onChange={(e) => set(e.target.value)}
            className={inputClass + ' appearance-none cursor-pointer'}
          >
            <option value="">— Seleccionar —</option>
            {choices.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        );
      }
      case 'boolean':
        return (
          <label className="flex items-center gap-2 text-sm">
            <input
              id={id}
              type="checkbox"
              disabled={disabled}
              checked={!!v}
              onChange={(e) => set(e.target.checked)}
              className="rounded border-border"
            />
            {v ? 'Sí' : 'No'}
          </label>
        );
      case 'textarea':
        return (
          <textarea
            id={id}
            disabled={disabled}
            required={field.required}
            value={v}
            onChange={(e) => set(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm outline-none resize-y focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
        );
      case 'text':
      default:
        return (
          <input
            id={id}
            type="text"
            disabled={disabled}
            required={field.required}
            value={v}
            onChange={(e) => set(e.target.value)}
            className={inputClass}
          />
        );
    }
  }
}
