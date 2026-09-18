import { query } from '../../shared/config/db.js';
import { llevaCincoDeContado } from './reglasDelProceso.js';
import { PASOS_POR_DEFECTO } from './pasosPorDefecto.js';
/*
  LAS PLAZAS NO SE CUENTAN AQUI, y antes si.

  Diego, 11/09/2026: «eso lo hacen ellas desde otro sistema, no en el CRM, pero
  si es un paso a poner... que el CRM no lo recuerde, solamente sea que toca
  mandar ese mensaje y como un disclaimer de verificar cuantas plazas quedan».

  Tenia razon y el calculo se ha quitado: de dos contabilidades de las mismas
  plazas solo una puede tener razon, y es la de admisiones. Un numero nuestro
  que no cuadre con el suyo es PEOR que no dar numero, porque ese numero acaba
  dentro de un mensaje que ya salio al cliente.

  Lo que queda es `s.avisa_plazas`: el paso dice que su mensaje habla de
  plazas, y la pantalla pone el aviso de ir a mirarlas. El calculo sigue vivo
  en el catalogo (`products/plazas.sql.js`) para quien quiera llevarlo ahi.
*/

// Los pasos del proceso comercial (#87).
//
// Se leen y se escriben SIEMPRE dentro de un proyecto: cada uno puede llevar su
// propio proceso, y mezclarlos seria dar a una gestora la cola de otra marca.

const COLS = `id, project_id, clave, nombre, orden, cuando,
              dia_desde, dia_hasta, canales, es_seguimiento, nota, activo,
              avisa_plazas, ofrece_descuento, pide_opiniones, created_at, updated_at`;

export async function listByProject(projectId, { includeInactive = false } = {}) {
  const { rows } = await query(
    `SELECT ${COLS} FROM commercial_steps
      WHERE project_id = $1 ${includeInactive ? '' : 'AND activo = true'}
      ORDER BY orden, id`,
    [projectId]
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(`SELECT ${COLS} FROM commercial_steps WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function findByClave(projectId, clave) {
  const { rows } = await query(
    `SELECT ${COLS} FROM commercial_steps WHERE project_id = $1 AND clave = $2`,
    [projectId, clave]
  );
  return rows[0] || null;
}

export async function create(projectId, data) {
  // Al final de la lista salvo que digan otra cosa: un paso nuevo que aparece
  // en medio descoloca la cola de todo el mundo sin avisar.
  const { rows } = await query(
    `INSERT INTO commercial_steps
       (project_id, clave, nombre, orden, cuando, dia_desde, dia_hasta,
        canales, es_seguimiento, nota)
     VALUES ($1, $2, $3,
             COALESCE($4::integer, (SELECT COALESCE(MAX(orden), 0) + 1 FROM commercial_steps WHERE project_id = $1)),
             $5, $6, $7,
             -- El casteo NO es adorno: sin el, Postgres infiere el '{}' como
             -- texto suelto y el COALESCE entero pasa a ser text, que no cabe
             -- en una columna text[]. (Y ojo: aqui dentro NO caben comillas
             -- invertidas, que esto es una plantilla de JS y la cortarian.)
             COALESCE($8::text[], '{}'::text[]), COALESCE($9::boolean, false), $10)
     RETURNING ${COLS}`,
    [projectId, data.clave, data.nombre, data.orden ?? null, data.cuando ?? null,
     data.dia_desde ?? null, data.dia_hasta ?? null, data.canales ?? null,
     data.es_seguimiento ?? null, data.nota ?? null]
  );
  return rows[0];
}

export async function update(id, data) {
  // `clave` NO esta en la lista a proposito: es por donde entra el codigo, y
  // dejar que se renombre desde la pantalla es exactamente como se rompe.
  const permitidos = ['nombre', 'orden', 'cuando', 'dia_desde', 'dia_hasta',
                      'canales', 'es_seguimiento', 'nota', 'activo', 'avisa_plazas',
                      'ofrece_descuento', 'pide_opiniones'];
  const campos = [];
  const valores = [];
  let i = 1;
  for (const k of permitidos) {
    if (data[k] !== undefined) { campos.push(`${k} = $${i++}`); valores.push(data[k]); }
  }
  if (campos.length === 0) return findById(id);
  campos.push('updated_at = NOW()');
  valores.push(id);
  const { rows } = await query(
    `UPDATE commercial_steps SET ${campos.join(', ')} WHERE id = $${i} RETURNING ${COLS}`,
    valores
  );
  return rows[0];
}

// Reordenar de una vez y en una transaccion: si se hiciera paso a paso y algo
// fallara por medio, la lista quedaria a medio ordenar y nadie lo sabria.
export async function reorder(projectId, idsEnOrden) {
  const { rows } = await query(
    `UPDATE commercial_steps s
        SET orden = nuevo.pos, updated_at = NOW()
       FROM (SELECT id::int, ordinality::int AS pos
               FROM unnest($2::int[]) WITH ORDINALITY AS t(id, ordinality)) AS nuevo
      WHERE s.id = nuevo.id AND s.project_id = $1
      RETURNING s.id`,
    [projectId, idsEnOrden]
  );
  return rows.length;
}

// Se desactiva, no se borra. Un paso borrado se lleva por delante la lectura de
// lo que ya paso: las interacciones viejas apuntaban a el.
export async function deactivate(id) {
  const { rows } = await query(
    `UPDATE commercial_steps SET activo = false, updated_at = NOW()
      WHERE id = $1 RETURNING ${COLS}`,
    [id]
  );
  return rows[0];
}

// ── LOS CINCO PASOS DE UNA MARCA NUEVA ──────────────────────────────────────
//
// La migracion `143_pasos_comerciales.sql` sembro los cinco pasos con un
// `CROSS JOIN projects`, o sea para los proyectos que existian AQUEL DIA. Un
// proyecto creado despues nace con la tabla vacia, y sin pasos no hay proceso
// comercial: «que toca hoy» sale en blanco, la cola del dia no tiene de que
// tirar y las plantillas no cuelgan de ningun sitio. La pantalla no da ningun
// error — simplemente no hay nada, que es la peor forma de fallar.
//
// Comprobado creando una marca por el panel: cero pasos.
//
// Se llama desde el alta del proyecto, y tambien desde la migracion que repara
// los que se quedaron sin ellos. La lista vive en `pasosPorDefecto.js`, no
// aqui: es la misma para los dos sitios y asi no puede divergir.
export async function sembrarPorDefecto(projectId) {
  // Un solo INSERT: cinco viajes a la base por cada marca creada no hacen
  // falta, y si uno fallara a medias el proyecto quedaria con tres pasos, que
  // es peor que con ninguno — nadie mira una lista que ya tiene contenido.
  const params = [projectId];
  const filas = PASOS_POR_DEFECTO.map((p) => {
    const i = params.length;
    params.push(p.clave, p.nombre, p.orden, p.cuando, p.dia_desde, p.dia_hasta,
                p.canales, p.es_seguimiento, p.nota);
    return `($1, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}::integer,`
         + ` $${i + 6}::integer, $${i + 7}::text[], $${i + 8}, $${i + 9})`;
  });

  // ON CONFLICT y no un DELETE previo: si la marca ya tiene sus pasos —o los
  // tiene EDITADOS, que es lo normal pasado un tiempo— esto no debe pisarlos.
  // El indice unico es (project_id, clave).
  const { rows } = await query(
    `INSERT INTO commercial_steps
       (project_id, clave, nombre, orden, cuando, dia_desde, dia_hasta,
        canales, es_seguimiento, nota)
     VALUES ${filas.join(', ')}
     ON CONFLICT (project_id, clave) DO NOTHING
     RETURNING id`,
    params
  );
  return rows.length;
}

// ── LA AGENDA DE CADA PROSPECTO (#89 · #90) ─────────────────────────────────
//
// `commercial_steps` dice el proceso en general; esto dice a QUIEN le toca QUE
// y CUANDO. Se escribe al entrar la persona, no se calcula al vuelo: calcularlo
// vale para leer, pero no para trabajar —no deja ver la agenda por delante ni
// mover la fecha de alguien concreto—.
//
// SI UN PASO ESTA HECHO NO SE GUARDA: se deduce de los contactos reales. El
// contacto n.º N cierra el paso n.º N, que es la misma regla del embudo de
// Reportes, asi que los dos sitios cuentan igual. Un plan que hay que mantener
// a mano acaba mintiendo.

// La fecha de entrada manda, y es `fecha_solicitud`: dos tercios de los
// prospectos cargados tienen la solicitud anterior al alta.
const ENTRADA = `COALESCE(l.fecha_solicitud, l.created_at)`;

// Cuantas veces se ha contactado DE VERDAD con esta persona. Una nota interna
// no es contactar con nadie.
const CONTACTOS = `(SELECT count(*) FROM lead_interactions li
                     WHERE li.lead_id = l.id AND li.tipo <> 'nota')`;

// ── «CADA CORREO SE AVISA POR WHATSAPP» (#91) ───────────────────────────────
//
// El documento: «nunca damos por hecho que lo ha visto». Un paso que se hace
// por los dos canales NO esta hecho hasta que salen los dos, aunque se haya
// contactado tres veces por uno solo.
//
// Solo se exige donde el paso DECLARA los dos canales —hoy el paso 1—, y solo
// sobre correo y WhatsApp. La llamada no entra aunque el paso la declare: no
// todas las gestoras las registran, y exigir un registro que no se hace
// dejaria media cola pendiente para siempre por un motivo falso.
const POR_CANAL = (tipo) => `(SELECT count(*) FROM lead_interactions li
                     WHERE li.lead_id = l.id AND li.tipo = '${tipo}')`;

// Y no se le exige a quien no tiene correo: no se le puede mandar. De eso
// avisa `sin_correo`, que pide que se lo pidan el dia 1.
const EXIGE_LOS_DOS = `(s.canales @> ARRAY['email','whatsapp']::text[]
                        AND l.email IS NOT NULL AND btrim(l.email) <> '')`;

// Lo que falta para dar el paso por hecho, cuando se piden los dos.
const FALTA_CORREO   = `(${EXIGE_LOS_DOS} AND ${POR_CANAL('email')} = 0)`;
const FALTA_WHATSAPP = `(${EXIGE_LOS_DOS} AND ${POR_CANAL('whatsapp')} = 0)`;

// El paso se cierra con los contactos, como siempre, y ademas con los dos
// canales cuando toca.
const HECHO = `((${CONTACTOS}) >= ls.orden
                AND NOT ${FALTA_CORREO} AND NOT ${FALTA_WHATSAPP})`;

/**
 * Escribe la agenda de un prospecto: un apunte por cada paso del proceso de su
 * proyecto, con la fecha contada desde que entro.
 *
 * Es idempotente —`ON CONFLICT DO NOTHING` sobre (lead_id, clave)—, asi que se
 * puede llamar dos veces sin duplicar, y volver a llamarla despues de anadir un
 * paso nuevo rellena solo lo que falta.
 *
 * El seguimiento mensual NO entra: no es del recorrido de una persona sino de
 * toda la base a fin de mes, y meterlo aqui llenaria la cola del dia con la
 * base entera.
 */
export async function planificarPasosDeLead(leadId) {
  const { rows } = await query(
    `INSERT INTO lead_steps (lead_id, project_id, step_id, clave, orden, fecha_prevista)
     SELECT l.id, l.project_id, s.id, s.clave, s.orden,
            (${ENTRADA}::date + COALESCE(s.dia_desde, 0))
       FROM leads l
       JOIN commercial_steps s ON s.project_id = l.project_id
      WHERE l.id = $1
        AND l.deleted_at IS NULL
        AND s.activo = true
        AND s.es_seguimiento = false
     ON CONFLICT (lead_id, clave) DO NOTHING
     RETURNING id`,
    [leadId]
  );
  return rows.length;
}

/**
 * La agenda de una persona, para su ficha (#89).
 *
 * Devuelve TODOS sus pasos en orden, cada uno con si esta hecho, si se salto y
 * cuantos dias lleva de retraso. El «siguiente» es el primero que no esta ni
 * hecho ni saltado.
 */
export async function pasosDeLead(leadId) {
  const { rows } = await query(
    `SELECT ls.id, ls.clave, ls.orden, ls.fecha_prevista, ls.estado, ls.nota,
            s.nombre, s.cuando, s.canales, s.nota AS nota_del_paso,
            COALESCE(s.avisa_plazas, false) AS avisa_plazas,
            -- El 5 % de contado (#91): el paso dice si es el suyo y la
            -- formacion dice si lo lleva. Las dos cosas hacen falta.
            COALESCE(s.ofrece_descuento, false) AS ofrece_descuento,
            COALESCE(s.pide_opiniones, false) AS pide_opiniones,
            p.nombre AS producto, pc.nombre AS producto_categoria,
            -- La prueba social del paso 2 (#91). NULL es «no consta» y no es
            -- lo mismo que «no tiene»: sin saberlo se pide comprobar, no se
            -- afirma que no hay.
            p.opiniones_publicadas,
            -- «Sin correo no hay guia de Moodle ni homologaciones: si falta,
            -- pedirlo el dia 1» (#91). El CRM sabe si lo tiene; hasta ahora
            -- habia que acordarse de mirarlo.
            (l.email IS NULL OR btrim(l.email) = '') AS sin_correo,
            ${HECHO} AS hecho,
            -- Por que sigue pendiente, para decirlo en vez de dejar a la
            -- gestora mirando un paso que ella cree hecho.
            ${FALTA_CORREO} AS falta_correo,
            ${FALTA_WHATSAPP} AS falta_aviso,
            (CURRENT_DATE - ls.fecha_prevista) AS dias_de_retraso
       FROM lead_steps ls
       JOIN leads l ON l.id = ls.lead_id
       LEFT JOIN commercial_steps s ON s.id = ls.step_id
       LEFT JOIN products p ON p.id = l.producto_interes_id
       LEFT JOIN product_categories pc ON pc.id = p.categoria_id
      WHERE ls.lead_id = $1
      ORDER BY ls.orden, ls.id`,
    [leadId]
  );
  return rows.map((r) => ({
    ...r,
    dias_de_retraso: Number(r.dias_de_retraso),
    // Un paso vence solo si no esta hecho ni saltado. Uno hecho tarde ya no
    // urge: urge el siguiente.
    vencido: !r.hecho && r.estado === 'pendiente' && Number(r.dias_de_retraso) > 0,
    // `null` es «no consta la formacion», y no es lo mismo que «no lo lleva»:
    // ahi hay que preguntar, no dar por hecho que no.
    lleva_descuento: r.ofrece_descuento
      ? llevaCincoDeContado(r.producto, r.producto_categoria)
      : null,
  }));
}

/**
 * La cola del dia (#90): a quien le toca hoy, y quien viene arrastrado.
 *
 * Devuelve UNA fila por persona —su paso mas urgente—, no una por paso: la
 * gestora abre una ficha por persona, no una por apunte. Si alguien lleva tres
 * pasos sin hacer, lo que necesita es que le llamen, no salir tres veces.
 */
export async function colaDelDia({ projectIds, asesoraId, hasta = null, limite = 200 }) {
  const par = [];
  let i = 1;
  // Sin proyecto elegido, la cola es la del equipo: los de pruebas no
  // entran. Elegido a dedo si, que para eso es su cola.
  const pProj = Array.isArray(projectIds) && projectIds.length
    ? `AND ls.project_id = ANY($${i++}::int[])`
    : 'AND ls.project_id NOT IN (SELECT id FROM projects WHERE es_prueba)';
  // `if (pProj)` era SIEMPRE cierto —es una cadena no vacia en las dos ramas—
  // asi que con la lista vacia se empujaba un parametro de mas y la consulta
  // reventaba con «bind message supplies 2 parameters, but requires 1». No
  // salto antes porque el controlador siempre manda una lista con algo.
  if (Array.isArray(projectIds) && projectIds.length) par.push(projectIds.map(Number));
  const pAses = asesoraId ? `AND l.responsable_id = $${i++}` : '';
  if (asesoraId) par.push(asesoraId);
  const pHasta = hasta ? `$${i++}::date` : 'CURRENT_DATE';
  if (hasta) par.push(hasta);
  const pLimite = `$${i++}`;
  par.push(Number(limite) || 200);

  const { rows } = await query(
    `WITH pendientes AS (
       SELECT ls.*, l.responsable_id, l.nombre AS lead_nombre, l.status AS lead_estado,
              l.producto_interes_id,
              ${CONTACTOS} AS contactos,
              ${FALTA_CORREO} AS falta_correo,
              ${FALTA_WHATSAPP} AS falta_aviso,
              ROW_NUMBER() OVER (PARTITION BY ls.lead_id ORDER BY ls.orden) AS pos
         FROM lead_steps ls
         JOIN leads l ON l.id = ls.lead_id
         -- El paso hace falta AQUI DENTRO, no solo fuera: la regla de los dos
         -- canales mira los canales del paso para saber si los pide. (Sin
         --  comillas invertidas aqui: esto va dentro de una plantilla de JS.)
         LEFT JOIN commercial_steps s ON s.id = ls.step_id
        WHERE l.deleted_at IS NULL
          AND ls.estado = 'pendiente'
          AND ls.fecha_prevista <= ${pHasta}
          -- Quien ya compro o dijo que no, sale de la cola: seguir el proceso
          -- con alguien que ya cerro es hacerle perder el tiempo a las dos.
          AND l.status NOT IN ('convertido', 'no_interesado')
          -- El paso ya hecho no se pide otra vez. «Hecho» incluye desde el
          -- #91 que hayan salido los dos canales cuando el paso los pide:
          -- un correo sin su aviso por WhatsApp deja el paso abierto.
          AND NOT ${HECHO}
          ${pProj} ${pAses}
     )
     SELECT q.lead_id, q.lead_nombre, q.lead_estado, q.responsable_id,
            q.clave, q.orden, q.fecha_prevista, q.contactos,
            -- De que campus es cada fila. Con una EMPRESA elegida la cola
            -- junta los siete de CEDIA, y sin esto no se sabe a quien se
            -- llama de parte de quien. Lo pidio Carlos el 11/09.
            q.project_id, pr.nombre AS proyecto,
            s.nombre AS paso_nombre, s.canales, s.nota AS paso_nota,
            u.nombre AS gestora,
            (CURRENT_DATE - q.fecha_prevista) AS dias_de_retraso,
            -- La formacion, para saber de que se habla sin salirse de la cola.
            -- Las plazas NO: solo la marca de que este paso las menciona y hay
            -- que ir a comprobarlas fuera.
            p.nombre AS producto, p.precio AS producto_precio,
            pc.nombre AS producto_categoria,
            p.opiniones_publicadas,
            COALESCE(s.avisa_plazas, false) AS avisa_plazas,
            COALESCE(s.ofrece_descuento, false) AS ofrece_descuento,
            COALESCE(s.pide_opiniones, false) AS pide_opiniones,
            q.falta_correo, q.falta_aviso
       FROM pendientes q
       LEFT JOIN commercial_steps s ON s.id = q.step_id
       LEFT JOIN projects pr ON pr.id = q.project_id
       LEFT JOIN users u ON u.id = q.responsable_id
       LEFT JOIN products p ON p.id = q.producto_interes_id
       LEFT JOIN product_categories pc ON pc.id = p.categoria_id
      WHERE q.pos = 1
      ORDER BY q.fecha_prevista, q.orden, q.lead_id
      LIMIT ${pLimite}`,
    par
  );
  return rows.map((r) => ({
    ...r,
    dias_de_retraso: Number(r.dias_de_retraso),
    // Ver `pasosDeLead`: el paso dice si toca ofrecerlo, la formacion si lo
    // lleva, y `null` es «no consta la formacion».
    lleva_descuento: r.ofrece_descuento
      ? llevaCincoDeContado(r.producto, r.producto_categoria)
      : null,
  }));
}

/**
 * Cuantos hay atrasados, para hoy, para manana y para la semana. Para la
 * campana y el resumen: no hace falta traerse la lista entera para dar un
 * numero.
 */
export async function resumenDeLaCola({ projectIds, asesoraId }) {
  const par = [];
  let i = 1;
  // Sin proyecto elegido, la cola es la del equipo: los de pruebas no
  // entran. Elegido a dedo si, que para eso es su cola.
  const pProj = Array.isArray(projectIds) && projectIds.length
    ? `AND ls.project_id = ANY($${i++}::int[])`
    : 'AND ls.project_id NOT IN (SELECT id FROM projects WHERE es_prueba)';
  // `if (pProj)` era SIEMPRE cierto —es una cadena no vacia en las dos ramas—
  // asi que con la lista vacia se empujaba un parametro de mas y la consulta
  // reventaba con «bind message supplies 2 parameters, but requires 1». No
  // salto antes porque el controlador siempre manda una lista con algo.
  if (Array.isArray(projectIds) && projectIds.length) par.push(projectIds.map(Number));
  const pAses = asesoraId ? `AND l.responsable_id = $${i++}` : '';
  if (asesoraId) par.push(asesoraId);

  const { rows } = await query(
    `WITH pendientes AS (
       SELECT ls.lead_id, ls.fecha_prevista,
              ROW_NUMBER() OVER (PARTITION BY ls.lead_id ORDER BY ls.orden) AS pos
         FROM lead_steps ls
         JOIN leads l ON l.id = ls.lead_id
         -- El paso, por la regla de los dos canales. Cuenta lo MISMO que la
         -- cola o el numero de arriba no cuadra con la lista de abajo, que es
         -- la forma mas rapida de que nadie se crea ninguno de los dos.
         LEFT JOIN commercial_steps s ON s.id = ls.step_id
        WHERE l.deleted_at IS NULL AND ls.estado = 'pendiente'
          AND l.status NOT IN ('convertido', 'no_interesado')
          AND NOT ${HECHO}
          ${pProj} ${pAses}
     )
     SELECT count(*) FILTER (WHERE fecha_prevista < CURRENT_DATE)::int      AS atrasados,
            count(*) FILTER (WHERE fecha_prevista = CURRENT_DATE)::int      AS hoy,
            count(*) FILTER (WHERE fecha_prevista = CURRENT_DATE + 1)::int  AS manana,
            count(*) FILTER (WHERE fecha_prevista <= CURRENT_DATE + 7)::int AS esta_semana
       FROM pendientes WHERE pos = 1`,
    par
  );
  return rows[0];
}

/** Saltarse un paso o moverlo de fecha, a mano y con su porque. */
export async function ajustarPaso(id, { estado, fecha_prevista, nota }) {
  const { rows } = await query(
    `UPDATE lead_steps
        SET estado = COALESCE($2, estado),
            fecha_prevista = COALESCE($3::date, fecha_prevista),
            nota = COALESCE($4, nota),
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, lead_id, clave, orden, fecha_prevista, estado, nota`,
    [id, estado || null, fecha_prevista || null, nota || null]
  );
  return rows[0] || null;
}
