import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leadSchema, ORIGEN_OPTIONS, PAIS_OPTIONS, type LeadFormData } from '../validation/lead.schema';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useProducts } from '@/modules/products/hooks/useProducts';
import { X, Warning, Link as LinkIcon } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';
import ProductCombobox from './ProductCombobox';
import client from '@/shared/api/client';
import { useEscapeKey } from '@/shared/hooks/useDialogA11y';
import type { Lead } from '@/shared/types';

interface CustomFieldDef {
  id: number;
  field_key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'boolean';
  required?: boolean;
  options?: string[];
}

interface DuplicateLead {
  id: number;
  nombre: string;
  email: string;
  status?: string;
  estado?: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSubmit: (data: LeadFormData & { custom_fields: Record<string, unknown> }) => Promise<void> | void;
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground text-muted-foreground mb-1.5 block px-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1 px-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1 px-1">{error}</p>}
    </div>
  );
}

const inputClass = 'w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';
const selectClass = inputClass + ' appearance-none cursor-pointer pr-9';
const selectBg = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

export default function LeadFormDialog({ open, onClose, lead, onSubmit }: Props) {
  useEscapeKey(onClose, open);
  const { activeProject } = useProjectContext();
  const { products, refetch: refetchProducts } = useProducts(activeProject?.id);
  const isEdit = !!lead;
  const productoLabel = activeProject?.producto_label || 'Producto';

  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      nombre: '', email: '', telefono: '',
      origen: 'directo', producto_interes: '', pais: '', notas: '',
    },
  });

  const watchedEmail = watch('email');

  // Cargar custom fields al abrir dialog
  useEffect(() => {
    if (!open || !activeProject?.id) return;
    (async () => {
      try {
        const res = await client.get(`/field-definitions/project/${activeProject.id}?entity=lead`);
        if (res.success) setCustomFields(res.data || []);
      } catch {}
    })();
  }, [open, activeProject?.id]);

  useEffect(() => {
    if (open) {
      setDuplicates([]);
      reset(lead ? {
        nombre: lead.nombre || '',
        email: lead.email || '',
        telefono: lead.telefono || '',
        origen: ((lead.origen as string)?.toLowerCase().replace(' ', '_') || 'directo') as LeadFormData['origen'],
        pais: lead.pais || '',
        producto_interes: lead.producto_interes || '',
        notas: '',
      } : {
        nombre: '', email: '', telefono: '', origen: 'directo', producto_interes: '', notas: '',
      });
      setCustomValues((lead?.custom_fields as Record<string, unknown>) || {});
    }
  }, [open, lead, reset]);

  // Deteccion de duplicado debounce
  const checkDuplicates = useCallback(async (email: string | undefined): Promise<void> => {
    if (!email || !email.includes('@') || !activeProject?.id || isEdit) { setDuplicates([]); return; }
    try {
      const res = await client.get(`/leads?projectId=${activeProject.id}&search=${encodeURIComponent(email)}&limit=5`);
      if (res.success) {
        const matches = ((res.data as DuplicateLead[]) || []).filter((l) => (l.email || '').toLowerCase() === email.toLowerCase());
        setDuplicates(matches);
      }
    } catch { setDuplicates([]); }
  }, [activeProject?.id, isEdit]);

  useEffect(() => {
    const t = setTimeout(() => checkDuplicates(watchedEmail), 600);
    return () => clearTimeout(t);
  }, [watchedEmail, checkDuplicates]);

  if (!open) return null;

  async function handleFormSubmit(data: LeadFormData): Promise<void> {
    await onSubmit({ ...data, custom_fields: customValues });
    onClose();
  }

  return (
    <Portal>
      <div role="dialog" aria-label={isEdit ? 'Editar Lead' : 'Nuevo Prospecto'} className="fixed inset-0 !m-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-card rounded-lg border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-2xl mx-4 p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">{isEdit ? 'Editar Lead' : 'Nuevo Prospecto'}</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{isEdit ? 'Actualiza la información del lead' : 'Registra un nuevo lead manualmente'}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
              <X size={18} weight="bold" />
            </button>
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre *" error={errors.nombre?.message}>
                <input {...register('nombre')} placeholder="Nombre completo" className={inputClass} />
              </Field>
              <Field label="Email *" error={errors.email?.message}>
                <input {...register('email')} type="email" placeholder="correo@ejemplo.com" className={inputClass} />
              </Field>
            </div>

            {duplicates.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-md p-3 flex gap-3 items-start">
                <Warning size={16} weight="fill" className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                    Ya existe {duplicates.length} lead{duplicates.length > 1 ? 's' : ''} con ese email
                  </p>
                  {duplicates.slice(0, 3).map(d => (
                    <a key={d.id} href={`/leads/${d.id}`} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <LinkIcon size={10} /> {d.nombre} — {d.status || d.estado} — {new Date(d.created_at).toLocaleDateString('es-ES')}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Teléfono" error={errors.telefono?.message}>
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
              <Field label={`${productoLabel} de interes`}>
                <Controller
                  name="producto_interes"
                  control={control}
                  render={({ field }) => (
                    <ProductCombobox
                      value={field.value}
                      onChange={field.onChange}
                      products={products}
                      projectId={activeProject?.id}
                      projectLabel={productoLabel}
                      onProductCreated={() => refetchProducts?.()}
                    />
                  )}
                />
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

            {customFields.length > 0 && (
              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <p className="text-xs text-muted-foreground text-muted-foreground">Campos personalizados</p>
                <div className="grid grid-cols-2 gap-3">
                  {customFields.map(f => (
                    <div key={f.id} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                      <label className="text-xs text-muted-foreground text-muted-foreground mb-1.5 block px-1">
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                      </label>
                      {f.type === 'textarea' ? (
                        <textarea
                          value={(customValues[f.field_key] as string) || ''}
                          onChange={e => setCustomValues({ ...customValues, [f.field_key]: e.target.value })}
                          required={f.required}
                          className={inputClass + ' h-20 py-2 resize-none'}
                        />
                      ) : f.type === 'select' ? (
                        <select
                          value={(customValues[f.field_key] as string) || ''}
                          onChange={e => setCustomValues({ ...customValues, [f.field_key]: e.target.value })}
                          required={f.required}
                          className={selectClass} style={selectBg}
                        >
                          <option value="">Seleccionar...</option>
                          {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'boolean' ? (
                        <label className="flex items-center gap-2 h-9">
                          <input type="checkbox"
                            checked={!!customValues[f.field_key]}
                            onChange={e => setCustomValues({ ...customValues, [f.field_key]: e.target.checked })}
                          />
                          <span className="text-sm">Si</span>
                        </label>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                          value={(customValues[f.field_key] as string) || ''}
                          onChange={e => setCustomValues({ ...customValues, [f.field_key]: e.target.value })}
                          required={f.required}
                          className={inputClass}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Field label="Notas">
              <textarea
                {...register('notas')}
                placeholder="Notas adicionales sobre el lead..."
                rows={3}
                className="w-full px-4 py-3 rounded-md border border-border bg-muted/50 text-sm outline-none resize-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="h-9 px-4 rounded-md border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors"
              >Cancelar</button>
              <button type="submit" disabled={isSubmitting}
                className="h-9 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >{isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear lead'}</button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
