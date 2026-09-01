import { describe, it, expect, vi, beforeEach } from 'vitest';

// El reporte de los lunes, tarea #29.
//
// Su criterio de terminado es «el correo del lunes y el panel dicen lo mismo»,
// y por eso el trabajo NO escribe consultas propias: llama a `overview()` y a
// `ventasVendedora()`, que son las que pinta el panel. Aqui se comprueba
// justamente eso —que no invente numeros— ademas de los rangos y la
// comparativa.
//
// EXCEPCION que hay que conocer: el dinero SI lleva consulta propia. El ticket
// dice que lo cobrado sale de `conversion_payments` y nunca de
// `conversions.importe_pagado`, pero el panel usa ese segundo campo. Las dos
// reglas del ticket se contradicen y gana la del dinero: este correo va a
// direccion y mandarles un ingreso inflado es peor que una discrepancia con una
// pantalla que esta mal. Medido: 11.440 € del panel contra 4.200 € reales.

const consultas = [];
vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql, params) => {
    consultas.push({ sql, params });
    return { rows: [{ cobrado: '4200.00', id: 1, nombre: 'Ana', email: 'ana@empresa.com' }] };
  }),
}));
vi.mock('../src/shared/services/brevo.service.js', () => ({ sendEmail: vi.fn(async () => ({ sent: true })) }));
vi.mock('../src/modules/reports/report.model.js', () => ({
  overview: vi.fn(async () => ({})),
  ventasVendedora: vi.fn(async () => []),
}));

const { _internos } = await import('../src/jobs/reporteSemanalScheduler.js');

beforeEach(() => { consultas.length = 0; });

describe('la semana que se reporta', () => {
  it('es la que acaba de cerrar: lunes a domingo', () => {
    // Un lunes. Lo que interesa es la semana ANTERIOR completa, no la que
    // empieza hoy — que no tiene datos todavia.
    const { semana } = _internos.semanas(new Date('2026-08-24T09:00:00'));
    expect(semana).toEqual({ from: '2026-08-17', to: '2026-08-23' });
  });

  it('y la anterior, para comparar', () => {
    const { anterior } = _internos.semanas(new Date('2026-08-24T09:00:00'));
    expect(anterior).toEqual({ from: '2026-08-10', to: '2026-08-16' });
  });

  it('las dos duran exactamente siete dias', () => {
    const { semana, anterior } = _internos.semanas(new Date('2026-08-24T09:00:00'));
    const dias = (a, b) => (new Date(b) - new Date(a)) / 86400000 + 1;
    expect(dias(semana.from, semana.to)).toBe(7);
    expect(dias(anterior.from, anterior.to)).toBe(7);
  });

  it('y no se solapan ni dejan hueco', () => {
    const { semana, anterior } = _internos.semanas(new Date('2026-08-24T09:00:00'));
    const siguiente = new Date(anterior.to);
    siguiente.setDate(siguiente.getDate() + 1);
    expect(siguiente.toISOString().slice(0, 10)).toBe(semana.from);
  });
});

describe('la comparativa con la semana anterior', () => {
  it('sube y baja con su porcentaje', () => {
    expect(_internos.comparar(10, 8)).toMatchObject({ texto: '+25 %', signo: 'sube' });
    expect(_internos.comparar(8, 10)).toMatchObject({ texto: '-20 %', signo: 'baja' });
  });

  it('sin nada con que comparar NO inventa un porcentaje', () => {
    // De 0 a 5 no es «+500 %»: antes no habia nada. Un porcentaje sobre cero es
    // un numero que impresiona y no significa nada.
    expect(_internos.comparar(5, 0).texto).toBe('nuevo');
    expect(_internos.comparar(0, 0).texto).toBe('=');
  });

  it('igual es igual, no «+0 %»', () => {
    expect(_internos.comparar(7, 7).texto).toBe('igual');
  });
});

describe('el correo', () => {
  const datos = {
    rango: { from: '2026-08-17', to: '2026-08-23' },
    ahora: { leads: { total: 48, convertido: 9 }, conversions: { total: 10 } },
    antes: { leads: { total: 30, convertido: 5 }, conversions: { total: 6 } },
    porAsesora: [
      { vendedora: 'Ana', ventas: 6, cobrado: '2500.00' },
      { vendedora: 'Luis', ventas: 4, cobrado: '1700.00' },
    ],
    cobrado: 4200,
    cobradoAntes: 3000,
  };

  // Desde la #83 `cuerpo` devuelve `{ htmlContent, textContent }`.
  const html = (d) => _internos.cuerpo(d).htmlContent;

  it('trae las cuatro cifras', () => {
    const h = html(datos);
    expect(h).toContain('48');           // prospectos
    expect(h).toContain('9');            // convertidos
    expect(h).toContain('10');           // ventas
    // Formateado en español: coma decimal. Ojo, el separador de miles NO
    // aparece con cuatro cifras —«4200,00 €», no «4.200,00 €»— y el espacio
    // antes del simbolo es no separable (U+00A0), no un espacio normal.
    expect(h).toMatch(/4200,00\s€/u);
  });

  it('la tabla por gestora usa `vendedora`, que es lo que devuelve el agregado', () => {
    // Con `asesora` salia vacia: ese campo es del informe de DETALLE, que
    // ademas devuelve una fila por venta. Se vio en pantalla, no leyendo.
    const h = html(datos);
    expect(h).toContain('Ana');
    expect(h).toContain('Luis');
    expect(h).not.toContain('undefined');
  });

  it('sin gestoras no pinta la tabla vacia', () => {
    expect(html({ ...datos, porAsesora: [] })).not.toContain('Por gestora');
  });

  it('avisa de que lo cobrado NO sale del panel', () => {
    // Si el correo y la pantalla dan numeros distintos y nadie lo explica, en
    // dos semanas no lo abre nadie — que es lo que teme el propio ticket.
    expect(html(datos)).toMatch(/pagos registrados/i);
  });

  it('va en tabla y con estilos en linea, que son la base', () => {
    // Es lo unico que se ve igual en Gmail, Outlook y el movil.
    //
    // Desde la #83 hay ademas una hoja en la cabecera, pero SOLO con lo que un
    // atributo `style` no puede hacer: las dos consultas de medios del movil y
    // del modo oscuro. Por eso ya no vale exigir que no haya clases; lo que
    // hay que exigir es que la hoja sea prescindible.
    const h = html(datos);
    expect(h).toContain('<table');
    expect(h).toMatch(/style="/);

    const hoja = h.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
    expect(hoja).toMatch(/@media/);
    // Ni una regla fuera de una consulta de medios: si la hubiera, seria una
    // regla de la que el correo dependeria, y Gmail podria comersela.
    expect(hoja.replace(/@media[^{]*\{[\s\S]*?\n  \}/g, '')).not.toMatch(/\{[^}]*:[^}]*\}/);
  });
});

describe('a quien va y cuantas veces', () => {
  it('solo a administracion, y respetando a quien lo apago', async () => {
    await _internos.destinatarios();
    const sql = consultas[0].sql;
    expect(sql).toMatch(/role IN \('admin', 'superadmin'\)/);
    expect(sql).toMatch(/avisos_apagados/);
    expect(sql).toMatch(/reporte_semanal/);
  });

  it('el dinero sale de conversion_payments, no de importe_pagado', () => {
    // La regla del dinero del ticket, comprobada sobre el fuente: es la unica
    // consulta propia del trabajo y tiene que ser esta.
    const fs = require('node:fs');
    const src = fs.readFileSync('src/jobs/reporteSemanalScheduler.js', 'utf8');
    expect(src).toMatch(/FROM conversion_payments/);
    expect(src).toMatch(/ROUND\(COALESCE\(SUM\(p\.importe\)/);
    // `toFixed` solo puede aparecer en el comentario que explica por que NO se usa.
    const usos = src.split('\n').filter((l) => l.includes('toFixed') && !l.trim().startsWith('*'));
    expect(usos).toEqual([]);
  });
});
