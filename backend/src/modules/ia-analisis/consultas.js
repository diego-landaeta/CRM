import * as reportes from '../reports/report.model.js';

/**
 * Lo unico que la IA puede preguntarle a la base (#30, primera subfase).
 *
 * «Capa de solo lectura: consultas preparadas y tiempo maximo. La IA no ejecuta
 * lo que se le ocurra contra la base de produccion.»
 *
 * NO HAY SQL AQUI, Y ES EL PUNTO ENTERO
 *
 * La tentacion evidente es dejar que el modelo escriba la consulta y ejecutarla
 * con un usuario de solo lectura. No se hace, por dos motivos:
 *
 *  1. Solo lectura no protege de un `SELECT` que cruce seis tablas sin indice y
 *     tenga la base ocupada un minuto. Leer tambien tumba.
 *  2. Y sobre todo: los numeros del CRM ya estan cuadrados en `report.model.js`
 *     —el reporte semanal se hizo sin escribir NI UNA consulta nueva por eso
 *     mismo—. Una consulta inventada por el modelo daria otro numero que el que
 *     enseña la pantalla, y entonces uno de los dos miente sin que nadie sepa
 *     cual.
 *
 * Asi que la IA elige de una lista y pasa parametros. Nada mas.
 *
 * LA REGLA DEL DINERO SE HEREDA
 *
 * Lo cobrado sale de `conversion_payments`, nunca de `conversions.importe_pagado`
 * —ese campo declara de mas: 209.930 € en ISEIE—. No hace falta repetirlo aqui
 * porque estas funciones son las mismas que usan las pantallas y el reporte
 * semanal.
 */

/** Ninguna consulta puede tener la base ocupada mas de esto. */
export const TOPE_MS = 8000;

/**
 * El catalogo. Cada entrada dice que contesta y que parametros admite, en un
 * texto que se le puede dar al modelo tal cual.
 */
export const CONSULTAS = {
  resumen_general: {
    descripcion: 'Resumen de un periodo: leads por estado y por canal, conversiones y dinero cobrado.',
    parametros: ['projectId', 'from', 'to', 'asesoraId'],
    ejecutar: (p) => reportes.overview(p),
  },
  resumen_mensual: {
    descripcion: 'Lo mismo pero desglosado mes a mes, para comparar un periodo con otro.',
    parametros: ['projectId', 'from', 'to', 'asesoraId'],
    ejecutar: (p) => reportes.resumenMensual(p),
  },
  ventas_por_asesora: {
    descripcion: 'Cada venta con su asesora, su fecha y su importe. Para ver quien cerro que.',
    parametros: ['projectId', 'from', 'to', 'asesoraId'],
    ejecutar: (p) => reportes.ventasPorAsesoraReport(p),
  },
};

export const NOMBRES = Object.keys(CONSULTAS);

/**
 * El catalogo en texto, para meterlo en la instruccion del modelo.
 *
 * Se genera del mismo objeto que se ejecuta: una lista escrita a mano se
 * quedaria vieja al añadir una consulta, y el modelo pediria cosas que ya no
 * existen o no sabria las que si.
 */
export const catalogoEnTexto = () =>
  NOMBRES.map((n) => `- ${n}: ${CONSULTAS[n].descripcion} (parámetros: ${CONSULTAS[n].parametros.join(', ')})`)
    .join('\n');

/** Una fecha de las que acepta Postgres, y no cualquier cosa. */
const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Limpia los parametros: solo los que la consulta admite, y con el tipo bueno.
 *
 * Lo que llega aqui lo ha escrito un modelo de lenguaje, asi que se trata como
 * lo que es: entrada de fuera. Un `projectId` que no sea un numero o un `from`
 * con formato raro no se corrigen — se descartan, y la consulta se hace sin
 * ellos. Adivinar que queria decir es como se cuelan los numeros que no son.
 */
export function limpiarParametros(nombre, dados = {}) {
  const admite = CONSULTAS[nombre]?.parametros || [];
  const limpio = {};
  for (const clave of admite) {
    const v = dados[clave];
    if (v == null || v === '') continue;
    if (clave === 'projectId' || clave === 'asesoraId') {
      const n = parseInt(v, 10);
      if (Number.isInteger(n) && n > 0) limpio[clave] = n;
    } else if (clave === 'from' || clave === 'to') {
      if (esFecha(v)) limpio[clave] = v;
    }
  }
  return limpio;
}

/**
 * Ejecuta una consulta del catalogo, con tope de tiempo.
 *
 * Devuelve `{ nombre, parametros, datos }` — con los parametros DE VERDAD
 * usados, no los que pidio el modelo. Esa diferencia es la que permite
 * comprobar la respuesta a mano: si contesto «julio» pero se ejecuto sin fechas,
 * se ve.
 */
export async function ejecutar(nombre, parametros = {}) {
  const consulta = CONSULTAS[nombre];
  if (!consulta) {
    // Se dice QUE se pidio y que hay: si el modelo se inventa un nombre, el
    // registro tiene que servir para saberlo sin adivinar.
    const err = new Error(`Consulta desconocida: ${nombre}. Disponibles: ${NOMBRES.join(', ')}`);
    err.code = 'CONSULTA_DESCONOCIDA';
    throw err;
  }

  const limpios = limpiarParametros(nombre, parametros);

  // El tope va aqui y no en la consulta: `statement_timeout` de Postgres corta
  // la consulta pero no libera al que espera si el pool esta lleno, y lo que se
  // protege es el CRM entero, no solo la base.
  let reloj;
  const conTope = new Promise((_, rechazar) => {
    reloj = setTimeout(() => {
      const err = new Error(`La consulta «${nombre}» tardo mas de ${TOPE_MS / 1000} segundos y se corto.`);
      err.code = 'CONSULTA_LENTA';
      rechazar(err);
    }, TOPE_MS);
  });

  try {
    const datos = await Promise.race([consulta.ejecutar(limpios), conTope]);
    return { nombre, parametros: limpios, datos };
  } finally {
    clearTimeout(reloj);
  }
}
