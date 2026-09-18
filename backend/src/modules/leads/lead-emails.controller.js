import { z } from 'zod';
import { query } from '../../shared/config/db.js';
import { sendEmail } from '../../shared/services/brevo.service.js';
import { AppError } from '../../shared/utils/AppError.js';
import { adjuntosDelDiaUno, losTresDelDiaUno } from './adjuntosDelDiaUno.js';

const sendEmailSchema = z.object({
  subject:   z.string().min(1).max(500),
  body_html: z.string().min(1).max(50000),
  body_text: z.string().max(50000).optional(),
  /**
   * De qué paso del proceso es este correo (#91).
   *
   * Solo importa `paso_1`: es el que lleva los tres adjuntos obligatorios. Se
   * manda desde la pantalla, no se adivina aquí — un correo suelto a un
   * prospecto que ya va por el día 4 no tiene por qué llevarlos.
   */
  paso: z.string().max(40).optional(),
});

// POST /api/leads/:id/send-email
export async function sendLeadEmail(req, res, next) {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId) || leadId <= 0) throw new AppError('ID invalido', 400, 'INVALID_ID');
    if (!req.user?.userId) throw new AppError('Auth inválida', 401, 'AUTH_REQUIRED');

    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');

    const { rows } = await query(
      `SELECT l.id, l.email, l.nombre, l.project_id, p.nombre AS project_nombre
       FROM leads l JOIN projects p ON p.id = l.project_id
       WHERE l.id = $1`,
      [leadId]
    );
    if (!rows[0]) throw new AppError('Lead no encontrado', 404, 'NOT_FOUND');
    const lead = rows[0];
    if (!lead.email) throw new AppError('El lead no tiene email', 400, 'NO_EMAIL');

    const { subject, body_html, body_text, paso } = parsed.data;

    /**
     * LOS TRES ADJUNTOS DEL DÍA 1, O NO SALE (#91).
     *
     * El documento comercial no lo deja a interpretación: «sin los tres, el
     * correo no sale». Van el dossier de su formación, la guía del campus y
     * las homologaciones.
     *
     * Se comprueba ANTES de llamar a Brevo: un correo a medias ya salió y no
     * se puede recoger. Y se dice QUÉ falta, porque «faltan adjuntos» obliga a
     * ir a buscarlo a mano.
     */
    let adjuntos;
    if (paso === 'paso_1') {
      const { listos, faltan } = await adjuntosDelDiaUno(leadId);
      if (faltan.length) {
        throw new AppError(
          `Este correo va con tres documentos y falta${faltan.length > 1 ? 'n' : ''} `
          + `${faltan.join(', ')}. Sin los tres no sale.`,
          400, 'FALTAN_ADJUNTOS'
        );
      }
      adjuntos = listos;
    }

    const result = await sendEmail({
      to: { email: lead.email, name: lead.nombre },
      subject,
      htmlContent: body_html,
      textContent: body_text,
      tags: ['manual', `project-${lead.project_id}`],
      projectId: lead.project_id,
      attachment: adjuntos,
    });

    if (!result.sent) {
      throw new AppError(`No se pudo enviar el email: ${result.reason}`, 502, 'EMAIL_NOT_SENT');
    }

    await query(
      `INSERT INTO lead_emails (lead_id, user_id, subject, body_html, brevo_msg_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [leadId, req.user.userId, subject, body_html, result.messageId || null]
    );

    res.json({ success: true, data: { sent: true, messageId: result.messageId } });
  } catch (err) { next(err); }
}

// GET /api/leads/:id/emails
export async function listLeadEmails(req, res, next) {
  try {
    const leadId = parseInt(req.params.id);
    if (isNaN(leadId)) throw new AppError('ID invalido', 400, 'INVALID_ID');

    const { rows } = await query(
      `SELECT le.id, le.subject, le.brevo_msg_id, le.sent_at,
              u.nombre AS sent_by_nombre, u.email AS sent_by_email
       FROM lead_emails le
       LEFT JOIN users u ON u.id = le.user_id
       WHERE le.lead_id = $1
       ORDER BY le.sent_at DESC`,
      [leadId]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

/**
 * GET /api/leads/:id/adjuntos-dia-uno
 *
 * Que documentos van con el correo del dia 1 y cuales faltan, ANTES de
 * escribirlo. Sin esto la gestora escribe el correo entero y se entera al
 * pulsar enviar, que es la peor forma de enterarse.
 */
export async function estadoDeLosAdjuntos(req, res, next) {
  try {
    const leadId = parseInt(req.params.id, 10);
    if (Number.isNaN(leadId) || leadId <= 0) throw new AppError('ID invalido', 400, 'INVALID_ID');

    const { piezas } = await losTresDelDiaUno(leadId);
    res.json({
      success: true,
      data: {
        completo: piezas.every((p) => p.key),
        // Que hay y que no, uno a uno: enseñar solo lo que falta obliga a
        // adivinar si lo demas esta o es que no se ha mirado.
        piezas: piezas.map((p) => ({ tipo: p.tipo, como: p.comoSeLlama, esta: Boolean(p.key) })),
      },
    });
  } catch (err) { next(err); }
}
