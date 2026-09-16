import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * El banco de mensajes (#101): quien ve que, y que se filtra.
 *
 * Es un respaldo con conversaciones de clientes dentro, asi que lo que mas
 * importa aqui no es que salgan las filas: es que NO salgan las de otro. Un
 * admin lo ve entero —para eso existe, para poder mirar lo que quedo de una
 * sesion que ya no esta— y una gestora ve su numero y nada mas.
 */

const query = vi.fn();
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a) }));
vi.mock('../src/shared/utils/normalizePhone.js', () => ({
  normalizePhone: (x) => x, phoneCanonical: (x) => x,
}));

const { banco, bancoPorNumero } = await import('../src/modules/whatsapp/chat.model.js');

/** Primero contesta el `count`, luego las filas. */
const conFilas = (total, filas = []) => {
  query.mockReset();
  query.mockResolvedValueOnce({ rows: [{ total }] });
  query.mockResolvedValueOnce({ rows: filas });
};

/** El SQL y los parametros de la consulta que trae las filas (la segunda). */
const consultaDeFilas = () => query.mock.calls[1];

beforeEach(() => { query.mockReset(); });

describe('quien ve que', () => {
  it('sin lista de instancias lo ve todo: es lo que necesita un admin', async () => {
    conFilas(3, [{ id: 1 }]);
    await banco({ instancias: null });
    const [sql] = consultaDeFilas();
    expect(sql).not.toContain('c.instancia = ANY');
  });

  it('con lista, solo esas', async () => {
    conFilas(1, [{ id: 1 }]);
    await banco({ instancias: ['crm-u4'] });
    const [sql, params] = consultaDeFilas();
    expect(sql).toContain('c.instancia = ANY');
    expect(params[0]).toEqual(['crm-u4']);
  });

  /**
   * La linea que evita el agujero.
   *
   * Una lista vacia significa «ninguna sesion», no «todas». Si esto devolviera
   * el banco entero, cualquiera sin sesion enlazada veria las conversaciones de
   * todo el equipo — y sin fallar, que es lo peor: pareceria que funciona.
   */
  it('una lista VACIA no devuelve nada, y desde luego no todo', async () => {
    const r = await banco({ instancias: [] });
    expect(r).toEqual({ filas: [], total: 0 });
    expect(query).not.toHaveBeenCalled();
  });

  it('lo mismo en el resumen por numero', async () => {
    expect(await bancoPorNumero({ instancias: [] })).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('los filtros', () => {
  it('el texto busca dentro del mensaje', async () => {
    conFilas(2, [{ id: 1 }]);
    await banco({ texto: 'convocatoria' });
    const [sql, params] = consultaDeFilas();
    expect(sql).toContain('m.texto ILIKE');
    expect(params).toContain('%convocatoria%');
  });

  it('el telefono se compara SOLO con cifras', async () => {
    // «+34 612 34 56 78» contra un «34612345678» guardado no casa por culpa del
    // mas y los espacios. Es el mismo fallo que el de los duplicados del #65.
    conFilas(1, [{ id: 1 }]);
    await banco({ telefono: '+34 612 34 56 78' });
    const [, params] = consultaDeFilas();
    expect(params).toContain('%34612345678%');
  });

  it('un telefono sin ninguna cifra no filtra por telefono', async () => {
    // Si se colara, seria un LIKE '%%' que casa con TODO: una busqueda que
    // devuelve la tabla entera parece que funciona y es lo contrario.
    conFilas(9, [{ id: 1 }]);
    await banco({ telefono: 'hola' });
    const [sql] = consultaDeFilas();
    expect(sql).not.toContain('regexp_replace');
  });

  it('el «hasta» incluye su dia entero', async () => {
    // Quien pide «hasta el 2 de septiembre» no quiere que se le queden fuera
    // los mensajes de esa misma tarde.
    conFilas(4, [{ id: 1 }]);
    await banco({ hasta: '2026-09-02' });
    const [sql] = consultaDeFilas();
    expect(sql).toContain("INTERVAL '1 day'");
  });

  it('se combinan entre ellos', async () => {
    conFilas(1, [{ id: 1 }]);
    await banco({ instancias: ['crm-u4'], texto: 'dosier', direccion: 'saliente', desde: '2026-08-01' });
    const [sql] = consultaDeFilas();
    for (const trozo of ['c.instancia = ANY', 'm.texto ILIKE', 'm.direccion =', 'm.ts >=']) {
      expect(sql, trozo).toContain(trozo);
    }
  });
});

describe('lo que devuelve', () => {
  it('si no hay nada, no pide las filas', async () => {
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    const r = await banco({});
    expect(r).toEqual({ filas: [], total: 0 });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('dice si tuvo adjunto, pero NO la ruta del archivo', async () => {
    // En una tabla que se exporta, una ruta interna no le dice nada a nadie y
    // encima se lleva a un Excel algo que no deberia salir de aqui.
    conFilas(1, [{ id: 1 }]);
    await banco({});
    const [sql] = consultaDeFilas();
    expect(sql).toContain('(m.media_url IS NOT NULL) AS con_adjunto');
    expect(sql).not.toMatch(/SELECT[\s\S]*\bm\.media_url\b(?!\s+IS)/);
  });

  it('lo mas reciente primero', async () => {
    conFilas(1, [{ id: 1 }]);
    await banco({});
    const [sql] = consultaDeFilas();
    expect(sql).toContain('ORDER BY m.ts DESC');
  });
});
