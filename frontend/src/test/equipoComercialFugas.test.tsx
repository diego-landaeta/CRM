import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Las fugas del equipo comercial en la pantalla (QA del 09/11/2026, #704).
 *
 * `/auth/me` dice el alcance (`alcance_comercial`, `lleva_equipo`). Con él:
 *   · los desplegables de gestora ofrecen solo las de su alcance;
 *   · en Facturas, quien lleva un equipo no ve Editar, Abono, Venta ni
 *     Eliminar (el servidor le da 403) y se le dice por qué;
 *   · en Finanzas, sin egresos ni balance, con la marca de que son solo para
 *     la administración sin equipo.
 */

const get = vi.hoisted(() => vi.fn());
const sesion = vi.hoisted(() => ({ user: null as any }));
const ctx = vi.hoisted(() => ({ value: null as any }));
vi.mock('@/shared/api/client', () => ({ default: { get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: sesion.user }) }));
vi.mock('@/contexts/ProjectContext', () => ({ useProjectContext: () => ctx.value }));
vi.mock('@/shared/hooks/usePermission', () => ({ default: () => ({ can: () => true }) }));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));
// Lo que no se prueba aquí y pide más cosas al servidor.
vi.mock('@/modules/invoices/components/FacturacionAlDiaCard', () => ({ default: () => null }));
vi.mock('@/modules/invoices/components/AvisoHuecosFacturas', () => ({ default: () => null }));
vi.mock('@/modules/ia-dashboard/hooks/useStripeMonitor', () => ({ useStripeMonitor: () => ({ metrics: null }) }));

const { soloDelAlcance, llevaEquipo, alcanceDe } = await import('@/shared/lib/alcanceComercial');
const { default: SalesPage } = await import('@/modules/sales/pages/SalesPage');
const { default: InvoicesPage } = await import('@/modules/invoices/pages/InvoicesPage');
const { default: AccountingDashboardPage } = await import('@/modules/accounting/pages/AccountingDashboardPage');

const esperar = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const LIDER = { id: 5, role: 'admin', alcance_comercial: [5, 11], lleva_equipo: true };
const ADMIN = { id: 6, role: 'admin', alcance_comercial: null, lleva_equipo: false };
const GESTORAS = [
  { id: 5, nombre: 'Raquel', active: true },
  { id: 11, nombre: 'Ana de mi equipo', active: true },
  { id: 12, nombre: 'Bea de fuera', active: true },
];
const FACTURA = {
  id: 9, tipo: 'normal', estado: 'emitida', codigo: '2026/0009', serie: 'A', numero: 9, ano: 2026,
  cliente_nombre: 'Cliente', cliente_nif: 'X', cliente_direccion: 'Calle', cliente_ciudad: 'Ciudad',
  cliente_cp: '00000', cliente_pais: 'ES', total: 121, base_imponible: 100, fecha_emision: '2026-11-01',
  project_id: 1, moneda: 'EUR', items: [],
};
const DASHBOARD = (soloEquipo: boolean) => ({
  ingresos: { total_cobrado: 100, total_facturado: 150, total_pendiente: 50, num_pagos: 1, num_conversiones: 1,
    total_emitido: 21, num_facturas: 1, num_proformas: 0, total_proformas: 0 },
  egresos: { total: soloEquipo ? 0 : 30, num_egresos: soloEquipo ? 0 : 1,
    por_categoria: soloEquipo ? [] : [{ categoria: 'Software', total: 30 }], oculto: soloEquipo },
  balance: soloEquipo ? null : 70,
  solo_equipo: soloEquipo,
  cuentas_por_cobrar: [],
  cuentas_por_cobrar_resumen: { num: 0, total: 0, num_vencido: 0, total_vencido: 0 },
  trend: { ingresos: [], egresos: [] },
});

let soloEquipo = false;
beforeEach(() => {
  soloEquipo = false;
  ctx.value = {
    activeProject: { id: 1, nombre: 'ISEIH', sociedad_emisora_id: 8 },
    activeIssuer: null, activeIssuerId: null,
    projects: [{ id: 1, nombre: 'ISEIH', sociedad_emisora_id: 8 }],
    switchProject: vi.fn(), switchIssuer: vi.fn(),
  };
  get.mockReset();
  get.mockImplementation((url: string) => {
    if (url.startsWith('/users')) return Promise.resolve({ success: true, data: GESTORAS });
    if (url.startsWith('/accounting/dashboard')) return Promise.resolve({ success: true, data: DASHBOARD(soloEquipo) });
    if (url.startsWith('/invoices/stats')) return Promise.resolve({ success: true, data: { total: 1 } });
    if (/^\/invoices(\?|$)/.test(url)) {
      return Promise.resolve({ success: true, data: [FACTURA], pagination: { total: 1, page: 1, limit: 50, totalPages: 1 } });
    }
    return Promise.resolve({ success: true, data: [] });
  });
});

describe('el alcance en la pantalla', () => {
  it('soloDelAlcance: la líder, su equipo; sin límite, todas', () => {
    expect(soloDelAlcance(GESTORAS, LIDER).map((g) => g.id)).toEqual([5, 11]);
    expect(soloDelAlcance(GESTORAS, ADMIN)).toHaveLength(3);
    expect(soloDelAlcance(GESTORAS, null)).toHaveLength(3);
    expect(alcanceDe(ADMIN)).toBeNull();
    expect(llevaEquipo(LIDER)).toBe(true);
    expect(llevaEquipo(ADMIN)).toBe(false);
    expect(llevaEquipo({ alcance_comercial: [7] })).toBe(false);
  });
});

describe('desplegable de gestora (Ventas)', () => {
  it('a la líder solo le ofrece las de su equipo', async () => {
    sesion.user = LIDER;
    render(<MemoryRouter><SalesPage /></MemoryRouter>);
    await esperar();
    expect(screen.getByRole('option', { name: 'Ana de mi equipo' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Bea de fuera' })).toBeNull();
  });

  it('a la admin sin equipo, todas', async () => {
    sesion.user = ADMIN;
    render(<MemoryRouter><SalesPage /></MemoryRouter>);
    await esperar();
    expect(screen.getByRole('option', { name: 'Bea de fuera' })).toBeTruthy();
  });
});

describe('Facturas: botones que el servidor negaría', () => {
  it('quien lleva equipo no ve Editar, Abono, Venta ni Eliminar, y se le dice por qué', async () => {
    sesion.user = LIDER;
    render(<MemoryRouter><InvoicesPage /></MemoryRouter>);
    await esperar();
    await esperar();
    expect(screen.getByText('2026/0009')).toBeTruthy();
    expect(screen.queryByTitle('Crear factura rectificativa (de abono)')).toBeNull();
    expect(screen.queryByTitle('Asociar esta factura a una venta del cliente')).toBeNull();
    expect(screen.queryByTitle('Eliminar la factura y liberar su número (se equivocaron al cargarla)')).toBeNull();
    expect(screen.queryByTitle('Editar IVA, datos del cliente o concepto')).toBeNull();
    expect(screen.getByRole('note').textContent).toContain('Llevas un equipo comercial');
  });

  it('la admin sin equipo, sí', async () => {
    sesion.user = ADMIN;
    render(<MemoryRouter><InvoicesPage /></MemoryRouter>);
    await esperar();
    await esperar();
    expect(screen.getByTitle('Crear factura rectificativa (de abono)')).toBeTruthy();
    expect(screen.getByTitle('Asociar esta factura a una venta del cliente')).toBeTruthy();
    expect(screen.getByTitle('Eliminar la factura y liberar su número (se equivocaron al cargarla)')).toBeTruthy();
    expect(screen.queryByText(/Llevas un equipo comercial/)).toBeNull();
  });
});

describe('Finanzas › Dashboard', () => {
  it('con solo_equipo: sin Egresos ni Balance, con la marca', async () => {
    soloEquipo = true;
    sesion.user = LIDER;
    render(<MemoryRouter><AccountingDashboardPage /></MemoryRouter>);
    await esperar();
    await esperar();
    expect(screen.getByText('Ingresos cobrados')).toBeTruthy();
    expect(screen.queryByText('Balance neto')).toBeNull();
    expect(screen.queryByText('Egresos')).toBeNull();
    expect(screen.getByText(/Egresos y balance: solo para administración sin equipo/)).toBeTruthy();
  });

  it('sin equipo: Egresos y Balance como siempre', async () => {
    sesion.user = ADMIN;
    render(<MemoryRouter><AccountingDashboardPage /></MemoryRouter>);
    await esperar();
    await esperar();
    expect(screen.getByText('Balance neto')).toBeTruthy();
    expect(screen.queryByText(/solo para administración sin equipo/)).toBeNull();
  });
});
