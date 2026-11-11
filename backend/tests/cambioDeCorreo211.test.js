import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pool from '../src/shared/config/db.js';
import { pedirCodigo, confirmarCodigo, nuevoCodigo, INTENTOS } from '../src/modules/users/cambio-de-correo.js';

/**
 * #211 · Cambiar el correo con un código a la dirección nueva.
 *
 * El mecanismo: pedir el código (va a la dirección NUEVA y no cambia nada),
 * confirmarlo (con el bueno cambia; con el malo suma un intento; al quinto se
 * anula), que caduque, que una petición nueva anule la anterior, y que quede en
 * el registro. Quién puede usarlo está pendiente de Diego (#211, 05/11).
 *
 * Contra la base real. El correo no sale: se le pasa un `enviar` que guarda el
 * código, para poder meterlo como lo haría la persona.
 */

const MARCA = `C211${Date.now().toString(36)}`;
const q = (sql, p) => pool.query(sql, p).then((r) => r.rows);
const one = async (sql, p) => (await q(sql, p))[0];
const ids = { users: [] };
let ANA; let OTRA;
let enviado = null;
const enviar = async (m) => { enviado = m; return { sent: true }; };
const correoDe = async (id) => (await one('SELECT email FROM users WHERE id = $1', [id])).email;

beforeAll(async () => {
  const persona = async (n) => {
    const u = await one(`INSERT INTO users (nombre, email, password_hash, role) VALUES ($1, $2, 'x', 'gestor') RETURNING id`,
      [`${MARCA} ${n}`, `${n}@${MARCA.toLowerCase()}.test`]);
    ids.users.push(u.id);
    return u.id;
  };
  ANA = await persona('ana'); OTRA = await persona('otra');
}, 60000);

beforeEach(async () => {
  enviado = null;
  await q(`UPDATE users SET email = $2 WHERE id = $1`, [ANA, `ana@${MARCA.toLowerCase()}.test`]);
  await q('DELETE FROM cambios_de_correo WHERE user_id = $1', [ANA]);
});

afterAll(async () => {
  await q('DELETE FROM cambios_de_correo WHERE user_id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM user_activity_log WHERE user_id = ANY($1::int[])', [ids.users]);
  await q('DELETE FROM refresh_tokens WHERE user_id = ANY($1::int[])', [ids.users]).catch(() => {});
  await q('DELETE FROM users WHERE id = ANY($1::int[])', [ids.users]);
  await pool.end();
});

const NUEVO = () => `ana.nueva@${MARCA.toLowerCase()}.test`;

describe('#211 · el código', () => {
  it('son seis cifras, también con ceros delante', () => {
    for (let i = 0; i < 50; i++) expect(nuevoCodigo()).toMatch(/^\d{6}$/);
  });

  it('pedirlo manda el código a la dirección NUEVA y todavía no cambia nada', async () => {
    const r = await pedirCodigo({ userId: ANA, emailNuevo: NUEVO(), enviar });
    expect(r.enviado).toBe(true);
    expect(enviado.a).toBe(NUEVO());
    expect(enviado.codigo).toMatch(/^\d{6}$/);
    expect(await correoDe(ANA)).toBe(`ana@${MARCA.toLowerCase()}.test`);
    // Solo se guarda el hash, nunca el código.
    const fila = await one('SELECT codigo_hash FROM cambios_de_correo WHERE user_id = $1', [ANA]);
    expect(fila.codigo_hash).not.toContain(enviado.codigo);
  });

  it('con el código bueno, el correo cambia y queda en el registro', async () => {
    await pedirCodigo({ userId: ANA, emailNuevo: NUEVO(), enviar });
    const r = await confirmarCodigo({ userId: ANA, codigo: enviado.codigo });
    expect(r.cambiado).toBe(true);
    expect(await correoDe(ANA)).toBe(NUEVO());
    const acciones = (await q(`SELECT action FROM user_activity_log WHERE user_id = $1 ORDER BY id`, [ANA])).map((x) => x.action);
    expect(acciones).toEqual(expect.arrayContaining(['usuario.pedir_cambio_correo', 'usuario.cambiar_correo', 'usuario.confirmar_cambio_correo']));
  });

  it('con uno malo no cambia y avisa de cuántos intentos quedan; al quinto, se anula', async () => {
    await pedirCodigo({ userId: ANA, emailNuevo: NUEVO(), enviar });
    const malo = enviado.codigo === '000000' ? '111111' : '000000';
    for (let i = 1; i < INTENTOS; i++) {
      await expect(confirmarCodigo({ userId: ANA, codigo: malo })).rejects.toMatchObject({ code: 'CODIGO_INCORRECTO' });
    }
    await expect(confirmarCodigo({ userId: ANA, codigo: malo })).rejects.toMatchObject({ code: 'DEMASIADOS_INTENTOS' });
    // Ni el bueno vale ya: hay que pedir otro.
    await expect(confirmarCodigo({ userId: ANA, codigo: enviado.codigo })).rejects.toMatchObject({ code: 'SIN_CODIGO' });
    expect(await correoDe(ANA)).toBe(`ana@${MARCA.toLowerCase()}.test`);
  });

  it('caduca: pasado el plazo no vale', async () => {
    await pedirCodigo({ userId: ANA, emailNuevo: NUEVO(), enviar });
    await q(`UPDATE cambios_de_correo SET expira_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1`, [ANA]);
    await expect(confirmarCodigo({ userId: ANA, codigo: enviado.codigo })).rejects.toMatchObject({ code: 'CODIGO_CADUCADO' });
  });

  it('una petición nueva anula la anterior: solo vale el último código', async () => {
    await pedirCodigo({ userId: ANA, emailNuevo: NUEVO(), enviar });
    const primero = enviado.codigo;
    await pedirCodigo({ userId: ANA, emailNuevo: `otra.direccion@${MARCA.toLowerCase()}.test`, enviar });
    const segundo = enviado.codigo;
    if (primero !== segundo) {
      await expect(confirmarCodigo({ userId: ANA, codigo: primero })).rejects.toMatchObject({ code: 'CODIGO_INCORRECTO' });
    }
    await confirmarCodigo({ userId: ANA, codigo: segundo });
    expect(await correoDe(ANA)).toBe(`otra.direccion@${MARCA.toLowerCase()}.test`);
  });

  it('no se pide para el mismo correo ni para uno que ya usa otra persona', async () => {
    await expect(pedirCodigo({ userId: ANA, emailNuevo: `ana@${MARCA.toLowerCase()}.test`, enviar })).rejects.toMatchObject({ code: 'MISMO_CORREO' });
    await expect(pedirCodigo({ userId: ANA, emailNuevo: `OTRA@${MARCA.toLowerCase()}.test`, enviar })).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
    expect(enviado).toBeNull();
  });

  // Revisión de Diego (#688, 05/11): el intento se cuenta en una sola sentencia.
  it('a la vez, 20 intentos con códigos malos no pasan de 5: el resto ya no compara', async () => {
    await pedirCodigo({ userId: ANA, emailNuevo: NUEVO(), enviar });
    const bueno = enviado.codigo;
    // Veinte códigos malos, distintos del bueno, todos a la vez.
    const malos = [];
    for (let n = 0; malos.length < 20; n++) { const c = String(n).padStart(6, '0'); if (c !== bueno) malos.push(c); }
    const r = await Promise.allSettled(malos.map((c) => confirmarCodigo({ userId: ANA, codigo: c })));
    const codigos = r.map((x) => x.reason?.code);
    // Solo 5 llegan a comparar (4 «incorrecto» y el quinto anula); el resto, sin intentos.
    expect(codigos.filter((c) => c === 'CODIGO_INCORRECTO').length).toBeLessThanOrEqual(INTENTOS - 1);
    expect(codigos.every((c) => ['CODIGO_INCORRECTO', 'DEMASIADOS_INTENTOS', 'SIN_CODIGO'].includes(c))).toBe(true);
    const fila = await one('SELECT intentos, anulado_at FROM cambios_de_correo WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [ANA]);
    expect(fila.intentos).toBe(INTENTOS);
    expect(fila.anulado_at).not.toBeNull();
    // Y ni el bueno vale ya.
    await expect(confirmarCodigo({ userId: ANA, codigo: bueno })).rejects.toMatchObject({ code: 'SIN_CODIGO' });
    expect(await correoDe(ANA)).toBe(`ana@${MARCA.toLowerCase()}.test`);
  });

  it('con el bueno dos veces a la vez, cambia una sola', async () => {
    await pedirCodigo({ userId: ANA, emailNuevo: NUEVO(), enviar });
    const r = await Promise.allSettled([1, 2].map(() => confirmarCodigo({ userId: ANA, codigo: enviado.codigo })));
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await correoDe(ANA)).toBe(NUEVO());
  });

  it('si el cambio falla (el correo lo ha cogido otra persona), la petición no queda viva', async () => {
    await pedirCodigo({ userId: ANA, emailNuevo: NUEVO(), enviar });
    // Entre pedir el código y meterlo, otra persona se queda con ese correo.
    await q('UPDATE users SET email = $2 WHERE id = $1', [OTRA, NUEVO()]);
    try {
      await expect(confirmarCodigo({ userId: ANA, codigo: enviado.codigo })).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
      const fila = await one('SELECT confirmado_at, anulado_at FROM cambios_de_correo WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [ANA]);
      expect(fila.confirmado_at).toBeNull();
      expect(fila.anulado_at).not.toBeNull();
    } finally {
      await q('UPDATE users SET email = $2 WHERE id = $1', [OTRA, `otra@${MARCA.toLowerCase()}.test`]);
    }
  });
});
