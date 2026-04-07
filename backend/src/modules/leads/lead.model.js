import { query, getClient } from '../../shared/config/db.js';

// ============================================================
// WEBHOOK + ROUND-ROBIN
// ============================================================

export async function findProjectBySlug(slug) {
  const { rows } = await query(
    `SELECT id, nombre, slug, webhook_api_key FROM projects WHERE slug = $1 AND active = true`,
    [slug]
  );
  return rows[0] || null;
}

export async function findDuplicateByEmail(email, projectId) {
  const { rows } = await query(
    `SELECT id, nombre, email, status FROM leads WHERE email = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [email, projectId]
  );
  return rows[0] || null;
}

export async function findProductByName(name, projectId) {
  const { rows } = await query(
    `SELECT id FROM products WHERE nombre ILIKE $1 AND project_id = $2 AND active = true LIMIT 1`,
    [name, projectId]
  );
  return rows[0] || null;
}

export async function createLeadWithRoundRobin({ projectId, nombre, email, telefono, productoInteresId, notas, landingUrl, duplicadoDe, utms }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Round-robin: lock queue state
    const { rows: queueRows } = await client.query(
      `SELECT id, last_assigned_index FROM project_queue_state WHERE project_id = $1 FOR UPDATE`,
      [projectId]
    );

    // Obtener gestores activos del proyecto
    const { rows: gestorRows } = await client.query(
      `SELECT up.user_id FROM user_projects up
       JOIN users u ON u.id = up.user_id AND u.active = true AND u.role IN ('admin', 'gestor')
       WHERE up.project_id = $1 AND up.active = true
       ORDER BY up.orden_cola`,
      [projectId]
    );

    let responsableId = null;
    if (queueRows.length > 0 && gestorRows.length > 0) {
      const gestores = gestorRows.map(r => r.user_id);
      const lastIndex = queueRows[0].last_assigned_index;
      const nextIndex = (lastIndex + 1) % gestores.length;
      responsableId = gestores[nextIndex];

      await client.query(
        `UPDATE project_queue_state SET last_assigned_index = $1, last_assigned_user_id = $2, updated_at = NOW() WHERE project_id = $3`,
        [nextIndex, responsableId, projectId]
      );
    }

    // Crear lead
    const { rows: leadRows } = await client.query(
      `INSERT INTO leads (project_id, nombre, email, telefono, producto_interes_id, responsable_id, notas, landing_url, lead_duplicado_de)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, project_id, nombre, email, telefono, status, responsable_id, lead_duplicado_de, fecha_solicitud, created_at`,
      [projectId, nombre, email, telefono, productoInteresId, responsableId, notas, landingUrl, duplicadoDe]
    );
    const lead = leadRows[0];

    // Guardar UTMs si hay
    if (utms && (utms.utm_source || utms.utm_medium || utms.utm_campaign)) {
      await client.query(
        `INSERT INTO lead_utms (lead_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_url, canal_detectado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [lead.id, utms.utm_source, utms.utm_medium, utms.utm_campaign, utms.utm_content, utms.utm_term, utms.landing_url, utms.canal_detectado]
      );
    }

    await client.query('COMMIT');
    return { ...lead, responsableId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// LISTADO + DETALLE
// ============================================================

export async function findAll({ projectId, status, responsableId, canal, search, page, limit }) {
  const conditions = ['l.project_id = $1'];
  const params = [projectId];
  let paramIdx = 2;

  if (status) { conditions.push(`l.status = $${paramIdx++}`); params.push(status); }
  if (responsableId) { conditions.push(`l.responsable_id = $${paramIdx++}`); params.push(responsableId); }
  if (canal) {
    conditions.push(`EXISTS (SELECT 1 FROM lead_utms lu WHERE lu.lead_id = l.id AND lu.canal_detectado = $${paramIdx++})`);
    params.push(canal);
  }
  if (search) {
    conditions.push(`(l.nombre ILIKE $${paramIdx} OR l.email ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const offset = (page - 1) * limit;

  const countResult = await query(`SELECT COUNT(*) FROM leads l ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await query(
    `SELECT l.id, l.nombre, l.email, l.telefono, l.status, l.fecha_solicitud, l.dossier_enviado, l.lead_duplicado_de,
            l.created_at,
            u.nombre as responsable_nombre,
            lu.canal_detectado, lu.utm_source, lu.utm_campaign
     FROM leads l
     LEFT JOIN users u ON u.id = l.responsable_id
     LEFT JOIN lead_utms lu ON lu.lead_id = l.id
     ${where}
     ORDER BY l.fecha_solicitud DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { leads: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT l.*,
            u.nombre as responsable_nombre, u.email as responsable_email,
            p.nombre as proyecto_nombre, p.slug as proyecto_slug,
            pr.nombre as producto_nombre
     FROM leads l
     LEFT JOIN users u ON u.id = l.responsable_id
     LEFT JOIN projects p ON p.id = l.project_id
     LEFT JOIN products pr ON pr.id = l.producto_interes_id
     WHERE l.id = $1`,
    [id]
  );
  if (!rows[0]) return null;

  const lead = rows[0];

  // UTMs
  const { rows: utmRows } = await query(`SELECT * FROM lead_utms WHERE lead_id = $1`, [id]);
  lead.utms = utmRows[0] || null;

  // Status history
  const { rows: historyRows } = await query(
    `SELECT lsh.*, u.nombre as changed_by_nombre
     FROM lead_status_history lsh
     LEFT JOIN users u ON u.id = lsh.changed_by
     WHERE lsh.lead_id = $1 ORDER BY lsh.changed_at DESC`,
    [id]
  );
  lead.statusHistory = historyRows;

  // Interactions
  const { rows: interactionRows } = await query(
    `SELECT li.*, u.nombre as created_by_nombre
     FROM lead_interactions li
     LEFT JOIN users u ON u.id = li.created_by
     WHERE li.lead_id = $1 ORDER BY li.fecha DESC`,
    [id]
  );
  lead.interactions = interactionRows;

  // Reminders
  const { rows: reminderRows } = await query(
    `SELECT lr.*, u.nombre as created_by_nombre
     FROM lead_reminders lr
     LEFT JOIN users u ON u.id = lr.created_by
     WHERE lr.lead_id = $1 ORDER BY lr.fecha_recordatorio ASC`,
    [id]
  );
  lead.reminders = reminderRows;

  return lead;
}

// ============================================================
// OPERACIONES
// ============================================================

export async function updateStatus(leadId, statusNuevo, statusAnterior, changedBy) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2`, [statusNuevo, leadId]);
    await client.query(
      `INSERT INTO lead_status_history (lead_id, status_anterior, status_nuevo, changed_by) VALUES ($1, $2, $3, $4)`,
      [leadId, statusAnterior, statusNuevo, changedBy]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function createInteraction(leadId, tipo, nota, createdBy) {
  const { rows } = await query(
    `INSERT INTO lead_interactions (lead_id, tipo, nota, created_by) VALUES ($1, $2, $3, $4)
     RETURNING id, lead_id, tipo, nota, fecha, created_by`,
    [leadId, tipo, nota, createdBy]
  );
  return rows[0];
}

export async function createReminder(leadId, fechaRecordatorio, nota, createdBy) {
  const { rows } = await query(
    `INSERT INTO lead_reminders (lead_id, fecha_recordatorio, nota, created_by) VALUES ($1, $2, $3, $4)
     RETURNING id, lead_id, fecha_recordatorio, nota, completado, created_by`,
    [leadId, fechaRecordatorio, nota, createdBy]
  );
  return rows[0];
}

export async function completeReminder(reminderId) {
  await query(`UPDATE lead_reminders SET completado = true WHERE id = $1`, [reminderId]);
}

export async function reassignLead(leadId, newResponsableId) {
  await query(`UPDATE leads SET responsable_id = $1, updated_at = NOW() WHERE id = $2`, [newResponsableId, leadId]);
}

export async function getLeadProjectId(leadId) {
  const { rows } = await query(`SELECT project_id FROM leads WHERE id = $1`, [leadId]);
  return rows[0]?.project_id || null;
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function getStats(projectId) {
  const { rows } = await query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'nuevo') as nuevos,
       COUNT(*) FILTER (WHERE status = 'por_contactar') as por_contactar,
       COUNT(*) FILTER (WHERE status = 'contactado') as contactados,
       COUNT(*) FILTER (WHERE status = 'en_seguimiento') as en_seguimiento,
       COUNT(*) FILTER (WHERE status = 'convertido') as convertidos,
       COUNT(*) FILTER (WHERE status = 'no_interesado') as no_interesados
     FROM leads WHERE project_id = $1`,
    [projectId]
  );
  return rows[0];
}
