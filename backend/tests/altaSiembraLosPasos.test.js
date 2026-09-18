import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Dar de alta una marca le deja el proceso comercial montado (#87).
 *
 * Es la otra mitad de `pasosDeLaMarcaNueva.test.js`: alli se prueba que la
 * siembra pone los cinco; aqui, que el alta la llama. Sin esto el grifo sigue
 * abierto aunque la funcion exista.
 */

const sembrar = vi.fn(async () => 5);
vi.mock('../src/modules/proceso/proceso.model.js', () => ({ sembrarPorDefecto: sembrar }));

const sql = [];
vi.mock('../src/shared/config/db.js', () => ({
  query: vi.fn(async (texto) => {
    sql.push(texto);
    if (/INSERT INTO projects/i.test(texto)) return { rows: [{ id: 77, nombre: 'Marca' }] };
    return { rows: [] };
  }),
}));

const errores = [];
vi.mock('../src/shared/utils/logger.js', () => ({
  logger: { error: (...a) => errores.push(a), info: () => {}, warn: () => {}, debug: () => {} },
}));

const { create } = await import('../src/modules/projects/project.model.js');

const marca = (type = 'crm') => ({
  nombre: 'Marca', slug: 'marca', type, emoji: 'x',
  meta_account_id: null, google_account_id: null, gsc_property: null,
  dias_alerta_inactividad: 3,
});

describe('el alta de una marca', () => {
  beforeEach(() => { sembrar.mockClear(); sql.length = 0; errores.length = 0; });

  it('le siembra los cinco pasos', async () => {
    const p = await create(marca());
    expect(sembrar).toHaveBeenCalledWith(p.id);
  });

  it('tambien a los proyectos que no son CRM', async () => {
    // La cola de reparto sí es solo de `crm`, los pasos no: los proyectos IA
    // tambien tienen gente a la que perseguir, y la migracion que los sembro
    // no distinguia por tipo.
    await create(marca('ia'));
    expect(sembrar).toHaveBeenCalledTimes(1);
    expect(sql.some((s) => /project_queue_state/i.test(s))).toBe(false);
  });

  it('si la siembra falla, la marca se crea igual', async () => {
    // La marca ya esta escrita cuando se siembra. Devolver un error aqui haria
    // pensar que no se creo, y la crearian otra vez. Un proyecto sin pasos se
    // arregla desde la pantalla; dos proyectos duplicados, no tanto.
    sembrar.mockRejectedValueOnce(new Error('la base dijo que no'));

    const p = await create(marca());
    expect(p.id).toBe(77);
    expect(errores).toHaveLength(1);
  });
});
