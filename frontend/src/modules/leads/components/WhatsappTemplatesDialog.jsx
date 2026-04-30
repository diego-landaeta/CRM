import { useEffect, useState } from 'react';
import { X, Plus, ArrowCounterClockwise } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';

/**
 * Editor de plantillas WhatsApp por proyecto. Persistencia en localStorage
 * vía useWhatsappTemplates hook (el dueño le pasa onSave/onReset).
 */
export default function WhatsappTemplatesDialog({ open, onClose, templates, onSave, onReset, projectName }) {
  const [draft, setDraft] = useState([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(templates ? templates.map((t) => ({ ...t })) : []);
      setDirty(false);
    }
  }, [open, templates]);

  if (!open) return null;

  function updateField(idx, field, value) {
    setDraft((d) => d.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
    setDirty(true);
  }
  function addTemplate() {
    setDraft((d) => [...d, { id: `tpl_${Date.now()}`, label: 'Nueva plantilla', text: 'Hola {nombre}, ' }]);
    setDirty(true);
  }
  function removeTemplate(idx) {
    setDraft((d) => d.filter((_, i) => i !== idx));
    setDirty(true);
  }
  function handleSave() {
    onSave(draft);
    toast({ title: 'Plantillas guardadas', description: `${draft.length} plantillas para ${projectName || 'este proyecto'}` });
    onClose();
  }
  function handleReset() {
    onReset();
    toast({ title: 'Plantillas restauradas a las predeterminadas' });
    onClose();
  }

  return (
    <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="wa-templates-title" className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <h2 id="wa-templates-title" className="text-base font-semibold">Plantillas de WhatsApp</h2>
            <p className="text-xs text-muted-foreground">Para {projectName || 'este proyecto'} - guardadas en este navegador</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1 rounded hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="px-5 py-3 text-xs text-muted-foreground bg-muted/30 border-b">
          Variables disponibles: <code className="bg-card px-1 rounded">{'{nombre}'}</code> <code className="bg-card px-1 rounded">{'{nombreCompleto}'}</code> <code className="bg-card px-1 rounded">{'{producto}'}</code> <code className="bg-card px-1 rounded">{'{proyecto}'}</code> <code className="bg-card px-1 rounded">{'{email}'}</code> <code className="bg-card px-1 rounded">{'{telefono}'}</code>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {draft.map((tpl, idx) => (
            <div key={tpl.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tpl.label}
                  onChange={(e) => updateField(idx, 'label', e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm font-medium border border-border rounded bg-background"
                  placeholder="Nombre de la plantilla"
                />
                <button
                  type="button"
                  onClick={() => removeTemplate(idx)}
                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-700"
                  title="Eliminar plantilla"
                >
                  <X size={14} />
                </button>
              </div>
              <textarea
                value={tpl.text}
                onChange={(e) => updateField(idx, 'text', e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 text-xs border border-border rounded bg-background resize-y font-mono"
                placeholder="Hola {nombre}, ..."
              />
            </div>
          ))}
          {draft.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">No hay plantillas. Añade una para empezar.</p>
          )}
          <button
            type="button"
            onClick={addTemplate}
            className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={14} weight="bold" /> Añadir plantilla
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted"
          >
            <ArrowCounterClockwise size={12} /> Restaurar predeterminadas
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className="px-4 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              Guardar plantillas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
