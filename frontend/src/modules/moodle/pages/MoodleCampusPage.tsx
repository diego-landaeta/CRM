import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowsClockwise, GraduationCap, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import Card from '@/shared/components/ui/Card';
import Select from '@/shared/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/shared/hooks/useToast';
import {
  moodleApi, type CampusMoodle, type CategoriaMoodle, type CursoMoodle, type FiltroEstado, type ListaCursos,
} from '../api/moodle.api';
import EstadoDeCursos from '../components/EstadoDeCursos';
import TablaCursos from '../components/TablaCursos';
import DetalleCurso from '../components/DetalleCurso';

/**
 * Conexión → Moodle → un campus (#335): sus cursos.
 *
 *   estado de los cursos (con su recuento) → buscador y categoría → tabla → detalle de un
 *   curso en un panel lateral.
 *
 * Se llega desde la lista de campus (`/conexion/moodle`), y la cabecera lleva de vuelta.
 */

const LIMITE = 25;

export default function MoodleCampusPage() {
  const { campusId } = useParams();
  const id = Number(campusId);
  const { user } = useAuth() as { user: { role?: string } | null };

  const [campus, setCampus] = useState<CampusMoodle | null | undefined>(undefined); // undefined = cargando; null = no existe
  const [estado, setEstado] = useState<FiltroEstado>('activos');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<CategoriaMoodle[]>([]);
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<ListaCursos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorMoodle, setErrorMoodle] = useState<string | null>(null);
  const [curso, setCurso] = useState<CursoMoodle | null>(null);

  const cargarCampus = useCallback(async (refrescar = false) => {
    try {
      const r = await moodleApi.campus({ proyectoId: id, refrescar });
      setCampus((r.data as { campus: CampusMoodle[] }).campus[0] ?? null);
    } catch (e) {
      // 403: el campus no es suyo (o no existe). No se distingue: no se le dice cuáles hay.
      setCampus(null);
      if (!/acceso/i.test((e as Error).message)) toast({ title: 'No se pudo cargar el campus', description: (e as Error).message, variant: 'destructive' });
    }
  }, [id]);
  useEffect(() => { setCampus(undefined); cargarCampus(); }, [cargarCampus]);

  // Medio segundo después de dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(texto.trim()); setPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [texto]);

  const conectado = !!campus?.configurado;

  useEffect(() => {
    setCategorias([]); setCategoria(null); setCurso(null); setLista(null); setErrorMoodle(null); setPagina(1);
    if (!conectado) return;
    moodleApi.categorias(id)
      .then((r) => setCategorias((r.data as { categorias: CategoriaMoodle[] }).categorias))
      .catch(() => { /* sin categorías el filtro no sale; la tabla avisa si el Moodle no responde */ });
  }, [id, conectado]);

  const cargarCursos = useCallback(async (refrescar = false) => {
    if (!conectado) return;
    setCargando(true);
    setErrorMoodle(null);
    try {
      const r = await moodleApi.cursos({ proyectoId: id, estado, texto: busqueda, categoriaId: categoria, pagina, limite: LIMITE, refrescar });
      setLista(r.data as ListaCursos);
    } catch (e) {
      setLista(null);
      setErrorMoodle((e as Error).message || 'El Moodle de este campus no responde');
    } finally { setCargando(false); }
  }, [id, conectado, estado, busqueda, categoria, pagina]);
  useEffect(() => { cargarCursos(); }, [cargarCursos]);

  const opcionesCategoria = useMemo(() => [
    { value: null as number | null, label: 'Todas las categorías' },
    ...categorias.map((c) => ({ value: c.id as number | null, label: `${'· '.repeat(Math.max(0, c.profundidad - 1))}${c.nombre} (${c.cursos})` })),
  ], [categorias]);

  const actualizar = async () => { await cargarCampus(true); await cargarCursos(true); };

  const cabecera = (
    <PageHeader
      title={campus?.nombre ?? 'Moodle'}
      subtitle="Cursos de su Moodle · solo lectura"
      backTo="/conexion/moodle"
      backLabel="Moodle"
      actions={conectado && (
        <button type="button" onClick={actualizar} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
          <ArrowsClockwise size={15} weight="bold" /> Actualizar
        </button>
      )}
    />
  );

  if (campus === undefined) return <div className="space-y-4">{cabecera}<SkeletonTable rows={6} columns={5} /></div>;

  if (campus === null || !Number.isInteger(id)) {
    return (
      <div className="space-y-4">
        {cabecera}
        <Card><EmptyState icon={GraduationCap} title="Este campus no existe o no tienes acceso" description="Elige uno de la lista de campus." action={<Link to="/conexion/moodle" className="text-sm font-semibold text-primary hover:underline">Volver a los campus</Link>} /></Card>
      </div>
    );
  }

  if (!campus.configurado) {
    return (
      <div className="space-y-4">
        {cabecera}
        <Card>
          <EmptyState
            icon={GraduationCap}
            title={`${campus.nombre} no tiene Moodle conectado`}
            description="Se conecta guardando un token de Moodle de solo lectura en Configuración → Claves, con el servicio «Moodle del campus»."
            action={user?.role === 'superadmin' || user?.role === 'soporte'
              ? <Link to="/configuracion/claves" className="text-sm font-semibold text-primary hover:underline">Ir a Claves</Link>
              : <span className="text-xs text-muted-foreground">Pídeselo a un super admin.</span>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cabecera}
      <EstadoDeCursos valor={estado} cursos={campus.cursos} onChange={(e) => { setEstado(e); setPagina(1); }} />

      <Card padding="none" overflowHidden>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-[14rem] flex-1">
            <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar un curso por su nombre…"
              aria-label="Buscar un curso"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {categorias.length > 0 && (
            <Select<number | null> ariaLabel="Categoría" value={categoria} onChange={(v) => { setCategoria(v); setPagina(1); }} options={opcionesCategoria} size="sm" />
          )}
        </div>

        {errorMoodle ? (
          <div role="alert" className="m-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
            <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">El Moodle de {campus.nombre} no ha respondido</p>
              <p className="text-xs">{errorMoodle}</p>
              <button type="button" onClick={() => cargarCursos(true)} className="mt-1.5 text-xs font-semibold underline">Reintentar</button>
            </div>
          </div>
        ) : cargando && !lista ? (
          <SkeletonTable rows={6} columns={5} className="border-0" />
        ) : lista && lista.total === 0 ? (
          <EmptyState icon={GraduationCap} title="Ningún curso con ese filtro" description="Cambia el estado, la categoría o la búsqueda." />
        ) : lista ? (
          <div className={cargando ? 'opacity-60 transition-opacity' : undefined}>
            <TablaCursos cursos={lista.cursos} total={lista.total} pagina={lista.pagina} limite={lista.limite} elegido={curso?.curso_id ?? null} onElegir={setCurso} onPagina={setPagina} />
          </div>
        ) : null}
      </Card>

      {curso && <DetalleCurso curso={curso} proyectoId={id} onCerrar={() => setCurso(null)} />}
    </div>
  );
}
