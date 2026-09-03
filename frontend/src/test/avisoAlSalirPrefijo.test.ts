import { describe, it, expect } from 'vitest';

/**
 * Salir del chat tiene que llevar a donde ibas, no a una pagina que no existe.
 *
 * El CRM se sirve bajo un prefijo —«/crm»— y el aviso de «vas a salir del chat»
 * guardaba el `href` del enlace, que ya lo lleva puesto. Al confirmar llamaba a
 * `navigate()` con esa ruta, y `navigate()` trabaja RELATIVO a su basename: le
 * ponia el prefijo otra vez.
 *
 * Resultado, visto en pantalla: pulsar «enlazar mi numero» y luego «salir de
 * todas formas» acababa en `/crm/crm/whatsapp/conexion`. Pagina en blanco.
 *
 * Y no se cazaba en local por accidente: solo pasa cuando hay prefijo, que es
 * como se sirve en produccion.
 *
 * `window.open` en cambio SI quiere la ruta con el prefijo, porque es una
 * direccion de navegador. Por eso hay dos y no una.
 */

/** Copia exacta de la de `AvisoAlSalir.tsx`, con el prefijo como parametro. */
const sinElPrefijo = (ruta: string, base: string): string => {
  const prefijo = (base || '/').replace(/\/$/, '');
  if (!prefijo || prefijo === '/') return ruta;
  if (ruta === prefijo) return '/';
  return ruta.startsWith(`${prefijo}/`) ? ruta.slice(prefijo.length) : ruta;
};

describe('servido bajo /crm', () => {
  it('quita el prefijo, que si no se duplica', () => {
    expect(sinElPrefijo('/crm/whatsapp/conexion', '/crm/')).toBe('/whatsapp/conexion');
  });

  it('la raiz del CRM es la raiz del router', () => {
    expect(sinElPrefijo('/crm', '/crm/')).toBe('/');
  });

  it('conserva lo que va detras', () => {
    expect(sinElPrefijo('/crm/prospectos?estado=nuevo', '/crm/')).toBe('/prospectos?estado=nuevo');
  });

  it('una ruta que NO empieza por el prefijo se deja como esta', () => {
    // `/crmulento` no esta dentro de `/crm`: cortar por longitud lo romperia.
    expect(sinElPrefijo('/crmulento', '/crm/')).toBe('/crmulento');
  });

  it('y otra seccion del sitio tampoco se toca', () => {
    expect(sinElPrefijo('/testeo2/prospectos', '/crm/')).toBe('/testeo2/prospectos');
  });
});

describe('servido en la raiz', () => {
  it('no hay nada que quitar', () => {
    expect(sinElPrefijo('/whatsapp/conexion', '/')).toBe('/whatsapp/conexion');
  });

  it('sin base declarada tampoco', () => {
    expect(sinElPrefijo('/whatsapp/conexion', '')).toBe('/whatsapp/conexion');
  });
});
