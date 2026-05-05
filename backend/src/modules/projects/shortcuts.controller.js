import { z } from 'zod';
import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';

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
