import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useProducts } from '@/modules/products/hooks/useProducts';
import { X } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';

const conversionSchema = z.object({
  producto_contratado: z.string().min(1, 'Selecciona un producto'),
  importe_total: z.coerce.number().positive('El importe debe ser mayor a 0'),
  importe_pagado: z.coerce.number().min(0, 'No puede ser negativo'),
  metodo_pago: z.enum(['transferencia', 'tarjeta', 'efectivo', 'fraccionado'], {
    required_error: 'Selecciona un metodo',
  }),
  fecha_compromiso_pago: z.string().optional(),
  notas_pago: z.string().optional(),
});

const METODO_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'fraccionado', label: 'Fraccionado' },
];

const inputClass = 'w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';
const selectClass = inputClass + ' appearance-none cursor-pointer pr-9';
const selectBg = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 px-1">{error}</p>}
    </div>
  );
}

export default function ConversionDialog({ open, onClose, lead, onSubmit }) {
  const { activeProject } = useProjectContext();
  const { products } = useProducts(activeProject?.id);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(conversionSchema),
    defaultValues: {
      producto_contratado: lead?.producto_interes || '',
      importe_total: '',
      importe_pagado: 0,
      metodo_pago: 'transferencia',
      fecha_compromiso_pago: '',
      notas_pago: '',
    },
  });

  const importeTotal = watch('importe_total');
  const importePagado = watch('importe_pagado');
  const pendiente = Math.max(0, (Number(importeTotal) || 0) - (Number(importePagado) || 0));

  if (!open) return null;

  async function handleFormSubmit(data) {
    await onSubmit({ ...data, lead_id: lead.id, fecha_conversion: new Date().toISOString().split('T')[0] });
    onClose();
  }

  return (
    <Portal>
    <div role="dialog" aria-label="Registrar Conversion" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-lg mx-4 p-4 sm:p-8 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Registrar Conversion</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {lead?.nombre} — Lead #{lead?.id}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
            <X size={18} weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <Field label="Producto contratado *" error={errors.producto_contratado?.message}>
            <select {...register('producto_contratado')} className={selectClass} style={selectBg}>
              <option value="">Selecciona producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.nombre}>{p.nombre} — {p.precio} €</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Importe total *" error={errors.importe_total?.message}>
              <div className="relative">
                <input {...register('importe_total')} type="number" step="0.01" placeholder="0.00" className={inputClass + ' pr-8'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              </div>
            </Field>
            <Field label="Importe pagado" error={errors.importe_pagado?.message}>
              <div className="relative">
                <input {...register('importe_pagado')} type="number" step="0.01" placeholder="0.00" className={inputClass + ' pr-8'} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              </div>
            </Field>
          </div>

          {/* Pendiente calculado */}
          <div className={`p-3 rounded-xl text-center ${pendiente > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">Importe pendiente</span>
            <p className="text-xl font-extrabold">{pendiente.toFixed(2)} €</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Metodo de pago *" error={errors.metodo_pago?.message}>
              <select {...register('metodo_pago')} className={selectClass} style={selectBg}>
                {METODO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha compromiso pago">
              <input {...register('fecha_compromiso_pago')} type="date" className={inputClass} />
            </Field>
          </div>

          <Field label="Notas de pago">
            <textarea
              {...register('notas_pago')}
              placeholder="Observaciones sobre el acuerdo..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-600/20 disabled:opacity-50">
              {isSubmitting ? 'Registrando...' : 'Registrar conversion'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
