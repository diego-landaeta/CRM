import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Traer al CRM lo que la app de IA guarda en su Supabase (#44).
 *
 * Se conecta con un access token de la Management API, no con Stripe. Lo que
 * se fija aquí es lo que puede hacer daño:
 *
 *   - QUE NO DUPLIQUE. Cada suscripción se marca con su id en `notas_pago` y
 *     se comprueba antes de crear. Sin eso, cada sincronización volvería a
 *     crear las 23 de Tarot y el mes no pararía de subir. Es el fallo que no
 *     se ve hasta que las cifras ya están mal.
 *   - QUE SEA SOLO LECTURA contra la base ajena. El token tiene permiso para
 *     mucho más; la puerta se estrecha en el código, no en la confianza.
 *   - QUE `soloProbar` NO ESCRIBA. La pantalla lo usa para enseñar el número
 *     antes de que alguien pulse de verdad: si escribiera, el «previo» sería
 *     la importación.
 *   - QUE UNA SUSCRIPCIÓN SIN EMAIL NO ENTRE. Sin email no hay cliente al que
 *     atarla, y una venta suelta sin dueño ensucia más de lo que informa.
 */

const consultas = [];
const query = vi.fn(async (sql, params) => {
  consultas.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
  if (/FROM conversions WHERE project_id/.test(sql)) return { rows: [] };
  if (/FROM leads WHERE project_id/.test(sql)) return { rows: [] };
  if (/INSERT INTO leads/.test(sql)) return { rows: [{ id: 101 }] };
  if (/INSERT INTO conversions/.test(sql)) return { rows: [{ id: 201 }] };
  return { rows: [] };
});
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a), getClient: vi.fn() }));

const conversion = { create: vi.fn(async () => ({ id: 201 })) };
vi.mock('../src/modules/conversions/conversion.model.js', () => conversion);

const integraciones = { get: vi.fn() };
vi.mock('../src/modules/integrations/integrations.model.js', () => integraciones);
vi.mock('../src/shared/utils/crypto.js', () => ({
  decrypt: vi.fn(() => 'sbp_de_mentira'), encrypt: vi.fn(), maskSecret: vi.fn(),
}));

const { previo, importar } = await import('../src/modules/ia-monitor/supabase.service.js');

/** Una suscripción tal como la devuelve la base de la app. */
function suscripcion(extra = {}) {
  return {
    id: 'uuid-1', plan_type: 'monthly', status: 'expired', amount: '9.99', currency: 'EUR',
    stripe_payment_intent_id: 'pi_123', stripe_subscription_id: null,
    created_at: '2026-05-13 10:00:00+00', cancelled_at: null,
    email: 'cliente@correo.com', full_name: 'Cliente Uno',
    country_name: 'España', country_code: 'ES',
    ...extra,
  };
}

function respondeSupabase(filas) {
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(filas), json: async () => filas }));
}

/** La implementación por defecto: ninguna venta repetida, ningún lead previo. */
function respuestasNormales() {
  query.mockImplementation(async (sql, params) => {
    consultas.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
    if (/FROM conversions WHERE project_id/.test(sql)) return { rows: [] };
    if (/FROM leads WHERE project_id/.test(sql)) return { rows: [] };
    if (/INSERT INTO leads/.test(sql)) return { rows: [{ id: 101 }] };
    return { rows: [] };
  });
}

beforeEach(() => {
  consultas.length = 0;
  // `mockReset` y no `mockClear`: el segundo borra las llamadas pero DEJA la
  // implementación puesta. Dos pruebas de aquí cambian la suya, y con
  // `mockClear` esa implementación se colaba en las siguientes — pasaban por
  // el orden en que corren, no porque el código hiciera lo que dicen.
  query.mockReset();
  respuestasNormales();
  conversion.create.mockReset();
  conversion.create.mockResolvedValue({ id: 201 });
  integraciones.get.mockResolvedValue({
    encrypted_value: 'x', iv: 'y', auth_tag: 'z', config_public: { project_ref: 'abc123' },
  });
  respondeSupabase([suscripcion()]);
});

describe('la puerta hacia la base ajena', () => {
  it('solo salen consultas de lectura', async () => {
    await previo(6);
    const enviado = JSON.parse(global.fetch.mock.calls[0][1].body).query;
    expect(enviado.trim().toUpperCase().startsWith('SELECT')).toBe(true);
    expect(enviado).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
  });

  it('sin credencial guardada no se llama a nadie', async () => {
    integraciones.get.mockResolvedValue(null);
    await expect(previo(6)).rejects.toThrow(/no tiene Supabase configurado/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sin la referencia del proyecto, tampoco', async () => {
    integraciones.get.mockResolvedValue({ encrypted_value: 'x', iv: 'y', auth_tag: 'z', config_public: {} });
    await expect(previo(6)).rejects.toThrow(/referencia/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('mirar sin tocar', () => {
  it('`previo` cuenta y no escribe ni una fila', async () => {
    respondeSupabase([suscripcion(), suscripcion({ id: 'uuid-2', amount: '4.90', email: null })]);
    const r = await previo(6);
    expect(r.suscripciones).toBe(2);
    expect(r.conEmail).toBe(1);
    expect(r.sinEmail).toBe(1);
    expect(consultas.filter((c) => /^INSERT/i.test(c.sql))).toHaveLength(0);
  });

  it('`soloProbar` dice cuántas entrarían, sin escribir', async () => {
    respondeSupabase([suscripcion(), suscripcion({ id: 'uuid-2' })]);
    const r = await importar(6, { soloProbar: true });
    expect(r.ventasNuevas).toBe(2);
    expect(consultas.filter((c) => /^INSERT/i.test(c.sql))).toHaveLength(0);
    expect(conversion.create).not.toHaveBeenCalled();
  });
});

describe('importar de verdad', () => {
  it('crea el cliente, y la venta POR EL MODELO', async () => {
    // Por el modelo y no con un INSERT a mano: es lo que pone el IVA como
    // incluido —la columna tiene DEFAULT false, o sea «súmalo encima»—, mete
    // venta y cobro en la misma transacción y pasa el lead a convertido.
    await importar(6);
    expect(consultas.some((c) => /INSERT INTO leads/.test(c.sql))).toBe(true);
    expect(conversion.create).toHaveBeenCalledTimes(1);
    // Nada de escribir en `conversions` por fuera del modelo.
    expect(consultas.some((c) => /INSERT INTO conversions/.test(c.sql))).toBe(false);
    expect(consultas.some((c) => /INSERT INTO conversion_payments/.test(c.sql))).toBe(false);
  });

  it('el cobro va en la misma llamada, para que no se quede una venta sin él', async () => {
    await importar(6);
    expect(conversion.create.mock.calls[0][0]).toMatchObject({ importe_pagado: 9.99 });
  });

  it('deja la marca de la suscripción, que es lo que evita duplicarla', async () => {
    await importar(6);
    expect(conversion.create.mock.calls[0][0].notas_pago).toContain('[supabase:uuid-1]');
  });

  it('una suscripción en otra moneda no entra', async () => {
    // Sumar dólares con euros da un número que no es nada, y convertirlos a
    // ojo es inventarse el cambio del día que se cobró.
    respondeSupabase([suscripcion({ currency: 'USD' })]);
    const r = await importar(6);
    expect(r.otraMoneda).toBe(1);
    expect(r.ventasNuevas).toBe(0);
    expect(conversion.create).not.toHaveBeenCalled();
  });

  it('NO la vuelve a crear si ya está', async () => {
    // La segunda vuelta contra Tarot dio 0 nuevas y 23 ya estaban. Esto lo fija.
    query.mockImplementation(async (sql, params) => {
      consultas.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
      if (/FROM conversions WHERE project_id/.test(sql)) return { rows: [{ id: 999 }] };
      if (/INSERT INTO leads/.test(sql)) return { rows: [{ id: 101 }] };
      return { rows: [] };
    });
    const r = await importar(6);
    expect(r.ventasNuevas).toBe(0);
    expect(r.yaEstaban).toBe(1);
    expect(conversion.create).not.toHaveBeenCalled();
    expect(consultas.filter((c) => /^INSERT/i.test(c.sql))).toHaveLength(0);
  });

  it('reutiliza el cliente que ya existe en vez de crear otro', async () => {
    query.mockImplementation(async (sql, params) => {
      consultas.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
      if (/FROM conversions WHERE project_id/.test(sql)) return { rows: [] };
      if (/FROM leads WHERE project_id/.test(sql)) return { rows: [{ id: 55 }] };
      return { rows: [] };
    });
    const r = await importar(6);
    expect(r.clientesNuevos).toBe(0);
    expect(r.ventasNuevas).toBe(1);
    expect(consultas.some((c) => /INSERT INTO leads/.test(c.sql))).toBe(false);
  });

  it('una suscripción sin email se salta', async () => {
    respondeSupabase([suscripcion({ email: null })]);
    const r = await importar(6);
    expect(r.sinEmail).toBe(1);
    expect(r.ventasNuevas).toBe(0);
  });
});
