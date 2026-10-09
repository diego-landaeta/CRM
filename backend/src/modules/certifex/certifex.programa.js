import { query } from '../../shared/config/db.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * El programa oficial de la formación que compró el alumno, para el diploma (#272).
 *
 * Moodle sabe qué actividades hizo; el CRM sabe QUÉ FORMACIÓN VENDIÓ, con sus horas
 * (`products.horas`, texto tipo «1.500 horas») y su temario (`product_modules`). Al
 * emitir, el CRM manda ese programa y Certifex lo imprime en lugar de lo de Moodle.
 *
 * Cómo se encuentra la formación, sin adivinar:
 *   1. El campus de Certifex (ISEIE, PSIKO…) se casa con UN proyecto del CRM por su
 *      nombre o su slug (PSIKO → «Psiko Aprende»). Ninguno o varios: sin programa.
 *   2. Las ventas de ese proyecto a una ficha con el correo del alumno, enlazadas a un
 *      producto del catálogo.
 *   3. De esas, la que se llama como el curso de Moodle. Exactamente una: su programa.
 *      Ninguna o varias: sin programa, y se dice por qué.
 * Sin programa, Certifex usa lo de Moodle; el panel lo enseña antes de aprobar.
 */

/** Mismos límites que valida Certifex (validarProgramaCrm): pasarse anula la tanda entera. */
const MAX_HORAS = 5000;
const MAX_MODULOS = 100;
const MAX_HORAS_MODULO = 2000;

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const compacto = (s) => norm(s).replace(/ /g, '');

/** «1.500 horas» → 1500; «120 h» → 120. Fuera de 1..5000, o sin número: null. */
export function horasDeTexto(t) {
  if (t == null) return null;
  // `\s` ya incluye los espacios duros (U+00A0, U+202F) de «1 500».
  const s = String(t).replace(/(\d)[.\s](?=\d{3}(?!\d))/g, '$1');
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isInteger(n) && n >= 1 && n <= MAX_HORAS ? n : null;
}

/** ¿El producto vendido es este curso? Mismo nombre, o uno contiene al otro (largo). */
export function encaja(producto, curso) {
  const a = norm(producto);
  const b = norm(curso);
  if (!a || !b) return false;
  if (a === b) return true;
  return (a.length >= 8 && ` ${b} `.includes(` ${a} `)) || (b.length >= 8 && ` ${a} `.includes(` ${b} `));
}

/** Los proyectos del CRM (sin los de prueba) que corresponden a un campus de Certifex. */
function proyectosDeCentro(centro, proyectos) {
  const c = compacto(centro);
  if (!c) return [];
  return proyectos.filter((p) => {
    const n = compacto(p.nombre);
    const s = compacto(p.slug);
    return n === c || s === c || n.startsWith(c) || s.startsWith(c);
  });
}

function programaDe(producto, modulos) {
  const horas = horasDeTexto(producto.horas);
  const lista = modulos
    .map((m) => {
      const titulo = String(m.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      const h = Number(m.horas);
      return titulo ? { titulo, ...(m.horas != null && Number.isInteger(h) && h >= 0 && h <= MAX_HORAS_MODULO ? { horas: h } : {}) } : null;
    })
    .filter(Boolean)
    .slice(0, MAX_MODULOS);
  if (horas == null && lista.length === 0) return null;
  return { ...(horas != null ? { horas } : {}), modulos: lista };
}

/**
 * Para cada candidato `{ matriculaId, centro, email, curso }` (curso = nombre en Moodle),
 * el programa a imprimir: `{ programa, formacion, motivo }`. `programa` null = se usará
 * lo de Moodle, y `motivo` dice por qué. Nunca lanza: si el CRM no contesta, sin programa.
 */
export async function programasPara(candidatos) {
  const out = new Map();
  if (!candidatos.length) return out;
  try {
    const correos = [...new Set(candidatos.map((c) => String(c.email || '').trim().toLowerCase()).filter(Boolean))];
    const [{ rows: proyectos }, { rows: ventas }] = await Promise.all([
      query(`SELECT id, nombre, slug FROM projects WHERE NOT COALESCE(es_prueba, false)`),
      correos.length
        ? query(
          `SELECT lower(l.email) AS email, c.project_id, c.producto_contratado AS vendido,
                  p.id AS product_id, p.nombre, p.horas, p.num_modulos
             FROM conversions c
             JOIN leads l ON l.id = c.lead_id
             LEFT JOIN products p ON p.id = c.producto_contratado_id
            WHERE l.deleted_at IS NULL AND lower(l.email) = ANY($1::text[])`,
          [correos],
        )
        : { rows: [] },
    ]);
    const ids = [...new Set(ventas.map((v) => v.product_id).filter(Boolean))];
    const { rows: mods } = ids.length
      ? await query(
        `SELECT product_id, titulo, horas FROM product_modules
          WHERE product_id = ANY($1::int[]) ORDER BY product_id, orden, id`,
        [ids],
      )
      : { rows: [] };
    const modsDe = new Map();
    for (const m of mods) {
      if (!modsDe.has(m.product_id)) modsDe.set(m.product_id, []);
      modsDe.get(m.product_id).push(m);
    }

    for (const c of candidatos) {
      const sin = (motivo, formacion = null) => out.set(c.matriculaId, { programa: null, formacion, motivo });
      const email = String(c.email || '').trim().toLowerCase();
      if (!email) { sin('Sin correo: no se puede buscar su venta en el CRM.'); continue; }
      const proys = proyectosDeCentro(c.centro, proyectos);
      if (proys.length === 0) { sin(`Ningún proyecto del CRM corresponde al campus ${c.centro}.`); continue; }
      if (proys.length > 1) { sin(`Varios proyectos del CRM podrían ser el campus ${c.centro} (${proys.map((p) => p.nombre).join(', ')}).`); continue; }
      const proyecto = proys[0];
      const suyas = ventas.filter((v) => v.email === email && v.project_id === proyecto.id);
      if (suyas.length === 0) { sin(`No tiene ninguna venta en ${proyecto.nombre}.`); continue; }
      const conProducto = [...new Map(suyas.filter((v) => v.product_id).map((v) => [v.product_id, v])).values()];
      if (conProducto.length === 0) { sin('Su venta no está enlazada a una formación del catálogo.'); continue; }
      const encajan = conProducto.filter((v) => encaja(v.nombre, c.curso));
      if (encajan.length === 0) {
        sin(`Ninguna formación vendida coincide con el curso «${c.curso}» (vendida: ${conProducto.map((v) => v.nombre).join(', ')}).`);
        continue;
      }
      if (encajan.length > 1) { sin(`Varias formaciones vendidas encajan con el curso: ${encajan.map((v) => v.nombre).join(', ')}.`); continue; }
      const p = encajan[0];
      const formacion = { id: p.product_id, nombre: p.nombre, numModulos: p.num_modulos ?? null };
      const programa = programaDe(p, modsDe.get(p.product_id) ?? []);
      if (!programa) { sin(`«${p.nombre}» no tiene horas ni módulos en el CRM.`, formacion); continue; }
      out.set(c.matriculaId, { programa, formacion, motivo: null });
    }
  } catch (e) {
    logger.warn({ err: e.message }, 'Certifex: no se pudo buscar el programa en el CRM');
    for (const c of candidatos) if (!out.has(c.matriculaId)) out.set(c.matriculaId, { programa: null, formacion: null, motivo: 'No se pudo consultar el CRM.' });
  }
  return out;
}

/** Lo que hace falta de una fila de Certifex para buscar su programa. */
export const datosDeCandidato = (c) => ({
  matriculaId: c.matriculaId, centro: c.centro, email: c.titular?.email ?? null, curso: c.curso?.nombre ?? '',
});
