import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leadSchema, ORIGEN_OPTIONS, PAIS_OPTIONS } from '../validation/lead.schema';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useProducts } from '@/modules/products/hooks/useProducts';
import { X } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 px-1">{error}</p>}
    </div>
  );
}

const inputClass = 'w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';
const selectClass = inputClass + ' appearance-none cursor-pointer pr-9';
const selectBg = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

export default function LeadFormDialog({ open, onClose, lead, onSubmit }) {
  const { activeProject } = useProjectContext();
  const { products } = useProducts(activeProject?.id);
  const isEdit = !!lead;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      nombre: '',
      email: '',
      telefono: '',
      origen: 'directo',
      producto_interes: '',
      pais: '',
      notas: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset(lead ? {
        nombre: lead.nombre || '',
        email: lead.email || '',
        telefono: lead.telefono || '',
        origen: lead.origen?.toLowerCase().replace(' ', '_') || 'directo',
        pais: lead.pais || '',
        producto_interes: lead.producto_interes || '',
        notas: '',
      } : {
        nombre: '', email: '', telefono: '', origen: 'directo', producto_interes: '', notas: '',
      });
    }
  }, [open, lead, reset]);

  if (!open) return null;

  async function handleFormSubmit(data) {
    await onSubmit(data);
    onClose();
  }

  return (
    <Portal>
    <div role="dialog" aria-label={isEdit ? 'Editar Lead' : 'Nuevo Lead'} className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-lg mx-4 p-4 sm:p-8 overflow-y-auto max-h-[90vh] animate-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{isEdit ? 'Editar Lead' : 'Nuevo Lead'}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{isEdit ? 'Actualiza la informacion del lead' : 'Registra un nuevo lead manualmente'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre *" error={errors.nombre?.message}>
              <input {...register('nombre')} placeholder="Nombre completo" className={inputClass} />
            </Field>
            <Field label="Email *" error={errors.email?.message}>
              <input {...register('email')} type="email" placeholder="correo@ejemplo.com" className={inputClass} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Telefono" error={errors.telefono?.message}>
              <input {...register('telefono')} placeholder="+34 600 000 000" className={inputClass} />
            </Field>
            <Field label="Origen *" error={errors.origen?.message}>
              <select {...register('origen')} className={selectClass} style={selectBg}>
                {ORIGEN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Producto de interes">
              <select {...register('producto_interes')} className={selectClass} style={selectBg}>
                <option value="">Sin producto especifico</option>
                {products.map((p) => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            </Field>
            <Field label="Pais">
              <select {...register('pais')} className={selectClass} style={selectBg}>
                <option value="">Sin especificar</option>
                {PAIS_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notas">
            <textarea
              {...register('notas')}
              placeholder="Notas adicionales sobre el lead..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
            />
          </Field>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
