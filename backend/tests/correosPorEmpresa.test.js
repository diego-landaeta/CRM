import { describe, it, expect, vi, beforeEach } from 'vitest';

// Los correos de dirección por empresa (#270): el «Resumen del día» y el «Reporte
// semanal» de Manuel y de los admin.
//
// Lo que pide la issue y se fija aquí:
//   · una TABLA RESUMEN por empresa arriba del todo, con el total, cuando se
//     reciben varias (Manuel recibe todas);
//   · «Por campus» con TODOS los campus, los parados en gris, y con contactos;
//   · «Por gestora» con quien vende aunque su rol sea admin;
//   · el semanal, lo mismo contra la semana anterior;
//   · un admin con una sola empresa NO recibe la tabla resumen.

// ── Los campus: CEDIA tiene tres (uno parado), ICTESS uno, Academia IA uno sin sociedad.
const CAMPUS = [
  { id: 1, nombre: 'Psiko Aprende', sociedad_id: 10 },
  { id: 2, nombre: 'ISEIH', sociedad_id: 10 },
  { id: 3, nombre: 'Fono Aprende', sociedad_id: 10 },
  { id: 4, nombre: 'ICTESS Campus', sociedad_id: 11 },
  { id: 5, nombre: 'Academia IA', sociedad_id: null },
];
const SOCIEDADES = [{ id: 10, razon_social: 'CEDIA SL' }, { id: 11, razon_social: 'ICTESS SL' }];

// Lo cobrado por campus (suma por los ids que se pidan).
const COBRADO = { 1: 700, 2: 0, 3: 300, 4: 500, 5: 0 };
const suma = (ids, tabla) => ids.reduce((t, id) => t + (tabla[id] || 0), 0);

// Prospectos nuevos y quien los lleva, para `actividadPorGestora`.
// De los 4 de Ana, 3 entraron por formulario y 1 lo dio de alta ella desde WhatsApp.
const LEADS_POR_GESTORA = [{ nombre: 'Ana Gestora', leads: 4, formularios: 3, whatsapp: 1 }, { nombre: 'Luis Inactivo', leads: 0 }];

// Quién vende en cada campus (#203 C, línea «Sin actividad registrada»). Lucía, en
// CEDIA, y Pablo, en ICTESS, no hacen nada hoy; Ana también está en ICTESS.
const COMERCIALES = {
  1: [{ id: 3, nombre: 'Ana Gestora' }, { id: 11, nombre: 'Lucía Quieta' }],
  4: [{ id: 9, nombre: 'Marta ICTESS' }, { id: 3, nombre: 'Ana Gestora' }, { id: 12, nombre: 'Pablo Quieto' }],
};

vi.mock('../src/shared/config/db.js', () => ({
  getClient: vi.fn(),
  query: vi.fn(async (sql, params) => {
    if (sql.includes('FROM user_projects up JOIN projects p')) {
      const ids = params[0] === 7 ? [4] : [];     // el admin de ICTESS solo tiene el 4
      return { rows: CAMPUS.filter((c) => ids.includes(c.id)) };
    }
    if (sql.includes('FROM projects p') && sql.includes('p.active AND NOT COALESCE(p.es_prueba')) return { rows: CAMPUS };
    if (sql.includes('FROM invoice_issuers')) return { rows: SOCIEDADES };
    if (sql.includes('FROM conversion_payments p JOIN conversions c')) return { rows: [{ cobrado: String(suma(params[2], COBRADO)) }] };
    if (sql.includes('FROM leads l JOIN users u ON u.id = l.responsable_id')) return { rows: LEADS_POR_GESTORA };
    // `comercialesDe` (#203 C): quién vende en esos campus.
    if (sql.includes('FROM users u') && sql.includes('gestor_colaboraciones')) {
      const vistas = new Map();
      for (const id of params[0]) for (const c of COMERCIALES[id] || []) vistas.set(c.id, c);
      return { rows: [...vistas.values()] };
    }
    return { rows: [] };
  }),
}));

// Prospectos y ventas del DÍA por campus.
const HOY = { 1: { leads: 5, ventas: 1 }, 2: { leads: 0, ventas: 0 }, 3: { leads: 3, ventas: 0 }, 4: { leads: 2, ventas: 1 }, 5: { leads: 0, ventas: 0 } };
const AYER = { 1: { leads: 4, ventas: 0 }, 2: { leads: 0, ventas: 0 }, 3: { leads: 1, ventas: 0 }, 4: { leads: 2, ventas: 0 }, 5: { leads: 0, ventas: 0 } };
const sumaDia = (ids, d) => ({
  leads: ids.reduce((t, i) => t + (d[i]?.leads || 0), 0),
  ventas: ids.reduce((t, i) => t + (d[i]?.ventas || 0), 0),
});
vi.mock('../src/modules/reports/resumenDelDia.js', () => ({
  resumenDelDia: vi.fn(async ({ projectIds }) => [
    { dia: 'hoy', ...sumaDia(projectIds, HOY), contactados: 0, sin_tocar: 1 },
    { dia: 'ayer', ...sumaDia(projectIds, AYER), contactados: 0, sin_tocar: 0 },
  ]),
}));
vi.mock('../src/modules/proceso/proceso.model.js', () => ({
  resumenDeLaCola: vi.fn(async () => ({ esta_semana: 0, atrasados: 2, hoy: 0, manana: 0 })),
}));

// El semanal: esta semana (12–18/10) y la anterior (05–11/10), por campus.
const SEMANA = { 1: { leads: 20, conv: 4 }, 2: { leads: 0, conv: 0 }, 3: { leads: 0, conv: 0 }, 4: { leads: 9, conv: 2 }, 5: { leads: 0, conv: 0 } };
const ANTERIOR = { 1: { leads: 15, conv: 3 }, 2: { leads: 0, conv: 0 }, 3: { leads: 6, conv: 1 }, 4: { leads: 5, conv: 1 }, 5: { leads: 0, conv: 0 } };
const overview = vi.fn(async ({ projectIds, from }) => {
  const t = from === '2026-10-12' ? SEMANA : ANTERIOR;
  const l = projectIds.reduce((s, i) => s + (t[i]?.leads || 0), 0);
  const c = projectIds.reduce((s, i) => s + (t[i]?.conv || 0), 0);
  return { leads: { total: l, convertido: c }, conversions: { total: c } };
});

const FILA = {
  puesto: 1, de: 1, nombre: 'Ana', leads: 0, ventas: 0, vendido: 0, facturado: 0, pendiente: 0,
  cobrado: 0, cobrado_del_periodo: 0, cobrado_anteriores: 0, cobrado_en_cuotas: 0,
  ventas_anteriores: 0, anteriores_grandes: [], tasa: 0,
};
const contactosPorCampus = vi.fn();
const contactosPorGestora = vi.fn();
const ventasVendedora = vi.fn();
vi.mock('../src/modules/reports/report.model.js', () => ({
  overview: (...a) => overview(...a),
  miPuesto: vi.fn(async () => ({ ...FILA, tabla: [FILA], sin_gestora: FILA, total: FILA })),
  ventasVendedora: (...a) => ventasVendedora(...a),
  contactosPorCampus: (...a) => contactosPorCampus(...a),
  contactosPorGestora: (...a) => contactosPorGestora(...a),
}));

// La actividad por comercial del día (#203, parte C): una gestora de CEDIA y una
// de ICTESS. Ana solo escribió notas en ICTESS: ahí no ocupa fila.
const fila203 = (user_id, comercial, c = {}) => ({
  user_id, comercial, llamadas: 0, whatsapp: 0, whatsapp_texto: 0, whatsapp_voz: 0, correos: 0, notas: 0, personas: 0, toques: 0, ...c,
});
const actividadPorComercial = vi.fn();
vi.mock('../src/modules/mcp/mcp.model.js', () => ({
  actividadPorComercial: (...a) => actividadPorComercial(...a),
}));
function actividadDe({ projectIds }) {
  if (projectIds.includes(4)) {
    return {
      // 3 contactos + 1 nota = los 4 contactos de ICTESS de hoy (CONTACTOS_HOY).
      filas: [fila203(9, 'Marta ICTESS', { llamadas: 1, whatsapp: 1, correos: 1, personas: 2, toques: 3 }), fila203(3, 'Ana Gestora', { notas: 1 })],
      equipo: { llamadas: 1, whatsapp: 1, whatsapp_texto: 0, whatsapp_voz: 0, correos: 1, notas: 1, personas: 2, toques: 3 },
    };
  }
  if (projectIds.includes(1)) {
    return {
      filas: [
        fila203(3, 'Ana Gestora', { llamadas: 2, whatsapp: 3, whatsapp_texto: 5, whatsapp_voz: 2, correos: 1, notas: 1, personas: 4, toques: 6 }),
        fila203(8, 'Diego Admin', { llamadas: 0, whatsapp: 1, correos: 0, notas: 1, personas: 1, toques: 1 }),
      ],
      equipo: { llamadas: 2, whatsapp: 4, whatsapp_texto: 5, whatsapp_voz: 2, correos: 1, notas: 2, personas: 4, toques: 7 },
    };
  }
  return { filas: [], equipo: { llamadas: 0, whatsapp: 0, whatsapp_texto: 0, whatsapp_voz: 0, correos: 0, notas: 0, personas: 0, toques: 0 } };
}

const C = await import('../src/jobs/correosDelEquipo.js');

const MANUEL = { id: 1, role: 'superadmin', nombre: 'Manuel' };
const ADMIN_ICTESS = { id: 7, role: 'admin', nombre: 'Antonio' };
const LUNES = new Date('2026-10-19T09:00:00');
const sinEtiquetas = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/**
 * El HTML de la fila de DATOS (`<tr>` con celdas de cifras) que contiene ese texto.
 * Las cabeceras de empresa también nombran a los campus, y no son la fila.
 */
const filaCon = (html, texto) => (html.match(/<tr>.*?<\/tr>/gs) || [])
  .find((f) => f.includes(texto) && f.includes('text-align:right')) || '';
const GRIS_PARADO = 'color:#9ca3af';

// Contactos del día por campus (los de ISEIH, cero: no sale en la lista) y del rango.
const CONTACTOS_HOY = { 1: 7, 3: 2, 4: 4 };
const CONTACTOS_SEMANA = { 1: 30, 3: 0, 4: 12 };
const CONTACTOS_ANTERIOR = { 1: 25, 3: 8, 4: 10 };
const listaContactos = (tabla, ids) => ids.filter((i) => tabla[i]).map((i) => ({ project_id: i, contactos: tabla[i], personas: 1 }));

beforeEach(() => {
  overview.mockClear();
  actividadPorComercial.mockReset().mockImplementation(async (a) => actividadDe(a));
  contactosPorCampus.mockReset().mockImplementation(async ({ projectIds, from }) => {
    const tabla = from === '2026-10-19' ? CONTACTOS_HOY : from === '2026-10-12' ? CONTACTOS_SEMANA : CONTACTOS_ANTERIOR;
    return listaContactos(tabla, projectIds);
  });
  contactosPorGestora.mockReset().mockResolvedValue([
    { user_id: 3, nombre: 'Ana Gestora', contactos: 9 },
    { user_id: 8, nombre: 'Diego Admin', contactos: 3 },        // rol admin, pero lleva prospectos
  ]);
  ventasVendedora.mockReset().mockResolvedValue([
    { vendedora: 'Ana Gestora', ventas: 1 },
    { vendedora: 'Diego Admin', ventas: 2 },                    // vende sin ser gestor
    { vendedora: 'Sin asignar', ventas: 1 },
  ]);
});

describe('las piezas sueltas', () => {
  it('la tabla resumen solo sale con DOS empresas o más', () => {
    expect(C.tablaResumenPorEmpresa([])).toBe('');
    expect(C.tablaResumenPorEmpresa([{ nombre: 'Una', leads: 1, contactos: 1, ventas: 1, cobrado: 1 }])).toBe('');
  });

  it('suma el total de todas las empresas', () => {
    const t = sinEtiquetas(C.tablaResumenPorEmpresa([
      { nombre: 'A', leads: 8, contactos: 9, ventas: 1, cobrado: 1000 },
      { nombre: 'B', leads: 2, contactos: 4, ventas: 1, cobrado: 500 },
    ]));
    expect(t).toMatch(/Total 10 13 2 1500\s€/);
  });

  it('escapa lo que viene de la base: un nombre de empresa con HTML no se cuela', () => {
    const t = C.tablaResumenPorEmpresa([
      { nombre: '<img src=x onerror=alert(1)>', leads: 1, contactos: 0, ventas: 0, cobrado: 0 },
      { nombre: 'B', leads: 0, contactos: 0, ventas: 0, cobrado: 0 },
    ]);
    expect(t).not.toContain('<img src=x');
    expect(t).toContain('&lt;img');
    expect(C.tablaPorCampus([{ nombre: '<b>x</b>', ahora: { leads: 1, contactos: 0, ventas: 0 } }])).not.toContain('<b>x</b>');
  });

  it('un campus sin movimiento va en gris, y uno con movimiento no', () => {
    const html = C.tablaPorCampus([
      { nombre: 'Parado', ahora: { leads: 0, contactos: 0, ventas: 0 } },
      { nombre: 'Vivo', ahora: { leads: 1, contactos: 0, ventas: 0 } },
    ]);
    expect(filaCon(html, 'Parado')).toContain(GRIS_PARADO);
    expect(filaCon(html, 'Vivo')).not.toContain(GRIS_PARADO);
  });

  it('el correo cabe en un móvil de 360 px (#203 C)', () => {
    const h = C.envoltorio({ preTitulo: 'X', titulo: 'Y', contenido: 'Z' });
    expect(h).toMatch(/<style>@media only screen and \(max-width:420px\)\{\.crm-marco\{[^}]+\}\.crm-caja\{padding:20px 16px 24px !important\}[^<]*\}<\/style>/);
    expect(h).toContain('class="crm-marco"');
    expect(h).toContain('class="crm-caja"');
    // Los estilos en línea siguen siendo la base, por si un cliente se come el <style>.
    expect(h).toContain('padding:26px 28px 30px');
  });

  it('una tabla que no cabe se desliza ella, no el correo entero (el ranking del semanal)', () => {
    const t = C.tabla(['A', 'B'], [['x', '1']]);
    expect(t).toMatch(/^<div style="overflow-x:auto;[^"]*max-width:100%"><table /);
    expect(t).toMatch(/<\/table><\/div>$/);
    const h = C.envoltorio({ preTitulo: 'X', titulo: 'Y', contenido: 'Z' });
    // Sin ancho fijo, la tabla del correo se estira con lo de dentro y el contenedor no desliza.
    expect(h).toContain('max-width:600px;table-layout:fixed');
    // El pie, en el gris de los textos (antes #8a939e: poco contraste sobre el fondo).
    expect(h).not.toContain('#8a939e');
  });

  it('«Resumen por empresa», compacta y sin mayúsculas (era la que ensanchaba el correo)', () => {
    const t = C.tablaResumenPorEmpresa([
      { nombre: 'A', leads: 1, contactos: 1, ventas: 1, cobrado: 1 },
      { nombre: 'B', leads: 0, contactos: 0, ventas: 0, cobrado: 0 },
    ]);
    expect(t).not.toContain('uppercase');
    expect(t).toContain('padding:6px 4px');
  });

  it('el ranking avisa en el móvil de que se desliza (la pista solo la enciende la regla del móvil)', async () => {
    const { html } = await C.correoSemanalDireccion(MANUEL, LUNES);
    expect(html).toContain('<div class="crm-pista" style="display:none;mso-hide:all;');
    expect(html).toContain('Desliza la tabla para ver todas las columnas');
    // Hasta 560 px: entre 421 y 550 la tabla ya se desliza (iPhone Plus / Pro Max).
    expect(html).toContain('@media only screen and (max-width:560px){.crm-pista{display:block !important}}');
  });

  it('el semanal: «Por gestora» compacta y el ranking sin mayúsculas', async () => {
    const { html } = await C.correoSemanalDireccion(MANUEL, LUNES);
    const desde = html.indexOf('Por gestora · prospectos');
    expect(desde).toBeGreaterThan(-1);
    expect(html.slice(desde, html.indexOf('</table>', desde))).not.toContain('uppercase');
    const ranking = html.indexOf('Ranking de la semana');
    expect(html.slice(ranking, html.indexOf('</table>', ranking))).not.toContain('uppercase');
  });

  it('en modo oscuro el correo se declara claro: nadie le inventa colores a medias (#203 C)', () => {
    const h = C.envoltorio({ preTitulo: 'X', titulo: 'Y', contenido: 'Z' });
    expect(h).toContain('<meta name="color-scheme" content="light">');
    expect(h).toContain('<meta name="supported-color-schemes" content="light">');
    // Ninguna paleta oscura: este envoltorio lo usan también los correos de las
    // gestoras, y una a medias dejaba texto oscuro sobre fondo oscuro.
    expect(h).not.toContain('prefers-color-scheme');
    expect(h).toContain('<meta charset="utf-8">');
  });

  it('«Por gestora» del día, compacta y sin mayúsculas (si no, no cabe en el móvil)', async () => {
    const { html } = await C.correoDiarioDireccion(MANUEL, LUNES);
    const porGestora = html.slice(html.indexOf('>Por gestora<'), html.indexOf('Actividad por comercial'));
    expect(porGestora).toContain('<th');
    expect(porGestora).not.toContain('uppercase');
  });

  it('«Sin gestora» sale en cursiva y gris', () => {
    const f = C.filaDeGestora({ nombre: 'Sin asignar', sinGestora: true, leads: 0, contactos: 0, ventas: 1 });
    expect(f.celdas[0]).toContain('<em>Sin gestora</em>');
    expect(f.estilo).toContain('color:');
  });
});

describe('Resumen del día · Manuel (superadmin, todas las empresas)', () => {
  it('lleva la tabla resumen ARRIBA, antes de la primera empresa', async () => {
    const { html } = await C.correoDiarioDireccion(MANUEL, LUNES);
    const t = sinEtiquetas(html);
    const resumen = t.indexOf('Resumen por empresa');
    expect(resumen).toBeGreaterThan(-1);
    expect(resumen).toBeLessThan(t.indexOf('Prospectos nuevos'));
  });

  it('con una línea por empresa y el total de todas', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(MANUEL, LUNES)).html);
    // CEDIA: 5+0+3 prospectos, 7+2 contactos, 1 venta, 1000 €. ICTESS: 2, 4, 1, 500 €.
    expect(t).toMatch(/CEDIA SL 8 9 1 1000\s€/);
    expect(t).toMatch(/ICTESS SL 2 4 1 500\s€/);
    expect(t).toMatch(/Academia IA 0 0 0 0\s€/);
    expect(t).toMatch(/Total 10 13 2 1500\s€/);
    expect(t).toContain('Cobrado hoy');
  });

  it('recibe TODAS las empresas, también la que no tiene sociedad', async () => {
    const r = await C.correoDiarioDireccion(MANUEL, LUNES);
    expect(r.asunto).toContain('3 empresas');
    const t = sinEtiquetas(r.html);
    for (const nombre of ['CEDIA SL', 'ICTESS SL', 'Academia IA']) expect(t).toContain(nombre);
  });

  it('«Por campus» lleva TODOS los campus y los contactos', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(MANUEL, LUNES)).html);
    expect(t).toMatch(/Campus Prospectos Contactos Ventas/);
    expect(t).toMatch(/Psiko Aprende 5 7 1/);
    expect(t).toMatch(/Fono Aprende 3 2 0/);
    // El parado también sale, con ceros.
    expect(t).toMatch(/ISEIH 0 0 0/);
  });

  it('el campus parado va en gris', async () => {
    const { html } = await C.correoDiarioDireccion(MANUEL, LUNES);
    expect(filaCon(html, 'ISEIH')).toContain(GRIS_PARADO);
    expect(filaCon(html, 'Psiko Aprende')).not.toContain(GRIS_PARADO);
  });

  it('«Por gestora» incluye a quien vende siendo admin, y las ventas sin gestora', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(MANUEL, LUNES)).html);
    expect(t).toMatch(/Gestora Prospectos Contactos Ventas/);
    // Debajo del total, de dónde llegaron (Diego, 29/10).
    expect(t).toMatch(/Ana Gestora 4 3 formulario 1 WhatsApp 9 1/);
    expect(t).toMatch(/Diego Admin 0 3 2/);
    expect(t).toMatch(/Sin gestora 0 0 1/);
  });

  it('quien no ha hecho nada hoy no ocupa una fila', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(MANUEL, LUNES)).html);
    expect(t).not.toContain('Luis Inactivo');
  });

  it('pide los contactos de HOY, de todos los campus de cada empresa', async () => {
    await C.correoDiarioDireccion(MANUEL, LUNES);
    const llamadas = contactosPorCampus.mock.calls.map(([a]) => a);
    expect(llamadas.some((a) => a.from === '2026-10-19' && a.to === '2026-10-19'
      && [...a.projectIds].sort().join() === '1,2,3')).toBe(true);
    expect(contactosPorGestora.mock.calls.every(([a]) => a.from === '2026-10-19' && a.to === '2026-10-19')).toBe(true);
  });
});

describe('Resumen del día · actividad por comercial (#203, parte C)', () => {
  it('la pide para el día de hoy, con los campus de CADA empresa', async () => {
    await C.correoDiarioDireccion(MANUEL, LUNES);
    const pedidas = actividadPorComercial.mock.calls.map(([a]) => [...a.projectIds].sort().join());
    expect(pedidas.sort()).toEqual(['1,2,3', '4', '5']);
    expect(actividadPorComercial.mock.calls.every(([a]) => a.desde === '2026-10-19' && a.hasta === '2026-10-19')).toBe(true);
  });

  it('una fila por comercial y la del equipo, con escritos y voz debajo del WhatsApp', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(MANUEL, LUNES)).html);
    expect(t).toMatch(/Comercial Llamadas registradas WhatsApp Correos Personas Total/);
    expect(t).toMatch(/Ana Gestora 2 3 5 escritos · 2 de voz 1 4 6/);
    expect(t).toMatch(/Diego Admin 0 1 0 1 1/);
    expect(t).toMatch(/Equipo 2 4 5 escritos · 2 de voz 1 4 7/);
  });

  it('las filas más las notas dan los contactos del día del propio resumen', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(MANUEL, LUNES)).html);
    // CEDIA: 6 + 1 = 7 contactos, más 2 notas = los 9 de «Resumen por empresa».
    expect(t).toMatch(/CEDIA SL 8 9 1/);
    expect(t).toContain('7 contactos y 2 notas suman los 9 contactos del día');
    // ICTESS: 3 + 1 nota = 4.
    expect(t).toMatch(/ICTESS SL 2 4 1/);
    expect(t).toContain('3 contactos y 1 nota suman los 4 contactos del día');
  });

  it('quien solo escribió notas no ocupa una fila: va en la línea de debajo', async () => {
    const r = await C.correoDiarioDireccion(ADMIN_ICTESS, LUNES);
    const t = sinEtiquetas(r.html);
    expect(t).toMatch(/Marta ICTESS 1 1 1 2 3/);
    const laTabla = t.slice(t.indexOf('Actividad por comercial'), t.indexOf('Sin actividad registrada'));
    expect(laTabla).not.toContain('Ana Gestora');
    expect(t).toContain('Sin actividad registrada en esta empresa: Ana Gestora (solo notas internas), Pablo Quieto.');
  });

  it('«Sin actividad registrada»: las comerciales de la empresa sin ningún contacto hoy (ideas de Diego, 01/10)', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(MANUEL, LUNES)).html);
    // CEDIA: Ana tiene fila; Lucía no ha hecho nada. ICTESS: Ana solo notas y Pablo nada.
    expect(t).toContain('Sin actividad registrada en esta empresa: Lucía Quieta.');
    expect(t).toContain('Sin actividad registrada en esta empresa: Ana Gestora (solo notas internas), Pablo Quieto.');
    // Quien tiene fila no se repite en la línea.
    expect(t).not.toMatch(/Sin actividad registrada en esta empresa:[^.]*Marta ICTESS/);
  });

  it('un admin de una empresa no ve a las comerciales de otra', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(ADMIN_ICTESS, LUNES)).html);
    expect(actividadPorComercial.mock.calls.map(([a]) => a.projectIds)).toEqual([[4]]);
    // (En «Por gestora» sí sale: ese mock no mira la empresa.)
    expect(t.slice(t.indexOf('Actividad por comercial'))).not.toContain('Diego Admin');
    // Ni en la línea de las que no han hecho nada.
    expect(t).not.toContain('Lucía Quieta');
  });

  it('sin actividad pero con comerciales: el título y la línea, sin tabla', () => {
    const html = C.tablaActividadPorComercial({ filas: [], equipo: {} }, 0, [{ id: 1, nombre: 'Eva' }, { id: 2, nombre: '<b>Rosa</b>' }]);
    const t = sinEtiquetas(html);
    expect(t).toContain('Actividad por comercial');
    expect(t).toContain('Sin actividad registrada en esta empresa: Eva, &lt;b&gt;Rosa&lt;/b&gt;.');
    expect(html).not.toContain('<table');
  });

  it('quien no está disponible ese día se dice, para que no parezca que no hizo nada', () => {
    const html = C.tablaActividadPorComercial({ filas: [], equipo: {} }, 0, [{ id: 1, nombre: 'Eva', noDisponible: true }]);
    expect(sinEtiquetas(html)).toContain('Sin actividad registrada en esta empresa: Eva (no disponible).');
  });

  it('pide quién vende con el día del resumen (para saber quién está de vacaciones)', async () => {
    const { query } = await import('../src/shared/config/db.js');
    query.mockClear();
    await C.correoDiarioDireccion(ADMIN_ICTESS, LUNES);
    const pedida = query.mock.calls.find(([sql]) => sql.includes('gestor_colaboraciones'));
    expect(pedida[1]).toEqual([[4], '2026-10-19']);
  });

  it('todas con actividad: no hay línea', () => {
    const html = C.tablaActividadPorComercial({
      filas: [fila203(1, 'Eva', { llamadas: 1, toques: 1, personas: 1 })],
      equipo: { llamadas: 1, whatsapp: 0, whatsapp_texto: 0, whatsapp_voz: 0, correos: 0, notas: 0, personas: 1, toques: 1 },
    }, 1, [{ id: 1, nombre: 'Eva' }]);
    expect(html).not.toContain('Sin actividad registrada');
  });

  it('sin actividad, no hay tabla', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(MANUEL, LUNES)).html);
    // Academia IA no tiene actividad: solo dos tablas, la de CEDIA y la de ICTESS.
    expect(t.split('Actividad por comercial').length - 1).toBe(2);
  });

  it('«Sin asignar» (WhatsApp sin autora) va al final, en cursiva y gris', () => {
    const html = C.tablaActividadPorComercial({
      filas: [
        fila203(null, 'Sin asignar', { whatsapp_texto: 2 }),
        fila203(1, 'Eva', { llamadas: 1, toques: 1, personas: 1 }),
      ],
      equipo: { llamadas: 1, whatsapp: 0, whatsapp_texto: 2, whatsapp_voz: 0, correos: 0, notas: 0, personas: 1, toques: 1 },
    }, 1);
    const filas = html.match(/<tr>.*?<\/tr>/gs);
    // Cabecera, Eva, Sin asignar, Equipo.
    expect(filas[1]).toContain('Eva');
    expect(filas[2]).toContain('<em>Sin asignar</em>');
    expect(filas[2]).toContain(`color:${'#5b6572'}`);
    expect(filas[1]).not.toContain('<em>');
  });

  it('«escritos · de voz» puede partirse en el móvil', () => {
    const html = C.tablaActividadPorComercial({
      filas: [fila203(1, 'Eva', { whatsapp: 1, whatsapp_texto: 3, whatsapp_voz: 1, toques: 1, personas: 1 })],
      equipo: { llamadas: 0, whatsapp: 1, whatsapp_texto: 3, whatsapp_voz: 1, correos: 0, notas: 0, personas: 1, toques: 1 },
    }, 1);
    expect(html).toMatch(/white-space:normal">3 escritos · 1 de voz/);
  });

  it('«1 escrito», en singular', () => {
    const html = C.tablaActividadPorComercial({
      filas: [fila203(1, 'Eva', { whatsapp: 1, whatsapp_texto: 1, toques: 1, personas: 1 })],
      equipo: { llamadas: 0, whatsapp: 1, whatsapp_texto: 1, whatsapp_voz: 0, correos: 0, notas: 0, personas: 1, toques: 1 },
    }, 1);
    expect(html).toContain('1 escrito · 0 de voz');
  });

  it('sus cabeceras van en letra normal (en mayúsculas no caben en el móvil); las demás tablas, igual que antes', () => {
    const html = C.tablaActividadPorComercial({
      filas: [fila203(1, 'Eva', { llamadas: 1, toques: 1, personas: 1 })],
      equipo: { llamadas: 1, whatsapp: 0, whatsapp_texto: 0, whatsapp_voz: 0, correos: 0, notas: 0, personas: 1, toques: 1 },
    }, 1);
    const ths = html.match(/<th [^>]*>/g);
    expect(ths).toHaveLength(6);
    for (const th of ths) expect(th).not.toContain('uppercase');
    expect(C.tabla(['Gestora', 'Ventas'], [['Ana', '1']])).toContain('text-transform:uppercase');
  });

  it('escapa el nombre de la comercial', () => {
    const html = C.tablaActividadPorComercial({
      filas: [fila203(1, '<b>Eva</b>', { llamadas: 1, toques: 1, personas: 1 })],
      equipo: { llamadas: 1, whatsapp: 0, whatsapp_texto: 0, whatsapp_voz: 0, correos: 0, notas: 0, personas: 1, toques: 1 },
    }, 1);
    expect(html).toContain('&lt;b&gt;Eva&lt;/b&gt;');
    expect(html).not.toContain('notas suman');
  });
});

describe('Resumen del día · un admin con UNA empresa', () => {
  it('no recibe la tabla resumen: no hay nada que resumir', async () => {
    const r = await C.correoDiarioDireccion(ADMIN_ICTESS, LUNES);
    const t = sinEtiquetas(r.html);
    expect(t).not.toContain('Resumen por empresa');
    expect(t).toContain('ICTESS');
    // Ni de otras empresas.
    expect(t).not.toContain('CEDIA SL');
    expect(r.asunto).not.toContain('empresas');
  });

  it('y con un solo campus no hay «Por campus» (sería repetir la empresa)', async () => {
    const t = sinEtiquetas((await C.correoDiarioDireccion(ADMIN_ICTESS, LUNES)).html);
    expect(t).not.toContain('Por campus');
  });
});

describe('Reporte semanal · Manuel', () => {
  it('lleva la tabla resumen, con «Cobrado» (no «Cobrado hoy») y el total', async () => {
    const t = sinEtiquetas((await C.correoSemanalDireccion(MANUEL, LUNES)).html);
    expect(t).toContain('Resumen por empresa');
    expect(t).not.toContain('Cobrado hoy');
    // CEDIA: 20 prospectos, 30 contactos, 4 ventas, 1000 €. ICTESS: 9, 12, 2, 500 €.
    expect(t).toMatch(/CEDIA SL 20 30 4 1000\s€/);
    expect(t).toMatch(/ICTESS SL 9 12 2 500\s€/);
    expect(t).toMatch(/Total 29 42 6 1500\s€/);
  });

  it('«Por campus» lleva la semana anterior al lado de cada cifra', async () => {
    const t = sinEtiquetas((await C.correoSemanalDireccion(MANUEL, LUNES)).html);
    // Psiko: 20 (ant. 15) prospectos, 30 (ant. 25) contactos, 4 (ant. 3) ventas.
    expect(t).toMatch(/Psiko Aprende 20 \(ant\. 15\) 30 \(ant\. 25\) 4 \(ant\. 3\)/);
  });

  it('un campus que esta semana no se movió sale en gris, y dice lo que hizo la anterior', async () => {
    const { html } = await C.correoSemanalDireccion(MANUEL, LUNES);
    const fono = filaCon(html, 'Fono Aprende');
    expect(fono).toContain(GRIS_PARADO);
    expect(sinEtiquetas(fono)).toMatch(/Fono Aprende 0 \(ant\. 6\) 0 \(ant\. 8\) 0 \(ant\. 1\)/);
    // Y el que está parado las dos semanas, también.
    expect(filaCon(html, 'ISEIH')).toContain(GRIS_PARADO);
  });

  it('«Por gestora» de la semana incluye a quien vende siendo admin', async () => {
    const t = sinEtiquetas((await C.correoSemanalDireccion(MANUEL, LUNES)).html);
    expect(t).toContain('Por gestora · prospectos, contactos y ventas de la semana');
    expect(t).toMatch(/Diego Admin 0 3 2/);
  });

  it('pide los contactos de las dos semanas', async () => {
    await C.correoSemanalDireccion(MANUEL, LUNES);
    const rangos = contactosPorCampus.mock.calls.map(([a]) => `${a.from}..${a.to}`);
    expect(rangos).toContain('2026-10-12..2026-10-18');
    expect(rangos).toContain('2026-10-05..2026-10-11');
  });

  it('el ranking de siempre sigue donde estaba', async () => {
    const t = sinEtiquetas((await C.correoSemanalDireccion(MANUEL, LUNES)).html);
    expect(t).toContain('Ranking de la semana · por lo cobrado');
  });
});

describe('Reporte semanal · un admin con UNA empresa', () => {
  it('no recibe la tabla resumen ni los campus de otras empresas', async () => {
    const t = sinEtiquetas((await C.correoSemanalDireccion(ADMIN_ICTESS, LUNES)).html);
    expect(t).not.toContain('Resumen por empresa');
    expect(t).not.toContain('CEDIA SL');
    expect(t).not.toContain('Psiko Aprende');
  });
});
