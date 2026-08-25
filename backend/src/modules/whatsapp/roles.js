/**
 * Quien puede tener WhatsApp, en UN sitio.
 *
 * Antes esto vivia dentro de una consulta SQL —dos veces, una por cada rama del
 * selector— escrito como `role IN ('superadmin','admin','gestor','soporte')`.
 * Tenia dos problemas:
 *
 *   · Para que un rol nuevo pudiera tener WhatsApp habia que editar SQL, y en
 *     dos sitios. El que se olvidara uno daba comportamientos distintos segun
 *     quien mirara.
 *   · Los que no estaban en la lista **no aparecian**, sin decir por que. Hoy
 *     eso deja fuera a los tutores. No es que no puedan enlazar: es que no
 *     salen, que es la peor forma de negar algo — parece un fallo.
 *
 * Es la tarea #68.
 */

/**
 * Los roles que llevan WhatsApp.
 *
 * TUTOR NO ESTA, y es a proposito: un tutor da clase, no atiende prospectos, y
 * enlazar su numero personal a un CRM no le aporta nada. Pero esto es una
 * decision de negocio y no tecnica — si manana se decide lo contrario, se
 * cambia AQUI y funciona en todas partes.
 */
export const ROLES_CON_WHATSAPP = ['superadmin', 'admin', 'gestor', 'soporte'];

/** Por que NO puede tener WhatsApp. null si si puede. */
export function porQueNoPuede(usuario) {
  if (!usuario) return 'No se encontro a esta persona.';
  if (!usuario.active) return 'Esta persona esta dada de baja.';
  // Quien lleva colaboraciones no es una gestora de prospectos aunque tenga ese
  // rol: no se le reparte trabajo y tampoco le corresponde una sesion.
  if (usuario.gestor_colaboraciones) return 'Lleva colaboraciones, no prospectos.';
  if (!ROLES_CON_WHATSAPP.includes(usuario.role)) {
    return usuario.role === 'tutor'
      ? 'Los tutores no usan WhatsApp del CRM: dan clase, no atienden prospectos.'
      : `El rol «${usuario.role}» no tiene WhatsApp.`;
  }
  return null;
}

/** Lo contrario, para leerlo mejor donde toca. */
export const puedeTenerWhatsapp = (usuario) => porQueNoPuede(usuario) === null;
