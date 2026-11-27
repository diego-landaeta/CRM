import { query } from '../../shared/config/db.js';
import {
  activa as activaFactura, diasDePlazo, enviarPdf, revisionAdmin,
} from '../factura-automatica/factura-automatica.config.js';
import { leerConfig as leerConfigAuditoria } from '../facturacion-auditoria/facturacion-auditoria.config.js';

/*
  Ajustes de facturación automática desde la pantalla (#1202).

  Cada campo: lo guardado en la pantalla manda; si no hay nada guardado, el
  .env (o el valor de serie si el .env tampoco lo trae). `origen` dice cuál de
  los tres está mandando ahora mismo, para que la pantalla lo enseñe.
*/

const puesto = (v) => v !== null && v !== undefined;

function campo(guardado, deServidor, deSerie) {
  if (puesto(guardado)) return { valor: guardado, origen: 'pantalla' };
  if (puesto(deServidor)) return { valor: deServidor, origen: 'servidor' };
  return { valor: deSerie, origen: 'serie' };
}

async function filaGlobal() {
  const { rows } = await query('SELECT * FROM ajustes_facturacion WHERE id = 1');
  return rows[0] || null;
}

const auditoriaEstadoDe = (activaCol, pausarCol) => {
  if (!activaCol) return 'apagada';
  return pausarCol === false ? 'aviso' : 'pausa';
};

export async function verGlobal() {
  const fila = await filaGlobal();
  const envAuditoria = leerConfigAuditoria();

  const auditoriaGuardada = puesto(fila?.auditoria_activa)
    ? auditoriaEstadoDe(fila.auditoria_activa, fila.auditoria_pausar)
    : null;

  return {
    dias: campo(
      fila?.dias ?? null,
      process.env.FACTURA_AUTOMATICA_DIAS !== undefined ? diasDePlazo() : null,
      7
    ),
    enviarPdf: campo(
      fila?.enviar_pdf ?? null,
      process.env.FACTURA_AUTOMATICA_ENVIAR_PDF !== undefined ? enviarPdf() : null,
      true
    ),
    revisionAdmin: campo(
      fila?.revision_admin ?? null,
      process.env.FACTURA_ENVIO_REVISION_ADMIN !== undefined ? revisionAdmin() : null,
      false
    ),
    auditoriaEstado: campo(
      auditoriaGuardada,
      process.env.FACTURACION_AUDITORIA_ACTIVA !== undefined ? auditoriaEstadoDe(envAuditoria.activa, envAuditoria.pausar) : null,
      'apagada'
    ),
    auditoriaCorreos: campo(
      fila?.auditoria_correos ? fila.auditoria_correos.split(',').map((s) => s.trim()).filter(Boolean) : null,
      process.env.FACTURACION_AUDITORIA_CORREOS ? envAuditoria.correos : null,
      []
    ),
    auditoriaDesde: campo(
      fila?.auditoria_desde ? new Date(fila.auditoria_desde).toISOString().slice(0, 10) : null,
      process.env.FACTURACION_AUDITORIA_DESDE || null,
      null
    ),
    actualizado: fila ? { en: fila.updated_at, por: fila.updated_by } : null,
  };
}

export async function guardarGlobal(datos, userId) {
  const activa = datos.auditoriaEstado === null ? null : datos.auditoriaEstado !== 'apagada';
  const pausar = datos.auditoriaEstado === null ? null : datos.auditoriaEstado === 'pausa';
  await query(
    `INSERT INTO ajustes_facturacion
       (id, dias, enviar_pdf, revision_admin, auditoria_activa, auditoria_pausar, auditoria_correos, auditoria_desde, updated_by, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (id) DO UPDATE SET
       dias = EXCLUDED.dias, enviar_pdf = EXCLUDED.enviar_pdf, revision_admin = EXCLUDED.revision_admin,
       auditoria_activa = EXCLUDED.auditoria_activa, auditoria_pausar = EXCLUDED.auditoria_pausar,
       auditoria_correos = EXCLUDED.auditoria_correos, auditoria_desde = EXCLUDED.auditoria_desde,
       updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [
      datos.dias, datos.enviarPdf, datos.revisionAdmin, activa, pausar,
      datos.auditoriaCorreos.length ? datos.auditoriaCorreos.join(',') : null,
      datos.auditoriaDesde, userId,
    ]
  );
  return verGlobal();
}

export async function verCampus(projectIds = null) {
  const { rows } = await query(
    `SELECT pr.id AS project_id, pr.nombre AS campus, fac.activo, fac.updated_at
       FROM projects pr LEFT JOIN factura_automatica_campus fac ON fac.project_id = pr.id
      WHERE pr.active AND COALESCE(pr.type::text, 'crm') <> 'ia'
        AND ($1::int[] IS NULL OR pr.id = ANY($1::int[]))
      ORDER BY pr.nombre`,
    [projectIds]
  );
  const envActiva = activaFactura();
  const envPuesto = process.env.FACTURA_AUTOMATICA_ACTIVA !== undefined;
  return rows.map((r) => {
    const { valor, origen } = campo(r.activo, envPuesto ? envActiva : null, false);
    return { project_id: r.project_id, campus: r.campus, activo: valor, origen };
  });
}

export async function guardarCampus(projectId, activo, userId) {
  await query(
    `INSERT INTO factura_automatica_campus (project_id, activo, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (project_id) DO UPDATE SET activo = EXCLUDED.activo, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [projectId, activo, userId]
  );
}

