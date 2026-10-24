import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tieneWhatsapp, ROLES_CON_WHATSAPP } from '@/shared/lib/roles';

/**
 * QA de Diego, 22/10, punto 8: «El tutor recibe 403 cada pocos segundos en
 * `/api/whatsapp/sin-leer`: no llamar para quien no tiene WhatsApp.»
 *
 * Los avisos de mensajes y de llamadas viven en AppLayout, en todas las
 * pantallas y para todos. Solo se montan para quien tiene WhatsApp, con el
 * mismo criterio que el servidor (`whatsapp/roles.js`, `porQueNoPuede`).
 */

describe('a quién le corresponde WhatsApp', () => {
  it('al tutor, no: es el caso del QA', () => {
    expect(tieneWhatsapp({ role: 'tutor' })).toBe(false);
  });

  it('tampoco al tutor con otro rol añadido: el servidor mira el principal', () => {
    expect(tieneWhatsapp({ role: 'tutor', roles_extra: ['gestor'] })).toBe(false);
  });

  it('ni al colaborador (QA del 07/10), ni a quien lleva colaboraciones', () => {
    expect(tieneWhatsapp({ role: 'colaborador' })).toBe(false);
    expect(tieneWhatsapp({ role: 'gestor', gestor_colaboraciones: true })).toBe(false);
  });

  it('sí a la gestora que además da clase, y a admin, super admin y soporte', () => {
    expect(tieneWhatsapp({ role: 'gestor', roles_extra: ['tutor'] })).toBe(true);
    for (const role of ['admin', 'superadmin', 'soporte']) expect(tieneWhatsapp({ role })).toBe(true);
  });

  it('ni a quien tiene la casilla «usa WhatsApp» apagada en su ficha (el 403 de Manuel y Diego en la prueba)', () => {
    expect(tieneWhatsapp({ role: 'admin', usa_whatsapp: false })).toBe(false);
    expect(tieneWhatsapp({ role: 'superadmin', usa_whatsapp: false })).toBe(false);
    expect(tieneWhatsapp({ role: 'gestor', usa_whatsapp: true })).toBe(true);
  });

  it('sin la columna (null) no se le niega a nadie, como en el servidor', () => {
    expect(tieneWhatsapp({ role: 'gestor', usa_whatsapp: null })).toBe(true);
  });

  it('sin sesión, no pregunta', () => {
    expect(tieneWhatsapp(null)).toBe(false);
  });
});

describe('el mismo criterio que el servidor', () => {
  it('la lista de roles es la de backend/src/modules/whatsapp/roles.js', () => {
    const servidor = readFileSync(resolve(process.cwd(), '../backend/src/modules/whatsapp/roles.js'), 'utf8');
    const lista = servidor.match(/export const ROLES_CON_WHATSAPP = \[([^\]]*)\]/);
    expect(lista, 'no se encuentra ROLES_CON_WHATSAPP en el servidor').toBeTruthy();
    const roles = [...lista[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect([...ROLES_CON_WHATSAPP].sort()).toEqual(roles.sort());
  });

  it('AppLayout monta los avisos según tieneWhatsapp', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/shared/components/layout/AppLayout.jsx'), 'utf8');
    expect(layout).toMatch(/const sinWhatsapp = !tieneWhatsapp\(user\)/);
    expect(layout).toMatch(/\{!sinWhatsapp && \(\s*<Suspense fallback=\{null\}>\s*<AvisoDeLlamada \/>\s*<AvisoDeMensaje \/>/);
  });
});
