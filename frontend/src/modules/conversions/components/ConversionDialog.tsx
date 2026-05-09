import { useState, useEffect, useMemo, useRef, type FormEvent } from 'react';
import Portal from '@/shared/components/ui/portal';
import { X, Link as LinkIcon, Copy, CheckCircle } from '@phosphor-icons/react';
import { conversionsApi, type Conversion, type MetodoPago } from '../api/conversions.api';
import { useProducts } from '@/modules/products/hooks/useProducts';
import { toast } from '@/shared/hooks/useToast';
import { useEscapeKey } from '@/shared/hooks/useDialogA11y';
interface PaymentLink {
  label: string;
  url: string;
  tipo: string;
}

interface ConversionForm {
  producto_contratado: string;
  importe_total: string;
  importe_pagado: string;
  metodo_pago: MetodoPago;
  fecha_compromiso_pago: string;
  fecha_conversion: string;
  notas_pago: string;
}

// Acepta tanto Lead como Client; solo necesita id, nombre y opcional producto_nombre
interface ConversionDialogTarget {
  id: number;
  nombre?: string;
  producto_nombre?: string;
}

interface ConversionDialogProps {
  open: boolean;
  onClose: () => void;
  lead: ConversionDialogTarget | null | undefined;
  projectId: number;
  onCreated?: (data: Conversion) => void;
}

const METODOS: ReadonlyArray<{ value: MetodoPago; label: string }> = [
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'fraccionado', label: 'Fraccionado' },
];

export default function ConversionDialog({ open, onClose, lead, projectId, onCreated }: ConversionDialogProps) {
  useEscapeKey(onClose, open);
  const { products } = useProducts(projectId);
  const [saving, setSaving] = useState(false);
  const [selectedLinkIdx, setSelectedLinkIdx] = useState<string>('-1'); // '-1' = sin link, 'X' = índice, 'custom' = personalizado
  const [customLink, setCustomLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
  }, []);
  const [form, setForm] = useState<ConversionForm>({
    producto_contratado: '',
    importe_total: '',
    importe_pagado: '0',
    metodo_pago: 'tarjeta',
    fecha_compromiso_pago: '',
    fecha_conversion: new Date().toISOString().slice(0, 10),
    notas_pago: '',
  });

  // Producto seleccionado por nombre exacto (CRM-140) — para mostrar sus enlaces de pago
  const selectedProduct = useMemo(
    () => products.find((p: { nombre?: string }) => p.nombre === form.producto_contratado),
    [products, form.producto_contratado]
  );
  const productLinks = useMemo<PaymentLink[]>(() => {
    if (!selectedProduct) return [];
    if (Array.isArray(selectedProduct.payment_links) && selectedProduct.payment_links.length > 0) {
      return selectedProduct.payment_links as PaymentLink[];
    }
    if (selectedProduct.stripe_link) {
      return [{ label: 'Pago completo', url: selectedProduct.stripe_link, tipo: 'completo' }];
    }
    return [];
  }, [selectedProduct]);

  useEffect(() => {
    setSelectedLinkIdx('-1');
    setCustomLink('');
  }, [form.producto_contratado]);

  const activeLink = selectedLinkIdx === 'custom'
    ? customLink
    : selectedLinkIdx !== '-1' ? productLinks[Number(selectedLinkIdx)]?.url : '';

  async function copyActiveLink() {
    if (!activeLink) return;
    const { copyToClipboard } = await import('@/shared/lib/clipboard');
    const ok = await copyToClipboard(activeLink);
    if (ok) {
      setLinkCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setLinkCopied(false), 2000);
      toast({ title: 'Enlace copiado', description: 'Pégalo en WhatsApp/Email del cliente' });
    } else {
      toast({ title: 'No se pudo copiar', variant: 'destructive' });
    }
  }

  useEffect(() => {
    if (open && lead?.producto_nombre) {
      setForm(f => ({ ...f, producto_contratado: lead.producto_nombre }));
    }
  }, [open, lead]);

  if (!open) return null;

  const update = <K extends keyof ConversionForm>(k: K, v: ConversionForm[K]): void =>
    setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!lead?.id) {
      toast({ title: 'Lead inválido', description: 'No se pudo identificar el lead asociado.', variant: 'destructive' });
      return;
    }
    const importe = Number(form.importe_total);
    if (!form.producto_contratado?.trim()) {
      toast({ title: 'Producto requerido', variant: 'destructive' });
      return;
    }
    if (!form.importe_total || isNaN(importe) || importe <= 0) {
      toast({ title: 'Importe invalido', description: 'El importe debe ser mayor que 0', variant: 'destructive' });
      return;
    }
    if (Number(form.importe_pagado || 0) > importe) {
      toast({ title: 'Importe pagado invalido', description: 'No puede superar el total', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await conversionsApi.create({
        lead_id: lead.id,
        project_id: projectId,
        producto_contratado: form.producto_contratado,
        importe_total: Number(form.importe_total),
        importe_pagado: Number(form.importe_pagado || 0),
        metodo_pago: form.metodo_pago,
        fecha_compromiso_pago: form.fecha_compromiso_pago || null,
        fecha_conversion: form.fecha_conversion,
        notas_pago: form.notas_pago || null,
      });
      if (res.success && res.data) {
        toast({ title: 'Conversion registrada', description: `${form.producto_contratado} - ${form.importe_total}EUR` });
        onCreated?.(res.data);
        onClose();
      }
    } catch (err: any) {
      toast({
        title: 'Error al registrar conversion',
        description: err?.data?.error || err?.message || 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full h-9 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
  const selectClass = inputClass + ' appearance-none cursor-pointer pr-8';

  return (
    <Portal>
      <div role="dialog" className="fixed inset-0 !m-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-lg border border-border w-full max-w-lg mx-4 p-6 overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Registrar Conversion</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Lead: {lead?.nombre}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
              <X size={18} weight="bold" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Producto contratado *</label>
              {products.length > 0 ? (
                <select value={form.producto_contratado} onChange={e => update('producto_contratado', e.target.value)} className={selectClass}>
                  <option value="">Seleccionar o escribir abajo</option>
                  {products.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              ) : null}
              <input
                value={form.producto_contratado}
                onChange={e => update('producto_contratado', e.target.value)}
                placeholder="Nombre del producto/curso"
                className={inputClass + ' mt-2'}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Importe total (EUR) *</label>
                <input type="number" step="0.01" min="0.01" value={form.importe_total} onChange={e => update('importe_total', e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Importe pagado hoy</label>
                <input type="number" step="0.01" min="0" value={form.importe_pagado} onChange={e => update('importe_pagado', e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Metodo de pago</label>
                <select value={form.metodo_pago} onChange={e => update('metodo_pago', e.target.value as MetodoPago)} className={selectClass}>
                  {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Fecha conversion</label>
                <input type="date" value={form.fecha_conversion} onChange={e => update('fecha_conversion', e.target.value)} className={inputClass} />
              </div>
            </div>

            {form.metodo_pago === 'fraccionado' && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Fecha compromiso de pago pendiente</label>
                <input type="date" value={form.fecha_compromiso_pago} onChange={e => update('fecha_compromiso_pago', e.target.value)} className={inputClass} />
              </div>
            )}

            {/* Selector de enlace de pago Stripe (CRM-140) */}
            {(productLinks.length > 0 || form.producto_contratado) && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                  <LinkIcon size={12} weight="bold" /> Enlace de pago para compartir
                </div>
                <select
                  value={selectedLinkIdx}
                  onChange={(e) => setSelectedLinkIdx(e.target.value)}
                  className={selectClass}
                >
                  <option value="-1">Sin enlace</option>
                  {productLinks.map((l, i) => (
                    <option key={i} value={i}>
                      {l.label} {l.tipo !== 'completo' && `(${l.tipo})`}
                    </option>
                  ))}
                  <option value="custom">Personalizado…</option>
                </select>
                {selectedLinkIdx === 'custom' && (
                  <input
                    type="url"
                    value={customLink}
                    onChange={(e) => setCustomLink(e.target.value)}
                    placeholder="https://buy.stripe.com/..."
                    className={inputClass + ' font-mono text-xs'}
                  />
                )}
                {activeLink && (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-[11px] font-mono text-blue-700 dark:text-blue-300 bg-white/60 dark:bg-black/20 px-2 py-1.5 rounded">
                      {activeLink}
                    </code>
                    <button
                      type="button"
                      onClick={copyActiveLink}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex-shrink-0"
                    >
                      {linkCopied ? <CheckCircle size={12} weight="bold" /> : <Copy size={12} weight="bold" />}
                      {linkCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                )}
                {productLinks.length === 0 && form.producto_contratado && (
                  <p className="text-[10px] text-blue-700/70 dark:text-blue-300/70 italic">
                    Este producto no tiene enlaces configurados. Añádelos editando el producto.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Notas</label>
              <textarea value={form.notas_pago} onChange={e => update('notas_pago', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-sm outline-none resize-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Notas sobre el acuerdo..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Registrar conversion'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
