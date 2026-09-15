import { query } from '../../shared/config/db.js';
import { sendEmail } from '../../shared/services/brevo.service.js';
import { renderTemplate } from '../email-templates/email-templates.service.js';
import { comisiones, resumenComisiones } from './tutor.model.js';
import { AppError } from '../../shared/utils/AppError.js';

/**
 * «Avisar tutor»: el correo mensual de comisiones. Diego, 14/09:
 *
 *     «En el apartado de comisiones necesito un apartado que sea "Avisar
 *      tutor", que envie un correo desde facturacion@cediaidsl.com. El punto es
 *      que yo de un clic pueda avisar y cambie el status a "avisado". La
 *      plantilla por definir — es decir que sea editable.»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE DONDE SALE CADA NUMERO
 *
 * De `comisiones()` y `resumenComisiones()`, que son las MISMAS que pinta el
 * panel. Si el correo dijera una cifra y la pantalla otra, no habria forma de
 * saber cual vale — y la que se queda el tutor es la del correo.
 *
 * Se manda lo PENDIENTE del mes, no todo lo generado: es por lo que tiene que
 * facturar. Pedirle factura por algo que ya se le pago es como se hacen las
 * facturas que hay que devolver.
 *
 * LA CUENTA VA DENTRO, Y ESO NO ES ADORNO
 *
 * El documento es tajante: decirle «mandame tu factura +IVA -Retencion» sin
 * darle el numero es justo lo que provoca las facturas mal hechas. Asi que el
 * correo lleva la resta hecha.
 *
 * El redondeo es POR LINEA, no al final: con 17,82 el IVA sale 3,7422 y la
 * retencion 2,673; redondeando al final el total se va un centimo y el tutor
 * factura otra cosa.
 *
 * Y el 15 % es UNA SUPOSICION. Hay profesionales con el 7 % de los primeros
 * años. Por eso el aviso de que cada uno aplica la suya sale siempre, y no como
 * nota al pie escondida.
 */

/** Los dos porcentajes, en un solo sitio. */
export const IVA_PCT = 21;
export const RETENCION_PCT = 15;

/**
 * El remitente. Es una cuenta de Hostinger, y tiene que estar VERIFICADA EN
 * BREVO o los correos no salen — y no salen en silencio, que es lo peor.
 * Configurable para no tener que tocar codigo el dia que cambie.
 */
const REMITENTE = process.env.AVISO_TUTOR_FROM || 'facturacion@cediaidsl.com';
const REMITENTE_NOMBRE = process.env.AVISO_TUTOR_FROM_NAME || 'Facturación CEDIA';

const PLANTILLA = 'Avisar tutor · comisiones del mes';

const eur = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
  .format(Number(v) || 0);

const dosDecimales = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Comision + IVA − retencion, redondeando CADA LINEA. */
export function cuentaAFacturar(comision) {
  const base = dosDecimales(comision);
  const iva = dosDecimales(base * (IVA_PCT / 100));
  const retencion = dosDecimales(base * (RETENCION_PCT / 100));
  return { base, iva, retencion, total: dosDecimales(base + iva - retencion) };
}

/** «2026-08» → «agosto de 2026». */
export function mesEnLetra(periodo) {
  const [a, m] = String(periodo || '').split('-');
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const nombre = nombres[Number(m) - 1];
  return nombre ? `${nombre} de ${a}` : String(periodo || '');
}

/** Lo que va a salir en el correo, sin mandarlo. Es lo que pinta la vista previa. */
export async function datosDelAviso({ tutorId, periodo }) {
  const resumen = (await resumenComisiones({ periodo, tutorId }))
    .find((r) => Number(r.tutor_id) === Number(tutorId));
  if (!resumen) throw new AppError('Ese tutor no tiene comisiones en ese mes.', 404, 'SIN_COMISIONES');
  if (!resumen.tutor_email) {
    throw new AppError(`${resumen.tutor} no tiene correo en su ficha.`, 400, 'SIN_CORREO');
  }

  const pendiente = Number(resumen.pendiente) || 0;
  if (pendiente <= 0) {
    throw new AppError('No hay nada pendiente que reclamar en ese mes.', 400, 'NADA_PENDIENTE');
  }

  // Las formaciones, sin repetir: si cobro tres veces del mismo curso, el tutor
  // no necesita verlo tres veces — necesita saber de que curso viene.
  const lineas = await comisiones({ periodo, tutorId, estado: 'pendiente' });
  const formaciones = [...new Set(lineas.map((l) => l.formacion).filter(Boolean))];

  return {
    tutorId: Number(tutorId),
    nombre: resumen.tutor,
    email: resumen.tutor_email,
    tieneIban: Boolean(resumen.tutor_iban),
    periodo,
    mes: mesEnLetra(periodo),
    pendiente,
    formaciones,
    cuenta: cuentaAFacturar(pendiente),
  };
}

/** El HTML de la cuenta, que es lo que evita las facturas mal hechas. */
export function tablaDeLaCuenta({ base, iva, retencion, total }) {
  const fila = (rotulo, valor, fuerte) =>
    `<tr><td style="padding:4px 12px 4px 0">${rotulo}</td>`
    + `<td style="padding:4px 0;text-align:right;white-space:nowrap">`
    + `${fuerte ? `<strong>${valor}</strong>` : valor}</td></tr>`;
  return `<table style="border-collapse:collapse;margin:8px 0">
    ${fila('Comisión', eur(base))}
    ${fila(`+ IVA ${IVA_PCT} %`, eur(iva))}
    ${fila(`− retención IRPF ${RETENCION_PCT} %`, `− ${eur(retencion)}`)}
    ${fila('Total a facturar', eur(total), true)}
  </table>
  <p style="font-size:12px;color:#666">
    Comisión sujeta a IVA (${IVA_PCT} %). La retención de IRPF es orientativa:
    cada profesional aplica la suya, y el ${RETENCION_PCT} % es la más común.
  </p>`;
}

/** La plantilla comun, la que se edita desde el CRM. */
async function plantilla() {
  const { rows } = await query(
    `SELECT subject, body_html FROM email_templates
      WHERE name = $1 AND active AND project_id IS NULL LIMIT 1`,
    [PLANTILLA],
  );
  if (!rows[0]) {
    throw new AppError(
      `No existe la plantilla «${PLANTILLA}». La crea la migracion 160.`,
      500, 'SIN_PLANTILLA',
    );
  }
  return rows[0];
}

/** Lo que se va a mandar, ya con los huecos rellenos. */
/**
 * Rellena la plantilla con los datos de un tutor. Sin base y sin red: es una
 * funcion, y por eso se puede ver el correo exacto sin mandarlo ni sembrar
 * nada — que es como se revisa un texto que va a salir a un tercero.
 */
export function componerCorreo({ datos, subject, cuerpo }) {
  const ctx = {
    mes: datos.mes,
    total: eur(datos.pendiente),
    tutor: { nombre: datos.nombre, email: datos.email },
  };
  // `formaciones` y `calculo` son HTML a proposito —una lista y una tabla— y por
  // eso NO pasan por `renderTemplate`, que escapa los valores. Bien hecho por su
  // parte: un nombre con `<` no puede romper el correo.
  //
  // Y se ponen ANTES, no despues. Despues no funcionaba: `renderTemplate`
  // sustituye TODO lo que tenga la forma `{{algo}}`, y lo que no encuentra en su
  // contexto lo deja VACIO. Asi que se llevaba por delante los dos huecos y el
  // correo salia pidiendo la factura sin decir de que formaciones ni cuanto.
  // Al ponerlos antes, lo inyectado no lleva llaves y le pasa por delante.
  const conHtml = cuerpo
    .replace('{{formaciones}}', `<ul>${datos.formaciones.map((f) => `<li>${f}</li>`).join('')}</ul>`)
    .replace('{{calculo}}', tablaDeLaCuenta(datos.cuenta));
  return { asunto: renderTemplate(subject, ctx), html: renderTemplate(conHtml, ctx) };
}

export async function previsualizar({ tutorId, periodo }) {
  const datos = await datosDelAviso({ tutorId, periodo });
  const { subject, body_html: cuerpo } = await plantilla();
  return { ...datos, ...componerCorreo({ datos, subject, cuerpo }) };
}

/**
 * Manda el correo y deja anotado cuando y quien.
 *
 * Se puede reenviar: un tutor que no contesta o que perdio el correo necesita
 * que se le vuelva a mandar, y bloquearlo obliga a salirse del CRM para eso. Lo
 * que se guarda es la ULTIMA vez.
 *
 * El aviso NO toca `estado`. Diego lo pidio como «que cambie el status a
 * avisado», pero ese campo dice donde esta el dinero —pendiente, pagada,
 * revertida— y una comision avisada sigue sin pagarse: si entrara ahi,
 * desapareceria de los «Por pagar» y el tutor se quedaria sin cobrar.
 */
export async function avisar({ tutorId, periodo, userId }) {
  const aviso = await previsualizar({ tutorId, periodo });

  // SIN `clave`, y es la decision de poder reenviar: `sendEmail` deduplica por
  // esa clave, asi que pasarla bloquearia el segundo envio del mes. Un tutor que
  // no contesta o que perdio el correo necesita que se le vuelva a mandar.
  const r = await sendEmail({
    to: aviso.email,
    subject: aviso.asunto,
    htmlContent: aviso.html,
    tags: ['aviso-tutor'],
    fromEmail: REMITENTE,
    fromName: REMITENTE_NOMBRE,
    // El correo le pide que CONTESTE con su factura: la respuesta tiene que
    // caer en ese buzon, y no depender de a quien responda Brevo por defecto.
    replyTo: REMITENTE,
  });

  if (!r?.sent) {
    // Cada motivo se dice con sus palabras: «no se pudo enviar» a secas manda a
    // mirar el sitio equivocado, y estos tres se arreglan en sitios distintos.
    const porque = {
      FRENO_DE_PRUEBAS: `Fuera de produccion solo salen correos a la lista blanca, y ${aviso.email} no esta en ella. Se añade en EMAIL_LISTA_BLANCA.`,
      NO_API_KEY: 'No hay clave de Brevo configurada en este entorno.',
      YA_ENVIADO: 'Brevo lo tiene por repetido.',
    }[r?.reason] || r?.motivo || r?.detalle
      || `Brevo no lo acepto desde ${REMITENTE}. Lo primero que hay que mirar es si ese remitente esta verificado alli: sin verificar, no sale y no avisa.`;
    throw new AppError(porque, 502, r?.reason || 'NO_ENVIADO');
  }

  // Queda «notificada», que es lo que pidio Diego, y ademas se anota CUANDO.
  //
  // Puede hacerse porque `notificada` sigue contando como que se le debe —lo
  // que se debe es lo que no esta pagada ni revertida—, asi que avisar a un
  // tutor ya no lo saca de «Por pagar». Antes de la 163 habria sido justo eso.
  //
  // El estado dice POR DONDE VA; `avisado_at`, CUANDO fue. No sobra ninguno: si
  // alguien lo mueve a «falta factura» a mano, la fecha del aviso se conserva.
  await query(
    `UPDATE tutor_commissions
        SET estado = 'notificada', avisado_at = NOW(), avisado_por = $3
      WHERE tutor_id = $1 AND periodo = $2 AND estado NOT IN ('pagada', 'revertida')`,
    [tutorId, periodo, userId || null],
  );

  return { enviado: true, a: aviso.email, total: aviso.cuenta.total };
}
