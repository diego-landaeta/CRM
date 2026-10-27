// El menú del equipo de desarrollo (Diego, 26/10/2026): «que solo puedan ver eso» —Tareas y
// su factura de colaborador— y Meta Ads a quien se le da (Ruth, Julián, Jesús, Emmanuel;
// en ISEIE también Jonathan y Gustavo). Con el menú de verdad (NAV_SECTIONS), no con una copia.
import { describe, it, expect } from 'vitest';

const { NAV_SECTIONS, canSeeItem, pasaPermisoDeRoles } = await import('@/shared/components/layout/Sidebar');

const can = (lista) => (k) => lista.includes(k);
// Lo mismo que hace el Sidebar con cada entrada (y con los hijos de un grupo).
function loQueVe(roles, user, permisos) {
  const c = can(permisos);
  const pasa = (item) => pasaPermisoDeRoles(item, c) && canSeeItem(item, roles, {}, 'crm', false, user, c);
  return NAV_SECTIONS.flatMap((s) => s.items).filter(pasa).flatMap((it) => (it.children ? it.children.filter(pasa) : [it]))
    .map((it) => it.to).filter(Boolean);
}
const COLABORADOR = ['tasks.view_own', 'tasks.create', 'tasks.edit', 'facturas_colaborador.subir'];

describe('menú · equipo de desarrollo', () => {
  it('un colaborador ve Tareas, «Mi factura» y sus preferencias; nada de prospectos, ventas ni finanzas', () => {
    const ve = loQueVe(['colaborador'], { role: 'colaborador' }, COLABORADOR);
    expect(ve).toEqual(expect.arrayContaining(['/tareas', '/mi-factura', '/preferencias']));
    for (const no of ['/prospectos', '/finanzas/ventas', '/finanzas/facturas', '/meta-ads', '/tareas/revisar', '/tareas/configurar']) {
      expect(ve, no).not.toContain(no);
    }
  });

  it('con «Meta Ads (ver)» le sale Meta Ads, y nada más de Publicidad', () => {
    const ve = loQueVe(['colaborador'], { role: 'colaborador' }, [...COLABORADOR, 'meta_ads.view']);
    expect(ve).toContain('/meta-ads');
    expect(ve).not.toContain('/google-ads');
    expect(ve).not.toContain('/prospectos');
  });

  it('un encargado (con Asignar y Ver todo) ve lo mismo: asignar no abre más menú', () => {
    const ve = loQueVe(['colaborador'], { role: 'colaborador' }, [...COLABORADOR, 'tasks.assign', 'tasks.view_all']);
    expect(ve).toContain('/tareas');
    expect(ve).not.toContain('/prospectos');
  });

  it('un colaborador con «Diplomas · Ver» sigue sin Diplomas (no es para él)', () => {
    const ve = loQueVe(['colaborador'], { role: 'colaborador' }, [...COLABORADOR, 'diplomas.view']);
    expect(ve.some((r) => r.includes('diplomas'))).toBe(false);
  });

  it('una gestora con «Meta Ads (ver)» también la ve; sin él, no', () => {
    expect(loQueVe(['gestor'], { role: 'gestor' }, ['meta_ads.view'])).toContain('/meta-ads');
    expect(loQueVe(['gestor'], { role: 'gestor' }, [])).not.toContain('/meta-ads');
  });
});

describe('«Mi tablero» (Diego, 26/10/2026)', () => {
  it('la entrada del menú se llama «Mi tablero»', () => {
    const entrada = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.to === '/tareas');
    expect(entrada.label).toBe('Mi tablero');
  });

  it('se entra siempre en «Mi tablero», que pide lo suyo (lleva, supervisa o creó), sea quien sea', async () => {
    const { VISTA_INICIAL, filtroDeVista } = await import('@/modules/tasks/lib/taskUi');
    expect(VISTA_INICIAL).toBe('mio');
    expect(filtroDeVista('mio')).toEqual({ mias: true });
    expect(filtroDeVista('equipo')).toEqual({});
    expect(filtroDeVista(7)).toEqual({ assigned_to: 7 });
  });
});
