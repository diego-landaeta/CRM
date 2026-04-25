import { useEffect, useState } from 'react';
import { listReports, getReport, generateReport } from '../api/reports-ia.api';

export function useReportsIA(projectId) {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null); // detail completo
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) { setReports([]); setSelected(null); return; }
    loadList();
  }, [projectId]); // eslint-disable-line

  async function loadList() {
    setLoading(true);
    setError(null);
    try {
      const r = await listReports(projectId);
      if (r.success) {
        setReports(r.data);
        // Auto-seleccionar el mas reciente
        if (r.data.length > 0 && (!selected || selected.projectId !== Number(projectId))) {
          await selectReport(r.data[0].id);
        } else if (r.data.length === 0) {
          setSelected(null);
        }
      } else {
        setError(r.error);
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function selectReport(id) {
    const r = await getReport(id);
    if (r.success) setSelected(r.data);
  }

  async function generate(periodo) {
    setGenerating(true);
    setError(null);
    try {
      const r = await generateReport(projectId, periodo);
      if (r.success) {
        await loadList();
        await selectReport(r.data.id);
        return r.data;
      }
      throw new Error(r.error);
    } catch (err) {
      setError(err?.message || 'Error generando reporte');
      throw err;
    } finally {
      setGenerating(false);
    }
  }

  return { reports, selected, selectReport, generate, generating, loading, error, refresh: loadList };
}
