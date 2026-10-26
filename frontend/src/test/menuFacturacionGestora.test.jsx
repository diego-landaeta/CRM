// La entrada «Facturación» del menú para una gestora que factura (Diego, 23/10/2026:
// «a Yolanda no le salen las funciones de facturación»).
//
// Desde el 07/10 el menú le preguntaba a `can('factura_manager')`, que es una casilla
// del usuario y no una clave del sistema de Roles: daba false y la entrada no salía a
// ninguna gestora, por mucho que tuviera la casilla puesta.
import { describe, it, expect } from 'vitest';

const { NAV_SECTIONS, canSeeItem, pasaPermisoDeRoles } = await import('@/shared/components/layout/Sidebar');

const entrada = (to) => NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.to === to);
// Como el `can` de verdad para una gestora: el mapa de Roles no tiene `factura_manager`.
const can = (lista) => (k) => lista.includes(k);
const seVe = (item, roles, user, permisos = []) =>
  pasaPermisoDeRoles(item, can(permisos)) && canSeeItem(item, roles, {}, 'crm', false, user, can(permisos));

describe('menú › Facturación', () => {
  const facturacion = entrada('/finanzas/facturas');
  const yolanda = { role: 'gestor', roles_extra: ['tutor'], factura_manager: true };

  it('existe y pide la casilla «factura_manager»', () => {
    expect(facturacion?.permiso).toBe('factura_manager');
  });

  it('el filtro de antes la escondía aunque tuviera la casilla (el fallo)', () => {
    const filtroDeAntes = (item, c) => !item.permiso || c(item.permiso);
    expect(filtroDeAntes(facturacion, can([]))).toBe(false);
  });

  it('a Yolanda (gestora + tutora, con la casilla) le sale', () => {
    expect(seVe(facturacion, ['gestor', 'tutor'], yolanda)).toBe(true);
  });

  it('a Ana y Dayana (gestoras con la casilla) también', () => {
    expect(seVe(facturacion, ['gestor'], { role: 'gestor', factura_manager: true })).toBe(true);
  });

  it('a una gestora sin la casilla, no', () => {
    expect(seVe(facturacion, ['gestor'], { role: 'gestor', factura_manager: false })).toBe(false);
  });

  it('a admin, por su rol', () => {
    expect(seVe(facturacion, ['admin'], { role: 'admin' })).toBe(true);
  });
});

describe('las claves del sistema de Roles siguen pasando por `can`', () => {
  it('«Por revisar» (tasks.close) solo con el permiso', () => {
    const item = entrada('/tareas/revisar');
    expect(item?.permiso).toBe('tasks.close');
    expect(pasaPermisoDeRoles(item, can([]))).toBe(false);
    expect(pasaPermisoDeRoles(item, can(['tasks.close']))).toBe(true);
  });

  it('una entrada sin permiso pasa siempre', () => {
    expect(pasaPermisoDeRoles({ to: '/x' }, can([]))).toBe(true);
  });
});
