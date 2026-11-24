import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Diego, 24/11: «si alguien escribe, que se vea un símbolo de notificación, no solo
 * en la campana, sino donde dice Consultas». El menú pone en «Consultas» cuántas
 * esperan respuesta: la tutora, las suyas; administración, las de sus campus.
 */
const estado = vi.hoisted(() => ({ role: 'tutor', permisos: { 'consultas.atender': true, 'consultas.view': false } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 3, nombre: 'Tutora', email: 't@x.test', role: estado.role }, permissions: estado.permisos, logout: vi.fn() }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectContext: () => ({ activeProject: { id: 1, nombre: 'ISEF', tipo: 'educacion', modules: null }, projects: [{ id: 1, nombre: 'ISEF' }], setActiveProject: vi.fn() }),
}));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }), useOptionalTheme: () => 'light' }));
const get = vi.fn();
vi.mock('@/shared/api/client', () => ({ default: { get: (...a) => get(...a), post: vi.fn() } }));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));
vi.mock('@/shared/hooks/usePermission', () => ({ default: () => ({ can: (k) => !!estado.permisos[k], llevaEquipo: false }) }));

const { default: Sidebar } = await import('@/shared/components/layout/Sidebar');

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url) => (String(url).startsWith('/consultas')
    ? { success: true, data: { consultas: [], total: 3, plazoHoras: 24 } }
    : { success: true, data: [] }));
});

describe('el aviso en «Consultas»', () => {
  it('la tutora ve cuántas suyas esperan respuesta', async () => {
    estado.role = 'tutor'; estado.permisos = { 'consultas.atender': true };
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(get.mock.calls.some((c) => c[0] === '/consultas/mias?estado=pendientes')).toBe(true));
    const enlace = (await screen.findAllByRole('link')).find((a) => a.getAttribute('href') === '/consultas');
    await waitFor(() => expect(enlace.textContent).toContain('3'));
  });

  it('administración, las de su campus', async () => {
    estado.role = 'admin'; estado.permisos = { 'consultas.view': true };
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(get.mock.calls.some((c) => String(c[0]).startsWith('/consultas?') && c[0].includes('estado=pendientes') && c[0].includes('projectId=1'))).toBe(true));
  });

  it('sin permiso de consultas, no se pregunta', async () => {
    estado.role = 'gestor'; estado.permisos = { 'leads.view': true };
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 50));
    expect(get.mock.calls.some((c) => String(c[0]).startsWith('/consultas'))).toBe(false);
  });
});
