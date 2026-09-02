import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A un grupo NO se le pone el nombre de una persona. Nunca.
 *
 * Esto se arreglo tres veces por fuera —en el webhook, al traer historial, al
 * abrir un chat— y volvia por otro lado cada vez. Los grupos amanecian
 * llamandose «Dieguis» o «Giorgio.»: el nombre de quien hubiera hablado el
 * ultimo, porque WhatsApp manda ese `pushName` en CADA mensaje del grupo y
 * alguien lo escribia.
 *
 * La regla vive ahora en `conversacionDe`, que es el unico sitio por donde se
 * escribe el nombre de una conversacion. No depende de que ningun sitio se
 * acuerde de pasar `null`.
 *
 * El nombre de un grupo es su ASUNTO, y ese entra por `datosDeGrupo`.
 *
 * Esta prueba existe porque la pregunta —«¿cuantas veces se repetira esto en
 * produccion?»— tenia una sola respuesta buena: las que haga falta hasta que
 * haya algo que lo impida.
 */

const query = vi.fn();
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a) }));
vi.mock('../src/shared/utils/normalizePhone.js', () => ({
  normalizePhone: (x) => x, phoneCanonical: (x) => x,
}));

const { conversacionDe, datosDeGrupo, refrescarNombres } = await import('../src/modules/whatsapp/chat.model.js');

/** El nombre que acaba yendo al INSERT. */
const nombreEscrito = () => {
  const llamada = query.mock.calls.find(([sql]) => /INSERT INTO wa_conversaciones/.test(sql));
  return llamada ? llamada[1][3] : undefined;
};

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
});

describe('el nombre de un grupo', () => {
  it('NO se pone con el de quien escribio', async () => {
    await conversacionDe({
      instancia: 'crm-u4',
      jid: '120363412958104027@g.us',
      nombrePush: 'Dieguis',
    });
    expect(nombreEscrito(), 'a un grupo le entro el nombre de una persona').toBeNull();
  });

  it('tampoco aunque venga con pinta de nombre de grupo', async () => {
    // Da igual lo que parezca: por esta via no entra ninguno.
    await conversacionDe({
      instancia: 'crm-u4', jid: '120363412958104027@g.us', nombrePush: 'DPTO PROGRAMACIÓN',
    });
    expect(nombreEscrito()).toBeNull();
  });

  it('a una persona SI se le pone', async () => {
    await conversacionDe({
      instancia: 'crm-u4', jid: '34600111222@s.whatsapp.net', nombrePush: 'Adrian Bravo',
    });
    expect(nombreEscrito()).toBe('Adrian Bravo');
  });
});

describe('los nombres que no son nombres', () => {
  it('solo espacios se guarda como nada', async () => {
    await conversacionDe({ instancia: 'crm-u4', jid: '34600111222@s.whatsapp.net', nombrePush: '   ' });
    expect(nombreEscrito()).toBeNull();
  });

  it('una marca invisible tampoco es un nombre', async () => {
    // U+200E. WhatsApp los deja pasar y `trim()` no los quita: el chat se veia
    // con la cabecera en blanco y el avatar caido a su interrogante.
    await conversacionDe({ instancia: 'crm-u4', jid: '34600111222@s.whatsapp.net', nombrePush: '‎' });
    expect(nombreEscrito()).toBeNull();
  });

  it('un nombre con una marca invisible dentro se limpia y se queda', async () => {
    await conversacionDe({ instancia: 'crm-u4', jid: '34600111222@s.whatsapp.net', nombrePush: '‎Marta' });
    expect(nombreEscrito()).toBe('Marta');
  });
});

describe('el asunto del grupo, que es el que manda', () => {
  it('pisa lo que hubiera guardado', async () => {
    // Sin esto, un grupo que se quedo con un nombre malo lo arrastra para
    // siempre: nada lo vuelve a tocar. Se vio con cuatro grupos a la vez.
    await datosDeGrupo('crm-u4', '120363412958104027@g.us', 'DPTO PROGRAMACIÓN', null);
    const [sql] = query.mock.calls[0];
    expect(sql).toContain('COALESCE($3, wa_conversaciones.nombre_push)');
  });

  it('sin asunto ni foto no toca nada', async () => {
    await datosDeGrupo('crm-u4', '120363412958104027@g.us', null, null);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('la agenda, que era la SEGUNDA puerta', () => {
  // Se arreglo en `conversacionDe` y esa misma tarde los cuatro grupos volvian
  // a llamarse como personas: entraban por aqui. Comprobado contra Evolution
  // v2.3.7 sobre la agenda real — `findContacts` devuelve 106 jids de grupo y
  // en todos el campo `name` viene vacio, asi que se cae al `pushName`, que en
  // un grupo es el de quien hablo el ultimo.

  it('no le pone a un grupo el nombre que traiga la agenda', async () => {
    await refrescarNombres('crm-u4', [
      { jid: '120363419272016724@g.us', nombre: 'Dieguis' },
    ]);
    const [sql] = query.mock.calls[0];
    expect(sql, 'la agenda podia renombrar grupos').toContain("c.jid NOT LIKE '%@g.us'");
  });

  it('a las personas SI, que para eso esta', async () => {
    await refrescarNombres('crm-u4', [
      { jid: '34600111222@s.whatsapp.net', nombre: 'Marta Ruiz' },
    ]);
    expect(query.mock.calls[0][1][2]).toEqual(['Marta Ruiz']);
  });

  it('un invisible de la agenda no se guarda como nombre', async () => {
    // Uno de los grupos de la agenda real se llamaba exactamente asi: U+200E.
    await refrescarNombres('crm-u4', [
      { jid: '34600111222@s.whatsapp.net', nombre: '‎' },
    ]);
    expect(query, 'se guardaba un nombre invisible').not.toHaveBeenCalled();
  });

  it('el asunto de un grupo tambien se limpia', async () => {
    await datosDeGrupo('crm-u4', '120363412958104027@g.us', '  ‎ ', null);
    expect(query).not.toHaveBeenCalled();
  });
});
