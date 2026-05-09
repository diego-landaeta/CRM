import * as model from './connectors.model.js';
import * as adapters from './connectors.adapters.js';
import { query } from '../../shared/config/db.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/utils/AppError.js';

// Aplica field_mapping a un item descargado del API externa.
// Devuelve un objeto plano con los campos del CRM listos para insertar.
function applyMapping(item, mapping) {
  const out = {};
  for (const [crmField, sourcePath] of Object.entries(mapping || {})) {
    if (!sourcePath) continue;
    const v = adapters.resolvePath(item, sourcePath);
    if (v !== undefined && v !== null && v !== '') out[crmField] = v;
  }
  return out;
}

// Inserta o actualiza un producto en CRM con datos del conector
async function upsertProduct(projectId, mapped, originalItem) {
  if (!mapped.nombre) return { skipped: true };
  // Idempotencia: si trae sku o external_id, intentar por ahí
  const sku = mapped.sku || null;
  const externalId = mapped.external_id || originalItem.id || null;
  let existing = null;
  if (sku) {
    const r = await query(`SELECT id FROM products WHERE project_id = $1 AND sku = $2 LIMIT 1`, [projectId, sku]);
    existing = r.rows[0];
  }
  if (!existing && externalId) {
    const r = await query(`SELECT id FROM products WHERE project_id = $1 AND wc_product_id = $2 LIMIT 1`, [projectId, externalId]);
    existing = r.rows[0];
  }

  const fields = {
    nombre: mapped.nombre,
    descripcion: mapped.descripcion || null,
    precio: mapped.precio !== undefined ? parseFloat(mapped.precio) || null : null,
    moneda: mapped.moneda || null,
    sku: sku,
    duracion: mapped.duracion || null,
    url_info: mapped.url_info || null,
    image_url: mapped.image_url || null,
    wc_product_id: externalId,
    wc_meta: JSON.stringify({ ...originalItem, _connector: true }),
  };

  if (existing) {
    await query(
      `UPDATE products SET nombre=$1, descripcion=$2, precio=$3, moneda=$4, sku=$5, duracion=$6, url_info=$7, image_url=COALESCE($8, image_url), wc_meta=$9, updated_at=NOW() WHERE id=$10`,
      [fields.nombre, fields.descripcion, fields.precio, fields.moneda, fields.sku, fields.duracion, fields.url_info, fields.image_url, fields.wc_meta, existing.id]
    );
    return { action: 'updated', id: existing.id };
  }

  const ins = await query(
    `INSERT INTO products (project_id, nombre, descripcion, precio, moneda, sku, duracion, url_info, image_url, wc_product_id, wc_meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [projectId, fields.nombre, fields.descripcion, fields.precio, fields.moneda, fields.sku, fields.duracion, fields.url_info, fields.image_url, fields.wc_product_id, fields.wc_meta]
  );
  return { action: 'created', id: ins.rows[0].id };
}

// Inserta módulos del producto si el mapping incluye `_modules` (array)
async function upsertModules(productId, mappedModules) {
  if (!Array.isArray(mappedModules) || !mappedModules.length) return 0;
  await query(`DELETE FROM product_modules WHERE product_id = $1`, [productId]);
  for (let i = 0; i < mappedModules.length; i++) {
    const m = mappedModules[i];
    const titulo = m?.titulo || m?.title || m?.nombre || `Módulo ${i + 1}`;
    const descripcion = m?.descripcion || m?.description || m?.contenido || null;
    const horas = m?.horas || m?.hours || null;
    await query(
      `INSERT INTO product_modules (product_id, titulo, descripcion, horas, orden)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, titulo, descripcion, horas ? parseInt(horas) : null, i]
    );
  }
  return mappedModules.length;
}

export async function previewConnector(connectorId) {
  const c = await model.findById(connectorId);
  if (!c) throw new AppError('Conector no encontrado', 404, 'NOT_FOUND');
  const { items, total } = await adapters.fetchSample(c);
  await model.saveSample(connectorId, items[0] || {});
  return {
    type: c.type,
    items_count_total: total,
    samples: items,
    field_mapping_actual: c.field_mapping,
    sugeridos: detectFieldsFromSample(items[0] || {}),
  };
}

// Sugiere mapping inicial a partir de un item de muestra (heurística simple)
function detectFieldsFromSample(item) {
  if (!item || typeof item !== 'object') return {};
  const sug = {};
  for (const [k, v] of Object.entries(item)) {
    const key = k.toLowerCase();
    if (sug.nombre === undefined && (key === 'name' || key === 'title' || key === 'nombre')) sug.nombre = k;
    else if (sug.email === undefined && (key === 'email' || key.includes('mail'))) sug.email = k;
    else if (sug.telefono === undefined && (key === 'phone' || key === 'telefono' || key.includes('tel'))) sug.telefono = k;
    else if (sug.precio === undefined && (key === 'price' || key === 'precio' || key === 'amount')) sug.precio = k;
    else if (sug.sku === undefined && (key === 'sku' || key === 'code' || key === 'codigo')) sug.sku = k;
    else if (sug.descripcion === undefined && (key === 'description' || key === 'descripcion' || key === 'short_description')) sug.descripcion = k;
    else if (sug.url_info === undefined && (key === 'permalink' || key === 'url' || key === 'link')) sug.url_info = k;
  }
  return sug;
}

export async function importFromConnector(connectorId) {
  const c = await model.findById(connectorId);
  if (!c) throw new AppError('Conector no encontrado', 404, 'NOT_FOUND');
  if (!c.field_mapping || Object.keys(c.field_mapping).length === 0) {
    throw new AppError('Conector sin field_mapping configurado', 400, 'NO_MAPPING');
  }
  if (c.destination !== 'product') {
    throw new AppError(`Destination '${c.destination}' aún no soportada en import`, 501, 'NOT_IMPLEMENTED');
  }

  let created = 0, updated = 0, skipped = 0, errors = 0;
  try {
    const items = await adapters.fetchAll(c);
    logger.info({ connectorId, items: items.length }, 'Connector: items descargados');

    for (const item of items) {
      try {
        const mapped = applyMapping(item, c.field_mapping);
        const result = await upsertProduct(c.project_id, mapped, item);
        if (result.action === 'created') created++;
        else if (result.action === 'updated') updated++;
        else if (result.skipped) skipped++;
        // Si el mapping incluye campo `_modules` (path al array de módulos), insertarlos
        if (c.field_mapping._modules && result.id) {
          const modulesArray = adapters.resolvePath(item, c.field_mapping._modules);
          if (Array.isArray(modulesArray)) await upsertModules(result.id, modulesArray);
        }
      } catch (err) {
        errors++;
        logger.warn({ err: err.message, connectorId }, 'Connector: error en item');
      }
    }
    await model.recordSync(connectorId, errors === 0 ? 'success' : 'partial', items.length);
    return { total: items.length, created, updated, skipped, errors };
  } catch (err) {
    await model.recordSync(connectorId, 'error', 0);
    throw err;
  }
}
