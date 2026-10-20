import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Lo comercial del día a día en el MCP (#325), contra la base de verdad.
 *
 * Las seis consultas nuevas del tipo «informe» (dashboard_hoy, cola_del_dia,
 * seguimiento_fin_de_mes, feedback, pendientes_de_facturar, metas_gestoras) son las
 * MISMAS funciones que las pantallas. Aquí se comprueba lo que un test con la
 * base grabada no puede: que la consulta SQL funciona de verdad, que las cifras
 * son las del campus de quien pregunta, que una gestora solo ve lo suyo y que
 * lo de administración se le niega.
 *
 *   npx vitest run tests/mcpInformesComerciales.test.js
 */

const { default: pool } = await import('../src/shared/config/db.js');
const { HERRAMIENTAS, INFORMES } = await import('../src/modules/mcp/mcp.tools.js');
const { construirAmbito } = await import('../src/modules/mcp/mcp.acceso.js');
const { protegerDatos } = await import('../src/modules/mcp/mcp.privacidad.js');

const MARCA = `MCC${Date.now().toString(36)}`;
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const ids = { users: [], projects: [], leads: [], conversions: [] };
let P; let OTRO; let ADMIN; let LAURA; let ANA;
const informe = HERRAMIENTAS.find((h) => h.nombre === 'informe');

const ambito = (u, campus) => construirAmbito(
  { id: u.id, nombre: u.nombre, role: u.role, active: true, usa_mcp: true },
  campus.map((c) => ({ id: c, nombre: `c${c}`, sociedad_id: null, sociedad_nombre: null }))
);
const ver = (u, tipo, extra = {}, campus = [P]) => informe.ejecutar(ambito(u, campus), { tipo, ...extra });

async function persona(nombre, role) {
  const [u] = await q(
    `INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', $3) RETURNING id, role, nombre`,
    [`${MARCA} ${nombre}`, `${nombre.toLowerCase()}@${MARCA.toLowerCase()}.test`, role]
  );
  ids.users.push(u.id);
  return u;
}
async function lead(nombre, { responsable = null, proyecto = P, dias = 0 }) {
  const [l] = await q(
    `INSERT INTO leads (project_id, nombre, responsable_id, created_at, fecha_solicitud)
     VALUES ($1, $2, $3, now() - ($4 || ' days')::interval, now() - ($4 || ' days')::interval) RETURNING id`,
    [proyecto, `${MARCA} ${nombre}`, responsable, String(dias)]
  );
  ids.leads.push(l.id);
  return l.id;
}

beforeAll(async () => {
  const proy = async (c) => {
    const [p] = await q(`INSERT INTO projects (nombre, slug, webhook_api_key) VALUES ($1, $2, $3) RETURNING id`,
      [`${MARCA} ${c}`, `${MARCA.toLowerCase()}-${c}`, `${MARCA}-key-${c}`]);
    ids.projects.push(p.id);
    return p.id;
  };
  P = await proy('a'); OTRO = await proy('b');
  ADMIN = await persona('ADMIN', 'admin');
  LAURA = await persona('LAURA', 'gestor');
  ANA = await persona('ANA', 'gestor');

  // Prospectos de Laura y de Ana en P (antigüedades distintas) y uno en OTRO.
  const l1 = await lead('Marta Ruiz', { responsable: LAURA.id, dias: 2 });
  await lead('Pedro Gil', { responsable: LAURA.id, dias: 40 });
  await lead('Lucía Mora', { responsable: ANA.id, dias: 200 });
  await lead('Otro campus', { responsable: LAURA.id, proyecto: OTRO, dias: 2 });
  await q(`INSERT INTO lead_interactions (lead_id, tipo, nota, created_by) VALUES ($1, 'llamada', 'x', $2)`, [l1, LAURA.id]);

  // Un cobro SIN factura en P y otro en OTRO.
  const venta = async (leadId, proyecto, importe) => {
    const [c] = await q(
      `INSERT INTO conversions (lead_id, project_id, producto_contratado, importe_total, importe_pagado, vendedora_id, fecha_conversion)
       VALUES ($1, $2, 'Máster en Coaching', $3, $3, $4, CURRENT_DATE) RETURNING id`, [leadId, proyecto, importe, LAURA.id]);
    ids.conversions.push(c.id);
    await q(`INSERT INTO conversion_payments (conversion_id, importe, fecha) VALUES ($1, $2, CURRENT_DATE)`, [c.id, importe]);
  };
  await venta(l1, P, 900);
  const lOtro = (await q(`SELECT id FROM leads WHERE nombre = $1`, [`${MARCA} Otro campus`]))[0].id;
  await venta(lOtro, OTRO, 700);
}, 60000);

afterAll(async () => {
  await q(`DELETE FROM conversion_payments WHERE conversion_id = ANY($1::int[])`, [ids.conversions]);
  await q(`DELETE FROM conversions WHERE id = ANY($1::int[])`, [ids.conversions]);
  await q(`DELETE FROM lead_interactions WHERE lead_id = ANY($1::int[])`, [ids.leads]);
  await q(`DELETE FROM leads WHERE id = ANY($1::int[])`, [ids.leads]);
  await q(`DELETE FROM users WHERE id = ANY($1::int[])`, [ids.users]);
  await q(`DELETE FROM projects WHERE id = ANY($1::int[])`, [ids.projects]);
  await pool.end();
}, 60000);

const NUEVOS = ['dashboard_hoy', 'cola_del_dia', 'seguimiento_fin_de_mes', 'feedback', 'pendientes_de_facturar', 'metas_gestoras'];

describe('están, con su descripción, entre los informes de Claude', () => {
  it('cada una figura en el listado de la herramienta «informe»', () => {
    for (const n of NUEVOS) expect(Object.keys(INFORMES)).toContain(n);
    for (const n of NUEVOS) expect(informe.descripcion).toContain(n);
    for (const n of NUEVOS) expect(INFORMES[n].descripcion.length).toBeGreaterThan(20);
  });
});

describe('funcionan de verdad contra la base', () => {
  it('un admin ejecuta las seis sin error', async () => {
    for (const n of NUEVOS) {
      const r = await ver(ADMIN, n);
      expect(r.informe, n).toBe(n);
      expect(r.datos, n).toBeTruthy();
    }
  });

  it('seguimiento_fin_de_mes: solo los prospectos del campus, por antigüedad', async () => {
    const { datos } = await ver(ADMIN, 'seguimiento_fin_de_mes');
    // Marta ya compró, así que no está en seguimiento (como en la pantalla): quedan Pedro (40 días) y Lucía (200).
    expect(datos).toMatchObject({ total: 2, este_mes: 0, uno_a_tres: 1, mas_de_seis: 1 }); // y el de OTRO campus no cuenta
  });

  it('dashboard_hoy: el servidor da las cifras de ayer y hoy del campus', async () => {
    const { datos } = await ver(ADMIN, 'dashboard_hoy');
    const dias = Array.isArray(datos) ? datos : datos.dias;
    expect(Array.isArray(dias)).toBe(true);
    expect(dias.map((d) => d.dia).sort()).toEqual(['ayer', 'hoy']);
  });

  it('cola_del_dia: las cuatro cifras, como números', async () => {
    const { datos } = await ver(ADMIN, 'cola_del_dia');
    for (const k of ['atrasados', 'hoy', 'manana', 'esta_semana']) expect(typeof datos[k], k).toBe('number');
  });

  it('pendientes_de_facturar: el cobro sin factura de SU campus, con el cliente abreviado; el de otro campus no', async () => {
    const r = await ver(ADMIN, 'pendientes_de_facturar', { desde: '2020-01-01' });
    expect(r.datos).toMatchObject({ ventas: 1, importe: 900 });
    const protegido = protegerDatos(r.datos);
    expect(protegido.detalle[0].cliente).toBe(`${MARCA} M.`);
    expect(JSON.stringify(protegido)).not.toContain('Ruiz');
    // Con datos_completos sí sale entero (queda en la auditoría).
    expect(JSON.stringify(protegerDatos(r.datos, { completos: true }))).toContain('Marta Ruiz');
    // El campus ajeno no se puede ni pedir.
    await expect(ver(ADMIN, 'pendientes_de_facturar', { proyecto_id: OTRO })).rejects.toMatchObject({ code: 'MCP_FUERA_DE_AMBITO' });
  });

  it('metas_gestoras y feedback devuelven su estructura', async () => {
    const m = await ver(ADMIN, 'metas_gestoras', { desde: '2020-01-01', hasta: '2030-01-01' });
    expect(m.datos).toBeTruthy();
    const f = await ver(ADMIN, 'feedback', { desde: '2020-01-01' });
    expect(f.datos.totales ?? f.datos).toBeTruthy();
  });
});

describe('una gestora solo ve lo suyo y no lo de administración', () => {
  it('seguimiento_fin_de_mes: solo SUS prospectos', async () => {
    const laura = (await ver(LAURA, 'seguimiento_fin_de_mes')).datos;
    expect(laura.total).toBe(1); // Pedro (Marta ya compró); no Lucía (de Ana) ni el de otro campus
    const ana = (await ver(ANA, 'seguimiento_fin_de_mes')).datos;
    expect(ana.total).toBe(1);
  });

  it('lo de administración se le niega: pendientes_de_facturar y metas_gestoras', async () => {
    for (const n of ['pendientes_de_facturar', 'metas_gestoras']) {
      await expect(ver(LAURA, n)).rejects.toMatchObject({ code: 'MCP_INFORME_SOLO_ADMIN' });
    }
  });

  it('el resto sí le sale, recortado a ella', async () => {
    for (const n of ['dashboard_hoy', 'cola_del_dia', 'feedback']) {
      expect((await ver(LAURA, n)).datos, n).toBeTruthy();
    }
  });
});

// ─── Las mejoras a consultas que ya existían (#325) ───────────────────────

const herr = (n) => HERRAMIENTAS.find((h) => h.nombre === n);
const correr = (n, u, args = {}, campus = [P]) => herr(n).ejecutar(ambito(u, campus), args);

describe('listar_ventas: por vendedora y facturada / sin facturar', () => {
  it('sin filtro, la venta de Laura; el campus ajeno no', async () => {
    const r = await correr('listar_ventas', ADMIN, { pagina: 1, limite: 25 });
    expect(r.total).toBe(1);
    expect(r.ventas[0]).toMatchObject({ importe_total: '900.00' });
  });

  it('por vendedora: Laura la tiene, Ana no', async () => {
    expect((await correr('listar_ventas', ADMIN, { vendedora_id: LAURA.id, pagina: 1, limite: 25 })).total).toBe(1);
    expect((await correr('listar_ventas', ADMIN, { vendedora_id: ANA.id, pagina: 1, limite: 25 })).total).toBe(0);
  });

  it('sin facturar la incluye y facturada no (no hay ninguna factura)', async () => {
    expect((await correr('listar_ventas', ADMIN, { facturada: false, pagina: 1, limite: 25 })).total).toBe(1);
    expect((await correr('listar_ventas', ADMIN, { facturada: true, pagina: 1, limite: 25 })).total).toBe(0);
  });

  it('una gestora ve las suyas y NO puede pedir las de otra', async () => {
    expect((await correr('listar_ventas', LAURA, { pagina: 1, limite: 25 })).total).toBe(1);
    expect((await correr('listar_ventas', ANA, { pagina: 1, limite: 25 })).total).toBe(0);
    await expect(correr('listar_ventas', ANA, { vendedora_id: LAURA.id, pagina: 1, limite: 25 })).rejects.toMatchObject({ code: 'MCP_FUERA_DE_AMBITO' });
    // Pedirse a sí misma sí.
    expect((await correr('listar_ventas', LAURA, { vendedora_id: LAURA.id, pagina: 1, limite: 25 })).total).toBe(1);
  });
});

describe('listar_formaciones: SKU e inactivas', () => {
  beforeAll(async () => {
    await q(`INSERT INTO products (project_id, nombre, sku, active) VALUES ($1, $2, 'SKU-ACT', true), ($1, $3, 'SKU-BAJA', false)`,
      [P, `${MARCA} Activa`, `${MARCA} De baja`]);
  });
  afterAll(async () => { await q(`DELETE FROM products WHERE project_id = ANY($1::int[])`, [ids.projects]); });

  it('por defecto solo las activas, con su SKU', async () => {
    const r = await correr('listar_formaciones', ADMIN, { pagina: 1, limite: 25 });
    expect(r.formaciones.map((f) => f.curso)).toEqual([`${MARCA} Activa`]);
    expect(r.formaciones[0]).toMatchObject({ sku: 'SKU-ACT', activa: true });
  });

  it('con incluir_inactivas, también las dadas de baja, marcadas', async () => {
    const r = await correr('listar_formaciones', ADMIN, { incluir_inactivas: true, pagina: 1, limite: 25 });
    expect(r.total).toBe(2);
    expect(r.formaciones.find((f) => f.sku === 'SKU-BAJA')).toMatchObject({ activa: false });
  });
});

describe('comisiones_tutores: la base de cálculo, en los totales', () => {
  it('los totales traen base además de generado, por pagar, pagado y revertido', async () => {
    const r = await correr('comisiones_tutores', ADMIN, { solo_entregas_pendientes: false });
    expect(Object.keys(r.totales).sort()).toEqual(['base', 'generado', 'pagado', 'por_pagar', 'revertido']);
  });
});
