import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Los filtros de Matrículas (#40).
 *
 * Clientes ya los tenía; Matrículas llevaba dos, y en el estado del componente.
 * El ticket pide tres cosas y las tres se comprueban aquí:
 *
 *   1. el juego entero — búsqueda, gestora, producto, fechas, estado, orden;
 *   2. en la DIRECCIÓN, «como en Prospectos», para compartirlos y que
 *      sobrevivan a recargar;
 *   3. y que la exportación respete lo filtrado, NO la página visible.
 *
 * El 3 es el que se rompe sin que nadie lo note: la lista viene paginada de 50
 * y volcar lo que hay en pantalla da un CSV de 50 filas que parece completo.
 * Nadie cuenta las filas de un CSV, así que la prueba mira que se vuelva a
 * pedir al servidor con los mismos filtros y un límite alto.
 */

const get = vi.fn();
vi.mock('@/shared/api/client', () => ({ default: { get: (...a) => get(...a), post: vi.fn() } }));

vi.mock('@/contexts/ProjectContext', () => ({
  useProjectContext: () => ({ activeProject: { id: 1, nombre: 'Psiko Aprende' } }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 9, role: 'admin' } }),
}));
vi.mock('@/shared/hooks/usePermission', () => ({ default: () => ({ can: () => true }) }));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));
vi.mock('../modules/matriculas/components/WebhooksTab', () => ({ default: () => null }));

const MatriculasPage = (await import('@/modules/matriculas/pages/MatriculasPage')).default;

/** Una matrícula cualquiera; lo que importa es cuántas y con qué se piden. */
const fila = (id) => ({
  id, lead_nombre: `Lead ${id}`, lead_email: `l${id}@x.com`, lead_telefono: '600',
  dni: `0000000${id}`, estado: 'validada', producto_contratado: 'Máster',
  importe_total: 100, responsable_nombre: 'Laura', created_at: '2026-09-10T00:00:00Z',
});

function respuesta(n) {
  return {
    success: true,
    data: Array.from({ length: n }, (_, i) => fila(i + 1)),
    pagination: { total: n, page: 1, limit: 50, totalPages: 1 },
    stats: { total: n, pendientes: 0, validadas: n, rechazadas: 0 },
  };
}

/** Las llamadas al listado, ignorando las del catálogo y las gestoras. */
const llamadasAlListado = () =>
  get.mock.calls.map(c => c[0]).filter(u => String(u).startsWith('/matriculas?'));

beforeEach(() => {
  get.mockReset();
  get.mockImplementation((url) => {
    if (String(url).startsWith('/users')) {
      return Promise.resolve({ success: true, data: [{ id: 4, nombre: 'Laura Garcia', active: true }] });
    }
    if (String(url).startsWith('/products')) {
      return Promise.resolve({ success: true, data: [{ id: 7, nombre: 'Máster en Terapia' }] });
    }
    return Promise.resolve(respuesta(3));
  });
});

const pintar = (ruta = '/clientes/matriculas') =>
  render(<MemoryRouter initialEntries={[ruta]}><MatriculasPage /></MemoryRouter>);

describe('el juego entero de filtros', () => {
  it('están los seis en pantalla', async () => {
    pintar();
    expect(await screen.findByLabelText('Buscar matrículas')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filtrar por estado' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ordenar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Matrículas desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Matrículas hasta')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Filtrar por gestora' })).toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Filtrar por producto' })).toBeInTheDocument();
  });
});

describe('los filtros vienen de la dirección', () => {
  it('una URL con filtros se los pide al servidor', async () => {
    pintar('/clientes/matriculas?resp=4&estado=validada&sort=nombre&from=2026-09-01');
    await waitFor(() => expect(llamadasAlListado().length).toBeGreaterThan(0));
    const url = llamadasAlListado()[0];
    expect(url).toContain('responsableId=4');
    expect(url).toContain('estado=validada');
    expect(url).toContain('sort=nombre');
    expect(url).toContain('from=2026-09-01');
  });

  it('y quedan puestos en los desplegables, no solo en la petición', async () => {
    // Si se pidieran al servidor pero la barra saliera vacía, el enlace
    // compartido enseñaría datos filtrados con los filtros en blanco: quien lo
    // abre no sabe qué está mirando.
    pintar('/clientes/matriculas?estado=validada&sort=nombre');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Filtrar por estado' })).toHaveTextContent('Validadas'));
    expect(screen.getByRole('combobox', { name: 'Ordenar' })).toHaveTextContent('Por nombre');
  });

  it('sin filtros la dirección no se ensucia', async () => {
    pintar();
    await waitFor(() => expect(llamadasAlListado().length).toBeGreaterThan(0));
    const url = llamadasAlListado()[0];
    expect(url).not.toContain('estado=');
    expect(url).not.toContain('responsableId=');
  });
});

describe('la exportación', () => {
  it('vuelve a pedir lo filtrado con límite alto, no vuelca la página', async () => {
    pintar('/clientes/matriculas?estado=validada&resp=4');
    await waitFor(() => expect(screen.getByText('CSV')).toBeInTheDocument());

    // jsdom no descarga; lo que se comprueba es la petición que se hace antes.
    const antes = llamadasAlListado().length;
    global.URL.createObjectURL = vi.fn(() => 'blob:x');
    global.URL.revokeObjectURL = vi.fn();
    fireEvent.click(screen.getByText('CSV'));

    await waitFor(() => expect(llamadasAlListado().length).toBe(antes + 1));
    const url = llamadasAlListado().at(-1);
    expect(url).toContain('limit=5000');
    // Y con LOS MISMOS filtros: exportar el proyecto entero desde una pantalla
    // filtrada es peor que no exportar, porque el fichero parece el correcto.
    expect(url).toContain('estado=validada');
    expect(url).toContain('responsableId=4');
  });
});
