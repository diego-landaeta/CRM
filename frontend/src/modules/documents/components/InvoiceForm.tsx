import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash, Download, Eye, FloppyDisk, ArrowCounterClockwise, Receipt, X } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { documentsApi, type CrmDocument } from '../api/documents.api';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useInvoiceDefaults } from '../hooks/useInvoiceDefaults';
import ClientCombobox, { type ClientPick } from './ClientCombobox';
import { getAccessToken } from '@/shared/api/client';

const inp = 'w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all';

interface InvoiceLine {
  descripcion: string;
  cantidad: number | string;
  precio: number | string;
}

export interface InvoiceFormValues {
  emisor_nombre: string;
  emisor_nif: string;
  emisor_direccion: string;
  emisor_telefono: string;
  fecha: string;
  iva_pct: number | string;
  cliente_nombre: string;
  cliente_dni: string;
  cliente_direccion: string;
  notas: string;
  lineas: InvoiceLine[];
}

interface InvoiceFormProps {
  onGenerated?: (doc: CrmDocument) => void;
  /**
   * Pre-rellena el form (al duplicar una factura existente o desde una conversión).
   */
  initialValues?: Partial<InvoiceFormValues>;
}

const todayLocal = (): string => new Date().toISOString().slice(0, 10);

const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);

export default function InvoiceForm({ onGenerated, initialValues }: InvoiceFormProps) {
  const { activeProject } = useProjectContext();
  const { defaults, save: saveDefaults, reset: resetDefaults } = useInvoiceDefaults(activeProject?.id);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<InvoiceFormValues>({
    defaultValues: {
      emisor_nombre: defaults.emisor_nombre,
      emisor_nif: defaults.emisor_nif,
      emisor_direccion: defaults.emisor_direccion,
      emisor_telefono: defaults.emisor_telefono,
      fecha: todayLocal(),
      iva_pct: defaults.iva_pct,
      cliente_nombre: '',
      cliente_dni: '',
      cliente_direccion: '',
      notas: defaults.notas,
      lineas: [{ descripcion: '', cantidad: 1, precio: '' }],
      ...initialValues,
    },
  });

  // Si llegan initialValues nuevos (duplicar otra factura), recargar todo
  useEffect(() => {
    if (initialValues) {
      reset({
        emisor_nombre: defaults.emisor_nombre,
        emisor_nif: defaults.emisor_nif,
        emisor_direccion: defaults.emisor_direccion,
        emisor_telefono: defaults.emisor_telefono,
        fecha: todayLocal(),
        iva_pct: defaults.iva_pct,
        notas: defaults.notas,
        cliente_nombre: '',
        cliente_dni: '',
        cliente_direccion: '',
        lineas: [{ descripcion: '', cantidad: 1, precio: '' }],
        ...initialValues,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const { fields, append, remove } = useFieldArray({ control, name: 'lineas' });
  const lineas = watch('lineas');
  const ivaPct = parseFloat(String(watch('iva_pct'))) || 0;

  // Totales por línea + globales
  const lineTotals = lineas.map((l) => {
    const qty = parseFloat(String(l.cantidad || 0));
    const price = parseFloat(String(l.precio || 0));
    return Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0;
  });
  const subtotal = lineTotals.reduce((s, n) => s + n, 0);
  const iva = subtotal * (ivaPct / 100);
  const total = subtotal + iva;

  const cliente_nombre = watch('cliente_nombre');

  function handleClientPick(c: ClientPick) {
    setValue('cliente_nombre', c.nombre, { shouldDirty: true });
    if (c.dni) setValue('cliente_dni', c.dni, { shouldDirty: true });
    if (c.direccion) setValue('cliente_direccion', c.direccion, { shouldDirty: true });
  }

  function handleSaveDefaults() {
    const formValues = watch();
    saveDefaults({
      emisor_nombre: formValues.emisor_nombre,
      emisor_nif: formValues.emisor_nif,
      emisor_direccion: formValues.emisor_direccion,
      emisor_telefono: formValues.emisor_telefono,
      iva_pct: parseFloat(String(formValues.iva_pct)) || 21,
      notas: formValues.notas,
    });
    toast({ title: 'Datos del emisor guardados', description: 'Se autocompletarán en futuras facturas' });
  }

  async function handlePreview(): Promise<void> {
    setPreviewing(true);
    try {
      const data = watch();
      const baseUrl = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');
      const token = getAccessToken() || '';
      const res = await fetch(`${baseUrl}/api/documents/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'invoice', data }),
      });
      if (!res.ok) {
        toast({ title: 'Error generando preview', variant: 'destructive' });
        return;
      }
      const html = await res.text();
      setPreviewHtml(html);
    } catch {
      toast({ title: 'Error generando preview', variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  }

  async function onSubmit(data: InvoiceFormValues): Promise<void> {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await documentsApi.generate(activeProject.id, 'invoice', data as unknown as Record<string, unknown>);
      if (res.success && res.data) {
        // Auto-guardar emisor al generar exitosamente (UX: aprende de tu última factura)
        saveDefaults({
          emisor_nombre: data.emisor_nombre,
          emisor_nif: data.emisor_nif,
          emisor_direccion: data.emisor_direccion,
          emisor_telefono: data.emisor_telefono,
          iva_pct: parseFloat(String(data.iva_pct)) || 21,
          notas: data.notas,
        });
        toast({ title: 'Factura generada', description: `Nº ${res.data.number}` });
        onGenerated?.(res.data);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Emisor */}
      <section className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm">Datos del emisor</h3>
            <p className="text-[11px] text-muted-foreground">Se guardan automáticamente al generar la factura</p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSaveDefaults}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11px] font-medium border border-border bg-card hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              title="Guardar como predeterminado"
            >
              <FloppyDisk size={12} /> Guardar
            </button>
            <button
              type="button"
              onClick={() => { resetDefaults(); toast({ title: 'Defaults restaurados' }); }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11px] font-medium border border-border bg-card hover:bg-muted transition-colors text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              title="Restaurar"
            >
              <ArrowCounterClockwise size={12} /> Reset
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nombre / Razón social</label>
            <input {...register('emisor_nombre')} className={inp} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">NIF</label>
            <input {...register('emisor_nif')} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Dirección</label>
            <textarea {...register('emisor_direccion')} rows={2} className={inp + ' h-auto py-2'} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Teléfono</label>
            <input {...register('emisor_telefono')} className={inp} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha de la factura</label>
            <input type="date" {...register('fecha')} className={inp} />
          </div>
        </div>
      </section>

      {/* Cliente */}
      <section className="bg-card border border-border rounded-lg p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-sm">Datos del cliente</h3>
          <p className="text-[11px] text-muted-foreground">Busca por nombre/email para autocompletar desde tu base de prospectos</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Nombre o Razón Social</label>
            <ClientCombobox
              projectId={activeProject?.id}
              value={cliente_nombre}
              onChange={(v) => setValue('cliente_nombre', v, { shouldDirty: true })}
              onSelect={handleClientPick}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">DNI / NIF</label>
            <input {...register('cliente_dni')} className={inp} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Dirección</label>
            <input {...register('cliente_direccion')} className={inp} />
          </div>
        </div>
      </section>

      {/* Líneas */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-4">Conceptos</h3>

        {/* Desktop header */}
        <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
          <span className="col-span-6">Descripción</span>
          <span className="col-span-2 text-center">Cantidad</span>
          <span className="col-span-2 text-center">Precio (€)</span>
          <span className="col-span-1 text-right">Subtotal</span>
          <span className="col-span-1" />
        </div>

        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 gap-2 items-start sm:items-center pb-2 sm:pb-0 border-b border-border sm:border-0 last:border-0">
              <input
                {...register(`lineas.${i}.descripcion`)}
                className={inp + ' col-span-12 sm:col-span-6'}
                placeholder="Descripción del servicio"
              />
              <div className="col-span-4 sm:col-span-2">
                <span className="sm:hidden text-[10px] text-muted-foreground block">Cantidad</span>
                <input
                  {...register(`lineas.${i}.cantidad`)}
                  type="number" min="1" step="1"
                  className={inp + ' text-center'}
                  defaultValue={1}
                  aria-label={`Cantidad línea ${i + 1}`}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <span className="sm:hidden text-[10px] text-muted-foreground block">Precio (€)</span>
                <input
                  {...register(`lineas.${i}.precio`)}
                  type="number" step="0.01" min="0"
                  className={inp + ' text-center'}
                  placeholder="0,00"
                  aria-label={`Precio línea ${i + 1}`}
                />
              </div>
              <div className="col-span-3 sm:col-span-1 text-right tabular-nums font-semibold text-sm pt-2 sm:pt-0" aria-label={`Subtotal línea ${i + 1}`}>
                {fmtMoney(lineTotals[i] || 0)}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={fields.length === 1}
                aria-label={`Eliminar línea ${i + 1}`}
                className="col-span-1 flex justify-center text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed pt-2 sm:pt-0"
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({ descripcion: '', cantidad: 1, precio: '' })}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-primary font-semibold hover:bg-primary/5 transition-colors mt-2"
          >
            <Plus size={13} /> Añadir línea
          </button>
        </div>

        {/* Totales */}
        <div className="mt-5 flex justify-end">
          <div className="w-full sm:w-72 border border-border rounded-md overflow-hidden text-sm">
            <div className="flex justify-between items-center px-4 py-2 border-b border-border tabular-nums">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmtMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2 border-b border-border tabular-nums">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span>IVA</span>
                <input
                  {...register('iva_pct')}
                  type="number" min="0" max="100" step="1"
                  className="w-12 h-7 text-center border border-border rounded text-xs bg-muted/50 tabular-nums"
                  aria-label="Porcentaje IVA"
                />
                <span className="text-xs">%</span>
              </div>
              <span>{fmtMoney(iva)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 font-bold tabular-nums bg-muted/30">
              <span>Total</span>
              <span className="text-primary">{fmtMoney(total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Notas / IBAN */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-3">Notas / Datos bancarios</h3>
        <p className="text-[11px] text-muted-foreground mb-2">Aparecerá al pie de la factura. Se guarda como predeterminado.</p>
        <textarea
          {...register('notas')}
          rows={3}
          className={inp + ' h-auto py-2 font-mono text-xs'}
          placeholder="IBAN: ES12 1234 5678 9012 3456 7890&#10;Beneficiario: ...&#10;Concepto: ..."
        />
      </section>

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row justify-end gap-2 sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 sm:py-0 bg-background sm:bg-transparent border-t border-border sm:border-0">
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewing || loading}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Eye size={16} />
          {previewing ? 'Generando…' : 'Vista previa'}
        </button>
        <button
          type="submit"
          disabled={loading || previewing}
          className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Download size={16} />
          {loading ? 'Generando PDF…' : 'Generar Factura'}
        </button>
      </div>
    </form>

    {/* Preview modal */}
    {previewHtml && (
      <PreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />
    )}
    </>
  );
}

// ─── Preview modal local ──────────────────────────────────────────────────────
interface PreviewModalProps {
  html: string;
  onClose: () => void;
}

function PreviewModal({ html, onClose }: PreviewModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-preview-title"
        className="bg-card rounded-xl border border-border shadow-2xl flex flex-col w-full max-w-5xl max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-primary" />
            <span id="invoice-preview-title" className="font-semibold text-sm">Vista previa de la factura</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden bg-muted/30 min-h-[70vh]">
          <iframe
            srcDoc={html}
            className="w-full h-full border-0"
            title="Vista previa de la factura"
          />
        </div>
      </div>
    </div>
  );
}
