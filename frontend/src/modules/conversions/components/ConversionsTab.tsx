import { useState, useEffect } from 'react';
import { conversionsApi, type Conversion, type Payment } from '../api/conversions.api';
import { toast } from '@/shared/hooks/useToast';
import ConversionDialog from './ConversionDialog';
import PaymentDialog from './PaymentDialog';
import { Plus, Receipt, CreditCard, Trash, WarningCircle, CheckCircle } from '@phosphor-icons/react';
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog';
import EmptyState from '@/shared/components/ui/EmptyState';
interface ConversionsTabTarget {
  id: number;
  nombre?: string;
  producto_nombre?: string;
}

interface ConversionsTabProps {
  lead: ConversionsTabTarget | null | undefined;
  projectId: number;
  canManage?: boolean;
}

function formatCurrency(n: number | string | null | undefined): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ConversionsTab({ lead, projectId, canManage }: ConversionsTabProps) {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogConv, setPaymentDialogConv] = useState<Conversion | null>(null);
  const [pendingPayment, setPendingPayment] = useState<number | null>(null);
  const [pendingConversion, setPendingConversion] = useState<number | null>(null);

  async function load(): Promise<void> {
    if (!lead?.id) return;
    setLoading(true);
    try {
      const res = await conversionsApi.byLead(lead.id);
      if (res.success) setConversions((res.data as Conversion[]) || []);
    } catch {
      // silencioso — la tab mostrará estado vacío
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [lead?.id]);

  function handleDeletePayment(paymentId: number): void { setPendingPayment(paymentId); }
  async function doDeletePayment(): Promise<void> {
    if (pendingPayment === null) return;
    try {
      await conversionsApi.removePayment(pendingPayment);
      toast({ title: 'Pago eliminado' });
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.data?.error || 'Error desconocido', variant: 'destructive' });
    } finally { setPendingPayment(null); }
  }

  function handleDeleteConversion(id: number): void { setPendingConversion(id); }
  async function doDeleteConversion(): Promise<void> {
    if (pendingConversion === null) return;
    try {
      await conversionsApi.remove(pendingConversion);
      toast({ title: 'Conversión eliminada' });
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.data?.error || 'Error desconocido', variant: 'destructive' });
    } finally { setPendingConversion(null); }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4 animate-pulse" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-md p-3">
            <div className="h-3 w-24 bg-muted rounded mb-2" />
            <div className="h-7 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const totalFacturado = conversions.reduce((acc, c) => acc + Number(c.importe_total), 0);
  const totalPagado = conversions.reduce((acc, c) => acc + Number(c.importe_pagado), 0);
  const totalPendiente = totalFacturado - totalPagado;

  return (
    <div className="space-y-4">
      {/* Header con stats */}
      <div className="flex items-start justify-between">
        <div className="grid grid-cols-3 gap-4 flex-1">
          <div className="bg-card border border-border rounded-md p-3">
            <div className="text-[10px] text-muted-foreground font-bold mb-1">Total facturado</div>
            <div className="text-xl font-semibold tabular-nums">{formatCurrency(totalFacturado)}</div>
          </div>
          <div className="bg-card border border-border rounded-md p-3">
            <div className="text-[10px] text-muted-foreground font-bold mb-1">Total pagado</div>
            <div className="text-xl font-semibold text-green-600 tabular-nums">{formatCurrency(totalPagado)}</div>
          </div>
          <div className="bg-card border border-border rounded-md p-3">
            <div className="text-[10px] text-muted-foreground font-bold mb-1">Pendiente</div>
            <div className="text-xl font-semibold text-orange-600 tabular-nums">{formatCurrency(totalPendiente)}</div>
          </div>
        </div>
      </div>

      {canManage && (
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
        >
          <Plus size={16} weight="bold" />
          Nueva conversión
        </button>
      )}

      {/* Lista de conversiones */}
      {conversions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Aún no hay compras registradas"
          description="Registra una conversión cuando este lead complete una compra."
          action={
            canManage && (
              <button
                onClick={() => setDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus size={14} weight="bold" />
                Registrar primera conversión
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {conversions.map((c) => {
            const pendiente = Number(c.importe_total) - Number(c.importe_pagado);
            const pagado = pendiente === 0;
            const vencido = c.fecha_compromiso_pago && pendiente > 0 && new Date(c.fecha_compromiso_pago) < new Date();

            return (
              <div key={c.id} className="bg-card border border-border rounded-md p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{c.producto_contratado}</h3>
                      {pagado && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><CheckCircle size={10} weight="fill" /> Pagado</span>}
                      {vencido && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"><WarningCircle size={10} weight="fill" /> Vencido</span>}
                      {!pagado && !vencido && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">Pendiente</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(c.fecha_conversion)} {c.metodo_pago ? `• ${c.metodo_pago}` : ''}
                      {c.fecha_compromiso_pago && ` • Compromiso: ${formatDate(c.fecha_compromiso_pago)}`}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      {!pagado && (
                        <button
                          onClick={() => setPaymentDialogConv(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20"
                        >
                          <CreditCard size={14} weight="bold" />
                          Abonar
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteConversion(c.id)}
                        className="p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash size={14} weight="bold" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Importes */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-[9px] text-muted-foreground font-bold">Total</div>
                    <div className="text-sm font-semibold tabular-nums">{formatCurrency(c.importe_total)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-[9px] text-muted-foreground font-bold">Pagado</div>
                    <div className="text-sm font-semibold text-green-600 tabular-nums">{formatCurrency(c.importe_pagado)}</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-[9px] text-muted-foreground font-bold">Pendiente</div>
                    <div className="text-sm font-semibold text-orange-600 tabular-nums">{formatCurrency(pendiente)}</div>
                  </div>
                </div>

                {/* Pagos */}
                {c.payments_count > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-semibold">
                      Ver {c.payments_count} pago{c.payments_count !== 1 ? 's' : ''} registrado{c.payments_count !== 1 ? 's' : ''}
                    </summary>
                    <PaymentsList conversionId={c.id} onDelete={handleDeletePayment} canManage={canManage} />
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConversionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        lead={lead}
        projectId={projectId}
        onCreated={() => load()}
      />

      <PaymentDialog
        open={!!paymentDialogConv}
        onClose={() => setPaymentDialogConv(null)}
        conversion={paymentDialogConv}
        onPaid={() => load()}
      />
      <ConfirmDialog open={pendingPayment !== null} title="¿Eliminar pago?" message="Se recalculará el total de la conversión." onConfirm={doDeletePayment} onCancel={() => setPendingPayment(null)} />
      <ConfirmDialog open={pendingConversion !== null} title="¿Eliminar conversión?" message="Se eliminarán todos sus pagos. Esta acción no se puede deshacer." onConfirm={doDeleteConversion} onCancel={() => setPendingConversion(null)} />
    </div>
  );
}

interface PaymentsListProps {
  conversionId: number;
  onDelete: (id: number) => void;
  canManage?: boolean;
}

function PaymentsList({ conversionId, onDelete, canManage }: PaymentsListProps) {
  const [payments, setPayments] = useState<Payment[] | null>(null);

  useEffect(() => {
    conversionsApi.getById(conversionId).then(res => {
      if (res.success && res.data) setPayments(res.data.payments || []);
    });
  }, [conversionId]);

  if (!payments) return <div className="mt-2 text-muted-foreground">Cargando…</div>;

  return (
    <ul className="mt-2 space-y-1">
      {payments.map(p => (
        <li key={p.id} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1.5">
          <div>
            <span className="font-semibold tabular-nums">{formatCurrency(p.importe)}</span>
            <span className="text-muted-foreground ml-2">{formatDate(p.fecha)}</span>
            {p.notas && <span className="text-muted-foreground ml-2">• {p.notas}</span>}
          </div>
          {canManage && (
            <button onClick={() => onDelete(p.id)} className="text-muted-foreground hover:text-red-600 p-0.5" title="Eliminar pago">
              <Trash size={12} weight="bold" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
