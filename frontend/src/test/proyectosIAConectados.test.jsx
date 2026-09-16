import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * La lista de proyectos IA en Integraciones.
 *
 * Es la herramienta para la tarea que hay: conectar Psicólogo IA, Nutricionista
 * IA y Tarot IA con su access token. La pantalla configura el proyecto ACTIVO,
 * así que sin esta lista hay que ir al selector del menú, entrar en cada uno y
 * mirar, y no hay forma de saber si falta alguno.
 *
 * Lo que se fija aquí es lo que hace que la lista sirva de algo:
 *
 *   - UN TOKEN GUARDADO NO ES UN PROYECTO CONECTADO. Solo cuenta si la prueba
 *     de conexión salió bien. Si el contador dijera «conectado» con solo tener
 *     texto guardado, daría por hecha una conexión que no existe — se probó con
 *     un token falso y Stripe contestó 401.
 *   - EL BOTÓN NO PROMETE LO QUE NO PUEDE. El proyecto activo solo puede ser
 *     uno de los asignados al usuario, y `switchProject` descarta el resto en
 *     silencio. Los tres IA no están asignados a nadie hoy: sin esto se pulsaba
 *     y no pasaba nada.
 *   - QUE NO SE PINTE EL TOKEN ENTERO, solo lo enmascarado que manda el
 *     servidor.
 */

const get = vi.fn();
vi.mock('@/shared/api/client', () => ({ default: { get: (...a) => get(...a) } }));

const switchProject = vi.fn();
let mios = [{ id: 1 }, { id: 2 }];
let activo = { id: 2 };
vi.mock('@/contexts/ProjectContext', () => ({
  useProjectContext: () => ({ activeProject: activo, switchProject, projects: mios }),
}));

const ProyectosIAConectados = (await import('@/modules/accounting/components/ProyectosIAConectados')).default;

const PROYECTOS = [
  { id: 1, nombre: 'Psiko Aprende', type: 'crm', sociedad_emisora_id: 1 },
  { id: 4, nombre: 'Psicologo IA', type: 'ia', sociedad_emisora_id: null },
  { id: 5, nombre: 'Nutricionista IA', type: 'ia', sociedad_emisora_id: 3, sociedad_nombre: 'IA Labs SL' },
];

/** Estado de Stripe por proyecto; lo que no se diga, sin configurar. */
function conEstados(porId = {}) {
  get.mockImplementation((url) => {
    if (url === '/projects') return Promise.resolve({ success: true, data: PROYECTOS });
    const m = String(url).match(/projectId=(\d+)/);
    const id = m ? Number(m[1]) : 0;
    return Promise.resolve({
      success: true,
      data: porId[id] || { has_secret: false, secret_preview: null, last_test_status: null, last_test_at: null },
    });
  });
}

beforeEach(() => {
  get.mockReset(); switchProject.mockReset();
  mios = [{ id: 1 }, { id: 2 }];
  activo = { id: 2 };
  conEstados();
});

describe('qué se lista', () => {
  it('solo los proyectos IA', async () => {
    const { container } = render(<ProyectosIAConectados />);
    await screen.findByText('Psicologo IA');
    expect(screen.getByText('Nutricionista IA')).toBeTruthy();
    // El CRM de siempre no pinta nada aquí.
    expect(container.textContent).not.toContain('Psiko Aprende');
  });

  it('sin proyectos IA, la caja no existe', async () => {
    get.mockImplementation((url) => (url === '/projects'
      ? Promise.resolve({ success: true, data: [PROYECTOS[0]] })
      : Promise.resolve({ success: true, data: null })));
    const { container } = render(<ProyectosIAConectados />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});

describe('el recuento de conectados', () => {
  it('un token guardado que NO pasó la prueba no cuenta', async () => {
    // Es el caso real: se guardó un token falso, Stripe contestó 401. Tener
    // texto guardado no es estar conectado.
    conEstados({ 4: { has_secret: true, secret_preview: 'rk_t...0000', last_test_status: 'error' } });
    render(<ProyectosIAConectados />);
    expect(await screen.findByText(/0 de 2 probados con éxito/)).toBeTruthy();
    expect(screen.getByText(/la última prueba falló/)).toBeTruthy();
  });

  it('sin probar tampoco cuenta', async () => {
    conEstados({ 4: { has_secret: true, secret_preview: 'rk_t...0000', last_test_status: null } });
    render(<ProyectosIAConectados />);
    expect(await screen.findByText(/0 de 2 probados con éxito/)).toBeTruthy();
    expect(screen.getByText(/sin probar/)).toBeTruthy();
  });

  it('con la prueba en verde, sí', async () => {
    conEstados({ 4: { has_secret: true, secret_preview: 'rk_t...0000', last_test_status: 'success' } });
    render(<ProyectosIAConectados />);
    expect(await screen.findByText(/1 de 2 probados con éxito/)).toBeTruthy();
  });
});

describe('el botón de configurar', () => {
  it('no se ofrece si el proyecto no está asignado al usuario', async () => {
    // `switchProject` descartaría el id en silencio y no pasaría nada.
    mios = [{ id: 1 }, { id: 2 }];
    render(<ProyectosIAConectados />);
    await screen.findByText('Psicologo IA');
    expect(screen.queryByRole('button', { name: /Configurar/ })).toBeNull();
    expect(screen.getAllByText(/No está asignado a tu usuario/).length).toBe(2);
  });

  it('y sí cuando lo está, cambiando el proyecto activo', async () => {
    mios = [{ id: 1 }, { id: 2 }, { id: 4 }];
    render(<ProyectosIAConectados />);
    await screen.findByText('Psicologo IA');
    const botones = screen.getAllByRole('button', { name: /Configurar/ });
    expect(botones).toHaveLength(1);
    botones[0].click();
    expect(switchProject).toHaveBeenCalledWith(4);
  });

  it('el que ya se está configurando no ofrece botón', async () => {
    mios = [{ id: 1 }, { id: 2 }, { id: 4 }];
    activo = { id: 4 };
    render(<ProyectosIAConectados />);
    expect(await screen.findByText(/Lo estás configurando abajo/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Configurar/ })).toBeNull();
  });
});

describe('lo que falta del proyecto', () => {
  it('se avisa de la sociedad emisora que falta, y no de la que hay', async () => {
    const { container } = render(<ProyectosIAConectados />);
    await screen.findByText('Psicologo IA');
    expect(screen.getAllByText(/Sin sociedad emisora/).length).toBe(1);
    expect(container.textContent).toContain('IA Labs SL');
  });
});
