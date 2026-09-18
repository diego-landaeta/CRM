/**
 * Los cinco pasos del proceso comercial, tal como los pidió Carlos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTÁN AQUÍ Y NO SOLO EN LA MIGRACIÓN
 *
 * La migración `143_pasos_comerciales.sql` los siembra con un
 * `CROSS JOIN projects`, o sea para los proyectos que existían EL DÍA QUE SE
 * APLICÓ. Un proyecto creado después no recibe ninguno, y sin pasos el proceso
 * comercial entero —«qué toca hoy», la cola del día, las plantillas— no tiene
 * de qué tirar: la pantalla sale vacía y nadie sabe por qué.
 *
 * Comprobado: en una base recién preparada la tabla queda a cero, porque las
 * migraciones corren antes de que existan los proyectos. Y al crear una marca
 * nueva por el panel, nace con cero pasos.
 *
 * Así que la lista vive aquí, que es lo vivo, y de aquí la coge tanto el alta
 * de un proyecto como la migración que repara los que se quedaron sin ellos.
 *
 * SI SE CAMBIAN, se cambian aquí. La migración 143 es un registro histórico de
 * lo que se sembró aquel día y no se toca.
 *
 * El proceso está escrito en `docs/proceso-comercial.pdf`.
 */

/**
 * `dia_desde`/`dia_hasta` son días desde que entra el prospecto, no fechas.
 * El seguimiento mensual no tiene ventana: va por final de mes.
 */
export const PASOS_POR_DEFECTO = [
  {
    clave: 'paso_1',
    nombre: 'Primer contacto e información',
    orden: 1,
    cuando: null,
    dia_desde: 0,
    dia_hasta: 1,
    canales: ['whatsapp', 'email'],
    es_seguimiento: false,
    nota: 'Los pasos de admisión y el trámite: solo cuando confirme interés.',
  },
  {
    clave: 'paso_2',
    nombre: 'Prueba social · Opiniones',
    orden: 2,
    cuando: null,
    dia_desde: 2,
    dia_hasta: 3,
    canales: ['llamada', 'whatsapp'],
    es_seguimiento: false,
    nota: 'Si no tiene opiniones: enviar captura de la vista general de Opynio y pedir internamente que se cree la opinión de ese curso.',
  },
  {
    clave: 'paso_3',
    nombre: 'Última plaza y facilidades de pago',
    orden: 3,
    cuando: null,
    dia_desde: 4,
    dia_hasta: 4,
    canales: ['llamada', 'whatsapp', 'email'],
    es_seguimiento: false,
    nota: 'El 5 % solo aplica en máster y diplomado, y se ofrece aquí, no antes.',
  },
  {
    clave: 'paso_4',
    nombre: 'Descuento de última oportunidad',
    orden: 4,
    cuando: null,
    dia_desde: 7,
    dia_hasta: 8,
    canales: ['llamada', 'whatsapp', 'email'],
    es_seguimiento: false,
    nota: 'Interno, no se comparte: el descuento se decide en la venta. Formación nueva, máximo 40 %; formación ya habilitada, hasta 70 %, reservado para quien casi no ha respondido.',
  },
  {
    clave: 'seguimiento_mensual',
    nombre: 'Seguimiento de toda la base',
    orden: 5,
    cuando: 'Final de mes',
    dia_desde: null,
    dia_hasta: null,
    canales: ['wasapi'],
    es_seguimiento: true,
    nota: 'Mantener el contacto vivo hasta la siguiente convocatoria. Sin presión de venta.',
  },
];
