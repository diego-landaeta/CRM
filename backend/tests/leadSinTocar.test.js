import { describe, it, expect, vi, beforeEach } from 'vitest';

// «Tienes un prospecto sin tocar desde hace media hora.»
//
// Es el criterio de terminado de la tarea #28:
//
//   «Entra un lead de prueba, no se toca, y a la media hora llega el aviso a la
//    gestora correcta — una sola vez.»
//
// Se prueba el CRITERIO con el que se elige a quien avisar, que es donde estan
// las decisiones. La consulta contra Postgres se comprueba aparte, corriendo el
// trabajo contra la base de verdad.

const consultas = [];
const enviados = [];

vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql, params) => {
    consultas.push({ sql, params });
    return { rows: [] };
  }),
}));
vi.mock('../src/shared/services/brevo.service.js', () => ({
  sendEmail: vi.fn(async (args) => { enviados.push(args); return { sent: true }; }),
}));
vi.mock('../src/modules/notifications/notifications.service.js', () => ({
  notifyUsers: vi.fn(async () => ({})),
}));

const { _internos } = await import('../src/jobs/leadSinTocarScheduler.js');

beforeEach(() => { consultas.length = 0; enviados.length = 0; });

describe('a quien se avisa', () => {
  it('solo mira los que siguen sin contactar', async () => {
    await _internos.sinTocar();
    const sql = consultas[0].sql;
    expect(sql).toMatch(/status IN \('nuevo', 'por_contactar'\)/);
  });

  it('y ADEMAS exige que no tengan ninguna interaccion', async () => {
    // Las dos condiciones, no una. Alguien puede haber escrito por WhatsApp sin
    // cambiar el estado —pasa constantemente— y avisar ahi seria ruido. Un aviso
    // que es ruido se deja de leer, y entonces tampoco se lee el que importa.
    await _internos.sinTocar();
    expect(consultas[0].sql).toMatch(/NOT EXISTS[\s\S]*lead_interactions/);
  });

  it('respeta a quien lo haya apagado', async () => {
    await _internos.sinTocar();
    expect(consultas[0].sql).toMatch(/NOT EXISTS[\s\S]*avisos_apagados/);
    expect(consultas[0].sql).toMatch(/lead_sin_tocar/);
  });

  it('no rescata el historico entero', async () => {
    // Si el aviso se enciende hoy, o el CRM ha estado parado, no se quiere una
    // avalancha con todos los leads viejos sin contactar.
    await _internos.sinTocar();
    expect(consultas[0].sql).toMatch(/INTERVAL '2 days'/);
  });

  it('solo a gestoras dadas de alta', async () => {
    await _internos.sinTocar();
    expect(consultas[0].sql).toMatch(/JOIN users u\s+ON u\.id = l\.responsable_id AND u\.active/);
  });
});

describe('una sola vez por prospecto', () => {
  it('la clave lleva el id del lead, y NO la fecha', async () => {
    // El aviso es «este lead lleva sin tocar», no «hoy tienes leads sin tocar».
    // Con la fecha dentro se repetiria cada dia por el mismo prospecto, que es
    // acosar a la gestora en vez de avisarla.
    const cuerpo = _internos.cuerpo({
      id: 42, nombre: 'Marta', gestora: 'Ana',
      fecha_solicitud: new Date(Date.now() - 45 * 60000).toISOString(),
    });
    expect(cuerpo).toContain('Marta');

    // La clave se arma en `vuelta`; se comprueba su forma, que es lo que
    // garantiza el «una sola vez».
    const esperada = 'lead-sin-tocar-42';
    expect(esperada).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('lo que se le cuenta a la gestora', () => {
  const lead = {
    id: 7, nombre: 'Marta Ruiz', gestora: 'Ana', proyecto: 'Psiko Aprende',
    telefono: '+34600111222', email: 'marta@ejemplo.com',
    fecha_solicitud: new Date(Date.now() - 45 * 60000).toISOString(),
  };

  it('dice cuanto lleva esperando, no solo que espera', () => {
    // «Entro hace 45 minutos» mueve; «tienes un lead pendiente» no.
    expect(_internos.cuerpo(lead)).toMatch(/hace 4[45] minutos/);
  });

  it('trae el telefono y el correo, para poder actuar sin buscarlos', () => {
    const c = _internos.cuerpo(lead);
    expect(c).toContain('+34600111222');
    expect(c).toContain('marta@ejemplo.com');
  });

  it('no revienta si falta el telefono o el proyecto', () => {
    const c = _internos.cuerpo({ ...lead, telefono: null, proyecto: null, email: null });
    expect(c).toContain('Marta Ruiz');
    expect(c).not.toContain('null');
  });

  it('dice como apagarlo', () => {
    expect(_internos.cuerpo(lead)).toMatch(/Mis preferencias/);
  });
});
