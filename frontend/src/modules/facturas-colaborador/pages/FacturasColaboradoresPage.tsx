import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowClockwise, ClockCounterClockwise, FileText, PaperPlaneTilt, Plus, Prohibit, UsersThree } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import usePermission from '@/shared/hooks/usePermission';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Button } from '@/shared/components/ui/button';
import Select from '@/shared/components/ui/Select';
import { inputClass } from '@/shared/lib/ui';
import {
  AREAS, AREA_ES, ESTADO, euros, diaMes, facturasColaboradorApi, fechaHora,
  type Area, type Colaborador, type EmpresaDelGrupo, type EstadoFactura, type FacturaDelMes, type Mes,
} from '../api/facturasColaborador.api';
import { AnularDialog, BajaDialog, ColaboradorDialog, RegistroDialog } from '../components/DialogosFacturas';

/**
 * Finanzas › Facturas de colaboradores (#202).
 *
 * «Del mes»: todos los colaboradores del mes, hayan mandado o no, con quién
 * falta y lo recibido frente a lo acordado. «Colaboradores»: la lista que
 * decide a quién le llega el enlace. Las maquetas son las de la «Definición
 * acordada · Diego, 01/10». Enviadas, Por pagar, Pagadas, Historial y el ZIP
 * llegan con la segunda parte.
 *
 * El admin ve lo de las empresas de sus campus; el super admin, todo. Lo
 * decide el servidor: aquí solo se pinta lo que llega.
 */

const mesAnterior = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};

const errorDe = (err: any) => err?.data?.error || err?.message || 'Inténtalo de nuevo';

function Pildora({ estado }: { estado: EstadoFactura }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${ESTADO[estado].clase}`}>{ESTADO[estado].rotulo}</span>;
}

export default function FacturasColaboradoresPage() {
  const [params, setParams] = useSearchParams();
  const vista = params.get('vista') === 'colaboradores' ? 'colaboradores' : 'mes';
  const [empresas, setEmpresas] = useState<EmpresaDelGrupo[]>([]);

  useEffect(() => {
    facturasColaboradorApi.empresas().then((r) => setEmpresas(r.data)).catch(() => setEmpresas([]));
  }, []);

  const cambiar = (v: 'mes' | 'colaboradores') => {
    const n = new URLSearchParams(params);
    if (v === 'mes') n.delete('vista'); else n.set('vista', v);
    setParams(n, { replace: true });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader title="Facturas de colaboradores" subtitle="Quien factura al grupo cada mes sube su factura por un enlace personal, una por empresa y mes" />
      <div className="flex items-center gap-1">
        {([['mes', 'Del mes'], ['colaboradores', 'Colaboradores']] as const).map(([clave, rotulo]) => (
          <button key={clave} type="button" aria-pressed={vista === clave} onClick={() => cambiar(clave)}
            className={`h-8 px-3 rounded-md border text-xs font-medium transition-colors ${
              vista === clave ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted/60'
            }`}>
            {rotulo}
          </button>
        ))}
      </div>
      {vista === 'mes' ? <DelMes empresas={empresas} /> : <Colaboradores empresas={empresas} />}
    </div>
  );
}

/* ─────────────────────────── Del mes ─────────────────────────── */

function DelMes({ empresas }: { empresas: EmpresaDelGrupo[] }) {
  const [params, setParams] = useSearchParams();
  const periodo = params.get('periodo') || mesAnterior();
  const [issuerId, setIssuerId] = useState('');
  const [estado, setEstado] = useState<'' | EstadoFactura>('');
  const [area, setArea] = useState<'' | Area>('');
  const [datos, setDatos] = useState<Mes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [anular, setAnular] = useState<FacturaDelMes | null>(null);
  const [registro, setRegistro] = useState<FacturaDelMes | null>(null);
  const { can } = usePermission();
  const puedeAnular = can('facturas_colaborador.anular');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await facturasColaboradorApi.mes({
        periodo, issuerId: issuerId ? Number(issuerId) : undefined, estado: estado || undefined, area: area || undefined,
      });
      setDatos(r.data);
    } catch (err) {
      toast({ title: 'No se pudo cargar el mes', description: errorDe(err), variant: 'destructive' });
    } finally { setCargando(false); }
  }, [periodo, issuerId, estado, area]);

  useEffect(() => { void cargar(); }, [cargar]);

  const ponerPeriodo = (v: string) => {
    const n = new URLSearchParams(params);
    n.set('periodo', v);
    setParams(n, { replace: true });
  };

  async function verArchivo(f: FacturaDelMes) {
    try {
      const r = await facturasColaboradorApi.archivo(f.id);
      window.open(r.data.url, '_blank', 'noopener');
    } catch (err) {
      toast({ title: 'No se pudo abrir el archivo', description: errorDe(err), variant: 'destructive' });
    }
  }

  async function reenviar(f: FacturaDelMes) {
    try {
      await facturasColaboradorApi.reenviar(f.id);
      toast({ title: 'Enlace nuevo', description: `Para ${f.colaborador_nombre}. El anterior deja de valer.` });
      void cargar();
    } catch (err) {
      toast({ title: 'No se pudo reenviar', description: errorDe(err), variant: 'destructive' });
    }
  }

  const cargarRegistro = useCallback(
    () => facturasColaboradorApi.registroDeLaFactura(registro!.id).then((r) => r.data),
    [registro],
  );

  const r = datos?.resumen;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40 flex-none">
          <input type="month" aria-label="Mes" value={periodo} onChange={(e) => e.target.value && ponerPeriodo(e.target.value)} className={inputClass} />
        </div>
        <div className="w-56 flex-none">
          <Select<string> value={issuerId} onChange={setIssuerId} ariaLabel="Empresa"
            options={[{ value: '', label: 'Todas las empresas' }, ...empresas.map((e) => ({ value: String(e.id), label: e.razon_social }))]} />
        </div>
        <div className="w-44 flex-none">
          <Select<'' | Area> value={area} onChange={setArea} ariaLabel="Área"
            options={[{ value: '', label: 'Todas las áreas' }, ...AREAS.map((a) => ({ value: a, label: AREA_ES[a] }))]} />
        </div>
        <div className="w-44 flex-none">
          <Select<'' | EstadoFactura> value={estado} onChange={setEstado} ariaLabel="Estado"
            options={[{ value: '', label: 'Todos los estados' }, ...(Object.keys(ESTADO) as EstadoFactura[]).map((e) => ({ value: e, label: ESTADO[e].rotulo }))]} />
        </div>
        <Button variant="outline" size="sm" onClick={cargar} disabled={cargando} className="ml-auto">
          <ArrowClockwise size={13} weight="bold" className="mr-1.5" /> {cargando ? 'Cargando…' : 'Actualizar'}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {datos && r && (
          <div className="px-4 py-2.5 border-b border-border text-sm">
            <strong className="capitalize">{datos.mes.replace(' de ', ' ')}</strong>
            <span className="text-muted-foreground"> · {r.recibidas} de {r.total} recibidas · {euros(r.importe_recibido)} de {euros(r.importe_acordado)} acordados</span>
          </div>
        )}
        {!datos || datos.facturas.length === 0 ? (
          <EmptyState icon={FileText} title={cargando ? 'Cargando…' : 'Nada en este mes'}
            description="El último día del mes, a las 10:00, se prepara el mes con los colaboradores activos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-tabla">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Colaborador</th><th className="px-3 py-2">Área</th><th className="px-3 py-2">Empresa</th>
                  <th className="px-3 py-2 text-right">Acordado</th><th className="px-3 py-2">Enlace</th><th className="px-3 py-2">Factura</th>
                  <th className="px-3 py-2 text-right">Importe</th><th className="px-3 py-2 text-right">Diferencia</th><th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {datos.facturas.map((f) => (
                  <tr key={f.id} className={f.estado === 'anulada' ? 'opacity-60' : ''}>
                    <td className="px-3 py-2"><div className="font-medium">{f.colaborador_nombre}</div><div className="text-xs text-muted-foreground">{f.email}</div></td>
                    <td className="px-3 py-2">{AREA_ES[f.area]}</td>
                    <td className="px-3 py-2">{f.empresa}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{euros(f.importe_esperado)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {f.abierto_at ? `Abierto ${diaMes(f.abierto_at)}` : f.enviado_at ? `Enviado ${diaMes(f.enviado_at)}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Pildora estado={f.estado} />
                      {f.numero_recepcion && <div className="text-xs text-muted-foreground mt-0.5">{f.numero_recepcion} · {fechaHora(f.subida_at)}</div>}
                      {f.motivo_anulacion && <div className="text-xs text-muted-foreground mt-0.5">«{f.motivo_anulacion}»</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{euros(f.importe)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${f.diferencia && Number(f.diferencia) !== 0 ? 'text-warning-soft-foreground font-semibold' : ''}`}>
                      {f.diferencia === null ? '—' : euros(f.diferencia)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {f.nombre_original && (
                          <Button variant="ghost" size="sm" title="Ver el archivo" aria-label="Ver el archivo" onClick={() => verArchivo(f)}><FileText size={15} /></Button>
                        )}
                        <Button variant="ghost" size="sm" title="Ver el registro" aria-label="Ver el registro" onClick={() => setRegistro(f)}><ClockCounterClockwise size={15} /></Button>
                        {!f.subida_at && !f.anulada_at && (
                          <Button variant="ghost" size="sm" title="Reenviar el enlace" aria-label="Reenviar el enlace" onClick={() => reenviar(f)}><PaperPlaneTilt size={15} /></Button>
                        )}
                        {puedeAnular && !f.anulada_at && (
                          <Button variant="ghost" size="sm" title="Anular" aria-label="Anular" onClick={() => setAnular(f)}><Prohibit size={15} /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {anular && (
        <AnularDialog facturaId={anular.id} quien={`${anular.colaborador_nombre} · ${anular.empresa}`}
          alCerrar={() => setAnular(null)} alGuardar={() => { setAnular(null); void cargar(); }} />
      )}
      {registro && (
        <RegistroDialog titulo={`Registro · ${registro.colaborador_nombre} · ${registro.empresa}`}
          cargar={cargarRegistro} alCerrar={() => setRegistro(null)} />
      )}
    </div>
  );
}

/* ─────────────────────────── Colaboradores ─────────────────────────── */

function Colaboradores({ empresas }: { empresas: EmpresaDelGrupo[] }) {
  const [estado, setEstado] = useState<'activos' | 'de_baja' | 'todos'>('activos');
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<Colaborador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Colaborador | 'nuevo' | null>(null);
  const [baja, setBaja] = useState<Colaborador | null>(null);
  const [historial, setHistorial] = useState<Colaborador | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await facturasColaboradorApi.colaboradores({ estado, q: q.trim() || undefined });
      setLista(r.data);
    } catch (err) {
      toast({ title: 'No se pudo cargar la lista', description: errorDe(err), variant: 'destructive' });
    } finally { setCargando(false); }
  }, [estado, q]);

  useEffect(() => {
    const t = setTimeout(() => { void cargar(); }, 250);
    return () => clearTimeout(t);
  }, [cargar]);

  const cargarHistorial = useCallback(
    () => facturasColaboradorApi.registroDelColaborador(historial!.id).then((r) => r.data),
    [historial],
  );

  const acordado = useMemo(() => (c: Colaborador) => c.empresas
    .map((e) => (e.importe_acordado === null ? '—' : `${euros(e.importe_acordado)}/mes`)).join(' · '), []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64 flex-none">
          <input aria-label="Buscar por nombre o correo" placeholder="Buscar por nombre o correo" value={q}
            onChange={(e) => setQ(e.target.value)} className={inputClass} />
        </div>
        <div className="w-40 flex-none">
          <Select<'activos' | 'de_baja' | 'todos'> value={estado} onChange={setEstado} ariaLabel="Estado"
            options={[{ value: 'activos', label: 'Activos' }, { value: 'de_baja', label: 'De baja' }, { value: 'todos', label: 'Todos' }]} />
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setEditando('nuevo')}>
          <Plus size={13} weight="bold" className="mr-1.5" /> Añadir colaborador
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {lista.length === 0 ? (
          <EmptyState icon={UsersThree} title={cargando ? 'Cargando…' : 'Todavía no hay colaboradores'}
            description="Da de alta a quien factura al grupo cada mes: soporte, desarrollo, WordPress, SEO, contenido…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-tabla">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Área</th><th className="px-3 py-2">Empresas</th>
                  <th className="px-3 py-2">Acordado</th><th className="px-3 py-2">Correo</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-medium">{c.nombre}{c.usuario_nombre && <div className="text-xs text-muted-foreground">Usuario: {c.usuario_nombre}</div>}</td>
                    <td className="px-3 py-2">{AREA_ES[c.area]}</td>
                    <td className="px-3 py-2">{c.empresas.map((e) => e.razon_social).join(' · ')}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{acordado(c)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                    <td className="px-3 py-2">
                      {c.activo
                        ? <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-success-soft text-success-soft-foreground">Activo</span>
                        : <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-destructive-soft text-destructive-soft-foreground whitespace-nowrap">Baja desde {c.baja_desde}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditando(c)}>Editar</Button>
                        <Button variant="ghost" size="sm" title="Historial" aria-label="Historial" onClick={() => setHistorial(c)}><ClockCounterClockwise size={15} /></Button>
                        {c.activo && <Button variant="ghost" size="sm" onClick={() => setBaja(c)}>Dar de baja</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <ColaboradorDialog colaborador={editando === 'nuevo' ? null : editando} empresas={empresas}
          alCerrar={() => setEditando(null)} alGuardar={() => { setEditando(null); void cargar(); }} />
      )}
      {baja && <BajaDialog colaborador={baja} alCerrar={() => setBaja(null)} alGuardar={() => { setBaja(null); void cargar(); }} />}
      {historial && <RegistroDialog titulo={`Historial · ${historial.nombre}`} cargar={cargarHistorial} alCerrar={() => setHistorial(null)} />}
    </div>
  );
}
