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
//     separadas.
//   - El meta_box devuelve TANTO el texto crudo COMO un valor normalizado
//     (número + unidad, fecha ISO, etc.) para que el admin elija.
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
 * Parsea un valor de meta_box y lo normaliza:
 *   "12 meses"     → { text: "12 meses", value: 12, unit: "meses", type: "duration" }
 *   "1500 horas"   → { text: "1500 horas", value: 1500, unit: "horas", type: "hours" }
 *   "10 Módulos"   → { text: "10 Módulos", value: 10, unit: "modulos", type: "count" }
 *   "10-06-2026"   → { text: "10-06-2026", iso_date: "2026-06-10", type: "date" }
 *   "Online"       → { text: "Online", type: "text" }
 *   "EUR 1500"     → { text: "EUR 1500", value: 1500, unit: "EUR", type: "currency" }
 */
function parseMetaValue(label, rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;
  const norm = normalizeForMatch(label);

  // Detectar fecha (dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd)
  const dateMatch = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dateMatch && (norm.includes('fecha') || norm.includes('inicio'))) {
    let [, d, m, y] = dateMatch;
    if (y.length === 2) y = '20' + y;
    const iso = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    return { text, iso_date: iso, type: 'date' };
  }

  // Detectar precio / currency (€, $, EUR, USD)
  if (norm.includes('precio') || norm.includes('coste')) {
    const m = text.match(/([\d.,]+)/);
    if (m) {
      const num = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      const cur = text.match(/[€$]|EUR|USD|GBP|MXN/i);
      return { text, value: num, unit: cur ? cur[0].toUpperCase() : null, type: 'currency' };
    }
  }

  // Detectar número + unidad genérico (12 meses / 1500 horas / 10 Módulos / 30 semanas)
  const numUnit = text.match(/^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)?\s*$/);
  if (numUnit) {
    const value = parseFloat(numUnit[1].replace(',', '.'));
    const unit = numUnit[2] ? normalizeForMatch(numUnit[2]) : null;
    let type = 'number';
    if (unit) {
      if (/mes|ano|semana|dia|hora|minuto/.test(unit)) type = 'duration';
      else if (/modulo|leccion|unidad|tema|bloque/.test(unit)) type = 'count';
      else if (/hora/.test(unit)) type = 'hours';
    }
    return { text, value, unit: numUnit[2] || null, type };
  }

  // Fallback: texto plano (Online, Presencial, Mixto, etc.)
  return { text, type: 'text' };
}

/**
 * Encuentra el primer <h2> que contiene cualquiera de las keywords
 * (case + accent insensitive) y devuelve el slice de HTML hasta el siguiente
 * <h2> O hasta el primer indicador de fin de contenido (footer/section close/h1).
 */
function sliceSectionByKeywords(html, keywords) {
  if (!keywords || keywords.length === 0) return '';

  // Recolectar TODOS los H2 con su posición y texto normalizado
  const h2Re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  const allH2 = [];
  let m;
  while ((m = h2Re.exec(html)) !== null) {
    allH2.push({
      index: m.index,
      end: m.index + m[0].length,
      text: htmlToText(m[1]),
      norm: normalizeForMatch(htmlToText(m[1])),
    });
  }
  if (allH2.length === 0) return '';

  // Buscar match priorizando por orden de keyword y por especificidad
  // (preferimos H2 cuyo texto sea más LARGO — sugiere título de sección formal).
  let bestMatch = null;
  for (const kw of keywords) {
    const kwNorm = normalizeForMatch(kw);
    // Candidatos: H2 que contienen el keyword
    const candidates = allH2.filter((h) => h.norm.includes(kwNorm));
    if (candidates.length === 0) continue;
    // De los candidatos, preferir el de texto MÁS LARGO (más específico)
    // ej: "Contenido del Máster en Rehabilitación..." > "Crece con nuestros programas"
    candidates.sort((a, b) => b.text.length - a.text.length);
    bestMatch = candidates[0];
    break;  // el primer keyword que matchea gana (orden en config = prioridad)
  }

  if (!bestMatch) return '';

  const start = bestMatch.end;
  const rest = html.slice(start);

  // Cortes posibles. Ignoramos los muy cercanos (< 200 chars) para no
  // matar el slice si la sección empieza con un H3/widget interno.
  const MIN_DISTANCE = 200;
  const cuts = [
    rest.search(/<h2\b/i),
    rest.search(/<footer\b/i),
    rest.search(/<[^>]+class="[^"]*(?:site-footer|elementor-location-footer)[^"]*"/i),
  ].filter((i) => i >= MIN_DISTANCE);
  const end = cuts.length ? Math.min(...cuts) : Math.min(rest.length, 80000);
  return rest.slice(0, end);
}

/** Extrae title H1 del HTML (primer h1 no vacío). */
function extractH1(html) {
  const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return m ? htmlToText(m[1]).slice(0, 300) : null;
}

/**
 * Extrae el "meta box" buscando múltiples patrones:
 *   1. Elementor icon-box-content (title + description)
 *   2. H4/H5 con label seguido del valor en siguiente nodo
 *   3. Texto plano "Label: valor" en widgets de texto
 *
 * Devuelve un objeto con cada label normalizado y su valor parseado:
 *   { duracion: { text:"12 meses", value:12, unit:"meses", type:"duration" }, ... }
 */
function extractMetaBox(html) {
  const LABEL_MAP = {
    duracion: 'duracion',
    horas: 'horas',
    'fecha de inicio': 'fecha_inicio',
    'fecha inicio': 'fecha_inicio',
    'fecha de comienzo': 'fecha_inicio',
    inicio: 'fecha_inicio',
    modulos: 'num_modulos',
    'numero de modulos': 'num_modulos',
    modalidad: 'modalidad',
    precio: 'precio',
    idioma: 'idioma',
    titulacion: 'titulacion',
    'titulo obtenido': 'titulacion',
    creditos: 'creditos',
    'creditos ects': 'creditos',
  };
  const found = {};

  // Patrón 1: Elementor icon-box (Psiko)
  const blockRe = /<div\b[^>]*class="[^"]*elementor-icon-box-content[^"]*"[^>]*>([\s\S]{0,4000}?)<\/div>/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const block = m[1];
    const titleM = /<(?:h\d|span|div)\b[^>]*class="[^"]*elementor-icon-box-title[^"]*"[^>]*>([\s\S]*?)<\/(?:h\d|span|div)>/i.exec(block);
    const descM = /<(?:p|div|span)\b[^>]*class="[^"]*elementor-icon-box-description[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/i.exec(block);
    if (titleM && descM) {
      const label = normalizeForMatch(htmlToText(titleM[1]));
      const value = htmlToText(descM[1]);
      if (LABEL_MAP[label] && value && !found[LABEL_MAP[label]]) {
        found[LABEL_MAP[label]] = parseMetaValue(label, value);
      }
    }
  }

  // Patrón 2: H4/H5 label seguido inmediatamente de un párrafo o div (Fono)
  // Esto detecta estructuras alternativas a Elementor icon-box
  const h4Re = /<h([45])\b[^>]*>([\s\S]*?)<\/h\1>\s*(<(?:p|div|span)[^>]*>[\s\S]{1,150}?<\/(?:p|div|span)>)?/gi;
  while ((m = h4Re.exec(html)) !== null) {
    const labelText = normalizeForMatch(htmlToText(m[2]));
    const valueRaw = m[3] ? htmlToText(m[3]) : '';
    const key = LABEL_MAP[labelText];
    if (key && valueRaw && !found[key] && valueRaw.length < 100) {
      found[key] = parseMetaValue(labelText, valueRaw);
    }
  }

  // Patrón 3: "Label: valor" en cualquier párrafo del HTML
  const labelColonRe = new RegExp(
    `<(?:p|li|span)[^>]*>\\s*<(?:strong|b)>?\\s*([A-Za-zÁÉÍÓÚñÑáéíóú\\s]+?)\\s*:?\\s*</?(?:strong|b)?>?\\s*([^<]{1,80})\\s*</(?:p|li|span)>`,
    'gi'
  );
  while ((m = labelColonRe.exec(html)) !== null) {
    const labelText = normalizeForMatch(m[1]);
    const key = LABEL_MAP[labelText];
    if (key && m[2].trim() && !found[key]) {
      found[key] = parseMetaValue(labelText, m[2].trim());
    }
  }

  return found;
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
 * Scrapea una URL pública y devuelve un objeto estructurado.
 *
 * @param {string} url - permalink del producto/curso
 * @param {object} sectionKeywords - { presentacion: ['presentaci'], modulos: [...], ... }
 * @param {object} opts - { strategy: 'plain_text' | 'preserve_html', timeoutMs: 30000 }
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
      // Limitar a 50KB para no reventar el campo TEXT
      result.sections[crmField] = value.slice(0, 50000);
    }
  }

  return result;
}

export { htmlToText, sliceSectionByKeywords, extractMetaBox, extractH1, parseMetaValue };
