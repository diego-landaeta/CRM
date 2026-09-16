import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Las metas del equipo de ventas, cuando no hay ninguna (#100, punto 5).
 *
 * El ticket: «los seis gestores salen "sin meta" y a 0,00 €. Si no se van a
 * usar, el bloque ocupa media pantalla para no decir nada».
 *
 * Lo que se fija aquí es LAS DOS MITADES, porque esconder es fácil y esconder
 * de más es el fallo probable:
 *
 *   - con cero metas puestas, ni cabeceras «/ Meta» ni el «sin meta» repetido
 *     en cada fila;
 *   - EN CUANTO ALGUIEN PONE UNA, vuelven. Si solo se probara lo primero, una
 *     condición mal escrita —esconderlas siempre— pasaría la prueba y habría
 *     retirado una función en vez de quitar ruido.
 *
 * Lo vendido y lo cobrado salen en los dos casos: es lo que la tabla tiene que
 * decir, con metas o sin ellas.
 */

const get = vi.fn();
vi.mock('@/shared/api/client', () => ({
  default: { get: (...a) => get(...a), post: vi.fn() },
}));
vi.mock('@/shared/hooks/useToast', () => ({ toast: vi.fn() }));

const GestoresStatsTable = (await import('@/modules/sales/components/GestoresStatsTable')).default;

/** Una gestora sin meta, que es como están hoy los seis. */
function gestor(id, nombre, extra = {}) {
  return {
    user_id: id,
    nombre,
    email: `${nombre.toLowerCase()}@psikoaprende.com`,
    role: 'gestor',
    is_available: true,
    ventas: 3,
    facturado: 1500,
    cobrado: 900,
    meta_ventas: null,
    meta_facturacion: null,
    progreso_ventas_pct: null,
    progreso_facturacion_pct: null,
    ...extra,
  };
}

function responde(gestores) {
  get.mockResolvedValue({ success: true, data: { gestores } });
}

beforeEach(() => {
  get.mockReset();
});

describe('cuando nadie tiene meta', () => {
  beforeEach(() => {
    responde([gestor(4, 'Laura'), gestor(5, 'Carlos'), gestor(6, 'Marta')]);
  });

  it('las cabeceras no hablan de metas', async () => {
    render(<GestoresStatsTable periodo="2026-09" />);
    expect(await screen.findByRole('columnheader', { name: 'Ventas' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Facturado' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: /Meta/ })).toBeNull();
  });

  it('no sale «sin meta» ni una sola vez', async () => {
    const { container } = render(<GestoresStatsTable periodo="2026-09" />);
    await screen.findByText('Laura');
    expect(container.textContent.match(/sin meta/g)).toBeNull();
  });

  it('lo vendido y lo cobrado siguen saliendo', async () => {
    const { container } = render(<GestoresStatsTable periodo="2026-09" />);
    await screen.findByText('Laura');
    // Sin punto de millar a proposito: en es-ES los numeros de cuatro digitos
    // no lo llevan («1500,00 €»), y el de cinco si («10.000,00 €»).
    expect(container.textContent).toContain('1500,00');
    expect(container.textContent).toContain('900,00');
  });
});

describe('en cuanto alguien pone una', () => {
  beforeEach(() => {
    responde([
      gestor(4, 'Laura', { meta_ventas: 5, meta_facturacion: 10000, progreso_ventas_pct: 60, progreso_facturacion_pct: 15 }),
      gestor(5, 'Carlos'),
      gestor(6, 'Marta'),
    ]);
  });

  it('vuelven las cabeceras «/ Meta»', async () => {
    render(<GestoresStatsTable periodo="2026-09" />);
    expect(await screen.findByRole('columnheader', { name: 'Ventas / Meta' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Facturado / Meta' })).toBeTruthy();
  });

  it('la meta puesta se ve, y los que no la tienen se marcan', async () => {
    const { container } = render(<GestoresStatsTable periodo="2026-09" />);
    await screen.findByText('Laura');
    expect(container.textContent).toContain('/ 5');
    expect(container.textContent).toContain('meta 10.000,00');
    // Los otros dos: ahí «sin meta» sí informa, porque hay con qué comparar.
    expect(container.textContent.match(/sin meta/g)).toHaveLength(2);
  });
});

describe('una lista vacía', () => {
  it('no enseña la tabla, y no revienta al mirar si hay metas', async () => {
    // `every()` sobre [] devuelve true: sin el `rows.length > 0` el estado
    // «sin gestores» se leeria como «nadie tiene meta».
    responde([]);
    render(<GestoresStatsTable periodo="2026-09" />);
    expect(await screen.findByText('No hay gestores activos.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
  });
});
