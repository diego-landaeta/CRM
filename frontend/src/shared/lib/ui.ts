// Piezas de presentacion que estaban copiadas en varios modulos a la vez.
//
// Antes de tocar esto habia 5 copias de AVATAR_COLORS, 6 de getInitials y 14 de
// inputClass — con seis valores distintos entre ellas. Aqui hay UNA. El resto se
// va apuntando aqui segun se toca cada pantalla; no se migran todas de golpe
// porque cambiar 30 archivos a la vez no se puede revisar.

/**
 * La paleta de identidad: el color de un avatar.
 *
 * **Es la única excepción a «todo con tokens», y a propósito.** Los tokens
 * dicen qué significa algo —esto va bien, esto es un aviso—, y aquí no hay
 * significado: hacen falta ocho matices que se distingan entre sí para
 * reconocer a una persona o una marca de un vistazo. Un token semántico no
 * puede dar eso. Lo que sí se exige es que la paleta esté **en un solo sitio**,
 * y este es.
 *
 * Llevaba variante clara y nada más, así que en modo oscuro pintaba un fondo
 * claro con texto oscuro: legible, pero un parche blanco en una pantalla negra.
 * Ahora lleva las dos.
 */
export const AVATAR_COLORS: ReadonlyArray<string> = [
  'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
];

/** Color estable para un avatar: el mismo id siempre pinta el mismo color. */
export function avatarColorFor(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

/**
 * Lo mismo, pero cuando lo que identifica es un nombre y no un número — las
 * marcas. El color sale del propio nombre, así que ISECD es verde hoy y verde
 * mañana: la memoria visual funciona porque el color no cambia.
 */
export function avatarColorForName(nombre = ''): string {
  let n = 0;
  for (const ch of String(nombre)) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export const inputClass =
  'w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';

/**
 * Los colores con los que se distinguen los roles a medida (#31).
 *
 * **Segunda excepción a «todo con tokens», y por la misma razón que
 * `AVATAR_COLORS`:** quien crea un rol elige un color para reconocerlo de un
 * vistazo entre otros. No dice si el rol es bueno, peligroso ni informativo —
 * dice «este es el mío».
 *
 * Pasarlos a tokens semánticos es justo lo que NO hay que hacer, y lo intenté:
 * al migrar el bloque 7 del #34 convertí `rose` en `destructive` y `emerald` en
 * `success`, y entonces un rol llamado «rose» se leía como un aviso de peligro
 * y otro como algo que va bien. El color dejaba de significar «este» para
 * significar otra cosa.
 *
 * Viven aquí, en un solo sitio, que es lo que sí se exige.
 */
export const ROLE_COLORS = {
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
} as const;

export type RoleColor = keyof typeof ROLE_COLORS;

/**
 * Los colores con los que se distinguen las categorías de gasto.
 *
 * **Tercera excepción, y la misma de siempre:** la pantalla de Egresos existe
 * para ver de un vistazo en qué se va el dinero, y eso pide que alquiler,
 * salarios y publicidad se distingan entre sí. No dicen si un gasto es bueno o
 * malo — todos son gastos.
 *
 * Migrando el bloque 4 del #34 las pasé a tokens semánticos y colapsé ocho en
 * cuatro: salarios, servicios y comisiones de pasarela acabaron siendo el mismo
 * azul, y proveedores y mantenimiento el mismo ámbar. Tres categorías
 * indistinguibles en la pantalla cuyo trabajo es distinguirlas.
 *
 * Es la segunda vez que cometo este error —la primera fue con los roles— así
 * que hay una prueba que exige que estas paletas tengan todos sus valores
 * distintos. Ver `paletas-de-identidad.test.js`.
 */
export const EXPENSE_CATEGORY_COLORS = {
  salarios: 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400',
  alquiler: 'bg-purple-100 text-purple-800 dark:bg-purple-950/30 dark:text-purple-400',
  proveedores: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  software: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  publicidad: 'bg-pink-100 text-pink-800 dark:bg-pink-950/30 dark:text-pink-400',
  impuestos: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400',
  servicios: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-400',
  mantenimiento: 'bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400',
  otros: 'bg-muted text-muted-foreground',
  comision_pasarela_pago: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400',
  comision_gestor: 'bg-teal-100 text-teal-800 dark:bg-teal-950/30 dark:text-teal-400',
  nomina: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
} as const;

/**
 * Los colores del tablero de tareas: columnas, áreas y proyectos propios.
 *
 * **Cuarta excepción, la misma de siempre:** quien crea una columna o un área
 * elige «Azul» o «Violeta» para reconocerla entre las demás, no para decir que
 * va bien o mal. Si «Verde» fuera `success` y «Rojo» `destructive`, un área
 * pintada de rojo se leería como un error. Son los mismos que acepta el
 * servidor (COLORES_TABLERO en tasks.validation.js): un color que no esté aquí
 * no se puede guardar.
 */
export const TASK_BOARD_COLORS = {
  gray: {
    label: 'Gris', dot: 'bg-slate-400',
    head: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  blue: {
    label: 'Azul', dot: 'bg-blue-500',
    head: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  },
  yellow: {
    label: 'Ámbar', dot: 'bg-amber-500',
    head: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  green: {
    label: 'Verde', dot: 'bg-emerald-500',
    head: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  purple: {
    label: 'Violeta', dot: 'bg-purple-500',
    head: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
    chip: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  rose: {
    label: 'Rojo', dot: 'bg-rose-500',
    head: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
} as const;

/** Las etiquetas de una tarea: el mismo caso, el color lo elige quien la crea. */
export const TASK_TAG_COLORS = {
  sky: { label: 'Azul', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800' },
  rose: { label: 'Rojo', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800' },
  amber: { label: 'Ámbar', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800' },
  emerald: { label: 'Verde', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
  violet: { label: 'Violeta', chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border border-violet-200 dark:border-violet-800' },
  slate: { label: 'Gris', chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700' },
} as const;

/**
 * El color de cada cifra del resumen y de cada grupo de informes: Prospectos,
 * Ventas, Ingresos y Tasa de conversión.
 *
 * **Quinta excepción:** es el mismo color que la línea de esa cifra en el
 * gráfico de al lado (`PanelResumen`). Pasarlo a tokens rompería ese enlace:
 * «Ventas» saldría en el verde de «va bien» y su línea en otro verde. Estaba
 * copiado en `PanelResumen` y en `ReportesDisponibles`; ahora está aquí una vez.
 */
export const ACCENT_COLORS = {
  sky: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-600 dark:text-sky-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400' },
} as const;

/**
 * El color de la «Tasa de conversión» del embudo del Dashboard: el violeta de la
 * barra «Convertido» que tiene encima, para que se lean como la misma cosa. Es
 * identidad (esa etapa), no significado; un poco más oscuro en claro y más claro
 * en oscuro que la barra, para que la cifra se lea.
 */
export const FUNNEL_CONVERTED_TEXT = 'text-violet-600 dark:text-violet-400';
