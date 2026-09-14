import { describe, it, expect, vi, beforeEach } from 'vitest';

// Las etiquetas de WhatsApp dentro del CRM (#128 punto 2, y #138).
//
// Diego: «poder extraer las etiquetas de WhatsApp y nosotros poner etiquetas
// para ese funcionamiento». Las gestoras ya organizan sus chats con etiquetas y
// el CRM las ignoraba.
//
// OJO CON EL NOMBRE. En la pantalla del chat ya hay algo llamado «etiqueta»
// (#72) y es el ESTADO del prospecto. Estas son otras: viven en el movil de la
// gestora. Las pruebas de abajo fijan que el CRM se quede con las de WhatsApp
// tal como llegan, sin mezclarlas con lo suyo.

const guardarEtiqueta = vi.fn(async () => 1);
const conversacionDe = vi.fn(async () => ({ id: 7, lead_id: null, avatar_url: null, nombre: 'Marta' }));
const marcarEtiquetaBorrada = vi.fn(async () => true);
const asociarEtiqueta = vi.fn(async () => ({ conversacionId: 7, puesta: true }));
const aplicarEtiquetasPendientes = vi.fn(async () => 1);

// La casilla del #128 se pregunta a la base al abrir la sesion propia: si
// contesta vacio, el controlador niega el paso antes de llegar a la etiqueta.
vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql) => (/usa_whatsapp/.test(sql) ? { rows: [{ usa: true }] } : { rows: [] })),
}));
vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  guardarEtiqueta: (...a) => guardarEtiqueta(...a),
  marcarEtiquetaBorrada: (...a) => marcarEtiquetaBorrada(...a),
  asociarEtiqueta: (...a) => asociarEtiqueta(...a),
  aplicarEtiquetasPendientes: (...a) => aplicarEtiquetasPendientes(...a),
  conversacionDe: (...a) => conversacionDe(...a),
  guardarMensaje: vi.fn(async () => ({ id: 1, ts: new Date() })),
  actualizarAvatar: vi.fn(), actualizarEstado: vi.fn(), apuntarInteraccion: vi.fn(),
  corregirTexto: vi.fn(), datosDeGrupo: vi.fn(), hayConversaciones: vi.fn(async () => true),
  marcarEliminado: vi.fn(), marcarLeida: vi.fn(), mensajePorId: vi.fn(),
  mensajePorWaId: vi.fn(), mensajes: vi.fn(async () => []), porId: vi.fn(),
  salientesRecientes: vi.fn(async () => []), ultimoEntranteSinLeer: vi.fn(),
}));
vi.mock('../src/modules/whatsapp/evolution.client.js', async (orig) => {
  const real = await orig();
  return {
    ...real, configurado: () => false,
    bajarMedia: vi.fn(async () => null), fotoDe: vi.fn(async () => null), grupoDe: vi.fn(async () => null),
  };
});

const servicio = await import('../src/modules/whatsapp/chat.service.js');
const evolution = await import('../src/modules/whatsapp/evolution.client.js');

describe('los avisos de etiquetas llegan y se atienden', () => {
  beforeEach(() => {
    guardarEtiqueta.mockClear();
    marcarEtiquetaBorrada.mockClear();
    asociarEtiqueta.mockClear();
  });

  it('los dos eventos estan suscritos — si no, Evolution no los manda', () => {
    // Es el fallo que ya costo las llamadas, las fotos y el historial: el
    // manejador existe, nadie se suscribio, y desde fuera parece que la funcion
    // no esta hecha.
    expect(evolution.EVENTOS_QUE_ATENDEMOS).toContain('LABELS_EDIT');
    expect(evolution.EVENTOS_QUE_ATENDEMOS).toContain('LABELS_ASSOCIATION');
  });

  it('una etiqueta nueva se guarda con su nombre ENTERO', async () => {
    // Esta es la razon de fiarse del aviso y no de `findLabels`: Evolution
    // guarda el nombre pelado —`name.replace(/[^\x20-\x7E]/g, '')`— asi que en
    // su base «Presupuesto ✅» es «Presupuesto ». Por el aviso llega entero.
    await servicio.recibir({
      event: 'labels.edit',
      instance: 'crm-u4',
      data: { id: '12', name: 'Presupuesto ✅', color: '5' },
    });
    expect(guardarEtiqueta).toHaveBeenCalledWith(
      expect.objectContaining({ instancia: 'crm-u4', waId: '12', nombre: 'Presupuesto ✅' })
    );
  });

  it('borrar una etiqueta la MARCA, no la borra', async () => {
    // Borrarla de verdad se llevaria por delante en que conversaciones estuvo
    // puesta, que es historial de como trabajo la gestora.
    await servicio.recibir({
      event: 'labels.edit', instance: 'crm-u4',
      data: { id: '12', name: 'Presupuesto', deleted: true },
    });
    expect(marcarEtiquetaBorrada).toHaveBeenCalledWith('crm-u4', '12');
    expect(guardarEtiqueta).not.toHaveBeenCalled();
  });

  it('ponerla en un chat la asocia a esa conversacion', async () => {
    await servicio.recibir({
      event: 'labels.association', instance: 'crm-u4',
      data: { type: 'add', chatId: '34600111222@s.whatsapp.net', labelId: '12' },
    });
    expect(asociarEtiqueta).toHaveBeenCalledWith(expect.objectContaining({
      instancia: 'crm-u4', jid: '34600111222@s.whatsapp.net', waIdEtiqueta: '12', poner: true,
    }));
  });

  it('quitarla la quita', async () => {
    await servicio.recibir({
      event: 'labels.association', instance: 'crm-u4',
      data: { type: 'remove', chatId: '34600111222@s.whatsapp.net', labelId: '12' },
    });
    expect(asociarEtiqueta).toHaveBeenCalledWith(expect.objectContaining({ poner: false }));
  });

  it('un type raro PONE, no quita', async () => {
    // De las dos formas de equivocarse, una etiqueta de mas se ve y se corrige;
    // una de menos no la echa en falta nadie.
    await servicio.recibir({
      event: 'labels.association', instance: 'crm-u4',
      data: { type: 'vaya', chatId: '34600111222@s.whatsapp.net', labelId: '12' },
    });
    expect(asociarEtiqueta).toHaveBeenCalledWith(expect.objectContaining({ poner: true }));
  });

  it('un aviso incompleto no revienta ni inventa', async () => {
    // El webhook contesta 200 siempre: si devolviera error, Evolution reintenta
    // en bucle y se para su cola.
    const r = await servicio.recibir({ event: 'labels.association', instance: 'crm-u4', data: {} });
    expect(r.ignorado).toBeTruthy();
    expect(asociarEtiqueta).not.toHaveBeenCalled();
  });

  it('tambien acepta la forma envuelta del puente', async () => {
    // Baileys lo emite como `{ association: { chatId, labelId }, type }`, y
    // Evolution lo aplana antes de mandarlo. Suponer una sola forma es lo que
    // costo la #63 y la #99.
    await servicio.recibir({
      event: 'labels.association', instance: 'crm-u4',
      data: { type: 'add', association: { chatId: '34600111222@s.whatsapp.net', labelId: '9' } },
    });
    expect(asociarEtiqueta).toHaveBeenCalledWith(expect.objectContaining({ waIdEtiqueta: '9' }));
  });
});

describe('poner una etiqueta desde el CRM', () => {
  it('a un grupo no se le puede, y se dice por que', async () => {
    // `handleLabel` pide un NUMERO y comprueba que existe en WhatsApp. Con un
    // grupo contesta «Number not found», que no explica nada a quien lo lee.
    const r = await evolution.ponerEtiqueta('1203630@g.us', '12', 'add', 'crm-u4');
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/grupo/i);
  });

  it('del jid se manda solo el numero', async () => {
    // Mandando el jid entero, Evolution contesta que ese numero no existe.
    const r = await evolution.ponerEtiqueta('34600111222@s.whatsapp.net', '12', 'add', 'crm-u4');
    // Sin Evolution configurado no llega a mandarse, pero tampoco se para por
    // el jid: el motivo no es el del grupo.
    expect(r.motivo).not.toMatch(/grupo/i);
  });
});


// ── Cuando la etiqueta llega antes que el chat (cuentas Business) ────────────
//
// Al enlazar, WhatsApp manda la sincronizacion del estado —las etiquetas y en
// que chat esta cada una— ANTES del historial, que es lo que crea las
// conversaciones. Con una cuenta de Business eso significa que toda la
// clasificacion de la gestora llega antes de que exista un solo chat.
//
// Antes se tiraba con un «esa conversacion no esta en el CRM». Y no hay segunda
// oportunidad: el aviso no se repite, y Evolution 2.3.7 guarda las etiquetas de
// cada chat en su base pero NO las devuelve por ningun endpoint —`findLabels`
// da el catalogo y `findChats` no incluye esa columna—. Lo que se tira, se
// pierde para siempre.

describe('la etiqueta que llega antes que su conversacion', () => {
  it('no se tira: se queda esperando', async () => {
    // `asociarEtiqueta` simulado devuelve lo que devolveria el de verdad cuando
    // no encuentra la conversacion.
    asociarEtiqueta.mockResolvedValueOnce({ pendiente: true, jid: '34600111222@s.whatsapp.net' });
    const r = await servicio.recibir({
      event: 'labels.association', instance: 'crm-u4',
      data: { type: 'add', chatId: '34600111222@s.whatsapp.net', labelId: '31' },
    });
    expect(r.pendiente).toBe(true);
    expect(r.ignorado).toBeUndefined();
  });

  it('al nacer la conversacion se miran las que esperaban', async () => {
    // Solo al NACER, no en cada mensaje: al enlazar entran miles y una consulta
    // de mas por cada uno se nota.
    conversacionDe.mockResolvedValueOnce({
      id: 7, lead_id: null, avatar_url: null, nombre: 'Marta', recien_creada: true,
    });
    await servicio.recibir({
      event: 'messages.upsert', instance: 'crm-u4',
      data: {
        key: { id: 'N1', remoteJid: '34600111222@s.whatsapp.net', fromMe: false },
        message: { conversation: 'hola' },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(aplicarEtiquetasPendientes).toHaveBeenCalledWith(
      expect.objectContaining({ instancia: 'crm-u4', jid: '34600111222@s.whatsapp.net' })
    );
  });

  it('en una conversacion que YA existia no se pregunta', async () => {
    aplicarEtiquetasPendientes.mockClear();
    conversacionDe.mockResolvedValueOnce({
      id: 7, lead_id: null, avatar_url: null, nombre: 'Marta', recien_creada: false,
    });
    await servicio.recibir({
      event: 'messages.upsert', instance: 'crm-u4',
      data: {
        key: { id: 'N2', remoteJid: '34600111222@s.whatsapp.net', fromMe: false },
        message: { conversation: 'otra' },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(aplicarEtiquetasPendientes).not.toHaveBeenCalled();
  });
});

// ── La misma persona con dos llaves: telefono y @lid ─────────────────────────
//
// Salio con un numero real: la gestora puso una etiqueta desde el movil y el
// aviso llego direccionado asi
//
//     etiqueta add: 4 en 16699034202151@lid
//
// mientras esa persona estaba guardada como «584242439474@s.whatsapp.net». No
// casaba, y la etiqueta se quedaba fuera.
//
// Y es peor de lo que parece: el puente traduce el @lid a telefono antes de
// mandarlo y Evolution NO —guarda la clave tal como viene de Baileys—, asi que
// el resultado cambiaba entre local y produccion. Probarlo en local no diria la
// verdad, en ningun sentido.

describe('la misma persona, con sus dos llaves', () => {
  it('la conversacion aprende la otra llave del mensaje', async () => {
    await servicio.recibir({
      event: 'messages.upsert', instance: 'crm-u4',
      data: {
        key: {
          id: 'L1', remoteJid: '34600111222@s.whatsapp.net', fromMe: false,
          remoteJidAlt: '16699034202151@lid',
        },
        message: { conversation: 'hola' },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    });
    expect(conversacionDe).toHaveBeenCalledWith(
      expect.objectContaining({ otraLlave: '16699034202151@lid' })
    );
  });

  it('tambien vale `senderPn` cuando el chat viene por @lid', async () => {
    // El caso contrario, que es el que se dara en produccion: el mensaje llega
    // direccionado por @lid y la clave trae el telefono.
    conversacionDe.mockClear();
    await servicio.recibir({
      event: 'messages.upsert', instance: 'crm-u4',
      data: {
        key: {
          id: 'L2', remoteJid: '16699034202151@lid', fromMe: false,
          senderPn: '34600111222@s.whatsapp.net',
        },
        message: { conversation: 'hola' },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    });
    expect(conversacionDe).toHaveBeenCalledWith(
      expect.objectContaining({ otraLlave: '34600111222@s.whatsapp.net' })
    );
  });

  it('sin otra llave no se inventa ninguna', async () => {
    // Un mensaje normal no trae par, y escribir ahi un nulo pisaria el que ya
    // se hubiera aprendido antes. Por eso el COALESCE del modelo.
    conversacionDe.mockClear();
    await servicio.recibir({
      event: 'messages.upsert', instance: 'crm-u4',
      data: {
        key: { id: 'L3', remoteJid: '34600111222@s.whatsapp.net', fromMe: false },
        message: { conversation: 'hola' },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    });
    expect(conversacionDe).toHaveBeenCalledWith(expect.objectContaining({ otraLlave: null }));
  });
});
