import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * «Sin los tres, el correo no sale» (#91).
 *
 * El correo del día 1 lleva el dossier de la formación, la guía del campus y
 * las homologaciones. El documento comercial no lo deja a interpretación, y el
 * ticket lo subraya: **eso es una validación, no un recordatorio**.
 *
 * Lo que se fija aquí es que la comprobación ocurra ANTES de llamar al
 * proveedor de correo. Un correo a medias ya salió y no se puede recoger.
 */

const query = vi.fn();
vi.mock('../src/shared/config/db.js', () => ({
  query: (...a) => query(...a),
  getClient: vi.fn(),
  default: {},
}));
vi.mock('../src/shared/utils/presignedUrl.js', () => ({
  generatePresignedUrl: async (key) => `https://r2.local/${key}?firma=x`,
}));

const { adjuntosDelDiaUno, losTresDelDiaUno } =
  await import('../src/modules/leads/adjuntosDelDiaUno.js');

const LEAD = {
  id: 6, project_id: 1, producto_interes_id: 9, producto: 'Máster',
  dossier_key: 'dossiers/1/abc.pdf', dossier_nombre: 'dossier-master.pdf',
};

/** La base responde: primero el prospecto, luego los documentos de la marca. */
function base({ lead = LEAD, marca = [] } = {}) {
  query.mockReset();
  query.mockImplementation(async (sql) => {
    if (/FROM leads l/i.test(sql)) return { rows: lead ? [lead] : [] };
    return { rows: marca };
  });
}

const GUIA = { tipo: 'guia_campus', s3_key: 'documentos-marca/1/guia.pdf', nombre_visible: 'Guía del campus virtual' };
const HOMO = { tipo: 'homologaciones', s3_key: 'documentos-marca/1/homo.pdf', nombre_visible: 'Homologaciones y acreditaciones' };

describe('los tres del día 1', () => {
  it('con los tres, salen los tres enlaces', async () => {
    base({ marca: [GUIA, HOMO] });
    const { listos, faltan } = await adjuntosDelDiaUno(6);

    expect(faltan).toEqual([]);
    expect(listos).toHaveLength(3);
    // Por enlace y no en base64: el dossier de un máster pasa de 10 MB él solo.
    for (const a of listos) expect(a.url).toMatch(/^https:\/\//);
  });

  it('sin la guía del campus, NO hay adjuntos y se dice cuál falta', async () => {
    base({ marca: [HOMO] });
    const { listos, faltan } = await adjuntosDelDiaUno(6);

    expect(listos).toBeNull();
    // «Faltan adjuntos» obliga a ir a buscar cuál. Se dice.
    expect(faltan).toEqual(['la guía del campus']);
  });

  it('sin formación puesta tampoco sale: no hay dossier que mandar', async () => {
    // No es una excepción a la regla, es la misma regla.
    base({ lead: { ...LEAD, producto_interes_id: null, dossier_key: null }, marca: [GUIA, HOMO] });
    const { listos, faltan } = await adjuntosDelDiaUno(6);

    expect(listos).toBeNull();
    expect(faltan).toEqual(['el dossier de la formación']);
  });

  it('si falta todo, los nombra todos', async () => {
    base({ lead: { ...LEAD, dossier_key: null }, marca: [] });
    const { faltan } = await adjuntosDelDiaUno(6);
    expect(faltan).toHaveLength(3);
  });

  it('el nombre que le llega al cliente no es el del archivo subido', async () => {
    // Lo que sube el equipo se llama «guia-campus-v3-FINAL.pdf».
    base({ marca: [GUIA, HOMO] });
    const { listos } = await adjuntosDelDiaUno(6);
    const nombres = listos.map((a) => a.name);

    expect(nombres).toContain('Guía del campus virtual.pdf');
    expect(nombres).not.toContain('guia-campus-v3-FINAL.pdf');
  });

  it('y siempre acaba en .pdf, o el correo no sabe qué es', async () => {
    base({ marca: [GUIA, HOMO] });
    const { listos } = await adjuntosDelDiaUno(6);
    for (const a of listos) expect(a.name).toMatch(/\.pdf$/i);
  });

  it('un prospecto que no existe es un error, no una lista vacía', async () => {
    base({ lead: null });
    await expect(losTresDelDiaUno(999)).rejects.toThrow(/no existe/i);
  });
});
