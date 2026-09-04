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
    await _internos.mandar('resumen_del_dia', ['gestor'], 'Resumen', async () => ({}));
    expect(enviados).toHaveLength(1);
    expect(enviados[0].clave).toMatch(/^resumen_del_dia-1-\d{4}-\d{2}-\d{2}$/);
  });

  it('cada persona lleva su propia clave', async () => {
    // Sin el id dentro, el primero en recibirlo dejaria sin aviso a los demas.
    await _internos.mandar('resumen_del_dia', ['gestor'], 'Resumen', async () => ({}));
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
    const t = _internos.textoPlan('Ana', { sin_tocar: 0, en_seguimiento: 0, recordatorios: 0 });
    expect(t).toMatch(/no tienes nada pendiente/i);
  });

  it('los dos dicen como apagarlos', () => {
    const d = { entraron: 1, contactos: 1, convertidos: 0, sin_tocar: 1,
                en_seguimiento: 1, recordatorios: 1 };
    expect(_internos.textoResumen('Ana', d)).toMatch(/Mis preferencias/);
    expect(_internos.textoPlan('Ana', d)).toMatch(/Mis preferencias/);
  });
});
