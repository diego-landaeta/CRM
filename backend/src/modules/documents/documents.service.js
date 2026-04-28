import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/crm-uploads/documents';

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function htmlToPdf(html, filename) {
  await ensureDir();
  const filePath = path.join(UPLOAD_DIR, filename);
  const browser = await puppeteer.launch({ headless: 'new', executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: filePath, printBackground: true, format: 'A4' });
  } finally {
    await browser.close();
  }
  return filePath;
}

async function htmlToPdfLandscape(html, filename) {
  await ensureDir();
  const filePath = path.join(UPLOAD_DIR, filename);
  const browser = await puppeteer.launch({ headless: 'new', executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: filePath, printBackground: true, format: 'A4', landscape: true });
  } finally {
    await browser.close();
  }
  return filePath;
}

// ============================================================
// TEMPLATE: FACTURA
// ============================================================
export function buildInvoiceHtml(data) {
  const {
    numero, fecha,
    emisor_nombre, emisor_nif, emisor_direccion, emisor_telefono,
    cliente_nombre, cliente_dni, cliente_direccion,
    lineas = [],
    notas = '',
    iva_pct = 21,
  } = data;

  const subtotal = lineas.reduce((s, l) => s + (parseFloat(l.precio) * parseInt(l.cantidad || 1)), 0);
  const iva = subtotal * (iva_pct / 100);
  const total = subtotal + iva;

  const fmtEur = n => n.toFixed(2).replace('.', ',') + ' €';

  const lineasHtml = lineas.map((l, i) => `
    <tr>
      <td class="td-desc">${l.descripcion || ''}</td>
      <td class="td-center">${l.cantidad || 1}</td>
      <td class="td-center">${fmtEur(parseFloat(l.precio || 0))}</td>
      <td class="td-center">${fmtEur(parseFloat(l.precio || 0) * parseInt(l.cantidad || 1))}</td>
    </tr>
  `).join('');

  // Filas vacías hasta 4 líneas mínimo
  const emptyRows = Math.max(0, 3 - lineas.length);
  const emptyHtml = Array(emptyRows).fill('<tr><td class="td-desc">&nbsp;</td><td></td><td></td><td></td></tr>').join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&family=Cormorant+Garamond:wght@400;600&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Montserrat', sans-serif;
    background: #fff;
    color: #2a2a2a;
    width: 210mm;
    min-height: 297mm;
    padding: 0;
  }
  .header-band {
    background: #C4A4A8;
    height: 38mm;
    width: 100%;
    position: relative;
  }
  .logo-box {
    position: absolute;
    right: 18mm;
    top: 6mm;
    background: #fff;
    border-radius: 6px;
    padding: 6px 14px 10px;
    text-align: center;
    min-width: 44mm;
  }
  .logo-box img { height: 22mm; object-fit: contain; }
  .logo-box .brand {
    font-size: 7pt;
    letter-spacing: 2px;
    font-weight: 700;
    color: #2a2a2a;
    margin-top: 3px;
    display: block;
  }
  .body {
    padding: 8mm 18mm 10mm;
  }
  .factura-title {
    font-size: 42pt;
    font-weight: 700;
    letter-spacing: 4px;
    line-height: 1;
    margin-bottom: 6mm;
    margin-top: 6mm;
  }
  .emisor-info { font-size: 8pt; line-height: 1.7; color: #2a2a2a; }
  .numero-box {
    position: absolute;
    right: 18mm;
    top: 38mm;
    margin-top: 4mm;
  }
  .numero-label {
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 2px;
    text-align: center;
    margin-bottom: 2mm;
  }
  .numero-value {
    border: 1px solid #ccc;
    border-radius: 3px;
    padding: 3mm 10mm;
    font-size: 11pt;
    text-align: center;
    min-width: 30mm;
    background: #fafafa;
  }
  .top-right-wrapper {
    position: relative;
    height: 0;
  }
  .fecha-line {
    text-align: right;
    font-size: 8.5pt;
    letter-spacing: 1px;
    margin-bottom: 6mm;
    padding-right: 0;
  }
  .section-label {
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 2px;
    color: #2a2a2a;
    border-bottom: 1.5px solid #C4A4A8;
    padding-bottom: 1mm;
    margin-bottom: 3mm;
    display: inline-block;
  }
  .client-info { font-size: 9pt; line-height: 1.8; margin-bottom: 7mm; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6mm;
    font-size: 8.5pt;
  }
  table.items thead tr {
    background: #ddd;
  }
  table.items th {
    padding: 2.5mm 3mm;
    text-align: center;
    font-weight: 700;
    letter-spacing: 1px;
    font-size: 7.5pt;
    border: 1px solid #bbb;
  }
  table.items th:first-child { text-align: left; }
  table.items td {
    border: 1px solid #ccc;
    padding: 3mm 3mm;
    vertical-align: top;
    min-height: 14mm;
    height: 14mm;
  }
  .td-desc { text-align: left; width: 55%; }
  .td-center { text-align: center; width: 15%; }
  .bottom-row {
    display: flex;
    gap: 6mm;
    margin-bottom: 8mm;
    min-height: 28mm;
  }
  .notas-box {
    flex: 1;
    border: 1px solid #ccc;
    border-radius: 3px;
    padding: 3mm;
    font-size: 7.5pt;
    color: #666;
    min-height: 28mm;
  }
  .totals-box {
    width: 70mm;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 9pt;
  }
  .totals-box tr td {
    padding: 2mm 4mm;
    border-bottom: 1px solid #eee;
  }
  .totals-box tr:last-child td { border-bottom: none; font-weight: 700; font-size: 10pt; }
  .totals-box td:last-child { text-align: right; }
  .footer-band {
    background: #C4A4A8;
    padding: 4mm 18mm;
    text-align: center;
  }
  .footer-email {
    color: #fff;
    font-weight: 700;
    font-size: 10pt;
    letter-spacing: 1px;
  }
  .footer-lopd {
    padding: 4mm 18mm 6mm;
    font-size: 6pt;
    color: #666;
    text-align: center;
    line-height: 1.6;
  }
  .lopd-title {
    font-weight: 700;
    letter-spacing: 1px;
    font-size: 6.5pt;
    margin-bottom: 2mm;
    display: block;
  }
</style>
</head>
<body>
  <div class="header-band">
    <div class="logo-box">
      <div style="font-size:28pt; color:#C4A4A8; line-height:1;">&#9774;</div>
      <span class="brand">PSIKOAPRENDE</span>
    </div>
  </div>

  <div class="body" style="position:relative;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div class="factura-title">FACTURA</div>
        <div class="emisor-info">
          <strong>${emisor_nombre || ''}</strong><br/>
          ${emisor_nif || ''}<br/>
          ${(emisor_direccion || '').replace(/\n/g, '<br/>')}<br/>
          ${emisor_telefono ? 'Tel: ' + emisor_telefono : ''}
        </div>
      </div>
      <div style="text-align:center; margin-top:6mm;">
        <div class="numero-label">FACTURA NÚMERO</div>
        <div class="numero-value">${numero || ''}</div>
      </div>
    </div>

    <div class="fecha-line" style="margin-top:5mm;">FECHA: ${fecha || ''}</div>

    <div class="section-label">DATOS DEL CLIENTE</div>
    <div class="client-info">
      Nombre o Razón Social: ${cliente_nombre || ''}<br/>
      DNI: ${cliente_dni || ''}<br/>
      Dirección: ${cliente_direccion || ''}
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>DESCRIPCIÓN</th>
          <th>CANTIDAD</th>
          <th>PRECIO</th>
          <th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${lineasHtml}
        ${emptyHtml}
      </tbody>
    </table>

    <div class="bottom-row">
      <div class="notas-box">${notas}</div>
      <table class="totals-box">
        <tr><td>Sub Total</td><td>${fmtEur(subtotal)}</td></tr>
        <tr><td>IVA (${iva_pct}%)</td><td>${fmtEur(iva)}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>${fmtEur(total)}</strong></td></tr>
      </table>
    </div>
  </div>

  <div class="footer-band">
    <div class="footer-email">facturacion@psikoaprende.com</div>
  </div>
  <div class="footer-lopd">
    <span class="lopd-title">INFORMACIÓN SOBRE PROTECCIÓN DE DATOS</span>
    Los datos personales tratados para gestionar la relación contractual y, en su caso, para enviar información comercial por medios electrónicos,
    se conservarán hasta la finalización de la relación, la baja comercial o durante los plazos de retención legalmente establecidos.<br/>
    Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad enviando su solicitud a la
    dirección postal del responsable o al correo electrónico info@psikoaprende.com
  </div>
</body>
</html>`;
}

// ============================================================
// TEMPLATE: CERTIFICADO página 1
// ============================================================
export function buildCertP1Html(data) {
  const {
    alumno_nombre, alumno_dni,
    curso_nombre,
    horas_total, fecha_inicio, fecha_fin,
    ciudad = 'Valencia', pais = 'España', fecha_expedicion,
    firma_alumno_url, firma_director_url, firma_resp_url,
    director_nombre = 'Carlos Saiz',
    resp_nombre = 'Mireia Jareño',
  } = data;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cormorant+Garamond:wght@300;400;500;600&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 297mm;
    height: 210mm;
    font-family: 'Montserrat', sans-serif;
    background: #fff;
    overflow: hidden;
  }
  .page {
    width: 297mm;
    height: 210mm;
    position: relative;
    background: #fff;
    display: flex;
    align-items: stretch;
  }
  /* Marco dorado exterior */
  .frame {
    position: absolute;
    inset: 5mm;
    border: 3px solid #C9A84C;
    box-shadow: inset 0 0 0 1.5px #E8D080, inset 0 0 0 3px #C9A84C;
    pointer-events: none;
    z-index: 10;
  }
  /* Cintas doradas — SVG decorativo */
  .bg-waves {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }
  .content {
    position: relative;
    z-index: 5;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 10mm 18mm 8mm;
    text-align: center;
  }
  .logo-tab {
    background: #fff;
    border: 1.5px solid #C9A84C;
    border-radius: 0 0 50% 50% / 0 0 20px 20px;
    padding: 4mm 10mm 6mm;
    margin-bottom: 5mm;
    margin-top: -2mm;
    text-align: center;
  }
  .logo-icon { font-size: 20pt; color: #2a2a2a; line-height: 1; }
  .logo-brand {
    font-size: 6.5pt;
    letter-spacing: 2.5px;
    font-weight: 700;
    color: #2a2a2a;
    margin-top: 2px;
    display: block;
  }
  .alumno-name {
    font-family: 'Great Vibes', cursive;
    font-size: 36pt;
    color: #C9A84C;
    line-height: 1.1;
    margin-bottom: 3mm;
  }
  .subtitle {
    font-size: 8.5pt;
    color: #3a3a3a;
    letter-spacing: 0.5px;
    margin-bottom: 4mm;
    font-weight: 400;
  }
  .curso-nombre {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22pt;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 4mm;
    line-height: 1.2;
  }
  .cuerpo {
    font-size: 8.5pt;
    color: #333;
    line-height: 1.7;
    max-width: 200mm;
    margin-bottom: 3mm;
  }
  .aval {
    font-size: 8.5pt;
    font-weight: 700;
    color: #222;
    margin-bottom: 5mm;
    line-height: 1.5;
  }
  .firmas {
    display: flex;
    justify-content: space-around;
    width: 100%;
    margin-top: auto;
    padding-top: 2mm;
  }
  .firma-col {
    text-align: center;
    width: 60mm;
  }
  .firma-img {
    height: 14mm;
    object-fit: contain;
    display: block;
    margin: 0 auto 1mm;
  }
  .firma-line {
    border-top: 1px solid #333;
    margin-bottom: 1.5mm;
    width: 50mm;
    margin-left: auto;
    margin-right: auto;
  }
  .firma-nombre {
    font-size: 8pt;
    font-weight: 600;
    color: #222;
  }
  .firma-rol {
    font-size: 7pt;
    color: #555;
  }
</style>
</head>
<body>
<div class="page">
  <!-- SVG background waves (decoración dorada) -->
  <svg class="bg-waves" viewBox="0 0 1122 794" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="gA" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F5E17A" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="#C9A84C" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#8B6914" stop-opacity="0.7"/>
      </linearGradient>
      <linearGradient id="gB" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#F5E17A" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="#C9A84C" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#8B6914" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <!-- Cintas superiores izquierda -->
    <path d="M-20 160 Q120 20 320 -20 L340 20 Q140 60 0 200Z" fill="url(#gA)"/>
    <path d="M-20 220 Q160 40 400 -20 L420 25 Q180 85 0 265Z" fill="url(#gA)" opacity="0.7"/>
    <path d="M-20 100 Q80 10 200 -20 L215 15 Q95 45 0 135Z" fill="url(#gA)" opacity="0.5"/>
    <!-- Cintas inferiores derecha -->
    <path d="M1142 634 Q1002 774 802 814 L782 774 Q982 734 1122 594Z" fill="url(#gB)"/>
    <path d="M1142 574 Q962 754 722 814 L702 769 Q942 709 1122 529Z" fill="url(#gB)" opacity="0.7"/>
    <path d="M1142 694 Q1042 784 922 814 L907 779 Q1027 749 1122 659Z" fill="url(#gB)" opacity="0.5"/>
  </svg>

  <!-- Marco dorado -->
  <div class="frame"></div>

  <div class="content">
    <div class="logo-tab">
      <div class="logo-icon">&#9774;</div>
      <span class="logo-brand">PSIKOAPRENDE</span>
    </div>

    <div class="alumno-name">${alumno_nombre || ''}</div>

    <div class="subtitle">con DNI: ${alumno_dni || ''}, ha superado con éxito los objetivos establecidos para el:</div>

    <div class="curso-nombre">${curso_nombre || ''}</div>

    <div class="cuerpo">
      Por un total de <strong>${horas_total || ''} horas</strong> teórico prácticas.
      Inicio el ${fecha_inicio || ''} y finalizado el ${fecha_fin || ''}.<br/>
      ${ciudad}, ${pais} ${fecha_expedicion || ''}.
    </div>

    <div class="aval">
      Este certificado ha sido expedido por Psiko Aprende y avalado por ISEIE Innovation School, e Hispamedic
    </div>

    <div class="firmas">
      <div class="firma-col">
        ${firma_alumno_url ? `<img class="firma-img" src="${firma_alumno_url}"/>` : '<div style="height:14mm;"></div>'}
        <div class="firma-line"></div>
        <div class="firma-nombre">${alumno_nombre || ''}</div>
        <div class="firma-rol">Alumno</div>
      </div>
      <div class="firma-col">
        ${firma_director_url ? `<img class="firma-img" src="${firma_director_url}"/>` : '<div style="height:14mm;"></div>'}
        <div class="firma-line"></div>
        <div class="firma-nombre">${director_nombre}</div>
        <div class="firma-rol">Director</div>
      </div>
      <div class="firma-col">
        ${firma_resp_url ? `<img class="firma-img" src="${firma_resp_url}"/>` : '<div style="height:14mm;"></div>'}
        <div class="firma-line"></div>
        <div class="firma-nombre">${resp_nombre}</div>
        <div class="firma-rol">Responsable de Formación</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ============================================================
// TEMPLATE: CERTIFICADO página 2 — Plan de estudios
// ============================================================
export function buildCertP2Html(data) {
  const {
    curso_nombre,
    modalidad = 'Online',
    horas_total,
    modulos = [],
  } = data;

  const modulosHtml = modulos.map((m, i) =>
    `<li><strong>Módulo ${i + 1}:</strong> ${m}</li>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 297mm;
    height: 210mm;
    font-family: 'Montserrat', sans-serif;
    background: #fff;
    overflow: hidden;
  }
  .page {
    width: 297mm;
    height: 210mm;
    position: relative;
    background: #fff;
  }
  .frame {
    position: absolute;
    inset: 5mm;
    border: 3px solid #C9A84C;
    box-shadow: inset 0 0 0 1.5px #E8D080, inset 0 0 0 3px #C9A84C;
    pointer-events: none;
    z-index: 10;
  }
  .bg-waves {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }
  .content {
    position: relative;
    z-index: 5;
    padding: 10mm 18mm 8mm;
  }
  .curso-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 24pt;
    font-weight: 400;
    text-align: center;
    color: #1a1a1a;
    margin-bottom: 7mm;
  }
  .plan-title {
    font-size: 11pt;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 5mm;
  }
  .plan-grid {
    display: grid;
    grid-template-columns: 35mm 40mm 1fr;
    gap: 0 6mm;
  }
  .plan-label { font-size: 8.5pt; font-weight: 700; }
  .plan-value { font-size: 8.5pt; font-weight: 400; }
  .modulos-list {
    list-style: disc;
    padding-left: 5mm;
    font-size: 7.8pt;
    line-height: 1.65;
    color: #222;
  }
  .logos-row {
    position: absolute;
    bottom: 12mm;
    left: 18mm;
    right: 18mm;
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 5;
  }
  .logo-item {
    text-align: center;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .logo-hispamedic {
    font-size: 16pt;
    font-weight: 900;
    letter-spacing: 2px;
    color: #111;
    font-family: 'Montserrat', sans-serif;
  }
  .logo-iseie {
    width: 20mm;
    height: 20mm;
    border-radius: 50%;
    border: 2px solid #4a7abf;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    color: #4a7abf;
    font-size: 6.5pt;
    font-weight: 700;
    text-align: center;
  }
  .logo-psiko { font-size: 7pt; letter-spacing: 2px; font-weight: 700; }
</style>
</head>
<body>
<div class="page">
  <svg class="bg-waves" viewBox="0 0 1122 794" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="gA" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F5E17A" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="#C9A84C" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#8B6914" stop-opacity="0.7"/>
      </linearGradient>
      <linearGradient id="gB" x1="100%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#F5E17A" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="#C9A84C" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#8B6914" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <path d="M-20 160 Q120 20 320 -20 L340 20 Q140 60 0 200Z" fill="url(#gA)"/>
    <path d="M-20 220 Q160 40 400 -20 L420 25 Q180 85 0 265Z" fill="url(#gA)" opacity="0.7"/>
    <path d="M-20 100 Q80 10 200 -20 L215 15 Q95 45 0 135Z" fill="url(#gA)" opacity="0.5"/>
    <path d="M1142 634 Q1002 774 802 814 L782 774 Q982 734 1122 594Z" fill="url(#gB)"/>
    <path d="M1142 574 Q962 754 722 814 L702 769 Q942 709 1122 529Z" fill="url(#gB)" opacity="0.7"/>
    <path d="M1142 694 Q1042 784 922 814 L907 779 Q1027 749 1122 659Z" fill="url(#gB)" opacity="0.5"/>
  </svg>
  <div class="frame"></div>

  <div class="content">
    <div class="curso-title">${curso_nombre || ''}</div>
    <div class="plan-title">Distribución General del Plan de Estudios</div>
    <div class="plan-grid">
      <div>
        <div class="plan-label">Modalidad:</div>
        <div class="plan-value">${modalidad}</div>
      </div>
      <div>
        <div class="plan-label">Horas de<br/>formación:</div>
        <div class="plan-value">${horas_total || ''}</div>
      </div>
      <div>
        <div class="plan-label">Programa formativo</div>
        <ul class="modulos-list">${modulosHtml}</ul>
      </div>
    </div>
  </div>

  <div class="logos-row">
    <div class="logo-item logo-hispamedic">HISPAMEDIC</div>
    <div class="logo-item">
      <div class="logo-iseie">
        <div>INSTITUCIÓN</div>
        <div>SUPERIOR</div>
        <div style="font-size:8pt;font-weight:900;">ISEIE</div>
        <div>BG7799247</div>
      </div>
    </div>
    <div class="logo-item">
      <div style="font-size:18pt; color:#C9A84C; margin-bottom:2px;">&#9774;</div>
      <div class="logo-psiko">PSIKOAPRENDE</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ============================================================
// Generar PDF multi-página certificado (p1 + p2)
// ============================================================
export async function generateInvoicePdf(data, filename) {
  const html = buildInvoiceHtml(data);
  return htmlToPdf(html, filename);
}

export async function generateCertificatePdf(data, filename) {
  await ensureDir();
  const filePath = path.join(UPLOAD_DIR, filename);
  const browser = await puppeteer.launch({ headless: 'new', executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    // Página 1
    await page.setContent(buildCertP1Html(data), { waitUntil: 'networkidle0' });
    const p1 = await page.pdf({ printBackground: true, format: 'A4', landscape: true });
    // Página 2
    await page.setContent(buildCertP2Html(data), { waitUntil: 'networkidle0' });
    const p2 = await page.pdf({ printBackground: true, format: 'A4', landscape: true });

    // Merge PDFs con pdf-lib
    const { PDFDocument } = await import('pdf-lib');
    const merged = await PDFDocument.create();
    for (const pdfBytes of [p1, p2]) {
      const doc = await PDFDocument.load(pdfBytes);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    const mergedBytes = await merged.save();
    await fs.writeFile(filePath, mergedBytes);
  } finally {
    await browser.close();
  }
  return filePath;
}
