import type { ProspectoCola } from '../api/whatsapp.api';

// Rellena una plantilla con los datos del prospecto.
//
// Variables de llave simple, insensibles a mayúsculas: {nombre}, {nombreCompleto},
// {producto}, {proyecto}, {email}, {telefono}.
//
// NO se reutiliza renderTemplate de email-templates: aquel escapa HTML siempre
// —hace falta para un correo— y aquí convertiría «Máster & Diplomado» en
// «Máster &amp; Diplomado» dentro del chat.
/**
 * Lo minimo que hace falta para rellenar una plantilla.
 *
 * No se pide un `ProspectoCola` entero a proposito: eso venia de la cola de
 * pendientes, y desde el chat los mismos datos llegan de la ficha de la
 * conversacion, con otra forma. Exigir el tipo grande obligaba a inventarse
 * campos que no se usan solo para poder llamar a esta funcion.
 */
export interface DatosParaRellenar {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  producto?: string | null;
  /**
   * Los datos de SU formación (#129).
   *
   * Solo los que el CRM tiene de verdad. El importe y el plan de pagos NO están
   * aquí a propósito: la migración 151 lo dejó dicho —«rellenarlos con datos que
   * el CRM no tiene sería peor que dejarlos: se enviarían cifras inventadas»— y
   * por eso siguen yendo [entre corchetes], que la gestora completa antes de
   * enviar.
   *
   * Las plazas sí, porque desde el #86 se cuentan de las ventas.
   */
  plazas?: number | null;
  cierre?: string | null;
  inicio?: string | null;
  /**
   * Duración, horas e importe (#88).
   *
   * Desde la migración 177 la ficha de la formación los pide como huecos en
   * vez de a mano: son datos del catálogo y escribirlos en cada mensaje es
   * donde se cuela la duración de otro curso. El importe SÍ está aquí, al
   * revés que en la nota de la 151: aquel aviso era por el plan de pagos, que
   * el CRM no tiene; el precio del catálogo sí lo tiene.
   */
  duracion?: string | null;
  horas?: string | null;
  precio?: string | number | null;
  moneda?: string | null;
}

/** Los huecos que el CRM sabe rellenar, para enseñarlos donde se escribe. */
export const VARIABLES = [
  { clave: 'nombre', pista: 'el nombre de pila' },
  { clave: 'nombreCompleto', pista: 'nombre y apellidos' },
  { clave: 'producto', pista: 'la formación que le interesa' },
  { clave: 'proyecto', pista: 'la marca' },
  { clave: 'email', pista: 'su correo' },
  { clave: 'telefono', pista: 'su teléfono' },
  { clave: 'plazas', pista: 'las que quedan libres, contadas ahora' },
  { clave: 'cierre', pista: 'cuándo cierra la convocatoria' },
  { clave: 'inicio', pista: 'cuándo empieza' },
  { clave: 'duracion', pista: 'lo que dura, del catálogo' },
  { clave: 'horas', pista: 'las horas lectivas' },
  { clave: 'inversion', pista: 'el precio del catálogo' },
] as const;

/**
 * La clave de un hueco, sin tildes y en minúscula.
 *
 * Hace falta porque la pantalla de plantillas ofrecía `{teléfono}` —con tilde—
 * y `rellenar` no lo rellenaba NUNCA: `\w` no casa con `é`, así que ese hueco
 * viajaba tal cual hasta el cliente. Quien copiara ese nombre de la lista
 * escribía un mensaje roto sin enterarse.
 *
 * Se arregla aceptando las dos formas en vez de cambiar la lista: puede haber
 * plantillas guardadas con la tilde y romperlas ahora sería peor.
 */
const sinTilde = (s: string) => s.toLowerCase()
  .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
  .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u');

/**
 * Las horas, sin la palabra «horas» detras.
 *
 * El catalogo las guarda como texto libre y en produccion vienen escritas
 * «750 horas». La plantilla ya dice «{horas} horas lectivas», asi que tal cual
 * salia «750 horas horas lectivas». Se recorta el sufijo y se respeta lo que
 * haya escrito si no es uno de esos: mejor raro que inventado.
 */
export function horasSueltas(v: string | null | undefined): string {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const corto = t.replace(/\s*(horas?|hrs?|h)\.?$/i, '').trim();
  return corto || t;
}

/** El importe, como se escribe en un mensaje. Sin precio no se inventa nada. */
function dinero(precio: string | number | null | undefined, moneda?: string | null): string {
  if (precio == null || precio === '' || Number.isNaN(Number(precio))) return '';
  return Number(precio).toLocaleString('es-ES', {
    style: 'currency', currency: moneda || 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
}

/** Cómo se dice en un mensaje una fecha que viene de la base. */
function comoFecha(v: string | null | undefined): string {
  if (!v) return '';
  // Llega como 'YYYY-MM-DD' (el CRM fuerza las DATE a texto para que no bailen
  // de día según la zona horaria). Se parte a mano: `new Date('2026-03-12')` lo
  // interpreta en UTC y en España se pintaría el 11.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (!m) return String(v);
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]}`;
}

export function rellenar(
  texto: string,
  prospecto: DatosParaRellenar,
  nombreProyecto?: string | null,
): string {
  const completo = (prospecto.nombre || '').trim();
  // Las plazas se cortan en cero de cara al cliente. En el catálogo pueden salir
  // negativas —significa que la convocatoria está sobrevendida, y eso el
  // administrador tiene que verlo— pero «quedan -2 plazas» en un WhatsApp no.
  const plazas = prospecto.plazas == null ? null : Math.max(0, Number(prospecto.plazas));
  const valores: Record<string, string> = {
    nombre: completo.split(/\s+/)[0] || '',
    nombrecompleto: completo,
    producto: prospecto.producto && prospecto.producto !== '—'
      ? prospecto.producto
      : 'nuestros programas',
    proyecto: nombreProyecto || '',
    email: prospecto.email || '',
    telefono: prospecto.telefono || '',
    plazas: plazas == null ? '' : String(plazas),
    cierre: comoFecha(prospecto.cierre),
    inicio: prospecto.inicio || '',
    // AQUÍ SE QUEDAN VACÍOS, y en la ficha del prospecto vuelven como
    // [corchete]. No es una incoherencia: son dos usos distintos.
    //
    // Desde el chat el mensaje SE ENVÍA, y un hueco vacío es lo que hace
    // saltar el aviso de «te faltan datos» antes de mandarlo. Un «[importe]»
    // no dispara nada y se va tal cual al cliente. Desde la ficha solo se
    // copia, así que allí el corchete es la señal correcta de «esto lo
    // escribes tú».
    duracion: prospecto.duracion || '',
    horas: horasSueltas(prospecto.horas),
    inversion: dinero(prospecto.precio, prospecto.moneda),
  };
  // Con `\p{L}` y la bandera unicode: con `\w`, `{teléfono}` no se reconocía ni
  // como hueco.
  return texto.replace(/\{([\p{L}\d_]+)\}/gu, (entero, clave: string) => {
    const v = valores[sinTilde(clave)];
    return v === undefined ? entero : v;
  });
}

/**
 * Que huecos se quedarian SIN rellenar con estos datos.
 *
 * Hace falta para avisar antes de mandar: una conversacion sin prospecto no
 * tiene nombre, y sin esto saldria un «Hola {nombre}» tal cual al otro lado.
 * Devuelve los nombres de las variables, ya sin llaves y en minuscula.
 */
export function huecosSinRellenar(
  texto: string,
  prospecto: DatosParaRellenar,
  nombreProyecto?: string | null,
): string[] {
  const rellenado = rellenar(texto, prospecto, nombreProyecto);
  const vacios = new Set<string>();
  // Lo que sigue entre llaves despues de rellenar es lo que no se pudo poner,
  // y ademas lo que quedo vacio porque el dato existia pero estaba en blanco.
  // La misma expresión que en `rellenar`, o el aviso de «te falta un dato» no
  // vería los huecos con tilde y dejaría pasar justo los que no se rellenan.
  for (const m of rellenado.matchAll(/\{([\p{L}\d_]+)\}/gu)) vacios.add(sinTilde(m[1]));
  for (const m of texto.matchAll(/\{([\p{L}\d_]+)\}/gu)) {
    const clave = sinTilde(m[1]);
    if (rellenar(`{${clave}}`, prospecto, nombreProyecto).trim() === '') vacios.add(clave);
  }
  return [...vacios];
}

/** Días desde el último contacto. null si nunca se le escribió. */
export function diasSinContacto(p: ProspectoCola): number | null {
  if (!p.ultimo_contacto) return null;
  const ms = Date.now() - new Date(p.ultimo_contacto).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
