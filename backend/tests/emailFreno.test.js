import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { dejaPasar, porQueSeParo } from '../src/shared/services/email-freno.service.js';

// El freno de correo: fuera de produccion no sale ni uno a un cliente real.
//
// Es la tercera subfase de la tarea #27 y la que mas urgia. Antes de esto,
// cualquier prueba en `/testeo` mandaba correo de verdad a quien fuera — y con
// los reintentos que se acababan de poner, lo intentaba tres veces.
//
// Se prueba la REGLA sola, sin Brevo ni base de datos: es una decision de si o
// no, y probarla a traves de todo lo demas la haria lenta y fragil justo donde
// tiene que ser fiable.

const ANTES = process.env.NODE_ENV;
const ANTES_LISTA = process.env.EMAIL_LISTA_BLANCA;

beforeEach(() => {
  process.env.NODE_ENV = 'development';
  process.env.EMAIL_LISTA_BLANCA = '';
});

afterAll(() => {
  process.env.NODE_ENV = ANTES;
  if (ANTES_LISTA === undefined) delete process.env.EMAIL_LISTA_BLANCA;
  else process.env.EMAIL_LISTA_BLANCA = ANTES_LISTA;
});

describe('el freno de correo', () => {
  it('en produccion no frena nada', () => {
    process.env.NODE_ENV = 'production';
    expect(dejaPasar('cliente.real@gmail.com').pasa).toBe(true);
  });

  it('en produccion pasa aunque no haya lista blanca', () => {
    // La lista es cosa de los entornos de prueba. Exigirla en produccion seria
    // dejar el CRM sin mandar un solo correo el dia que alguien la borre.
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_LISTA_BLANCA = '';
    expect(dejaPasar('quien.sea@gmail.com').pasa).toBe(true);
  });

  it('fuera de produccion y SIN lista blanca, no sale nada', () => {
    // A proposito, y es la decision importante: quien monte un entorno nuevo y
    // se olvide de configurarla se encuentra con que no le llegan los correos.
    // Eso es un problema visible y sin consecuencias. Al reves —dejar pasar
    // todo por defecto— el problema es invisible y se lo come un cliente.
    const r = dejaPasar('angel@empresa.com');
    expect(r.pasa).toBe(false);
    expect(r.motivo).toBe('SIN_LISTA_BLANCA');
  });

  it('deja pasar una direccion que esta en la lista', () => {
    process.env.EMAIL_LISTA_BLANCA = 'angel@empresa.com, diego@empresa.com';
    expect(dejaPasar('angel@empresa.com').pasa).toBe(true);
  });

  it('para una que no esta', () => {
    process.env.EMAIL_LISTA_BLANCA = 'angel@empresa.com';
    const r = dejaPasar('cliente.real@gmail.com');
    expect(r.pasa).toBe(false);
    expect(r.motivo).toBe('FUERA_DE_LA_LISTA');
    expect(r.bloqueados).toEqual(['cliente.real@gmail.com']);
  });

  it('un dominio entero con @ deja pasar a cualquiera de la casa', () => {
    process.env.EMAIL_LISTA_BLANCA = '@empresa.com';
    expect(dejaPasar('quien.sea@empresa.com').pasa).toBe(true);
    expect(dejaPasar('otro@empresa.com').pasa).toBe(true);
    expect(dejaPasar('alguien@otracosa.com').pasa).toBe(false);
  });

  it('si UNO de varios destinatarios es real, no se manda a NINGUNO', () => {
    // Es el caso que de verdad importa: los avisos a administradores van a
    // varias direcciones en una sola cadena. Mandarlo a los autorizados y
    // quitar al de fuera seria peor —un correo a medias que parece completo— y
    // mandarlo entero seria justo lo que se quiere evitar.
    process.env.EMAIL_LISTA_BLANCA = '@empresa.com';
    const r = dejaPasar('a@empresa.com,b@empresa.com,cliente.real@gmail.com');
    expect(r.pasa).toBe(false);
    expect(r.bloqueados).toEqual(['cliente.real@gmail.com']);
  });

  it('sin destinatario, no pasa', () => {
    process.env.EMAIL_LISTA_BLANCA = '@empresa.com';
    expect(dejaPasar('').pasa).toBe(false);
    expect(dejaPasar(null).motivo).toBe('SIN_DESTINATARIO');
  });

  it('no distingue mayusculas ni espacios sobrantes', () => {
    // La lista la escribe una persona en un `.env`, con lo que eso implica.
    process.env.EMAIL_LISTA_BLANCA = ' Angel@Empresa.com ';
    expect(dejaPasar('  angel@empresa.com  ').pasa).toBe(true);
  });

  it('el motivo se explica con palabras, no con un codigo', () => {
    // Va al registro y al aviso: quien lo lea tiene que entender que paso sin
    // buscar el codigo en el fuente.
    expect(porQueSeParo('SIN_LISTA_BLANCA', [])).toMatch(/EMAIL_LISTA_BLANCA/);
    expect(porQueSeParo('FUERA_DE_LA_LISTA', ['a@b.c'])).toMatch(/a@b\.c/);
  });
});
