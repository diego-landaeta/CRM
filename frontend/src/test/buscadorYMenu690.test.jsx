/*
  #690 · Conexión › Webhooks en el menú y en el buscador (Ctrl K).

  · La entrada sale si alguna de las que sustituye se podía abrir: cada una con su
    permiso Y su módulo (`partes`), como salían Captación › Webhooks
    (`module: 'webhooks'`) y Captación › Make (`module: 'make'`).
  · El buscador la encuentra por el nombre de antes, también escrito entero.
  · Los recientes guardados con las direcciones de antes llevan a las nuevas, y
    solo si hoy se pueden abrir.
*/
import { describe, it, expect } from 'vitest';
import { NAV_SECTIONS, canSeeItem } from '@/shared/components/layout/Sidebar';
import { fuzzyScore, rutaDeHoy, recienteSigueValiendo } from '@/shared/components/layout/CommandPalette';

const entrada = NAV_SECTIONS.flatMap((s) => s.items.flatMap((i) => [i, ...(i.children || [])]))
  .find((i) => i.to === '/conexion/webhooks');
const conPermisos = (...p) => (x) => p.includes(x);
const ve = (modules, ...permisos) => canSeeItem(entrada, ['admin'], modules, null, false, null, conPermisos(...permisos));

describe('la entrada del menú, con el permiso y el módulo de cada parte', () => {
  it('solo con «make.view»: sale con Make encendido y no con Make apagado', () => {
    expect(ve({ make: true }, 'make.view')).toBe(true);
    expect(ve({ make: false }, 'make.view')).toBe(false);
  });

  it('solo con «webhooks.view»: sigue al módulo de webhooks', () => {
    expect(ve({ webhooks: true }, 'webhooks.view')).toBe(true);
    expect(ve({ webhooks: false }, 'webhooks.view')).toBe(false);
  });

  it('con Make y Webhooks apagados, quien ve transferencias la sigue viendo (no tenía módulo)', () => {
    expect(ve({ make: false, webhooks: false }, 'make.view', 'webhooks.view', 'webhooks_salientes.view')).toBe(true);
    expect(ve({ make: false, webhooks: false }, 'make.view', 'webhooks.view')).toBe(false);
  });

  it('sin módulos que mirar (con «Todos»), como siempre', () => {
    expect(ve(undefined, 'make.view')).toBe(true);
  });

  it('sin ninguno de los tres permisos, no sale', () => {
    expect(ve({}, 'integrations.view')).toBe(false);
  });
});

describe('el buscador la encuentra por el nombre de antes', () => {
  it.each(['Webhook de transferencias', 'webhooks de captacion', 'Escenarios de Make', 'make', 'transferencias'])('«%s»', (q) => {
    expect(fuzzyScore(entrada.label, entrada.keywords, q)).toBeGreaterThan(0);
  });
});

describe('los recientes de las direcciones de antes', () => {
  it('se traducen a la nueva, con su id y lo que lleven detrás', () => {
    expect(rutaDeHoy('/captacion/make')).toBe('/conexion/webhooks/make');
    expect(rutaDeHoy('/captacion/make/12')).toBe('/conexion/webhooks/make/12');
    expect(rutaDeHoy('/captacion/webhooks/7')).toBe('/conexion/webhooks/prospectos/7');
    expect(rutaDeHoy('/captacion/webhooks?new=1')).toBe('/conexion/webhooks/prospectos?new=1');
    expect(rutaDeHoy('/conexion/webhook-transferencias')).toBe('/conexion/webhooks/transferencias');
    // Lo que no se movió, igual; y una dirección que solo empieza parecido, también.
    expect(rutaDeHoy('/captacion/whatsapp')).toBe('/captacion/whatsapp');
    expect(rutaDeHoy('/captacion/makers')).toBe('/captacion/makers');
  });

  const pages = [{ to: '/conexion/webhooks' }];
  const busca = {};

  it('valen si hoy se puede abrir su pestaña: permiso y módulo', () => {
    const can = conPermisos('make.view');
    expect(recienteSigueValiendo('/conexion/webhooks/make', { pages, busca, can, modules: {} })).toBe(true);
    expect(recienteSigueValiendo('/conexion/webhooks/make/12', { pages, busca, can, modules: {} })).toBe(true);
    // Sin su permiso, o con el módulo apagado, no.
    expect(recienteSigueValiendo('/conexion/webhooks/prospectos', { pages, busca, can, modules: {} })).toBe(false);
    expect(recienteSigueValiendo('/conexion/webhooks/make', { pages, busca, can, modules: { make: false } })).toBe(false);
    // Sin la entrada de Webhooks en el menú, tampoco.
    expect(recienteSigueValiendo('/conexion/webhooks/make', { pages: [], busca, can, modules: {} })).toBe(false);
  });
});
