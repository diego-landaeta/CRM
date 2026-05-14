import { useEffect, useState } from 'react';
import { Flag, Info } from '@phosphor-icons/react';
import client from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';

interface LeadLite {
  id: number;
  nombre?: string;
  email?: string;
}

interface Props {
  open: boolean;
  lead: LeadLite | null;
  onClose: () => void;
  onReported?: () => void;
}

// Cualquier gestor/admin puede reportar un lead como spam. El superadmin lo
// revisará desde /notificaciones y decidirá si confirmar (soft-delete) o descartar.
export default function SpamReportDialog({ open, lead, onClose, onReported }: Props) {
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setMotivo('');
  }, [open]);

  if (!open || !lead) return null;

  async function handleReport() {
    if (!lead) return;
    setSaving(true);
    try {
      const res = await client.post(`/leads/${lead.id}/report-spam`, { motivo: motivo || null });
      if (res.success) {
        toast({ title: 'Reportado como spam', description: 'El superadmin lo revisará.' });
        onReported?.();
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message;
      const code = err?.data?.code;
      if (code === 'REPORT_ALREADY_PENDING') {
        toast({ title: 'Ya reportado', description: 'Este lead ya tiene un reporte pendiente.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 !m-0 z-[80] flex items-center justify-center sm:p-4">
      <div className="fixed inset-0 !m-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" className="relative bg-card sm:rounded-lg border border-border w-full max-w-md flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
            <Flag size={18} weight="regular" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base">Reportar como spam</h3>
            <p className="text-xs text-muted-foreground truncate">{lead.nombre} {lead.email ? `· ${lead.email}` : ''}</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" weight="duotone" />
            <p className="text-[11px] text-blue-800 dark:text-blue-300">
              El reporte llega al superadmin para que lo revise. Si lo confirma, el lead se elimina como spam
              y si el mismo email vuelve a escribir queda filtrado automáticamente.
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">¿Por qué crees que es spam? (opcional)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej: nombre/email genérico, mensaje sin sentido, bot..."
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-sm resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/20">
          <button onClick={onClose} disabled={saving}
            className="inline-flex items-center h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleReport} disabled={saving}
            className="inline-flex items-center h-9 px-4 rounded-md bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
            {saving ? 'Enviando...' : 'Reportar'}
          </button>
        </div>
      </div>
    </div>
  );
}
