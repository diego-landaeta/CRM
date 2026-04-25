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
 * Devuelve el PDF como blob.
 */
export async function exportReportPdf(id) {
  if (USE_MOCKS) {
    await delay(1500);
    const md = await getReport(id);
    return mockPdfBlob(md.data);
  }
  return client.post(`/reports/${id}/export-pdf`, {}, { responseType: 'blob' });
}

function mockPdfBlob(report) {
  // Mock: generamos un "PDF" que en realidad es texto plano. Para preview real, backend usa puppeteer/wkhtmltopdf.
  const text = `REPORTE MENSUAL — ${report.projectName} — ${report.periodo}\n\n${report.content}`;
  return new Blob([text], { type: 'application/pdf' });
}
