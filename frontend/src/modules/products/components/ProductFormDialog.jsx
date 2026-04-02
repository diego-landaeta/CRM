import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema } from '../validation/product.schema';
import { X } from '@phosphor-icons/react';

const inputClass = 'w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 px-1">{error}</p>}
    </div>
  );
}

export default function ProductFormDialog({ open, onClose, product, onSubmit }) {
  const isEdit = !!product;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: { nombre: '', descripcion: '' },
  });

  useEffect(() => {
    if (open) {
      reset(product ? { nombre: product.nombre || '', descripcion: product.descripcion || '' } : { nombre: '', descripcion: '' });
    }
  }, [open, product, reset]);

  if (!open) return null;

  async function handleFormSubmit(data) {
    await onSubmit(data);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-md mx-4 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{isEdit ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{isEdit ? 'Actualiza la informacion del producto' : 'Registra un nuevo producto'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
            <X size={18} weight="bold" />
          </button>
        </div>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <Field label="Nombre *" error={errors.nombre?.message}>
            <input {...register('nombre')} placeholder="Nombre del producto o formacion" className={inputClass} />
          </Field>
          <Field label="Descripcion" error={errors.descripcion?.message}>
            <textarea
              {...register('descripcion')}
              placeholder="Descripcion corta del producto..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
