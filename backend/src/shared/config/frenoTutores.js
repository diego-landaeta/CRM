/**
 * El freno de mano de los correos a tutores.
 *
 * Diego, 15/09/2026, con Vanessa dando de alta a una tutora y el correo de
 * Brevo llegando con un enlace roto: «quita esa opcion, que nadie reciba nada
 * aun / NO SE PUEDE ENVIAR LOS CORREOS A TUTORES NI NADA DE ESO».
 *
 * Vive aqui y no en cada modulo porque hay TRES caminos distintos al buzon de
 * un tutor, y el dia que se levante hay que levantarlo una vez:
 *
 *   1. darle de alta                 users/user.service.js
 *   2. cambiarle el correo           users/user.service.js
 *   3. «Avisar tutor», el mensual    tutores/avisarTutor.js
 *
 * Los dos primeros se cortaron el 15/09. El tercero llego ese mismo dia en la
 * rama de Angel, ya escrito: sin este fichero habria entrado en testeo mandando
 * correos, que es justo lo que se acababa de prohibir.
 *
 * Para levantarlo: poner `false` AQUI, en los dos CRM. Antes hay que arreglar
 * el enlace de contrasena de Brevo, que sigue roto.
 */
//
// El código para cambiar el correo (#211) NO pasa por el freno, a propósito: lo
// pide el propio tutor (o un superadmin) y va a la dirección NUEVA. Sin él, un
// tutor no podría cambiar su correo mientras siga el freno. El aviso a la
// dirección vieja sí sigue frenado (`cambiarCorreo`).
export const NO_ESCRIBIR_A_TUTORES = true;
