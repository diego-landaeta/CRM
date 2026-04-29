import { X } from '@phosphor-icons/react';

const TARGETS_BY_DEST = {
  lead: [
    { key: 'nombre', label: 'Nombre', required: true },
    { key: 'email', label: 'Email', required: true },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'notas', label: 'Notas' },
    { key: 'producto_interes_id', label: 'Producto interés (id)' },
    { key: 'utm_source', label: 'UTM source' },
    { key: 'utm_campaign', label: 'UTM campaign' },
  ],
  matricula: [
    { key: 'dni', label: 'DNI / Identificación', required: true },
    { key: 'titulo', label: 'Título / Programa' },
    { key: 'email', label: 'Email' },
    { key: 'notas', label: 'Notas' },
  ],
};

export function PayloadTree({ obj, path = '', onSelect, mapping }) {
  if (obj === null || obj === undefined) return <span className="text-muted-foreground italic">null</span>;
  if (typeof obj !== 'object') {
    const usedAs = Object.entries(mapping || {}).find(([, v]) => v === path)?.[0];
    return (
      <button
        onClick={() => onSelect(path)}
        className={`text-left px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-primary/10 ${usedAs ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : ''}`}
        title={usedAs ? `Mapeado a: ${usedAs}` : 'Click para mapear'}
      >
        {String(obj).slice(0, 80)}{usedAs && ` ← ${usedAs}`}
      </button>
    );
  }
  if (Array.isArray(obj)) {
    return (
      <ul className="ml-3 space-y-0.5">
        {obj.slice(0, 5).map((v, i) => (
          <li key={i} className="text-[11px]">
            <span className="text-muted-foreground">[{i}]:</span>{' '}
            <PayloadTree obj={v} path={`${path}.${i}`.replace(/^\./, '')} onSelect={onSelect} mapping={mapping} />
          </li>
        ))}
        {obj.length > 5 && <li className="text-[10px] text-muted-foreground italic">... +{obj.length - 5} más</li>}
      </ul>
    );
  }
  return (
    <ul className="space-y-0.5">
      {Object.entries(obj).map(([k, v]) => {
        const childPath = path ? `${path}.${k}` : k;
        return (
          <li key={k} className="text-[11px]">
            <span className="font-bold text-foreground">{k}:</span>{' '}
            <PayloadTree obj={v} path={childPath} onSelect={onSelect} mapping={mapping} />
          </li>
        );
      })}
    </ul>
  );
}

export default function PayloadMapper({ payload, mapping, destination = 'lead', onChange }) {
  const targets = TARGETS_BY_DEST[destination] || TARGETS_BY_DEST.lead;

  function setMapping(target, source) {
    onChange({ ...mapping, [target]: source });
  }

  function removeMapping(target) {
    const next = { ...mapping };
    delete next[target];
    onChange(next);
  }

  function handleSelect(path) {
    const opts = targets.map((t) => t.key).join(', ');
    const target = window.prompt(`Mapea "${path}" a qué campo CRM?\nOpciones: ${opts}`);
    if (target && targets.find((t) => t.key === target)) setMapping(target, path);
  }

  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">
        Payload capturado · click en un valor para mapearlo
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-xl p-3 bg-muted/10 max-h-72 overflow-y-auto">
          <PayloadTree obj={payload} mapping={mapping} onSelect={handleSelect} />
        </div>
        <div className="border border-border rounded-xl p-3 space-y-1.5">
          <p className="text-[11px] font-bold uppercase text-muted-foreground">
            Mapping → {destination === 'matricula' ? 'Matrícula' : 'Lead'}
          </p>
          {targets.map((t) => (
            <div key={t.key} className="flex items-center gap-2 text-xs">
              <span className="w-36 font-bold">
                {t.label}{t.required && <span className="text-red-500"> *</span>}
              </span>
              <code className="flex-1 px-2 py-1 bg-muted/40 rounded text-[10px]">
                {mapping[t.key] || '(sin mapear)'}
              </code>
              {mapping[t.key] && (
                <button onClick={() => removeMapping(t.key)} className="text-red-500" aria-label={`Quitar mapeo ${t.label}`}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
