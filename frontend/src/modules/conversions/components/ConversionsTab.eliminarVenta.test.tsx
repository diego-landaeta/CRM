// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

/*
  CRM#1234 (gemela CRM-ISEIE#862) · Una venta con facturas sin anular (o con
  comisiones ya pagadas) no se borra: el servidor responde 409 diciendo qué
  facturas hay que anular antes. La pantalla lo enseña tal cual, con un título
  que dice que no se ha borrado, y recarga; no «Error» a secas.
*/

const MOTIVO = 'Esta venta tiene una factura sin anular. Antes de borrarla hay que anular la factura ISEIH-2026/0201.';
const venta = {
  id: 77, lead_id: 9, project_id: 2, producto_contratado: 'Curso', importe_total: 300,
  importe_pagado: 100, metodo_pago: 'transferencia', fecha_conversion: '2026-11-02', payments_count: 1,
};

const api = vi.hoisted(() => ({ remove: vi.fn(), toast: vi.fn(), byLead: vi.fn() }));
vi.mock('../api/conversions.api', () => ({
  conversionsApi: new Proxy({}, {
    get: (_t, nombre) => {
      if (nombre === 'byLead') return api.byLead;
      if (nombre === 'getById') return () => Promise.resolve({ success: true, data: { ...venta, payments: [] } });
      if (nombre === 'remove') return api.remove;
      return () => Promise.resolve({ success: true, data: [] });
    },
  }),
}));
vi.mock('@/shared/hooks/useToast', () => ({ toast: api.toast }));
vi.mock('@/modules/invoices/api/invoices.api', () => ({
  invoicesApi: new Proxy({}, { get: () => () => Promise.resolve({ success: true, data: [] }) }),
}));
vi.mock('@/modules/invoices/components/InvoiceButton', () => ({ default: () => null }));
vi.mock('@/modules/invoices/components/EmitirBorradorDialog', () => ({ default: () => null }));
vi.mock('@/modules/invoices/components/SendInvoiceDialog', () => ({ default: () => null }));
vi.mock('./ConversionDialog', () => ({ default: () => null }));
vi.mock('./PaymentDialog', () => ({ default: () => null }));
vi.mock('./RefundDialog', () => ({ default: () => null }));
vi.mock('./EditConversionDialog', () => ({ default: () => null }));
vi.mock('./InstallmentsDialog', () => ({ default: () => null }));

const { default: ConversionsTab } = await import('./ConversionsTab');

afterEach(() => { cleanup(); });
beforeEach(() => {
  vi.clearAllMocks();
  api.byLead.mockResolvedValue({ success: true, data: [venta] });
});

async function pedirBorrado() {
  render(<ConversionsTab lead={{ id: 9 }} projectId={2} canManage />);
  fireEvent.click(await screen.findByTitle('Eliminar', {}, { timeout: 5000 }));
  const dialogo = await screen.findByRole('dialog');
  fireEvent.click(within(dialogo).getByRole('button', { name: /Eliminar/ }));
  return dialogo;
}

describe('«Eliminar compra» con facturas (CRM#1234)', () => {
  it('el diálogo avisa de que con facturas sin anular no se podrá', async () => {
    render(<ConversionsTab lead={{ id: 9 }} projectId={2} canManage />);
    fireEvent.click(await screen.findByTitle('Eliminar', {}, { timeout: 5000 }));
    expect((await screen.findByRole('dialog')).textContent).toMatch(/facturas sin anular/);
  });

  it('409 por factura: título «No se puede eliminar esta compra», el texto del servidor y recarga', async () => {
    api.remove.mockRejectedValue(Object.assign(new Error(MOTIVO), {
      status: 409, data: { success: false, error: MOTIVO, code: 'SALE_HAS_INVOICE' },
    }));
    await pedirBorrado();
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se puede eliminar esta compra', description: MOTIVO, variant: 'destructive',
    })));
    expect(api.byLead.mock.calls.length).toBeGreaterThan(1);
  });

  it('409 por comisión pagada: el mismo título', async () => {
    const motivo = 'Esta venta tiene una comisión de tutor ya pagada (10.00 €). Reviértela en Tutores antes de borrar la venta.';
    api.remove.mockRejectedValue(Object.assign(new Error(motivo), {
      status: 409, data: { success: false, error: motivo, code: 'SALE_HAS_PAID_COMMISSION' },
    }));
    await pedirBorrado();
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se puede eliminar esta compra', description: motivo,
    })));
  });

  it('sin facturas: se borra como hoy', async () => {
    api.remove.mockResolvedValue({ success: true, data: { message: 'Conversion eliminada' } });
    await pedirBorrado();
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith(77, { reason: 'duplicada', motivo: null }));
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Conversión eliminada' })));
  });
});
