// ============================================================
// Scraper genérico de HTML para páginas de producto/curso WP.
//
// Filosofía:
//   - No asume estructura rígida.
//   - El admin configura `section_keywords` (JSONB en wc_credentials).
//   - Para cada sección lógica del CRM, el scraper busca en los <h2>
//     que contengan cualquiera de los keywords, recorta el bloque hasta
//     el siguiente <h2> y guarda el texto/HTML tal cual.
//   - Los módulos, profesores, FAQs, etc. son TEXTO unificado, no entidades
//     separadas. Si el admin quiere parsearlos uno a uno, lo hace en
//     frontend a partir del texto.
// ============================================================

import { logger } from '../../shared/utils/logger.js';

/** Normaliza texto: quita acentos para comparación de keywords. */
function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Limpia HTML → texto plano colapsado. */
function htmlToText(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x?[0-9a-f]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Encuentra el primer <h2> que contiene cualquiera de las keywords
 * (case + accent insensitive) y devuelve el slice de HTML hasta el siguiente <h2>.
 */
function sliceSectionByKeywords(html, keywords) {
  if (!keywords || keywords.length === 0) return '';
  const normHtml = normalizeForMatch(html);
  // Buscar todos los <h2>
  const h2Re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = h2Re.exec(html)) !== null) {
    const innerText = normalizeForMatch(htmlToText(m[1]));
    const hit = keywords.some((kw) => innerText.includes(normalizeForMatch(kw)));
    if (hit) {
      const start = m.index + m[0].length;
      // Encontrar el siguiente <h2> a partir de start
      const next = html.slice(start).search(/<h2\b/i);
      const end = next === -1 ? Math.min(start + 80000, html.length) : start + next;
      return html.slice(start, end);
    }
  }
  return '';
}

/** Extrae title H1 del HTML (best-effort, primer h1 no vacío). */
function extractH1(html) {
  const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? htmlToText(m[1]).slice(0, 300) : null;
}

/**
 * Extrae el "meta box" de Elementor (widgets icon-box-content) que típicamente
 * contiene: Duración / Horas / Fecha de Inicio / Módulos / Modalidad / Precio.
 *
 * Esto NO depende de section_keywords — es un patrón fijo de Elementor.
 */
function extractMetaBox(html) {
  const LABEL_MAP = {
    duracion: 'duracion',
    horas: 'horas',
    'fecha de inicio': 'fecha_inicio',
    'fecha inicio': 'fecha_inicio',
    modulos: 'num_modulos',
    modalidad: 'modalidad',
    precio: 'precio',
    idioma: 'idioma',
  };
  const out = {};
  // Bloque icon-box-content: contiene title + description
  const blockRe = /<div\b[^>]*class="[^"]*elementor-icon-box-content[^"]*"[^>]*>([\s\S]{0,4000}?)<\/div>/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const block = m[1];
    const titleM = /<(?:h\d|span|div)\b[^>]*class="[^"]*elementor-icon-box-title[^"]*"[^>]*>([\s\S]*?)<\/(?:h\d|span|div)>/i.exec(block);
    const descM = /<(?:p|div|span)\b[^>]*class="[^"]*elementor-icon-box-description[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/i.exec(block);
    if (titleM && descM) {
      const label = normalizeForMatch(htmlToText(titleM[1]));
      const value = htmlToText(descM[1]);
      if (LABEL_MAP[label] && value) out[LABEL_MAP[label]] = value;
    }
  }
  return out;
}

/** Extrae meta tags útiles del head. */
function extractMetaTags(html) {
  const ogImg = /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i.exec(html);
  const desc = /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i.exec(html);
  return {
    imagen_og: ogImg ? ogImg[1] : null,
    meta_description: desc ? desc[1] : null,
  };
}

/**
 * Scrapea una URL pública y devuelve un objeto con TODAS las secciones detectadas
 * según la configuración de section_keywords.
 *
 * @param {string} url - URL pública del producto/curso (permalink)
 * @param {object} sectionKeywords - { presentacion: ['presentaci'], modulos: [...], ... }
 * @param {object} opts - { strategy: 'plain_text' | 'preserve_html', timeoutMs: 30000 }
 * @returns {Promise<object>} { titulo, meta_box, imagen_og, meta_description, sections: {...} }
 */
export async function scrapeProductPage(url, sectionKeywords = {}, opts = {}) {
  const { strategy = 'plain_text', timeoutMs = 30000 } = opts;

  let html;
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CRM-Importer/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: ac.signal,
    });
    clearTimeout(to);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    logger.warn({ url, err: err.message }, 'scrapeProductPage: fetch falló');
    return { error: err.message };
  }

  const result = {
    titulo: extractH1(html),
    meta_box: extractMetaBox(html),
    ...extractMetaTags(html),
    sections: {},
    html_size: html.length,
  };

  // Para cada sección lógica configurada, extraer el slice
  for (const [crmField, keywords] of Object.entries(sectionKeywords || {})) {
    if (!Array.isArray(keywords) || keywords.length === 0) continue;
    const slice = sliceSectionByKeywords(html, keywords);
    if (slice) {
      const value = strategy === 'preserve_html' ? slice.trim() : htmlToText(slice);
      // Limitar a 50KB para no reventar el campo TEXT (que es ilimitado pero…)
      result.sections[crmField] = value.slice(0, 50000);
    }
  }

  return result;
}

export { htmlToText, sliceSectionByKeywords, extractMetaBox, extractH1 };
