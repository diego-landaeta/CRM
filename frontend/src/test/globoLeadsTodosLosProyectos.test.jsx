import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * El globo de «leads nuevos» con la vista de todos los proyectos (#100, punto 2).
 *
 * El -1 NO ES UN PROYECTO: es el id con el que el CRM representa la vista
 * agregada. El menú lo metía tal cual en la URL y `/leads` contestaba 400
 * —«Number must be greater than 0»—; como el fallo se traga en un `catch {}`
 * vacío, no se veía nada: el globo se quedaba con el número del proyecto
 * anterior, que ya no describía lo que se estaba mirando.
 *
 * Salió al verificar el interruptor del punto 2 en el navegador, mirando la
 * pestaña de red. Es el cuarto sitio donde se cuela el -1; los otros tres se
 * arreglaron en c290f162.
 */

let activeProject = { id: 1, nombre: 'Psiko Aprende' };
let projects = [{ id: 1, nombre: 'Psiko Aprende' }, { id: 2, nombre: 'ISEIH' }];

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 3, nombre: 'Angel M.', email: 'angel@empresa.com', role: 'admin' },
    logout: vi.fn(),
  }),
}));
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectContext: () => ({
    activeProject, projects, setActiveProject: vi.fn(), switchProject: vi.fn(), switchIssuer: vi.fn(),
    activeIssuer: null,
  }),
}));
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

const get = vi.fn();
vi.mock('@/shared/api/client', () => ({
  default: { get: (...a) => get(...a), post: vi.fn() },
}));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));

const Sidebar = (await import('@/shared/components/layout/Sidebar')).default;

/** Las llamadas al listado de leads, que es lo que aquí importa. */
function llamadasALeads() {
  return get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/leads?'));
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ success: true, data: [], pagination: { total: 7 } });
  projects = [{ id: 1, nombre: 'Psiko Aprende' }, { id: 2, nombre: 'ISEIH' }];
});

describe('con un proyecto elegido', () => {
  it('pide los leads de ese proyecto', async () => {
    activeProject = { id: 1, nombre: 'Psiko Aprende' };
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(llamadasALeads().length).toBeGreaterThan(0));
    expect(llamadasALeads()[0]).toContain('projectId=1');
  });
});

describe('con «todos los proyectos»', () => {
  it('NO manda projectId=-1', async () => {
    activeProject = { id: -1, nombre: 'Todos los proyectos' };
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(llamadasALeads().length).toBeGreaterThan(0));
    for (const u of llamadasALeads()) expect(u).not.toContain('projectId=-1');
  });

  it('manda los proyectos de verdad, que es lo que el endpoint entiende', async () => {
    activeProject = { id: -1, nombre: 'Todos los proyectos' };
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(llamadasALeads().length).toBeGreaterThan(0));
    expect(llamadasALeads()[0]).toContain('projectIds=1,2');
  });

  it('el -1 de la lista no se cuela entre ellos', async () => {
    // El selector del menú añade su propia entrada «Todos los proyectos» a la
    // lista, y mandarla dentro de `projectIds` daría el mismo 400 por otra vía.
    activeProject = { id: -1, nombre: 'Todos los proyectos' };
    projects = [{ id: -1, nombre: 'Todos los proyectos' }, { id: 1, nombre: 'Psiko Aprende' }];
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await waitFor(() => expect(llamadasALeads().length).toBeGreaterThan(0));
    expect(llamadasALeads()[0]).toContain('projectIds=1');
    expect(llamadasALeads()[0]).not.toContain('-1');
  });

  it('sin ningún proyecto real, no pregunta nada', async () => {
    // Preguntar con la lista vacía sería `projectIds=` y otro 400.
    activeProject = { id: -1, nombre: 'Todos los proyectos' };
    projects = [{ id: -1, nombre: 'Todos los proyectos' }];
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 50));
    expect(llamadasALeads()).toEqual([]);
  });
});
