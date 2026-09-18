import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * El histórico de ingreso tiene que ser el NETO (#44).
 *
 * Ángel, 18/09, de los cobros de prueba de Tarot: «nos devolvimos el dinero…
 * debes tener más lógica para registro histórico real de ingreso».
 *
 * `importe_pagado` es lo que ENTRÓ y no baja cuando se devuelve —hace bien, el
 * cobro existió—, pero el histórico de ingreso no puede ser ese número: si se
 * cobraron 9,99 € y se devolvieron, la empresa se quedó con cero y el CRM
 * seguía diciendo 9,99.
 *
 * Las devoluciones ya se registraban y solo se veían dentro de la ficha de un
 * cliente. En ninguna suma.
 */

const modelo = readFileSync(
  new URL('../src/modules/conversions/conversion.model.js', import.meta.url), 'utf8');

describe('lo devuelto', () => {
  it('se resta en los totales', () => {
    expect(modelo).toMatch(/AS total_devuelto/);
    expect(modelo).toMatch(/neto: Number\(/);
  });

  it('se suma por venta, no de una vez sobre la tabla entera', () => {
    // Un SUM suelto sobre `conversion_refunds` traeria las devoluciones de
    // TODOS los proyectos y periodos: el filtro de la pantalla dejaria de
    // valer y el neto de un mes saldria negativo sin motivo.
    expect(modelo).toMatch(/WHERE cr\.conversion_id = c\.id/);
  });

  it('el bruto se mantiene aparte', () => {
    // Hay pantallas que necesitan lo que entro de verdad --conciliar con el
    // banco, por ejemplo--. El neto se añade, no sustituye.
    expect(modelo).toMatch(/pagado: Number\(countRows\[0\]\.total_pagado\)/);
  });
});
