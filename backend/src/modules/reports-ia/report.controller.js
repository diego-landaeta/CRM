import * as model from './report.model.js';
import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import { getDecryptedValue } from '../credentials/credentials.model.js';
import { logger } from '../../shared/utils/logger.js';

async function getAnthropicKey(projectId = null) {
  try {
    if (projectId) {
      const v = await getDecryptedValue('anthropic', projectId);
      if (v) return v;
    }
    const g = await getDecryptedValue('anthropic', null);
    if (g) return g;
  } catch {}
  return process.env.ANTHROPIC_API_KEY || null;
}

async function callClaude(apiKey, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const j = await res.json();
  return j.content?.[0]?.text || '';
}

async function gatherData(projectId, periodo) {
  const [year, month] = periodo.split('-').map(Number);
  const desde = `${periodo}-01`;
  const hasta = new Date(year, month, 0).toISOString().slice(0, 10);
  const { rows: leadsRows } = await query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE status='convertido') as convertidos
       FROM leads WHERE project_id=$1 AND fecha_solicitud BETWEEN $2 AND $3`,
    [projectId, desde, hasta]);
  const { rows: convRows } = await query(
    `SELECT COUNT(*) as total, COALESCE(SUM(importe_total),0) as facturado, COALESCE(SUM(importe_pagado),0) as cobrado
       FROM conversions WHERE project_id=$1 AND fecha_conversion BETWEEN $2 AND $3`,
    [projectId, desde, hasta]);
  const { rows: canalRows } = await query(
    `SELECT COALESCE(lu.canal_detectado, 'directo') as canal, COUNT(*) as c
       FROM leads l LEFT JOIN lead_utms lu ON lu.lead_id = l.id
      WHERE l.project_id=$1 AND l.fecha_solicitud BETWEEN $2 AND $3
      GROUP BY canal ORDER BY c DESC`, [projectId, desde, hasta]);
  const { rows: pjRows } = await query(`SELECT nombre, type FROM projects WHERE id = $1`, [projectId]);
  return {
    proyecto: pjRows[0] || {},
    periodo,
    leads: { total: parseInt(leadsRows[0].total), convertidos: parseInt(leadsRows[0].convertidos) },
    conversiones: {
      total: parseInt(convRows[0].total),
      facturado: Number(convRows[0].facturado),
      cobrado: Number(convRows[0].cobrado),
    },
    canales: canalRows.map(r => ({ canal: r.canal, count: parseInt(r.c) })),
  };
}

function buildPrompt(data) {
  return `Eres un analista de marketing senior. Genera un reporte mensual ejecutivo en MARKDOWN para el proyecto "${data.proyecto.nombre}" del periodo ${data.periodo}.

Datos del periodo:
- Leads recibidos: ${data.leads.total}, convertidos: ${data.leads.convertidos}
- Conversiones: ${data.conversiones.total}, facturado: €${data.conversiones.facturado.toFixed(2)}, cobrado: €${data.conversiones.cobrado.toFixed(2)}
- Canales: ${data.canales.map(c => `${c.canal}=${c.count}`).join(', ')}

Estructura del markdown:
# Reporte Mensual ${data.periodo}
## Resumen Ejecutivo
## Captacion de Leads
## Conversiones e Ingresos
## Analisis por Canal
## Recomendaciones

Se concreto, usa numeros, propon acciones especificas. No mas de 800 palabras.`;
}

function fallbackReport(data) {
  return `# Reporte Mensual ${data.periodo}

> ⚠️ **Generado sin Claude API** — falta configurar \`ANTHROPIC_API_KEY\`. Este es un resumen basado solo en datos.

## Resumen Ejecutivo
Periodo ${data.periodo}, proyecto **${data.proyecto.nombre}**.

## Captacion de Leads
- Leads totales: ${data.leads.total}
- Convertidos: ${data.leads.convertidos}
- Tasa conversion: ${data.leads.total > 0 ? ((data.leads.convertidos / data.leads.total) * 100).toFixed(1) : 0}%

## Conversiones e Ingresos
- Conversiones: ${data.conversiones.total}
- Facturado: €${data.conversiones.facturado.toFixed(2)}
- Cobrado: €${data.conversiones.cobrado.toFixed(2)}

## Analisis por Canal
${data.canales.map(c => `- **${c.canal}**: ${c.count} leads`).join('\n')}

## Recomendaciones
Configura tu Anthropic API Key en Settings > APIs para tener un analisis con IA.
`;
}

export async function list(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (!projectId) throw new AppError('projectId requerido', 400, 'PROJECT_REQUIRED');
    res.json({ success: true, data: await model.listByProject(projectId) });
  } catch (err) { next(err); }
}

export async function getDetail(req, res, next) {
  try {
    const r = await model.findById(req.params.id);
    if (!r) throw new AppError('Reporte no encontrado', 404, 'NOT_FOUND');
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
}

export async function generate(req, res, next) {
  try {
    const projectId = parseInt(req.params.projectId);
    if (!projectId) throw new AppError('projectId requerido', 400, 'PROJECT_REQUIRED');
    const periodo = (req.body?.periodo) || (() => {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    const existing = await model.findByPeriodo(projectId, periodo);
    if (existing && !req.body?.force) {
      return res.json({ success: true, data: existing, cached: true });
    }

    const data = await gatherData(projectId, periodo);
    const apiKey = await getAnthropicKey(projectId);
    let content; let warning = null;
    if (apiKey) {
      try { content = await callClaude(apiKey, buildPrompt(data)); }
      catch (err) {
        logger.warn({ err: err.message }, 'Claude failed, fallback');
        content = fallbackReport(data);
        warning = `Claude no respondio: ${err.message?.slice(0, 200)}. Reporte basico.`;
      }
    } else {
      content = fallbackReport(data);
      warning = 'ANTHROPIC_API_KEY no configurada. Configura en Settings > APIs para reportes con IA.';
    }
    const saved = await model.upsert({
      project_id: projectId,
      periodo,
      content,
      metadata: {
        leadsAnalizados: data.leads.total,
        conversionesAnalizadas: data.conversiones.total,
        facturacionTotal: data.conversiones.facturado,
        fuentesDatos: ['CRM'],
      },
      generated_by: req.user.id,
    });
    res.status(201).json({ success: true, data: { ...saved, warning } });
  } catch (err) { next(err); }
}

// PDF: server-side mejor con puppeteer; aqui devolvemos el markdown crudo
// y el frontend ya genera PDF con jsPDF.
export async function exportPdf(req, res, next) {
  try {
    const r = await model.findById(req.params.id);
    if (!r) throw new AppError('Reporte no encontrado', 404, 'NOT_FOUND');
    res.json({
      success: true,
      data: {
        message: 'PDF server-side pendiente. Frontend ya genera PDF con jsPDF.',
        report: r,
      },
    });
  } catch (err) { next(err); }
}
