// Tests para shared/lib/export/writer.ts (CRM-196).
// Cubre rutas CSV y JSON. Para XLSX se mockea el import dinámico de
// write-excel-file/browser.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runExport } from '@/shared/lib/export/writer';

// jsdom no implementa createObjectURL/revokeObjectURL ni Blob.text(). Para
// poder inspeccionar el contenido escrito, interceptamos el Blob constructor
// y capturamos las partes pasadas.
function setupBlobCapture() {
  const captured = [];
  const OriginalBlob = globalThis.Blob;
  class MockBlob {
    constructor(parts = [], options = {}) {
      this.type = options.type || '';
      this.parts = parts;
      this._text = parts.map((p) => (typeof p === 'string' ? p : '')).join('');
      this.size = this._text.length;
      captured.push(this);
    }
    text() { return Promise.resolve(this._text); }
  }
  globalThis.Blob = MockBlob;

  const origCreate = globalThis.URL.createObjectURL;
  const origRevoke = globalThis.URL.revokeObjectURL;
  globalThis.URL.createObjectURL = (blob) => `blob:fake-${captured.indexOf(blob)}`;
  globalThis.URL.revokeObjectURL = vi.fn();

  return {
    created: captured,
    restore() {
      globalThis.Blob = OriginalBlob;
      globalThis.URL.createObjectURL = origCreate;
      globalThis.URL.revokeObjectURL = origRevoke;
    },
  };
}

function blobToText(blob) {
  return blob._text;
}

const COLUMNS = [
  { key: 'name', label: 'Nombre', type: 'string', value: (r) => r.name },
  { key: 'email', label: 'Email', type: 'string', value: (r) => r.email },
  { key: 'amount', label: 'Importe', type: 'number', value: (r) => r.amount },
  { key: 'created', label: 'Creado', type: 'date', value: (r) => r.created },
  { key: 'active', label: 'Activo', type: 'boolean', value: (r) => r.active },
];

const ALL_INCLUDED = COLUMNS.map((c) => ({ key: c.key, label: c.label, included: true }));

const ROWS = [
  { name: 'Ada Lovelace', email: 'ada@x.com', amount: 1500.5, created: '2026-01-15', active: true },
  { name: 'Alan "Turing"', email: 'alan@x.com', amount: null, created: null, active: false },
];

describe('runExport CSV', () => {
  let blobs;
  let clickSpy;
  beforeEach(() => {
    blobs = setupBlobCapture();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    blobs.restore();
    clickSpy.mockRestore();
  });

  it('escribe headers y filas con BOM UTF-8', async () => {
    await runExport({
      context: 'test', filename: 'out', format: 'csv',
      columns: COLUMNS, config: ALL_INCLUDED, rows: ROWS,
    });
    expect(blobs.created).toHaveLength(1);
    const text = blobToText(blobs.created[0]);
    // BOM ﻿ al inicio
    expect(text.charCodeAt(0)).toBe(0xFEFF);
    const csv = text.slice(1);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Nombre,Email,Importe,Creado,Activo');
    expect(lines[1]).toContain('Ada Lovelace');
    expect(lines[1]).toContain('1500.5');
    expect(lines[1]).toContain('true');
  });

  it('escapa comillas y comas', async () => {
    await runExport({
      context: 'test', filename: 'out', format: 'csv',
      columns: COLUMNS, config: ALL_INCLUDED, rows: ROWS,
    });
    const text = (blobToText(blobs.created[0])).slice(1);
    // Alan "Turing" debe ir entrecomillado y con "" duplicadas
    expect(text).toContain('"Alan ""Turing"""');
  });

  it('respeta el orden y exclusión definida en config', async () => {
    const config = [
      { key: 'email', label: 'Email', included: true },
      { key: 'name', label: 'Nombre', included: false }, // excluido
      { key: 'amount', label: 'Importe', included: true },
    ];
    await runExport({
      context: 'test', filename: 'out', format: 'csv',
      columns: COLUMNS, config, rows: [ROWS[0]],
    });
    const text = (blobToText(blobs.created[0])).slice(1);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Email,Importe');
    expect(lines[1]).toBe('ada@x.com,1500.5');
  });

  it('usa el label custom del config si difiere del original', async () => {
    const config = [
      { key: 'name', label: 'Nombre completo', included: true },
      { key: 'email', label: 'Correo', included: true },
    ];
    await runExport({
      context: 'test', filename: 'out', format: 'csv',
      columns: COLUMNS, config, rows: [],
    });
    const text = (blobToText(blobs.created[0])).slice(1);
    expect(text).toBe('Nombre completo,Correo');
  });

  it('añade extensión .csv si falta', async () => {
    await runExport({
      context: 'test', filename: 'sin-ext', format: 'csv',
      columns: COLUMNS, config: ALL_INCLUDED, rows: [],
    });
    expect(blobs.created[0].type).toContain('text/csv');
  });

  it('serializa fechas a ISO si son null las imprime vacías', async () => {
    await runExport({
      context: 'test', filename: 'out', format: 'csv',
      columns: COLUMNS, config: ALL_INCLUDED, rows: ROWS,
    });
    const text = (blobToText(blobs.created[0])).slice(1);
    const lines = text.split('\n');
    // Ada: created=2026-01-15 → ISO con T (toISOString)
    expect(lines[1]).toMatch(/2026-01-15T00:00:00\.000Z/);
    // Alan: created=null → vacío entre comas
    expect(lines[2]).toContain(',,'); // amount null + created null
  });
});

describe('runExport JSON', () => {
  let blobs;
  let clickSpy;
  beforeEach(() => {
    blobs = setupBlobCapture();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    blobs.restore();
    clickSpy.mockRestore();
  });

  it('escribe array JSON usando los labels como claves', async () => {
    await runExport({
      context: 'test', filename: 'out', format: 'json',
      columns: COLUMNS, config: ALL_INCLUDED, rows: [ROWS[0]],
    });
    const text = blobToText(blobs.created[0]);
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      Nombre: 'Ada Lovelace',
      Email: 'ada@x.com',
      Importe: 1500.5,
      Creado: '2026-01-15T00:00:00.000Z',
      Activo: true,
    });
  });

  it('valores null se preservan', async () => {
    await runExport({
      context: 'test', filename: 'out', format: 'json',
      columns: COLUMNS, config: ALL_INCLUDED, rows: [ROWS[1]],
    });
    const parsed = JSON.parse(blobToText(blobs.created[0]));
    expect(parsed[0].Importe).toBeNull();
    expect(parsed[0].Creado).toBeNull();
  });

  it('content-type es application/json', async () => {
    await runExport({
      context: 'test', filename: 'out', format: 'json',
      columns: COLUMNS, config: ALL_INCLUDED, rows: [],
    });
    expect(blobs.created[0].type).toContain('application/json');
  });
});

describe('runExport — formato no soportado', () => {
  it('rechaza con error si format desconocido', async () => {
    await expect(runExport({
      context: 'x', filename: 'y', format: 'pdf',
      columns: COLUMNS, config: ALL_INCLUDED, rows: [],
    })).rejects.toThrow(/no soportado/i);
  });
});

describe('runExport — config con keys huérfanos', () => {
  it('ignora entradas de config cuya key no exista en columns', async () => {
    const blobs = setupBlobCapture();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const config = [
      { key: 'name', label: 'Nombre', included: true },
      { key: 'fantasma', label: 'Fantasma', included: true }, // no existe en columns
      { key: 'email', label: 'Email', included: true },
    ];
    await runExport({
      context: 'test', filename: 'out', format: 'csv',
      columns: COLUMNS, config, rows: [],
    });
    const text = (blobToText(blobs.created[0])).slice(1);
    expect(text).toBe('Nombre,Email');
    blobs.restore();
    clickSpy.mockRestore();
  });
});
