/**
 * Helpers de periodo para el filtro de mes/año en CommissionsPage (CRM-138).
 * Extraídos del archivo de la página para poder testearlos sin montar React.
 */

export function monthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export function isInMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

/**
 * Convierte una lista de comisiones a CSV. Toma un periodo (label) que
 * aparece como cabecera del CSV y se usa también para componer el filename.
 * Devuelve { csv, filename }.
 */
export function buildCommissionsCsv(items, period) {
  const sep = (row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  const rows = [
    [`Comisiones — ${period}`],
    ['Fecha', 'Gestor', 'Cliente', 'Producto', 'Base cobrada (€)', '%', 'Comisión (€)', 'Estado', 'Fecha pago'],
    ...items.map((r) => [
      r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES') : '',
      r.user_nombre || '',
      r.lead_nombre || '',
      r.product_nombre || r.producto_contratado || '',
      Number(r.importe_base || 0).toFixed(2),
      r.pct ?? '',
      Number(r.importe_comision || 0).toFixed(2),
      r.estado || '',
      r.fecha_pago ? new Date(r.fecha_pago).toLocaleDateString('es-ES') : '',
    ]),
  ];
  return {
    csv: rows.map(sep).join('\n'),
    filename: `comisiones-${period.replace(/\s+/g, '_').toLowerCase()}.csv`,
  };
}
