// Importa SOLICITUDES - Contactos.csv → ICTESS (project_id=4) en crm_prod_db.
// - Respeta Origen: WhatsApp → whatsapp, Web → organico, vacio → directo
// - Mapea Tecnico: Antonio → Tony (id 9), Samantha → id 8
// - Etapa "Venta" → status convertido + conversion con precio+abono+fecha
// - Idempotency por email/telefono
import fs from 'fs';
import pg from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = process.argv[2] || '/tmp/ictess.csv';
const PROJECT_ID = 4;

const pool = new pg.Pool({
  host: 'localhost', port: 5432, user: 'crm_user',
  password: 'CrmDB2026!Secure', database: 'crm_prod_db',
});
const query = (text, params) => pool.query(text, params);

function parseCsv(text) {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inQ) { if (c === '"' && n === '"') { cell += '"'; i++; } else if (c === '"') inQ = false; else cell += c; }
    else { if (c === '"') inQ = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c === '\r') {} else cell += c; }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function normEmail(s) {
  const t = (s || '').trim().toLowerCase();
  if (!t || /no\s*suministrad/i.test(t) || !t.includes('@')) return null;
  return t;
}
function normPhone(s) {
  const d = String(s || '').replace(/[^\d]/g, '');
  return d.length >= 7 ? d.replace(/^0+/, '') : null;
}

// DD/MM/YYYY o YYYY-MM-DD → Date
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const d = new Date(s); if (!isNaN(d)) return d; }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) { const d = new Date(+m[3], +m[2]-1, +m[1]); if (!isNaN(d)) return d; }
  return null;
}

// Parse "1.294,00 €" → 1294.00, "319,00 €" → 319.00, "1,985 €" → 1985
function parsePrice(s) {
  if (!s) return null;
  const m = String(s).match(/[\d.,]+/);
  if (!m) return null;
  const numStr = m[0];
  const hasDot = numStr.includes('.'), hasComma = numStr.includes(',');
  if (hasDot && hasComma) {
    const lastDot = numStr.lastIndexOf('.'), lastComma = numStr.lastIndexOf(',');
    return parseFloat(lastDot > lastComma ? numStr.replace(/,/g, '') : numStr.replace(/\./g, '').replace(',', '.'));
  }
  if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = numStr.split(sep);
    if (parts.length === 2 && parts[1].length === 3) return parseFloat(numStr.replace(sep, ''));
    if (parts.length === 2 && parts[1].length === 2) return parseFloat(numStr.replace(',', '.'));
    if (parts.length > 2) return parseFloat(numStr.split(sep).join(''));
    return parseFloat(numStr.replace(',', '.'));
  }
  return parseFloat(numStr);
}

const ETAPA_TO_STATUS = {
  'Venta': 'convertido',
  'No interesado/otro': 'no_interesado',
  'No interesado': 'no_interesado',
  'Por contactar': 'por_contactar',
  'Interesadx': 'contactado',
  'En Proceso': 'en_seguimiento',
  'CETLAT': 'en_seguimiento',
};

function mapOrigen(raw) {
  const o = (raw || '').trim().toLowerCase();
  if (o === 'whatsapp') return 'whatsapp';
  if (o === 'web') return 'organico';
  if (o === 'facebook' || o === 'instagram') return 'meta_ads';
  return 'directo';
}

function cleanAsesora(raw) {
  const s = (raw || '').trim();
  if (!s || s === '-') return null;
  return s.split(/\s+/)[0];
}

// Lookups
const productCache = new Map();
const userCache = new Map();

async function findUserByName(name) {
  if (!name) return null;
  if (userCache.has(name)) return userCache.get(name);
  // Antonio → Tony / Samantha → Samantha Ictess
  const aliases = { antonio: 'tony', samantha: 'samantha ictess' };
  const search = (aliases[name.toLowerCase()] || name).toLowerCase();
  const { rows } = await query(
    `SELECT id, nombre FROM users WHERE LOWER(nombre) LIKE $1 ORDER BY id LIMIT 1`,
    [`${search.split(' ')[0]}%`]
  );
  const id = rows[0]?.id || null;
  userCache.set(name, id);
  return id;
}

async function findProductFuzzy(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (productCache.has(key)) return productCache.get(key);
  // 1) exact ILIKE
  let { rows } = await query(
    `SELECT id, nombre FROM products WHERE project_id = $1 AND active AND nombre ILIKE $2 LIMIT 1`,
    [PROJECT_ID, key]
  );
  if (!rows[0]) {
    // 2) unaccent + ILIKE
    try {
      ({ rows } = await query(
        `SELECT id, nombre FROM products WHERE project_id = $1 AND active
           AND LOWER(unaccent(nombre)) = LOWER(unaccent($2)) LIMIT 1`,
        [PROJECT_ID, key]
      ));
    } catch {}
  }
  if (!rows[0]) {
    // 3) substring sin prefijo
    const stripped = key.replace(/^(curso|master|m[aá]ster|diplomado|seminario)\s+(en|de|sobre)?\s*/i, '').trim();
    if (stripped) {
      ({ rows } = await query(
        `SELECT id, nombre FROM products WHERE project_id = $1 AND active AND nombre ILIKE $2 LIMIT 1`,
        [PROJECT_ID, `%${stripped}%`]
      ));
    }
  }
  const id = rows[0]?.id || null;
  productCache.set(key, id);
  return id;
}

async function findExistingLead(email, phone) {
  if (email) {
    const { rows } = await query(
      `SELECT id FROM leads WHERE project_id = $1 AND LOWER(email) = $2 AND deleted_at IS NULL LIMIT 1`,
      [PROJECT_ID, email]
    );
    if (rows[0]) return rows[0].id;
  }
  if (phone) {
    const { rows } = await query(
      `SELECT id FROM leads WHERE project_id = $1
         AND telefono IS NOT NULL
         AND regexp_replace(telefono, '[^0-9]', '', 'g') = $2
         AND deleted_at IS NULL LIMIT 1`,
      [PROJECT_ID, phone]
    );
    if (rows[0]) return rows[0].id;
  }
  return null;
}

(async () => {
  const text = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(text);
  console.log(`Filas: ${rows.length - 1}`);

  let created = 0, updated = 0, conversionsCreated = 0, errors = 0;
  let canalCount = { whatsapp: 0, organico: 0, directo: 0, meta_ads: 0 };
  let asesoraMatch = 0, productoMatch = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 11 || !r[0]?.trim()) continue;

    const nombre = r[0].trim();
    const email = normEmail(r[1]);
    const phone = normPhone(r[2]) || normPhone(r[13]);
    if (!email && !phone) continue;

    const facultad = r[4]?.trim();
    const categoria = r[5]?.trim();
    const programa = r[6]?.trim();
    const etapa = r[7]?.trim();
    const tecnico = cleanAsesora(r[8]);
    const notasOrig = r[9]?.trim();
    const origen = r[10]?.trim();
    const pais = r[11]?.trim();
    const fechaSolicRaw = r[12]?.trim();
    const fechaVentaRaw = r[14]?.trim();
    const precioRaw = r[15]?.trim();
    const dtoRaw = r[16]?.trim();
    const abonoRaw = r[17]?.trim();

    const canal = mapOrigen(origen);
    canalCount[canal] = (canalCount[canal] || 0) + 1;

    const status = ETAPA_TO_STATUS[etapa] || 'nuevo';
    const productId = programa ? await findProductFuzzy(programa) : null;
    if (productId) productoMatch++;
    const responsableId = tecnico ? await findUserByName(tecnico) : null;
    if (responsableId) asesoraMatch++;

    const fechaSolic = parseDate(fechaSolicRaw) || new Date();
    const fechaVenta = parseDate(fechaVentaRaw);

    const notasBuild = [];
    if (programa) notasBuild.push(`Programa: ${programa}${etapa ? ` (${etapa})` : ''}`);
    if (facultad) notasBuild.push(`Facultad: ${facultad}`);
    if (categoria) notasBuild.push(`Categoria: ${categoria}`);
    if (notasOrig) notasBuild.push(`Notas: ${notasOrig}`);
    if (fechaVentaRaw) notasBuild.push(`Fecha venta: ${fechaVentaRaw}`);
    if (precioRaw) notasBuild.push(`Precio: ${precioRaw}`);
    if (dtoRaw) notasBuild.push(`DTO: ${dtoRaw}`);
    if (abonoRaw) notasBuild.push(`Abono: ${abonoRaw}`);
    const notasFull = notasBuild.join(' | ');

    const customFields = {
      origen_csv: origen || null,
      pais: pais || null,
      facultad: facultad || null,
      categoria_programa: categoria || null,
      programa_solicitado: programa || null,
      etapa_csv: etapa || null,
      ok_status: r[3]?.trim() || null,
      tecnico_csv: tecnico || null,
      fuente_import: 'solicitudes_ictess_2026',
    };

    if (DRY_RUN) {
      if (i <= 5) console.log(`  [${i}] ${nombre} | ${canal} | etapa=${etapa} status=${status} | prog=${productId} | resp=${responsableId} | precio=${parsePrice(precioRaw)}`);
      continue;
    }

    try {
      const idempKey = `ictess:${email || phone}`;
      const existing = await findExistingLead(email, phone);
      let leadId;

      if (existing) {
        await query(
          `UPDATE leads SET
             nombre = COALESCE(NULLIF(nombre, ''), $2),
             email = COALESCE(NULLIF(email, ''), $3),
             telefono = COALESCE(NULLIF(telefono, ''), $4),
             producto_interes_id = COALESCE(producto_interes_id, $5),
             responsable_id = COALESCE(responsable_id, $6),
             notas = CASE WHEN notas IS NULL OR notas = '' THEN $7 ELSE notas || E'\\n--- Import ICTESS 2026 ---\\n' || $7 END,
             custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $8::jsonb,
             status = CASE WHEN $9 IN ('convertido','no_interesado') THEN $9::lead_status ELSE status END,
             updated_at = NOW()
           WHERE id = $1`,
          [existing, nombre, email, phone, productId, responsableId, notasFull, JSON.stringify(customFields), status]
        );
        leadId = existing;
        updated++;
      } else {
        const insRes = await query(
          `INSERT INTO leads (project_id, nombre, email, telefono, producto_interes_id, status, responsable_id,
                              fecha_solicitud, notas, custom_fields, idempotency_key, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, NOW(), NOW())
           ON CONFLICT (project_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
           RETURNING id`,
          [PROJECT_ID, nombre, email, phone, productId, status, responsableId,
           fechaSolic, notasFull, JSON.stringify(customFields), idempKey]
        );
        if (insRes.rows[0]) { leadId = insRes.rows[0].id; created++; }
      }

      if (!leadId) continue;

      // Insertar utm con canal_detectado correcto
      await query(
        `INSERT INTO lead_utms (lead_id, canal_detectado, created_at)
         VALUES ($1, $2::utm_channel, NOW())
         ON CONFLICT DO NOTHING`,
        [leadId, canal]
      ).catch(() => {});

      // Si es VENTA y hay precio, crear conversion
      if (status === 'convertido' && precioRaw && fechaVenta) {
        const precio = parsePrice(precioRaw);
        const abono = abonoRaw ? (parsePrice(abonoRaw) || 0) : precio;
        if (precio && precio > 0) {
          // Evitar duplicar conversion si ya existe una para este lead+producto
          const exists = await query(
            `SELECT 1 FROM conversions WHERE lead_id = $1 AND fecha_conversion = $2 LIMIT 1`,
            [leadId, fechaVenta]
          );
          if (!exists.rows[0]) {
            await query(
              `INSERT INTO conversions (lead_id, project_id, producto_contratado, producto_contratado_id,
                                         importe_total, importe_pagado, fecha_conversion, metodo_pago, notas_pago,
                                         created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'transferencia'::payment_method, $8, NOW(), NOW())`,
              [leadId, PROJECT_ID, programa || 'Sin nombre', productId, precio, abono, fechaVenta,
               `Importado de CSV ICTESS · DTO: ${dtoRaw || '-'} · Origen: ${origen || '-'}`]
            );
            conversionsCreated++;
          }
        }
      }
    } catch (e) {
      errors++;
      if (errors < 5) console.error(`  err row ${i} (${nombre}): ${e.message}`);
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Creados:           ${created}`);
  console.log(`Actualizados:      ${updated}`);
  console.log(`Conversiones:      ${conversionsCreated}`);
  console.log(`Errores:           ${errors}`);
  console.log(`Producto matched:  ${productoMatch}/${rows.length - 1}`);
  console.log(`Asesora matched:   ${asesoraMatch}/${rows.length - 1}`);
  console.log(`Canales:           whatsapp=${canalCount.whatsapp || 0}, organico=${canalCount.organico || 0}, meta_ads=${canalCount.meta_ads || 0}, directo=${canalCount.directo || 0}`);
  await pool.end();
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
