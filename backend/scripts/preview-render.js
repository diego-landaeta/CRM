// Script ad-hoc: renderiza previews de factura + certificado a PNG.
// Uso: node backend/scripts/preview-render.js
import 'dotenv/config';
import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';
import { buildInvoiceHtml, buildCertP1Html, buildCertP2Html } from '../src/modules/documents/documents.service.js';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = process.env.PREVIEW_OUT || 'C:/Users/nange/AppData/Local/Temp/crm-preview';

const invoiceData = {
  numero: '193',
  fecha: '2026-04-30',
  emisor_nombre: 'MIREIA JAREÑO MORAGA',
  emisor_nif: 'ES53762128L',
  emisor_direccion: 'C/Músico Mariano Puig Yago, 45\nTorrente, Valencia (46900)',
  emisor_telefono: '644 10 59 19',
  cliente_nombre: 'Bestours, S.A',
  cliente_dni: 'A58432469',
  cliente_direccion: 'Consell de Cent, 334-336\n08009 - BARCELONA',
  lineas: [{ descripcion: 'Diplomado en Psicotraumatología Clínica', cantidad: 1, precio: 150 }],
  iva_pct: 21,
  iva_exento: true,
  notas: '',
};

const certData = {
  alumno_nombre: 'Dayana Morro',
  alumno_dni: '4XXXXXXX-C',
  curso_nombre: 'Curso para el bajo deseo sexual',
  horas_total: 750,
  fecha_inicio: '23 de Noviembre de 2025',
  fecha_fin: '20 de Abril de 2026',
  fecha_expedicion: '22 de Abril de 2026',
  ciudad: 'Valencia',
  pais: 'España',
  director_nombre: 'Carlos Saiz',
  resp_nombre: 'Mireia Jareño',
  modalidad: 'Online',
  modulos: [
    'Introducción a la Psicoterapia Integrativa',
    'Fundamentos de la Psicoterapia Cognitivo-Conductual (TCC)',
    'Psicoterapia Humanista: Enfoques y Técnicas',
    'Psicoterapia Psicodinámica y Psicoanálisis',
    'Terapia Familiar y Sistémica',
  ],
};

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    // Factura: A4 portrait (210x297mm @ 96dpi → 794x1123)
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
      const invoiceHtml = buildInvoiceHtml(invoiceData);
      await fs.writeFile(path.join(OUT, 'invoice.html'), invoiceHtml);
      await page.setContent(invoiceHtml, { waitUntil: 'networkidle0', timeout: 15000 });
      await page.screenshot({ path: path.join(OUT, 'invoice.png'), fullPage: true });
      await page.close();
      console.log('OK invoice.png + invoice.html');
    }
    // Certificado p1: A4 landscape (297x210mm → 1123x794)
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
      await page.setContent(await buildCertP1Html(certData), { waitUntil: 'networkidle0', timeout: 15000 });
      await page.screenshot({ path: path.join(OUT, 'cert-p1.png'), fullPage: false });
      await page.close();
      console.log('OK cert-p1.png');
    }
    // Certificado p2
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
      await page.setContent(await buildCertP2Html(certData), { waitUntil: 'networkidle0', timeout: 15000 });
      await page.screenshot({ path: path.join(OUT, 'cert-p2.png'), fullPage: false });
      await page.close();
      console.log('OK cert-p2.png');
    }
  } finally {
    await browser.close();
  }
  console.log('OUT:', OUT);
}

main().catch(err => { console.error(err); process.exit(1); });
