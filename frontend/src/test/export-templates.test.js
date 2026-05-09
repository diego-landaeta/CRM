// Tests para shared/lib/export/templates.ts (CRM-196).
// Cubre el CRUD sobre localStorage por contexto.
import { describe, it, expect, beforeEach } from 'vitest';
import { listTemplates, saveTemplate, deleteTemplate } from '@/shared/lib/export/templates';

const KEY = 'crm.exportTemplates.v1';

describe('export templates', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('listTemplates devuelve [] cuando no hay nada guardado', () => {
    expect(listTemplates('leads')).toEqual([]);
  });

  it('saveTemplate persiste con id, createdAt y devuelve la plantilla', () => {
    const tpl = saveTemplate({
      name: 'Solo email',
      context: 'leads',
      format: 'csv',
      columns: [{ key: 'email', label: 'Email', included: true }],
    });
    expect(tpl.id).toMatch(/^\d+-[a-z0-9]+$/);
    expect(tpl.createdAt).toBeTruthy();
    expect(new Date(tpl.createdAt).toString()).not.toBe('Invalid Date');
    expect(listTemplates('leads')).toHaveLength(1);
  });

  it('listTemplates filtra por contexto', () => {
    saveTemplate({ name: 'A', context: 'leads', format: 'xlsx', columns: [] });
    saveTemplate({ name: 'B', context: 'commissions', format: 'csv', columns: [] });
    saveTemplate({ name: 'C', context: 'leads', format: 'json', columns: [] });
    expect(listTemplates('leads')).toHaveLength(2);
    expect(listTemplates('commissions')).toHaveLength(1);
    expect(listTemplates('inexistente')).toHaveLength(0);
  });

  it('saveTemplate reemplaza si existe el mismo nombre en el mismo contexto', () => {
    saveTemplate({ name: 'Mi tpl', context: 'leads', format: 'csv', columns: [] });
    saveTemplate({ name: 'Mi tpl', context: 'leads', format: 'xlsx', columns: [] });
    const list = listTemplates('leads');
    expect(list).toHaveLength(1);
    expect(list[0].format).toBe('xlsx');
  });

  it('saveTemplate NO reemplaza si el nombre coincide pero el contexto difiere', () => {
    saveTemplate({ name: 'Mi tpl', context: 'leads', format: 'csv', columns: [] });
    saveTemplate({ name: 'Mi tpl', context: 'commissions', format: 'csv', columns: [] });
    expect(listTemplates('leads')).toHaveLength(1);
    expect(listTemplates('commissions')).toHaveLength(1);
  });

  it('deleteTemplate elimina por id', () => {
    const a = saveTemplate({ name: 'A', context: 'leads', format: 'csv', columns: [] });
    saveTemplate({ name: 'B', context: 'leads', format: 'csv', columns: [] });
    deleteTemplate(a.id);
    const list = listTemplates('leads');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('B');
  });

  it('deleteTemplate con id inexistente es no-op', () => {
    saveTemplate({ name: 'A', context: 'leads', format: 'csv', columns: [] });
    deleteTemplate('id-fantasma');
    expect(listTemplates('leads')).toHaveLength(1);
  });

  it('localStorage corrupto se trata como vacío', () => {
    localStorage.setItem(KEY, '{not json');
    expect(listTemplates('leads')).toEqual([]);
  });

  it('localStorage con valor no-array se trata como vacío', () => {
    localStorage.setItem(KEY, JSON.stringify({ foo: 'bar' }));
    expect(listTemplates('leads')).toEqual([]);
  });

  it('persiste columns con orden y labels custom', () => {
    saveTemplate({
      name: 'Custom',
      context: 'leads',
      format: 'xlsx',
      columns: [
        { key: 'b', label: 'Bravo', included: true },
        { key: 'a', label: 'Alfa renombrado', included: false },
      ],
    });
    const list = listTemplates('leads');
    expect(list[0].columns).toEqual([
      { key: 'b', label: 'Bravo', included: true },
      { key: 'a', label: 'Alfa renombrado', included: false },
    ]);
  });
});
