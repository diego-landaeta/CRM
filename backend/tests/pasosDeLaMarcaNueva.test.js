import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

/**
 * Una marca nueva nace con los cinco pasos del proceso comercial (#87).
 *
 * La migracion 143 los sembro con un CROSS JOIN sobre los proyectos que
 * existian AQUEL DIA. Todo lo creado despues nacia con la tabla vacia, y sin
 * pasos el proceso comercial no existe: «que toca hoy» sale en blanco, la cola
 * del dia no tiene de que tirar y las plantillas no cuelgan de nada. Sin dar
 * ningun error, que es lo que lo hacia invisible.
 *
 * Comprobado en local antes de arreglarlo: proyecto creado por el panel, cero
 * pasos. Y despues: cinco.
 */

const llamadas = [];
vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql, params) => {
    llamadas.push({ sql, params });
    if (/INSERT INTO projects/i.test(sql)) return { rows: [{ id: 77, nombre: 'Marca' }] };
    return { rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }] };
  }),
}));

const { sembrarPorDefecto } = await import('../src/modules/proceso/proceso.model.js');
const { PASOS_POR_DEFECTO } = await import('../src/modules/proceso/pasosPorDefecto.js');

const inserts = () => llamadas.filter((c) => /INSERT INTO commercial_steps/i.test(c.sql));

describe('los cinco pasos de una marca nueva', () => {
  beforeEach(() => { llamadas.length = 0; });

  it('siembra los cinco, y en una sola ida a la base', async () => {
    const puestos = await sembrarPorDefecto(77);

    expect(inserts()).toHaveLength(1);
    expect(puestos).toBe(5);

    // Las cinco claves, que es por donde entra el codigo a cada paso.
    const { params } = inserts()[0];
    for (const p of PASOS_POR_DEFECTO) expect(params).toContain(p.clave);
    expect(params[0]).toBe(77);
  });

  it('no pisa lo que la marca ya tenga', async () => {
    await sembrarPorDefecto(77);
    const { sql } = inserts()[0];

    // Pasado un tiempo los pasos estan EDITADOS. Volver a sembrar no puede
    // deshacerle el trabajo a nadie: por eso ON CONFLICT y no un DELETE.
    expect(sql).toMatch(/ON CONFLICT \(project_id, clave\) DO NOTHING/i);
    expect(sql).not.toMatch(/DELETE/i);
  });

  it('manda los canales como lista, no como texto', async () => {
    await sembrarPorDefecto(77);
    const { sql, params } = inserts()[0];

    // Sin el casteo, Postgres infiere el array como texto suelto y el INSERT
    // revienta contra la columna text[]. Ya paso en `create`.
    expect(sql).toMatch(/::text\[\]/);
    expect(params).toContainEqual(['whatsapp', 'email']);
  });

  it('el seguimiento mensual va por fin de mes, no por dias', () => {
    const s = PASOS_POR_DEFECTO.find((p) => p.clave === 'seguimiento_mensual');
    expect(s.es_seguimiento).toBe(true);
    expect(s.cuando).toBe('Final de mes');
    expect(s.dia_desde).toBeNull();
    expect(s.dia_hasta).toBeNull();

    // Los otros cuatro son al reves: ventana en dias desde que entra el lead,
    // y `cuando` vacio para que la pantalla no escriba un dia de la semana
    // debajo del aviso de que no son dias de la semana.
    for (const p of PASOS_POR_DEFECTO.filter((x) => x.clave !== 'seguimiento_mensual')) {
      expect(p.cuando).toBeNull();
      expect(typeof p.dia_desde).toBe('number');
    }
  });

  it('la lista del codigo y la de la migracion dicen lo mismo', () => {
    // La migracion repara las marcas viejas y el codigo siembra las nuevas. Si
    // divergen, dos proyectos del mismo CRM llevan procesos distintos segun el
    // dia en que se crearon, y nadie lo va a notar mirando la pantalla.
    const sql = readFileSync(
      new URL('../migrations/175_pasos_de_las_marcas_nuevas.sql', import.meta.url), 'utf8'
    );
    for (const p of PASOS_POR_DEFECTO) {
      expect(sql).toContain(`'${p.clave}'`);
      expect(sql).toContain(p.nombre);
      expect(sql).toContain(p.nota);
    }
  });
});
