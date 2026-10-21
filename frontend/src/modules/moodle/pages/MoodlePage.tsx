import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import CampusMoodleTabs from '../components/CampusMoodle';
import TablaCursos from '../components/TablaCursos';
import DetalleCurso from '../components/DetalleCurso';

/**
 * Conexión → Moodle (#335): los cursos, alumnos y recursos de los Moodle de cada campus.
 * Solo lectura; lo mismo que Claude puede preguntar por el MCP, para verlo en pantalla.
 *
 * Tres niveles, uno dentro de otro, para que no haya nada que buscar:
 *   campus (arriba) → cursos de ese campus (tabla) → detalle de un curso (panel lateral).
 */

const ESTADOS: { value: FiltroEstado; label: string }[] = [
  { value: 'activos', label: 'Activos' },
  { value: 'proximos', label: 'Próximos' },
  { value: 'terminados', label: 'Terminados' },
  { value: 'ocultos', label: 'Ocultos' },
  { value: 'todos', label: 'Todos' },
];

const LIMITE = 25;

export default function MoodlePage() {
  const { user } = useAuth() as { user: { role?: string } | null };
  const [campus, setCampus] = useState<CampusMoodle[] | null>(null);
  const [elegido, setElegido] = useState<number | null>(null);
  const [estado, setEstado] = useState<FiltroEstado>('activos');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<CategoriaMoodle[]>([]);
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<ListaCursos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorCampus, setErrorCampus] = useState<string | null>(null);
  const [curso, setCurso] = useState<CursoMoodle | null>(null);

  const cargarCampus = useCallback(async (refrescar = false) => {
    try {
      const r = await moodleApi.campus(refrescar);
      const filas = (r.data as { campus: CampusMoodle[] }).campus;
      setCampus(filas);
      setElegido((actual) => actual ?? filas.find((c) => c.configurado)?.id ?? filas[0]?.id ?? null);
    } catch (e) {
      setCampus([]);
      toast({ title: 'No se pudo cargar Moodle', description: (e as Error).message, variant: 'destructive' });
    }
  }, []);
  useEffect(() => { cargarCampus(); }, [cargarCampus]);

  // El texto se busca medio segundo después de dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => { setBusqueda(texto.trim()); setPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [texto]);

  const actual = useMemo(() => campus?.find((c) => c.id === elegido) ?? null, [campus, elegido]);

  // Al cambiar de campus: sus categorías y empezar de cero.
  useEffect(() => {
    setCategoria(null); setPagina(1); setLista(null); setCurso(null); setCategorias([]); setErrorCampus(null);
    if (!actual?.configurado) return;
    moodleApi.categorias(actual.id)
      .then((r) => setCategorias((r.data as { categorias: CategoriaMoodle[] }).categorias))
      .catch(() => { /* sin categorías el filtro simplemente no sale; la tabla avisa si el Moodle no responde */ });
  }, [actual?.id, actual?.configurado]);

  const cargarCursos = useCallback(async (refrescar = false) => {
    if (!actual?.configurado) return;
    setCargando(true);
    setErrorCampus(null);
    try {
      const r = await moodleApi.cursos({ proyectoId: actual.id, estado, texto: busqueda, categoriaId: categoria, pagina, limite: LIMITE, refrescar });
      setLista(r.data as ListaCursos);
    } catch (e) {
      setLista(null);
      setErrorCampus((e as Error).message || 'El Moodle de este campus no responde');
    } finally { setCargando(false); }
  }, [actual?.id, actual?.configurado, estado, busqueda, categoria, pagina]);
  useEffect(() => { cargarCursos(); }, [cargarCursos]);

  const opcionesCategoria = useMemo(() => [
    { value: null as number | null, label: 'Todas las categorías' },
    ...categorias.map((c) => ({ value: c.id as number | null, label: `${'· '.repeat(Math.max(0, c.profundidad - 1))}${c.nombre} (${c.cursos})` })),
  ], [categorias]);

  const actualizar = async () => {
    await cargarCampus(true);
    await cargarCursos(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Moodle"
        subtitle="Cursos, alumnos y recursos de cada campus · solo lectura"
        actions={(
          <button type="button" onClick={actualizar} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
            <ArrowsClockwise size={15} weight="bold" /> Actualizar
          </button>
        )}
      />

      {campus === null ? (
        <SkeletonTable rows={4} columns={4} />
      ) : campus.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No tienes campus asignados" description="Cuando tengas un campus, aquí verás su Moodle." />
      ) : (
        <>
          <CampusMoodleTabs campus={campus} elegido={elegido} onElegir={setElegido} />

          {!actual?.configurado ? (
            <Card>
              <EmptyState
                icon={GraduationCap}
                title={`${actual?.nombre ?? 'Este campus'} no tiene Moodle conectado`}
                description="Se conecta guardando un token de Moodle de solo lectura en Configuración → Claves, con el servicio «Moodle del campus»."
                action={user?.role === 'superadmin' || user?.role === 'soporte'
                  ? <Link to="/configuracion/claves" className="text-sm font-semibold text-primary hover:underline">Ir a Claves</Link>
                  : <span className="text-xs text-muted-foreground">Pídeselo a un super admin.</span>}
              />
            </Card>
          ) : (
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
                <Select<FiltroEstado> ariaLabel="Estado del curso" value={estado} onChange={(v) => { setEstado(v); setPagina(1); }} options={ESTADOS} size="sm" />
                {categorias.length > 0 && (
                  <Select<number | null> ariaLabel="Categoría" value={categoria} onChange={(v) => { setCategoria(v); setPagina(1); }} options={opcionesCategoria} size="sm" />
                )}
              </div>

              {errorCampus ? (
                <div role="alert" className="m-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
                  <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">El Moodle de {actual.nombre} no ha respondido</p>
                    <p className="text-xs">{errorCampus}</p>
                    <button type="button" onClick={() => cargarCursos(true)} className="mt-1.5 text-xs font-semibold underline">Reintentar</button>
                  </div>
                </div>
              ) : cargando && !lista ? (
                <SkeletonTable rows={6} columns={5} className="border-0" />
              ) : lista && lista.total === 0 ? (
                <EmptyState icon={GraduationCap} title="Ningún curso con ese filtro" description={estado === 'activos' ? 'Prueba con «Todos» para ver también los próximos, terminados y ocultos.' : 'Cambia el estado o la búsqueda.'} />
              ) : lista ? (
                <div className={cargando ? 'opacity-60 transition-opacity' : undefined}>
                  <TablaCursos cursos={lista.cursos} total={lista.total} pagina={lista.pagina} limite={lista.limite} elegido={curso?.curso_id ?? null} onElegir={setCurso} onPagina={setPagina} />
                </div>
              ) : null}
            </Card>
          )}
        </>
      )}

      {curso && actual && <DetalleCurso curso={curso} proyectoId={actual.id} onCerrar={() => setCurso(null)} />}
    </div>
  );
}
