import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';

vi.mock('../src/shared/config/db.js', () => ({ query: vi.fn() }));
import { llevaCincoDeContado } from '../src/modules/proceso/reglasDelProceso.js';

/**
 * El 5 % de contado, que hoy depende de que alguien se acuerde (#91).
 *
 * El documento: «solo aplica en máster y diplomado, y se ofrece en el paso 3,
 * no antes». Son dos errores distintos y los dos cuestan dinero: ofrecerlo en
 * un curso regala un 5 % que no tocaba, y NO ofrecerlo en un máster no se nota
 * nunca —nadie reclama un descuento que no sabe que existe—.
 */

describe('quién lleva el 5 % de contado', () => {
  it('máster y diplomado, sí', () => {
    expect(llevaCincoDeContado('Master Neuroeducacion')).toBe(true);
    expect(llevaCincoDeContado('Diplomado en Logopedia')).toBe(true);
  });

  it('con tilde o sin ella, que en el catálogo conviven las dos', () => {
    // Unos productos llegaron de WordPress y otros se escribieron a mano.
    expect(llevaCincoDeContado('Máster en Neuroeducación')).toBe(true);
    expect(llevaCincoDeContado('Maestría en Psicología')).toBe(true);
  });

  it('curso y taller, no', () => {
    expect(llevaCincoDeContado('Curso Psicologia Infantil')).toBe(false);
    expect(llevaCincoDeContado('Taller Mindfulness Educativo')).toBe(false);
  });

  it('una masterclass no es un máster', () => {
    // Sin límite de palabra, una charla de una tarde se llevaría el 5 %.
    expect(llevaCincoDeContado('Masterclass de una tarde')).toBe(false);
  });

  it('también lo dice la categoría, no solo el nombre', () => {
    // Hay formaciones que no lo llevan en el nombre; el catálogo sí lo sabe.
    expect(llevaCincoDeContado('Programa avanzado', 'Diplomados')).toBe(true);
  });

  it('sin formación es NULL, y no es lo mismo que «no»', () => {
    // Aquí está el error caro: dar por hecho que no aplica cuando no se sabe.
    // La pantalla dice «comprueba si lleva el 5 %», no «sin 5 %».
    expect(llevaCincoDeContado(null)).toBeNull();
    expect(llevaCincoDeContado('', '')).toBeNull();
  });
});

/**
 * Y que la regla solo hable donde toca: el paso lo dice, no el codigo.
 *
 * Mismo patron que `avisa_plazas`. Si mañana el 5 % se mueve al paso 4 —o en
 * ISEIE va en otro sitio— se cambia la marca del paso, no esto.
 */
describe('solo en el paso donde se ofrece', () => {
  it('fuera de ese paso no dice nada, ni siquiera «no»', async () => {
    const { query } = await import('../src/shared/config/db.js');
    const filas = [
      { clave: 'paso_1', ofrece_descuento: false, producto: 'Master X', dias_de_retraso: 0, estado: 'pendiente', hecho: false },
      { clave: 'paso_3', ofrece_descuento: true, producto: 'Master X', dias_de_retraso: 0, estado: 'pendiente', hecho: false },
    ];
    query.mockResolvedValueOnce({ rows: filas });

    const { pasosDeLead } = await import('../src/modules/proceso/proceso.model.js');
    const r = await pasosDeLead(7);

    // En el paso 1 el aviso sobraria: el descuento se ofrece en el 3 «y no
    // antes». Enseñarlo antes es exactamente lo que el documento prohibe.
    expect(r[0].lleva_descuento).toBeNull();
    expect(r[1].lleva_descuento).toBe(true);
  });
});

/**
 * «Sin correo no hay guia de Moodle ni homologaciones: si falta, pedirlo el
 * dia 1» (#91). El CRM sabe si lo tiene.
 */
describe('cuando no tenemos su correo', () => {
  it('la agenda lo dice, para poder avisarlo en su paso', async () => {
    const { query } = await import('../src/shared/config/db.js');
    query.mockResolvedValueOnce({ rows: [
      { clave: 'paso_1', orden: 1, sin_correo: true, ofrece_descuento: false, dias_de_retraso: 0, estado: 'pendiente', hecho: false },
    ] });

    const { pasosDeLead } = await import('../src/modules/proceso/proceso.model.js');
    expect((await pasosDeLead(8))[0].sin_correo).toBe(true);
  });

  it('la consulta mira tambien el correo en blanco, no solo el nulo', async () => {
    // Un lead importado puede traer la cadena vacia en vez de NULL, y
    // entonces «tiene correo» seria mentira.
    const modelo = (await import('fs')).readFileSync(
      new URL('../src/modules/proceso/proceso.model.js', import.meta.url), 'utf8');
    expect(modelo).toMatch(/l\.email IS NULL OR btrim\(l\.email\) = ''/);
  });
});

/**
 * «Cada correo se avisa por WhatsApp» (#91).
 *
 * El documento: «nunca damos por hecho que lo ha visto». Un paso que va por
 * los dos canales no se cierra con uno solo, aunque se haya escrito tres
 * veces por ese uno.
 *
 * Esto toca la definicion de «paso hecho», que usan la ficha, la cola y el
 * numero del resumen. Lo que se fija aqui es que los TRES cuenten igual: si
 * el resumen dice 14 y la lista de abajo enseña 15, no se cree ninguno.
 */
describe('el correo no cierra el paso sin su aviso', () => {
  const modelo = () => readFileSync(
    new URL('../src/modules/proceso/proceso.model.js', import.meta.url), 'utf8');

  it('la cola y el resumen usan la misma regla que la ficha', () => {
    const src = readFileSync(
      new URL('../src/modules/proceso/proceso.model.js', import.meta.url), 'utf8');
    // Tres sitios: `HECHO` en la ficha, y `NOT ${HECHO}` en la cola y en el
    // resumen. Si alguien vuelve a poner el conteo a pelo en uno de los dos,
    // esto se pone rojo.
    expect(src.match(/NOT \$\{HECHO\}/g) || []).toHaveLength(2);
    expect(src).not.toMatch(/\$\{CONTACTOS\} < ls\.orden/);
  });

  it('solo se exige donde el paso declara los dos canales', () => {
    const src = modelo();
    expect(src).toMatch(/canales @> ARRAY\['email','whatsapp'\]/);
  });

  it('y no se le exige a quien no tiene correo', () => {
    // No se le puede mandar. De eso avisa `sin_correo`, que pide pedirselo.
    const src = modelo();
    const i = src.indexOf('EXIGE_LOS_DOS');
    expect(src.slice(i, i + 400)).toMatch(/l\.email IS NOT NULL/);
  });

  it('la llamada NO entra aunque el paso la declare', () => {
    // No todas las gestoras las registran: exigir un registro que no se hace
    // dejaria media cola pendiente para siempre por un motivo falso.
    const src = modelo();
    expect(src).not.toMatch(/FALTA_LLAMADA/);
  });
});
