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
  // Desde la #83 los dos avisos reciben la PERSONA entera —no solo su nombre—
  // y devuelven `{ htmlContent, textContent }` en vez de una cadena. Lo que se
  // comprueba aqui es el texto: es lo que lee la gestora, y no depende de como
  // este maquetado.
  const persona = { nombre: 'Ana' };
  const resumen = (d) => _internos.textoResumen(persona, d).textContent;
  const plan = (d) => _internos.textoPlan(persona, d).textContent;

  it('si no ha pasado nada, se dice y punto', () => {
    // Un resumen de ceros disfrazado de informe es la forma mas rapida de que
    // se deje de leer — y entonces tampoco se lee el dia que si importa.
    const t = resumen({ entraron: 0, contactos: 0, convertidos: 0, sin_tocar: 0 });
    expect(t).toMatch(/no ha entrado ningún prospecto/i);
  });

  it('las cifras salen aunque esten a cero, porque llevan su comparacion', () => {
    // Esto ANTES era al reves: «0 convertidos no informa y alarga el correo».
    // La #81 lo cambia, y con razon: un cero solo no dice nada, pero un cero
    // con «-100 %» al lado dice que ayer si hubo y hoy no, que es justo lo que
    // hay que saber. Lo que no informaba era el numero desnudo.
    const t = resumen({ entraron: 3, contactos: 0, convertidos: 0, sin_tocar: 0,
                        ayer: { entraron: 1, contactos: 4, convertidos: 2 } });
    expect(t).toMatch(/prospectos nuevos/i);
    expect(t).toMatch(/convertidos/i);
    expect(t).toMatch(/-100 %/);
  });

  it('lo que queda sin contactar se dice aunque el dia haya ido bien', () => {
    const t = resumen({ entraron: 3, contactos: 9, convertidos: 2, sin_tocar: 4 });
    expect(t).toMatch(/Sin contactar/i);
    expect(t).toMatch(/\b4\b/);
  });

  it('y si no queda ninguno, tambien se dice', () => {
    expect(resumen({ entraron: 3, contactos: 9, convertidos: 2, sin_tocar: 0 }))
      .toMatch(/No te queda ninguno/i);
  });

  it('el plan de mañana con nada pendiente no inventa trabajo', () => {
    expect(plan({ sin_tocar: 0, en_seguimiento: 0, recordatorios: 0 }))
      .toMatch(/no tienes nada pendiente/i);
  });

  it('los dos dicen como apagarlos, y con un enlace de verdad', () => {
    // Antes decia «Mis preferencias» en cursiva: contaba donde apagarlo pero no
    // llevaba. La #83 exige que sea un enlace.
    const d = { entraron: 1, contactos: 1, convertidos: 0, sin_tocar: 1,
                en_seguimiento: 1, recordatorios: 1 };
    for (const t of [resumen(d), plan(d)]) {
      expect(t).toMatch(/Mis preferencias/);
      expect(t).toMatch(/\/preferencias/);
    }
  });

  it('van con sus tildes, que es la mitad de la tarea #83', () => {
    // Un correo de empresa sin tildes parece automatico y mal hecho.
    const t = resumen({ entraron: 0, contactos: 0, convertidos: 0, sin_tocar: 0 });
    expect(t).toMatch(/día/);
    expect(t).not.toMatch(/\bningun\b|\bactividad sin\b|\bCómo ha ido el dia\b/);
  });

  // ─── La #81: la lista, no el numero ────────────────────────────────────────

  const conLista = {
    entraron: 1, contactos: 0, convertidos: 0, sin_tocar: 14,
    ayer: { entraron: 1, contactos: 1, convertidos: 0 },
    lista: [
      { id: 4821, nombre: 'María Muñoz', telefono: '+34600000001',
        producto_interes: 'Máster en Psicología', origen: 'Meta Ads',
        entro: new Date(Date.now() - 26 * 3600000) },
      { id: 4822, nombre: 'Jorge Iriarte', telefono: '+525512345678',
        producto_interes: 'Experto en Adicciones', origen: 'Google Ads',
        entro: new Date(Date.now() - 3 * 3600000) },
    ],
    dias7: [{ dia: '2026-08-30', entraron: 3 }, { dia: '2026-08-31', entraron: 1 }],
    canales: [{ canal: 'Meta Ads', total: 9 }],
  };

  it('trae la lista, no solo el numero', () => {
    // El fallo que reporta la #81: «te quedan 14 sin contactar» y ahi se
    // acababa. Para saber cuales habia que abrir el CRM y filtrar, o sea que
    // el correo no ahorraba ni un paso.
    const t = resumen(conLista);
    expect(t).toContain('María Muñoz');
    expect(t).toContain('Jorge Iriarte');
    expect(t).toMatch(/Máster en Psicología/);
    expect(t).toMatch(/Meta Ads/);
  });

  it('cada uno lleva su ficha, su WhatsApp y su telefono', () => {
    const h = _internos.textoResumen(persona, conLista).htmlContent;
    expect(h).toContain('/prospectos/4821');
    expect(h).toContain('href="tel:+34600000001"');
    // El `1` de Mexico lo quita `phoneCanonical`: sin eso el enlace de
    // WhatsApp no abre la conversacion correcta.
    expect(h).toContain('https://wa.me/525512345678');
  });

  it('dice cuantos quedan fuera en vez de callarselos', () => {
    // Catorce pendientes y dos en el correo: los otros doce no se esconden.
    expect(resumen(conLista)).toMatch(/12.*más sin contactar/s);
  });

  it('un dia en blanco enseña igualmente lo que hay pendiente', () => {
    // «Hoy no ha entrado ninguno» a secas parece un correo roto.
    const t = resumen({ ...conLista, entraron: 0, contactos: 0, convertidos: 0 });
    expect(t).toMatch(/no ha entrado ningún prospecto/i);
    expect(t).toContain('María Muñoz');
  });

  it('los graficos van en texto ademas de en color', () => {
    // Si el cliente no pinta fondos, el grafico tiene que seguir informando.
    const t = resumen(conLista);
    expect(t).toMatch(/últimos 7 días/i);
    expect(t).toMatch(/De dónde vinieron/i);
  });

  // ─── La #81: el del administrador es otro correo ───────────────────────────

  it('a administracion le llega el estado del equipo, no su propia lista', () => {
    // Hoy le llegaba «no te queda ninguno sin contactar», que ni siquiera es
    // asunto suyo porque no lleva prospectos.
    const t = _internos.textoResumenAdmin({ nombre: 'Admin' }, {
      equipo: [
        { id: 1, nombre: 'Ana Comercial', entraron: 7, contactos: 12, convertidos: 2, sin_tocar: 14 },
        { id: 2, nombre: 'Marta Ruiz', entraron: 4, contactos: 11, convertidos: 2, sin_tocar: 0 },
      ],
    }).textContent;
    expect(t).toMatch(/El equipo, hoy/);
    expect(t).toContain('Ana Comercial');
    expect(t).toContain('Marta Ruiz');
    expect(t).toMatch(/1 gestora tiene/);
    expect(t).not.toMatch(/No te queda ninguno sin contactar/);
  });

  it('el rol decide que correo se manda', () => {
    const { textoResumen: g, textoResumenAdmin: a } = _internos;
    expect(g).not.toBe(a);
    // Una gestora con lista recibe fichas; administracion, una tabla de gente.
    expect(_internos.textoResumen(persona, conLista).textContent).toContain('A quién llamar primero');
    expect(_internos.textoResumenAdmin({ nombre: 'Admin' }, { equipo: [] }).textContent)
      .not.toContain('A quién llamar primero');
  });

  it('sale tambien en texto plano, no solo en HTML', () => {
    // Sin la version plana, mas filtros lo marcan como basura.
    const r = _internos.textoResumen(persona, { entraron: 2, contactos: 0, convertidos: 0, sin_tocar: 1 });
    expect(r.htmlContent).toMatch(/^<!DOCTYPE html>/);
    expect(r.textContent).not.toMatch(/</);
    expect(r.textContent.length).toBeGreaterThan(40);
  });
});
