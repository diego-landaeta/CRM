import { query } from '../../shared/config/db.js';
import { generatePresignedUrl } from '../../shared/utils/presignedUrl.js';
import { AppError } from '../../shared/utils/AppError.js';

/**
 * Los tres adjuntos del correo del día 1 (#91).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA REGLA, TAL CUAL
 *
 * El documento comercial: van el dossier de la formación, la guía del campus y
 * las homologaciones, y **«sin los tres, el correo no sale»**. Eso es una
 * validación, no un recordatorio — que es justo lo que decía el ticket.
 *
 * Hasta ahora ni siquiera se podía intentar: el envío a un prospecto solo
 * aceptaba asunto y cuerpo, así que ese correo lo mandaba cada asesora desde
 * el suyo y nadie sabía qué había salido.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE DÓNDE SALE CADA UNO
 *
 * - El dossier es de la FORMACIÓN que le interesa al prospecto (`dossiers`).
 *   Si el prospecto no tiene formación puesta, no hay dossier que mandar y el
 *   correo no sale: es la misma regla, no una excepción.
 * - La guía del campus y las homologaciones son de la MARCA
 *   (`project_documents`), las mismas para todos sus cursos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR ENLACE, NO EN BASE64
 *
 * Se le pasan a Brevo como `{ url, name }` con enlaces firmados que caducan, en
 * vez de cargar tres PDFs en memoria y mandarlos en base64 por cada correo. El
 * dossier de un máster pasa de 10 MB él solo.
 */

/** Los tres, con su nombre de cara al cliente. */
export async function losTresDelDiaUno(leadId) {
  const { rows } = await query(
    `SELECT l.id, l.project_id, l.producto_interes_id,
            p.nombre AS producto,
            d.s3_key AS dossier_key, d.filename_original AS dossier_nombre
       FROM leads l
       LEFT JOIN products p ON p.id = l.producto_interes_id
       -- El dossier vigente de SU formación. Puede haber varias versiones:
       -- solo una esta activa.
       LEFT JOIN LATERAL (
         SELECT s3_key, filename_original FROM dossiers
          WHERE product_id = l.producto_interes_id AND active
          ORDER BY version DESC LIMIT 1
       ) d ON TRUE
      WHERE l.id = $1 AND l.deleted_at IS NULL`,
    [leadId]
  );
  const lead = rows[0];
  if (!lead) throw new AppError('Ese prospecto no existe', 404, 'NOT_FOUND');

  const { rows: marca } = await query(
    `SELECT tipo, s3_key, filename_original, nombre_visible
       FROM project_documents WHERE project_id = $1 AND active`,
    [lead.project_id]
  );
  const de = (tipo) => marca.find((m) => m.tipo === tipo) || null;

  return {
    lead,
    piezas: [
      {
        tipo: 'dossier',
        comoSeLlama: 'el dossier de la formación',
        key: lead.dossier_key,
        nombre: lead.dossier_nombre,
      },
      {
        tipo: 'guia_campus',
        comoSeLlama: 'la guía del campus',
        key: de('guia_campus')?.s3_key,
        nombre: de('guia_campus')?.nombre_visible || de('guia_campus')?.filename_original,
      },
      {
        tipo: 'homologaciones',
        comoSeLlama: 'las homologaciones',
        key: de('homologaciones')?.s3_key,
        nombre: de('homologaciones')?.nombre_visible || de('homologaciones')?.filename_original,
      },
    ],
  };
}

/**
 * Prepara los adjuntos del día 1, o explica por qué no se puede mandar.
 *
 * Devuelve `{ listos, faltan }`. Quien llama decide: para el correo del día 1
 * la regla es que si falta uno, no sale.
 */
export async function adjuntosDelDiaUno(leadId) {
  const { piezas } = await losTresDelDiaUno(leadId);
  const faltan = piezas.filter((p) => !p.key);
  if (faltan.length) {
    return { listos: null, faltan: faltan.map((p) => p.comoSeLlama) };
  }
  const listos = [];
  for (const p of piezas) {
    listos.push({ url: await generatePresignedUrl(p.key), name: nombreDeArchivo(p) });
  }
  return { listos, faltan: [] };
}

/**
 * El nombre con el que le llega al cliente.
 *
 * Lo que sube el equipo se llama «guia-campus-v3-FINAL.pdf» y eso es lo que
 * vería en su bandeja. Se usa el nombre visible cuando lo hay, y se garantiza
 * la extensión: Brevo no adivina el tipo si el nombre no la lleva.
 */
function nombreDeArchivo(pieza) {
  const base = (pieza.nombre || pieza.comoSeLlama).trim();
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}
