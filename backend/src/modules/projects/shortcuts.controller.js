import { z } from 'zod';
import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';

// GET /api/projects/:id/queue-state — orden round-robin de gestores + siguiente
export async function getQueueState(req, res, next) {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) throw new AppError('ID invalido', 400, 'INVALID_ID');

    const { rows: gestores } = await query(
      `SELECT u.id, u.nombre, u.email, u.avatar_url, up.orden_cola, u.active
       FROM user_projects up
       JOIN users u ON u.id = up.user_id
       WHERE up.project_id = $1 AND up.active = true
         AND u.active = true
         AND u.role IN ('admin', 'gestor')
       ORDER BY up.orden_cola, u.id`,
      [projectId]
    );

    const { rows: state } = await query(
      `SELECT last_assigned_index, last_assigned_user_id, updated_at
       FROM project_queue_state WHERE project_id = $1`,
      [projectId]
    );

    const lastIndex = state[0]?.last_assigned_index ?? -1;
    const nextIndex = gestores.length > 0 ? (lastIndex + 1) % gestores.length : null;
    const nextGestor = nextIndex !== null ? gestores[nextIndex] : null;
    const lastGestor = state[0]?.last_assigned_user_id
      ? gestores.find(g => g.id === state[0].last_assigned_user_id) || null
      : null;

    res.json({
      success: true,
      data: {
        gestores,
        last_assigned_at: state[0]?.updated_at || null,
        last_gestor: lastGestor,
        next_gestor: nextGestor,
      },
    });
  } catch (err) { next(err); }
}

// Catálogo fijo de atajos disponibles. El admin elige cuáles activar y en qué orden.
export const SHORTCUTS_CATALOG = [
  { id: 'new_lead',     label: 'Nuevo prospecto', icon: 'UserPlus',     route: '/leads?new=1' },
  { id: 'new_client',   label: 'Nuevo cliente',   icon: 'Building',     route: '/clientes?new=1' },
  { id: 'new_product',  label: 'Nuevo producto',  icon: 'Package',      route: '/products?new=1' },
  { id: 'new_form',     label: 'Nuevo formulario', icon: 'FileText',    route: '/formularios?new=1' },
  { id: 'new_webhook',  label: 'Nuevo webhook',   icon: 'Webhook',      route: '/webhooks?new=1' },
  { id: 'send_email',   label: 'Enviar email',    icon: 'Envelope',     action: 'open_email_dialog' },
  { id: 'reminder',     label: 'Crear recordatorio', icon: 'Bell',      action: 'open_reminder_dialog' },
  { id: 'note',         label: 'Nueva nota',      icon: 'NotePencil',   action: 'open_note_dialog' },
  { id: 'sync_wc',      label: 'Sincronizar WC',  icon: 'ArrowsClockwise', action: 'sync_woocommerce' },
  { id: 'reports',      label: 'Ver reportes',    icon: 'ChartBar',     route: '/reports' },
];

const shortcutsBodySchema = z.object({
  shortcuts: z.array(z.object({
    id:     z.string().min(1),
    label:  z.string().min(1).optional(),
    icon:   z.string().optional(),
    route:  z.string().optional(),
    action: z.string().optional(),
  })),
});

// GET /api/projects/shortcuts/catalog (todos los autenticados)
export async function getCatalog(req, res) {
  res.json({ success: true, data: SHORTCUTS_CATALOG });
}

// PUT /api/projects/:id/shortcuts (admin/superadmin)
export async function saveShortcuts(req, res, next) {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) throw new AppError('ID invalido', 400, 'INVALID_ID');

    const parsed = shortcutsBodySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');

    // Validar que cada id existe en el catálogo
    const validIds = new Set(SHORTCUTS_CATALOG.map(s => s.id));
    const cleaned = parsed.data.shortcuts.filter(s => validIds.has(s.id));

    const { rows } = await query(
      `UPDATE projects SET shortcuts = $1, updated_at = NOW() WHERE id = $2 RETURNING id, shortcuts`,
      [JSON.stringify(cleaned), projectId]
    );
    if (!rows[0]) throw new AppError('Proyecto no encontrado', 404, 'NOT_FOUND');

    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}
