import { describe, it, expect, vi, beforeEach } from 'vitest';

// El resumen del dia y el plan de mañana, de la tarea #28.
//
// Se prueba el CRITERIO —a quien se avisa, que se le cuenta y que no se repita—
// no la consulta contra Postgres, que se comprueba corriendo el trabajo contra
// la base de verdad.

const consultas = [];
const enviados = [];

vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql, params) => {
    consultas.push({ sql, params });
    // `destinatarios` devuelve gente; el resto, contadores.
    if (sql.includes('avisos_apagados') && sql.includes('FROM users')) {
      return { rows: [{ id: 1, nombre: 'Ana', email: 'ana@empresa.com' }] };
    }
    return { rows: [{ entraron: 2, contactos: 5, convertidos: 1, sin_tocar: 3,
                      en_seguimiento: 4, recordatorios: 2 }] };
  }),
}));
vi.mock('../src/shared/services/brevo.service.js', () => ({
  sendEmail: vi.fn(async (a) => { enviados.push(a); return { sent: true }; }),
}));

const { _internos } = await import('../src/jobs/resumenDiarioScheduler.js');

/** Un solo proyecto, que es el caso normal de una gestora. */
const unProyecto = (c) => ({
  variosProyectos: false,
  bloques: [{ proyecto: { id: 9, nombre: 'Proyecto de prueba' }, ...c }],
});

beforeEach(() => { consultas.length = 0; enviados.length = 0; });

describe('a quien llega', () => {
  it('respeta a quien lo apago', async () => {
    await _internos.destinatarios('resumen_del_dia', ['gestor']);
    expect(consultas[0].sql).toMatch(/NOT EXISTS[\s\S]*avisos_apagados/);
    expect(consultas[0].params).toContain('resumen_del_dia');
  });

  it('solo a gente activa y con correo', async () => {
    await _internos.destinatarios('resumen_del_dia', ['gestor']);
    expect(consultas[0].sql).toMatch(/u\.active/);
    expect(consultas[0].sql).toMatch(/u\.email IS NOT NULL/);
  });

  it('deja fuera a quien lleva colaboraciones', async () => {
    // Tiene rol de gestor pero no atiende prospectos: un resumen de su dia con
    // prospectos seria un correo de ceros todos los dias.
    await _internos.destinatarios('resumen_del_dia', ['gestor']);
    expect(consultas[0].sql).toMatch(/gestor_colaboraciones/);
  });
});

describe('una vez al dia, y cada dia', () => {
  it('la clave lleva la fecha, al reves que el aviso de prospecto sin tocar', async () => {
    // Alli la clave es el id del lead —el aviso es ESE prospecto y repetirlo
    // seria acosar—. Aqui es «lo de hoy», y tiene que llegar cada dia.
    await _internos.mandar('resumen_del_dia', ['gestor'], 'Resumen', async () => ({}), () => 'cuerpo');
    expect(enviados).toHaveLength(1);
    expect(enviados[0].clave).toMatch(/^resumen_del_dia-1-\d{4}-\d{2}-\d{2}$/);
  });

  it('cada persona lleva su propia clave', async () => {
    // Sin el id dentro, el primero en recibirlo dejaria sin aviso a los demas.
    await _internos.mandar('resumen_del_dia', ['gestor'], 'Resumen', async () => ({}), () => 'cuerpo');
    expect(enviados[0].clave).toContain('-1-');
  });

  it('que falle el de una persona no deja sin aviso a las demas', async () => {
    // Se comprueba que `mandar` no relanza: si lo hiciera, un correo con una
    // direccion mal escrita cortaria la lista entera.
    const rompe = async () => { throw new Error('esta persona no tiene datos'); };
    await expect(_internos.mandar('resumen_del_dia', ['gestor'], 'Resumen', rompe))
      .resolves.toBeTruthy();
  });
});

describe('lo que se cuenta', () => {
  it('si no ha pasado nada, se dice y punto', () => {
    // Un resumen de ceros disfrazado de informe es la forma mas rapida de que
    // se deje de leer — y entonces tampoco se lee el dia que si importa.
    const t = _internos.textoResumen('Ana', { entraron: 0, contactos: 0, convertidos: 0, sin_tocar: 0 });
    expect(t).toMatch(/no ha entrado ningun prospecto/i);
    expect(t).not.toMatch(/<li>/);
  });

  it('lo que esta a cero no se enseña', () => {
    // «0 convertidos» no informa de nada y alarga el correo.
    const t = _internos.textoResumen('Ana', { entraron: 3, contactos: 0, convertidos: 0, sin_tocar: 0 });
    expect(t).toMatch(/prospectos nuevos/);
    expect(t).not.toMatch(/convertidos/);
  });

  it('lo que queda sin contactar se dice aunque el dia haya ido bien', () => {
    const t = _internos.textoResumen('Ana', { entraron: 3, contactos: 9, convertidos: 2, sin_tocar: 4 });
    expect(t).toMatch(/quedan 4 sin contactar/i);
  });

  it('y si no queda ninguno, tambien se dice', () => {
    const t = _internos.textoResumen('Ana', { entraron: 3, contactos: 9, convertidos: 2, sin_tocar: 0 });
    expect(t).toMatch(/No te queda ninguno/i);
  });

  it('el plan de mañana con nada pendiente no inventa trabajo', () => {
    const t = _internos.textoPlan('Ana', { bloques: [], variosProyectos: false });
    expect(t).toMatch(/no tienes nada pendiente/i);
  });

  it('los dos dicen como apagarlos', () => {
    expect(_internos.textoResumen('Ana', { entraron: 1, contactos: 1, convertidos: 0, sin_tocar: 1 }))
      .toMatch(/Mis preferencias/);
    expect(_internos.textoPlan('Ana', unProyecto({ tomorrow: 1, no_contact: 1, overdue: 1 })))
      .toMatch(/Mis preferencias/);
  });
});

/**
 * Los enlaces del plan de mañana (#132).
 *
 * Es la frase que Diego subrayo del pedido: «y que sea un enlace, y cuando lo
 * abra, el CRM con eso puesto». El correo llevaba los numeros y ni un enlace,
 * asi que la gestora leia «tienes 12» y se quedaba buscandolos.
 *
 * Y no se le podia poner enlace tal como estaba: contaba
 * `fecha_recordatorio <= CURRENT_DATE + 1` —atrasados, hoy y mañana juntos— y
 * no hay ninguna pantalla que enseñe eso.
 */
describe('el plan lleva a algun sitio', () => {
  const conTrabajo = unProyecto({ tomorrow: 7, no_contact: 4, overdue: 2 });

  it('cada linea trae su enlace, con el filtro que le toca', () => {
    const t = _internos.textoPlan('Ana', conTrabajo);
    expect(t).toMatch(/prospectos\?projectId=9&qf=tomorrow/);
    expect(t).toMatch(/prospectos\?projectId=9&qf=no-contact/);
    expect(t).toMatch(/prospectos\?projectId=9&qf=overdue/);
  });

  it('el numero de la linea es el que abre el enlace', () => {
    // Los dos salen de `contarFiltrosRapidos`, que es la misma consulta del
    // listado. Si aqui pusiera «7» y la pantalla enseñara otra cosa, el correo
    // se dejaria de abrir a la semana.
    const t = _internos.textoPlan('Ana', conTrabajo);
    expect(t).toMatch(/<strong>7<\/strong> con recordatorio para mañana/);
    expect(t).toMatch(/<strong>4<\/strong> sin contactar/);
  });

  it('una fila a cero no sale, y por tanto no deja un enlace vacio', () => {
    const t = _internos.textoPlan('Ana', unProyecto({ tomorrow: 3, no_contact: 0, overdue: 0 }));
    expect(t).toMatch(/qf=tomorrow/);
    expect(t).not.toMatch(/qf=no-contact/);
    expect(t).not.toMatch(/qf=overdue/);
  });

  it('los enlaces salen de CRM_BASE_URL, no cableados', () => {
    const antes = process.env.CRM_BASE_URL;
    process.env.CRM_BASE_URL = 'https://360crm.tech/crm/';
    try {
      const t = _internos.textoPlan('Ana', conTrabajo);
      // Y sin la barra doble: la variable puede venir con barra final.
      expect(t).toMatch(/https:\/\/360crm\.tech\/crm\/prospectos\?projectId=9&qf=tomorrow/);
      expect(t).not.toMatch(/crm\/\/prospectos/);
    } finally {
      if (antes === undefined) delete process.env.CRM_BASE_URL;
      else process.env.CRM_BASE_URL = antes;
    }
  });

  it('el enlace lleva el proyecto del que salio el numero', () => {
    // El listado SIEMPRE trabaja sobre un proyecto. Sin el `projectId` en el
    // enlace, el correo abriria el que estuviera activo de antes y el numero no
    // cuadraria — que es justo lo que el ticket prohibe.
    const t = _internos.textoPlan('Ana', conTrabajo);
    expect(t).toMatch(/prospectos\?projectId=9&qf=tomorrow/);
  });

  it('con varios proyectos, cada uno con su nombre y sus enlaces', () => {
    const t = _internos.textoPlan('Ana', {
      variosProyectos: true,
      bloques: [
        { proyecto: { id: 1, nombre: 'Psiko Aprende' }, tomorrow: 3, no_contact: 0, overdue: 0 },
        { proyecto: { id: 2, nombre: 'ISEIH' }, tomorrow: 0, no_contact: 5, overdue: 0 },
      ],
    });
    expect(t).toMatch(/Psiko Aprende/);
    expect(t).toMatch(/ISEIH/);
    expect(t).toMatch(/projectId=1&qf=tomorrow/);
    expect(t).toMatch(/projectId=2&qf=no-contact/);
  });

  it('con uno solo no se pone el nombre del proyecto: sobra', () => {
    const t = _internos.textoPlan('Ana', conTrabajo);
    expect(t).not.toMatch(/Proyecto de prueba/);
  });

  it('los numeros los pide a la MISMA consulta que el listado', async () => {
    // Habia una consulta propia en el scheduler: la cuarta definicion de los
    // mismos criterios. Ahora delega, y eso se ve en el SQL que llega.
    consultas.length = 0;
    await _internos.loDeManana(1);
    const sql = consultas.map((c) => c.sql).join(' ');
    expect(sql).toMatch(/COUNT\(\*\) FILTER/);
    expect(sql).toMatch(/lead_reminders/);
  });
});
