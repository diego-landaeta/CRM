import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La IA no ejecuta lo que se le ocurra contra la base (#30, primera subfase).
 *
 * El ticket lo pone primero a proposito: «capa de solo lectura, consultas
 * preparadas y tiempo maximo» antes que las preguntas en lenguaje natural.
 *
 * La tentacion evidente es dejar que el modelo escriba el SQL y ejecutarlo con
 * un usuario de solo lectura. Esto fija por que NO:
 *
 *  · Solo lectura no protege de un SELECT que cruce seis tablas sin indice y
 *    tenga la base ocupada un minuto. Leer tambien tumba.
 *  · Y los numeros ya estan cuadrados en `report.model.js` — el reporte semanal
 *    se hizo sin escribir ni una consulta nueva por eso mismo. Una consulta
 *    inventada daria OTRO numero que el de la pantalla, y entonces uno de los
 *    dos miente sin que nadie sepa cual.
 */

const reportes = {
  overview: vi.fn(async () => ({ leads: 10 })),
  resumenMensual: vi.fn(async () => ([{ mes: '2026-07' }])),
  ventasPorAsesoraReport: vi.fn(async () => ([])),
};
vi.mock('../src/modules/reports/report.model.js', () => reportes);

const { ejecutar, limpiarParametros, catalogoEnTexto, NOMBRES, TOPE_MS } =
  await import('../src/modules/ia-analisis/consultas.js');

beforeEach(() => {
  reportes.overview.mockClear();
  reportes.resumenMensual.mockClear();
  reportes.ventasPorAsesoraReport.mockClear();
});

describe('solo se ejecuta lo que esta en el catalogo', () => {
  it('una consulta conocida se ejecuta', async () => {
    const r = await ejecutar('resumen_general', { projectId: 3 });
    expect(r.datos).toEqual({ leads: 10 });
    expect(reportes.overview).toHaveBeenCalledWith({ projectId: 3 });
  });

  it('un nombre inventado NO se ejecuta', async () => {
    await expect(ejecutar('borrar_todo')).rejects.toMatchObject({ code: 'CONSULTA_DESCONOCIDA' });
    expect(reportes.overview).not.toHaveBeenCalled();
  });

  it('y el error dice cuales SI hay, para no tener que adivinar', async () => {
    await expect(ejecutar('lo_que_sea')).rejects.toThrow(/resumen_general/);
  });

  it('no hay forma de colar SQL: no se acepta ninguno', () => {
    // El catalogo son nombres, no consultas. Si algun dia alguien añade un
    // parametro que sea SQL, esta prueba deja de tener sentido y hay que
    // repensar la capa entera.
    expect(NOMBRES.every((n) => /^[a-z_]+$/.test(n))).toBe(true);
  });
});

describe('los parametros se limpian, no se corrigen', () => {
  it('lo que la consulta no admite se cae', () => {
    expect(limpiarParametros('resumen_general', { projectId: 3, tabla: 'users' }))
      .toEqual({ projectId: 3 });
  });

  it('un id que no es un numero se descarta', () => {
    // Adivinar que queria decir es como se cuelan los numeros que no son.
    expect(limpiarParametros('resumen_general', { projectId: '3; DROP TABLE leads' }))
      .toEqual({ projectId: 3 });
    expect(limpiarParametros('resumen_general', { projectId: 'todos' })).toEqual({});
  });

  it('una fecha con formato raro tambien', () => {
    expect(limpiarParametros('resumen_general', { from: 'julio de 2026' })).toEqual({});
    expect(limpiarParametros('resumen_general', { from: '2026-07-01' })).toEqual({ from: '2026-07-01' });
  });

  it('un id negativo o cero no vale', () => {
    expect(limpiarParametros('resumen_general', { projectId: -1 })).toEqual({});
    expect(limpiarParametros('resumen_general', { projectId: 0 })).toEqual({});
  });
});

describe('se devuelve lo que se EJECUTO, no lo que se pidio', () => {
  it('los parametros que sobrevivieron viajan en la respuesta', async () => {
    // Es lo que permite comprobar la respuesta a mano: si el modelo contesta
    // «en julio» pero se ejecuto sin fechas, se ve.
    const r = await ejecutar('resumen_general', { projectId: 3, from: 'julio', to: '2026-07-31' });
    expect(r.parametros).toEqual({ projectId: 3, to: '2026-07-31' });
  });

  it('y el nombre de la consulta', async () => {
    const r = await ejecutar('ventas_por_asesora', {});
    expect(r.nombre).toBe('ventas_por_asesora');
  });
});

describe('el tiempo maximo', () => {
  it('una consulta que se eterniza se corta', async () => {
    vi.useFakeTimers();
    reportes.overview.mockImplementation(() => new Promise(() => {}));   // no termina nunca
    const promesa = ejecutar('resumen_general', {});
    const esperado = expect(promesa).rejects.toMatchObject({ code: 'CONSULTA_LENTA' });
    await vi.advanceTimersByTimeAsync(TOPE_MS + 10);
    await esperado;
    vi.useRealTimers();
  });

  it('y una normal no se ve afectada', async () => {
    const r = await ejecutar('resumen_mensual', {});
    expect(r.datos).toEqual([{ mes: '2026-07' }]);
  });
});

describe('el catalogo que se le da al modelo', () => {
  it('sale del mismo objeto que se ejecuta', () => {
    // Escrito a mano se quedaria viejo al añadir una consulta, y el modelo
    // pediria cosas que ya no existen.
    const texto = catalogoEnTexto();
    for (const n of NOMBRES) expect(texto).toContain(n);
  });

  it('dice que parametros admite cada una', () => {
    expect(catalogoEnTexto()).toMatch(/projectId/);
  });
});
