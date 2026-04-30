import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getInitials,
  getAvatarColor,
  formatDate,
  exportLeadsCSV,
} from '@/modules/leads/lib/leadFormat';

// formatRelative + cleanPhone están cubiertos en formatters.test.js

describe('getInitials', () => {
  it('devuelve "??" para input vacío/null', () => {
    expect(getInitials()).toBe('??');
    expect(getInitials(null)).toBe('??');
    expect(getInitials('')).toBe('??');
  });

  it('toma la inicial de cada palabra en uppercase', () => {
    expect(getInitials('María García')).toBe('MG');
    expect(getInitials('juan pérez')).toBe('JP');
  });

  it('limita a máximo 2 caracteres', () => {
    expect(getInitials('Ana María García López').length).toBe(2);
    expect(getInitials('Ana María García López')).toBe('AM');
  });

  it('una sola palabra devuelve 1 letra', () => {
    expect(getInitials('Ana')).toBe('A');
  });
});

describe('getAvatarColor', () => {
  it('devuelve una clase de Tailwind para cualquier id numérico', () => {
    const c = getAvatarColor(1);
    expect(typeof c).toBe('string');
    expect(c).toMatch(/bg-/);
    expect(c).toMatch(/text-/);
  });

  it('es determinístico: mismo id → mismo color', () => {
    expect(getAvatarColor(7)).toBe(getAvatarColor(7));
    expect(getAvatarColor(15)).toBe(getAvatarColor(15));
  });

  it('hace cycle por módulo (8 colores)', () => {
    expect(getAvatarColor(0)).toBe(getAvatarColor(8));
    expect(getAvatarColor(1)).toBe(getAvatarColor(9));
  });
});

describe('formatDate', () => {
  it('devuelve "--" para input vacío', () => {
    expect(formatDate()).toBe('--');
    expect(formatDate(null)).toBe('--');
    expect(formatDate('')).toBe('--');
  });

  it('formatea fecha ISO en es-ES corto (día + mes)', () => {
    // 2024-03-15 → "15 mar." (locale es-ES, month: short)
    const r = formatDate('2024-03-15T10:00:00.000Z');
    expect(r).toMatch(/\d{1,2}/); // tiene día
    expect(r).toMatch(/[a-z]{3}/i); // tiene mes abreviado
  });
});

describe('exportLeadsCSV', () => {
  let createObjectURL;
  let revokeObjectURL;
  let anchorClick;
  let createdAnchor;
  let blobContent;
  let OriginalBlob;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:fake-url');
    revokeObjectURL = vi.fn();
    anchorClick = vi.fn();
    createdAnchor = null;
    blobContent = null;

    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    // Capturar el contenido pasado al constructor del Blob, sin depender
    // de blob.text() (no disponible en jsdom).
    OriginalBlob = global.Blob;
    global.Blob = class FakeBlob {
      constructor(parts, opts) {
        blobContent = parts.join('');
        this.type = opts?.type || '';
        this.size = blobContent.length;
      }
    };

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        createdAnchor = el;
        el.click = anchorClick;
      }
      return el;
    });
  });

  afterEach(() => {
    global.Blob = OriginalBlob;
  });

  it('genera un CSV y dispara descarga con filename', () => {
    const leads = [
      {
        nombre: 'Ana', email: 'ana@x.com', telefono: '666', estado: 'nuevo',
        canal: 'whatsapp', responsable_nombre: 'Diego', producto_interes: 'Master',
        notas: 'Interesada', created_at: '2024-01-15',
        last_interaction_at: null, next_reminder_at: null,
      },
    ];
    exportLeadsCSV(leads, 'leads-test.csv');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(createdAnchor.download).toBe('leads-test.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(blobContent).toContain('Ana');
    expect(blobContent).toContain('ana@x.com');
  });

  it('incluye fila de header en el CSV', () => {
    exportLeadsCSV([], 'empty.csv');
    expect(blobContent).toContain('Nombre');
    expect(blobContent).toContain('Email');
    expect(blobContent).toContain('Estado');
    expect(blobContent).toContain('Próximo recordatorio');
  });

  it('soporta lista vacía sin lanzar', () => {
    expect(() => exportLeadsCSV([], 'empty.csv')).not.toThrow();
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it('escapa comillas dobles dentro de los valores', () => {
    const leads = [{ nombre: 'Ana "Anita" Lopez', email: 'a@x.com' }];
    exportLeadsCSV(leads, 'q.csv');
    // CSV escapa " como ""
    expect(blobContent).toContain('Ana ""Anita"" Lopez');
  });

  it('traduce los estados a español en la columna Estado', () => {
    const leads = [
      { nombre: 'X', estado: 'por_contactar' },
      { nombre: 'Y', estado: 'en_seguimiento' },
      { nombre: 'Z', estado: 'no_interesado' },
    ];
    exportLeadsCSV(leads, 't.csv');
    expect(blobContent).toContain('Por contactar');
    expect(blobContent).toContain('En seguimiento');
    expect(blobContent).toContain('No interesado');
  });
});
