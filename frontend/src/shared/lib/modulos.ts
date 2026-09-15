// Modulos apagados sin borrar su codigo.
//
// Se usa con WhatsApp: viaja en el mismo build que todo lo demas pero en
// produccion todavia no se enciende. `VITE_MODULOS_APAGADOS=whatsapp` lo deja
// fuera, y se enciende quitando esa linea del `.env` del frontal.
//
// Vive aqui y no dentro del Sidebar porque no es solo el menu. Un modulo
// apagado tampoco puede estar preguntando al servidor por detras: el aviso de
// llamada entrante se monta en el layout, o sea en TODAS las pantallas del CRM
// y para todos los usuarios, y sin esto seguiria consultando cada minuto por un
// WhatsApp que nadie puede ver.
//
// Tener el criterio en dos sitios es como se llega a que uno diga que si y el
// otro que no. Ya paso con los telefonos: habia tres `cleanPhone` distintos.

const APAGADOS = String(import.meta.env.VITE_MODULOS_APAGADOS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

/** ¿Este modulo esta apagado en este entorno? */
export function moduloApagado(nombre: string): boolean {
  return APAGADOS.includes(nombre);
}

/** Lo contrario, para leerlo mejor donde toca. */
export const moduloEncendido = (nombre: string): boolean => !moduloApagado(nombre);
