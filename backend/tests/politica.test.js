import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const cargar = async () => {
  // Se reimporta en cada prueba: la politica lee process.env al llamarla, pero
  // el mapa de modos es de modulo y hay que poder empezar limpio.
  const m = await import('../src/modules/whatsapp/politica.js');
  m._olvidarModos();
  return m;
};

describe('politica: los grupos (#74)', () => {
  const original = process.env.WHATSAPP_GRUPOS;
  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_GRUPOS;
    else process.env.WHATSAPP_GRUPOS = original;
  });

  it('por defecto entran, que es lo que ya pasaba', async () => {
    delete process.env.WHATSAPP_GRUPOS;
    const p = await cargar();
    expect(p.seAceptanGrupos()).toBe(true);
    expect(p.sobraPorSerGrupo('120363412958104027@g.us')).toBe(false);
  });

  it('con «no» se paran, y eso es lo que se le pide a Evolution', async () => {
    process.env.WHATSAPP_GRUPOS = 'no';
    const p = await cargar();
    expect(p.seAceptanGrupos()).toBe(false);
    expect(p.sobraPorSerGrupo('120363412958104027@g.us')).toBe(true);
    // Lo que se le pide al proveedor sale de la MISMA decision, nunca al reves:
    // que los dos lados digan cosas distintas es como empezo la #74.
    expect(p.groupsIgnoreParaEvolution()).toBe(true);
  });

  it('una persona nunca se descarta por esto', async () => {
    process.env.WHATSAPP_GRUPOS = 'no';
    const p = await cargar();
    expect(p.sobraPorSerGrupo('34612345678@s.whatsapp.net')).toBe(false);
    expect(p.sobraPorSerGrupo('34612345678@lid')).toBe(false);
  });

  it('«NO» en mayusculas vale igual', async () => {
    process.env.WHATSAPP_GRUPOS = 'NO';
    const p = await cargar();
    expect(p.seAceptanGrupos()).toBe(false);
  });
});

describe('politica: cuanto historial (#73)', () => {
  let p;
  beforeEach(async () => { p = await cargar(); });

  it('«cero» es lo unico que no pide historial', async () => {
    expect(p.syncFullHistoryPara('cero')).toBe(false);
    // Los otros dos SI: sin esto no llega nada que recortar, que es justo por
    // lo que «el ultimo mes» no traia el ultimo mes en produccion.
    expect(p.syncFullHistoryPara('rapido')).toBe(true);
    expect(p.syncFullHistoryPara('todo')).toBe(true);
  });

  it('recorta lo anterior al mes, solo en «rapido»', () => {
    const hace40dias = new Date(Date.now() - 40 * 24 * 3600 * 1000);
    p.apuntarModo('crm-u1', 'rapido');
    expect(p.sobraDelHistorial('crm-u1', hace40dias)).toBe(true);

    p.apuntarModo('crm-u2', 'todo');
    expect(p.sobraDelHistorial('crm-u2', hace40dias)).toBe(false);
  });

  it('lo de hoy nunca se descarta, sea cual sea el modo', () => {
    p.apuntarModo('crm-u1', 'rapido');
    expect(p.sobraDelHistorial('crm-u1', new Date())).toBe(false);
    expect(p.sobraDelHistorial('crm-u1', new Date(Date.now() - 29 * 24 * 3600 * 1000))).toBe(false);
  });

  it('sin modo apuntado no se recorta nada', () => {
    // Es el caso del proceso reiniciado a mitad de una sincronizacion. De las
    // dos formas de equivocarse, guardar de mas tiene arreglo despues; tirar
    // mensajes de una gestora, no.
    const hace40dias = new Date(Date.now() - 40 * 24 * 3600 * 1000);
    expect(p.sobraDelHistorial('crm-u9', hace40dias)).toBe(false);
  });

  it('una fecha rota no tira el mensaje', () => {
    p.apuntarModo('crm-u1', 'rapido');
    expect(p.sobraDelHistorial('crm-u1', new Date('vaya'))).toBe(false);
    expect(p.sobraDelHistorial('crm-u1', null)).toBe(false);
    expect(p.sobraDelHistorial('crm-u1', 0)).toBe(false);
  });

  it('un modo inventado no se apunta', () => {
    p.apuntarModo('crm-u1', 'todísimo');
    expect(p.modoDe('crm-u1')).toBe(null);
  });
});
