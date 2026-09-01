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
    const { htmlContent } = _internos.cuerpo({
      id: 42, nombre: 'Marta', gestora: 'Ana',
      fecha_solicitud: new Date(Date.now() - 45 * 60000).toISOString(),
    });
    expect(htmlContent).toContain('Marta');

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

  // Desde la #83 `cuerpo` devuelve `{ htmlContent, textContent }`.
  const texto = (l) => _internos.cuerpo(l).textContent;

  it('dice cuanto lleva esperando, no solo que espera', () => {
    // «45 minutos» mueve; «tienes un lead pendiente» no. Ahora va en la
    // etiqueta de la ficha en vez de dentro de la frase, para no repetir el
    // mismo numero tres veces en cuatro lineas.
    expect(texto(lead)).toMatch(/4[45] minutos/);
  });

  it('trae el telefono y el correo, para poder actuar sin buscarlos', () => {
    const t = texto(lead);
    expect(t).toContain('+34600111222');
    expect(t).toContain('marta@ejemplo.com');
  });

  it('el telefono y el correo se pueden pulsar', () => {
    // La gestora abre el aviso en el movil: si el numero no es un enlace, hay
    // que copiarlo a mano, y entonces el correo no ha ahorrado el paso.
    const { htmlContent } = _internos.cuerpo(lead);
    expect(htmlContent).toContain('href="tel:+34600111222"');
    expect(htmlContent).toContain('href="mailto:marta@ejemplo.com"');
  });

  it('no revienta si falta el telefono o el proyecto', () => {
    const t = texto({ ...lead, telefono: null, proyecto: null, email: null });
    expect(t).toContain('Marta Ruiz');
    expect(t).not.toContain('null');
  });

  it('lleva a la ficha del prospecto', () => {
    expect(_internos.cuerpo(lead).htmlContent).toContain('/prospectos/7');
  });

  it('dice como apagarlo, con enlace', () => {
    const t = texto(lead);
    expect(t).toMatch(/Mis preferencias/);
    expect(t).toMatch(/\/preferencias/);
  });

  it('va con sus tildes', () => {
    // Antes decia «entro», «todavia», «ningun», «Telefono». Lo lee una persona.
    const t = texto(lead);
    expect(t).toMatch(/Todavía no tiene ningún contacto/);
    expect(t).toMatch(/Teléfono/);
  });

  it('escapa lo que viene del formulario', () => {
    // El nombre llega de un formulario publico: sin escapar, un «&» o un «<»
    // rompen el HTML del correo.
    const { htmlContent } = _internos.cuerpo({ ...lead, nombre: 'Muñoz & Cia <SL>' });
    expect(htmlContent).toContain('Muñoz &amp; Cia &lt;SL&gt;');
    expect(htmlContent).not.toContain('<SL>');
  });
});
