import { query } from '../../shared/config/db.js';

/**
 * Cuánto se manda por voz y cuánto escrito (#128, punto 4).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE MIDE
 *
 * Diego: «en los canales de ventas hay que diferenciar cuánto es escrito y
 * cuánto por voz». Y el documento comercial dice que el saludo del día 1
 * «funciona mejor en nota de voz: sube mucho la tasa de respuesta».
 *
 * Eso último se repite de oídas desde hace meses. O se cuenta, o seguirá
 * siendo una creencia — y las creencias sobre qué funciona son las que hacen
 * que una gestora mande cien audios y otra ninguno, sin que nadie sepa cuál
 * acierta.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO LO QUE SALE
 *
 * Se cuentan los mensajes SALIENTES. Los que entran los decide el cliente y no
 * dicen nada de cómo trabaja el equipo; mezclarlos daría un porcentaje que
 * sube cuando el prospecto manda audios, que es justo lo contrario de lo que
 * se quiere medir.
 */
export async function vozOTexto({ projectIds = null, desde = null, hasta = null }) {
  const par = [];
  let i = 1;
  const pProj = Array.isArray(projectIds) && projectIds.length
    ? `AND c.project_id = ANY($${i++}::int[])` : '';
  if (Array.isArray(projectIds) && projectIds.length) par.push(projectIds.map(Number));
  const pDesde = desde ? `AND m.ts >= $${i++}::date` : '';
  if (desde) par.push(desde);
  // `< hasta + 1 dia`: con `<=` sobre una fecha, los mensajes de ese mismo dia
  // despues de medianoche se quedan fuera y el ultimo dia sale siempre a cero.
  const pHasta = hasta ? `AND m.ts < ($${i++}::date + 1)` : '';
  if (hasta) par.push(hasta);

  const { rows } = await query(
    `SELECT u.id AS user_id,
            COALESCE(u.nombre, 'Sin asignar') AS gestora,
            count(*) FILTER (WHERE m.tipo = 'audio')::int AS voz,
            count(*) FILTER (WHERE m.tipo <> 'audio')::int AS escrito,
            count(*)::int AS total
       FROM wa_mensajes m
       JOIN wa_conversaciones c ON c.id = m.conversacion_id
       LEFT JOIN users u ON u.id = m.enviado_por
      WHERE m.direccion = 'saliente'
        ${pProj} ${pDesde} ${pHasta}
      GROUP BY u.id, u.nombre
      ORDER BY count(*) DESC`,
    par
  );

  const suma = (campo) => rows.reduce((t, r) => t + Number(r[campo] || 0), 0);
  const voz = suma('voz');
  const total = suma('total');

  return {
    porGestora: rows.map((r) => ({
      ...r,
      // El porcentaje se calcula aqui y no en la pantalla: si lo hace cada
      // pantalla, dos sitios acaban redondeando distinto sobre los mismos
      // numeros y parece que uno de los dos miente.
      pctVoz: r.total ? Math.round((r.voz / r.total) * 100) : 0,
    })),
    total: { voz, escrito: total - voz, total, pctVoz: total ? Math.round((voz / total) * 100) : 0 },
  };
}
