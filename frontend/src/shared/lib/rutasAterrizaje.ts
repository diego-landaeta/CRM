/**
 * Las pantallas donde puede aterrizar alguien al entrar.
 *
 * Estaba metida a mano dentro de LoginPage, y la pestaña «Vista» de Roles
 * necesita exactamente la misma lista: si ofreciera una distinta, un admin
 * podria elegir una ruta que el login luego descarta, y el rol entero
 * aterrizaria en otro sitio sin explicacion.
 *
 * Cada `ruta` tiene que existir en `App.jsx`. Las de los roles fijos viven en
 * `role-views.defaults.js` del backend, y ya se quedaron desfasadas una vez:
 * decian `/dashboard`, `/leads` y `/status/soporte`, ninguna de las cuales
 * existe desde que el CRM paso sus direcciones al castellano. Quien aterrizaba
 * ahi se encontraba una pantalla en blanco.
 */

export interface RutaAterrizaje {
  ruta: string;
  label: string;
  pista: string;
}

export const RUTAS_ATERRIZAJE: ReadonlyArray<RutaAterrizaje> = [
  { ruta: '/',            label: 'Dashboard',   pista: 'El resumen de siempre' },
  { ruta: '/prospectos',  label: 'Prospectos',  pista: 'Para quien vive en el listado' },
  { ruta: '/finanzas',    label: 'Finanzas',    pista: 'Ingresos, gastos y cobros' },
  { ruta: '/informes',    label: 'Informes',    pista: 'Solo datos' },
  { ruta: '/soporte',     label: 'Soporte',     pista: 'Incidencias y estado' },
  { ruta: '/status',      label: 'Estado',      pista: 'Salud del sistema' },
  { ruta: '/mis-cursos',  label: 'Mis cursos',  pista: 'Lo que ve un tutor' },
];

export const RUTAS_VALIDAS = new Set(RUTAS_ATERRIZAJE.map((r) => r.ruta));

/** La ruta pedida si es una de las nuestras; si no, el dashboard. */
export function rutaSegura(ruta?: string | null): string {
  return ruta && RUTAS_VALIDAS.has(ruta) ? ruta : '/';
}
