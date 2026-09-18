import { query } from '../../shared/config/db.js';

/**
 * Las plantillas de un paso, rellenas con lo que el CRM sabe de la persona (#88).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SE COPIAN, NO SE ENVÍAN
 *
 * El documento comercial es explícito: «natural antes que literal; la plantilla
 * marca el orden, las palabras las pones tú». Si el CRM las mandara solas, los
 * diez mensajes del día saldrían idénticos y la plantilla dejaría de funcionar
 * —que es lo que le pasa a todo el mundo que automatiza esto—. Por eso aquí no
 * hay ningún envío: se devuelve el texto listo para copiar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ SE RELLENA Y QUÉ NO
 *
 * Se rellena lo que el CRM TIENE: el nombre, la formación, la marca, la
 * gestora. Lo que va [entre corchetes] se queda: son los datos que el CRM no
 * tiene —el importe del plan de pagos, las plazas que quedan— y ponerlos a ojo
 * sería mandarle al cliente una cifra inventada. La migración 151 ya lo dejó
 * dicho y aquí se respeta.
 *
 * LAS PLAZAS NO SE CUENTAN, tampoco aquí. Las lleva admisiones. El paso marca
 * `avisa_plazas` y la pantalla recuerda ir a mirarlas antes de cada envío.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE RELLENA EN EL SERVIDOR Y NO EN EL NAVEGADOR
 *
 * En el chat de WhatsApp se rellena en el navegador (`whatsapp/lib/plantilla.ts`)
 * porque allí el texto se sigue editando en vivo antes de mandarlo. Aquí el
 * texto solo se copia, así que se entrega hecho: una pantalla que copia no
 * tiene por qué saber qué es un hueco.
 */

/**
 * Los dos idiomas de hueco que hay en la casa.
 *
 * WhatsApp usa UNA llave —`{nombre}`— y el correo DOS —`{{lead.nombre}}`—.
 * Es historia, no diseño: las de WhatsApp nacieron en el localStorage del
 * navegador y las de correo pasan por `renderTemplate`. Aquí se aceptan las
 * dos, porque el mismo paso tiene plantillas de los dos tipos y la gestora no
 * tiene por qué saber cuál es cuál.
 *
 * NO se pasa por `renderTemplate`: ese escapa HTML siempre y convertiría
 * «Máster & Diplomado» en «Máster &amp; Diplomado» dentro del mensaje. Lo avisa
 * la propia migración 122.
 */
export function rellenar(texto, datos) {
  if (!texto) return '';
  const uno = {
    nombre: datos.nombre || '',
    nombrecompleto: datos.nombreCompleto || datos.nombre || '',
    producto: datos.producto || 'nuestros programas',
    proyecto: datos.proyecto || '',
    email: datos.email || '',
    telefono: datos.telefono || '',
    // Los de SU formacion. Si el catalogo no los tiene, NO se quedan en blanco:
    // vuelve el corchete, que es la senal de «esto lo escribes tu». Un
    // «Duracion:  » en el mensaje pasa desapercibido; un «[nº meses]» no.
    inicio: datos.inicio || '[fecha de inicio]',
    duracion: datos.duracion || '[nº meses]',
    horas: horasSueltas(datos.horas) || '[nº]',
    inversion: datos.inversion || '[importe]',
    cierre: datos.cierre || '[fecha]',
  };
  const dos = {
    'lead.nombre': uno.nombre,
    'lead.producto': uno.producto,
    'project.nombre': uno.proyecto,
    'user.nombre': datos.gestora || '',
  };
  return texto
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (entero, clave) => (clave in dos ? dos[clave] : entero))
    // Después de las dobles, para no partir `{{x}}` por la mitad.
    .replace(/\{([\p{L}\d_]+)\}/gu, (entero, clave) => {
      const v = uno[clave.toLowerCase()];
      return v === undefined ? entero : v;
    });
}

/**
 * Las horas, sin la palabra «horas» detras.
 *
 * El catalogo las guarda como texto libre y en produccion vienen escritas
 * «750 horas». La plantilla ya dice «{horas} horas lectivas», asi que tal cual
 * salia «750 horas horas lectivas». Se recorta el sufijo y se respeta lo que
 * haya escrito si no es uno de esos: mejor raro que inventado.
 */
export function horasSueltas(v) {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const corto = t.replace(/\s*(horas?|hrs?|h)\.?$/i, '').trim();
  return corto || t;
}

/** Lo que hace falta saber de la persona para rellenar. */
async function datosDelLead(leadId) {
  const { rows } = await query(
    `SELECT l.id, l.project_id, l.nombre, l.email, l.telefono,
            pj.nombre AS proyecto,
            u.nombre  AS gestora,
            p.nombre  AS producto,
            -- Los datos de la formacion que el catalogo SI tiene. Las PLAZAS
            -- no estan y no es un olvido: las lleva admisiones, y un numero
            -- nuestro que no cuadre con el suyo acaba dentro de un mensaje ya
            -- enviado. El paso avisa de ir a mirarlas.
            p.fecha_inicio_texto, p.duracion, p.horas, p.precio, p.moneda,
            to_char(p.fecha_cierre_convocatoria, 'YYYY-MM-DD') AS cierre
       FROM leads l
       LEFT JOIN projects pj ON pj.id = l.project_id
       LEFT JOIN users u     ON u.id = l.responsable_id
       LEFT JOIN products p  ON p.id = l.producto_interes_id
      WHERE l.id = $1 AND l.deleted_at IS NULL`,
    [leadId]
  );
  if (!rows[0]) return null;
  const l = rows[0];
  // El nombre de pila, que es como se saluda. El completo se guarda aparte por
  // si alguna plantilla lo pide.
  const completo = (l.nombre || '').trim();
  return {
    ...l,
    nombreCompleto: completo,
    nombre: completo.split(/\s+/)[0] || '',
    inicio: l.fecha_inicio_texto,
    inversion: dinero(l.precio, l.moneda),
    cierre: comoFecha(l.cierre),
  };
}

/** El importe, como se escribe en un mensaje. Sin precio no se inventa nada. */
function dinero(precio, moneda) {
  if (precio == null || Number.isNaN(Number(precio))) return null;
  return Number(precio).toLocaleString('es-ES', {
    style: 'currency', currency: moneda || 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
}

/**
 * Una fecha de la base, dicha como en un mensaje.
 *
 * Se parte el texto a mano: `new Date('2026-03-12')` se interpreta en UTC y en
 * Espana se escribiria el 11. Ya paso en la pantalla del corte de facturacion.
 */
function comoFecha(v) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m) return String(v);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]}`;
}

/**
 * Las plantillas del paso `clave` para el prospecto `leadId`, ya rellenas.
 *
 * Devuelve `null` si el prospecto no existe: no es lo mismo que un paso sin
 * plantillas, y la pantalla dice cosas distintas en cada caso.
 */
export async function plantillasDelPaso(leadId, clave) {
  const datos = await datosDelLead(leadId);
  if (!datos) return null;

  const [wa, correo] = await Promise.all([
    query(
      `SELECT id, label, body, pide_adjunto, pista, orden
         FROM whatsapp_templates
        WHERE project_id = $1 AND paso_clave = $2 AND active
          -- Las personales de otra gestora no salen: son suyas.
          AND ambito = 'compartida'
        ORDER BY orden, id`,
      [datos.project_id, clave]
    ),
    query(
      `SELECT id, name, subject, body_html
         FROM email_templates
        WHERE project_id = $1 AND paso_clave = $2 AND active
        ORDER BY id`,
      [datos.project_id, clave]
    ),
  ]);

  return {
    whatsapp: wa.rows.map((t) => ({
      id: t.id,
      label: t.label,
      texto: rellenar(t.body, datos),
      pide_adjunto: t.pide_adjunto,
      pista: t.pista,
    })),
    email: correo.rows.map((t) => ({
      id: t.id,
      label: t.name,
      asunto: rellenar(t.subject, datos),
      texto: rellenar(t.body_html, datos),
    })),
  };
}
