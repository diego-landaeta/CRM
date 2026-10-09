import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowClockwise, ArrowSquareOut, BookOpenText, Certificate, CheckCircle, DownloadSimple, Envelope, FileXls, FilePdf,
  HourglassMedium, LinkSimple, PaperPlaneTilt, PencilSimple, PlugsConnected, Prohibit, SealCheck, Warning, X, XCircle,
} from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import KpiCard from '@/shared/components/ui/KpiCard';
import Card, { CardSection } from '@/shared/components/ui/Card';
import EmptyState from '@/shared/components/ui/EmptyState';
import StatusDot from '@/shared/components/ui/StatusDot';
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog';
import PromptDialog from '@/shared/components/ui/PromptDialog';
import Select from '@/shared/components/ui/Select';
import SearchableSelect from '@/shared/components/ui/SearchableSelect';
import Portal from '@/shared/components/ui/portal';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { runExport, type ExportColumn } from '@/shared/lib/export';
import {
  diplomasApi, emisionesApi,
  type CampusCertifex, type ConexionCertifex, type CursoCertifex, type Diploma, type FiltroAviso,
  type PestanaDiplomas, type ProgramaDelCrm, type ProgramaOficial, type ResultadoAprobarEmitir, type ResumenDiplomas, type Solicitud,
} from '../api/certifex.api';
import { Avance, Buscador, EnElCrmEtiqueta, Etiqueta, Pestana } from '../components/piezas';

/**
 * Certifex · Diplomas (#272): lo que los alumnos piden desde Moodle y los diplomas ya
 * emitidos, en cuatro pestañas: Pendientes · Enviados · Rechazados · Revocados.
 *
 * El recorrido, con las decisiones del 08/10:
 *  1. El alumno termina, escribe su nombre (sin DNI) y lo pide. Llega aquí y suena la
 *     campana. El nombre que escribió es el que se imprime: va destacado junto al de
 *     Moodle para revisarlo.
 *  2. «Aprobar y emitir»: visto bueno y diploma, en un paso. NO avisa al alumno.
 *  3. El diploma queda «pendiente de aviso»: se ve el PDF y, si está bien, «Enviar
 *     diploma al alumno». Solo entonces sale el correo, y solo si una persona lo aprueba.
 *  4. Un nombre mal escrito se CORRIGE (mismo número, queda registrado); revocar es para
 *     lo que no debía emitirse.
 */

const PESTANAS: { clave: PestanaDiplomas; rotulo: string }[] = [
  { clave: 'pendientes', rotulo: 'Pendientes' },
  { clave: 'enviados', rotulo: 'Enviados' },
  { clave: 'rechazados', rotulo: 'Rechazados' },
  { clave: 'revocados', rotulo: 'Revocados' },
];

/** Por llamada: emitir baja el expediente de Moodle en serie (ver TANDA_EMITIR en Emisiones). */
const TANDA_EMITIR = 10;
/** Cada aviso genera el PDF y manda un correo: tandas cortas para no pasar del minuto de nginx. */
const TANDA_AVISOS = 10;
const TAM = 50;

const fecha = (iso: string | null | undefined) => (iso
  ? new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');
const sinAcentos = (t: string) => t.toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
const hoy = () => new Date().toLocaleDateString('sv-SE');

type Fallo = { quien: string; error: string };
type Dialogo =
  | null
  | { tipo: 'aprobarEmitir'; ids: number[] }
  | { tipo: 'emitir'; ids: number[] }
  | { tipo: 'rechazar'; ids: number[] }
  | { tipo: 'avisos'; exps: string[]; reenvio: boolean }
  | { tipo: 'avisoRechazo'; ids: number[] }
  | { tipo: 'revocar'; d: Diploma }
  | { tipo: 'corregir'; d: Diploma };

const ROTULO_AVISO: Record<string, string> = {
  enviado: 'enviado',
  correo_apagado: 'correo apagado en el servidor',
  sin_correo: 'sin correo',
  error: 'error al enviar',
};

async function enTandas<T, R>(xs: T[], n: number, fn: (lote: T[]) => Promise<R[]>, avance?: (hechas: number) => void) {
  const out: R[] = [];
  for (let i = 0; i < xs.length; i += n) {
    out.push(...(await fn(xs.slice(i, i + n))));
    avance?.(Math.min(i + n, xs.length));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────── piezas

/** El nombre que se imprimirá, destacado, y el de Moodle debajo para compararlo. */
function NombreDiploma({ c }: { c: Solicitud }) {
  const pedido = c.solicitud?.nombre?.trim() || '';
  const moodle = c.titular.nombre?.trim() || '';
  const igual = pedido && moodle && pedido === moodle;
  const casi = !igual && pedido && moodle && sinAcentos(pedido) === sinAcentos(moodle);
  return (
    <div className="min-w-0 max-w-[280px]">
      <div className="truncate text-[15px] font-semibold text-foreground" title={pedido || undefined}>
        {pedido || <span className="italic text-muted-foreground">Sin nombre</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="truncate" title={moodle || undefined}>En Moodle: {moodle || '—'}</span>
        {pedido && moodle && !igual && (
          casi ? <Etiqueta tono="neutral">Tildes o mayúsculas</Etiqueta> : <Etiqueta tono="warning">Distinto de Moodle</Etiqueta>
        )}
      </div>
    </div>
  );
}

const resumenPrograma = (p: ProgramaOficial) => [
  p.horas ? `${p.horas.toLocaleString('es')} h` : null,
  p.modulos.length ? `${p.modulos.length} ${p.modulos.length === 1 ? 'módulo' : 'módulos'}` : null,
].filter(Boolean).join(' · ');

/** La lista de módulos, plegada: se abre para revisarla antes de aprobar. */
function Modulos({ programa, rotulo }: { programa: ProgramaOficial; rotulo: string }) {
  return (
    <details className="group mt-1 max-w-[280px] text-xs">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-success-soft-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-primary/40">
        <BookOpenText size={13} /> {rotulo}
      </summary>
      {programa.modulos.length > 0 && (
        <ol className="mt-1 list-decimal space-y-0.5 rounded-md border border-border bg-muted/30 py-1.5 pl-6 pr-2 text-muted-foreground">
          {programa.modulos.map((m, i) => (
            <li key={i}><span className="text-foreground">{m.titulo}</span>{m.horas != null && <span className="tabular-nums"> · {m.horas} h</span>}</li>
          ))}
        </ol>
      )}
    </details>
  );
}

/**
 * Lo que se imprimirá en el diploma si se aprueba ahora: el programa de la formación
 * vendida (horas y módulos), o el aviso de que se usará lo de Moodle, con el motivo.
 */
function ProgramaAImprimir({ p }: { p: ProgramaDelCrm | null | undefined }) {
  if (p === undefined) return null;
  if (p?.programa) {
    return <Modulos programa={p.programa} rotulo={resumenPrograma(p.programa)} />;
  }
  return (
    <div className="mt-1 max-w-[280px]" title={p?.motivo ?? undefined}>
      <Etiqueta tono="warning">Sin programa del CRM: se usará lo de Moodle</Etiqueta>
      {p?.motivo && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{p.motivo}</p>}
    </div>
  );
}

function EstadoAviso({ d }: { d: Diploma }) {
  const a = d.aviso;
  if (!a) return <StatusDot tono="warning">Pendiente de aviso</StatusDot>;
  const detalle = <div className="mt-0.5 max-w-[180px] truncate text-[11px] text-muted-foreground" title={a.por}>{fecha(a.en)} · {a.por}</div>;
  if (a.resultado === 'enviado') return <div><StatusDot tono="success">Enviado</StatusDot>{detalle}</div>;
  if (a.resultado === 'correo_apagado') {
    return <div><StatusDot tono="warning" title="Se aprobó el envío, pero el correo está apagado en el servidor de Certifex: no ha salido">Aprobado, correo apagado</StatusDot>{detalle}</div>;
  }
  if (a.resultado === 'sin_correo') return <div><StatusDot tono="danger" title="El alumno no tiene correo en Certifex">Sin correo</StatusDot>{detalle}</div>;
  return <div><StatusDot tono="danger">Error al enviar</StatusDot>{detalle}</div>;
}

function IconoAccion({ etiqueta, onClick, children, disabled, peligro }: {
  etiqueta: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; peligro?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50',
        peligro && 'hover:text-destructive',
      )}
    >
      {children}
    </button>
  );
}

function Casilla({ id, etiqueta, marcada, alCambiar }: { id: string; etiqueta: string; marcada: boolean; alCambiar: () => void }) {
  return <input id={id} type="checkbox" aria-label={etiqueta} checked={marcada} onChange={alCambiar} className="h-4 w-4 accent-[hsl(var(--primary))]" />;
}

const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn('px-2 py-2 text-left font-medium', className)}>{children}</th>
);

function Esqueleto() {
  return <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />)}</div>;
}

// ─────────────────────────────────────────────────────────────── página

export default function CertifexDiplomasPage() {
  const [params, setParams] = useSearchParams();
  const pestana: PestanaDiplomas = (PESTANAS.find((p) => p.clave === params.get('pestana'))?.clave) ?? 'pendientes';
  const irA = (p: PestanaDiplomas) => setParams(p === 'pendientes' ? {} : { pestana: p }, { replace: true });

  const [conexion, setConexion] = useState<ConexionCertifex | null>(null);
  const [campus, setCampus] = useState<CampusCertifex[] | null>(null);
  const [centro, setCentro] = useState('');
  const [cursos, setCursos] = useState<CursoCertifex[]>([]);
  const [curso, setCurso] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [buscar, setBuscar] = useState('');
  const [q, setQ] = useState('');
  const [filtroAviso, setFiltroAviso] = useState<FiltroAviso | ''>('');
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);

  const [resumen, setResumen] = useState<ResumenDiplomas | null>(null);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [despues, setDespues] = useState<{ porAvisar: Solicitud[]; sinEmitir: Solicitud[] }>({ porAvisar: [], sinEmitir: [] });
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [elegidasAviso, setElegidasAviso] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [lote, setLote] = useState<{ hechas: number; total: number } | null>(null);
  const [fallos, setFallos] = useState<Fallo[]>([]);
  // Emitidos sin programa del CRM (con lo de Moodle): no es un fallo, pero se dice.
  const [notas, setNotas] = useState<Fallo[]>([]);
  const [correoApagado, setCorreoApagado] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [visor, setVisor] = useState<{ d: Pick<Diploma, 'nexpediente' | 'alumno' | 'titulacion' | 'centro' | 'aviso'>; enviable: boolean } | null>(null);
  // Tras corregir, el PDF cambia: se pide otra vez sin caché.
  const [versiones, setVersiones] = useState<Record<string, number>>({});

  const recargar = () => setRecarga((n) => n + 1);

  // ── carga ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const e = await emisionesApi.estado();
        setConexion(e.data);
        if (e.data.conectado) setCampus((await emisionesApi.centros()).data);
      } catch {
        setConexion({ conectado: false });
      }
    })();
  }, []);

  useEffect(() => {
    setCurso('');
    setCursos([]);
    if (!centro) return;
    emisionesApi.cursos(centro).then((r) => setCursos(r.data)).catch(() => setCursos([]));
  }, [centro]);

  useEffect(() => {
    const t = setTimeout(() => setQ(buscar.trim()), 300);
    return () => clearTimeout(t);
  }, [buscar]);

  // Cambiar de pestaña o de filtro vuelve a la primera página y suelta la selección.
  useEffect(() => { setPagina(1); }, [pestana, centro, curso, q, desde, hasta, filtroAviso]);
  useEffect(() => { setElegidas(new Set()); setElegidasAviso(new Set()); }, [pestana, centro, curso, q, desde, hasta, filtroAviso, pagina, recarga]);

  const filtros = useMemo(() => ({
    centro: centro || undefined,
    curso: curso ? Number(curso) : undefined,
    q: q || undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
  }), [centro, curso, q, desde, hasta]);

  useEffect(() => {
    if (!conexion?.conectado) return;
    diplomasApi.resumen(centro || undefined).then((r) => setResumen(r.data)).catch(() => setResumen(null));
  }, [conexion?.conectado, centro, recarga]);

  useEffect(() => {
    if (!conexion?.conectado) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    (async () => {
      try {
        if (pestana === 'pendientes') {
          const [s, d] = await Promise.all([
            diplomasApi.solicitudes({ ...filtros, estado: 'pendiente', pagina, tam: TAM }),
            diplomasApi.porAvisar({ centro: filtros.centro, q: filtros.q }),
          ]);
          if (!vivo) return;
          setSolicitudes(s.data.filas);
          setTotal(s.data.total);
          // «Por avisar» y «sin diploma» no vienen paginados: la formación y las fechas se
          // aplican aquí con la misma regla que el servidor (fecha de la solicitud).
          const pasa = (c: Solicitud) => {
            if (filtros.curso !== undefined && c.curso.ref !== filtros.curso) return false;
            const dia = c.solicitud?.en ? new Date(c.solicitud.en).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }) : null;
            if (filtros.desde && (!dia || dia < filtros.desde)) return false;
            if (filtros.hasta && (!dia || dia > filtros.hasta)) return false;
            return true;
          };
          setDespues({ porAvisar: d.data.porAvisar.filter(pasa), sinEmitir: d.data.sinEmitir.filter(pasa) });
        } else if (pestana === 'rechazados') {
          const s = await diplomasApi.solicitudes({ ...filtros, estado: 'rechazada', pagina, tam: TAM });
          if (!vivo) return;
          setSolicitudes(s.data.filas);
          setTotal(s.data.total);
        } else {
          const d = await diplomasApi.diplomas({
            ...filtros,
            estado: pestana === 'enviados' ? 'vigentes' : 'revocados',
            aviso: pestana === 'enviados' && filtroAviso ? filtroAviso : undefined,
            pagina,
            tam: TAM,
          });
          if (!vivo) return;
          setDiplomas(d.data.filas);
          setTotal(d.data.total);
        }
      } catch (e) {
        if (vivo) setError((e as Error).message);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [conexion?.conectado, pestana, filtros, filtroAviso, pagina, recarga]);

  // ── derivados ───────────────────────────────────────────────────
  const nombres = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of [...solicitudes, ...despues.porAvisar, ...despues.sinEmitir]) {
      m.set(c.matriculaId, c.solicitud?.nombre || c.titular.nombre || c.titular.email || `Matrícula #${c.matriculaId}`);
    }
    return m;
  }, [solicitudes, despues]);
  const nombre = (id: number | null) => (id != null && nombres.get(id)) || `Matrícula #${id}`;
  const nombreDe = (exp: string | null) => {
    const d = diplomas.find((x) => x.nexpediente === exp) ?? despues.porAvisar.find((c) => c.nexpediente === exp)?.diploma;
    return d ? `${d.alumno} (${exp})` : exp ?? 'Diploma';
  };
  const paginas = Math.max(1, Math.ceil(total / TAM));
  const filasClave = pestana === 'enviados' || pestana === 'revocados'
    ? diplomas.map((d) => d.nexpediente)
    : solicitudes.map((s) => String(s.matriculaId));
  const todas = filasClave.length > 0 && filasClave.every((k) => elegidas.has(k));
  const alternar = (setter: typeof setElegidas, k: string) => setter((s) => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const hayFiltros = !!(centro || curso || desde || hasta || buscar || filtroAviso);
  const contar = (p: PestanaDiplomas) => {
    if (!resumen) return undefined;
    if (p === 'pendientes') return resumen.pendientes + resumen.porAvisar + resumen.sinEmitir;
    if (p === 'enviados') return resumen.vigentes;
    if (p === 'rechazados') return resumen.rechazadas;
    return resumen.revocados;
  };

  // ── acciones ────────────────────────────────────────────────────
  async function ejecutar(fn: () => Promise<void>, titulo: string) {
    setTrabajando(true);
    setFallos([]);
    setNotas([]);
    try { await fn(); } catch (e) { toast({ title: titulo, description: (e as Error).message, variant: 'destructive' }); }
    finally { setTrabajando(false); setLote(null); recargar(); }
  }

  const anotarPrograma = (res: ResultadoAprobarEmitir[]) => setNotas(res
    .filter((r) => r.ok && r.sinPrograma)
    .map((r) => ({ quien: nombre(r.matriculaId), error: r.sinPrograma! })));

  const aprobarEmitir = (ids: number[]) => ejecutar(async () => {
    setLote({ hechas: 0, total: ids.length });
    const res = await enTandas(ids, TANDA_EMITIR, async (l) => (await diplomasApi.aprobarEmitir(l)).data.resultados,
      (h) => setLote({ hechas: h, total: ids.length }));
    anotarPrograma(res);
    const ok = res.filter((r) => r.ok).length;
    setFallos(res.filter((r) => !r.ok).map((r) => ({ quien: nombre(r.matriculaId), error: r.error ?? 'Error' })));
    toast({
      title: `${ok} ${ok === 1 ? 'diploma emitido' : 'diplomas emitidos'}`,
      description: ok ? 'Quedan pendientes de aviso: revisa el PDF y envíalo al alumno.' : 'Ninguno se ha podido emitir: el motivo, en pantalla.',
      variant: ok ? undefined : 'destructive',
    });
  }, 'No se pudo aprobar y emitir');

  const emitir = (ids: number[]) => ejecutar(async () => {
    setLote({ hechas: 0, total: ids.length });
    const res = await enTandas(ids, TANDA_EMITIR, async (l) => (await diplomasApi.emitir(l)).data.resultados,
      (h) => setLote({ hechas: h, total: ids.length }));
    anotarPrograma(res);
    const ok = res.filter((r) => r.ok).length;
    setFallos(res.filter((r) => !r.ok).map((r) => ({ quien: nombre(r.matriculaId), error: r.error ?? 'Error' })));
    toast({ title: `${ok} ${ok === 1 ? 'diploma emitido' : 'diplomas emitidos'}`, description: 'Quedan pendientes de aviso.' });
  }, 'No se pudo emitir');

  const rechazar = (ids: number[], motivo: string) => ejecutar(async () => {
    const r = await diplomasApi.rechazar(ids, motivo);
    const malas = r.data.resultados.filter((x) => !x.ok);
    setFallos(malas.map((m) => ({ quien: nombre(m.matriculaId), error: m.error ?? 'Error' })));
    const n = r.data.resultados.length - malas.length;
    toast({ title: `${n} ${n === 1 ? 'solicitud rechazada' : 'solicitudes rechazadas'}`, description: 'El alumno no recibe nada hasta que apruebes el aviso de rechazo.' });
  }, 'No se pudo rechazar');

  const enviarAvisos = (exps: string[]) => ejecutar(async () => {
    setLote({ hechas: 0, total: exps.length });
    let activo = true;
    const res = await enTandas(exps, TANDA_AVISOS, async (l) => {
      const r = await diplomasApi.avisos(l);
      if (!r.data.correoActivo) activo = false;
      return r.data.resultados;
    }, (h) => setLote({ hechas: h, total: exps.length }));
    const enviados = res.filter((r) => r.resultado === 'enviado').length;
    setCorreoApagado(!activo);
    setFallos(res.filter((r) => r.resultado !== 'enviado' && r.resultado !== 'correo_apagado')
      .map((r) => ({ quien: nombreDe(r.nexpediente), error: r.error ?? (r.resultado ? `Aviso aprobado, pero ${ROTULO_AVISO[r.resultado]}` : 'Error') })));
    toast(activo
      ? { title: `${enviados} ${enviados === 1 ? 'diploma enviado' : 'diplomas enviados'} al alumno` }
      : { title: 'Aprobado, pero el correo está apagado', description: 'No ha salido ningún correo: el servidor de Certifex tiene el envío apagado.', variant: 'destructive' });
  }, 'No se pudo enviar');

  const avisarRechazo = (ids: number[]) => ejecutar(async () => {
    const r = await diplomasApi.avisosRechazo(ids);
    setCorreoApagado(!r.data.correoActivo);
    const enviados = r.data.resultados.filter((x) => x.resultado === 'enviado').length;
    setFallos(r.data.resultados.filter((x) => !x.ok && x.resultado !== 'correo_apagado')
      .map((x) => ({ quien: nombre(x.matriculaId), error: x.error ?? (x.resultado ? `Aviso aprobado, pero ${ROTULO_AVISO[x.resultado] ?? x.resultado}` : 'Error') })));
    toast(r.data.correoActivo
      ? { title: `${enviados} ${enviados === 1 ? 'aviso de rechazo enviado' : 'avisos de rechazo enviados'}` }
      : { title: 'Aprobado, pero el correo está apagado', description: 'No ha salido ningún correo: el servidor de Certifex tiene el envío apagado.', variant: 'destructive' });
  }, 'No se pudo enviar el aviso');

  const revocar = (d: Diploma, motivo: string) => ejecutar(async () => {
    await diplomasApi.revocar(d.nexpediente, motivo);
    toast({ title: 'Diploma revocado', description: `${d.nexpediente}: la verificación pública ya dice «revocado». No se ha avisado al alumno.` });
  }, 'No se pudo revocar');

  const corregir = (d: Diploma, valor: string, motivo: string) => ejecutar(async () => {
    await diplomasApi.corregirNombre(d.nexpediente, valor, motivo);
    setVersiones((v) => ({ ...v, [d.nexpediente]: Date.now() }));
    toast({
      title: 'Nombre corregido',
      description: d.aviso ? 'Mismo número y mismo QR. El alumno ya recibió el anterior: usa «Reenviar» si quieres mandarle el corregido.' : 'Mismo número y mismo QR. Revisa el PDF antes de enviarlo.',
    });
  }, 'No se pudo corregir');

  async function copiarEnlace(d: Diploma) {
    const ok = await copyToClipboard(d.verificarUrl);
    toast(ok ? { title: 'Enlace de verificación copiado', description: d.verificarUrl } : { title: 'No se pudo copiar', description: d.verificarUrl, variant: 'destructive' });
  }

  // ── exportar ────────────────────────────────────────────────────
  async function exportar() {
    setExportando(true);
    try {
      const todo = { ...filtros, todo: '1' as const };
      type FilaX = Record<string, unknown>;
      let filas: FilaX[] = [];
      let truncado = false;
      const deSolicitud = (c: Solicitud, estado: string): FilaX => ({
        estado,
        nombreDiploma: c.solicitud?.nombre ?? '',
        nombreMoodle: c.titular.nombre ?? '',
        email: c.titular.email ?? '',
        campus: c.centro,
        formacion: c.curso.nombre,
        solicitada: c.solicitud?.en ?? null,
        nota: c.notaFinal,
        nexpediente: c.nexpediente ?? c.diploma?.nexpediente ?? '',
        decision: c.decision ? `${c.decision.decision} · ${c.decision.decididoPor}` : '',
        decididaEn: c.decision?.decididoEn ?? null,
        motivo: c.decision?.motivo ?? '',
        avisoRechazo: c.avisoRechazo ? `${ROTULO_AVISO[c.avisoRechazo.resultado] ?? c.avisoRechazo.resultado} · ${c.avisoRechazo.por}` : '',
      });
      const deDiploma = (d: Diploma): FilaX => ({
        nexpediente: d.nexpediente,
        alumno: d.alumno,
        campus: d.centro,
        titulacion: d.titulacion,
        emitido: d.emitidoEn,
        emitidaPor: d.emitidaPor ?? '',
        aviso: d.aviso ? ROTULO_AVISO[d.aviso.resultado] ?? d.aviso.resultado : 'pendiente de aviso',
        avisoEn: d.aviso?.en ?? null,
        avisoPor: d.aviso?.por ?? '',
        revocadoEn: d.revocacion?.en ?? null,
        revocadoPor: d.revocacion?.por ?? '',
        motivoRevocacion: d.revocacion?.motivo ?? '',
        verificar: d.verificarUrl,
      });
      if (pestana === 'pendientes' || pestana === 'rechazados') {
        const s = await diplomasApi.solicitudes({ ...todo, estado: pestana === 'pendientes' ? 'pendiente' : 'rechazada' });
        truncado = !!s.data.truncado;
        filas = s.data.filas.map((c) => deSolicitud(c, pestana === 'pendientes' ? 'Por decidir' : 'Rechazada'));
        if (pestana === 'pendientes') {
          filas.push(...despues.porAvisar.map((c) => deSolicitud(c, 'Emitido, falta enviarlo')));
          filas.push(...despues.sinEmitir.map((c) => deSolicitud(c, 'Aprobado sin diploma')));
        }
      } else {
        const d = await diplomasApi.diplomas({ ...todo, estado: pestana === 'enviados' ? 'vigentes' : 'revocados', aviso: pestana === 'enviados' && filtroAviso ? filtroAviso : undefined });
        truncado = !!d.data.truncado;
        filas = d.data.filas.map(deDiploma);
      }
      const col = (key: string, label: string, type: ExportColumn<FilaX>['type'] = 'string'): ExportColumn<FilaX> => ({ key, label, type, value: (r) => r[key] });
      const columnas = pestana === 'pendientes' || pestana === 'rechazados'
        ? [col('estado', 'Estado'), col('nombreDiploma', 'Nombre para el diploma'), col('nombreMoodle', 'Nombre en Moodle'), col('email', 'Correo'),
          col('campus', 'Campus'), col('formacion', 'Formación'), col('solicitada', 'Solicitada', 'date'), col('nota', 'Nota', 'number'),
          col('nexpediente', 'Nº expediente'), col('decision', 'Decisión'), col('decididaEn', 'Decidida', 'date'), col('motivo', 'Motivo'), col('avisoRechazo', 'Aviso de rechazo')]
        : [col('nexpediente', 'Nº expediente'), col('alumno', 'Alumno'), col('campus', 'Campus'), col('titulacion', 'Titulación'),
          col('emitido', 'Emitido', 'date'), col('emitidaPor', 'Emitido por'), col('aviso', 'Aviso al alumno'), col('avisoEn', 'Aviso aprobado', 'date'),
          col('avisoPor', 'Aviso aprobado por'), col('revocadoEn', 'Revocado', 'date'), col('revocadoPor', 'Revocado por'), col('motivoRevocacion', 'Motivo de revocación'),
          col('verificar', 'Enlace de verificación')];
      await runExport({
        context: 'certifex-diplomas',
        filename: `diplomas-${pestana}-${hoy()}`,
        format: 'xlsx',
        columns: columnas,
        config: columnas.map((c) => ({ key: c.key, label: c.label, included: true })),
        rows: filas,
      });
      toast({
        title: `${filas.length} ${filas.length === 1 ? 'fila exportada' : 'filas exportadas'}`,
        description: truncado ? 'Hay más de 10 000: acota con los filtros para sacarlo todo.' : undefined,
        variant: truncado ? 'destructive' : undefined,
      });
    } catch (e) {
      toast({ title: 'No se pudo exportar', description: (e as Error).message, variant: 'destructive' });
    } finally { setExportando(false); }
  }

  // ── sin conexión ────────────────────────────────────────────────
  if (conexion && !conexion.conectado) {
    return (
      <Card padding="none">
        <EmptyState
          icon={PlugsConnected}
          title="Certifex no está conectado"
          description={conexion.error || 'Faltan CERTIFEX_API_URL y CERTIFEX_CRM_CLAVE en el .env del servidor del CRM.'}
        />
      </Card>
    );
  }

  const fechaRotulo = pestana === 'enviados' || pestana === 'revocados' ? 'Emitido' : 'Solicitado';
  const enviables = [...elegidas].filter((k) => diplomas.some((d) => d.nexpediente === k));

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="inline-flex flex-wrap items-center gap-2">
          {conexion?.conectado
            ? <StatusDot tono="success">Conectado{conexion.nombre ? ` como ${conexion.nombre}` : ''}</StatusDot>
            : 'Conectando con Certifex…'}
          <span>· Emitir no avisa al alumno: el correo sale solo cuando lo apruebas aquí</span>
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={recargar} disabled={trabajando || !conexion?.conectado}>
            <ArrowClockwise size={13} weight="bold" className="mr-1.5" /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportar} disabled={exportando || !conexion?.conectado}>
            <FileXls size={13} weight="bold" className="mr-1.5" /> {exportando ? 'Exportando…' : 'Exportar a Excel'}
          </Button>
        </div>
      </div>

      {/* Contadores: del campus elegido, o de todos. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={HourglassMedium} iconBg="bg-info-soft text-info-soft-foreground" label="Por decidir" value={resumen ? resumen.pendientes.toLocaleString('es') : '…'} />
        <KpiCard icon={PaperPlaneTilt} iconBg="bg-warning-soft text-warning-soft-foreground" label="Por enviar al alumno" value={resumen ? resumen.porAvisar.toLocaleString('es') : '…'} />
        <KpiCard icon={SealCheck} iconBg="bg-success-soft text-success-soft-foreground" label="Diplomas vigentes" value={resumen ? resumen.vigentes.toLocaleString('es') : '…'} />
        <KpiCard icon={XCircle} iconBg="bg-destructive-soft text-destructive-soft-foreground" label="Rechazadas" value={resumen ? resumen.rechazadas.toLocaleString('es') : '…'} />
        <KpiCard icon={Prohibit} iconBg="bg-muted text-muted-foreground" label="Revocados" value={resumen ? resumen.revocados.toLocaleString('es') : '…'} />
      </div>

      {correoApagado && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
          <Warning size={18} weight="bold" className="mt-0.5 flex-none" />
          <div className="flex-1">
            <p className="font-semibold">Aprobado, pero el correo está apagado en el servidor de Certifex</p>
            <p className="mt-0.5">El envío queda aprobado y registrado a tu nombre, pero <strong>no ha salido ningún correo</strong>. Cuando se encienda el correo en Certifex, usa «Reenviar».</p>
          </div>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setCorreoApagado(false)} className="rounded p-1 hover:bg-background/40"><X size={14} /></button>
        </div>
      )}

      {fallos.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-medium text-destructive-soft-foreground">
              {fallos.length} {fallos.length === 1 ? 'no se ha podido completar' : 'no se han podido completar'}
            </span>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setFallos([])}>Cerrar</button>
          </div>
          <ul className="space-y-1">
            {fallos.slice(0, 12).map((f, i) => (
              <li key={i} className="text-xs"><span className="font-medium">{f.quien}:</span> <span className="text-muted-foreground">{f.error}</span></li>
            ))}
          </ul>
          {fallos.length > 12 && <p className="mt-1 text-xs text-muted-foreground">y {fallos.length - 12} más.</p>}
        </div>
      )}

      {notas.length > 0 && (
        <div role="status" className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-medium text-warning-soft-foreground">
              {notas.length} {notas.length === 1 ? 'diploma emitido' : 'diplomas emitidos'} sin programa del CRM: llevan lo de Moodle
            </span>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setNotas([])}>Cerrar</button>
          </div>
          <ul className="space-y-1">
            {notas.slice(0, 12).map((f, i) => (
              <li key={i} className="text-xs"><span className="font-medium">{f.quien}:</span> <span className="text-muted-foreground">{f.error}</span></li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">Revisa su PDF antes de enviarlo. Si el temario no es el bueno, corrige la venta o el catálogo antes de emitir los siguientes.</p>
        </div>
      )}

      <Card padding="none">
        {/* Pestañas y filtros */}
        <CardSection className="flex flex-wrap items-center gap-2">
          {PESTANAS.map((p) => (
            <Pestana key={p.clave} activa={pestana === p.clave} cuenta={contar(p.clave)} onClick={() => irA(p.clave)}>{p.rotulo}</Pestana>
          ))}
        </CardSection>
        <CardSection className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Campus
            <Select<string>
              value={centro}
              onChange={setCentro}
              ariaLabel="Campus"
              className="w-48 normal-case tracking-normal"
              options={[{ value: '', label: 'Todos los campus' }, ...(campus ?? []).map((c) => ({ value: c.codigo, label: c.nombre }))]}
            />
          </label>
          <div className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Formación
            {centro ? (
              <SearchableSelect
                value={curso}
                onChange={setCurso}
                ariaLabel="Formación"
                allLabel="Todas las formaciones"
                placeholder="Buscar formación…"
                maxWidth="260px"
                className="w-[260px] normal-case tracking-normal"
                options={cursos.map((c) => ({ value: String(c.cursoRef), label: c.cursoNombre }))}
              />
            ) : (
              <span className="flex h-9 w-[260px] items-center rounded-md border border-dashed border-border px-3 text-sm normal-case tracking-normal text-muted-foreground">Elige antes un campus</span>
            )}
          </div>
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {fechaRotulo} desde
            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm normal-case text-foreground outline-none dark:[color-scheme:dark] focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            hasta
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm normal-case text-foreground outline-none dark:[color-scheme:dark] focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
          <div className="min-w-[200px] flex-1 sm:max-w-[300px]">
            <Buscador id="diplomas-buscar" valor={buscar} alCambiar={setBuscar}
              placeholder={pestana === 'enviados' || pestana === 'revocados' ? 'Nombre, nº de expediente o titulación…' : 'Nombre o correo…'} />
          </div>
          {hayFiltros && (
            <button type="button" className="h-9 text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => { setCentro(''); setCurso(''); setDesde(''); setHasta(''); setBuscar(''); setFiltroAviso(''); }}>
              Limpiar filtros
            </button>
          )}
        </CardSection>
        {pestana === 'enviados' && (
          <CardSection className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Aviso al alumno:</span>
            {([['', 'Todos'], ['pendiente', 'Pendiente de aviso'], ['enviado', 'Enviado'], ['no_salio', 'No salió']] as [FiltroAviso | '', string][]).map(([k, r]) => (
              <Pestana key={k || 'todos'} activa={filtroAviso === k} onClick={() => setFiltroAviso(k)}>{r}</Pestana>
            ))}
          </CardSection>
        )}

        {/* Contenido de la pestaña */}
        {error ? (
          <EmptyState icon={Warning} title="No se pudo cargar" description={error} action={<Button size="sm" variant="outline" onClick={recargar}><ArrowClockwise size={13} className="mr-1.5" /> Reintentar</Button>} />
        ) : cargando && !solicitudes.length && !diplomas.length ? (
          <Esqueleto />
        ) : pestana === 'pendientes' ? (
          <>
            {despues.porAvisar.length > 0 && (
              <BloquePorAvisar
                filas={despues.porAvisar}
                elegidas={elegidasAviso}
                alternar={(k) => alternar(setElegidasAviso, k)}
                todas={() => setElegidasAviso(elegidasAviso.size === despues.porAvisar.length ? new Set() : new Set(despues.porAvisar.map((c) => c.nexpediente!)))}
                ocupado={trabajando}
                verPdf={(c) => c.diploma && setVisor({ d: c.diploma, enviable: true })}
                enviar={(exps) => setDialogo({ tipo: 'avisos', exps, reenvio: false })}
              />
            )}
            {despues.sinEmitir.length > 0 && (
              <div className="border-b border-border bg-info-soft/40 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Aprobados sin diploma ({despues.sinEmitir.length})</p>
                    <p className="text-xs text-muted-foreground">El visto bueno está dado, pero la emisión no terminó. Se puede reintentar.</p>
                  </div>
                  <Button size="sm" variant="secondary" disabled={trabajando} onClick={() => setDialogo({ tipo: 'emitir', ids: despues.sinEmitir.map((c) => c.matriculaId) })}>
                    <Certificate size={14} className="mr-1.5" /> Emitir {despues.sinEmitir.length}
                  </Button>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {despues.sinEmitir.slice(0, 20).map((c) => (
                    <li key={c.matriculaId}>
                      <Etiqueta tono={c.programaCrm?.programa ? 'info' : 'warning'}>
                        {nombre(c.matriculaId)} · {c.curso.nombre} · {c.programaCrm?.programa ? resumenPrograma(c.programaCrm.programa) : 'sin programa del CRM'}
                      </Etiqueta>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
              <h3 className="text-sm font-semibold">Por decidir</h3>
              <span className="text-xs text-muted-foreground">Revisa el nombre que se imprimirá antes de aprobar</span>
            </div>
            {solicitudes.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title={hayFiltros ? 'Nada coincide con los filtros' : 'No hay solicitudes por decidir'}
                description={hayFiltros ? 'Prueba con otros filtros o límpialos.' : 'Cuando un alumno termine su formación y pida su diploma desde Moodle, aparecerá aquí y sonará la campana.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="w-10 px-4 py-2 text-left"><Casilla id="diplomas-elegir-todas" etiqueta="Elegir toda la página" marcada={todas} alCambiar={() => setElegidas(todas ? new Set() : new Set(filasClave))} /></th>
                      <Th>Nombre para el diploma</Th>
                      <Th>Formación · programa a imprimir</Th>
                      <Th>Solicitado</Th>
                      <Th className="text-right">Nota · avance</Th>
                      <Th>En el CRM</Th>
                      <Th className="pr-4 text-right">Acciones</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {solicitudes.map((c) => {
                      const k = String(c.matriculaId);
                      return (
                        <tr key={k} className={cn('align-top transition-colors', elegidas.has(k) ? 'bg-primary/5' : 'hover:bg-muted/40')}>
                          <td className="px-4 py-3"><Casilla id={`diplomas-elegir-${k}`} etiqueta={`Elegir a ${nombre(c.matriculaId)}`} marcada={elegidas.has(k)} alCambiar={() => alternar(setElegidas, k)} /></td>
                          <td className="px-2 py-3">
                            <NombreDiploma c={c} />
                            <div className="mt-0.5 max-w-[280px] truncate text-xs text-muted-foreground" title={c.titular.email ?? undefined}>{c.titular.email || 'sin correo'}</div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="max-w-[260px] truncate" title={c.curso.nombre}>{c.curso.nombre}</div>
                            <div className="text-xs text-muted-foreground">{c.centro}</div>
                            <ProgramaAImprimir p={c.programaCrm} />
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 text-xs">{fecha(c.solicitud?.en)}</td>
                          <td className="px-2 py-3 text-right">
                            <div className="tabular-nums">{c.notaFinal == null ? <span className="text-muted-foreground">—</span> : <>{c.notaFinal.toLocaleString('es', { maximumFractionDigits: 2 })}{c.umbral != null && <span className="text-[11px] text-muted-foreground"> /{c.umbral}</span>}</>}</div>
                            <div className="mt-1"><Avance hechas={c.actividades.calificadas} total={c.actividades.total} /></div>
                          </td>
                          <td className="px-2 py-3"><EnElCrmEtiqueta crm={c.crm} /></td>
                          <td className="px-2 py-3 pr-4">
                            <div className="flex flex-col items-stretch gap-1.5">
                              <Button size="sm" disabled={trabajando} onClick={() => setDialogo({ tipo: 'aprobarEmitir', ids: [c.matriculaId] })}>
                                <SealCheck size={14} className="mr-1.5" /> Aprobar y emitir
                              </Button>
                              <Button size="sm" variant="outline" disabled={trabajando} onClick={() => setDialogo({ tipo: 'rechazar', ids: [c.matriculaId] })}>
                                <XCircle size={14} className="mr-1.5" /> Rechazar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : pestana === 'rechazados' ? (
          solicitudes.length === 0 ? (
            <EmptyState icon={XCircle} title={hayFiltros ? 'Nada coincide con los filtros' : 'No hay solicitudes rechazadas'}
              description={hayFiltros ? 'Prueba con otros filtros o límpialos.' : 'Lo que rechaces aparecerá aquí, con el motivo, para avisar al alumno.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="w-10 px-4 py-2 text-left"><Casilla id="diplomas-elegir-todas" etiqueta="Elegir toda la página" marcada={todas} alCambiar={() => setElegidas(todas ? new Set() : new Set(filasClave))} /></th>
                    <Th>Alumno</Th>
                    <Th>Formación</Th>
                    <Th>Motivo</Th>
                    <Th>Rechazada</Th>
                    <Th>Aviso de rechazo</Th>
                    <Th className="pr-4 text-right">Acción</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {solicitudes.map((c) => {
                    const k = String(c.matriculaId);
                    const a = c.avisoRechazo;
                    return (
                      <tr key={k} className={cn('align-top transition-colors', elegidas.has(k) ? 'bg-primary/5' : 'hover:bg-muted/40')}>
                        <td className="px-4 py-3"><Casilla id={`diplomas-elegir-${k}`} etiqueta={`Elegir a ${nombre(c.matriculaId)}`} marcada={elegidas.has(k)} alCambiar={() => alternar(setElegidas, k)} /></td>
                        <td className="px-2 py-3">
                          <NombreDiploma c={c} />
                          <div className="mt-0.5 max-w-[260px] truncate text-xs text-muted-foreground">{c.titular.email || 'sin correo'}</div>
                        </td>
                        <td className="px-2 py-3"><div className="max-w-[200px] truncate" title={c.curso.nombre}>{c.curso.nombre}</div><div className="text-xs text-muted-foreground">{c.centro}</div></td>
                        <td className="px-2 py-3"><p className="max-w-[260px] text-sm italic text-muted-foreground">«{c.decision?.motivo || 'sin motivo'}»</p></td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs">{fecha(c.decision?.decididoEn)}<div className="max-w-[160px] truncate text-muted-foreground" title={c.decision?.decididoPor}>{c.decision?.decididoPor}</div></td>
                        <td className="px-2 py-3">
                          {!a ? <StatusDot tono="neutral">Sin avisar</StatusDot>
                            : a.resultado === 'enviado' ? <StatusDot tono="success">Enviado</StatusDot>
                              : a.resultado === 'correo_apagado' ? <StatusDot tono="warning">Aprobado, correo apagado</StatusDot>
                                : <StatusDot tono="danger">{ROTULO_AVISO[a.resultado] ?? a.resultado}</StatusDot>}
                          {a && <div className="mt-0.5 max-w-[170px] truncate text-[11px] text-muted-foreground" title={a.por}>{fecha(a.en)} · {a.por}</div>}
                        </td>
                        <td className="px-2 py-3 pr-4 text-right">
                          <Button size="sm" variant={a?.resultado === 'enviado' ? 'outline' : 'secondary'} disabled={trabajando} onClick={() => setDialogo({ tipo: 'avisoRechazo', ids: [c.matriculaId] })}>
                            <Envelope size={14} className="mr-1.5" /> {a ? 'Reenviar aviso' : 'Enviar aviso de rechazo'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : diplomas.length === 0 ? (
          <EmptyState
            icon={pestana === 'enviados' ? Certificate : Prohibit}
            title={hayFiltros ? 'Nada coincide con los filtros' : pestana === 'enviados' ? 'Todavía no hay diplomas emitidos' : 'No hay diplomas revocados'}
            description={hayFiltros ? 'Prueba con otros filtros o límpialos.' : pestana === 'enviados' ? 'Al aprobar y emitir una solicitud, el diploma aparece aquí.' : 'Un diploma revocado sale aquí con su motivo, quién y cuándo.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  {pestana === 'enviados' && <th className="w-10 px-4 py-2 text-left"><Casilla id="diplomas-elegir-todas" etiqueta="Elegir toda la página" marcada={todas} alCambiar={() => setElegidas(todas ? new Set() : new Set(filasClave))} /></th>}
                  <Th className={pestana === 'revocados' ? 'pl-4' : undefined}>Alumno</Th>
                  <Th>Titulación</Th>
                  <Th>Emitido</Th>
                  {pestana === 'enviados' ? <Th>Aviso al alumno</Th> : <><Th>Revocado</Th><Th>Motivo</Th></>}
                  <Th className="pr-4 text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {diplomas.map((d) => {
                  const k = d.nexpediente;
                  return (
                    <tr key={k} className={cn('align-top transition-colors', elegidas.has(k) ? 'bg-primary/5' : 'hover:bg-muted/40')}>
                      {pestana === 'enviados' && <td className="px-4 py-3"><Casilla id={`diplomas-elegir-${k}`} etiqueta={`Elegir ${k}`} marcada={elegidas.has(k)} alCambiar={() => alternar(setElegidas, k)} /></td>}
                      <td className={cn('px-2 py-3', pestana === 'revocados' && 'pl-4')}>
                        <div className="max-w-[240px] truncate font-semibold" title={d.alumno}>{d.alumno}</div>
                        <div className="select-all font-mono text-[11px] text-primary">{d.nexpediente}</div>
                      </td>
                      <td className="px-2 py-3"><div className="max-w-[240px] truncate" title={d.titulacion}>{d.titulacion}</div><div className="text-xs text-muted-foreground">{d.centro}</div></td>
                      <td className="whitespace-nowrap px-2 py-3 text-xs">{fecha(d.emitidoEn)}<div className="max-w-[150px] truncate text-muted-foreground" title={d.emitidaPor ?? undefined}>{d.emitidaPor}</div></td>
                      {pestana === 'enviados' ? (
                        <td className="px-2 py-3"><EstadoAviso d={d} /></td>
                      ) : (
                        <>
                          <td className="whitespace-nowrap px-2 py-3 text-xs">{fecha(d.revocacion?.en)}<div className="max-w-[160px] truncate text-muted-foreground" title={d.revocacion?.por ?? undefined}>{d.revocacion?.por || '—'}</div></td>
                          <td className="px-2 py-3"><p className="max-w-[260px] text-sm italic text-muted-foreground">«{d.revocacion?.motivo || 'sin motivo'}»</p></td>
                        </>
                      )}
                      <td className="px-2 py-3 pr-4">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {pestana === 'enviados' && (
                            <Button size="sm" variant={d.aviso ? 'outline' : 'default'} disabled={trabajando}
                              onClick={() => setDialogo({ tipo: 'avisos', exps: [d.nexpediente], reenvio: !!d.aviso })}>
                              <PaperPlaneTilt size={14} className="mr-1.5" /> {d.aviso ? 'Reenviar' : 'Enviar al alumno'}
                            </Button>
                          )}
                          <IconoAccion etiqueta="Ver PDF" onClick={() => setVisor({ d, enviable: pestana === 'enviados' && !d.aviso })}><FilePdf size={15} /></IconoAccion>
                          <IconoAccion etiqueta="Copiar enlace de verificación" onClick={() => copiarEnlace(d)}><LinkSimple size={15} /></IconoAccion>
                          {pestana === 'enviados' && (
                            <>
                              <IconoAccion etiqueta="Corregir nombre" disabled={trabajando} onClick={() => setDialogo({ tipo: 'corregir', d })}><PencilSimple size={15} /></IconoAccion>
                              <IconoAccion etiqueta="Revocar" peligro disabled={trabajando} onClick={() => setDialogo({ tipo: 'revocar', d })}><Prohibit size={15} /></IconoAccion>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && !error && (
          <CardSection className="flex flex-wrap items-center justify-between gap-2 border-t text-xs text-muted-foreground">
            <span>{total.toLocaleString('es')} {total === 1 ? 'fila' : 'filas'}{cargando ? ' · cargando…' : ''}</span>
            {paginas > 1 && (
              <span className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
                {pagina} / {paginas}
                <Button variant="outline" size="sm" disabled={pagina >= paginas || cargando} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
              </span>
            )}
          </CardSection>
        )}
      </Card>

      {/* Barra de acciones en bloque */}
      {elegidas.size > 0 && (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-card px-4 py-3 shadow-lg">
          <span className="text-sm font-semibold">{elegidas.size} {elegidas.size === 1 ? 'elegida' : 'elegidas'}</span>
          <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground" onClick={() => setElegidas(new Set())}>Quitar selección</button>
          <div className="ml-auto flex flex-wrap gap-2">
            {pestana === 'pendientes' && (
              <>
                <Button variant="outline" size="sm" disabled={trabajando} onClick={() => setDialogo({ tipo: 'rechazar', ids: [...elegidas].map(Number) })}>
                  <XCircle size={14} className="mr-1.5" /> Rechazar ({elegidas.size})
                </Button>
                <Button size="sm" disabled={trabajando} onClick={() => setDialogo({ tipo: 'aprobarEmitir', ids: [...elegidas].map(Number) })}>
                  <SealCheck size={14} className="mr-1.5" />
                  {trabajando && lote ? `Emitiendo ${lote.hechas} de ${lote.total}…` : `Aprobar y emitir (${elegidas.size})`}
                </Button>
              </>
            )}
            {pestana === 'rechazados' && (
              <Button size="sm" variant="secondary" disabled={trabajando} onClick={() => setDialogo({ tipo: 'avisoRechazo', ids: [...elegidas].map(Number) })}>
                <Envelope size={14} className="mr-1.5" /> Enviar aviso de rechazo ({elegidas.size})
              </Button>
            )}
            {pestana === 'enviados' && (
              <Button size="sm" disabled={trabajando || enviables.length === 0} onClick={() => setDialogo({ tipo: 'avisos', exps: enviables, reenvio: true })}>
                <PaperPlaneTilt size={14} className="mr-1.5" />
                {trabajando && lote ? `Enviando ${lote.hechas} de ${lote.total}…` : `Enviar al alumno (${enviables.length})`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Confirmaciones */}
      <ConfirmDialog
        open={dialogo?.tipo === 'aprobarEmitir' || dialogo?.tipo === 'emitir'}
        title={dialogo?.tipo === 'aprobarEmitir' ? `Aprobar y emitir ${dialogo.ids.length}` : dialogo?.tipo === 'emitir' ? `Emitir ${dialogo.ids.length}` : ''}
        message={
          <>
            {dialogo?.tipo === 'aprobarEmitir' ? 'Se aprueban y se emite su diploma en Certifex con el nombre que escribió cada alumno. ' : 'Se emite el diploma de lo ya aprobado. '}
            <strong>No se avisa al alumno</strong>: el diploma queda pendiente de aviso hasta que revises el PDF y lo envíes. Cada diploma gasta un número de expediente en un registro que no se borra. Queda a tu nombre.
          </>
        }
        confirmLabel="Emitir"
        tone="warning"
        loading={trabajando}
        onCancel={() => setDialogo(null)}
        onConfirm={() => {
          const d = dialogo;
          setDialogo(null);
          if (d?.tipo === 'aprobarEmitir') void aprobarEmitir(d.ids);
          else if (d?.tipo === 'emitir') void emitir(d.ids);
        }}
      />
      <ConfirmDialog
        open={dialogo?.tipo === 'avisos'}
        title={dialogo?.tipo === 'avisos' ? (dialogo.exps.length === 1 ? (dialogo.reenvio ? 'Reenviar el diploma al alumno' : 'Enviar el diploma al alumno') : `Enviar ${dialogo.exps.length} diplomas a sus alumnos`) : ''}
        message={<>Sale un correo a cada alumno con su diploma en PDF y el enlace de verificación. Hazlo después de comprobar el PDF. Queda registrado a tu nombre.</>}
        confirmLabel={dialogo?.tipo === 'avisos' && dialogo.reenvio ? 'Reenviar' : 'Enviar'}
        tone="info"
        loading={trabajando}
        onCancel={() => setDialogo(null)}
        onConfirm={() => {
          const d = dialogo;
          setDialogo(null);
          if (d?.tipo === 'avisos') void enviarAvisos(d.exps);
        }}
      />
      <ConfirmDialog
        open={dialogo?.tipo === 'avisoRechazo'}
        title={dialogo?.tipo === 'avisoRechazo' ? (dialogo.ids.length === 1 ? 'Enviar el aviso de rechazo' : `Enviar ${dialogo.ids.length} avisos de rechazo`) : ''}
        message="Sale un correo a cada alumno con el motivo del rechazo, para que pueda corregirlo y volver a pedirlo. Queda registrado a tu nombre."
        confirmLabel="Enviar aviso"
        tone="warning"
        loading={trabajando}
        onCancel={() => setDialogo(null)}
        onConfirm={() => {
          const d = dialogo;
          setDialogo(null);
          if (d?.tipo === 'avisoRechazo') void avisarRechazo(d.ids);
        }}
      />
      <PromptDialog
        open={dialogo?.tipo === 'rechazar'}
        title={dialogo?.tipo === 'rechazar' ? (dialogo.ids.length === 1 ? `Rechazar a ${nombre(dialogo.ids[0])}` : `Rechazar ${dialogo.ids.length} solicitudes`) : ''}
        message="El motivo es obligatorio: es lo que leerá el alumno si apruebas el aviso de rechazo. Rechazar no le avisa."
        placeholder="Ej.: el nombre no coincide con el de la matrícula, falta el trabajo final…"
        confirmLabel="Rechazar"
        multiline
        loading={trabajando}
        onCancel={() => setDialogo(null)}
        onConfirm={(motivo: string) => {
          const d = dialogo;
          setDialogo(null);
          if (d?.tipo === 'rechazar') void rechazar(d.ids, motivo.trim());
        }}
      />
      <PromptDialog
        open={dialogo?.tipo === 'revocar'}
        title={dialogo?.tipo === 'revocar' ? `Revocar ${dialogo.d.nexpediente}` : ''}
        message={<>La verificación pública pasará a decir «revocado», con este motivo. No se avisa al alumno. <strong>Si solo está mal el nombre, corrígelo</strong>: no hace falta revocar.</>}
        placeholder="Motivo de la revocación…"
        confirmLabel="Revocar"
        multiline
        loading={trabajando}
        onCancel={() => setDialogo(null)}
        onConfirm={(motivo: string) => {
          const d = dialogo;
          setDialogo(null);
          if (d?.tipo === 'revocar') void revocar(d.d, motivo.trim());
        }}
      />
      {dialogo?.tipo === 'corregir' && (
        <DialogoCorregir
          d={dialogo.d}
          ocupado={trabajando}
          alCancelar={() => setDialogo(null)}
          alConfirmar={(valor, motivo) => {
            const d = dialogo.d;
            setDialogo(null);
            void corregir(d, valor, motivo);
          }}
        />
      )}

      {visor && (
        <VisorPdf
          d={visor.d}
          version={versiones[visor.d.nexpediente]}
          alCerrar={() => setVisor(null)}
          alEnviar={visor.enviable ? () => { const exp = visor.d.nexpediente; setVisor(null); setDialogo({ tipo: 'avisos', exps: [exp], reenvio: false }); } : undefined}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── bloques

/** Lo emitido que espera a que alguien vea el PDF y lo envíe al alumno. */
function BloquePorAvisar({ filas, elegidas, alternar, todas, ocupado, verPdf, enviar }: {
  filas: Solicitud[];
  elegidas: Set<string>;
  alternar: (k: string) => void;
  todas: () => void;
  ocupado: boolean;
  verPdf: (c: Solicitud) => void;
  enviar: (exps: string[]) => void;
}) {
  const marcadas = filas.filter((c) => elegidas.has(c.nexpediente!)).map((c) => c.nexpediente!);
  return (
    <div className="border-b border-border bg-warning-soft/30">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div>
          <h3 className="text-sm font-semibold">Emitidos, falta enviarlos al alumno ({filas.length})</h3>
          <p className="text-xs text-muted-foreground">Revisa el PDF de cada uno; el correo sale solo cuando pulsas «Enviar».</p>
        </div>
        {marcadas.length > 0 && (
          <Button size="sm" disabled={ocupado} onClick={() => enviar(marcadas)}>
            <PaperPlaneTilt size={14} className="mr-1.5" /> Enviar {marcadas.length} al alumno
          </Button>
        )}
      </div>
      <div className="overflow-x-auto pb-1">
        <table className="mt-2 w-full min-w-[860px] text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-2 text-left"><Casilla id="diplomas-aviso-todas" etiqueta="Elegir todos los pendientes de aviso" marcada={marcadas.length === filas.length} alCambiar={todas} /></th>
              <Th>Nombre en el diploma</Th>
              <Th>Formación</Th>
              <Th>Nº de expediente</Th>
              <Th>Emitido</Th>
              <Th className="pr-4 text-right">Acciones</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filas.map((c) => {
              const k = c.nexpediente!;
              return (
                <tr key={k} className="align-top">
                  <td className="px-4 py-2.5"><Casilla id={`diplomas-aviso-${k}`} etiqueta={`Elegir ${k}`} marcada={elegidas.has(k)} alCambiar={() => alternar(k)} /></td>
                  <td className="px-2 py-2.5">
                    <div className="max-w-[260px] truncate font-semibold">{c.diploma?.alumno ?? c.solicitud?.nombre}</div>
                    <div className="max-w-[260px] truncate text-xs text-muted-foreground">{c.titular.email || 'sin correo'}</div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="max-w-[240px] truncate" title={c.curso.nombre}>{c.curso.nombre}</div>
                    <div className="text-xs text-muted-foreground">{c.centro}</div>
                    {c.programa
                      ? <Modulos programa={c.programa} rotulo={`Programa del CRM · ${resumenPrograma(c.programa)}`} />
                      : <div className="mt-1"><Etiqueta tono="neutral">Con lo de Moodle</Etiqueta></div>}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-[11px] text-primary">{k}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-xs">{fecha(c.diploma?.emitidoEn)}</td>
                  <td className="px-2 py-2.5 pr-4">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => verPdf(c)}><FilePdf size={14} className="mr-1.5" /> Ver PDF</Button>
                      <Button size="sm" disabled={ocupado} onClick={() => enviar([k])}><PaperPlaneTilt size={14} className="mr-1.5" /> Enviar diploma al alumno</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Corregir el nombre: mismo número y mismo QR, con motivo. */
function DialogoCorregir({ d, ocupado, alCancelar, alConfirmar }: {
  d: Diploma; ocupado: boolean; alCancelar: () => void; alConfirmar: (valor: string, motivo: string) => void;
}) {
  const [valor, setValor] = useState(d.alumno);
  const [motivo, setMotivo] = useState('');
  const listo = !ocupado && valor.trim().length >= 2 && valor.trim() !== d.alumno.trim() && motivo.trim().length >= 3;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && alCancelar();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [alCancelar]);
  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[80] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/60 backdrop-blur-sm" onClick={alCancelar} />
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="corregir-titulo"
          onSubmit={(e) => { e.preventDefault(); if (listo) alConfirmar(valor.trim(), motivo.trim()); }}
          className="relative flex w-full max-w-md flex-col border border-border bg-card sm:rounded-lg"
        >
          <div className="space-y-3 px-5 pb-3 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><PencilSimple size={20} /></div>
              <div className="min-w-0 flex-1">
                <h2 id="corregir-titulo" className="text-base font-semibold">Corregir el nombre</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{d.nexpediente}</span>. Mismo número y mismo QR; queda registrado quién, cuándo y por qué. No se avisa al alumno.
                </p>
              </div>
              <button type="button" onClick={alCancelar} aria-label="Cerrar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={16} /></button>
            </div>
            <label className="block text-sm">
              <span className="text-xs font-medium text-muted-foreground">Nombre correcto</span>
              <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)} maxLength={200}
                className="mt-1 h-10 w-full rounded-md border border-border bg-muted/30 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-muted-foreground">Motivo (obligatorio)</span>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} placeholder="Ej.: faltaba una tilde, el segundo apellido estaba mal…"
                className="mt-1 w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border bg-muted/20 p-4">
            <button type="button" onClick={alCancelar} className="inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={!listo} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {ocupado ? 'Procesando…' : 'Corregir'}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}

/** El PDF del diploma, traído por el servidor del CRM (Certifex no se deja incrustar). */
function VisorPdf({ d, version, alCerrar, alEnviar }: {
  d: Pick<Diploma, 'nexpediente' | 'alumno' | 'titulacion' | 'centro'>;
  version?: number;
  alCerrar: () => void;
  alEnviar?: () => void;
}) {
  const [pdf, setPdf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let vivo = true;
    emisionesApi.diploma(d.nexpediente, version)
      .then((b) => { if (vivo) { url = URL.createObjectURL(b); setPdf(url); } })
      .catch((e) => { if (vivo) setError((e as Error).message); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [d.nexpediente, version]);
  const cerrar = useCallback(() => alCerrar(), [alCerrar]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [cerrar]);
  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={cerrar}>
        <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Diploma ${d.nexpediente}`}
          className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          <div className="flex flex-wrap items-start gap-3 border-b border-border p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{d.centro} · <span className="font-mono">{d.nexpediente}</span></p>
              <h2 className="truncate font-bold">{d.alumno}</h2>
              <p className="truncate text-xs text-muted-foreground">{d.titulacion}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pdf && (
                <>
                  <Button variant="outline" size="sm" asChild><a href={pdf} target="_blank" rel="noreferrer noopener"><ArrowSquareOut size={14} className="mr-1.5" /> Abrir</a></Button>
                  <Button variant="outline" size="sm" asChild><a href={pdf} download={`${d.nexpediente}.pdf`}><DownloadSimple size={14} className="mr-1.5" /> Descargar</a></Button>
                </>
              )}
              {alEnviar && <Button size="sm" disabled={!pdf} onClick={alEnviar}><PaperPlaneTilt size={14} className="mr-1.5" /> Está bien: enviar al alumno</Button>}
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={16} weight="bold" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {error ? (
              <p className="text-sm text-destructive">No se pudo traer el diploma: {error}</p>
            ) : pdf ? (
              <iframe title={`Diploma ${d.nexpediente}`} src={pdf} className="h-[70vh] w-full rounded-md border border-border bg-muted" />
            ) : (
              <div className="h-[70vh] animate-pulse rounded-md bg-muted" />
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
