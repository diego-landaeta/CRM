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
const marcarEtiquetaBorrada = vi.fn(async () => true);
const asociarEtiqueta = vi.fn(async () => ({ conversacionId: 7, puesta: true }));

// La casilla del #128 se pregunta a la base al abrir la sesion propia: si
// contesta vacio, el controlador niega el paso antes de llegar a la etiqueta.
vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (sql) => (/usa_whatsapp/.test(sql) ? { rows: [{ usa: true }] } : { rows: [] })),
}));
vi.mock('../src/modules/whatsapp/chat.model.js', () => ({
  guardarEtiqueta: (...a) => guardarEtiqueta(...a),
  marcarEtiquetaBorrada: (...a) => marcarEtiquetaBorrada(...a),
  asociarEtiqueta: (...a) => asociarEtiqueta(...a),
  conversacionDe: vi.fn(async () => ({ id: 7 })),
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

