import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool, { query } from '../src/shared/config/db.js';
import { planificarPasosDeLead, pasosDeLead } from '../src/modules/proceso/proceso.model.js';

/**
 * «Cada correo se avisa por WhatsApp» (#91), CONTRA LA BASE DE VERDAD.
 *
 * La regla vive en SQL —un `canales @> ARRAY[...]` y dos subconsultas por
 * tipo—, asi que comprobarla con un doble seria comprobar mi doble. Esto crea
 * un prospecto de mentira, le apunta contactos y mira que dice la agenda.
 *
 * Lo que defiende: que un paso que va por los dos canales NO se cierre con uno
 * solo, por muchas veces que se haya escrito. «Nunca damos por hecho que lo ha
 * visto» es lo que separa un proceso de una lista de tareas.
 */

let leadId;
let usuarioId;
const PROYECTO = 1; // Psiko Aprende, que tiene sus cinco pasos sembrados.

async function contacto(tipo) {
  await query(
    `INSERT INTO lead_interactions (lead_id, tipo, nota, created_by) VALUES ($1, $2, $3, $4)`,
    [leadId, tipo, '[test] los dos canales', usuarioId]
  );
}

/** El paso 1 de este prospecto, tal como lo ve su ficha. */
async function paso1() {
  const pasos = await pasosDeLead(leadId);
  return pasos.find((p) => p.clave === 'paso_1');
}

beforeAll(async () => {
  const u = await query(`SELECT id FROM users ORDER BY id LIMIT 1`);
  usuarioId = u.rows[0].id;

  const { rows } = await query(
    `INSERT INTO leads (project_id, nombre, email, telefono, status, fecha_solicitud)
     VALUES ($1, '[test] Dos Canales', 'dos.canales@test.local', '600000000', 'nuevo', CURRENT_DATE)
     RETURNING id`,
    [PROYECTO]
  );
  leadId = rows[0].id;
  await planificarPasosDeLead(leadId);
});

afterAll(async () => {
  if (leadId) {
    await query('DELETE FROM lead_interactions WHERE lead_id = $1', [leadId]);
    await query('DELETE FROM lead_steps WHERE lead_id = $1', [leadId]);
    await query('DELETE FROM leads WHERE id = $1', [leadId]);
  }
  await pool.end();
});

describe('un paso que va por correo y WhatsApp', () => {
  it('empieza sin hacer y sin señalar a ninguno de los dos', async () => {
    // Sin ningun contacto no falta «el aviso»: falta todo. Marcar aqui que
    // falta el WhatsApp seria decirle a la gestora que ya mando el correo.
    const p = await paso1();
    expect(p.hecho).toBe(false);
    expect(p.falta_correo).toBe(true);
    expect(p.falta_aviso).toBe(true);
  });

  it('con el correo mandado SIGUE sin hacer, y dice que falta el aviso', async () => {
    await contacto('email');
    const p = await paso1();
    expect(p.hecho).toBe(false);
    expect(p.falta_correo).toBe(false);
    expect(p.falta_aviso).toBe(true);
  });

  it('dos correos tampoco lo cierran: no es cuestion de insistir', async () => {
    await contacto('email');
    expect((await paso1()).hecho).toBe(false);
  });

  it('con el aviso por WhatsApp, hecho', async () => {
    await contacto('whatsapp');
    const p = await paso1();
    expect(p.hecho).toBe(true);
    expect(p.falta_correo).toBe(false);
    expect(p.falta_aviso).toBe(false);
  });

  it('una nota interna no cuenta como contactar con nadie', async () => {
    // Esta ya estaba y se mantiene: una nota no es un mensaje.
    const antes = await paso1();
    await contacto('nota');
    expect((await paso1()).hecho).toBe(antes.hecho);
  });
});
