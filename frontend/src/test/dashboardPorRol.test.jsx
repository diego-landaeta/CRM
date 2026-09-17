import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Los tres dashboards por rol (#130, parte 1).
 *
 * Lo que se comprueba aqui es lo que NO se ve leyendo el codigo:
 *
 *   - que una gestora no reciba el desplegable. No es seguridad —el recorte lo
 *     hace el servidor— pero ofrecerle un filtro que no puede usar es prometer
 *     algo que no pasa.
 *   - que al elegir una gestora se le pida a los CUATRO sitios, no a tres. El
 *     fallo natural aqui es que un bloque se quede con los numeros del equipo
 *     al lado de los de una sola, y nadie lo note.
 *   - que el enlace a la cola se lleve la gestora. Si no, se pulsa «Para hoy»
 *     de Laura y se abre la cola del equipo entero — el mismo defecto que el
 *     #132 dio por inutil con los tramos.
 */

const get = vi.fn();
vi.mock('@/shared/api/client', () => ({ default: { get: (...a) => get(...a) } }));

let rol = 'admin';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7, role: rol } }) }));

const traerResumen = vi.fn();
vi.mock('@/modules/proceso/api/agenda.api', () => ({ traerResumen: (...a) => traerResumen(...a) }));

const getResumenDelDia = vi.fn();
vi.mock('@/modules/reports/api/resumenDelDia.api', () => ({
  getResumenDelDia: (...a) => getResumenDelDia(...a),
}));

const contarSinLeer = vi.fn();
vi.mock('@/modules/notificaciones/api/avisos.api', () => ({
  contarSinLeer: (...a) => contarSinLeer(...a),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const { useGestoras } = await import('@/shared/hooks/useGestoras');
const SelectorDeGestora = (await import('@/shared/components/ui/SelectorDeGestora')).default;
const ParaHoyYManana = (await import('@/shared/components/dashboard/ParaHoyYManana')).default;
const { gestoraDeLaDireccion } = await import('@/modules/proceso/lib/cola');
const ResumenDeAyerYHoy = (await import('@/shared/components/dashboard/ResumenDeAyerYHoy')).default;

beforeEach(() => {
  rol = 'admin';
  get.mockReset(); traerResumen.mockReset(); getResumenDelDia.mockReset(); navigate.mockReset();
  get.mockResolvedValue({ success: true, data: [
    { id: 12, nombre: 'Laura', active: true },
    { id: 13, nombre: 'Ana', active: true },
    { id: 14, nombre: 'Baja', active: false },
  ] });
  traerResumen.mockResolvedValue({ atrasados: 0, hoy: 6, manana: 0, esta_semana: 0 });
  contarSinLeer.mockReset();
  contarSinLeer.mockResolvedValue({ accion: 0, aviso: 0 });
  getResumenDelDia.mockResolvedValue([
    { dia: 'ayer', leads: 1, contactados: 1, ventas: 0, sin_tocar: 0 },
    { dia: 'hoy', leads: 2, contactados: 1, ventas: 1, sin_tocar: 0 },
  ]);
});

/** Un componente minimo que solo ejerce el hook. */
function Sonda({ projectId }) {
  const { gestoras, puedeFiltrar } = useGestoras(projectId);
  return (
    <div>
      <span data-testid="puede">{String(puedeFiltrar)}</span>
      <span data-testid="cuantas">{gestoras.length}</span>
    </div>
  );
}

describe('quien puede filtrar', () => {
  it('una gestora no recibe la lista ni el permiso', async () => {
    rol = 'gestor';
    render(<Sonda projectId={1} />);
    await waitFor(() => expect(screen.getByTestId('puede')).toHaveTextContent('false'));
    expect(screen.getByTestId('cuantas')).toHaveTextContent('0');
    // Y no se le pregunta al servidor: pedir una lista que no se va a usar es
    // una llamada por dashboard abierto, todos los dias.
    expect(get).not.toHaveBeenCalled();
  });

  it('un admin la recibe, y sin la gente dada de baja', async () => {
    render(<Sonda projectId={1} />);
    await waitFor(() => expect(screen.getByTestId('cuantas')).toHaveTextContent('2'));
    expect(get).toHaveBeenCalledWith('/users?limit=100&projectId=1');
  });

  it('un superadmin tambien', async () => {
    rol = 'superadmin';
    render(<Sonda projectId={null} />);
    await waitFor(() => expect(screen.getByTestId('puede')).toHaveTextContent('true'));
    // Sin proyecto no se cuelga el parametro: «todos» ya es el ambito.
    expect(get).toHaveBeenCalledWith('/users?limit=100');
  });
});

describe('el desplegable', () => {
  // OJO AL ESCRIBIR ESTAS: la primitiva `Select` del rediseño NO pinta un
  // <select>, pinta un <button role="combobox">. Las dos primeras versiones de
  // estas pruebas buscaban `container.querySelector('select')` y pasaban EN
  // VERDE sin comprobar nada —el elemento no existe ni cuando el componente se
  // pinta bien—. Por eso ahora se busca por su papel, que es lo que ve quien
  // usa el CRM y lo que lee un lector de pantalla.
  it('con la lista vacia no se pinta NADA', () => {
    const { container } = render(
      <SelectorDeGestora valor={null} alCambiar={() => {}} gestoras={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('con gestoras si se pinta', () => {
    render(<SelectorDeGestora valor={null} alCambiar={() => {}} gestoras={[{ id: 12, nombre: 'Laura' }]} />);
    expect(screen.getByRole('combobox', { name: 'Filtrar por gestora' })).toBeInTheDocument();
  });

  it('arranca en «Todo el equipo»', () => {
    render(<SelectorDeGestora valor={null} alCambiar={() => {}} gestoras={[{ id: 12, nombre: 'Laura' }]} />);
    expect(screen.getByRole('combobox', { name: 'Filtrar por gestora' }))
      .toHaveTextContent('Todo el equipo');
  });

  it('con una elegida, enseña su nombre', () => {
    render(<SelectorDeGestora valor={12} alCambiar={() => {}} gestoras={[{ id: 12, nombre: 'Laura' }]} />);
    expect(screen.getByRole('combobox', { name: 'Filtrar por gestora' })).toHaveTextContent('Laura');
  });

  it('al elegir devuelve el id como numero, y null para «todo el equipo»', async () => {
    const elegido = vi.fn();
    render(<SelectorDeGestora valor={null} alCambiar={elegido} gestoras={[{ id: 12, nombre: 'Laura' }]} />);
    // `mouseDown`, no `click`: la primitiva elige en `onMouseDown` para que la
    // opcion se marque antes de que el boton pierda el foco y cierre la lista.
    // Con `click` la prueba pasa por delante sin elegir nada.
    fireEvent.click(screen.getByRole('combobox', { name: 'Filtrar por gestora' }));
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Laura' }));
    // Numero, no cadena: `useDashboard` lo pega a la URL y el backend hace
    // parseInt, pero `gestoras.find(g => g.id === gestoraId)` compara con ===
    // y un '12' dejaria el subtitulo sin nombre sin romper nada mas.
    expect(elegido).toHaveBeenCalledWith(12);

    elegido.mockClear();
    fireEvent.click(screen.getByRole('combobox', { name: 'Filtrar por gestora' }));
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Todo el equipo' }));
    expect(elegido).toHaveBeenCalledWith(null);
  });
});

describe('la gestora elegida llega a los bloques', () => {
  it('«Lo que toca» se la pide a la cola', async () => {
    render(<ParaHoyYManana projectId={1} gestoraId={12} />);
    // `objectContaining` y no el objeto entero: lo que esta prueba defiende es
    // que LA GESTORA LLEGA, no la forma exacta de la llamada. Con la
    // comparación estricta, el día que alguien añadió `projectIds` para las
    // empresas esto se puso rojo sin que nada estuviera mal.
    await waitFor(() => expect(traerResumen).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 1, gestoraId: 12 })));
  });

  it('«Ayer y hoy» se la pide a los informes', async () => {
    render(<ResumenDeAyerYHoy projectIds={[1, 2]} asesoraId={12} />);
    await waitFor(() => expect(getResumenDelDia).toHaveBeenCalledWith([1, 2], 12));
  });

  it('sin gestora elegida se piden los del equipo, no los de nadie', async () => {
    render(<ParaHoyYManana projectId={1} />);
    await waitFor(() => expect(traerResumen).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 1, gestoraId: null })));
  });
});

describe('el enlace a la cola', () => {
  it('se lleva la gestora, no solo el tramo', async () => {
    render(<ParaHoyYManana projectId={1} gestoraId={12} />);
    (await screen.findByLabelText(/Para hoy: 6/)).click();
    expect(navigate).toHaveBeenCalledWith('/prospectos/cola?tramo=hoy&gestora=12');
  });

  it('sin gestora, la direccion queda limpia', async () => {
    render(<ParaHoyYManana projectId={1} />);
    (await screen.findByLabelText(/Para hoy: 6/)).click();
    expect(navigate).toHaveBeenCalledWith('/prospectos/cola?tramo=hoy');
  });
});

describe('el viaje de vuelta: la cola lee lo que el dashboard escribe', () => {
  it('lee la gestora de la direccion', () => {
    expect(gestoraDeLaDireccion(new URLSearchParams('tramo=hoy&gestora=12'), true)).toBe(12);
  });

  it('sin el parametro es «todo el equipo»', () => {
    expect(gestoraDeLaDireccion(new URLSearchParams('tramo=hoy'), true)).toBeNull();
  });

  it('a quien no puede filtrar no le vale escribirlo a mano', () => {
    expect(gestoraDeLaDireccion(new URLSearchParams('gestora=12'), false)).toBeNull();
  });

  it('una basura no se cuela como id', () => {
    expect(gestoraDeLaDireccion(new URLSearchParams('gestora=pepe'), true)).toBeNull();
  });

  it('las dos pantallas usan el MISMO nombre de parametro', async () => {
    // Es lo unico que no se ve fallar: si el enlace escribe `gestora` y la cola
    // lee `asesora`, el enlace sigue abriendo la cola —del equipo entero— sin
    // error y sin aviso. Por eso el nombre vive en una constante y no en dos
    // cadenas sueltas, y por eso esto se comprueba.
    render(<ParaHoyYManana projectId={1} gestoraId={12} />);
    (await screen.findByLabelText(/Para hoy: 6/)).click();
    const url = navigate.mock.calls[0][0];
    const params = new URLSearchParams(url.split('?')[1]);
    expect(gestoraDeLaDireccion(params, true)).toBe(12);
  });
});


describe('los avisos de la campana, en «lo que toca» (#130 punto 2)', () => {
  it('salen cuando hay alguno que pide algo', async () => {
    contarSinLeer.mockResolvedValue({ accion: 3, aviso: 12 });
    render(<ParaHoyYManana projectId={1} />);
    expect(await screen.findByText(/avisos te esperan/)).toBeInTheDocument();
    // Solo los de ACCION. Los 12 de «aviso» cuentan lo que ha pasado, y este
    // bloque es lo que hay que HACER: meterlos aqui lo llenaria de ruido.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('12')).toBeNull();
  });

  it('en singular cuando es uno', async () => {
    contarSinLeer.mockResolvedValue({ accion: 1, aviso: 0 });
    render(<ParaHoyYManana projectId={1} />);
    expect(await screen.findByText(/aviso te espera$/)).toBeInTheDocument();
  });

  it('sin avisos no se pinta la fila', async () => {
    render(<ParaHoyYManana projectId={1} />);
    await screen.findByLabelText(/Para hoy: 6/);
    expect(screen.queryByText(/te esperan?$/)).toBeNull();
  });

  it('NO se suman a los tramos: son cuentas distintas', async () => {
    // La cola son los pasos del proceso; la campana son fichas asignadas, sin
    // tocar y recordatorios. Sumarlas seria una segunda contabilidad.
    contarSinLeer.mockResolvedValue({ accion: 3, aviso: 0 });
    render(<ParaHoyYManana projectId={1} />);
    // «Para hoy» sigue diciendo 6, no 9.
    expect(await screen.findByLabelText(/Para hoy: 6/)).toBeInTheDocument();
  });

  it('con la cola a cero pero avisos pendientes, el bloque SI se pinta', async () => {
    // Antes bastaba con que los cuatro tramos fueran cero para esconderlo. Con
    // avisos por atender, esconderlo seria perderlos.
    traerResumen.mockResolvedValue({ atrasados: 0, hoy: 0, manana: 0, esta_semana: 0 });
    contarSinLeer.mockResolvedValue({ accion: 2, aviso: 0 });
    render(<ParaHoyYManana projectId={1} />);
    expect(await screen.findByText(/avisos te esperan/)).toBeInTheDocument();
  });

  it('si la campana falla, el bloque sigue pintando la cola', async () => {
    contarSinLeer.mockRejectedValue(new Error('caida'));
    render(<ParaHoyYManana projectId={1} />);
    expect(await screen.findByLabelText(/Para hoy: 6/)).toBeInTheDocument();
  });
});

describe('el cable entre el dashboard y los bloques', () => {
  /*
    ESTO SE LEE DEL FUENTE, A PROPÓSITO.

    Las pruebas de arriba montan `ParaHoyYManana` sola y comprueban que, si le
    llega `gestoraId`, se lo pide a la cola. Eso está bien y no basta: nadie
    comprobaba que EL DASHBOARD SE LO PASE. Renderizar el dashboard entero pide
    media docena de mocks de bloques que no pintan nada aquí.

    El fallo que esto caza es concreto y ya ha estado a punto de pasar: al
    traer el tronco, la línea del dashboard chocó —el tronco le añadía
    `projectIds` para las empresas y la nuestra `gestoraId` para el #130— y
    quedarse con una de las dos versiones tal cual habría dejado el filtro de
    gestora desconectado. La pantalla seguiría pintando el desplegable, se
    podría elegir a Laura, y «Lo que toca» seguiría enseñando los del equipo.
    Sin error, sin test rojo, y con dos cifras que se contradicen al lado.
  */
  // Ruta desde la raíz del frontal: en Vite `import.meta.url` no es un
  // `file://` y `readFileSync` no lo acepta. Vitest corre con el cwd ahí.
  const fuente = readFileSync(
    resolve(process.cwd(), 'src/shared/pages/DashboardPage.jsx'), 'utf8');

  it('el dashboard le pasa la gestora a «Lo que toca»', () => {
    const linea = fuente.match(/<ParaHoyYManana[^/]*\/>/s);
    expect(linea, 'no se encontró <ParaHoyYManana> en DashboardPage').toBeTruthy();
    expect(linea[0]).toMatch(/gestoraId=\{gestoraId\}/);
  });

  it('y también el proyecto y los campus de la empresa', () => {
    // Los tres van juntos: el bloque necesita saber de quién, de qué proyecto
    // y, con una empresa puesta, de qué campus.
    const linea = fuente.match(/<ParaHoyYManana[^/]*\/>/s)[0];
    expect(linea).toMatch(/projectId=/);
    expect(linea).toMatch(/projectIds=/);
  });

  it('y le pasa la asesora al resumen de ayer y hoy', () => {
    const linea = fuente.match(/<ResumenDeAyerYHoy[^/]*\/>/s);
    expect(linea, 'no se encontró <ResumenDeAyerYHoy> en DashboardPage').toBeTruthy();
    expect(linea[0]).toMatch(/asesoraId=/);
  });
});
