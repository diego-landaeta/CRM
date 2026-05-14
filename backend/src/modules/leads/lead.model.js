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
  // Solo considera leads NO eliminados como duplicados normales.
  // Los eliminados por spam los detectamos aparte (findSpamMatch).
  const { rows } = await query(
    `SELECT id, nombre, email, status, producto_interes_id, responsable_id, created_at, fecha_solicitud
     FROM leads
     WHERE email = $1 AND project_id = $2 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [email, projectId]
  );
  return rows[0] || null;
}

// Busca cualquier lead CONVERTIDO previo de este email en el proyecto.
// Sirve para detectar cross-sell: cliente que ya compró y ahora pregunta otro programa.
export async function findConvertedByEmail(email, projectId) {
  if (!email) return null;
  const { rows } = await query(
    `SELECT id, nombre, producto_interes_id
     FROM leads
     WHERE email = $1 AND project_id = $2 AND status = 'convertido' AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [email, projectId]
  );
  return rows[0] || null;
}

// Devuelve todas las conversiones de un email en el proyecto (historial de compra).
export async function findPurchaseHistory(email, projectId) {
  if (!email) return [];
  const { rows } = await query(
    `SELECT c.id, c.producto_contratado, c.importe_total, c.importe_pagado,
            c.metodo_pago, c.fecha_compra, c.created_at, c.lead_id
     FROM conversions c
     JOIN leads l ON l.id = c.lead_id
     WHERE l.email = $1 AND l.project_id = $2 AND l.deleted_at IS NULL
     ORDER BY c.fecha_compra DESC NULLS LAST, c.created_at DESC`,
    [email, projectId]
  );
  return rows;
}

// Devuelve true si este email ya fue marcado como SPAM en este proyecto.
// Si lo es, el webhook crea el nuevo lead pero lo deja ya marcado como spam
// (no avanza round-robin, no notifica, ya queda fuera de listas).
export async function findSpamMatch(email, projectId) {
  if (!email) return null;
  const { rows } = await query(
    `SELECT id, deleted_at, deleted_motivo
     FROM leads
     WHERE email = $1 AND project_id = $2
       AND deleted_at IS NOT NULL AND deleted_reason = 'spam'
     ORDER BY deleted_at DESC LIMIT 1`,
    [email, projectId]
  );
  return rows[0] || null;
}

// Soft delete (superadmin). No purga: deja en DB para auditoria.
export async function softDeleteLead(leadId, { reason, motivo, userId }) {
  const { rows } = await query(
    `UPDATE leads
     SET deleted_at = NOW(),
         deleted_reason = $1,
         deleted_motivo = $2,
         deleted_by = $3,
         updated_at = NOW()
     WHERE id = $4 AND deleted_at IS NULL
     RETURNING id, project_id, email, deleted_reason`,
    [reason, motivo || null, userId, leadId]
  );
  return rows[0] || null;
}

export async function restoreLead(leadId) {
  const { rows } = await query(
    `UPDATE leads
     SET deleted_at = NULL, deleted_reason = NULL, deleted_motivo = NULL, deleted_by = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [leadId]
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

// Si forcedResponsableId viene, valida que el user tenga acceso al proyecto
// y está disponible; si todo OK, salta el round-robin y le asigna directo.
// Si no viene, ejecuta round-robin tradicional.
export async function createLeadWithRoundRobin({ projectId, nombre, email, telefono, productoInteresId, notas, landingUrl, duplicadoDe, reincidente = false, esPropuesto = false, propuestoDe = null, utms, customFields, forcedResponsableId = null, skipRoundRobin = false, advanceRoundRobinAnyway = false, idempotencyKey = null }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Round-robin: lock queue state. Si no existe, lo creamos en este
    // mismo lock (no perdemos asignación al primer lead del proyecto).
    let queueRows;
    {
      const r = await client.query(
        `SELECT id, last_assigned_index FROM project_queue_state WHERE project_id = $1 FOR UPDATE`,
        [projectId]
      );
      queueRows = r.rows;
      if (queueRows.length === 0) {
        const ins = await client.query(
          `INSERT INTO project_queue_state (project_id, last_assigned_index)
           VALUES ($1, -1) RETURNING id, last_assigned_index`,
          [projectId]
        );
        queueRows = ins.rows;
      }
    }

    // Obtener gestores activos del proyecto.
    // Filtros: usuario activo + rol admin/gestor + disponible (is_available)
    //          + sin bloque de ausencia activo para hoy.
    const { rows: gestorRows } = await client.query(
      `SELECT up.user_id FROM user_projects up
       JOIN users u ON u.id = up.user_id
        AND u.active = true
        AND u.is_available = true
        AND u.role IN ('admin', 'gestor')
       WHERE up.project_id = $1 AND up.active = true
         AND NOT EXISTS (
           SELECT 1 FROM user_availability_blocks ab
           WHERE ab.user_id = u.id
             AND CURRENT_DATE BETWEEN ab.fecha_inicio AND ab.fecha_fin
         )
       ORDER BY up.orden_cola`,
      [projectId]
    );

    let responsableId = null;
    let assignmentSource = 'round_robin';

    // Asignación forzada (Make ya decidió quién lo recibe).
    // Validamos que el user tenga acceso ACTIVO al proyecto. No exigimos
    // disponibilidad porque Make decidió a propósito y a veces se quiere
    // asignar a alguien aunque esté de baja (queda en su cola pendiente).
    if (forcedResponsableId) {
      const { rows: access } = await client.query(
        `SELECT u.id FROM users u
         JOIN user_projects up ON up.user_id = u.id AND up.project_id = $1 AND up.active = true
         WHERE u.id = $2 AND u.active = true AND u.role IN ('admin', 'gestor', 'superadmin')`,
        [projectId, forcedResponsableId]
      );
      if (access.length > 0) {
        responsableId = access[0].id;
        assignmentSource = 'webhook';
      }
      // Si no tiene acceso, caemos a round-robin (no fallar el webhook).
    }

    if (!responsableId && !skipRoundRobin && gestorRows.length > 0) {
      const gestores = gestorRows.map(r => r.user_id);
      const lastIndex = queueRows[0].last_assigned_index;
      const nextIndex = (lastIndex + 1) % gestores.length;
      responsableId = gestores[nextIndex];

      await client.query(
        `UPDATE project_queue_state SET last_assigned_index = $1, last_assigned_user_id = $2, updated_at = NOW() WHERE project_id = $3`,
        [nextIndex, responsableId, projectId]
      );
    } else if (advanceRoundRobinAnyway && gestorRows.length > 0) {
      // Lead manual creado por gestor: se queda con quien lo creó (forcedResponsableId)
      // pero avanzamos la cola igual para que el siguiente lead automatico no le toque otra vez.
      const gestores = gestorRows.map(r => r.user_id);
      const lastIndex = queueRows[0].last_assigned_index;
      const nextIndex = (lastIndex + 1) % gestores.length;
      await client.query(
        `UPDATE project_queue_state SET last_assigned_index = $1, last_assigned_user_id = $2, updated_at = NOW() WHERE project_id = $3`,
        [nextIndex, gestores[nextIndex], projectId]
      );
    }

    // Crear lead
    const { rows: leadRows } = await client.query(
      `INSERT INTO leads (project_id, nombre, email, telefono, producto_interes_id, responsable_id, notas, landing_url, lead_duplicado_de, reincidente, es_propuesto, propuesto_de, custom_fields, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, project_id, nombre, email, telefono, status, responsable_id, lead_duplicado_de, reincidente, es_propuesto, propuesto_de, fecha_solicitud, created_at`,
      [projectId, nombre, email, telefono, productoInteresId, responsableId, notas, landingUrl, duplicadoDe, reincidente, esPropuesto, propuestoDe,
       customFields ? JSON.stringify(customFields) : '{}', idempotencyKey]
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
    return { ...lead, responsableId, assignmentSource };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Buscar user por email (case-insensitive). Devuelve null si no existe.
export async function findUserByEmail(email) {
  if (!email) return null;
  const { rows } = await query(
    `SELECT id, email, nombre, role, active FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

// Idempotency: si Make reintenta con el mismo idempotency_key dentro de 24h,
// devolvemos el lead que ya creamos en lugar de duplicar.
export async function findLeadByIdempotencyKey(projectId, key) {
  if (!key) return null;
  const { rows } = await query(
    `SELECT id, responsable_id FROM leads
     WHERE project_id = $1 AND idempotency_key = $2 AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [projectId, key]
  );
  return rows[0] || null;
}

// ============================================================
// LISTADO + DETALLE
// ============================================================

// Calcula el ORDER BY segun la preferencia del usuario.
// - 'value':    precio DESC, fecha DESC (default historico)
// - 'recent':   fecha DESC (mas nuevos arriba, independiente del valor)
// - 'urgency':  score combinado: vencidos primero, luego valor*frescura
//   La frescura decae exponencialmente: leads de hoy valen 1, de hace 7 dias ~0.5
function buildOrderBy(sort) {
  if (sort === 'recent') {
    return `COALESCE(l.fecha_solicitud, l.created_at) DESC`;
  }
  if (sort === 'urgency') {
    // Score: precio * exp(-edad_dias / 7). Asi un lead de 100 hoy supera a uno
    // de 300 de hace 14 dias. Tambien empuja los que tienen recordatorio vencido.
    return `
      (CASE WHEN EXISTS (SELECT 1 FROM lead_reminders r WHERE r.lead_id = l.id AND r.completado = false AND r.fecha_recordatorio < CURRENT_DATE) THEN 1 ELSE 0 END) DESC,
      (COALESCE(prod.precio, 0) * EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(l.fecha_solicitud, l.created_at))) / 604800)) DESC NULLS LAST,
      COALESCE(l.fecha_solicitud, l.created_at) DESC
    `;
  }
  // default 'value'
  return `COALESCE(prod.precio, 0) DESC NULLS LAST, COALESCE(l.fecha_solicitud, l.created_at) DESC`;
}

export async function findAll({ projectId, projectIds, status, responsableId, unassigned, canal, productId, search, page, limit, includeConverted, dateFrom, dateTo, sort }) {
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  // Vista multi-proyecto: si llega projectIds (array) filtra por IN, sino por projectId único
  if (Array.isArray(projectIds) && projectIds.length > 0) {
    conditions.push(`l.project_id = ANY($${paramIdx++}::int[])`);
    params.push(projectIds);
  } else if (projectId) {
    conditions.push(`l.project_id = $${paramIdx++}`);
    params.push(projectId);
  } else {
    // Sin filtro de proyecto no devolvemos nada (seguridad)
    return { leads: [], total: 0, page, limit, totalPages: 0 };
  }

  // Excluir leads eliminados (soft delete)
  conditions.push(`l.deleted_at IS NULL`);

  if (status) {
    conditions.push(`l.status = $${paramIdx++}`);
    params.push(status);
  } else if (!includeConverted) {
    conditions.push(`l.status <> 'convertido'`);
  }
  if (unassigned) {
    conditions.push(`l.responsable_id IS NULL`);
  } else if (responsableId) {
    conditions.push(`l.responsable_id = $${paramIdx++}`);
    params.push(responsableId);
  }
  if (canal) {
    conditions.push(`EXISTS (SELECT 1 FROM lead_utms lu WHERE lu.lead_id = l.id AND lu.canal_detectado = $${paramIdx++})`);
    params.push(canal);
  }
  if (productId) {
    conditions.push(`l.producto_interes_id = $${paramIdx++}`);
    params.push(productId);
  }
  if (search) {
    conditions.push(`(l.nombre ILIKE $${paramIdx} OR l.email ILIKE $${paramIdx} OR l.telefono ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  // Filtro por rango de fechas (sobre fecha_solicitud, fallback created_at)
  if (dateFrom) {
    conditions.push(`COALESCE(l.fecha_solicitud, l.created_at) >= $${paramIdx++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    // dateTo inclusivo: hasta el final del día
    conditions.push(`COALESCE(l.fecha_solicitud, l.created_at) < ($${paramIdx++}::date + INTERVAL '1 day')`);
    params.push(dateTo);
  }

  const where = 'WHERE ' + conditions.join(' AND ');
  const offset = (page - 1) * limit;

  const countResult = await query(`SELECT COUNT(*) FROM leads l ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await query(
    `SELECT l.id, l.nombre, l.email, l.telefono, l.status, l.fecha_solicitud, l.dossier_enviado, l.lead_duplicado_de,
            l.reincidente, l.es_propuesto, l.propuesto_de, l.updated_at, l.created_at,
            l.landing_url,
            l.project_id,
            proj.nombre AS proyecto_nombre,
            proj.slug AS proyecto_slug,
            u.nombre as responsable_nombre,
            lu.canal_detectado, lu.utm_source, lu.utm_campaign,
            prod.nombre as producto_interes,
            l.producto_interes_id,
            prod.precio as producto_precio,
            prod.moneda as producto_moneda,
            (SELECT MAX(fecha) FROM lead_interactions WHERE lead_id = l.id) AS last_interaction_at,
            (SELECT MIN(fecha_recordatorio) FROM lead_reminders WHERE lead_id = l.id AND completado = false) AS next_reminder_at,
            p.dias_alerta_inactividad,
            EXTRACT(DAY FROM NOW() - GREATEST(l.updated_at, COALESCE((SELECT MAX(fecha) FROM lead_interactions WHERE lead_id = l.id), l.created_at)))::int AS dias_inactivo
     FROM leads l
     LEFT JOIN users u ON u.id = l.responsable_id
     LEFT JOIN lead_utms lu ON lu.lead_id = l.id
     LEFT JOIN projects p ON p.id = l.project_id
     LEFT JOIN projects proj ON proj.id = l.project_id
     LEFT JOIN products prod ON prod.id = l.producto_interes_id
     ${where}
     ORDER BY ${buildOrderBy(sort)}
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

export async function createInteraction(leadId, tipo, nota, createdBy, fecha) {
  const { rows } = await query(
    `INSERT INTO lead_interactions (lead_id, tipo, nota, created_by, fecha)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))
     RETURNING id, lead_id, tipo, nota, fecha, created_by`,
    [leadId, tipo, nota, createdBy, fecha || null]
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

// Re-aplica round-robin a los leads con responsable_id IS NULL del proyecto.
// Avanza el cursor (last_assigned_index) y devuelve resumen.
export async function reassignPendingRoundRobin(projectId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: gestores } = await client.query(
      `SELECT up.user_id FROM user_projects up
       JOIN users u ON u.id = up.user_id
        AND u.active = true
        AND u.is_available = true
        AND u.role IN ('admin', 'gestor')
       WHERE up.project_id = $1 AND up.active = true
         AND NOT EXISTS (
           SELECT 1 FROM user_availability_blocks ab
           WHERE ab.user_id = u.id
             AND CURRENT_DATE BETWEEN ab.fecha_inicio AND ab.fecha_fin
         )
       ORDER BY up.orden_cola`,
      [projectId]
    );

    if (gestores.length === 0) {
      await client.query('ROLLBACK');
      return { reassigned: 0, total_pending: 0, reason: 'NO_ACTIVE_GESTORES' };
    }
    const gestorIds = gestores.map((g) => g.user_id);

    const { rows: pending } = await client.query(
      `SELECT id FROM leads
       WHERE project_id = $1 AND responsable_id IS NULL
       ORDER BY created_at ASC`,
      [projectId]
    );

    if (pending.length === 0) {
      await client.query('ROLLBACK');
      return { reassigned: 0, total_pending: 0 };
    }

    const { rows: queueRows } = await client.query(
      `SELECT id, last_assigned_index FROM project_queue_state WHERE project_id = $1 FOR UPDATE`,
      [projectId]
    );

    let cursor = queueRows.length > 0 ? queueRows[0].last_assigned_index : -1;
    let lastUserId = null;

    for (const lead of pending) {
      cursor = (cursor + 1) % gestorIds.length;
      const userId = gestorIds[cursor];
      lastUserId = userId;
      await client.query(
        `UPDATE leads SET responsable_id = $1, updated_at = NOW() WHERE id = $2`,
        [userId, lead.id]
      );
    }

    if (queueRows.length > 0) {
      await client.query(
        `UPDATE project_queue_state SET last_assigned_index = $1, last_assigned_user_id = $2, updated_at = NOW() WHERE project_id = $3`,
        [cursor, lastUserId, projectId]
      );
    } else {
      await client.query(
        `INSERT INTO project_queue_state (project_id, last_assigned_index, last_assigned_user_id) VALUES ($1, $2, $3)`,
        [projectId, cursor, lastUserId]
      );
    }

    await client.query('COMMIT');
    return { reassigned: pending.length, total_pending: pending.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateLead(id, fields) {
  const sets = [];
  const params = [];
  let idx = 1;

  const allowed = ['nombre', 'telefono', 'notas', 'producto_interes_id', 'custom_fields'];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${key} = $${idx++}`);
      params.push(key === 'custom_fields' ? JSON.stringify(fields[key]) : fields[key]);
    }
  }

  if (sets.length === 0) return null;

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const { rows } = await query(
    `UPDATE leads SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, nombre, email, telefono, notas, producto_interes_id, custom_fields, status, responsable_id, updated_at`,
    params
  );
  return rows[0] || null;
}

export async function getLeadProjectId(leadId) {
  const { rows } = await query(`SELECT project_id FROM leads WHERE id = $1`, [leadId]);
  return rows[0]?.project_id || null;
}

// ============================================================
// DASHBOARD STATS
// ============================================================

// Panel "Hoy" - actividad del dia, reminders pendientes, alertas
export async function getTodaySummary({ userId, role, projectId }) {
  // Usamos parametros para evitar SQL injection
  const userIdParam = role === 'gestor' ? userId : null;
  const pidParam = projectId || null;

  const { rows: remRows } = await query(
    `SELECT lr.id, lr.lead_id, lr.fecha_recordatorio, lr.nota,
            l.nombre as lead_nombre, l.email as lead_email, l.status as lead_status,
            CASE WHEN lr.fecha_recordatorio < CURRENT_DATE THEN true ELSE false END as vencido
     FROM lead_reminders lr
     JOIN leads l ON l.id = lr.lead_id
     WHERE lr.completado = false
       AND lr.fecha_recordatorio <= CURRENT_DATE
       AND ($1::int IS NULL OR lr.created_by = $1)
       AND ($2::int IS NULL OR l.project_id = $2)
     ORDER BY lr.fecha_recordatorio ASC, lr.id DESC
     LIMIT 20`,
    [userIdParam, pidParam]
  );

  const { rows: nuevosHoy } = await query(
    `SELECT COUNT(*) FROM leads l
     WHERE l.fecha_solicitud::date = CURRENT_DATE
       AND ($1::int IS NULL OR l.responsable_id = $1)
       AND ($2::int IS NULL OR l.project_id = $2)`,
    [userIdParam, pidParam]
  );

  const { rows: nuevosSemana } = await query(
    `SELECT COUNT(*) FROM leads l
     WHERE l.fecha_solicitud >= CURRENT_DATE - INTERVAL '7 days'
       AND ($1::int IS NULL OR l.responsable_id = $1)
       AND ($2::int IS NULL OR l.project_id = $2)`,
    [userIdParam, pidParam]
  );

  const { rows: inactivos } = await query(
    `SELECT COUNT(*)
     FROM leads l
     LEFT JOIN projects p ON p.id = l.project_id
     WHERE l.status NOT IN ('convertido', 'no_interesado')
       AND EXTRACT(DAY FROM NOW() - GREATEST(l.updated_at, COALESCE((SELECT MAX(fecha) FROM lead_interactions WHERE lead_id = l.id), l.created_at))) > p.dias_alerta_inactividad
       AND ($1::int IS NULL OR l.responsable_id = $1)
       AND ($2::int IS NULL OR l.project_id = $2)`,
    [userIdParam, pidParam]
  );

  const { rows: cobrosVencidos } = await query(
    `SELECT COUNT(*)
     FROM conversions c
     LEFT JOIN leads l ON l.id = c.lead_id
     WHERE c.importe_pagado < c.importe_total
       AND c.fecha_compromiso_pago IS NOT NULL
       AND c.fecha_compromiso_pago < CURRENT_DATE
       AND ($1::int IS NULL OR l.responsable_id = $1)
       AND ($2::int IS NULL OR c.project_id = $2)`,
    [userIdParam, pidParam]
  );

  const { rows: ingresosHoy } = await query(
    `SELECT COALESCE(SUM(cp.importe), 0) as total
     FROM conversion_payments cp
     JOIN conversions c ON c.id = cp.conversion_id
     LEFT JOIN leads l ON l.id = c.lead_id
     WHERE cp.fecha = CURRENT_DATE
       AND ($1::int IS NULL OR l.responsable_id = $1)
       AND ($2::int IS NULL OR c.project_id = $2)`,
    [userIdParam, pidParam]
  );

  return {
    reminders_pendientes: remRows,
    nuevos_hoy: parseInt(nuevosHoy[0].count),
    nuevos_semana: parseInt(nuevosSemana[0].count),
    inactivos: parseInt(inactivos[0].count),
    cobros_vencidos: parseInt(cobrosVencidos[0].count),
    ingresos_hoy: Number(ingresosHoy[0].total),
  };
}

export async function getStats(projectId) {
  const { rows } = await query(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'nuevo') as nuevos,
       COUNT(*) FILTER (WHERE status = 'por_contactar') as por_contactar,
       COUNT(*) FILTER (WHERE status = 'contactado') as contactados,
       COUNT(*) FILTER (WHERE status = 'en_seguimiento') as en_seguimiento,
       COUNT(*) FILTER (WHERE status = 'convertido') as convertidos,
       COUNT(*) FILTER (WHERE status = 'no_interesado') as no_interesados,
       COUNT(*) FILTER (WHERE responsable_id IS NULL AND status NOT IN ('convertido','no_interesado')) as sin_asignar
     FROM leads WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  return rows[0];
}
