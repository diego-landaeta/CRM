import { describe, it, expect } from 'vitest';
import { modulosDelTemario, horasDelProducto } from '@/modules/documents/lib/temario';

/**
 * Partir el temario de un producto en módulos (#43).
 *
 * AVISO SOBRE EL ALCANCE DE ESTAS PRUEBAS
 *
 * `modulos_texto` viene RASPADO de la web por el importador de WooCommerce, y
 * en la base local no hay ni un producto que lo tenga: los 12 están a null. O
 * sea que estos casos los he escrito yo a partir del patrón que usa el
 * importador para contarlos, NO copiados de un curso real.
 *
 * Eso significa que cubren la forma esperada y unas cuantas maneras de
 * torcerse, pero **no garantizan** que acierten con el texto que hay en
 * producción. Por eso lo que devuelve va a los campos EDITABLES del
 * formulario: quien emite el certificado ve los módulos y los corrige si el
 * corte salió mal.
 *
 * Con un `modulos_texto` de verdad delante, conviene añadirlo aquí como caso.
 */

describe('cortar el temario en módulos', () => {
  it('parte por «Módulo N» y quita la marca', () => {
    const t = `Módulo 1: Fundamentos de la neuroeducación
Módulo 2: Desarrollo cognitivo
Módulo 3: Evaluación en el aula`;
    expect(modulosDelTemario(t)).toEqual([
      'Fundamentos de la neuroeducación',
      'Desarrollo cognitivo',
      'Evaluación en el aula',
    ]);
  });

  it('aguanta MAYÚSCULAS, sin tilde y con guion', () => {
    // Las tres formas salen del mismo importador según qué web se raspara.
    const t = 'MODULO 1 - Uno\nMÓDULO 2 — Dos\nmodulo 3. Tres';
    expect(modulosDelTemario(t)).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('junta el cuerpo de un módulo que ocupa varias líneas', () => {
    const t = `Módulo 1: Fundamentos
  Qué es la neuroeducación.
  Bases biológicas.
Módulo 2: Práctica`;
    const m = modulosDelTemario(t);
    expect(m[0]).toBe('Fundamentos Qué es la neuroeducación. Bases biológicas.');
    expect(m[1]).toBe('Práctica');
  });

  it('se traga las etiquetas HTML que trae el raspado', () => {
    const t = '<h3>Módulo 1:</h3><p>Fundamentos</p><h3>Módulo 2:</h3><p>Práctica</p>';
    expect(modulosDelTemario(t)).toEqual(['Fundamentos', 'Práctica']);
  });

  it('descarta encabezados sueltos que no son módulos', () => {
    const t = 'Temario\nMódulo 1: Uno\nContenidos\nMódulo 2: Dos';
    expect(modulosDelTemario(t)).toEqual(['Uno', 'Dos']);
  });

  it('un temario SIN numerar devuelve vacío, y eso está bien', () => {
    // No es un fallo: hay cursos cuyo temario no viene numerado. El formulario
    // se queda como estaba y se escriben a mano, como se hace hoy con todos.
    expect(modulosDelTemario('Bloque uno. Bloque dos. Bloque tres.')).toEqual([]);
  });

  it('nulo, vacío y basura no revientan', () => {
    expect(modulosDelTemario(null)).toEqual([]);
    expect(modulosDelTemario('')).toEqual([]);
    expect(modulosDelTemario(undefined)).toEqual([]);
  });

  it('dos llamadas seguidas dan lo mismo', () => {
    // Una regex con /g guarda `lastIndex` entre usos. Si se reutilizara la
    // misma instancia, la segunda llamada empezaría a medias y devolvería
    // menos módulos que la primera — sin error y sin que nadie lo note.
    const t = 'Módulo 1: Uno\nMódulo 2: Dos';
    expect(modulosDelTemario(t)).toEqual(modulosDelTemario(t));
    expect(modulosDelTemario(t)).toHaveLength(2);
  });
});

describe('las horas', () => {
  it('saca el número de un texto libre', () => {
    // El PDF ya escribe «Por un total de X horas»: mandar «750 horas» pondría
    // «750 horas horas».
    expect(horasDelProducto('750 horas')).toBe('750');
    expect(horasDelProducto('750h')).toBe('750');
    expect(horasDelProducto('750')).toBe('750');
  });

  it('cae en la duración si no hay horas', () => {
    expect(horasDelProducto(null, '600 horas')).toBe('600');
  });

  it('quita el punto de millar', () => {
    expect(horasDelProducto('1.500 horas')).toBe('1500');
  });

  it('sin nada devuelve vacío, no un cero', () => {
    // Un «0» impreso en un certificado es peor que un hueco: parece un dato.
    expect(horasDelProducto(null, null)).toBe('');
    expect(horasDelProducto('a definir')).toBe('');
  });
});
