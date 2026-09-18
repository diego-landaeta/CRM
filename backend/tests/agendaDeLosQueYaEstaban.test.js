import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * La migracion que rellena la agenda dice lo mismo que el codigo (#89 · #90).
 *
 * `planificarPasosDeLead` escribe la agenda de UNA persona al entrar; la
 * migracion 178 la escribe de golpe para los que ya estaban. Son la misma
 * regla escrita dos veces, y si divergen nadie lo nota: la cola simplemente
 * enseña a gente distinta segun cuando entro.
 *
 * Esto no prueba SQL contra la base —eso lo prueba la propia migracion al
 * aplicarse—, prueba que las dos versiones siguen de acuerdo en lo que importa.
 */

const migracion = readFileSync(
  new URL('../migrations/178_agenda_de_los_que_ya_estaban.sql', import.meta.url), 'utf8');
const modelo = readFileSync(
  new URL('../src/modules/proceso/proceso.model.js', import.meta.url), 'utf8');

/** El INSERT de la migracion, sin la parrafada de arriba. */
const sql = migracion.slice(migracion.indexOf('BEGIN;'));

describe('la agenda de los que ya estaban', () => {
  it('cuenta los dias desde que ENTRO, no desde hoy', () => {
    // Dos tercios de los prospectos cargados tienen la solicitud anterior al
    // alta. Contando desde `created_at` a secas, la cola de un lead importado
    // empezaria hoy y diria que no le toca nada hasta dentro de una semana.
    expect(sql).toMatch(/COALESCE\(l\.fecha_solicitud, l\.created_at\)/);
    expect(modelo).toMatch(/COALESCE\(l\.fecha_solicitud, l\.created_at\)/);
  });

  it('deja fuera el seguimiento de fin de mes, igual que el codigo', () => {
    // No es del recorrido de una persona: es de toda la base a fin de mes.
    // Metido en la agenda, la cola del dia se llena con la base entera.
    expect(sql).toMatch(/es_seguimiento = false/);
    expect(modelo).toMatch(/s\.es_seguimiento = false/);
  });

  it('solo pasos activos', () => {
    expect(sql).toMatch(/s\.activo = true/);
    expect(modelo).toMatch(/s\.activo = true/);
  });

  it('no le escribe agenda a quien ya cerro', () => {
    // Quien compro o dijo que no sale de la cola de todos modos: escribirsela
    // seria llenar la tabla sin efecto ninguno.
    expect(sql).toMatch(/status NOT IN \('convertido', 'no_interesado'\)/);
  });

  it('ni a los borrados', () => {
    expect(sql).toMatch(/l\.deleted_at IS NULL/);
    expect(modelo).toMatch(/l\.deleted_at IS NULL/);
  });

  it('se puede volver a pasar sin duplicar', () => {
    expect(sql).toMatch(/ON CONFLICT \(lead_id, clave\) DO NOTHING/);
  });

  it('la ventana de dias esta escrita y se puede cambiar', () => {
    // El numero es una decision, no un detalle: con toda la base historica la
    // cola amanece con cientos de pasos «atrasados desde hace dos años» y deja
    // de poder mirarse. Si alguien la cambia, que sea a sabiendas.
    expect(sql).toMatch(/CURRENT_DATE - 90/);
    expect(migracion).toMatch(/PARA CAMBIAR LA VENTANA/);
  });
});
