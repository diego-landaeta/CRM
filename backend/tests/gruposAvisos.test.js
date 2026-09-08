import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Lo que un grupo NO debe hacer: interrumpir. Y lo que SI: quedar marcado como
 * leido de verdad. Los dos salieron de usar el modulo con grupos reales (#74).
 */

const consultas = [];
vi.mock('../src/shared/config/db.js', () => ({
  query: async (sql, params) => {
    consultas.push({ sql, params });
    if (/COALESCE\(SUM\(c\.no_leidos\)/.test(sql)) return { rows: [{ total: 0, conversaciones: 0 }] };
    if (/information_schema\.columns/.test(sql)) return { rows: [{ '?column?': 1 }] };
    if (/FROM wa_mensajes\s+WHERE conversacion_id/.test(sql)) {
      return { rows: [{ wa_id: 'WA9', participante: '584127200235@s.whatsapp.net' }] };
    }
    return { rows: [] };
  },
}));

let model;
beforeEach(async () => { consultas.length = 0; model = await import('../src/modules/whatsapp/chat.model.js'); });
afterEach(() => vi.resetModules());

describe('avisos: los grupos no interrumpen', () => {
  it('el contador del aviso deja fuera los grupos', async () => {
    await model.sinLeer('crm-u1');
    const suma = consultas.find((c) => /COALESCE\(SUM\(c\.no_leidos\)/.test(c.sql));
    // Con 105 grupos en el movil, contarlos significa un aviso del sistema por
    // cada cosa que diga cualquiera. En dos dias se apagan los avisos, y con
    // ellos los de los prospectos — que son los que importan.
    expect(suma.sql).toMatch(/jid NOT LIKE '%@g\.us'/);
  });
});

describe('marcar como leido en un grupo', () => {
  it('se pide el participante, no solo el wa_id', async () => {
    const r = await model.ultimoEntranteSinLeer(7);
    // WhatsApp identifica un mensaje de grupo por (remoteJid, participant, id).
    // Sin el participante no sabe cual marcar y el doble tic azul no llega.
    const q = consultas.find((c) => /FROM wa_mensajes\s+WHERE conversacion_id/.test(c.sql));
    expect(q.sql).toMatch(/participante/);
    expect(r.participante).toBe('584127200235@s.whatsapp.net');
  });
});

describe('la etiqueta «Grupos» (#72 + #74)', () => {
  it('filtra por grupo en vez de por estado del prospecto', async () => {
    await model.listar({ instancia: 'crm-u1', estado: 'grupos' });
    const q = consultas.find((c) => /FROM wa_conversaciones c/.test(c.sql) && /LEFT JOIN leads/.test(c.sql));
    expect(q.sql).toMatch(/jid LIKE '%@g\.us'/);
    // Y NO se cuela el filtro por estado: un grupo no tiene prospecto, asi que
    // `l.status` seria NULL y no saldria ninguno.
    expect(q.sql).not.toMatch(/l\.status = /);
  });

  it('un estado normal sigue filtrando por el prospecto', async () => {
    await model.listar({ instancia: 'crm-u1', estado: 'en_seguimiento' });
    const q = consultas.find((c) => /FROM wa_conversaciones c/.test(c.sql) && /LEFT JOIN leads/.test(c.sql));
    expect(q.sql).toMatch(/l\.status = /);
  });
});
