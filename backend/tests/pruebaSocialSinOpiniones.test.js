import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';

/**
 * El paso 2 avisa si la formación no tiene opiniones (#91).
 *
 * El documento lo pone en recuadro: «si no tiene opiniones, enviar la captura
 * de la vista general de Opynio y pedir internamente que se cree la opinión de
 * ese curso — NO LO DEJES PASAR».
 *
 * La segunda mitad es la que se pierde. Pedir que la creen no beneficia a la
 * conversación de hoy: beneficia al prospecto de la semana que viene, que si
 * no se encuentra el mismo curso sin opiniones.
 */

vi.mock('../src/shared/config/db.js', () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

const modelo = readFileSync(
  new URL('../src/modules/proceso/proceso.model.js', import.meta.url), 'utf8');

describe('la prueba social', () => {
  it('el paso dice si es el suyo, y no lo decide la pantalla', () => {
    // Mismo patrón que `avisa_plazas` y `ofrece_descuento`: si mañana la
    // prueba social se mueve al paso 3, se cambia la marca y no el código.
    expect(modelo).toMatch(/pide_opiniones/);
  });

  it('la agenda trae si la formación tiene opiniones', () => {
    expect(modelo).toMatch(/p\.opiniones_publicadas/);
  });

  it('es un campo del catálogo, editable, no una integración con Opynio', () => {
    // Traer las opiniones de Opynio sería una integración entera —clave,
    // sincronización, fallos— para contestar un sí o un no que cambia una vez
    // al año por curso.
    const producto = readFileSync(
      new URL('../src/modules/products/product.model.js', import.meta.url), 'utf8');
    expect(producto).toMatch(/opiniones_publicadas/);
  });

  it('«no consta» es un tercer estado, no un no', () => {
    // Si el campo fuera NOT NULL DEFAULT false, todas las formaciones dirían
    // «no tiene opiniones» desde el primer día y el aviso sería ruido en todas
    // las fichas hasta que alguien las repasara una a una.
    const migracion = readFileSync(
      new URL('../migrations/182_opiniones_de_la_formacion.sql', import.meta.url), 'utf8');
    expect(migracion).toMatch(/ADD COLUMN IF NOT EXISTS opiniones_publicadas BOOLEAN;/);
    expect(migracion).not.toMatch(/opiniones_publicadas BOOLEAN NOT NULL/);
  });
});
