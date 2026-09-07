import { z } from 'zod';
import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import { gestoresDelReparto, aQuienLeToca } from '../leads/reparto.js';

// GET /api/projects/:id/queue-state — orden round-robin de gestores + siguiente
export async function getQueueState(req, res, next) {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) throw new AppError('ID invalido', 400, 'INVALID_ID');

    // La lista sale de `reparto.js`, la misma que usa el alta. Aqui habia una
    // consulta propia que no miraba `is_available`, ni las ausencias de hoy, ni
    // lo de las colaboraciones: la pantalla podia decir «el proximo es Laura»
    // con Laura de vacaciones y el lead caerle a otra. Es peor que no tener
    // pantalla, porque el equipo se organiza con lo que lee.
    const gestores = await gestoresDelReparto(query, projectId);

    const { rows: state } = await query(
      `SELECT last_assigned_index, last_assigned_user_id, updated_at
       FROM project_queue_state WHERE project_id = $1`,
      [projectId]
    );

    const lastIndex = state[0]?.last_assigned_index ?? -1;
    const { gestor: nextGestor } = aQuienLeToca(gestores, lastIndex);

    // A quien le toco el ultimo puede no estar ya en la lista —se fue de
    // vacaciones despues de recibirlo, o dejo el proyecto—. Se dice quien fue
    // igual: es historia, no una prediccion, y borrarla porque hoy no esta
    // deja un hueco que parece un fallo.
    const ultimoId = state[0]?.last_assigned_user_id || null;
    let lastGestor = ultimoId ? gestores.find((g) => g.id === ultimoId) || null : null;
    if (ultimoId && !lastGestor) {
      const { rows } = await query(
        `SELECT id, nombre, email, avatar_url FROM users WHERE id = $1`, [ultimoId]
      );
      lastGestor = rows[0] ? { ...rows[0], fuera_del_reparto: true } : null;
    }

    // Cuantos prospectos estan sin dueño ahora mismo. Va aqui para que el boton
    // de repartirlos pueda decir cuantos son: un boton que no dice sobre que
    // actua se pulsa a ciegas, y despues «0 reasignados» no distingue entre «no
    // habia ninguno» y «algo fallo».
    const { rows: sueltos } = await query(
      `SELECT COUNT(*)::int AS n FROM leads
        WHERE project_id = $1 AND responsable_id IS NULL AND deleted_at IS NULL`,
      [projectId]
    );

    res.json({
      success: true,
      data: {
        gestores,
        last_assigned_at: state[0]?.updated_at || null,
        last_gestor: lastGestor,
        next_gestor: nextGestor,
        sin_responsable: sueltos[0]?.n || 0,
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

// CRM-147: cada shortcut puede ahora opcionalmente restringirse a uno o mas
// roles. `roles` vacio o ausente = visible para todos los roles.
const ROLE_VALUES = ['superadmin', 'admin', 'gestor', 'soporte'];

const shortcutsBodySchema = z.object({
  shortcuts: z.array(z.object({
    id:     z.string().min(1),
    label:  z.string().min(1).optional(),
    icon:   z.string().optional(),
    route:  z.string().optional(),
    action: z.string().optional(),
    roles:  z.array(z.enum(ROLE_VALUES)).optional(),
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
