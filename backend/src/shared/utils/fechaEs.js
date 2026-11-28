/**
 * Una fecha del CRM (`AAAA-MM-DD`, o un Date) como se lee en España:
 * `05/11/2026`. Las columnas DATE llegan como texto y se recolocan tal cual,
 * sin pasar por un Date, para que la zona horaria no cambie el día (CRM#1230).
 * Lo que no sea una fecha se devuelve como vino; null/vacío, '—'.
 */
export function fechaEs(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric' }).format(v);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}
