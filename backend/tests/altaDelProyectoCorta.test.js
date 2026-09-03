import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Lo anterior al alta de un proyecto NO entra (#44).
 *
 * «Cada proyecto factura desde el dia que entra al CRM, no desde antes. Si el
 * proyecto lleva meses cobrando, ese historico no se importa: entraria como
 * ventas nuevas de este mes e inflaria todas las cifras y todas las comisiones.»
 * Es la regla que la propia tarea llama innegociable.
 *
 * El corte existia, pero SOLO al listar lo pendiente de facturar. En la primera
 * sincronizacion de un proyecto no hay estado previo, asi que se le pedian a
 * Stripe todos los cobros de su historia —hasta veinte mil— y todos se
 * guardaban en `stripe_payments`. De ahi leen tambien las pantallas de dinero
 * y las comisiones, asi que filtrar al final no bastaba: hay que no traerlo.
 *
 * Esto importa ahora porque toca conectar los proyectos de IA, que llevan meses
 * cobrando antes de entrar al CRM.
 */

const pedidos = [];

const modelo = {
  fechaDeCorte: vi.fn(async () => '2026-08-01'),
  getSyncState: vi.fn(async () => null),
  upsertPayment: vi.fn(async (p) => ({ id: 1, ...p })),
  upsertSyncState: vi.fn(async () => ({})),
  getPaymentById: vi.fn(async () => null),
};
vi.mock('../src/modules/stripe-payments/stripe-payments.model.js', () => modelo);
vi.mock('../src/modules/integrations/integrations.model.js', () => ({
  get: async () => ({ encrypted_value: 'x', iv: 'y', auth_tag: 'z' }),
}));
vi.mock('../src/shared/utils/crypto.js', () => ({
  decrypt: () => 'sk_test_loquesea', encrypt: () => ({}),
}));
vi.mock('../src/shared/config/db.js', () => ({ query: async () => ({ rows: [] }) }));
vi.mock('../src/modules/tutores/tutor.model.js', () => ({}));

/** Se apunta que rango se le pide a Stripe y se contesta vacio. */
global.fetch = vi.fn(async (url) => {
  pedidos.push(new URL(url));
  return { ok: true, json: async () => ({ data: [], has_more: false }) };
});

const servicio = await import('../src/modules/stripe-payments/stripe-payments.service.js');

/** El `created[gte]` de la primera peticion, como fecha. */
const desdeCuandoSePidio = () => {
  const v = pedidos[0]?.searchParams.get('created[gte]');
  return v ? new Date(Number(v) * 1000).toISOString().slice(0, 10) : null;
};

beforeEach(() => {
  pedidos.length = 0;
  modelo.fechaDeCorte.mockResolvedValue('2026-08-01');
  modelo.getSyncState.mockResolvedValue(null);
});

describe('la primera sincronizacion de un proyecto', () => {
  it('NO pide toda la historia: corta por el alta', async () => {
    await servicio.syncStripePayments(7);
    expect(desdeCuandoSePidio(), 'se pedian todos los cobros de la historia').toBe('2026-08-01');
  });

  it('sin fecha de corte no se corta, que es lo prudente', async () => {
    // Perder un cobro en silencio es peor que traer de mas: si no se sabe desde
    // cuando cuenta el proyecto, se trae y ya se filtrara al facturar.
    modelo.fechaDeCorte.mockResolvedValue(null);
    await servicio.syncStripePayments(7);
    expect(desdeCuandoSePidio()).toBeNull();
  });
});

describe('las siguientes', () => {
  it('siguen desde donde se quedaron, no desde el alta', async () => {
    modelo.getSyncState.mockResolvedValue({ last_synced_until: '2026-09-01T00:00:00Z' });
    await servicio.syncStripePayments(7);
    // Se resta una hora de solape a proposito, asi que cae en el dia anterior.
    expect(desdeCuandoSePidio()).toBe('2026-08-31');
  });

  it('pero nunca por debajo del alta', async () => {
    // Un estado corrupto o movido a mano no puede abrir la puerta al historico.
    modelo.getSyncState.mockResolvedValue({ last_synced_until: '2020-01-01T00:00:00Z' });
    await servicio.syncStripePayments(7);
    expect(desdeCuandoSePidio()).toBe('2026-08-01');
  });
});

describe('«todo el historial» tambien respeta el alta', () => {
  it('fullHistory significa todo DESDE EL ALTA', async () => {
    await servicio.syncStripePayments(7, { fullHistory: true });
    expect(desdeCuandoSePidio(), 'fullHistory se saltaba el corte').toBe('2026-08-01');
  });

  it('la salida de emergencia es mover el corte, no saltarselo', async () => {
    // Es lo que ya decia el modelo: si hace falta recuperar algo anterior, se
    // mueve `al_dia_hasta` hacia atras y aparece.
    modelo.fechaDeCorte.mockResolvedValue('2025-01-01');
    await servicio.syncStripePayments(7, { fullHistory: true });
    expect(desdeCuandoSePidio()).toBe('2025-01-01');
  });
});
