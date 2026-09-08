import { query } from '../../shared/config/db.js';

/**
 * De que TIPO es un proyecto (#15).
 *
 * Hasta ahora eran dos, `crm` e `ia`, escritos a mano en tres sitios: el enum de
 * Postgres y dos `z.enum(['crm','ia'])` en la validacion. Anadir uno obligaba a
 * acordarse de los tres, y olvidar uno no da error hasta que alguien lo usa.
 *
 * Aqui hay UNA lista y los demas la leen.
 *
 * El tipo no es decoracion: decide que se le ensena a cada marca. Un centro de
 * formacion quiere las matriculas delante y una tienda quiere WooCommerce, y hoy
 * las dos ven lo mismo.
 */
export const TIPOS = [
  {
    key: 'crm',
    label: 'CRM general',
    descripcion: 'Lo de siempre: prospectos, ventas y seguimiento.',
    features: [],
  },
  {
    key: 'ia',
    label: 'Plataforma de IA',
    descripcion: 'Producto de suscripcion, sin matriculas ni catalogo de cursos.',
    features: ['suscripciones'],
  },
  {
    key: 'educacion',
    label: 'Centro educativo',
    descripcion: 'Convocatorias, matriculas y tutores por delante.',
    features: ['matriculas_prominent', 'tutores'],
  },
  {
    key: 'ecommerce',
    label: 'E-commerce',
    descripcion: 'Catalogo y pedidos, con la importacion de WooCommerce.',
    features: ['woocommerce', 'pedidos'],
  },
  {
    key: 'servicios',
    label: 'Servicios',
    descripcion: 'Presupuestos y trabajos, sin catalogo cerrado.',
    features: ['presupuestos'],
  },
  {
    key: 'inmobiliaria',
    label: 'Inmobiliaria',
    descripcion: 'Inmuebles y visitas en lugar de cursos.',
    features: ['inmuebles', 'visitas'],
  },
];

export const CLAVES = TIPOS.map((t) => t.key);

/**
 * Los que la BASE acepta ahora mismo.
 *
 * `project_type` es un enum de Postgres, y ampliarlo necesita la migracion 140.
 * Mientras no este aplicada, guardar un proyecto con un tipo nuevo NO da un
 * error entendible: Postgres contesta 22P02 «invalid input value for enum» y el
 * CRM lo convierte en «error del sistema». Es exactamente lo que ya nos paso
 * con `lead_status` y `proxima_convocatoria`, donde el sintoma fue una pantalla
 * en blanco y media hora buscando en el sitio equivocado.
 *
 * Asi que se pregunta. Se cachea porque no cambia sin un despliegue, y si la
 * consulta falla se supone lo que habia — quedarse sin ningun tipo dejaria el
 * CRM sin poder crear proyectos.
 */
let enLaBase = null;
export async function tiposEnLaBase() {
  if (enLaBase) return enLaBase;
  try {
    const { rows } = await query(
      `SELECT e.enumlabel AS clave
         FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'project_type'
        ORDER BY e.enumsortorder`
    );
    enLaBase = rows.map((r) => r.clave);
    if (!enLaBase.length) enLaBase = ['crm', 'ia'];
  } catch {
    enLaBase = ['crm', 'ia'];
  }
  return enLaBase;
}

/** Solo para las pruebas: olvida lo cacheado. */
export function olvidar() { enLaBase = null; }

/**
 * El catalogo, diciendo cual se puede usar HOY.
 *
 * Se devuelven todos, no solo los disponibles: quien mira la pantalla tiene que
 * poder ver que existe «Centro educativo» y que esta esperando una migracion.
 * Esconderlo haria que pareciera que no se ha hecho.
 */
export async function catalogo() {
  const hay = await tiposEnLaBase();
  return TIPOS.map((t) => ({ ...t, disponible: hay.includes(t.key) }));
}
