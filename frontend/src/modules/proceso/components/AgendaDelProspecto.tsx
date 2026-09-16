import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle, Circle, WarningCircle, CaretRight, ListChecks, SkipForward, CalendarPlus,
} from '@phosphor-icons/react';
import type { LeadStatus } from '@/shared/types';
import { soloFecha } from '@/shared/lib/fechas';
import { traerPasosDeLead, ajustarPaso, replanificar, type PasoDeLead } from '../api/agenda.api';
import { iconoDeCanal, nombreDeCanal } from '../lib/canales';
import { siguientePaso, tonoDelPaso, sePuedePlanificar, fechaAplazada, cuentaDeHechos } from '../lib/agenda';

/**
 * El proceso comercial de ESTA persona, en su ficha (#89).
 *
 * La cola del día responde «¿a quién le toca hoy?». Esto responde la otra
 * pregunta, la que se hace al abrir una ficha: «¿por dónde voy con esta
 * persona, y qué le toca ahora?». Hasta ahora había que acordarse, o mirar la
 * cola y buscarla.
 *
 * UN PASO NO SE MARCA A MANO. Se cierra solo cuando se registra un contacto:
 * el contacto n.º N cierra el paso n.º N, y eso lo hace el servidor. Aquí no
 * hay ningún botón de «hecho», y no es un olvido. Lo que sí se puede es
 * aplazarlo o saltárselo, que son decisiones de la gestora y no dependen de
 * ningún dato.
 */

function fecha(d: string) {
  return soloFecha(d)?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) ?? '';
}

/** Los aplazamientos que se usan de verdad. Para otra fecha está el calendario
    del paso, pero el 90 % de las veces es «hoy no, mañana». */
const APLAZOS = [
  { dias: 1, texto: 'Mañana' },
  { dias: 3, texto: 'En 3 días' },
  { dias: 7, texto: 'En una semana' },
];

export default function AgendaDelProspecto({
  leadId,
  estadoDelLead,
}: {
  leadId: number;
  /** Para saber si merece la pena ofrecerle una agenda a quien no la tiene. */
  estadoDelLead?: LeadStatus | string | null;
}) {
  const [pasos, setPasos] = useState<PasoDeLead[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPasos(await traerPasosDeLead(leadId));
    } catch {
      setPasos([]);
    }
  }, [leadId]);

  useEffect(() => {
    let vivo = true;
    traerPasosDeLead(leadId)
      .then((r) => { if (vivo) setPasos(r); })
      .catch(() => { if (vivo) setPasos([]); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [leadId]);

  // Después de tocar un paso se vuelve a pedir la lista entera en vez de
  // apañarla aquí: aplazar el paso 2 puede correr los que vienen detrás, y eso
  // lo decide el servidor.
  const conRecarga = async (accion: () => Promise<unknown>, queFallo: string) => {
    setOcupado(true);
    setFallo(null);
    try {
      await accion();
      await cargar();
    } catch (e: unknown) {
      const codigo = (e as { status?: number })?.status;
      setFallo(codigo === 403 ? 'No tienes permiso para cambiar este paso.' : queFallo);
    } finally {
      setOcupado(false);
    }
  };

  if (cargando) return null;

  // Sin agenda hay dos casos distintos y solo uno merece tarjeta. A quien ya
  // compró o dijo que no, su proceso se le terminó. Al que entró antes de que
  // esto existiera —solo se cargaron los últimos 30 días— se le ofrece
  // rellenarla, porque si no, no hay forma de meterlo en la cola del día.
  if (!pasos || pasos.length === 0) {
    if (!sePuedePlanificar(estadoDelLead)) return null;
    return (
      <section aria-label="Proceso comercial" className="bg-card border border-border rounded-xl p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks size={16} weight="duotone" className="text-primary" />
          Proceso comercial
        </h3>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Este prospecto no tiene el proceso planificado. Entró antes de que el CRM lo llevara.
        </p>
        {fallo && <p className="mt-2 text-[11px] text-destructive">{fallo}</p>}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => conRecarga(() => replanificar(leadId), 'No se ha podido planificar.')}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium hover:bg-muted disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <CalendarPlus size={13} weight="regular" />
          {ocupado ? 'Planificando…' : 'Planificar el proceso'}
        </button>
      </section>
    );
  }

  const siguiente = siguientePaso(pasos);
  const hechos = cuentaDeHechos(pasos);

  return (
    <section aria-label="Proceso comercial" className="bg-card border border-border rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks size={16} weight="duotone" className="text-primary" />
          Proceso comercial
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {hechos} de {pasos.length}
        </span>
      </div>

      {siguiente ? (
        <div className={
          'mb-3 rounded-lg border p-2.5 '
          + (siguiente.vencido
            ? 'border-destructive/30 bg-destructive-soft'
            : 'border-info/30 bg-info-soft')
        }>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Ahora le toca
          </p>
          <p className="mt-0.5 text-sm font-semibold">
            {siguiente.nombre || siguiente.clave}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {siguiente.vencido
              ? `Se le debía haber escrito hace ${siguiente.dias_de_retraso} ${siguiente.dias_de_retraso === 1 ? 'día' : 'días'}`
              : siguiente.dias_de_retraso === 0
                ? 'Le toca hoy'
                : `Le toca el ${fecha(siguiente.fecha_prevista)}`}
          </p>
          {(siguiente.canales || []).length > 0 && (
            <ol className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Canales, en orden">
              {siguiente.canales!.map((canal, i) => {
                const Icono = iconoDeCanal(canal);
                return (
                  <li key={canal} className="flex items-center gap-1">
                    {i > 0 && <CaretRight size={9} weight="bold" className="text-muted-foreground/50" />}
                    <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px]">
                      {Icono && <Icono size={11} />} {nombreDeCanal(canal)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {/* El mensaje de este paso dice cuantas plazas quedan, y ese numero
              NO lo lleva el CRM: lo llevan en admisiones. Aqui solo se
              recuerda, porque el documento pide comprobarlo antes de CADA
              envio y no arrastrar el del mensaje anterior. */}
          {siguiente.avisa_plazas && (
            <p className="mt-1.5 rounded bg-warning-soft px-2 py-1 text-[11px] font-medium text-warning-soft-foreground">
              Comprueba cuántas plazas quedan antes de enviar. No las lleva el CRM.
            </p>
          )}
          {siguiente.nota_del_paso && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{siguiente.nota_del_paso}</p>
          )}

          {/* Aplazar y saltar. No hay «marcar como hecho» a proposito: el paso
              lo cierra el contacto que se registre, no un boton. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
            {APLAZOS.map((a) => (
              <button
                key={a.dias}
                type="button"
                disabled={ocupado}
                onClick={() => conRecarga(
                  () => ajustarPaso(siguiente.id, { fecha_prevista: fechaAplazada(a.dias) }),
                  'No se ha podido aplazar.',
                )}
                className="rounded border border-border bg-card px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {a.texto}
              </button>
            ))}
            <button
              type="button"
              disabled={ocupado}
              onClick={() => conRecarga(
                () => ajustarPaso(siguiente.id, { estado: 'saltado' }),
                'No se ha podido saltar el paso.',
              )}
              className="ml-auto inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              title="Este paso no aplica con esta persona"
            >
              <SkipForward size={11} weight="regular" /> Saltar
            </button>
          </div>
          {fallo && <p className="mt-1.5 text-[11px] text-destructive">{fallo}</p>}
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-muted-foreground">
          No queda ningún paso pendiente con esta persona.
        </p>
      )}

      {/* Los demás, para ver por dónde va sin salir de la ficha. */}
      <ol className="space-y-1.5">
        {pasos.map((p) => {
          const tono = tonoDelPaso(p);
          const esSiguiente = siguiente?.id === p.id;
          return (
            <li key={p.id} className="flex items-start gap-2 text-[12px]">
              <span className="mt-0.5 flex-shrink-0">
                {tono === 'hecho'
                  ? <CheckCircle size={14} weight="fill" className="text-success" />
                  : tono === 'vencido'
                    ? <WarningCircle size={14} weight="fill" className="text-destructive" />
                    : <Circle size={14} className="text-muted-foreground/40" />}
              </span>
              <span className={`min-w-0 flex-1 truncate ${
                tono === 'hecho' || tono === 'saltado'
                  ? 'text-muted-foreground line-through'
                  : esSiguiente ? 'font-semibold' : 'text-muted-foreground'
              }`}>
                {p.nombre || p.clave}
              </span>
              <span className="flex-shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {tono === 'saltado' ? 'saltado' : tono === 'hecho' ? 'hecho' : fecha(p.fecha_prevista)}
              </span>
            </li>
          );
        })}
      </ol>

      <Link
        to="/prospectos/cola"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
      >
        Ver la cola del día <CaretRight size={10} weight="bold" />
      </Link>
    </section>
  );
}
