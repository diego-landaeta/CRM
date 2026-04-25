import { query } from '../../shared/config/db.js';

export async function listSnapshots(projectId, monthsBack = 12) {
  const { rows } = await query(
    `SELECT * FROM ia_metrics_snapshots WHERE project_id = $1
       AND mes >= TO_CHAR((NOW() - ($2 || ' months')::interval), 'YYYY-MM')
     ORDER BY mes ASC`,
    [projectId, String(monthsBack)]);
  return rows;
}
export async function upsertSnapshot(data) {
  const { rows } = await query(
    `INSERT INTO ia_metrics_snapshots (project_id, mes, mrr, active_subs, new_subs, cancelled_subs, churn_rate, failed_payments, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (project_id, mes) DO UPDATE
       SET mrr = EXCLUDED.mrr, active_subs = EXCLUDED.active_subs,
           new_subs = EXCLUDED.new_subs, cancelled_subs = EXCLUDED.cancelled_subs,
           churn_rate = EXCLUDED.churn_rate, failed_payments = EXCLUDED.failed_payments,
           raw_payload = EXCLUDED.raw_payload, snapshot_at = NOW()
     RETURNING *`,
    [data.project_id, data.mes, data.mrr, data.active_subs, data.new_subs,
     data.cancelled_subs, data.churn_rate, data.failed_payments,
     data.raw_payload ? JSON.stringify(data.raw_payload) : null]);
  return rows[0];
}
