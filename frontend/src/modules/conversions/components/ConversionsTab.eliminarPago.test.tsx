// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

/*
  CRM#1228 + CRM#1230 (gemelas CRM-ISEIE#856 + #858) · «Eliminar pago» dice lo
  mismo que «Deshacer el pago» y que el servidor: cada pago llega con
  `cobro_bloqueo` (el texto del 409, o null si se puede). Con factura vigente
  lo explica sin preguntar «¿Eliminar pago?»; con la factura anulada y a cero
  pregunta y lo borra; si la API dice 409 igualmente, lo explica y recarga.

  Y el historial se recarga con la pestaña (QA en navegador del 28/11): tras un
  409 seguía con `cobro_bloqueo: null` y el siguiente clic volvía a preguntar y
  a llamar; tras un borrado bueno el cobro seguía en la lista y la cuota
  seguía «Pagada». El servidor de mentira de abajo cambia como el de verdad.
*/

const VIGENTE = 'Ese cobro tiene la factura ISEIH-2026/0201. Anúlala antes de borrar el cobro.';
const TUTOR = 'Ese cobro tiene una comisión de tutor ya pagada. Revierte la comisión antes de borrar el cobro.';

type Fila = Record<string, unknown> & { id: number };
let servidor: { pagos: Fila[]; cuotas: Fila[]; metodo: string };
const nuevoServidor = (metodo = 'transferencia') => ({
  metodo,
  pagos: [
    { id: 501, importe: 100, fecha: '2026-11-03', factura_id: 1, factura_codigo: 'ISEIH-2026/0201', factura_estado: 'pagada',
      factura_anulada: false, factura_anulada_a_cero: false, cobro_bloqueo: VIGENTE },
    { id: 502, importe: 100, fecha: '2026-11-04', factura_id: 2, factura_codigo: 'ISEIH-2026/0202', factura_estado: 'pagada',
      factura_anulada: true, factura_anulada_a_cero: true, cobro_bloqueo: null },
  ] as Fila[],
  cuotas: [
    { id: 71, numero: 1, importe_previsto: 100, fecha_vencimiento: '2026-11-04', fecha_cobro: '2026-11-04',
      importe_cobrado: 100, payment_id: 502, factura_id: 2, factura_codigo: 'ISEIH-2026/0202', factura_estado: 'pagada',
      factura_anulada: true, factura_anulada_a_cero: true, cobro_bloqueo: null },
  ] as Fila[],
});
const venta = () => ({
  id: 77, lead_id: 9, project_id: 2, producto_contratado: 'Curso', importe_total: 300,
  importe_pagado: 100 * servidor.pagos.length, metodo_pago: servidor.metodo, fecha_conversion: '2026-11-02',
  payments_count: servidor.pagos.length,
});

const api = vi.hoisted(() => ({ removePayment: vi.fn(), toast: vi.fn() }));
vi.mock('../api/conversions.api', () => ({
  conversionsApi: new Proxy({}, {
    get: (_t, nombre) => {
      if (nombre === 'byLead') return () => Promise.resolve({ success: true, data: [venta()] });
      if (nombre === 'getById') {
        return () => Promise.resolve({ success: true, data: {
          ...venta(), payments: servidor.pagos.map((p) => ({ ...p })), installments: servidor.cuotas.map((c) => ({ ...c })),
        } });
      }
      if (nombre === 'removePayment') return api.removePayment;
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

// Las papeleras salen en el orden de los pagos: 501 (vigente) y 502 (anulada).
const papeleras = () => screen.findAllByRole('button', { name: 'Eliminar pago', hidden: true }, { timeout: 5000 });
const confirmar = async () => fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
const abrir = () => render(<ConversionsTab lead={{ id: 9 }} projectId={2} canManage />);

afterEach(() => { cleanup(); });
beforeEach(() => {
  vi.clearAllMocks();
  servidor = nuevoServidor();
});

describe('«Eliminar pago» con la regla del servidor (CRM#1228 + CRM#1230)', () => {
  it('con factura vigente: lo explica con el texto del servidor y no pregunta ni borra', async () => {
    abrir();
    const [boton] = await papeleras();
    expect(boton).toHaveProperty('title', VIGENTE);
    fireEvent.click(boton);
    expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se puede eliminar este pago', description: VIGENTE, variant: 'destructive',
    }));
    expect(screen.queryByText('¿Eliminar pago?')).toBeNull();
    expect(api.removePayment).not.toHaveBeenCalled();
  });

  it('un doble clic en la papelera no apila el mismo aviso', async () => {
    abrir();
    const [boton] = await papeleras();
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(api.toast).toHaveBeenCalledTimes(1);
  });

  it('el historial dice que la factura está anulada, como el plan de cuotas', async () => {
    abrir();
    await papeleras();
    expect(screen.getByText(/Nº ISEIH-2026\/0202 · anulada/)).toBeTruthy();
    expect(screen.getByText(/Nº ISEIH-2026\/0201/).textContent).not.toMatch(/anulada/);
  });

  it('con la factura anulada y a cero: pregunta y lo borra', async () => {
    api.removePayment.mockResolvedValue({ success: true, data: { message: 'Pago eliminado', aviso: null } });
    abrir();
    const [, boton] = await papeleras();
    expect(boton).toHaveProperty('title', 'Eliminar pago');
    fireEvent.click(boton);
    expect(await screen.findByText('¿Eliminar pago?')).toBeTruthy();
    await confirmar();
    await waitFor(() => expect(api.removePayment).toHaveBeenCalledWith(502));
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pago eliminado' })));
  });

  it('tras un 409, el historial se recarga: el reintento ya no pregunta ni llama', async () => {
    // El cobro tenía una comisión de tutor pagada que la pantalla aún no sabía.
    api.removePayment.mockImplementation(async () => {
      servidor.pagos[1] = { ...servidor.pagos[1], cobro_bloqueo: TUTOR };
      throw Object.assign(new Error(TUTOR), { status: 409, data: { success: false, error: TUTOR, code: 'PAYMENT_HAS_PAID_COMMISSION' } });
    });
    abrir();
    fireEvent.click((await papeleras())[1]);
    await confirmar();
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se puede eliminar este pago', description: TUTOR, variant: 'destructive',
    })));
    // La lista se vuelve a pedir y ya trae el bloqueo.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Eliminar pago', hidden: true })[1]).toHaveProperty('title', TUTOR));

    api.toast.mockClear();
    fireEvent.click((await papeleras())[1]);
    expect(screen.queryByText('¿Eliminar pago?')).toBeNull();
    expect(api.removePayment).toHaveBeenCalledTimes(1);
    expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ description: TUTOR, variant: 'destructive' }));
  });

  it('tras borrar, el cobro desaparece del historial y su cuota vuelve a pendiente', async () => {
    servidor = nuevoServidor('fraccionado');
    api.removePayment.mockImplementation(async (id: number) => {
      servidor.pagos = servidor.pagos.filter((p) => p.id !== id);
      servidor.cuotas = servidor.cuotas.map((c) => (c.payment_id === id
        ? { ...c, fecha_cobro: null, importe_cobrado: null, payment_id: null, factura_id: null, factura_codigo: null }
        : c));
      return { success: true, data: { message: 'Pago eliminado', aviso: null } };
    });
    abrir();
    expect(await papeleras()).toHaveLength(2);
    expect(await screen.findByText(/1\/1 pagadas/)).toBeTruthy();

    fireEvent.click((await papeleras())[1]);
    await confirmar();
    await waitFor(() => expect(api.removePayment).toHaveBeenCalledWith(502));

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Eliminar pago', hidden: true })).toHaveLength(1));
    await waitFor(() => expect(screen.getByText(/0\/1 pagadas/)).toBeTruthy());
    expect(screen.getByText(/Ver historial de 1 pago/)).toBeTruthy();
  });

  it('el aviso de la comisión ya pagada sale como advertencia, no como éxito', async () => {
    const aviso = 'La comisión de la gestora de esta venta ya está pagada (20,00 €, el 20/11/2026): no se ha rebajado. Regularízala a mano si hace falta.';
    api.removePayment.mockResolvedValue({ success: true, data: { message: 'Pago eliminado', aviso } });
    abrir();
    fireEvent.click((await papeleras())[1]);
    await confirmar();
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Comisión ya pagada', description: aviso, variant: 'warning',
    })));
  });
});
