import { describe, it, expect } from 'vitest';
import { fillTemplate } from '@/modules/leads/hooks/useWhatsappTemplates';

describe('fillTemplate', () => {
  const lead = {
    nombre: 'Maria Lopez Gomez',
    email: 'maria@example.com',
    telefono: '+34666112233',
    producto_nombre: 'Curso de Logopedia',
    producto_interes: 'Curso de Logopedia (raw)',
  };

  it('reemplaza {nombre} con el primer nombre', () => {
    const r = fillTemplate('Hola {nombre}', { lead, projectName: 'ISEIH' });
    expect(r).toBe('Hola Maria');
  });

  it('reemplaza {nombreCompleto} con el nombre entero', () => {
    const r = fillTemplate('Hola {nombreCompleto}', { lead, projectName: 'ISEIH' });
    expect(r).toBe('Hola Maria Lopez Gomez');
  });

  it('reemplaza {producto} usando producto_nombre cuando existe', () => {
    const r = fillTemplate('Sobre {producto}', { lead, projectName: 'X' });
    expect(r).toBe('Sobre Curso de Logopedia');
  });

  it('cae a producto_interes si no hay producto_nombre', () => {
    const r = fillTemplate('{producto}', { lead: { ...lead, producto_nombre: null }, projectName: 'X' });
    expect(r).toBe('Curso de Logopedia (raw)');
  });

  it('cae a "nuestros servicios" cuando no hay producto', () => {
    const r = fillTemplate('{producto}', { lead: { nombre: 'X' }, projectName: 'X' });
    expect(r).toBe('nuestros servicios');
  });

  it('reemplaza {proyecto}, {email} y {telefono}', () => {
    const r = fillTemplate('{proyecto} {email} {telefono}', { lead, projectName: 'ISEIH' });
    expect(r).toBe('ISEIH maria@example.com +34666112233');
  });

  it('es case-insensitive en las variables', () => {
    const r = fillTemplate('{NOMBRE} {Email}', { lead, projectName: 'X' });
    expect(r).toBe('Maria maria@example.com');
  });

  it('reemplaza todas las apariciones (flag global)', () => {
    const r = fillTemplate('{nombre} y otra vez {nombre}', { lead, projectName: 'X' });
    expect(r).toBe('Maria y otra vez Maria');
  });

  it('maneja lead sin campos sin romperse', () => {
    const r = fillTemplate('Hola {nombre}, {email}', { lead: {}, projectName: '' });
    expect(r).toBe('Hola , ');
  });
});
