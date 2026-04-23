import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema } from '../validation/product.schema';
import { X, CurrencyEur, Link, Tag } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';
import client from '@/shared/api/client';
import { useProjectContext } from '@/contexts/ProjectContext';

const inputClass = 'w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';
const smallInput = 'w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary';

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1 px-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1 px-1">{error}</p>}
    </div>
  );
}

export default function ProductFormDialog({ open, onClose, product, onSubmit }) {
  const { activeProject } = useProjectContext();
  const productoLabel = activeProject?.producto_label || 'Producto';
  const isEdit = !!product;
  const [categories, setCategories] = useState([]);
  const [categoriaSel, setCategoriaSel] = useState('');
  const [subcategoriaSel, setSubcategoriaSel] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: { nombre: '', descripcion: '', precio: '', moneda: 'EUR', stripe_link: '', sku: '', duracion: '', url_info: '' },
  });

  useEffect(() => {
    if (!open || !activeProject?.id) return;
    (async () => {
      try {
        const res = await client.get(`/product-categories/project/${activeProject.id}`);
        if (res.success) setCategories(res.data || []);
      } catch {}
    })();
  }, [open, activeProject?.id]);

  useEffect(() => {
    if (open) {
      reset(product ? {
        nombre: product.nombre || '',
        descripcion: product.descripcion || '',
        precio: product.precio || '',
        moneda: product.moneda || 'EUR',
        stripe_link: product.stripe_link || '',
        sku: product.sku || '',
        duracion: product.duracion || '',
        url_info: product.url_info || '',
      } : { nombre: '', descripcion: '', precio: '', moneda: 'EUR', stripe_link: '', sku: '', duracion: '', url_info: '' });
      setCategoriaSel(product?.categoria_id ? String(product.categoria_id) : '');
      setSubcategoriaSel(product?.subcategoria_id ? String(product.subcategoria_id) : '');
    }
  }, [open, product, reset]);

  if (!open) return null;

  const parents = categories.filter(c => !c.parent_id);
  const subs = categories.filter(c => String(c.parent_id) === categoriaSel);

  async function handleFormSubmit(data) {
    const payload = {
      ...data,
      precio: data.precio === '' || data.precio === null || Number.isNaN(data.precio) ? null : Number(data.precio),
      categoria_id: categoriaSel ? Number(categoriaSel) : null,
      subcategoria_id: subcategoriaSel ? Number(subcategoriaSel) : null,
    };
    // Normalizar vacios a null
    ['stripe_link', 'sku', 'duracion', 'url_info'].forEach(k => { if (!payload[k]) payload[k] = null; });
    await onSubmit(payload);
    onClose();
  }

  return (
    <Portal>
    <div role="dialog" aria-label={isEdit ? `Editar ${productoLabel}` : `Nuevo ${productoLabel}`} className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-xl w-full max-w-2xl mx-4 p-4 sm:p-7 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{isEdit ? `Editar ${productoLabel.toLowerCase()}` : `Nuevo ${productoLabel.toLowerCase()}`}</h2>
            <p className="text-muted-foreground text-sm mt-0.5">{isEdit ? 'Actualiza la informacion' : 'Registra uno nuevo con precio y detalles'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted">
            <X size={18} weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre *" error={errors.nombre?.message}>
              <input {...register('nombre')} placeholder={`Nombre del ${productoLabel.toLowerCase()}`} className={inputClass} />
            </Field>
            <Field label="SKU / codigo" error={errors.sku?.message}>
              <input {...register('sku')} placeholder="opcional" className={inputClass} />
            </Field>
          </div>

          <Field label="Descripcion" error={errors.descripcion?.message}>
            <textarea
              {...register('descripcion')}
              placeholder="Descripcion corta..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm outline-none resize-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card"
            />
          </Field>

          <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-muted-foreground">
              <Tag size={12} /> Categorizacion
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={categoriaSel} onChange={e => { setCategoriaSel(e.target.value); setSubcategoriaSel(''); }} className={smallInput}>
                <option value="">Sin categoria</option>
                {parents.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select value={subcategoriaSel} onChange={e => setSubcategoriaSel(e.target.value)} className={smallInput} disabled={!subs.length}>
                <option value="">{subs.length ? 'Sin subcategoria' : '—'}</option>
                {subs.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-muted-foreground">
              <CurrencyEur size={12} /> Precio y venta
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Precio" error={errors.precio?.message}>
                <input {...register('precio')} type="number" step="0.01" min="0" placeholder="0.00" className={smallInput} />
              </Field>
              <Field label="Moneda">
                <select {...register('moneda')} className={smallInput}>
                  <option value="EUR">EUR &euro;</option>
                  <option value="USD">USD $</option>
                  <option value="MXN">MXN $</option>
                  <option value="COP">COP $</option>
                </select>
              </Field>
              <Field label="Duracion" hint="ej: 8 sesiones">
                <input {...register('duracion')} placeholder="opcional" className={smallInput} />
              </Field>
            </div>
            <Field label="Enlace de pago Stripe" error={errors.stripe_link?.message} hint="Payment Link o Checkout URL">
              <input {...register('stripe_link')} placeholder="https://buy.stripe.com/..." className={smallInput} />
            </Field>
            <Field label="URL de informacion / landing" error={errors.url_info?.message}>
              <input {...register('url_info')} placeholder="https://..." className={smallInput} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : `Crear ${productoLabel.toLowerCase()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
