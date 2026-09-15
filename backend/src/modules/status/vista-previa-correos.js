/**
 * Ver los correos del CRM sin mandar ninguno. Ultima parte de la tarea #83.
 *
 * El ticket lo pide asi: «que no haya que mandarse correos a uno mismo para ver
 * si quedo bien». Hasta hoy, comprobar un cambio en un aviso exigia esperar a
 * que saltara su tarea —o forzarla— y mirar el buzon.
 *
 * La regla de este fichero: **NO se copia ni un trozo de HTML.** Cada vista
 * llama a la MISMA funcion que arma el correo de verdad, importada de su
 * scheduler. Una vista previa que reimplementa la plantilla deja de parecerse
 * al correo en cuanto alguien toca uno de los dos, y entonces miente — que es
 * peor que no tenerla.
 *
 * Los datos son de mentira y estan aqui a proposito: asi la vista no necesita
 * que existan leads, ni ventas, ni una semana con movimiento.
 */

import { _internos as sinTocar } from '../../jobs/leadSinTocarScheduler.js';
import { _internos as diario } from '../../jobs/resumenDiarioScheduler.js';
import { cuerpo as semanal } from '../../jobs/reporteSemanalScheduler.js';
import { _internos as tutor } from '../../jobs/avisoTutorScheduler.js';
import { T, esc } from '../../shared/services/email-plantilla.service.js';

const haceMinutos = (m) => new Date(Date.now() - m * 60000);

/**
 * El catalogo. Añadir un aviso nuevo es añadir una linea: cuando se escriba el
 * de la #82, va aqui y ya se ve.
 */
export const AVISOS = {
  'sin-contactar': {
    titulo: 'Prospecto sin contactar',
    cuando: 'A los 30 minutos, a su gestora',
    tarea: '#28',
    arma: () => sinTocar.cuerpo({
      id: 4821,
      nombre: 'María Muñoz Alcántara',
      email: 'maria.munoz@ejemplo.com',
      telefono: '+34 600 000 001',
      gestora: 'Ana Comercial',
      proyecto: 'ISEIH',
      proyecto_slug: 'iseih',
      status: 'por_contactar',
      fecha_solicitud: haceMinutos(45),
    }),
  },

  'resumen-del-dia': {
    titulo: 'Resumen del día · la gestora',
    cuando: 'Al cerrar la jornada, a su gestora',
    tarea: '#28 · #81',
    arma: () => diario.textoResumen({ nombre: 'Ana Comercial' }, {
      entraron: 7, contactos: 12, convertidos: 2, sin_tocar: 14,
      ayer: { entraron: 5, contactos: 15, convertidos: 3 },
      lista: [
        { id: 4821, nombre: 'María Muñoz Alcántara', telefono: '+34600000001',
          producto_interes: 'Máster en Psicología Clínica', origen: 'Meta Ads',
          status: 'por_contactar', entro: haceMinutos(60 * 26) },
        { id: 4822, nombre: 'Jorge Iriarte', telefono: '+525512345678',
          producto_interes: 'Experto en Adicciones', origen: 'Google Ads',
          status: 'por_contactar', entro: haceMinutos(60 * 9) },
        { id: 4823, nombre: 'Lucía Fernández', telefono: '+5491112345678',
          producto_interes: 'Curso de Terapia Familiar', origen: 'Orgánico',
          status: 'nuevo', entro: haceMinutos(180) },
        { id: 4824, nombre: 'Diego Ramírez', telefono: '+34611222333',
          producto_interes: 'Máster en Neuropsicología', origen: 'ChatGPT',
          status: 'nuevo', entro: haceMinutos(50) },
      ],
      dias7: [
        { dia: '2026-08-25', entraron: 4 }, { dia: '2026-08-26', entraron: 9 },
        { dia: '2026-08-27', entraron: 6 }, { dia: '2026-08-28', entraron: 12 },
        { dia: '2026-08-29', entraron: 3 }, { dia: '2026-08-30', entraron: 1 },
        { dia: '2026-08-31', entraron: 7 },
      ],
      canales: [
        { canal: 'Meta Ads', total: 18 }, { canal: 'Google Ads', total: 11 },
        { canal: 'Orgánico', total: 7 }, { canal: 'ChatGPT', total: 4 },
      ],
    }),
  },

  // El de administracion es OTRO correo, no el mismo con otro nombre: la #81
  // señala que hoy al administrador le llega «no te queda ninguno sin
  // contactar», que ni siquiera es asunto suyo.
  'resumen-del-dia-admin': {
    titulo: 'Resumen del día · administración',
    cuando: 'Al cerrar la jornada, a administración',
    tarea: '#81',
    arma: () => diario.textoResumenAdmin({ nombre: 'Admin Principal' }, {
      equipo: [
        { id: 1, nombre: 'Ana Comercial',  entraron: 7, contactos: 12, convertidos: 2, sin_tocar: 14 },
        { id: 2, nombre: 'Lola Hernández', entraron: 5, contactos: 9,  convertidos: 1, sin_tocar: 3 },
        { id: 3, nombre: 'Marta Ruiz',     entraron: 4, contactos: 11, convertidos: 2, sin_tocar: 0 },
      ],
    }),
  },

  'venta-tutor': {
    titulo: 'Has vendido hoy · el tutor',
    cuando: 'Al cerrar la jornada, al tutor que haya vendido',
    tarea: '#82',
    arma: () => tutor.cuerpo(
      { nombre: 'Lola Hernández' },
      [
        { alumno: 'María Muñoz Alcántara', formacion: 'Máster en Psicología Clínica',
          cobro: '1200.00', pct: '15.00', importe: '180.00',
          cuota_numero: 1, cuotas_total: 12, estado: 'pendiente' },
        { alumno: 'Jorge Iriarte', formacion: 'Experto en Adicciones',
          cobro: '450.00', pct: '15.00', importe: '67.50',
          cuota_numero: 8, cuotas_total: 8, estado: 'pendiente' },
        { alumno: 'Lucía Fernández', formacion: 'Máster en Psicología Clínica',
          cobro: '1800.00', pct: '15.00', importe: '270.00',
          cuota_numero: null, cuotas_total: 0, estado: 'pendiente' },
      ],
      { pendiente: '1240.50', pagada: '860.00' }
    ),
  },

  'plan-de-manana': {
    titulo: 'Plan de mañana',
    cuando: 'Por la noche, a la gestora',
    tarea: '#28',
    arma: () => diario.textoPlan(
      { nombre: 'Ana Comercial' },
      { sin_tocar: 14, en_seguimiento: 23, recordatorios: 5 }
    ),
  },

  'reporte-semanal': {
    titulo: 'Reporte semanal',
    cuando: 'Los lunes a las 8, a dirección',
    tarea: '#29',
    arma: () => semanal({
      rango: { from: '2026-08-24', to: '2026-08-30' },
      ahora:  { leads: { total: 84, convertido: 11 }, conversions: { total: 11 } },
      antes:  { leads: { total: 71, convertido: 14 }, conversions: { total: 14 } },
      porAsesora: [
        { vendedora: 'Ana Comercial',   ventas: 5, cobrado: 7420.50 },
        { vendedora: 'Lola Hernández',  ventas: 4, cobrado: 5180.00 },
        { vendedora: 'Marta Ruiz',      ventas: 2, cobrado: 1990.00 },
      ],
      cobrado: 14590.50,
      cobradoAntes: 11230.00,
    }),
  },

  // Un caso que se olvida siempre y es el que mas se ve en un CRM recien
  // puesto: el dia que no ha pasado nada. Si el correo vacio queda raro, se
  // descubre aqui y no en el buzon de la gestora.
  'resumen-del-dia-vacio': {
    titulo: 'Resumen del día · sin actividad',
    cuando: 'El mismo aviso, un día en blanco',
    tarea: '#28',
    arma: () => diario.textoResumen(
      { nombre: 'Ana Comercial' },
      { entraron: 0, contactos: 0, convertidos: 0, sin_tocar: 0,
        ayer: { entraron: 3, contactos: 8, convertidos: 1 }, lista: [], dias7: [], canales: [] }
    ),
  },
};

/** Un aviso suelto, tal cual saldria del buzon. */
export function pintarUno(clave) {
  const a = AVISOS[clave];
  if (!a) return null;
  return a.arma();
}

/**
 * El indice: todos, uno debajo de otro, cada uno en su `iframe`.
 *
 * En `iframe` y no incrustado a pelo porque el correo trae su propio <html> y
 * su <body> con fondo: metidos en la misma pagina se pisarian los estilos y
 * ninguno se veria como se va a ver de verdad.
 */
export function pintarIndice() {
  const fichas = Object.entries(AVISOS).map(([clave, a]) => `
    <section>
      <header>
        <h2>${esc(a.titulo)}</h2>
        <p>${esc(a.cuando)} · tarea ${esc(a.tarea)}</p>
        <a href="?aviso=${encodeURIComponent(clave)}">Ver solo este</a>
      </header>
      <iframe src="?aviso=${encodeURIComponent(clave)}" title="${esc(a.titulo)}" loading="lazy"></iframe>
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Los correos del CRM</title>
<style>
  body { margin:0; padding:32px 16px; background:${T.suaveFondo};
         font-family:${T.fuente}; color:${T.texto}; }
  .env { max-width:680px; margin:0 auto; }
  h1 { font-size:22px; font-weight:600; margin:0 0 6px; }
  .pie { font-size:14px; line-height:22px; color:${T.tenue}; margin:0 0 28px; }
  section { margin:0 0 28px; }
  header { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; margin:0 0 10px; }
  h2 { font-size:15px; font-weight:600; margin:0; }
  header p { font-size:13px; color:${T.tenue}; margin:0; flex:1; }
  header a { font-size:13px; color:${T.primario}; text-decoration:none; }
  iframe { width:100%; height:400px; border:1px solid ${T.borde};
           border-radius:${T.radio.xl2}; background:${T.hoja}; display:block; }
</style>
</head>
<body>
  <div class="env">
    <h1>Los correos del CRM</h1>
    <p class="pie">
      Datos de mentira. Cada uno está pintado por la misma función que arma el
      correo de verdad, así que lo que se ve aquí es lo que llega al buzón.
    </p>
    ${fichas}
  </div>
<script>
  // Cada correo mide lo que mide: con una altura fija, o se corta el largo o
  // los cortos salen flotando en medio hueco. Aqui SI se puede usar JavaScript
  // —esto es una pagina, no un correo— y el iframe es del mismo origen.
  function ajustar(marco) {
    try {
      var d = marco.contentDocument;
      if (d) marco.style.height = Math.max(240, d.body.scrollHeight + 24) + 'px';
    } catch (e) { /* si no se puede medir, se queda con la altura de partida */ }
  }
  for (const marco of document.querySelectorAll('iframe')) {
    marco.addEventListener('load', function () { ajustar(marco); });
    if (marco.contentDocument?.readyState === 'complete') ajustar(marco);
  }
</script>
</body>
</html>`;
}
