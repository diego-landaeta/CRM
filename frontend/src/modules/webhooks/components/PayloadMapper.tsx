import { useState } from 'react';
import { X } from '@phosphor-icons/react';
import PromptDialog from '@/shared/components/ui/PromptDialog';
import type { WebhookDestination, WebhookFieldMapping, WebhookTarget } from '../lib/types';

const TARGETS_BY_DEST: Record<WebhookDestination, WebhookTarget[]> = {
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

// Límites para evitar freezes con payloads adversariales o muy grandes
const MAX_DEPTH = 6;
const MAX_OBJECT_KEYS = 50;
const MAX_ARRAY_ITEMS = 5;

interface PayloadTreeProps {
  obj: unknown;
  path?: string;
  onSelect: (path: string) => void;
  mapping?: WebhookFieldMapping;
  depth?: number;
}

export function PayloadTree({ obj, path = '', onSelect, mapping, depth = 0 }: PayloadTreeProps) {
  if (obj === null || obj === undefined) return <span className="text-muted-foreground italic">null</span>;
  if (typeof obj !== 'object') {
    const usedAs = Object.entries(mapping || {}).find(([, v]) => v === path)?.[0];
    return (
      <button
        type="button"
        onClick={() => onSelect(path)}
        className={`text-left px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-primary/10 ${usedAs ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : ''}`}
        title={usedAs ? `Mapeado a: ${usedAs}` : 'Click para mapear'}
      >
        {String(obj).slice(0, 80)}{usedAs && ` ← ${usedAs}`}
      </button>
    );
  }
  if (depth >= MAX_DEPTH) {
    return <span className="text-[10px] text-muted-foreground italic">… (profundidad máx alcanzada)</span>;
  }
  if (Array.isArray(obj)) {
    return (
      <ul className="ml-3 space-y-0.5">
        {obj.slice(0, MAX_ARRAY_ITEMS).map((v, i) => (
          <li key={i} className="text-[11px]">
            <span className="text-muted-foreground">[{i}]:</span>{' '}
            <PayloadTree obj={v} path={`${path}.${i}`.replace(/^\./, '')} onSelect={onSelect} mapping={mapping} depth={depth + 1} />
          </li>
        ))}
        {obj.length > MAX_ARRAY_ITEMS && <li className="text-[10px] text-muted-foreground italic">... +{obj.length - MAX_ARRAY_ITEMS} más</li>}
      </ul>
    );
  }
  const entries = Object.entries(obj);
  const visible = entries.slice(0, MAX_OBJECT_KEYS);
  return (
    <ul className="space-y-0.5">
      {visible.map(([k, v]) => {
        const childPath = path ? `${path}.${k}` : k;
        return (
          <li key={k} className="text-[11px]">
            <span className="font-bold text-foreground">{k}:</span>{' '}
            <PayloadTree obj={v} path={childPath} onSelect={onSelect} mapping={mapping} depth={depth + 1} />
          </li>
        );
      })}
      {entries.length > MAX_OBJECT_KEYS && (
        <li className="text-[10px] text-muted-foreground italic">
          ... +{entries.length - MAX_OBJECT_KEYS} keys más (límite {MAX_OBJECT_KEYS})
        </li>
      )}
    </ul>
  );
}

interface PayloadMapperProps {
  payload: unknown;
  mapping: WebhookFieldMapping;
  destination?: WebhookDestination;
  onChange: (next: WebhookFieldMapping) => void;
}

export default function PayloadMapper({ payload, mapping, destination = 'lead', onChange }: PayloadMapperProps) {
  const targets = TARGETS_BY_DEST[destination] || TARGETS_BY_DEST.lead;
  const [mapPath, setMapPath] = useState<string | null>(null);

  function setMapping(target: string, source: string): void {
    onChange({ ...mapping, [target]: source });
  }

  function removeMapping(target: string): void {
    const next = { ...mapping };
    delete next[target];
    onChange(next);
  }

  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">
        Payload capturado · click en un valor para mapearlo
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-xl p-3 bg-muted/10 max-h-72 overflow-y-auto">
          <PayloadTree obj={payload} mapping={mapping} onSelect={setMapPath} />
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
      <PromptDialog
        open={!!mapPath}
        title="Mapear campo del payload"
        message={mapPath ? <>Selecciona a qué campo del CRM mapear <code className="font-mono text-foreground">{mapPath}</code>.</> : null}
        options={targets.map(t => ({ value: t.key, label: t.label + (t.required ? ' *' : '') }))}
        confirmLabel="Mapear"
        onConfirm={(target: string) => {
          if (target && mapPath && targets.find((t) => t.key === target)) setMapping(target, mapPath);
          setMapPath(null);
        }}
        onCancel={() => setMapPath(null)}
      />
    </div>
  );
}
