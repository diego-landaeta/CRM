import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Soporte de verdad (#38).
 *
 * La pantalla existía desde hacía meses y no tenía nada detrás: los tickets se
 * guardaban en el `localStorage` del navegador de quien los abría. Alguien
 * reportaba una avería, veía su ticket en la lista, y no lo recibía nadie.
 *
 * Lo que se fija aquí es lo que no se ve leyendo el código:
 *
 *   - QUIÉN ALCANZA QUÉ. Un ticket lleva pasos para reproducir, una URL del
 *     CRM y a menudo una captura con datos de un cliente. No es una lista
 *     pública, y el adjunto menos.
 *   - QUE EL ADJUNTO PIDA SESIÓN. En Matrículas la ruta equivalente se dejó
 *     fuera de `verifyToken` «porque la URL ya es no-guessable» —y la URL era
 *     un entero correlativo—, así que hoy se descargan DNI escaneados sin
 *     credencial. Aquí eso no puede repetirse sin que esto se ponga rojo.
 *   - LAS NOTAS INTERNAS. Si quien abrió el ticket las viera, dejarían de
 *     servir para lo único que sirven.
 */

const modelo = {
  crear: vi.fn(),
  porId: vi.fn(),
  listar: vi.fn(async () => ({ tickets: [], total: 0, page: 1, limit: 50, totalPages: 0 })),
  mensajesDe: vi.fn(async () => []),
  adjuntosDe: vi.fn(async () => []),
  responder: vi.fn(async () => 1),
  cambiarEstado: vi.fn(async () => ({ id: '1' })),
  guardarAdjunto: vi.fn(async () => ({ id: 1 })),
  adjuntoPorId: vi.fn(),
  tiempos: vi.fn(async () => ({ total: 0 })),
};
vi.mock('../src/modules/soporte/soporte.model.js', () => modelo);

const enviado = vi.fn(async () => ({ sent: true }));
vi.mock('../src/shared/services/brevo.service.js', () => ({
  sendTicketNuevoEmail: (...a) => enviado(...a),
  sendEmail: vi.fn(), sendWelcomeUserEmail: vi.fn(), sendPasswordResetEmail: vi.fn(),
}));
vi.mock('../src/shared/services/localStorage.service.js', () => ({
  saveLocal: vi.fn(), getLocal: vi.fn(async () => ({ buffer: Buffer.from('x') })), deleteLocal: vi.fn(),
}));

const ctrl = await import('../src/modules/soporte/soporte.controller.js');

function fingirRes() {
  const res = { codigo: 200, cuerpo: null, cabeceras: {} };
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  res.setHeader = (k, v) => { res.cabeceras[k] = v; };
  res.send = (b) => { res.cuerpo = b; return res; };
  return res;
}

async function llamar(handler, req) {
  const res = fingirRes();
  let error = null;
  await handler(req, res, (e) => { error = e; });
  return { res, error };
}

const LAURA = { userId: 4, role: 'gestor', nombre: 'Laura' };
const ADMIN = { userId: 9, role: 'admin', nombre: 'Diego' };

/** Un ticket de Laura. */
const DE_LAURA = { id: '1', autorId: 4, title: 'No carga el chat' };

beforeEach(() => {
  for (const f of Object.values(modelo)) f.mockClear?.();
  enviado.mockClear();
  modelo.listar.mockResolvedValue({ tickets: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  modelo.porId.mockResolvedValue(DE_LAURA);
  modelo.mensajesDe.mockResolvedValue([]);
  modelo.adjuntosDe.mockResolvedValue([]);
});

describe('quién ve qué tickets', () => {
  it('una gestora solo pide los suyos', async () => {
    await llamar(ctrl.listar, { user: LAURA, query: {} });
    expect(modelo.listar).toHaveBeenCalledWith(expect.objectContaining({ soloDe: 4 }));
  });

  it('quien administra los ve todos', async () => {
    await llamar(ctrl.listar, { user: ADMIN, query: {} });
    expect(modelo.listar).toHaveBeenCalledWith(expect.objectContaining({ soloDe: null }));
  });

  it('una gestora no abre el ticket de otra', async () => {
    modelo.porId.mockResolvedValue({ id: '1', autorId: 99 });
    const { error } = await llamar(ctrl.porId, { user: LAURA, params: { id: '1' }, query: {} });
    expect(error?.statusCode).toBe(403);
    expect(error?.code).toBe('NO_ES_TUYO');
  });

  it('el suyo sí', async () => {
    const { error } = await llamar(ctrl.porId, { user: LAURA, params: { id: '1' }, query: {} });
    expect(error).toBeNull();
  });

  it('uno que no existe da 404, no 403', async () => {
    // Importa el orden: con 403 a lo inexistente, probando números se sabría
    // cuáles existen sin verlos.
    modelo.porId.mockResolvedValue(null);
    const { error } = await llamar(ctrl.porId, { user: LAURA, params: { id: '999' }, query: {} });
    expect(error?.statusCode).toBe(404);
  });
});

describe('las notas internas', () => {
  it('quien abrió el ticket NO las recibe', async () => {
    await llamar(ctrl.porId, { user: LAURA, params: { id: '1' }, query: {} });
    expect(modelo.mensajesDe).toHaveBeenCalledWith(1, { incluirInternas: false });
  });

  it('quien administra sí', async () => {
    await llamar(ctrl.porId, { user: ADMIN, params: { id: '1' }, query: {} });
    expect(modelo.mensajesDe).toHaveBeenCalledWith(1, { incluirInternas: true });
  });

  it('una gestora no puede MARCAR una nota como interna', async () => {
    // Si pudiera, escribiría algo creyendo que el equipo lo lee y no lo leería
    // nadie del otro lado.
    await llamar(ctrl.responder, {
      user: LAURA, params: { id: '1' }, body: { body: 'hola', interna: true },
    });
    expect(modelo.responder).toHaveBeenCalledWith(1, 4, 'hola', false);
  });

  it('quien administra sí puede', async () => {
    await llamar(ctrl.responder, {
      user: ADMIN, params: { id: '1' }, body: { body: 'es del puente', interna: true },
    });
    expect(modelo.responder).toHaveBeenCalledWith(1, 9, 'es del puente', true);
  });
});

describe('los adjuntos — la puerta que en Matrículas quedó abierta', () => {
  it('no se descarga el adjunto de un ticket ajeno', async () => {
    modelo.adjuntoPorId.mockResolvedValue({ id: 1, clave: 'k', abierto_por: 99 });
    const { error } = await llamar(ctrl.descargarAdjunto, {
      user: LAURA, params: { adjuntoId: '1' },
    });
    expect(error?.statusCode).toBe(403);
  });

  it('el del propio ticket sí', async () => {
    modelo.adjuntoPorId.mockResolvedValue({ id: 1, clave: 'k', abierto_por: 4, mime: 'image/png', nombre: 'a.png' });
    const { res, error } = await llamar(ctrl.descargarAdjunto, {
      user: LAURA, params: { adjuntoId: '1' },
    });
    expect(error).toBeNull();
    expect(res.cabeceras['Content-Type']).toBe('image/png');
  });

  it('quien administra alcanza cualquiera', async () => {
    modelo.adjuntoPorId.mockResolvedValue({ id: 1, clave: 'k', abierto_por: 99 });
    const { error } = await llamar(ctrl.descargarAdjunto, {
      user: ADMIN, params: { adjuntoId: '1' },
    });
    expect(error).toBeNull();
  });

  it('no se adjunta a un ticket ajeno', async () => {
    modelo.porId.mockResolvedValue({ id: '1', autorId: 99 });
    const { error } = await llamar(ctrl.subirAdjunto, {
      user: LAURA, params: { id: '1' }, file: { originalname: 'x.png', buffer: Buffer.from('x'), mimetype: 'image/png', size: 1 },
    });
    expect(error?.statusCode).toBe(403);
    expect(modelo.guardarAdjunto).not.toHaveBeenCalled();
  });
});

describe('abrir un ticket', () => {
  it('se guarda y se avisa por correo', async () => {
    modelo.crear.mockResolvedValue({ id: '7', title: 'Algo' });
    const { res, error } = await llamar(ctrl.crear, {
      user: LAURA, body: { title: 'El chat no carga' },
    });
    expect(error).toBeNull();
    expect(res.codigo).toBe(201);
    expect(modelo.crear).toHaveBeenCalledWith(expect.objectContaining({ abiertoPor: 4 }));
    expect(enviado).toHaveBeenCalled();
  });

  it('si el correo falla, el ticket queda guardado igual', async () => {
    // Es lo que de verdad importaba: antes no se guardaba en ningún sitio.
    modelo.crear.mockResolvedValue({ id: '7', title: 'Algo' });
    enviado.mockRejectedValue(new Error('Brevo caido'));
    const { res, error } = await llamar(ctrl.crear, { user: LAURA, body: { title: 'El chat no carga' } });
    expect(error).toBeNull();
    expect(res.codigo).toBe(201);
  });

  it('sin título no se guarda nada', async () => {
    const { error } = await llamar(ctrl.crear, { user: LAURA, body: { description: 'solo esto' } });
    expect(error?.statusCode).toBe(400);
    expect(modelo.crear).not.toHaveBeenCalled();
  });
});

describe('los tiempos', () => {
  it('solo para quien administra', async () => {
    const { error } = await llamar(ctrl.tiempos, { user: LAURA, query: {} });
    expect(error?.statusCode).toBe(403);
  });

  it('un admin sí', async () => {
    const { error } = await llamar(ctrl.tiempos, { user: ADMIN, query: {} });
    expect(error).toBeNull();
  });
});
