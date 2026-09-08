import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Guardar el perfil de un tutor no puede borrar lo que no se manda (#92).
 *
 * Los datos de los dos CRMs, contados por Diego:
 *
 *     MultiCRM   19 tutores  ·  con IBAN: 0
 *     ISEIE      26 tutores  ·  con IBAN: 0
 *
 * Ni uno. Y ya hay comisiones generandose, asi que hoy no se puede pagar a
 * ningun tutor. Lo unico que SI hay en esa tabla son los telefonos: 16 de 16.
 *
 * El guardado escribia los cuatro campos siempre, con `|| null`. Conectar una
 * pantalla de edicion sobre eso —con los campos en blanco mientras se carga, o
 * mandando solo el IBAN— se llevaba por delante los telefonos. Y sin aviso: un
 * UPDATE que pone null a algo que ya era null no se distingue del que borra.
 *
 * La regla que se fija aqui:
 *
 *   campo ausente  → no se toca
 *   null o vacio   → se borra, porque alguien lo vacio a proposito
 */

const query = vi.fn();
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a) }));
vi.mock('bcrypt', () => ({ default: { hash: async () => 'x', compare: async () => true } }));

const { guardarPerfil } = await import('../src/modules/tutores/tutor.model.js');

/** El INSERT que se acaba mandando. */
const loEscrito = () => {
  const llamada = query.mock.calls.find(([sql]) => /INSERT INTO tutor_profiles/.test(sql));
  return llamada ? { sql: llamada[0], params: llamada[1] } : null;
};

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [{ user_id: 7 }] });
});

describe('lo que no se manda, no se toca', () => {
  it('guardar SOLO el IBAN no menciona el telefono', async () => {
    await guardarPerfil(7, { iban: 'ES9121000418450200051332' });
    const { sql, params } = loEscrito();
    expect(sql, 'el telefono entraba en el UPDATE y se iba a null').not.toMatch(/telefono/);
    expect(sql).toMatch(/iban/);
    expect(params).toEqual([7, 'ES9121000418450200051332']);
  });

  it('ni el DNI ni las notas', async () => {
    await guardarPerfil(7, { iban: 'ES91' });
    const { sql } = loEscrito();
    expect(sql).not.toMatch(/dni_nif/);
    expect(sql).not.toMatch(/notas/);
  });

  it('guardar solo el telefono no borra el IBAN', async () => {
    await guardarPerfil(7, { telefono: '+34600111222' });
    const { sql } = loEscrito();
    expect(sql).not.toMatch(/iban/);
  });

  it('los cuatro juntos se escriben los cuatro', async () => {
    await guardarPerfil(7, { dniNif: '12345678Z', iban: 'ES91', telefono: '+34600', notas: 'x' });
    const { params } = loEscrito();
    expect(params).toEqual([7, '12345678Z', 'ES91', '+34600', 'x']);
  });
});

describe('vaciar a proposito SI borra', () => {
  it('un null borra ese campo', async () => {
    await guardarPerfil(7, { iban: null });
    const { sql, params } = loEscrito();
    expect(sql).toMatch(/iban/);
    expect(params).toEqual([7, null]);
  });

  it('una cadena vacia tambien: es el campo del formulario que se dejo en blanco', async () => {
    await guardarPerfil(7, { telefono: '' });
    expect(loEscrito().params).toEqual([7, null]);
  });

  it('y solo espacios, igual', async () => {
    await guardarPerfil(7, { telefono: '   ' });
    expect(loEscrito().params).toEqual([7, null]);
  });
});

describe('los bordes', () => {
  it('sin ningun campo NO se escribe nada', async () => {
    // Un formulario que se envia sin tocar nada no puede pasar por encima de la
    // fila entera.
    await guardarPerfil(7, {});
    expect(loEscrito(), 'un guardado vacio escribia los cuatro campos a null').toBeNull();
  });

  it('y aun asi devuelve el perfil, que es lo que espera quien llama', async () => {
    query.mockResolvedValue({ rows: [{ user_id: 7, telefono: '+34600111222' }] });
    const p = await guardarPerfil(7, {});
    expect(p?.telefono).toBe('+34600111222');
  });

  it('sin datos ningunos tampoco revienta', async () => {
    await guardarPerfil(7);
    expect(loEscrito()).toBeNull();
  });
});
