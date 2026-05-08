// F4-005: tests de la generacion de HTML para facturas multi-pagina.
// Solo testeamos el template (funcion pura). El PDF real se valida manual
// porque puppeteer requiere headless Chrome y es costoso en CI.

import { describe, it, expect } from 'vitest';
import { buildInvoiceHtml, buildInvoiceHtmlMultiPage } from '../src/modules/documents/documents.service.js';

const baseData = {
  numero: 'FAC-2026-0193',
  fecha: '2026-05-07',
  emisor_nombre: 'PSIKOAPRENDE S.L.',
  emisor_nif: 'B12345678',
  emisor_direccion: 'Calle Falsa 123\n28001 Madrid',
  emisor_telefono: '+34 912 345 678',
  cliente_nombre: 'Cliente Demo',
  cliente_dni: '12345678A',
  cliente_direccion: 'Calle Cliente 1, Madrid',
  iva_pct: 21,
};

function makeLines(n) {
  return Array.from({ length: n }, (_, i) => ({
    descripcion: `Producto ${i + 1}`,
    cantidad: 1,
    precio: 100,
  }));
}

describe('buildInvoiceHtml — single-page (caso normal)', () => {
  it('renderiza el HTML completo con 5 lineas', () => {
    const html = buildInvoiceHtml({ ...baseData, lineas: makeLines(5) });
    expect(html).toContain('FAC-2026-0193');
    expect(html).toContain('PSIKOAPRENDE S.L.');
    expect(html).toContain('Producto 1');
    expect(html).toContain('Producto 5');
    // El footer-band va inline en el HTML single-page.
    expect(html).toContain('class="footer-band"');
    // Sub Total / Total siempre presentes.
    expect(html).toContain('Sub Total');
    expect(html).toContain('Total');
  });

  it('aplica modo compact con 8 lineas (rango 7-12)', () => {
    const html = buildInvoiceHtml({ ...baseData, lineas: makeLines(8) });
    expect(html).toContain('class="items-table compact"');
  });

  it('aplica modo dense con 20 lineas (rango >12)', () => {
    const html = buildInvoiceHtml({ ...baseData, lineas: makeLines(20) });
    expect(html).toContain('class="items-table dense"');
  });
});

describe('buildInvoiceHtmlMultiPage — F4-005', () => {
  it('incluye TODAS las 30 lineas en el HTML resultante', () => {
    const html = buildInvoiceHtmlMultiPage({ ...baseData, lineas: makeLines(30) });
    expect(html).toContain('Producto 1');
    expect(html).toContain('Producto 15');
    expect(html).toContain('Producto 30');
  });

  it('declara el thead como table-header-group para repetir cabecera', () => {
    const html = buildInvoiceHtmlMultiPage({ ...baseData, lineas: makeLines(30) });
    expect(html).toMatch(/\.items-table thead\s*\{\s*display:\s*table-header-group;/);
  });

  it('marca .bottom-row con page-break-inside: avoid (sello+totales no se parten)', () => {
    const html = buildInvoiceHtmlMultiPage({ ...baseData, lineas: makeLines(30) });
    expect(html).toMatch(/\.bottom-row\s*\{[^}]*page-break-inside:\s*avoid/);
  });

  it('envuelve sello+totales en .last-page con page-break-before:always (posicion fija al pie)', () => {
    const html = buildInvoiceHtmlMultiPage({ ...baseData, lineas: makeLines(30) });
    // El bloque .last-page fuerza salto de pagina y ancla el bottom-row al pie.
    expect(html).toMatch(/\.last-page\s*\{[^}]*page-break-before:\s*always/);
    expect(html).toMatch(/\.last-page\s*\{[^}]*justify-content:\s*flex-end/);
    // El HTML debe contener el wrapper antes del bottom-row.
    expect(html).toMatch(/<div class="last-page">[\s\S]*<div class="bottom-row">/);
  });

  it('NO incluye footer-band inline (lo inyecta puppeteer.footerTemplate)', () => {
    const html = buildInvoiceHtmlMultiPage({ ...baseData, lineas: makeLines(30) });
    expect(html).not.toContain('class="footer-band"');
  });

  it('marca cada fila <tr> con page-break-inside: avoid para no partir filas', () => {
    const html = buildInvoiceHtmlMultiPage({ ...baseData, lineas: makeLines(30) });
    expect(html).toMatch(/\.items-table tbody tr\s*\{[^}]*page-break-inside:\s*avoid/);
  });

  it('preserva subtotal/IVA/total en la última página', () => {
    const html = buildInvoiceHtmlMultiPage({ ...baseData, lineas: makeLines(30) });
    expect(html).toContain('Sub Total');
    expect(html).toContain('IVA (21%)');
    expect(html).toContain('Total');
    // 30 productos x 100€ x 1.21 = 3630,00 € (fmtEur no agrega separador miles)
    expect(html).toContain('3630,00');
  });

  it('mantiene el header pixel-perfect (logo, factura titulo, datos cliente)', () => {
    const html = buildInvoiceHtmlMultiPage({ ...baseData, lineas: makeLines(30) });
    expect(html).toContain('FACTURA NÚMERO');
    expect(html).toContain('DATOS DEL CLIENTE');
    expect(html).toContain(baseData.cliente_nombre);
    expect(html).toContain(baseData.emisor_nombre);
  });
});
