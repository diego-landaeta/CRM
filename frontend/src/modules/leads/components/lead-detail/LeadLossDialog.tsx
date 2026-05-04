import { useState } from 'react';
import Portal from '@/shared/components/ui/portal';
import { selectClass, selectBg } from './InfoField';

interface LeadLossDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}

export default function LeadLossDialog({ open, onClose, onConfirm, loading }: LeadLossDialogProps) {
  const [reason, setReason] = useState('');
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-lg border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-sm p-6">
          <h2 className="text-lg font-semibold mb-1">Motivo de pérdida</h2>
          <p className="text-muted-foreground text-sm mb-5">Este campo es obligatorio al marcar un lead como no interesado.</p>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass} style={selectBg}>
            <option value="">Selecciona un motivo</option>
            <option value="precio">Precio</option>
            <option value="falta_interes">Falta de interés</option>
            <option value="sin_respuesta">Sin respuesta</option>
            <option value="competencia">Competencia</option>
            <option value="timing">Timing (no es el momento)</option>
            <option value="otro">Otro</option>
          </select>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={!reason || loading}
              className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40"
            >
              {loading ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
