import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/var/crm-uploads/documents';

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

const CHROME_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'];

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      req.abort();
    } else {
      req.continue();
    }
  });
  return page;
}

async function htmlToPdf(html, filename) {
  await ensureDir();
  const filePath = path.join(UPLOAD_DIR, filename);
  const browser = await puppeteer.launch({ headless: 'new', executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: CHROME_ARGS });
  try {
    const page = await newPage(browser);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.pdf({ path: filePath, printBackground: true, format: 'A4' });
  } finally {
    await browser.close();
  }
  return filePath;
}

async function htmlToPdfLandscape(html, filename) {
  await ensureDir();
  const filePath = path.join(UPLOAD_DIR, filename);
  const browser = await puppeteer.launch({ headless: 'new', executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: CHROME_ARGS });
  try {
    const page = await newPage(browser);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
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

// SVG compartido de ondas doradas (igual en ambas páginas del certificado)
const CERT_WAVES_SVG = `
<svg class="bg-waves" viewBox="0 0 1122 794" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="gTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#F9EDA0" stop-opacity="0.5"/>
      <stop offset="35%"  stop-color="#D4AA50" stop-opacity="0.75"/>
      <stop offset="70%"  stop-color="#C9A84C" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#A07828" stop-opacity="0.6"/>
    </linearGradient>
    <linearGradient id="gBot" x1="100%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%"   stop-color="#F9EDA0" stop-opacity="0.5"/>
      <stop offset="35%"  stop-color="#D4AA50" stop-opacity="0.75"/>
      <stop offset="70%"  stop-color="#C9A84C" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#A07828" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <!-- Grupo superior-izquierda: cintas fluidas -->
  <path d="M-20 350 C80 200 280 60 560 -10 C800 -60 1050 20 1122 80
           L1122 20 C1040 -20 790 -90 540 -40 C270 20 60 170 -20 330 Z"
        fill="url(#gTop)" opacity="0.30"/>
  <path d="M-20 230 C60 120 220 30 450 -10 C650 -45 880 30 1050 120
           L1050 60 C870 -20 640 -90 430 -40 C200 20 50 110 -20 200 Z"
        fill="url(#gTop)" opacity="0.55"/>
  <path d="M-20 140 C50 60 170 0 360 -15 C520 -28 700 40 860 130
           L860 70 C700 -20 510 -70 350 -50 C160 -28 40 40 -20 110 Z"
        fill="url(#gTop)" opacity="0.75"/>
  <path d="M-20 75 C30 20 130 -20 280 -20 C420 -20 560 50 680 110
           L680 60 C560 0 415 -60 275 -55 C125 -48 25 10 -20 50 Z"
        fill="url(#gTop)" opacity="0.90"/>
  <!-- Grupo inferior-derecha: cintas fluidas (espejo) -->
  <path d="M1142 444 C1062 594 862 734 582 804 C322 860 72 774 0 714
           L0 774 C82 830 342 910 602 844 C882 774 1072 624 1142 474 Z"
        fill="url(#gBot)" opacity="0.30"/>
  <path d="M1142 564 C1082 674 922 764 692 804 C472 841 242 764 72 674
           L72 734 C252 820 482 894 712 844 C942 784 1092 684 1142 604 Z"
        fill="url(#gBot)" opacity="0.55"/>
  <path d="M1142 654 C1092 734 952 794 762 814 C602 830 422 754 262 664
           L262 724 C432 808 612 874 772 850 C962 820 1102 750 1142 684 Z"
        fill="url(#gBot)" opacity="0.75"/>
  <path d="M1142 719 C1112 774 992 814 842 814 C702 814 562 744 442 684
           L442 734 C565 790 705 860 845 854 C998 844 1118 794 1142 749 Z"
        fill="url(#gBot)" opacity="0.90"/>
</svg>`;

// SVG logo Psikoaprende (cerebro/neuronas circular, line art)
const PSIKO_LOGO_SVG = `
<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style="width:14mm;height:14mm;display:block;margin:0 auto;">
  <circle cx="40" cy="40" r="36" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="40" cy="22" r="4" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="55" cy="30" r="3.5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="58" cy="46" r="3.5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="48" cy="58" r="3.5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="32" cy="58" r="3.5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="22" cy="46" r="3.5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="25" cy="30" r="3.5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <circle cx="40" cy="40" r="5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
  <line x1="40" y1="26" x2="40" y2="35" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="52" y1="33" x2="45" y2="37" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="54" y1="49" x2="45" y2="43" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="45" y1="54" x2="43" y2="45" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="35" y1="54" x2="37" y2="45" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="26" y1="49" x2="35" y2="43" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="28" y1="33" x2="35" y2="37" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="52" y1="33" x2="55" y2="43" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="25" y1="33" x2="22" y2="43" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" y1="22" x2="52" y2="30" stroke="#1a1a1a" stroke-width="1"/>
  <line x1="40" y1="22" x2="28" y2="30" stroke="#1a1a1a" stroke-width="1"/>
</svg>`;

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
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('data:text/css,');
  html, body { width:297mm; height:210mm; background:#fff; overflow:hidden; }
  .page {
    width: 297mm; height: 210mm;
    position: relative; background: #fff;
  }
  .bg-waves { position:absolute; inset:0; width:100%; height:100%; z-index:1; }
  .frame {
    position: absolute; inset: 5mm; z-index: 10; pointer-events: none;
    border: 2.5px solid #C9A84C;
    box-shadow: inset 0 0 0 1px #E8D480;
  }
  .content {
    position: relative; z-index: 5;
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    padding: 0 18mm 8mm;
    text-align: center;
  }
  /* Logo tab — arco blanco centrado en la parte superior */
  .logo-tab {
    background: #fff;
    border: 1.5px solid #C9A84C;
    border-top: none;
    border-radius: 0 0 60px 60px;
    padding: 4mm 12mm 5mm;
    display: inline-flex; flex-direction: column; align-items: center;
    min-width: 42mm;
  }
  .logo-brand {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 6pt; letter-spacing: 3px; font-weight: 700;
    color: #1a1a1a; margin-top: 2.5mm; display: block;
  }
  /* Zona central */
  .center-block { display:flex; flex-direction:column; align-items:center; gap:3mm; }
  .alumno-name {
    font-family: 'Brush Script MT', 'Comic Sans MS', cursive;
    font-size: 38pt; color: #C9A84C; line-height: 1.1;
  }
  .subtitle {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt; color: #3a3a3a; letter-spacing: 0.3px;
  }
  .curso-nombre {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 24pt; font-weight: 700;
    color: #1a1a1a; line-height: 1.2;
  }
  .cuerpo {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt; color: #333; line-height: 1.75;
  }
  .aval {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8.5pt; font-weight: 700; color: #1a1a1a;
  }
  /* Firmas */
  .firmas { display:flex; justify-content:space-around; width:100%; }
  .firma-col { text-align:center; width:60mm; }
  .firma-img { height:13mm; object-fit:contain; display:block; margin:0 auto 1.5mm; }
  .firma-line {
    border-top: 1px solid #555; width:50mm;
    margin: 0 auto 1.5mm;
  }
  .firma-nombre {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.5pt; font-weight: 600; color: #222;
  }
  .firma-rol {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7pt; color: #555;
  }
</style>
</head>
<body>
<div class="page">
  ${CERT_WAVES_SVG}
  <div class="frame"></div>
  <div class="content">

    <div class="logo-tab">
      ${PSIKO_LOGO_SVG}
      <span class="logo-brand">PSIKOAPRENDE</span>
    </div>

    <div class="center-block">
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
    </div>

    <div class="firmas">
      <div class="firma-col">
        ${firma_alumno_url ? `<img class="firma-img" src="${firma_alumno_url}"/>` : '<div style="height:13mm;"></div>'}
        <div class="firma-line"></div>
        <div class="firma-nombre">${alumno_nombre || ''}</div>
        <div class="firma-rol">Alumno</div>
      </div>
      <div class="firma-col">
        ${firma_director_url ? `<img class="firma-img" src="${firma_director_url}"/>` : '<div style="height:13mm;"></div>'}
        <div class="firma-line"></div>
        <div class="firma-nombre">${director_nombre}</div>
        <div class="firma-rol">Director</div>
      </div>
      <div class="firma-col">
        ${firma_resp_url ? `<img class="firma-img" src="${firma_resp_url}"/>` : '<div style="height:13mm;"></div>'}
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
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width:297mm; height:210mm; background:#fff; overflow:hidden; font-family: Arial, Helvetica, sans-serif; }
  .page { width:297mm; height:210mm; position:relative; background:#fff; }
  .bg-waves { position:absolute; inset:0; width:100%; height:100%; z-index:1; }
  .frame {
    position:absolute; inset:5mm; z-index:10; pointer-events:none;
    border: 2.5px solid #C9A84C;
    box-shadow: inset 0 0 0 1px #E8D480;
  }
  .content {
    position:relative; z-index:5;
    padding: 9mm 18mm 0;
    height: calc(210mm - 32mm);
  }
  .curso-title {
    font-size: 22pt; font-weight: 700;
    text-align: center; color: #1a1a1a;
    margin-bottom: 6mm;
  }
  .plan-title {
    font-size: 10.5pt; font-weight: 700;
    color: #1a1a1a; margin-bottom: 4mm;
  }
  .plan-grid {
    display: grid;
    grid-template-columns: 32mm 38mm 1fr;
    gap: 0 8mm;
    align-items: start;
  }
  .col-label { font-size: 8.5pt; font-weight: 700; color: #1a1a1a; margin-bottom: 2mm; }
  .col-value { font-size: 8.5pt; color: #333; }
  .modulos-list {
    list-style: disc; padding-left: 4mm;
    font-size: 7.8pt; line-height: 1.65; color: #222;
  }
  .logos-row {
    position: absolute; bottom: 10mm;
    left: 18mm; right: 18mm; z-index: 5;
    display: flex; justify-content: space-around; align-items: center;
  }
  .logo-hispamedic {
    font-size: 14pt; font-weight: 900; letter-spacing: 2px; color: #111;
  }
  .logo-iseie {
    width: 18mm; height: 18mm; border-radius: 50%;
    border: 2px solid #4a7abf;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; color: #4a7abf;
    font-size: 5.5pt; font-weight: 700; text-align: center; line-height: 1.3;
  }
  .logo-psiko { font-size: 6.5pt; letter-spacing: 2px; font-weight: 700; margin-top: 1mm; }
</style>
</head>
<body>
<div class="page">
  ${CERT_WAVES_SVG}
  <div class="frame"></div>

  <div class="content">
    <div class="curso-title">${curso_nombre || ''}</div>
    <div class="plan-title">Distribución General del Plan de Estudios</div>
    <div class="plan-grid">
      <div>
        <div class="col-label">Modalidad:</div>
        <div class="col-value">${modalidad}</div>
      </div>
      <div>
        <div class="col-label">Horas de formación:</div>
        <div class="col-value">${horas_total || ''}</div>
      </div>
      <div>
        <div class="col-label">Programa formativo</div>
        <ul class="modulos-list">${modulosHtml}</ul>
      </div>
    </div>
  </div>

  <div class="logos-row">
    <div class="logo-hispamedic">HISPAMEDIC</div>
    <div class="logo-iseie">
      <div>INSTITUCIÓN</div><div>SUPERIOR</div>
      <div style="font-size:7pt;font-weight:900;">ISEIE</div>
      <div>BG7799247</div>
    </div>
    <div style="text-align:center;">
      ${PSIKO_LOGO_SVG.replace('width:14mm;height:14mm', 'width:11mm;height:11mm')}
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
  const browser = await puppeteer.launch({ headless: 'new', executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: CHROME_ARGS });
  try {
    const page = await newPage(browser);
    // Página 1
    await page.setContent(buildCertP1Html(data), { waitUntil: 'domcontentloaded', timeout: 15000 });
    const p1 = await page.pdf({ printBackground: true, format: 'A4', landscape: true });
    // Página 2
    await page.setContent(buildCertP2Html(data), { waitUntil: 'domcontentloaded', timeout: 15000 });
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

// Preview combinado certificado (ambas páginas en un HTML scrollable)
export function buildCertPreviewHtml(data) {
  const scale = 0.72; // escala A4 landscape (297mm) para caber en pantalla
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #e5e7eb; padding: 20px; display: flex; flex-direction: column; gap: 20px; align-items: flex-start; font-family: sans-serif; }
  .cert-page {
    width: 297mm;
    height: 210mm;
    position: relative;
    background: #fff;
    overflow: hidden;
    transform: scale(${scale});
    transform-origin: top left;
    margin-bottom: calc((210mm * ${scale}) - 210mm);
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  }
</style>
</head>
<body>
  <div class="cert-page">${_certP1Body(data)}</div>
  <div class="cert-page">${_certP2Body(data)}</div>
</body>
</html>`;
}

function _certP1Body(data) {
  const html = buildCertP1Html(data);
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
  const styles = styleMatch ? `<style>${styleMatch[1]}</style>` : '';
  const body = bodyMatch ? bodyMatch[1] : '';
  return `${styles}${body}`;
}

function _certP2Body(data) {
  const html = buildCertP2Html(data);
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
  const styles = styleMatch ? `<style>${styleMatch[1].replace(/html,\s*body\s*\{[^}]*\}/g, '')}</style>` : '';
  const body = bodyMatch ? bodyMatch[1] : '';
  return `${styles}${body}`;
}
