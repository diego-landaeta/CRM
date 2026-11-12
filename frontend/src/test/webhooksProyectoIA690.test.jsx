import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * #690 · Un campus IA no tiene Captación (`salvoTipo: ['ia']` en el menú). Lo que
 * venía de allí —Prospectos, Make, formularios, admisión por webhook— no sale en
 * Conexión › Webhooks: ni sus pestañas ni sus tarjetas del Resumen. Montado de
 * verdad, con el tipo pasando por `tipoDelMenu` (en pruebas, PROYECTOS_IA está
 * encendido, como en /testeo).
 */

const get = vi.fn();
const cabecera = { value: null };
vi.mock('@/shared/api/client', () => ({ default: { get: (...a) => get(...a) }, API_BASE_URL: '/crm/api' }));
vi.mock('@/contexts/ProjectContext', () => ({ useProjectContext: () => cabecera.value }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' }, projects: [], permissions: null }) }));
vi.mock('@/shared/hooks/usePermission', () => ({
  default: () => ({ can: () => true, tieneRol: () => true, llevaEquipo: false }),
}));

const { default: WebhooksLayout } = await import('@/modules/webhooks/pages/WebhooksLayout');
const { default: WebhooksResumenPage } = await import('@/modules/webhooks/pages/WebhooksResumenPage');
const { PROYECTOS_IA } = await import('@/shared/lib/proyectosIA');

const campus = (type) => ({ id: 4, nombre: 'Tarot IA', type, modules: {}, sociedad_emisora_id: 7 });

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ success: true, data: [] });
});

describe('Conexión › Webhooks en un campus IA', () => {
  it('en pruebas, PROYECTOS_IA está encendido (si no, esta prueba no prueba nada)', () => {
    expect(PROYECTOS_IA).toBe(true);
  });

  it('las pestañas: sin Prospectos ni Make', () => {
    cabecera.value = { activeProject: campus('ia'), activeIssuerId: null, projects: [] };
    render(<MemoryRouter><WebhooksLayout /></MemoryRouter>);
    const nav = screen.getByRole('navigation');
    expect(within(nav).queryByRole('link', { name: /Prospectos/ })).toBeNull();
    expect(within(nav).queryByRole('link', { name: /Make/ })).toBeNull();
    expect(within(nav).getByRole('link', { name: /Transferencias/ })).toBeTruthy();
  });

  it('en un campus de formación, todas', () => {
    cabecera.value = { activeProject: campus('educacion'), activeIssuerId: null, projects: [] };
    render(<MemoryRouter><WebhooksLayout /></MemoryRouter>);
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /Prospectos/ })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: /Make/ })).toBeTruthy();
  });

  it('el Resumen: sin las tarjetas de Captación, y sin pedir lo suyo', async () => {
    cabecera.value = { activeProject: campus('ia'), activeIssuerId: null, projects: [] };
    render(<MemoryRouter><WebhooksResumenPage /></MemoryRouter>);
    expect(await screen.findByTestId('tipo-transferencias')).toBeTruthy();
    for (const t of ['prospectos', 'admision-webhooks', 'make', 'formularios']) {
      expect(screen.queryByTestId(`tipo-${t}`)).toBeNull();
    }
    const pedidas = get.mock.calls.map(([u]) => u);
    expect(pedidas.some((u) => u.startsWith('/make-webhooks'))).toBe(false);
    expect(pedidas.some((u) => u.startsWith('/forms?'))).toBe(false);
  });

  it('en un campus de formación, el Resumen sí las pide', async () => {
    cabecera.value = { activeProject: campus('educacion'), activeIssuerId: null, projects: [] };
    render(<MemoryRouter><WebhooksResumenPage /></MemoryRouter>);
    expect(await screen.findByTestId('tipo-make')).toBeTruthy();
    expect(get.mock.calls.some(([u]) => u.startsWith('/make-webhooks'))).toBe(true);
  });
});
