import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { pathAllowsAll, rutaAceptaSociedad } from '@/shared/components/layout/AppLayout';

/**
 * CRM#513 · Asignación de leads, «por empresa y campus» (Diego, 28/10). Con una
 * empresa en la cabecera salía el muro de «elige un campus», y con un campus se
 * veían igual las configuraciones y decisiones de todos.
 */

const { cabecera, get } = vi.hoisted(() => ({ cabecera: { value: {} }, get: vi.fn() }));

const PROYECTOS = [
  { id: 1, nombre: 'ISEIH', sociedad_emisora_id: 7, sociedad_nombre: 'CEDIA' },
  { id: 2, nombre: 'Psiko Aprende', sociedad_emisora_id: 7, sociedad_nombre: 'CEDIA' },
  { id: 5, nombre: 'Otro campus', sociedad_emisora_id: 9, sociedad_nombre: 'Otra' },
];
const config = (id, ambito, extra) => ({
  id, nombre: `Config ${id}`, activo: true, ambito, issuer_id: null, project_id: null, empresa: null, proyecto: null, ventana_min: 15,
  escenario1: { tipo: 'mailhook', cola: 'aaa' }, escenario2: { tipo: 'webhook', cola: 'bbb' }, clave_cola: 'ccc',
  created_at: '2026-10-28T10:00:00Z', updated_at: '2026-10-28T10:00:00Z', ultima_decision_at: null, fallidos_30_dias: 0, ...extra,
});
const CONFIGS = [
  config(1, 'campus', { project_id: 1, proyecto: 'ISEIH' }),
  config(2, 'campus', { project_id: 2, proyecto: 'Psiko Aprende' }),
  config(3, 'campus', { project_id: 5, proyecto: 'Otro campus' }),
  config(4, 'empresa', { issuer_id: 9, empresa: 'Otra' }),
];

vi.mock('@/contexts/ProjectContext', () => ({ useProjectContext: () => cabecera.value }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'superadmin' }, projects: PROYECTOS }) }));
vi.mock('@/shared/hooks/usePermission', () => ({ default: () => ({ can: () => true }) }));
vi.mock('@/shared/api/client', () => ({ default: { get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }, API_BASE_URL: '/crm/api' }));

import AsignacionLeadsPage, { vistaDeCabecera, configEnVista } from '@/modules/asignacion/pages/AsignacionLeadsPage';

const pedidoDeDecisiones = () => {
  const url = get.mock.calls.map((c) => c[0]).filter((u) => u.startsWith('/asignacion/decisiones')).at(-1);
  return new URLSearchParams(url.split('?')[1]);
};
const abrir = () => render(<MemoryRouter initialEntries={['/conexion/asignacion-leads']}><AsignacionLeadsPage /></MemoryRouter>);

beforeEach(() => {
  get.mockReset();
  get.mockImplementation((url) => Promise.resolve({ success: true, data: url === '/asignacion' ? CONFIGS : [] }));
});

describe('el muro deja pasar Asignación de leads', () => {
  it('se abre con una empresa y con «Todos los proyectos»', () => {
    expect(rutaAceptaSociedad('/conexion/asignacion-leads')).toBe(true);
    expect(pathAllowsAll('/conexion/asignacion-leads')).toBe(true);
  });
});

describe('lo que se ve sigue a la cabecera', () => {
  it('empresa → sus campus; campus → ese; nada → todo', () => {
    const e = vistaDeCabecera({ activeIssuerId: 7, activeIssuer: { nombre: 'CEDIA' } }, PROYECTOS);
    expect(e).toMatchObject({ tipo: 'empresa', issuerId: 7, nombre: 'CEDIA' });
    expect(e.campus.map((p) => p.id)).toEqual([1, 2]);
    expect(vistaDeCabecera({ activeProject: { id: 2 } }, PROYECTOS)).toMatchObject({ tipo: 'campus', campus: { id: 2 } });
    expect(vistaDeCabecera({ isAllProjects: true, activeProject: { id: 2 } }, PROYECTOS)).toEqual({ tipo: 'todo' });
  });

  it('una configuración entra si toca a la empresa o al campus que se ve', () => {
    const cedia = vistaDeCabecera({ activeIssuerId: 7 }, PROYECTOS);
    const otro = vistaDeCabecera({ activeProject: { id: 5 } }, PROYECTOS);
    expect(CONFIGS.filter((c) => configEnVista(c, cedia)).map((c) => c.id)).toEqual([1, 2]);
    expect(CONFIGS.filter((c) => configEnVista(c, otro)).map((c) => c.id)).toEqual([3, 4]);
    expect(configEnVista(config(9, 'todas'), cedia)).toBe(true);
  });
});

describe('la pantalla', () => {
  it('con una empresa: sus configuraciones, las decisiones de sus campus y un filtro de campus', async () => {
    cabecera.value = { activeIssuerId: 7, activeIssuer: { nombre: 'CEDIA' }, activeProject: { id: null } };
    abrir();
    expect(await screen.findByText('Config 1')).toBeTruthy();
    expect(screen.getByText('Config 2')).toBeTruthy();
    expect(screen.queryByText('Config 3')).toBeNull();
    expect(screen.queryByText('Config 4')).toBeNull();
    await waitFor(() => expect(pedidoDeDecisiones().get('issuer_id')).toBe('7'));
    expect(pedidoDeDecisiones().get('project_id')).toBeNull();
    expect(screen.getByLabelText('Campus')).toBeTruthy();
    expect(screen.getByText(/CEDIA \(2 campus\)/)).toBeTruthy();
  });

  it('con un campus: solo lo suyo y sin filtro de campus', async () => {
    cabecera.value = { activeProject: { id: 2, nombre: 'Psiko Aprende' } };
    abrir();
    expect(await screen.findByText('Config 2')).toBeTruthy();
    expect(screen.queryByText('Config 1')).toBeNull();
    await waitFor(() => expect(pedidoDeDecisiones().get('project_id')).toBe('2'));
    expect(pedidoDeDecisiones().get('issuer_id')).toBeNull();
    expect(screen.queryByLabelText('Campus')).toBeNull();
  });
});
