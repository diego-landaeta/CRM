import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '@/shared/api/client';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { UserCheck, CurrencyEur, ArrowRight, Phone, EnvelopeSimple } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const { activeProject } = useProjectContext();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeProject?.id) return;
    (async () => {
      setLoading(true);
      try {
        // Clientes = leads con status='convertido' + sus conversiones
        const res = await client.get(`/leads?projectId=${activeProject.id}&status=convertido&limit=100`);
        if (res.success) {
          // Para cada lead, intentar traer sus conversiones
          const enriched = await Promise.all((res.data || []).map(async (l) => {
            try {
              const cr = await client.get(`/conversions/by-lead/${l.id}`);
              const convs = cr.success ? cr.data : [];
              const total = convs.reduce((s, c) => s + Number(c.importe_total || 0), 0);
              const pagado = convs.reduce((s, c) => s + Number(c.importe_pagado || 0), 0);
              return { ...l, conversiones: convs.length, total_compras: total, total_pagado: pagado, pendiente: total - pagado };
            } catch {
              return { ...l, conversiones: 0, total_compras: 0, total_pagado: 0, pendiente: 0 };
            }
          }));
          setClients(enriched);
        }
      } catch (err) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [activeProject?.id]);

  const filtered = search
    ? clients.filter(c =>
        (c.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  const totalFacturado = filtered.reduce((s, c) => s + c.total_compras, 0);
  const totalCobrado = filtered.reduce((s, c) => s + c.total_pagado, 0);
  const totalPendiente = filtered.reduce((s, c) => s + c.pendiente, 0);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Clientes"
        subtitle={`Leads convertidos en ${activeProject?.nombre || 'todos los proyectos'} — ${filtered.length} clientes`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Total facturado</p>
          <p className="text-2xl font-extrabold">{fmt(totalFacturado)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Total cobrado</p>
          <p className="text-2xl font-extrabold text-green-600">{fmt(totalCobrado)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Pendiente de cobro</p>
          <p className="text-2xl font-extrabold text-orange-600">{fmt(totalPendiente)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <input
            type="search"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserCheck} title="Sin clientes" description="Los leads marcados como 'convertido' apareceran aqui con su historial de compras" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-bold">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-bold">Contacto</th>
                  <th className="text-center px-4 py-2.5 font-bold">Compras</th>
                  <th className="text-right px-4 py-2.5 font-bold">Facturado</th>
                  <th className="text-right px-4 py-2.5 font-bold">Cobrado</th>
                  <th className="text-right px-4 py-2.5 font-bold">Pendiente</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/leads/${c.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{c.nombre}</div>
                      <div className="text-xs text-muted-foreground">{c.responsable_nombre || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground"><EnvelopeSimple size={12} /> {c.email}</div>
                      {c.telefono && <div className="flex items-center gap-1 text-muted-foreground mt-0.5"><Phone size={12} /> {c.telefono}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">{c.conversiones}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(c.total_compras)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600">{fmt(c.total_pagado)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-orange-600">{fmt(c.pendiente)}</td>
                    <td className="px-4 py-3 text-right"><ArrowRight size={14} className="text-muted-foreground inline" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
