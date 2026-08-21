import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Que las piezas nuevas de WhatsApp PINTEN sin reventar.
//
// No comprueban logica —eso ya tiene sus ficheros— sino que se monten. Hace
// falta porque el aviso de llamada vive en `AppLayout`, o sea en todas las
// pantallas del CRM, y el unico ErrorBoundary esta en la raiz: si ese
// componente lanza al pintar, no se rompe WhatsApp, se rompe el CRM entero.
//
// Lo mismo con el recorrido y la guia: se escribieron enteros sin que nadie los
// viera pintados ni una vez.
//
// OJO al escribir aqui: el aviso deja un temporizador en marcha a proposito
// —consulta cada pocos segundos—, asi que envolver su render en `act()` espera
// a que no quede trabajo pendiente y agota el tiempo del test. Se renderiza
// suelto y se espera con `waitFor`.

const get = vi.fn();
vi.mock('@/shared/api/client', () => ({
  default: { get: (...a) => get(...a), post: vi.fn() },
}));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));

// Arriba y no dentro de cada test: la primera carga de @phosphor-icons/react
// tarda varios segundos en jsdom y se comia el plazo del primer test, que caia
// por tiempo sin que el componente tuviera nada que ver.
import Aviso from '@/shared/components/layout/AvisoDeLlamada';
import Tour, { hayQueSeñalar } from '@/modules/whatsapp/components/Tour';
import Ayuda from '@/modules/whatsapp/pages/AyudaPage';

const envolver = (nodo) => render(<MemoryRouter>{nodo}</MemoryRouter>);
const sonando = (extra = {}) => ({
  id: 'R1', telefono: '+34600123456', nombre: 'Marta Ruiz',
  conversacionId: 4, esVideo: false, esGrupo: false, segundos: 7, ...extra,
});

describe('AvisoDeLlamada · el cartel de llamada entrante', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ success: true, data: { sonando: null, enlazada: false } });
  });

  it('se monta sin romper nada cuando no hay llamada', async () => {
    const { container } = envolver(<Aviso />);
    // Sin llamada no pinta nada, que es lo correcto: no puede molestar.
    //
    // No se espera a la consulta: el componente deja un temporizador vivo a
    // proposito y esperarlo agota el tiempo del test. Lo que se comprueba aqui
    // es que MONTAR no revienta, que es lo que tumbaria el CRM entero.
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('pinta el cartel, y lo primero que dice es que se coge en el movil', async () => {
    get.mockResolvedValue({ success: true, data: { enlazada: true, sonando: sonando() } });
    envolver(<Aviso />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Marta Ruiz')).toBeTruthy();
    expect(screen.getByText(/Cógela en tu móvil/i)).toBeTruthy();
    expect(screen.getByText(/sonando 7s/)).toBeTruthy();
    // Y no promete un boton de contestar, que no existe.
    expect(screen.queryByText(/contestar|descolgar/i)).toBeNull();
  });

  it('sin nombre enseña el telefono con UN solo +', async () => {
    // Se guarda ya normalizado con prefijo: ponerselo a ciegas daba «++34…».
    get.mockResolvedValue({ success: true, data: { enlazada: true, sonando: sonando({ nombre: null }) } });
    envolver(<Aviso />);
    await waitFor(() => expect(screen.getByText('+34600123456')).toBeTruthy());
    expect(screen.queryByText('++34600123456')).toBeNull();
  });

  it('una videollamada se distingue', async () => {
    get.mockResolvedValue({ success: true, data: { enlazada: true, sonando: sonando({ esVideo: true }) } });
    envolver(<Aviso />);
    await waitFor(() => expect(screen.getByText(/Videollamada de WhatsApp/)).toBeTruthy());
  });
});

describe('Tour · el recorrido guiado', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* da igual */ } });

  it('se monta y enseña el primer paso', async () => {
    envolver(<Tour />);
    expect(screen.getByText('Esto es tu WhatsApp')).toBeTruthy();
    // El numero de pasos se calcula: escrito a mano se queda viejo en cuanto se
    // añade uno, que es exactamente lo que paso con las llamadas.
    expect(screen.getByText(/En 9 pasos te enseño por dónde va cada cosa/)).toBeTruthy();
    expect(screen.getByText('1 de 9')).toBeTruthy();
  });

  it('en el primer paso no hay «Atras», y el ultimo cierra', async () => {
    envolver(<Tour />);
    expect(screen.queryByText(/Atrás/)).toBeNull();
    expect(screen.getByText(/Siguiente/)).toBeTruthy();
  });

  it('hayQueSeñalar dice que no cuando no hay nada en pantalla', async () => {
    // Sin la pantalla del chat montada, ningun paso encuentra su objetivo: el
    // recorrido serian nueve carteles sueltos, asi que no se abre.
    expect(hayQueSeñalar()).toBe(false);
  });
});

describe('La guia, dentro del CRM', () => {
  it('se monta entera, con el bloque de llamadas y el camino del movil', async () => {
    envolver(<Ayuda />);
    expect(screen.getByText(/5 · Llamadas/)).toBeTruthy();
    expect(screen.getByText(/7 · Quien ve tus conversaciones/)).toBeTruthy();
    // El camino en el movil: las tres pantallas por las que hay que pasar.
    // Salen dos veces cada uno a proposito: en el texto del paso y en el dibujo
    // de las pantallas del movil.
    expect(screen.getAllByText('Dispositivos vinculados').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vincular un dispositivo').length).toBeGreaterThan(0);
  });

  it('empieza diciendo lo que NO se puede con las llamadas', async () => {
    envolver(<Ayuda />);
    expect(screen.getByText(/se hacen y se cogen desde tu móvil/i)).toBeTruthy();
  });
});

describe('la red del aviso', () => {
  it('si el cartel se rompe, DESAPARECE en vez de tumbar el CRM', async () => {
    // Esto vive en AppLayout: en todas las pantallas y para todos los usuarios.
    // El unico ErrorBoundary que hay esta en la raiz y pinta una pagina de error
    // a pantalla completa, asi que un dato raro del servidor dejaria a la
    // gestora sin CRM, no sin aviso.
    const laConsola = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Un dato imposible: `telefono` como objeto revienta al pintar.
    get.mockResolvedValue({
      success: true,
      data: { enlazada: true, sonando: { ...sonando(), nombre: { roto: true } } },
    });
    const { container } = envolver(<Aviso />);
    await waitFor(() => expect(container.querySelector('[role="alert"]')).toBeNull());
    // Lo importante: no ha lanzado hacia arriba. El CRM sigue en pie.
    expect(container).toBeTruthy();
    laConsola.mockRestore();
  });
});
