import { useEffect, useState } from 'react';
import { listReports, getReport, generateReport, type Report, type ReportSummary } from '../api/reports-ia.api';

export function useReportsIA(projectId: string | number | undefined) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selected, setSelected] = useState<Report | null>(null); // detail completo
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) { setReports([]); setSelected(null); return; }
    loadList();
  }, [projectId]); // eslint-disable-line

  async function loadList() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await listReports(projectId);
      if (r.success && r.data) {
        setReports(r.data);
        // Auto-seleccionar el mas reciente
        if (r.data.length > 0 && (!selected || selected.projectId !== Number(projectId))) {
          await selectReport(r.data[0].id);
        } else if (r.data.length === 0) {
          setSelected(null);
        }
      } else {
        setError(r.error || 'Error');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function selectReport(id: string) {
    const r = await getReport(id);
    if (r.success && r.data) setSelected(r.data);
  }

  async function generate(periodo?: string): Promise<Report> {
    if (!projectId) throw new Error('Sin proyecto');
    setGenerating(true);
    setError(null);
    try {
      const r = await generateReport(projectId, periodo);
      if (r.success && r.data) {
        await loadList();
        await selectReport(r.data.id);
        return r.data;
      }
      throw new Error(r.error || 'Error generando reporte');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generando reporte';
      setError(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setGenerating(false);
    }
  }

  return { reports, selected, selectReport, generate, generating, loading, error, refresh: loadList };
}
