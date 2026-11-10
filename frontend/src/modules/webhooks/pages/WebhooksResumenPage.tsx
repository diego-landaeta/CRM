import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ArrowsLeftRight, ArrowSquareOut, WebhooksLogo } from '@phosphor-icons/react';
import { useProjectContext } from '@/contexts/ProjectContext';
import usePermission from '@/shared/hooks/usePermission';
import { useProyectosDelAmbito } from '@/shared/hooks/useAmbito';
import { ponerAmbito, TODOS_LOS_PROYECTOS } from '@/shared/lib/ambitoInforme';
import { moduloEncendido } from '@/shared/lib/modulos';
import { formatDateTime } from '@/shared/lib/format';
import Card from '@/shared/components/ui/Card';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import StatusDot from '@/shared/components/ui/StatusDot';
import {
  GRUPOS, campusDelTipo, crearPedidor, ordenarFilas, tiposVisibles,
  type Campus, type FilaWebhook, type TipoWebhook,
} from '../lib/resumen';

/** Peticiones a la vez entre todas las tarjetas. */
const A_LA_VEZ = 6;

/*
  Conexión › Webhooks › Resumen (#690). Todos los webhooks del ámbito de arriba
  —un campus, una empresa o «Todos»— agrupados por su función. Cada tarjeta
  dice qué hace, si entra o sale, de qué campus es, si está encendido, cuándo
  llegó o salió el último aviso y si falló, y lleva a la pantalla donde se
  configura. La lógica de qué se lee de cada uno está en ../lib/resumen.
*/

type Estado = { cargando: boolean; filas: FilaWebhook[]; error?: string };

export default function WebhooksResumenPage() {
  const { activeProject, activeIssuerId, activeIssuer, switchProject } = useProjectContext() as {
    activeProject: { id?: number | null; nombre?: string; modules?: Campus['modules']; sociedad_emisora_id?: number | null } | null;
    activeIssuerId: number | null;
    activeIssuer: { nombre?: string } | null;
    switchProject?: (id: number) => void;
  };
  const { can, tieneRol } = usePermission();
  const delAmbito = useProyectosDelAmbito<Campus & { sociedad_emisora_id?: number | null }>();

  const campusFijo = !activeIssuerId && activeProject?.id && activeProject.id !== TODOS_LOS_PROYECTOS
    ? { id: activeProject.id, nombre: activeProject.nombre || '', modules: activeProject.modules, empresaId: activeProject.sociedad_emisora_id ?? null }
    : null;
  const campus = useMemo<Campus[]>(
    () => (campusFijo ? [campusFijo] : delAmbito.map((c) => ({
      id: c.id, nombre: c.nombre, modules: c.modules, empresaId: c.sociedad_emisora_id ?? null,
    }))),
    [campusFijo?.id, campusFijo?.nombre, campusFijo?.modules, campusFijo?.empresaId, delAmbito], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const nombreAmbito = activeIssuerId ? (activeIssuer?.nombre || 'esta empresa')
    : campusFijo ? (campusFijo.nombre || 'este campus') : 'todos los campus';

  // Un tipo cuyo módulo está apagado en todos los campus del ámbito no sale.
  const porPermiso = useMemo(() => tiposVisibles(can, moduloEncendido, undefined, tieneRol), [can, tieneRol]);
  const tipos = useMemo(
    () => porPermiso.filter((t) => !t.moduloCampus || campusDelTipo(t, campus).length > 0),
    [porPermiso, campus],
  );
  const [estados, setEstados] = useState<Record<string, Estado>>({});

  // Los campus y sus módulos: si cambia cualquiera, se vuelve a pedir.
  const claveCampus = campus.map((c) => `${c.id}:${JSON.stringify(c.modules || {})}`).join(',');
  useEffect(() => {
    let vivo = true;
    // Al cambiar de ámbito (o salir), lo pendiente se cancela: no se sigue
    // pidiendo lo de un ámbito que ya no se mira.
    const corte = new AbortController();
    const pedir = crearPedidor(A_LA_VEZ, corte.signal);
    const ambito = ponerAmbito(new URLSearchParams(), { activeIssuerId, activeProject });
    setEstados(Object.fromEntries(tipos.map((t) => [t.id, { cargando: true, filas: [] }])));
    for (const t of tipos) {
      t.cargar({ campus: campusDelTipo(t, campus), ambito, pedir })
        .then((filas) => { if (vivo) setEstados((e) => ({ ...e, [t.id]: { cargando: false, filas } })); })
        .catch((err: any) => {
          if (vivo) setEstados((e) => ({ ...e, [t.id]: { cargando: false, filas: [], error: err?.data?.error || 'No se pudo leer' } }));
        });
    }
    return () => { vivo = false; corte.abort(); };
  }, [claveCampus, activeIssuerId, activeProject?.id, tipos.map((t) => t.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // La ficha de un webhook es de un campus: con «Todos» o una empresa, el muro
  // pararía el enlace. Se elige arriba ese campus y se entra.
  const alAbrir = (fila: FilaWebhook) => {
    if (fila.campusId && !campusFijo && switchProject) switchProject(fila.campusId);
  };

  if (!tipos.length) {
    // Por qué no hay nada: los permisos, o que en estos campus están apagados.
    return porPermiso.length ? (
      <EmptyState
        icon={WebhooksLogo}
        title="Sin webhooks en estos campus"
        description="Los webhooks que puedes ver tienen su módulo apagado en los campus elegidos arriba. Prueba con otro campus o empresa."
      />
    ) : (
      <EmptyState
        icon={WebhooksLogo}
        title="No tienes webhooks que ver"
        description="Ningún tipo de webhook está en tus permisos. Si lo necesitas, pídelo a quien gestiona los roles."
      />
    );
  }

  // Lo que falla y lo que no se pudo leer, por separado: un campus que no
  // contesta no es un webhook que falla.
  const fallan = Object.values(estados).reduce((n, e) => n + e.filas.filter((f) => f.fallo).length, 0);
  const sinLeer = Object.values(estados).reduce((n, e) => n + (e.error ? 1 : 0) + e.filas.filter((f) => f.sinLeer && !f.fallo).length, 0);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Webhooks"
        subtitle={(
          <>
            Todos los de {nombreAmbito}, por lo que hacen. Se configuran en su pantalla: el enlace de cada tarjeta.
            {fallan > 0 && <span className="ml-1 font-semibold text-destructive">{fallan} con fallos.</span>}
            {sinLeer > 0 && <span className="ml-1 font-semibold text-warning">{sinLeer} sin poder leer.</span>}
          </>
        )}
      />

      {GRUPOS.map((g) => {
        // Lo que solo sale si tiene algo (los tokens antiguos) no ocupa sitio vacío.
        const suyos = tipos.filter((t) => t.grupo === g.id
          && !(t.ocultarSiVacio && estados[t.id] && !estados[t.id].cargando && !estados[t.id].error && !estados[t.id].filas.length));
        if (!suyos.length) return null;
        return (
          <section key={g.id} aria-labelledby={`grupo-${g.id}`} className="space-y-3">
            <div>
              <h2 id={`grupo-${g.id}`} className="text-base font-bold">{g.titulo}</h2>
              <p className="text-xs text-muted-foreground">{g.detalle}</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {suyos.map((t) => <TarjetaTipo key={t.id} tipo={t} estado={estados[t.id]} alAbrir={alAbrir} conCampus={!!campusFijo} />)}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Relacionado:{' '}
        <Link to="/conexion/conectores" className="text-primary hover:underline">Conectores</Link> (mapeo de campos) ·{' '}
        <Link to="/prospectos/revision-duplicados" className="text-primary hover:underline">Revisión de duplicados</Link> (repetidos por webhook).
        Las consultas que se leen del Moodle de cada campus no son un webhook: el CRM las pide, no le llegan.
      </p>
    </div>
  );
}

/** Filas que se ven de entrada; el resto, al pulsar (formularios: pueden ser cientos). */
const A_LA_VISTA = 8;

function TarjetaTipo({ tipo, estado, alAbrir, conCampus }: {
  tipo: TipoWebhook; estado?: Estado; alAbrir: (f: FilaWebhook) => void; conCampus: boolean;
}) {
  const [todas, setTodas] = useState(false);
  const filas = estado ? ordenarFilas(estado.filas) : [];
  // Lo que falla va primero (`ordenarFilas`): recortar nunca esconde un fallo.
  const aLaVista = todas ? filas : filas.slice(0, Math.max(A_LA_VISTA, filas.filter((f) => f.fallo).length));
  const Flecha = tipo.direccion === 'entra' ? ArrowDownLeft : tipo.direccion === 'sale' ? ArrowUpRight : ArrowsLeftRight;
  const direccion = { entra: 'Entra al CRM', sale: 'Sale del CRM', ambos: 'Entra y sale' }[tipo.direccion];
  return (
    <Card className="flex flex-col gap-3" data-testid={`tipo-${tipo.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold leading-tight">{tipo.titulo}</h3>
          <p className="text-sm text-muted-foreground">{tipo.queHace}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-semibold">
          <Flecha size={12} weight="bold" aria-hidden />
          {direccion}
        </span>
      </div>

      <div role="status" aria-live="polite">
        {!estado || estado.cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : estado.error ? (
          <p className="text-sm text-destructive">No se pudo leer: {estado.error}</p>
        ) : !filas.length ? (
          <p className="text-sm text-muted-foreground">Ninguno en este ámbito.</p>
        ) : (
          <>
            <ul className="divide-y divide-border text-sm">
              {aLaVista.map((f) => <FilaDeWebhook key={f.clave} fila={f} alAbrir={alAbrir} />)}
            </ul>
            {filas.length > aLaVista.length && (
              <button type="button" onClick={() => setTodas(true)} className="mt-1 text-xs font-semibold text-primary hover:underline">
                Ver los {filas.length} ({filas.length - aLaVista.length} más)
              </button>
            )}
          </>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{tipo.nota}</span>
        {/* Su pantalla es de un campus y no hay uno elegido: el muro pararía el
            enlace. Se dice qué hacer; cada fila ya entra eligiendo el suyo. */}
        {!tipo.enlace ? null : tipo.deUnCampus && !conCampus ? (
          <span className="text-muted-foreground">
            {filas.length ? 'Para configurarlo, pulsa uno o elige un campus arriba.' : 'Para configurarlo, elige un campus arriba.'}
          </span>
        ) : (
          <Link to={tipo.enlace} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            aria-label={`Configurar ${tipo.titulo}`}>
            Configurar <ArrowSquareOut size={12} aria-hidden />
          </Link>
        )}
      </div>
    </Card>
  );
}

function FilaDeWebhook({ fila, alAbrir }: { fila: FilaWebhook; alAbrir: (f: FilaWebhook) => void }) {
  const estado = fila.activo === null ? null
    : <StatusDot tono={fila.activo ? 'success' : 'neutral'}>{fila.activo ? 'Activo' : 'Apagado'}</StatusDot>;
  const ultimo = fila.ultimo === undefined ? null
    : fila.ultimo ? `Último aviso: ${formatDateTime(fila.ultimo)}` : 'Sin avisos todavía';
  // Solo un clic normal elige el campus: Ctrl/Cmd/Mayús + clic o el botón
  // central abren otra pestaña, y no deben cambiar el selector de esta.
  const nombre = fila.enlace
    ? (
      <Link
        to={fila.enlace}
        onClick={(e) => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) alAbrir(fila); }}
        className="font-semibold hover:underline"
      >
        {fila.nombre}
      </Link>
    )
    : <span className="font-semibold">{fila.nombre}</span>;
  const corto = fila.fallo && fila.fallo.length > 80 ? `${fila.fallo.slice(0, 80)}…` : fila.fallo;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span className="min-w-0 flex-1">
        {nombre}
        {fila.campus && <span className="text-muted-foreground"> · {fila.campus}</span>}
      </span>
      {estado}
      {ultimo && <span className="text-xs text-muted-foreground">{ultimo}</span>}
      {fila.detalle && <span className="text-xs text-muted-foreground">{fila.detalle}</span>}
      {fila.sinLeer && <span className="text-xs text-warning">{fila.sinLeer}</span>}
      {fila.aviso && <span className="text-xs text-warning">{fila.aviso}</span>}
      {/* El texto entero, para el lector de pantalla; el recortado, a la vista. */}
      {fila.fallo && (corto === fila.fallo ? (
        <StatusDot tono="danger" title={fila.fallo}>Falló: {fila.fallo}</StatusDot>
      ) : (
        <StatusDot tono="danger" title={fila.fallo}>
          <span aria-hidden>Falló: {corto}</span>
          <span className="sr-only">Falló: {fila.fallo}</span>
        </StatusDot>
      ))}
    </li>
  );
}
