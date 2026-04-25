// Reports IA API client (CRM-113)
// Contrato: docs/03-api-endpoints.md > Reports

import client from '@/shared/api/client';
import { reportsListMock, reportDetailMock, generateReportMock } from '../mocks/reports-ia.mock';

const USE_MOCKS = true;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * GET /api/reports/:projectId?periodo=YYYY-MM
 */
export async function listReports(projectId, params = {}) {
  if (USE_MOCKS) { await delay(250); return { success: true, data: reportsListMock(projectId, params) }; }
  const qs = new URLSearchParams(params).toString();
  return client.get(`/reports/${projectId}${qs ? '?' + qs : ''}`);
}

/**
 * GET /api/reports/detail/:id
 */
export async function getReport(id) {
  if (USE_MOCKS) { await delay(250); return { success: true, data: reportDetailMock(id) }; }
  return client.get(`/reports/detail/${id}`);
}

/**
 * POST /api/reports/:projectId/generate
 */
export async function generateReport(projectId, periodo) {
  if (USE_MOCKS) { await delay(2000); return { success: true, data: generateReportMock(projectId, periodo) }; }
  return client.post(`/reports/${projectId}/generate`, { periodo });
}

/**
 * POST /api/reports/:id/export-pdf  (CRM-121)
 * Devuelve el PDF como blob real.
 * Mock: genera el PDF en cliente con jsPDF parseando el markdown.
 * Real: backend debe usar Puppeteer / wkhtmltopdf con branding del proyecto.
 */
export async function exportReportPdf(id) {
  if (USE_MOCKS) {
    await delay(800);
    const md = await getReport(id);
    return buildPdfFromMarkdown(md.data);
  }
  return client.post(`/reports/${id}/export-pdf`, {}, { responseType: 'blob' });
}

/**
 * Genera un PDF real (estructura PDF valida) a partir del markdown del reporte.
 * Renderiza headings, paragrafos, listas, tablas, blockquotes, hr.
 */
async function buildPdfFromMarkdown(report) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  function addPageIfNeeded(needed = 10) {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function setStyle(size, weight = 'normal', color = '#0f172a') {
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(color);
  }

  function writeWrapped(text, size, weight, color = '#0f172a', indent = 0) {
    setStyle(size, weight, color);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    lines.forEach(line => {
      addPageIfNeeded(size * 0.45);
      doc.text(line, MARGIN + indent, y);
      y += size * 0.45;
    });
  }

  // === Header con branding ===
  doc.setFillColor(59, 130, 246); // primary
  doc.rect(0, 0, PAGE_W, 14, 'F');
  setStyle(14, 'bold', '#ffffff');
  doc.text('CRM MultiProyecto · Reporte mensual', MARGIN, 9.5);
  setStyle(9, 'normal', '#dbeafe');
  doc.text(report.projectName, PAGE_W - MARGIN, 9.5, { align: 'right' });
  y = 24;

  // === Titulo del reporte ===
  setStyle(20, 'bold', '#0f172a');
  doc.text(`Reporte ${formatPeriodo(report.periodo)}`, MARGIN, y);
  y += 8;
  setStyle(9, 'normal', '#64748b');
  doc.text(`Proyecto: ${report.projectName} · Generado: ${new Date(report.createdAt).toLocaleString('es-ES')} · Por: ${report.generadoPor?.nombre || 'Sistema'}`, MARGIN, y);
  y += 7;

  // Metadata box
  if (report.metadata) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 1.5, 1.5, 'FD');
    setStyle(8, 'normal', '#475569');
    const metaText = `${report.metadata.leadsAnalizados} prospectos analizados  ·  ${report.metadata.conversionesAnalizadas} conversiones  ·  Facturacion: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(report.metadata.facturacionTotal)}  ·  Fuentes: ${(report.metadata.fuentesDatos || []).join(', ')}`;
    doc.text(metaText, MARGIN + 3, y + 9);
    y += 22;
  }

  // === Render del markdown ===
  const lines = (report.content || '').split('\n');
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Tablas markdown
    const isTableRow = line.startsWith('|') && line.endsWith('|');
    if (isTableRow) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      // Skip separator row (---)
      if (cells.every(c => /^:?-+:?$/.test(c))) continue;
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      renderTable(doc, tableRows, MARGIN, y, CONTENT_W, () => { addPageIfNeeded(10); }, (newY) => { y = newY; });
      inTable = false;
      tableRows = [];
    }

    // Vacio
    if (!line) { y += 2.5; continue; }

    // Headings
    if (line.startsWith('# ')) { addPageIfNeeded(12); writeWrapped(line.slice(2), 18, 'bold', '#0f172a'); y += 2; continue; }
    if (line.startsWith('## ')) { addPageIfNeeded(10); y += 3; writeWrapped(line.slice(3), 14, 'bold', '#0f172a'); doc.setDrawColor(226, 232, 240); doc.line(MARGIN, y, MARGIN + CONTENT_W, y); y += 2; continue; }
    if (line.startsWith('### ')) { addPageIfNeeded(9); y += 2; writeWrapped(line.slice(4), 12, 'bold', '#1e293b'); continue; }

    // HR
    if (/^---+$/.test(line)) { y += 2; doc.setDrawColor(226, 232, 240); doc.line(MARGIN, y, MARGIN + CONTENT_W, y); y += 4; continue; }

    // Blockquote
    if (line.startsWith('> ')) {
      addPageIfNeeded(8);
      doc.setFillColor(59, 130, 246, 0.08);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y - 3, MARGIN, y + 3);
      const text = stripMd(line.slice(2));
      writeWrapped(text, 10, 'italic', '#475569', 4);
      doc.setLineWidth(0.2);
      continue;
    }

    // Listas con bullet
    if (line.startsWith('- ') || line.startsWith('* ')) {
      addPageIfNeeded(6);
      setStyle(10, 'normal', '#0f172a');
      doc.text('•', MARGIN, y);
      writeWrapped(stripMd(line.slice(2)), 10, 'normal', '#0f172a', 4);
      continue;
    }
    // Listas numeradas
    const numMatch = line.match(/^(\d+)\. (.+)$/);
    if (numMatch) {
      addPageIfNeeded(6);
      setStyle(10, 'normal', '#0f172a');
      doc.text(`${numMatch[1]}.`, MARGIN, y);
      writeWrapped(stripMd(numMatch[2]), 10, 'normal', '#0f172a', 6);
      continue;
    }

    // Parrafo normal
    writeWrapped(stripMd(line), 10, 'normal', '#0f172a');
  }

  if (inTable && tableRows.length) {
    renderTable(doc, tableRows, MARGIN, y, CONTENT_W, () => { addPageIfNeeded(10); }, (newY) => { y = newY; });
  }

  // Footer en cada pagina
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setStyle(7, 'normal', '#94a3b8');
    doc.text(`Pagina ${p} de ${totalPages}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
    doc.text(`Generado por Claude AI · ${new Date(report.createdAt).toLocaleDateString('es-ES')}`, MARGIN, PAGE_H - 8);
  }

  return doc.output('blob');
}

function renderTable(doc, rows, x, startY, width, ensureSpace, onAdvance) {
  if (!rows.length) return;
  const colCount = rows[0].length;
  const colW = width / colCount;
  const padding = 2;
  let y = startY;

  rows.forEach((cells, idx) => {
    const isHeader = idx === 0;
    const lineHeight = 5;
    // Calcular altura maxima por celda
    let maxH = lineHeight;
    cells.forEach(c => {
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(c, colW - padding * 2);
      maxH = Math.max(maxH, lines.length * 4.5);
    });
    ensureSpace(maxH + 2);
    // Background header
    if (isHeader) {
      doc.setFillColor(241, 245, 249);
      doc.rect(x, y, width, maxH + 2, 'F');
    } else if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(x, y, width, maxH + 2, 'F');
    }
    // Borde
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.1);
    doc.rect(x, y, width, maxH + 2);
    cells.forEach((c, ci) => {
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setFontSize(isHeader ? 8 : 9);
      doc.setTextColor(isHeader ? '#475569' : '#0f172a');
      const lines = doc.splitTextToSize(c, colW - padding * 2);
      lines.forEach((l, li) => {
        doc.text(l, x + ci * colW + padding, y + 4 + li * 4.5);
      });
    });
    y += maxH + 2;
  });
  onAdvance(y + 3);
}

function stripMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function formatPeriodo(periodo) {
  if (!periodo) return '';
  const [y, m] = periodo.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}
