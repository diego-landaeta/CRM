import type { RecorridoCobros } from '@/shared/lib/recorridosCobros';
import { FINAL_RECORRIDO as FINAL, anclaje } from '@/shared/lib/recorridosComun';

/**
 * LOS RECORRIDOS DEL BLOQUE ACADÉMICO (#941, tanda I, la última; gemela
 * CRM-ISEIE#619). Diego, 19/11: «las que son así, dáselas a Ángel CEDIA». Lo
 * que le faltaba al bloque, en el orden del menú:
 *
 *  · Productos: el catálogo del campus.
 *  · Cursos pendientes: lo vendido que aún no existe en el campus.
 *  · WooCommerce: la tienda de la web y la importación de sus productos.
 *  · Productos por categoría: el catálogo, categoría a categoría.
 *  · Árbol de categorías: las categorías del catálogo.
 *  · Sin tutor: lo que ya cobra y no tiene a quién pagarle comisión.
 *
 * Ya tenían el suyo: Cursos de Moodle (`recorridosCobros.ts`), Tutores
 * (`recorridosGestoraD.ts`), Mi campus y Consultas (novedades y tanda E) y
 * Comisiones de tutores (`recorridosFinanzas.ts`). Diplomas no entra: es de
 * Certifex.
 *
 * El mismo modelo que `recorridosCobros.ts`, que es donde se registran: allí se
 * suman a `RECORRIDOS_COBROS`, y así `VerRecorrido`, el botón «Recorrido» de la
 * cabecera (por sus `rutas`) y las pruebas de siempre (la de los anclajes y la
 * de 375 px) los ven sin tocar nada más. Ninguno se abre solo (#1012).
 *
 *  · Cada paso apunta a un `data-recorrido` de su pantalla; lo que no está en ese
 *    momento (una empresa o «Todos» arriba, no hay productos, los filtros
 *    escondidos, la vista de subidas, lo de supervisión a una tutora) se salta solo.
 *  · El permiso de cada recorrido es el de la pantalla en el menú; el de un
 *    paso, el del botón que explica.
 *
 * Solo importa TIPOS de `recorridosCobros` (se borran al compilar): así no hay un
 * ciclo de módulos entre los dos ficheros.
 *
 * PARIDAD: mismos ids y anclajes que en CRM-ISEIE. Cambian las rutas (aquí el
 * catálogo cuelga de `/productos`; allí, de `/products`) y lo que cada pantalla
 * tiene: «Productos por categoría» solo existe aquí; «Mis cursos» del tutor,
 * solo allí (aquí la tutora trabaja desde «Mi campus»). El catálogo de aquí
 * filtra por categoría y estado y edita desde la tarjeta; el de allí cambia
 * entre cuadrícula y lista y edita desde la ficha.
 */

/**
 * Lo único que cambia en los textos entre los dos CRM: qué se puede poner
 * arriba en vez de un campus. Aquí, una empresa o «Todos»; en CRM-ISEIE, solo
 * «Todos».
 */
const EN_ESTE_CRM = {
  arriba: 'Con una empresa o «Todos» arriba',
};

export type IdRecorridoGestoraG =
  | 'productos'
  | 'cursos-pendientes'
  | 'woocommerce'
  | 'productos-por-categoria'
  | 'arbol-categorias'
  | 'sin-tutor';

type RecorridoGestoraG = Omit<RecorridoCobros, 'id'> & { id: IdRecorridoGestoraG };

/** Por el menú: Académico. */
export const RECORRIDOS_GESTORA_G: Record<IdRecorridoGestoraG, RecorridoGestoraG> = {
  // ─── Académico › Productos ────────────────────────────────────────────────
  productos: {
    id: 'productos',
    rutas: ['/productos'],
    titulo: 'Productos',
    permiso: 'products.view',
    pantalla: ['modules/products/pages/ProductsPage.tsx'],
    pasos: [
      {
        titulo: 'El catálogo',
        texto: `Los cursos que vende el campus, con su precio y su dossier: lo que se elige al apuntar una venta. ${EN_ESTE_CRM.arriba}, los de todos sus campus, cada uno con el suyo. Son {pasos} pasos.`,
      },
      {
        donde: anclaje('productos-nuevo'),
        permiso: 'products.create',
        titulo: 'Nuevo producto',
        texto: 'Nombre, categoría, precio e IVA, la imagen y los datos del curso (horas, módulos, modalidad, plazas). El dossier en PDF se sube luego, en su ficha. Se crea en el campus de arriba.',
      },
      {
        donde: anclaje('productos-sincronizar'),
        permiso: 'woocommerce.sync',
        titulo: 'Traerlos de la tienda',
        texto: '«Sincronizar WC» trae los productos y las categorías de la tienda de la web del campus. Tarda un poco: arriba sale cómo va y, al acabar, la lista se pone al día sola.',
      },
      {
        donde: anclaje('productos-filtros'),
        titulo: 'Filtrar',
        texto: 'Por categoría (con las de debajo dentro) y por estado: de entrada salen solo los activos. Con varios campus, por campus. «Limpiar» lo quita todo, y el botón de arriba esconde este panel.',
      },
      {
        donde: anclaje('productos-buscar'),
        titulo: 'Buscar',
        texto: 'Por nombre, SKU o descripción, dentro de lo que dejan los filtros.',
      },
      {
        donde: anclaje('productos-lista'),
        titulo: 'Los productos',
        texto: 'Cada uno con su categoría, su precio y si está activo. «Dossier» abre su ficha con el PDF y sus versiones; si no tiene, lo dice.',
      },
      {
        donde: anclaje('productos-acciones'),
        permiso: ['products.edit', 'products.delete'],
        titulo: 'Editar o desactivar',
        texto: '«Editar» cambia sus datos. La papelera lo desactiva: deja de salir para vender, pero no se borra ni se pierden sus ventas; antes te lo pregunta.',
      },
      {
        titulo: 'Y listo',
        texto: FINAL,
      },
    ],
  },

  // ─── Académico › Cursos pendientes ────────────────────────────────────────
  'cursos-pendientes': {
    id: 'cursos-pendientes',
    rutas: ['/productos/pendientes'],
    titulo: 'Cursos pendientes',
    // Como en el menú: «Ver productos», o «Sus cursos» para la tutora (#770).
    permiso: ['products.view', 'tutores.mis_cursos'],
    pantalla: ['modules/cursos-pendientes/pages/CursosPendientesPage.tsx'],
    pasos: [
      {
        titulo: 'Lo vendido que aún no existe',
        texto: 'Las formaciones que se vendieron y todavía no están en el campus: quién las crea, para cuándo y qué alumnas esperan. Una tutora ve las suyas; quien supervisa, las de sus campus. Son {pasos} pasos.',
      },
      {
        donde: anclaje('pendientes-campus'),
        titulo: 'Campus a campus',
        texto: 'Una pestaña por campus con sus abiertos, sus retrasados y las alumnas que esperan, también los que están a cero. «Todos los campus» los junta, agrupados.',
      },
      {
        donde: anclaje('pendientes-vista'),
        permiso: 'tutores.gestionar',
        titulo: 'Cursos o control de subidas',
        texto: '«Control de subidas» enseña, curso a curso, qué falta por subir: los vídeos, los módulos en Moodle y los datos de la web.',
      },
      {
        donde: anclaje('pendientes-filtros'),
        titulo: 'Contadores y filtros',
        texto: 'Lo que suma la pestaña elegida. Puedes ver solo los retrasados, sacar también los cerrados y cancelados o, si supervisas, quedarte con una tutora. La flecha lo recarga.',
      },
      {
        donde: anclaje('pendientes-nuevo'),
        titulo: 'Nuevo pendiente',
        texto: 'Apunta a mano una formación vendida que aún no existe: el campus, el nombre tal como se vendió y el tipo. Si ya había uno abierto, no lo duplica. La tutora y la fecha se ponen luego, en su ficha.',
      },
      {
        donde: anclaje('pendientes-lista'),
        titulo: 'La lista',
        texto: 'Por fecha comprometida, con los retrasados arriba y en rojo (los días en negativo). Su estado, cómo va (foto, vídeo, módulos) y su tutora. Pulsa uno para abrir su ficha y moverlo.',
      },
      {
        donde: anclaje('pendientes-carga'),
        titulo: 'Carga y tiempos',
        texto: 'Solo para quien supervisa: cuántos cursos lleva cada tutora y cuántos se le retrasan, y por campus cuánto tarda una alumna, de la venta a tener su curso.',
      },
      {
        titulo: 'Y listo',
        texto: FINAL,
      },
    ],
  },

  // ─── Académico › WooCommerce ──────────────────────────────────────────────
  woocommerce: {
    id: 'woocommerce',
    rutas: ['/productos/woocommerce'],
    titulo: 'WooCommerce',
    permiso: 'woocommerce.view',
    pantalla: ['modules/woocommerce/pages/WooCommercePage.tsx'],
    pasos: [
      {
        titulo: 'La tienda de la web',
        texto: `WooCommerce es la tienda de la web del campus. Aquí se conecta y se traen sus productos al catálogo del CRM. ${EN_ESTE_CRM.arriba}, solo ves cómo está la de cada campus. Son {pasos} pasos.`,
      },
      {
        donde: anclaje('woo-estado'),
        titulo: 'Cada campus',
        texto: 'Si tiene la tienda conectada y cuándo fue su última importación, y cómo salió. Para conectarla o importar, entra en el campus.',
      },
      {
        donde: anclaje('woo-credenciales'),
        permiso: 'woocommerce.edit',
        titulo: 'Conectar la tienda',
        texto: 'La dirección de la tienda y sus claves de la API de WooCommerce (ck_ y cs_). La divisa vale para todo lo que se importe. Con la sincronización automática, el servidor la revisa cada tantos minutos.',
      },
      {
        donde: anclaje('woo-wordpress'),
        permiso: 'woocommerce.edit',
        titulo: 'WordPress y la página del curso',
        texto: 'Para traer más que la ficha de la tienda: el usuario de WordPress y su contraseña de aplicación, los tipos de contenido de los cursos («Auto-detectar») y el lector de la página pública (temario, objetivos…). Todo se guarda con «Guardar», abajo.',
      },
      {
        donde: anclaje('woo-importar'),
        permiso: 'woocommerce.sync',
        titulo: 'Importar',
        texto: '«Preview» enseña cómo llega un producto (o el de la dirección que pegues) y debajo, qué campo va a cada campo del CRM; «Guardar mapeo» antes de importar. «Importar ahora» los trae todos, en segundo plano.',
      },
      {
        donde: anclaje('woo-historial'),
        titulo: 'Historial de imports',
        texto: 'Cada importación con cuántos productos trajo, cuántos creó, cuántos actualizó y cuántos se saltó. Si falló, el motivo.',
      },
      {
        titulo: 'Y listo',
        texto: FINAL,
      },
    ],
  },

  // ─── Académico › Productos por categoría (solo en este CRM) ───────────────
  'productos-por-categoria': {
    id: 'productos-por-categoria',
    rutas: ['/productos/arbol'],
    titulo: 'Productos por categoría',
    permiso: 'products.view',
    pantalla: ['modules/products/pages/ProductsTreePage.tsx'],
    pasos: [
      {
        titulo: 'El catálogo, por categorías',
        texto: `Los productos ordenados por las categorías de la web: eliges una y salen los suyos. ${EN_ESTE_CRM.arriba}, el árbol de cada campus, uno debajo de otro. Son {pasos} pasos.`,
      },
      {
        donde: anclaje('porcat-arbol'),
        titulo: 'Las categorías',
        texto: 'Con cuántos productos tiene cada una. La flecha abre las de debajo, y arriba se busca una por su nombre. «Quitar filtro» vuelve a todos los productos.',
      },
      {
        donde: anclaje('porcat-buscar'),
        titulo: 'Buscar un producto',
        texto: 'Por nombre o SKU, dentro de la categoría elegida.',
      },
      {
        donde: anclaje('porcat-lista'),
        titulo: 'Los productos',
        texto: 'Cada uno con su SKU, su categoría y su precio (en el móvil, el nombre y el precio). Para cambiarlo, ve a «Productos».',
      },
      {
        titulo: 'Y listo',
        texto: FINAL,
      },
    ],
  },

  // ─── Académico › Árbol de categorías ──────────────────────────────────────
  'arbol-categorias': {
    id: 'arbol-categorias',
    rutas: ['/productos/categorias'],
    titulo: 'Árbol de categorías',
    permiso: 'products.categorias',
    pantalla: ['modules/product-categories/pages/CategoriesTreePage.tsx'],
    pasos: [
      {
        titulo: 'Las categorías del catálogo',
        texto: `Las categorías del campus, con los niveles que hagan falta. Vienen de la tienda (WC), del menú de WordPress o se crean a mano. ${EN_ESTE_CRM.arriba}, el de cada campus, solo para ver. Son {pasos} pasos.`,
      },
      {
        donde: anclaje('arbol-campus'),
        titulo: 'Cada campus',
        texto: 'El árbol de cada campus, uno debajo de otro. Para crear, cambiar o sincronizar categorías, entra en el campus.',
      },
      {
        donde: anclaje('arbol-acciones'),
        titulo: 'Sincronizar o crear',
        texto: '«Sincronizar WC» trae las categorías (y los productos) de la tienda; arriba sale cómo va. «Categoría raíz» crea una en el primer nivel.',
      },
      {
        donde: anclaje('arbol-filtros'),
        titulo: 'Buscar y filtrar',
        texto: 'Busca por nombre, quédate con las de un origen (a mano, WC o el menú de WordPress) u oculta las que no tienen productos.',
      },
      {
        donde: anclaje('arbol-lista'),
        titulo: 'El árbol',
        texto: 'Cada categoría con sus productos y su origen; la flecha abre las de debajo. Al pasar el ratón (en el móvil, siempre): «+» crea una subcategoría, el lápiz la renombra y la papelera la borra; antes te lo pregunta.',
      },
      {
        titulo: 'Y listo',
        texto: FINAL,
      },
    ],
  },

  // ─── Académico › Sin tutor ────────────────────────────────────────────────
  'sin-tutor': {
    id: 'sin-tutor',
    rutas: ['/tutores/sin-tutor'],
    titulo: 'Formaciones sin tutor',
    permiso: 'tutores.gestionar',
    pantalla: ['modules/tutores/pages/FormacionesSinTutorPage.tsx'],
    pasos: [
      {
        titulo: 'Lo que vende sin tutor',
        texto: 'Las formaciones que ya han cobrado algo y no tienen tutor: ese dinero no le genera comisión a nadie. Solo salen las que tienen al menos un cobro, no el catálogo entero. Son {pasos} pasos.',
      },
      {
        donde: anclaje('sintutor-corte'),
        titulo: 'Antes del corte',
        texto: 'De entrada cuentan los cobros desde que se pagan comisiones. Márcalo para ver también las que vendieron antes y siguen sin tutor: salen con «antes del corte».',
      },
      {
        donde: anclaje('sintutor-total'),
        titulo: 'Lo que suma',
        texto: 'Cuánto se ha cobrado entre todas, en cuántos cobros y de cuántos alumnos. Se arregla dándole un tutor a cada una.',
      },
      {
        donde: anclaje('sintutor-buscar'),
        titulo: 'Buscar',
        texto: 'Cuántas son y un buscador por el nombre de la formación.',
      },
      {
        donde: anclaje('sintutor-lista'),
        titulo: 'La lista',
        texto: 'Cada formación con sus alumnos, sus cobros, lo cobrado y el último cobro (en el móvil, desliza para ver más columnas).',
      },
      {
        donde: anclaje('sintutor-meta'),
        titulo: 'Se busca tutor',
        texto: 'Si se busca tutor para ella y con qué anuncio de Meta: activo o pausado, con su gasto y sus leads. Púlsalo para marcar que se busca y elegir el anuncio.',
      },
      {
        donde: anclaje('sintutor-asignar'),
        titulo: 'Asignar tutor',
        texto: 'Lleva a Tutores con la formación ya elegida: allí se le da un tutor con su porcentaje.',
      },
      {
        titulo: 'Y listo',
        texto: FINAL,
      },
    ],
  },
};
