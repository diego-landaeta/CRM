import { describe, it, expect } from 'vitest';
import {
  siguientePaso, tonoDelPaso, sePuedePlanificar, fechaAplazada, cuentaDeHechos,
} from '@/modules/proceso/lib/agenda';
import { soloFecha } from '@/shared/lib/fechas';

/*
  La agenda del proceso en la ficha del prospecto (#89).

  Lo que se prueba aquí es lo que decide la pantalla. En qué paso va cada
  persona lo decide el servidor y llega hecho: si algún día esto empezara a
  calcularlo, la ficha y la cola del día dirían cosas distintas.
*/

const paso = (extra = {}) => ({
  id: 1, clave: 'paso_1', orden: 1, nombre: 'Primer contacto',
  cuando: null, canales: null, nota_del_paso: null,
  fecha_prevista: '2026-09-16', estado: 'pendiente', nota: null,
  hecho: false, vencido: false, dias_de_retraso: 0, avisa_plazas: false,
  ...extra,
});

describe('cuál es el paso que manda', () => {
  it('es el primero que no está ni hecho ni saltado', () => {
    const pasos = [
      paso({ id: 1, hecho: true }),
      paso({ id: 2, estado: 'saltado' }),
      paso({ id: 3 }),
      paso({ id: 4 }),
    ];
    expect(siguientePaso(pasos)?.id).toBe(3);
  });

  it('se destaca uno solo aunque haya tres sin hacer', () => {
    const pasos = [paso({ id: 7 }), paso({ id: 8 }), paso({ id: 9 })];
    expect(siguientePaso(pasos)?.id).toBe(7);
  });

  it('con todo cerrado no hay siguiente, y eso no es un fallo', () => {
    expect(siguientePaso([paso({ hecho: true })])).toBeNull();
    expect(siguientePaso([])).toBeNull();
    expect(siguientePaso(null)).toBeNull();
  });
});

describe('con qué cara se pinta cada paso', () => {
  it('un paso hecho fuera de plazo es un paso hecho, no un atraso', () => {
    expect(tonoDelPaso(paso({ hecho: true, vencido: true, dias_de_retraso: 4 }))).toBe('hecho');
  });

  it('distingue saltado, vencido, hoy y próximo', () => {
    expect(tonoDelPaso(paso({ estado: 'saltado' }))).toBe('saltado');
    expect(tonoDelPaso(paso({ vencido: true, dias_de_retraso: 2 }))).toBe('vencido');
    expect(tonoDelPaso(paso({ dias_de_retraso: 0 }))).toBe('hoy');
    expect(tonoDelPaso(paso({ dias_de_retraso: 3 }))).toBe('proximo');
  });
});

describe('a quién se le ofrece planificarle el proceso', () => {
  it('a quien sigue vivo', () => {
    for (const e of ['nuevo', 'por_contactar', 'contactado', 'en_seguimiento']) {
      expect(sePuedePlanificar(e)).toBe(true);
    }
  });

  it('a quien compró o dijo que no, no: su proceso terminó', () => {
    expect(sePuedePlanificar('convertido')).toBe(false);
    expect(sePuedePlanificar('no_interesado')).toBe(false);
  });

  it('sin estado tampoco, que es mejor callarse que inventar una agenda', () => {
    expect(sePuedePlanificar(null)).toBe(false);
    expect(sePuedePlanificar(undefined)).toBe(false);
    expect(sePuedePlanificar('')).toBe(false);
  });
});

describe('a qué fecha se aplaza', () => {
  it('cuenta desde hoy, no desde la fecha que tenía puesta', () => {
    const hoy = new Date(2026, 8, 16); // 16/09/2026
    expect(fechaAplazada(1, hoy)).toBe('2026-09-17');
    expect(fechaAplazada(3, hoy)).toBe('2026-09-19');
    expect(fechaAplazada(7, hoy)).toBe('2026-09-23');
  });

  it('cruza el fin de mes y el fin de año', () => {
    expect(fechaAplazada(1, new Date(2026, 8, 30))).toBe('2026-10-01');
    expect(fechaAplazada(3, new Date(2026, 11, 30))).toBe('2027-01-02');
  });

  it('a las once de la noche sigue devolviendo el día de mañana', () => {
    // Con `toISOString()` esto devolvería el 16: la hora se va a UTC y en
    // España resta un día.
    expect(fechaAplazada(1, new Date(2026, 8, 16, 23, 30))).toBe('2026-09-17');
  });
});

// `soloFecha` es de `shared/lib/fechas` y no de este módulo. Se prueba aquí
// porque es donde salió el fallo: la ficha la pintaba con `new Date(iso)` a
// secas y el paso de hoy aparecía fechado ayer.
describe('qué día es una fecha del servidor', () => {
  it('es el mismo día, esté el navegador en el huso que esté', () => {
    // Con `new Date(\'2026-09-16\')` esto daba el 15 en Caracas: la fecha se
    // lee como medianoche UTC y al pintarla en un huso al oeste retrocede.
    const d = soloFecha('2026-09-16');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(16);
  });

  it('un primero de mes no se convierte en el último del anterior', () => {
    expect(soloFecha('2026-01-01').getDate()).toBe(1);
    expect(soloFecha('2026-01-01').getMonth()).toBe(0);
    expect(soloFecha('2026-01-01').getFullYear()).toBe(2026);
  });

  it('si viene con hora, se respeta tal cual', () => {
    const d = soloFecha('2026-09-16T15:30:00');
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(15);
  });
});

describe('la cuenta de la cabecera', () => {
  it('cuenta los hechos, no los saltados', () => {
    const pasos = [
      paso({ id: 1, hecho: true }),
      paso({ id: 2, hecho: true }),
      paso({ id: 3, estado: 'saltado' }),
      paso({ id: 4 }),
    ];
    expect(cuentaDeHechos(pasos)).toBe(2);
    expect(cuentaDeHechos([])).toBe(0);
    expect(cuentaDeHechos(null)).toBe(0);
  });
});
