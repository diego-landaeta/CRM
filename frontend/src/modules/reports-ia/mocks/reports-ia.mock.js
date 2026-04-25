// Mock data CRM-113 — reportes IA mensuales en markdown

const PROJECT_NAMES = { 1: 'Psiko Aprende', 2: 'ISEIH', 3: 'Fono Aprende', 4: 'Psicologo IA', 5: 'Nutricionista IA', 6: 'Tarot IA' };

function buildSampleMarkdown(projectName, periodo) {
  const [year, month] = periodo.split('-');
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return `# Reporte Mensual — ${projectName}

**Periodo:** ${monthName}
**Generado:** ${new Date().toLocaleString('es-ES')}

---

## Resumen Ejecutivo

Durante ${monthName}, ${projectName} registro **68 leads nuevos** (+12% vs mes anterior) con una **tasa de conversion del 17.6%**. Las campañas de Meta Ads continuaron siendo el canal mas rentable con un **CPA de 88€**, mientras que Google Ads mostro signos de saturacion (CPA subio a 132€). El trafico organico crecio un **9.2%**, impulsado por nuevas keywords transaccionales.

## Captacion de leads

| Canal | Leads | Conversiones | Tasa | CPA |
|-------|------:|-------------:|-----:|----:|
| Meta Ads | 28 | 6 | 21.4% | 88€ |
| Google Ads | 18 | 3 | 16.7% | 132€ |
| Organico (SEO) | 14 | 2 | 14.3% | — |
| Referido | 5 | 1 | 20.0% | — |
| Directo | 3 | 0 | 0.0% | — |

**Insights:**
- Meta Ads sigue liderando en volumen y eficiencia.
- Google Ads necesita revision: el CPA aumento un **48%** vs mes anterior por subida de competencia en Search.
- El organico crece pero la tasa de conversion es menor — keywords mas informativas que transaccionales.

## Pipeline de leads

- **Nuevos:** 18 (26%)
- **Por contactar:** 12 (18%)
- **Contactado:** 15 (22%)
- **En seguimiento:** 11 (16%)
- **Convertidos:** 12 (18%)
- **No interesado:** 0 (0%)

## Negocio

- **Facturacion total:** 30.000 €
- **Cobrado:** 24.500 €
- **Por cobrar:** 5.500 €
- **Producto top:** Master Forensia (8 ventas, 18.400€)
- **Comisiones generadas:** 2.400 €

## Trafico organico (Google Search Console)

- **Clicks:** 4.120 (+9.2% vs mes anterior)
- **Impresiones:** 98.400 (+11.8%)
- **CTR medio:** 4.19%
- **Posicion media:** 9.8 (mejora 0.4 posiciones)

**Top 3 keywords:**
1. \`logopedia infantil online\` — 720 clicks, posicion 4.5
2. \`master logopedia\` — 440 clicks, posicion 4.0
3. \`curso logopedia adultos\` — 320 clicks, posicion 7.2

## Recomendaciones

1. **Reducir gasto en Google Ads** un 15% temporalmente y reasignar a Meta Lookalike de convertidos. Probar 2 semanas y revisar.
2. **Crear contenido transaccional** para las top keywords organicas — ahora atraen trafico pero no convierten.
3. **Activar campaña de retargeting** sobre los 11 leads "en seguimiento" — son los mas propensos a cerrar.
4. **Auditar reglas de comisiones** — revision de Q2 cerca, asegurar que el % por gestor sigue siendo competitivo.

---

> Reporte generado por **Claude AI** analizando datos del CRM, Meta Marketing API, Google Ads API y Google Search Console del periodo ${monthName}.
`;
}

const SAMPLES = (() => {
  const map = new Map();
  // Generar reportes mensuales de los ultimos 6 meses para todos los proyectos
  for (const projectId of [1, 2, 3, 4, 5, 6]) {
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - 1 - i); // mes anterior y atras
      const periodo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const id = `rep_${projectId}_${periodo}`;
      const projectName = PROJECT_NAMES[projectId] || 'Proyecto';
      const createdAt = new Date(d.getFullYear(), d.getMonth() + 1, 1, 8, 0, 0);
      map.set(id, {
        id,
        projectId,
        projectName,
        periodo,
        content: buildSampleMarkdown(projectName, periodo),
        metadata: {
          leadsAnalizados: 60 + Math.round(Math.random() * 30),
          conversionesAnalizadas: 8 + Math.round(Math.random() * 8),
          facturacionTotal: 18000 + Math.round(Math.random() * 22000),
          fuentesDatos: ['crm', 'meta_ads', 'google_ads', 'gsc'],
        },
        generadoPor: { id: 1, nombre: 'Claude AI · auto' },
        createdAt: createdAt.toISOString(),
        pdfUrl: null,
        pdfGeneratedAt: null,
      });
    }
  }
  return map;
})();

export function reportsListMock(projectId, params = {}) {
  let arr = [...SAMPLES.values()].filter(r => r.projectId === Number(projectId));
  if (params.periodo) arr = arr.filter(r => r.periodo === params.periodo);
  return arr
    .sort((a, b) => b.periodo.localeCompare(a.periodo))
    .map(({ content, ...rest }) => rest); // listado sin content
}

export function reportDetailMock(id) {
  return SAMPLES.get(id) || null;
}

export function generateReportMock(projectId, periodo) {
  const d = periodo ? new Date(periodo + '-01') : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const periodoStr = periodo || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const id = `rep_${projectId}_${periodoStr}`;
  const projectName = PROJECT_NAMES[projectId] || 'Proyecto';
  const report = {
    id,
    projectId,
    projectName,
    periodo: periodoStr,
    content: buildSampleMarkdown(projectName, periodoStr),
    metadata: {
      leadsAnalizados: 68,
      conversionesAnalizadas: 12,
      facturacionTotal: 30000,
      fuentesDatos: ['crm', 'meta_ads', 'google_ads', 'gsc'],
    },
    generadoPor: { id: 1, nombre: 'Manuel Casas' },
    createdAt: new Date().toISOString(),
  };
  SAMPLES.set(id, report);
  return report;
}
