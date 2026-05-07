import { describe, it, expect, vi } from 'vitest';

const saveSpy = vi.fn();
const docMock = {
  setFillColor: vi.fn(),
  setDrawColor: vi.fn(),
  setTextColor: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setLineWidth: vi.fn(),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  text: vi.fn(),
  addPage: vi.fn(),
  setPage: vi.fn(),
  splitTextToSize: vi.fn((txt) => [String(txt)]),
  save: saveSpy,
  output: vi.fn(),
  internal: { pages: [null, null] },
};

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(() => docMock),
}));

const { exportReportPDF } = await import('../modules/reports/lib/exportPdf');

const fullData = {
  leads: { total: 120, nuevo: 30, por_contactar: 20, contactado: 25, en_seguimiento: 15, convertido: 25, no_interesado: 5 },
  conversions: { cobrado: 12500, por_cobrar: 4200 },
  tasa_conversion: 21,
  leads_por_canal: [{ canal: 'Meta Ads', total: 60 }, { canal: 'Google Ads', total: 40 }],
  leads_por_gestor: [{ gestor: 'Ana', total: 60, convertidos: 18 }, { gestor: 'Luis', total: 40, convertidos: 7 }],
  top_productos: [{ producto: 'Diplomado A', ventas: 12, total: 6000, cobrado: 4500 }],
  ingresos_mensual: [{ mes: '2026-01', ingresos: 4200 }, { mes: '2026-02', ingresos: 5100 }],
};

const emptyData = {
  leads: { total: 0, nuevo: 0, por_contactar: 0, contactado: 0, en_seguimiento: 0, convertido: 0, no_interesado: 0 },
  conversions: { cobrado: 0, por_cobrar: 0 },
  tasa_conversion: 0,
};

describe('exportReportPDF', () => {
  it('genera un PDF con dataset completo y llama a save con slug del proyecto', async () => {
    saveSpy.mockClear();
    await exportReportPDF(fullData, 'Psiko Aprende', { from: '2026-01-01', to: '2026-05-07' });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0]).toBe('reporte-psiko-aprende-2026-01-01_2026-05-07.pdf');
  });

  it('no rompe con secciones vacías y usa "crm" como slug si no hay proyecto', async () => {
    saveSpy.mockClear();
    await exportReportPDF(emptyData, undefined, { from: '2026-01-01', to: '2026-05-07' });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0]).toBe('reporte-crm-2026-01-01_2026-05-07.pdf');
  });
});
