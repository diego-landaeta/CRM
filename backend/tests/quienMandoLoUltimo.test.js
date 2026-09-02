import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * En la lista de chats hay que decir QUIEN mando lo ultimo (#74).
 *
 * En un grupo hablan varios y la lista ponia el adelanto a secas: «Sticker»,
 * «Tutorial». No habia forma de saber de quien era sin abrir el chat, y con
 * cinco grupos arriba eso es abrirlos todos. WhatsApp escribe «Dieguis:
 * Sticker» y «Tu: Sticker».
 *
 * Lo que se fija aqui es de donde sale ese nombre, que es la parte que se
 * rompe sola:
 *
 *  · Del MISMO mensaje que el texto. Con una subconsulta por columna cada una
 *    elige su fila por su cuenta, y basta un empate de `ts` —que los hay,
 *    WhatsApp da la hora en segundos— para pegar el autor de un mensaje al
 *    texto de otro. Eso no falla en pruebas y miente en pantalla.
 *  · Con la guarda de la 133. Sin la migracion, la lista tiene que salir igual
 *    y sin autor, no reventar entera.
 */

const query = vi.fn();
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a) }));
vi.mock('../src/shared/utils/normalizePhone.js', () => ({
  normalizePhone: (x) => x, phoneCanonical: (x) => x,
}));

let listar;
beforeEach(async () => {
  vi.resetModules();
  query.mockReset();
  ({ listar } = await import('../src/modules/whatsapp/chat.model.js'));
});

/** La consulta gorda: la ultima, la de la lista. */
const sqlDeLaLista = () => query.mock.calls.at(-1)[0];

const conMigracion = (hay) => {
  query.mockImplementation(async (sql) => {
    if (/information_schema\.columns/.test(sql)) return { rows: hay ? [{ 1: 1 }] : [] };
    return { rows: [] };
  });
};

describe('con la 133 aplicada', () => {
  beforeEach(() => conMigracion(true));

  it('pide quien mando lo ultimo', async () => {
    await listar({ instancia: 'crm-u4' });
    expect(sqlDeLaLista()).toContain('AS ultimo_autor');
  });

  it('y si lo mandamos nosotros, que tambien se sepa', async () => {
    await listar({ instancia: 'crm-u4' });
    expect(sqlDeLaLista(), 'sin la direccion no se puede poner «Tu:»').toContain('AS ultimo_direccion');
  });

  it('texto, tipo y autor salen del MISMO mensaje', async () => {
    await listar({ instancia: 'crm-u4' });
    const sql = sqlDeLaLista();
    expect(sql).toContain('LEFT JOIN LATERAL');
    // Una sola vez se elige cual es el ultimo mensaje.
    const veces = (sql.match(/ORDER BY m\.ts DESC, m\.id DESC LIMIT 1/g) || []).length;
    expect(veces, 'cada columna elegia su fila por su cuenta').toBe(1);
  });
});

describe('sin la 133', () => {
  beforeEach(() => conMigracion(false));

  it('la lista sale igual, solo que sin autor', async () => {
    await listar({ instancia: 'crm-u4' });
    const sql = sqlDeLaLista();
    expect(sql).not.toContain('participante_nombre');
    expect(sql).toContain('AS ultimo_texto');
    expect(sql).toContain('AS ultimo_direccion');
  });
});
