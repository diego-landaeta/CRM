import { useState, useEffect } from 'react';
import { Plus, X, ArrowUp, ArrowDown } from '@phosphor-icons/react';
import client from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';
import { SectionTitle, useConfirm, DEFAULT_COLUMNS, AVAILABLE_EXTRA_COLUMNS } from './shared';

export default function ColumnsTab({ project, onSaved }) {
  const { ask, dialog: confirmDialog } = useConfirm();
  const initial = Array.isArray(project.lead_columns) && project.lead_columns.length
    ? project.lead_columns
    : DEFAULT_COLUMNS;
  const [cols, setCols] = useState(initial);
  const [customFields, setCustomFields] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get(`/field-definitions/project/${project.id}`).then(r => {
      if (r.success) setCustomFields(r.data || []);
    }).catch(() => toast({ title: 'Error al cargar campos personalizados', variant: 'destructive' }));
  }, [project.id]);

  function move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= cols.length) return;
    const next = [...cols];
    [next[idx], next[j]] = [next[j], next[idx]];
    setCols(next);
  }

  function toggle(idx) {
    const next = [...cols];
    next[idx] = { ...next[idx], visible: !next[idx].visible };
    setCols(next);
  }

  function remove(idx) {
    setCols(cols.filter((_, i) => i !== idx));
  }

  function addCol(col) {
    if (cols.find(c => c.key === col.key)) {
      toast({ title: 'Columna ya añadida' });
      return;
    }
    setCols([...cols, { key: col.key, label: col.label, visible: true }]);
  }

  function resetDefaults() {
    ask('Restablecer columnas', '¿Restablecer las columnas a los valores por defecto? Se perderá la configuración actual.', () => setCols(DEFAULT_COLUMNS), 'warning', 'Restablecer');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await client.patch(`/projects/${project.id}`, { lead_columns: cols });
      if (res.success) {
        toast({ title: 'Columnas guardadas' });
        if (onSaved) onSaved(res.data);
      }
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  const presentKeys = new Set(cols.map(c => c.key));
  const extraOptions = [
    ...AVAILABLE_EXTRA_COLUMNS.filter(c => !presentKeys.has(c.key)),
    ...customFields
      .filter(f => !presentKeys.has(`custom.${f.field_key}`))
      .map(f => ({ key: `custom.${f.field_key}`, label: f.label + ' (custom)' })),
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between">
        <SectionTitle title="Columnas del listado de leads" subtitle="Elige cuales se ven y en que orden. Aplica al listado tabla." />
        <button onClick={resetDefaults} className="text-xs text-muted-foreground hover:text-foreground underline">Restablecer</button>
      </div>

      <div className="border border-border rounded-xl divide-y divide-border bg-muted/10">
        {cols.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sin columnas. Añade alguna abajo.</div>
        ) : cols.map((c, idx) => (
          <div key={c.key} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Subir" className="p-0.5 rounded hover:bg-muted disabled:opacity-20"><ArrowUp size={12} /></button>
              <button onClick={() => move(idx, 1)} disabled={idx === cols.length - 1} aria-label="Bajar" className="p-0.5 rounded hover:bg-muted disabled:opacity-20"><ArrowDown size={12} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <input
                value={c.label}
                onChange={e => {
                  const next = [...cols];
                  next[idx] = { ...next[idx], label: e.target.value };
                  setCols(next);
                }}
                className="w-full h-8 px-2 rounded-md bg-card border border-border text-sm outline-none focus:border-primary"
              />
              <p className="font-mono text-micro text-muted-foreground mt-0.5">{c.key}</p>
            </div>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={c.visible} onChange={() => toggle(idx)} />
              Visible
            </label>
            <button onClick={() => remove(idx)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Quitar"><X size={14} /></button>
          </div>
        ))}
      </div>

      {extraOptions.length > 0 && (
        <div>
          <p className="text-meta font-bold uppercase text-muted-foreground mb-2">Añadir columna</p>
          <div className="flex flex-wrap gap-2">
            {extraOptions.map(c => (
              <button
                key={c.key}
                onClick={() => addCol(c)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted text-xs font-medium border border-border"
              >
                <Plus size={12} weight="bold" /> {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-border">
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar columnas'}
        </button>
      </div>
      {confirmDialog}
    </div>
  );
}
