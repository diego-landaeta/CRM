import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listTickets,
  createTicket,
  updateTicketStatus,
  addComment,
  deleteTicket,
  TICKET_STATUS,
  TICKET_SEVERITY,
  TICKET_KIND,
} from '@/modules/soporte/lib/tickets';

beforeEach(() => {
  localStorage.clear();
});

describe('TICKET_STATUS / SEVERITY / KIND constantes', () => {
  it('TICKET_STATUS tiene 4 estados con label + tone', () => {
    expect(Object.keys(TICKET_STATUS)).toEqual(['open', 'in_review', 'resolved', 'closed']);
    for (const k of Object.keys(TICKET_STATUS)) {
      expect(TICKET_STATUS[k]).toHaveProperty('label');
      expect(TICKET_STATUS[k]).toHaveProperty('tone');
    }
  });

  it('TICKET_SEVERITY tiene 4 niveles', () => {
    expect(Object.keys(TICKET_SEVERITY)).toEqual(['low', 'medium', 'high', 'critical']);
  });

  it('TICKET_KIND tiene bug/feature/question', () => {
    expect(Object.keys(TICKET_KIND)).toEqual(['bug', 'feature', 'question']);
  });
});

describe('createTicket', () => {
  it('crea ticket con id y timestamps generados', () => {
    const t = createTicket({ kind: 'bug', title: 'Algo falla' });
    expect(t.id).toMatch(/^tkt-/);
    expect(t.createdAt).toBeTruthy();
    expect(t.updatedAt).toBeTruthy();
    expect(new Date(t.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('aplica defaults: kind=question, severity=low, status=open', () => {
    const t = createTicket({});
    expect(t.kind).toBe('question');
    expect(t.severity).toBe('low');
    expect(t.status).toBe('open');
  });

  it('título vacío cae a "(sin titulo)"', () => {
    expect(createTicket({}).title).toBe('(sin titulo)');
    expect(createTicket({ title: '   ' }).title).toBe('(sin titulo)');
  });

  it('hace trim de strings', () => {
    const t = createTicket({ title: '  Bug X  ', description: '  desc  ' });
    expect(t.title).toBe('Bug X');
    expect(t.description).toBe('desc');
  });

  it('comments inicia como array vacío', () => {
    expect(createTicket({}).comments).toEqual([]);
  });

  it('attachments no-array cae a []', () => {
    expect(createTicket({ attachments: 'not-array' }).attachments).toEqual([]);
    expect(createTicket({}).attachments).toEqual([]);
  });

  it('persiste en localStorage', () => {
    createTicket({ title: 'A' });
    const raw = localStorage.getItem('crm.support-tickets');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw)).toHaveLength(1);
  });

  it('dispara evento "crm:tickets-changed" al guardar', () => {
    const handler = vi.fn();
    window.addEventListener('crm:tickets-changed', handler);
    createTicket({ title: 'X' });
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('crm:tickets-changed', handler);
  });
});

describe('listTickets', () => {
  it('devuelve [] si no hay nada en storage', () => {
    expect(listTickets()).toEqual([]);
  });

  it('devuelve [] si el JSON está corrupto', () => {
    localStorage.setItem('crm.support-tickets', 'not-json{');
    expect(listTickets()).toEqual([]);
  });

  it('devuelve [] si el contenido no es array', () => {
    localStorage.setItem('crm.support-tickets', JSON.stringify({ foo: 'bar' }));
    expect(listTickets()).toEqual([]);
  });

  it('ordena del más reciente al más antiguo', () => {
    const t1 = createTicket({ title: 'Primero' });
    // pequeña espera de 1ms para diferenciar timestamps
    const t2 = { ...t1, id: 'tkt-fake', title: 'Segundo', createdAt: new Date(Date.now() + 1000).toISOString() };
    localStorage.setItem('crm.support-tickets', JSON.stringify([t1, t2]));
    const list = listTickets();
    expect(list[0].title).toBe('Segundo');
    expect(list[1].title).toBe('Primero');
  });
});

describe('updateTicketStatus', () => {
  it('actualiza status y updatedAt', async () => {
    const t = createTicket({ title: 'X' });
    const original = t.updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    const updated = updateTicketStatus(t.id, 'resolved');
    expect(updated.status).toBe('resolved');
    expect(updated.updatedAt).not.toBe(original);
    // verificar que persistió
    expect(listTickets()[0].status).toBe('resolved');
  });

  it('devuelve null si el id no existe', () => {
    expect(updateTicketStatus('id-fake', 'resolved')).toBeNull();
  });
});

describe('addComment', () => {
  it('añade comentario al ticket', () => {
    const t = createTicket({ title: 'X' });
    const updated = addComment(t.id, 'Primer comentario');
    expect(updated.comments).toHaveLength(1);
    expect(updated.comments[0].body).toBe('Primer comentario');
    expect(updated.comments[0].id).toBeTruthy();
    expect(updated.comments[0].createdAt).toBeTruthy();
  });

  it('hace trim del comentario', () => {
    const t = createTicket({ title: 'X' });
    const u = addComment(t.id, '  hola  ');
    expect(u.comments[0].body).toBe('hola');
  });

  it('acumula comentarios en orden', () => {
    const t = createTicket({ title: 'X' });
    addComment(t.id, 'uno');
    const u = addComment(t.id, 'dos');
    expect(u.comments.map((c) => c.body)).toEqual(['uno', 'dos']);
  });

  it('devuelve null si el id no existe', () => {
    expect(addComment('id-fake', 'hola')).toBeNull();
  });

  it('actualiza updatedAt del ticket', async () => {
    const t = createTicket({ title: 'X' });
    const original = t.updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    const u = addComment(t.id, 'comentario');
    expect(u.updatedAt).not.toBe(original);
  });
});

describe('deleteTicket', () => {
  it('elimina el ticket del storage', () => {
    const t1 = createTicket({ title: 'A' });
    createTicket({ title: 'B' });
    deleteTicket(t1.id);
    const list = listTickets();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('B');
  });

  it('no rompe si el id no existe', () => {
    createTicket({ title: 'A' });
    expect(() => deleteTicket('id-fake')).not.toThrow();
    expect(listTickets()).toHaveLength(1);
  });

  it('dispara evento al borrar', () => {
    const t = createTicket({ title: 'X' });
    const handler = vi.fn();
    window.addEventListener('crm:tickets-changed', handler);
    deleteTicket(t.id);
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('crm:tickets-changed', handler);
  });
});
