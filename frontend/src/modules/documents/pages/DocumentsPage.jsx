import { useState, useEffect, useCallback } from 'react';
import { FilePdf, Receipt, Certificate, Download, Trash, Plus } from '@phosphor-icons/react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { toast } from '@/shared/hooks/useToast';
import { documentsApi } from '../api/documents.api';
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog';
import InvoiceForm from '../components/InvoiceForm';
import CertificateForm from '../components/CertificateForm';

const TABS = [
  { key: 'list', label: 'Historial' },
  { key: 'invoice', label: 'Nueva Factura' },
  { key: 'certificate', label: 'Nuevo Certificado' },
];

const TYPE_LABEL = { invoice: 'Factura', certificate: 'Certificado' };

export default function DocumentsPage() {
  const { activeProject } = useProjectContext();
  const [tab, setTab] = useState('list');
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const load = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await documentsApi.list(activeProject.id);
      if (res.success) setDocs(res.data);
    } catch {}
    finally { setLoading(false); }
  }, [activeProject?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleDownload(doc) {
    setDownloading(doc.id);
    try {
      const res = await documentsApi.download(doc.id, activeProject.id);
      const url = URL.createObjectURL(new Blob([res], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Error al descargar', variant: 'destructive' });
    } finally { setDownloading(null); }
  }

  async function doDelete() {
    try {
      await documentsApi.remove(pendingDelete.id, activeProject.id);
      toast({ title: 'Documento eliminado' });
      load();
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    } finally { setPendingDelete(null); }
  }

  function onGenerated() {
    setTab('list');
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Facturas y certificados de {activeProject?.nombre}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('invoice')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Receipt size={15}/> Nueva Factura
          </button>
          <button onClick={() => setTab('certificate')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors">
            <Certificate size={15}/> Nuevo Certificado
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Historial */}
      {tab === 'list' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"/>
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FilePdf size={48} className="mx-auto mb-3 opacity-30"/>
              <p className="font-medium">Sin documentos aún</p>
              <p className="text-sm mt-1">Genera tu primera factura o certificado</p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Número</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Cliente / Alumno</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Fecha</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {docs.map(doc => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{doc.number}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          doc.type === 'invoice'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                        }`}>
                          {doc.type === 'invoice' ? <Receipt size={11}/> : <Certificate size={11}/>}
                          {TYPE_LABEL[doc.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.client_nombre || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(doc.created_at).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => handleDownload(doc)} disabled={downloading === doc.id}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            title="Descargar PDF">
                            <Download size={14}/>
                          </button>
                          <button onClick={() => setPendingDelete(doc)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                            title="Eliminar">
                            <Trash size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'invoice' && <InvoiceForm onGenerated={onGenerated}/>}
      {tab === 'certificate' && <CertificateForm onGenerated={onGenerated}/>}

      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar documento?"
        message={`Se eliminará ${pendingDelete?.number} permanentemente.`}
        tone="destructive"
        confirmLabel="Eliminar"
        onConfirm={doDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
