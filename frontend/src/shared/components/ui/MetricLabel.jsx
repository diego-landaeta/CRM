import { Info } from '@phosphor-icons/react';

/**
 * Etiqueta de métrica con tooltip explicativo (icono ℹ︎ al lado).
 * Usa el atributo `title` nativo del navegador — accesible y sin libs adicionales.
 *
 * Glosario centralizado: añade aquí cualquier sigla técnica para que su explicación
 * sea consistente en toda la app.
 */
export const METRIC_GLOSSARY = {
  MRR: 'Monthly Recurring Revenue: ingresos recurrentes mensuales normalizados (suscripciones anuales / 12).',
  ARR: 'Annual Recurring Revenue: MRR × 12.',
  CTR: 'Click-Through Rate: clics / impresiones × 100. Mide qué tan llamativo es el anuncio.',
  CPC: 'Cost Per Click: gasto / clics. Coste por cada clic recibido.',
  CPM: 'Cost Per Mille: gasto / impresiones × 1000. Coste por cada 1.000 impresiones.',
  CPL: 'Cost Per Lead: gasto / leads. Coste por cada lead capturado.',
  CPA: 'Cost Per Acquisition: gasto / conversiones. Coste por cada cliente que compra.',
  ROAS: 'Return On Ad Spend: ingresos generados / gasto en ads. Mayor es mejor (>1 = rentable).',
  Churn: 'Churn Rate: porcentaje de clientes que cancelan en el periodo. Menor es mejor.',
  LTV: 'Lifetime Value: valor total que aporta un cliente durante toda su relación con la empresa.',
  ARPU: 'Average Revenue Per User: ingresos / usuarios activos en el periodo.',
  GSC: 'Google Search Console: herramienta de Google que mide el tráfico orgánico desde búsquedas.',
  UTM: 'Urchin Tracking Module: parámetros en la URL que identifican origen/medio/campaña del visitante.',
  SEO: 'Search Engine Optimization: posicionamiento en buscadores. Tráfico orgánico (no pagado).',
  SaaS: 'Software as a Service: software por suscripción mensual/anual.',
};

export default function MetricLabel({ children, hint, term, className = '', iconSize = 11 }) {
  // Si pasas `term`, lo busca en el glosario.
  const tooltip = hint || (term && METRIC_GLOSSARY[term]) || '';
  if (!tooltip) {
    return <span className={className}>{children}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span>{children}</span>
      <span
        role="img"
        aria-label={`Definición: ${tooltip}`}
        title={tooltip}
        tabIndex={0}
        className="text-muted-foreground/50 hover:text-foreground transition-colors cursor-help focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
      >
        <Info size={iconSize} weight="regular" />
      </span>
    </span>
  );
}
