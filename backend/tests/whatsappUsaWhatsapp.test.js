import { describe, it, expect, vi, beforeEach } from 'vitest';
import { porQueNoPuede, porQueNoUsa, usaWhatsapp } from '../src/modules/whatsapp/roles.js';

// La casilla «usa el WhatsApp del CRM» (#128, punto 1).
//
// Diego, 07/09: «Ni Vanesa, ni Adriana, sus WhatsApp apareceran ahi. Debe ser
// una opcion para activar o no». Hasta ahora la puerta era el ROL, y el rol no
// distingue entre dos gestoras.
//
// Lo que se prueba aqui es la REGLA, no la consulta: que sean dos preguntas
// separadas —puede / usa— es justamente lo que evita que apagar una casilla
// desvincule el numero de alguien.

const gestora = { role: 'gestor', active: true, gestor_colaboraciones: false };

describe('la casilla de WhatsApp', () => {
  it('apagada, no lo usa — y se dice donde se enciende', () => {
    const motivo = porQueNoUsa({ ...gestora, usa_whatsapp: false });
    expect(motivo).toBeTruthy();
    // El motivo no es adorno: sin la segunda frase, quien lo lea no sabe que
    // hacer con ello. Es lo mismo que se aprendio en la #68.
    expect(motivo).toMatch(/ficha de usuario/i);
  });

  it('encendida, lo usa', () => {
    expect(usaWhatsapp({ ...gestora, usa_whatsapp: true })).toBe(true);
  });

  it('SIN la migracion 156 aplicada, todo sigue como hoy', () => {
    // La columna se pide con to_jsonb y sin coalesce, asi que mientras no este
    // la migracion llega `null`. Eso NO puede apagar a nadie: la migracion la
    // aprueba Diego y hasta entonces el CRM tiene que comportarse igual que
    // antes de escribir nada de esto.
    expect(usaWhatsapp({ ...gestora, usa_whatsapp: null })).toBe(true);
    expect(usaWhatsapp({ ...gestora })).toBe(true);
  });

  it('apagada NO es lo mismo que no poder: `porQueNoPuede` no se entera', () => {
    // Esta es LA prueba de este fichero.
    //
    // `user.controller` compara `puedeTenerWhatsapp` antes y despues de cada
    // cambio y, si se pierde, DESVINCULA el numero. Si la casilla entrara en esa
    // funcion, apagarla soltaria la sesion de la gestora y habria que volver a
    // enlazar el movil con ella delante — por una casilla de reparto.
    expect(porQueNoPuede({ ...gestora, usa_whatsapp: false })).toBeNull();
  });

  it('lo que no puede, tampoco lo usa — y manda el motivo del rol', () => {
    // Un tutor con la casilla encendida sigue sin tener WhatsApp: encenderla no
    // puede saltarse la regla de la casa. Y el motivo que se enseña es el suyo,
    // no «no tiene activado», que mandaria a quien manda a pulsar una casilla
    // que no arregla nada.
    const motivo = porQueNoUsa({ role: 'tutor', active: true, usa_whatsapp: true });
    expect(motivo).toMatch(/tutores/i);
  });

  it('de baja, tampoco', () => {
    expect(usaWhatsapp({ ...gestora, active: false, usa_whatsapp: true })).toBe(false);
  });
});

// ── La parte que si toca la base ────────────────────────────────────────────

const query = vi.fn();
vi.mock('../src/shared/config/db.js', () => ({ query: (...a) => query(...a) }));

const { usaSuWhatsapp, olvidar, olvidarTodo } = await import('../src/modules/whatsapp/usaWhatsapp.js');

describe('la casilla, preguntada a la base', () => {
  beforeEach(() => { query.mockReset(); olvidarTodo(); });

  it('se recuerda: el chat pregunta cada tres segundos y no puede costar una consulta cada vez', async () => {
    query.mockResolvedValue({ rows: [{ usa: true }] });
    await usaSuWhatsapp(7);
    await usaSuWhatsapp(7);
    await usaSuWhatsapp(7);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('se olvida al tocar la ficha, para que apagar se note al momento', async () => {
    query.mockResolvedValue({ rows: [{ usa: true }] });
    await usaSuWhatsapp(7);
    olvidar(7);
    query.mockResolvedValue({ rows: [{ usa: false }] });
    expect(await usaSuWhatsapp(7)).toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('cada persona por su lado', async () => {
    query.mockResolvedValueOnce({ rows: [{ usa: true }] });
    query.mockResolvedValueOnce({ rows: [{ usa: false }] });
    expect(await usaSuWhatsapp(1)).toBe(true);
    expect(await usaSuWhatsapp(2)).toBe(false);
  });

  it('sin la columna todavia, la consulta devuelve true y nadie se queda fuera', async () => {
    // `COALESCE((to_jsonb(u) ->> 'usa_whatsapp')::boolean, true)`: se resuelve en
    // SQL para que una migracion sin aplicar no eche a nadie del chat.
    query.mockResolvedValue({ rows: [{ usa: true }] });
    expect(await usaSuWhatsapp(9)).toBe(true);
    expect(query.mock.calls[0][0]).toContain('to_jsonb');
  });

  it('si esa persona no existe, no se inventa un permiso', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await usaSuWhatsapp(404)).toBe(false);
  });
});
