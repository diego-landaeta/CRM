import { Check } from '@phosphor-icons/react';

export function FilterSection({ title, count, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {count > 0 && (
          <span className="text-[10px] font-semibold bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function CheckList({ options, selected, onToggle }) {
  return (
    <div className="space-y-1.5">
      {options.map(opt => {
        const active = selected.includes(opt.v);
        return (
          <label key={opt.v} className="flex items-center gap-2 cursor-pointer text-xs hover:text-foreground transition-colors">
            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              active ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card'
            }`}>
              {active && <Check size={10} weight="bold" />}
            </span>
            <input type="checkbox" checked={active} onChange={() => onToggle(opt.v)} className="sr-only" />
            <span className={active ? 'text-foreground font-medium' : 'text-muted-foreground'}>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}
