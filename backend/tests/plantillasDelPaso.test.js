import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Las plantillas de cada paso, rellenas y listas para copiar (#88).
 *
 * Lo que defienden estas pruebas es lo que el documento comercial exige y es
 * facil de romper sin enterarse:
 *
 *  · que no se escape el HTML —«Máster & Diplomado» sale entero en un chat—,
 *  · que un dato que el CRM no tiene vuelva como [corchete] y no como blanco,
 *  · y que las personales de otra gestora no salgan en la ficha de nadie.
 */

const query = vi.fn();
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a) }));

const { rellenar, horasSueltas, plantillasDelPaso } =
  await import('../src/modules/proceso/plantillasDelPaso.js');

const LEAD = {
  id: 6, project_id: 1, nombre: 'David Torres', email: 'd@x.com', telefono: '600',
  proyecto: 'Psiko Aprende', gestora: 'Angel M.', producto: 'Máster & Diplomado',
  fecha_inicio_texto: 'marzo 2026', duracion: '9 meses', horas: '750 horas',
  precio: '1200.00', moneda: 'EUR', cierre: '2026-03-12',
};

describe('rellenar', () => {
  it('pone lo que el CRM sabe, en los dos idiomas de hueco', () => {
    // WhatsApp usa una llave y el correo dos. La gestora no tiene por que
    // saber cual es cual: las dos se rellenan.
    const t = rellenar('Hola {nombre}, de {{project.nombre}}, sobre {{lead.producto}}',
      { nombre: 'David', proyecto: 'Psiko Aprende', producto: 'Máster' });
    expect(t).toBe('Hola David, de Psiko Aprende, sobre Máster');
  });

  it('NO escapa el HTML', () => {
    // Pasarlo por renderTemplate convertiria el & en &amp; dentro del chat.
    // Esta escrito en la migracion 122 y se sigue cumpliendo.
    expect(rellenar('{producto}', { producto: 'Máster & Diplomado' }))
      .toBe('Máster & Diplomado');
  });

  it('sin dato, vuelve el corchete y no un blanco', () => {
    // Un «Duración:  » en un mensaje no lo ve nadie; un «[nº meses]», si.
    const t = rellenar('Inicio: {inicio}\nDuración: {duracion}\nTotal: {inversion}', {});
    expect(t).toContain('[fecha de inicio]');
    expect(t).toContain('[nº meses]');
    expect(t).toContain('[importe]');
  });

  it('deja en paz los huecos que no conoce', () => {
    // Uno inventado no puede desaparecer: desaparecido, la frase queda coja y
    // nadie se entera. Se queda a la vista.
    expect(rellenar('{loquesea}', { nombre: 'X' })).toBe('{loquesea}');
  });
});

describe('las horas', () => {
  it('se quedan sin la palabra, que la pone la plantilla', () => {
    // El catalogo las guarda «750 horas» y la plantilla dice «{horas} horas
    // lectivas»: sin esto salia «750 horas horas lectivas».
    expect(horasSueltas('750 horas')).toBe('750');
    expect(horasSueltas('750')).toBe('750');
    expect(horasSueltas('750 h')).toBe('750');
  });

  it('lo que no reconoce lo deja tal cual', () => {
    expect(horasSueltas('750 horas lectivas')).toBe('750 horas lectivas');
    expect(horasSueltas('horas')).toBe('horas');
  });
});

describe('plantillasDelPaso', () => {
  beforeEach(() => query.mockReset());

  function conBase({ lead = LEAD, wa = [], email = [] } = {}) {
    query.mockImplementation(async (sql) => {
      if (/FROM leads l/i.test(sql)) return { rows: lead ? [lead] : [] };
      if (/whatsapp_templates/i.test(sql)) return { rows: wa };
      return { rows: email };
    });
  }

  it('devuelve el texto ya relleno con los datos de la persona', async () => {
    conBase({ wa: [{ id: 1, label: 'Día 1 · Saludo', body: 'Hola {nombre}, soy de {proyecto}. Dura {duracion} · {horas} horas.', pide_adjunto: false, pista: null, orden: 1 }] });

    const r = await plantillasDelPaso(6, 'paso_1');
    expect(r.whatsapp[0].texto).toBe('Hola David, soy de Psiko Aprende. Dura 9 meses · 750 horas.');
  });

  it('saluda por el nombre de pila, no por el completo', async () => {
    conBase({ wa: [{ id: 1, label: 'x', body: '{nombre}', pide_adjunto: false, pista: null, orden: 1 }] });
    expect((await plantillasDelPaso(6, 'paso_1')).whatsapp[0].texto).toBe('David');
  });

  it('pide solo las de ese paso, ese proyecto, y ninguna personal', async () => {
    conBase();
    await plantillasDelPaso(6, 'paso_2');

    const wa = query.mock.calls.find((c) => /whatsapp_templates/i.test(c[0]));
    expect(wa[1]).toEqual([1, 'paso_2']);
    // Las personales son de quien las escribio. En la ficha de un prospecto
    // saldrian las de otra gestora, que no las ha visto nunca.
    expect(wa[0]).toMatch(/ambito = 'compartida'/);
    expect(wa[0]).toMatch(/active/);
  });

  it('un prospecto que no existe es null, no una lista vacia', async () => {
    // No es lo mismo que un paso sin plantillas, y la pantalla dice cosas
    // distintas en cada caso.
    conBase({ lead: null });
    expect(await plantillasDelPaso(999, 'paso_1')).toBeNull();
  });

  it('el importe se escribe como dinero', async () => {
    conBase({ wa: [{ id: 1, label: 'x', body: 'Total: {inversion}', pide_adjunto: false, pista: null, orden: 1 }] });
    const t = (await plantillasDelPaso(6, 'paso_1')).whatsapp[0].texto;
    // Sin comparar la cadena entera: el separador de miles y el sitio del € los
    // pone el sistema, y no es lo que defiende esta prueba.
    expect(t).toMatch(/1[.\s]?200/);
    expect(t).toContain('€');
  });
});
