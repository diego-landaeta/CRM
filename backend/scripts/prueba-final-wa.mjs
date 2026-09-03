import 'dotenv/config';

// Ensayo de extremo a extremo del modulo de WhatsApp.
//
//     cd backend && npm run dev          (en otra ventana)
//     cd backend && node scripts/prueba-final-wa.mjs
//
// Se lanza desde `backend/`, que es de donde lee el .env.
//
// No usa el numero de nadie: mete por el webhook los avisos con la forma EXACTA
// que manda Evolution v2.3.7 —comprobada en su registro y en el Baileys que
// lleva dentro— y comprueba lo que queda en la base. Es el camino real: HTTP,
// secreto del webhook, servicio, modelo y Postgres.

const BASE = 'http://127.0.0.1:3001';
const HOOK = `${BASE}/api/whatsapp/webhook?s=${process.env.EVOLUTION_WEBHOOK_SECRET}`;
const INST = 'crm-u77';
const GRUPO = '120363999999999999@g.us';
const PERSONA = '34600999888@s.whatsapp.net';
const LID = '95069319217252@lid';

const ahora = Math.floor(Date.now() / 1000);
const post = async (cuerpo) => {
  const r = await fetch(HOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
};

const { query } = await import('../src/shared/config/db.js');
const uno = async (sql, p = []) => (await query(sql, p)).rows[0] || null;

const resultados = [];
const comprobar = (nombre, ok, detalle = '') => resultados.push({ nombre, ok, detalle });

// 1 · un mensaje de grupo. Evolution manda el autor en key.participant.
await post({
  event: 'messages.upsert',
  instance: INST,
  data: {
    key: { remoteJid: GRUPO, id: 'T-G1', fromMe: false, participant: PERSONA },
    pushName: 'Dieguis',
    message: { conversation: 'hola al grupo' },
    messageTimestamp: ahora,
  },
});
const conv = await uno('SELECT * FROM wa_conversaciones WHERE instancia=$1 AND jid=$2', [INST, GRUPO]);
const m1 = await uno("SELECT * FROM wa_mensajes WHERE wa_id='T-G1'");
comprobar('el mensaje del grupo entra', Boolean(m1), m1 ? `tipo=${m1.tipo}` : 'no esta');
comprobar('se guarda QUIEN escribio', m1?.participante_nombre === 'Dieguis', `autor=${m1?.participante_nombre}`);
comprobar('al grupo NO se le pone el nombre de la persona', conv?.nombre_push === null,
  `nombre del grupo=${JSON.stringify(conv?.nombre_push)}`);

// 2 · el nombre del grupo es su asunto, y manda.
const model = await import('../src/modules/whatsapp/chat.model.js');
await model.datosDeGrupo(INST, GRUPO, 'PRUEBA FINAL', null);
const conv2 = await uno('SELECT nombre_push FROM wa_conversaciones WHERE instancia=$1 AND jid=$2', [INST, GRUPO]);
comprobar('el asunto del grupo SI se pone', conv2?.nombre_push === 'PRUEBA FINAL', `nombre=${conv2?.nombre_push}`);

await post({
  event: 'messages.upsert',
  instance: INST,
  data: {
    key: { remoteJid: GRUPO, id: 'T-G2', fromMe: false, participant: PERSONA },
    pushName: 'Giorgio.',
    message: { conversation: 'segundo' },
    messageTimestamp: ahora + 1,
  },
});
const conv3 = await uno('SELECT nombre_push FROM wa_conversaciones WHERE instancia=$1 AND jid=$2', [INST, GRUPO]);
comprobar('un mensaje posterior no renombra el grupo', conv3?.nombre_push === 'PRUEBA FINAL',
  `nombre=${conv3?.nombre_push}`);

// 3 · una respuesta citando, con el contexto dentro del tipo.
await post({
  event: 'messages.upsert',
  instance: INST,
  data: {
    key: { remoteJid: PERSONA, id: 'T-R1', fromMe: false },
    pushName: 'Marta',
    message: { extendedTextMessage: { text: 'si', contextInfo: { stanzaId: 'T-G1', participant: PERSONA } } },
    messageTimestamp: ahora + 2,
  },
});
const m2 = await uno("SELECT responde_a FROM wa_mensajes WHERE wa_id='T-R1'");
comprobar('la cita se saca del mensaje crudo', m2?.responde_a === 'T-G1', `responde_a=${m2?.responde_a}`);

// 4 · el acuse, aplanado, que es como lo manda Evolution.
//
// Sobre un mensaje NUESTRO: un acuse dice que llego lo que mandamos, asi que
// `actualizarEstado` solo toca los salientes. Probarlo sobre uno entrante daba
// un falso fallo.
await post({
  event: 'messages.upsert',
  instance: INST,
  data: {
    key: { remoteJid: PERSONA, id: 'T-S1', fromMe: true },
    message: { conversation: 'mandado por nosotros' },
    messageTimestamp: ahora + 3,
  },
});
await post({
  event: 'messages.update',
  instance: INST,
  data: { keyId: 'T-S1', remoteJid: PERSONA, fromMe: true, status: 'READ' },
});
const m3 = await uno("SELECT direccion, estado FROM wa_mensajes WHERE wa_id='T-S1'");
comprobar('el acuse aplanado se aplica', m3?.estado === 'leido', `direccion=${m3?.direccion} estado=${m3?.estado}`);

// 5 · una llamada que el otro cuelga: offer y terminate, nada mas.
const llamada = (status) => ({
  event: 'call',
  instance: INST,
  data: [{
    chatId: LID, from: LID, id: 'T-CALL', date: new Date().toISOString(),
    offline: false, status, isVideo: false, isGroup: false,
  }],
});
await post(llamada('offer'));
await new Promise((r) => setTimeout(r, 2200));
await post(llamada('terminate'));
const m4 = await uno("SELECT tipo, texto FROM wa_mensajes WHERE wa_id='call:T-CALL'");
comprobar('la llamada colgada deja constancia', m4?.tipo === 'llamada', `texto=${m4?.texto}`);
comprobar('con los segundos que sono', /^terminada:\d+$/.test(m4?.texto || ''), `texto=${m4?.texto}`);
comprobar('y sin inventarse el desenlace', !/perdida|contestada|rechazada/.test(m4?.texto || ''), `texto=${m4?.texto}`);

// 6 · borrar «para mi»: la clave viene dentro de keys.
await post({
  event: 'messages.delete',
  instance: INST,
  data: { keys: [{ remoteJid: GRUPO, id: 'T-G2', fromMe: false }] },
});
const m5 = await uno("SELECT tipo FROM wa_mensajes WHERE wa_id='T-G2'");
comprobar('el borrado con `keys` se marca', m5?.tipo === 'eliminado', `tipo=${m5?.tipo}`);

// 7 · la foto de perfil llega por su propio evento.
await post({
  event: 'contacts.update',
  instance: INST,
  data: [{ remoteJid: PERSONA, profilePicUrl: 'https://ejemplo/foto.jpg' }],
});
const conv4 = await uno('SELECT avatar_url FROM wa_conversaciones WHERE instancia=$1 AND jid=$2', [INST, PERSONA]);
comprobar('la foto de perfil se guarda', conv4?.avatar_url === 'https://ejemplo/foto.jpg', `foto=${conv4?.avatar_url}`);

// 8 · la lista dice quien mando lo ultimo, del mismo mensaje.
const lista = await model.listar({ instancia: INST });
const filaGrupo = lista.find((c) => c.jid === GRUPO);
comprobar('la lista trae direccion y autor del ultimo',
  filaGrupo?.ultimo_direccion === 'entrante',
  `autor=${filaGrupo?.ultimo_autor} direccion=${filaGrupo?.ultimo_direccion}`);
comprobar('y el tipo sale del MISMO mensaje que el autor',
  filaGrupo?.ultimo_tipo === 'eliminado', `tipo=${filaGrupo?.ultimo_tipo}`);

// 9 · un canal de difusion no entra en la lista.
const antes = await uno('SELECT count(*)::int c FROM wa_conversaciones WHERE instancia=$1', [INST]);
await post({
  event: 'messages.upsert',
  instance: INST,
  data: {
    key: { remoteJid: '123@newsletter', id: 'T-N1', fromMe: false },
    message: { conversation: 'promo' },
    messageTimestamp: ahora + 5,
  },
});
const despues = await uno('SELECT count(*)::int c FROM wa_conversaciones WHERE instancia=$1', [INST]);
comprobar('un canal de difusion no entra', antes.c === despues.c, `${antes.c} -> ${despues.c}`);

// 10 · la puerta del webhook.
//
// Aqui solo se puede comprobar lo que este entorno tenga configurado: el .env
// local trae `EVOLUTION_WEBHOOK_SECRET` vacio, y fuera de produccion eso se
// acepta a proposito. Las cuatro combinaciones —sin secreto, equivocado, por
// cabecera y por la direccion, mas el 503 de produccion— estan en
// `tests/webhookSecreto.test.js`, que no depende del entorno.
const haySecreto = Boolean(process.env.EVOLUTION_WEBHOOK_SECRET);
const sinSecreto = await fetch(`${BASE}/api/whatsapp/webhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ event: 'messages.upsert', instance: INST, data: {} }),
});
comprobar(
  haySecreto ? 'sin secreto, el webhook rechaza' : 'sin secreto configurado, se acepta (solo fuera de produccion)',
  haySecreto ? sinSecreto.status === 401 : sinSecreto.status === 200,
  `status=${sinSecreto.status}`,
);

console.log('');
for (const r of resultados) {
  console.log(`${r.ok ? 'OK   ' : 'FALLA'} · ${r.nombre}${r.ok ? '' : `  [${r.detalle}]`}`);
}
const fallos = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallos}/${resultados.length} bien`);

await query(`DELETE FROM wa_mensajes m USING wa_conversaciones c
              WHERE m.conversacion_id=c.id AND c.instancia=$1`, [INST]);
await query('DELETE FROM wa_conversaciones WHERE instancia=$1', [INST]);
const queda = await uno('SELECT count(*)::int c FROM wa_conversaciones WHERE instancia=$1', [INST]);
console.log(`limpieza: quedan ${queda.c} conversaciones de la prueba`);
process.exit(fallos ? 1 : 0);
