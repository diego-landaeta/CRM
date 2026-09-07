import { useEffect, useRef, useState } from 'react';
import {
  ChatCircleText, PaperPlaneRight, Stop, Plus, WarningCircle, Sparkle,
  TrendUp, Users, Copy, Check, ArrowRight,
} from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import Markdown from '@/shared/components/ui/Markdown';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useClaudeChat, type ChatMessage } from '../hooks/useClaudeChat';

/**
 * Preguntarle al CRM en castellano (#30).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE HASTA HOY NO HABIA PANTALLA
 *
 * El endpoint lleva meses hecho —manda por SSE, guarda la conversación, apunta
 * los tokens— y aquí había un `EmptyState` que ponía «Próximamente». O sea que
 * el día que entrara la clave de IA no habría habido dónde escribir.
 *
 * LO QUE MAS IMPORTA DE ESTA PANTALLA NO ES EL CHAT
 *
 * Es decir por qué NO se puede escribir, cuando no se puede. Hay cuatro
 * motivos —sin proyecto, sin clave, tope agotado, límite por hora— y los cuatro
 * se arreglan en sitios distintos. Antes los cuatro se veían igual: escribías,
 * pulsabas y no pasaba nada.
 *
 * POR QUE LA RESPUESTA NO VA EN BURBUJA
 *
 * La pregunta sí —es corta y es de quien la escribe, y la burbuja a la derecha
 * lo dice sin palabras—. La respuesta no: llega en markdown, con tablas y
 * listas de veinte filas, y una burbuja estrecha con una tabla dentro se lee
 * fatal. Va a ancho completo, como un documento. Es lo que hacen todos los
 * chats con IA y no es casualidad.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SUGERENCIAS = [
  { icono: Users, texto: '¿Cuántos prospectos entraron este mes y de qué canal?' },
  { icono: TrendUp, texto: 'Resume las ventas del último trimestre' },
  { icono: ChatCircleText, texto: '¿Qué prospectos llevan más tiempo sin que nadie los toque?' },
];

/** El gasto del mes, en una píldora. Verde, ámbar o rojo según lo que quede. */
function Gasto({ g }: { g: { instalado: boolean; tope: number; gastado: number | null; porcentaje: number; cerca: boolean; agotado: boolean } }) {
  if (!g.instalado) {
    return (
      <span
        title="Falta aplicar la migración 143: las llamadas no se están contando y no hay tope."
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-200/70 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-2.5 h-8 text-[11px] font-bold text-amber-700 dark:text-amber-400"
      >
        <WarningCircle size={13} weight="fill" /> Sin tope instalado
      </span>
    );
  }
  if (g.tope === 0) {
    return (
      <span className="inline-flex items-center h-8 px-2.5 text-[11px] font-medium text-muted-foreground tabular-nums">
        Sin tope · {g.gastado} USD
      </span>
    );
  }
  const agotado = g.agotado;
  const cerca = g.cerca;
  const tono = agotado
    ? 'border-red-200/70 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
    : cerca
      ? 'border-amber-200/70 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
      : 'border-border bg-card text-muted-foreground';
  const barra = agotado ? 'bg-red-500' : cerca ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <span
      title="Lo que Anthropic factura este mes. En dólares, que es como cobra."
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 h-8 text-[11px] font-bold tabular-nums ${tono}`}
    >
      {/* La barra dice de un vistazo lo que el numero dice leyendo. Con el tope
          cerca eso es la diferencia entre enterarse y no enterarse.
          A cero se deja el carril vacio: un muñon de dos pixeles parece un
          fallo de pintado, no «no has gastado nada». */}
      <span className="w-10 h-1 rounded-full bg-muted overflow-hidden" aria-hidden>
        {g.porcentaje > 0 && (
          <span
            className={`block h-full rounded-full transition-all ${barra}`}
            style={{ width: `${Math.min(100, Math.max(6, g.porcentaje))}%` }}
          />
        )}
      </span>
      {g.gastado ?? '—'} / {g.tope} USD
    </span>
  );
}

/** Copiar la respuesta. Sale al pasar por encima; confirma y vuelve solo. */
function Copiar({ texto }: { texto: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      title="Copiar la respuesta"
      onClick={async () => {
        try {
          await navigator.clipboard?.writeText(texto);
          setHecho(true);
          setTimeout(() => setHecho(false), 1600);
        } catch { /* sin portapapeles no se puede, y no pasa nada */ }
      }}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 h-6 text-[10px] font-bold text-muted-foreground hover:bg-muted"
    >
      {hecho ? <><Check size={11} weight="bold" /> Copiado</> : <><Copy size={11} /> Copiar</>}
    </button>
  );
}

/** Los tres puntos de «está escribiendo». */
function Pensando() {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground" aria-label="Pensando">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${d}ms`, animationDuration: '1s' }}
        />
      ))}
    </span>
  );
}

function Intercambio({ m }: { m: ChatMessage }) {
  // La pregunta: burbuja a la derecha, corta, de quien escribe.
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
        </div>
      </div>
    );
  }

  // La respuesta: a ancho completo, como un documento.
  return (
    <div className="group flex gap-3">
      <span className="mt-0.5 w-7 h-7 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">
        <Sparkle size={15} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {m.content && <Markdown>{m.content}</Markdown>}
        {m.streaming && <Pensando />}
        {m.error && (
          <p className="flex items-start gap-1.5 rounded-md border border-red-200/60 dark:border-red-800/40 bg-red-50 dark:bg-red-950/30 px-2.5 py-2 text-xs text-red-700 dark:text-red-400">
            <WarningCircle size={13} weight="fill" className="shrink-0 mt-px" /> {m.error}
          </p>
        )}
        {!m.streaming && m.content && !m.error && <Copiar texto={m.content} />}
      </div>
    </div>
  );
}

export default function AIChatPage() {
  const { activeProject } = useProjectContext();
  const projectId = activeProject?.id && activeProject.id > 0 ? activeProject.id : null;
  const {
    mensajes, enviando, gasto, conversaciones, conversacionId,
    porQueNoSePuede, enviar, parar, nueva, abrir,
  } = useClaudeChat(projectId);

  const [texto, setTexto] = useState('');
  const abajo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);

  // Seguir la respuesta según se escribe. Sin esto hay que arrastrar la barra
  // a mano mientras Claude contesta, que es justo cuando no apetece.
  //
  // Con `?.` en la función y no solo en el elemento: bajar la barra es una
  // comodidad, y si en algún sitio no existe `scrollIntoView` la excepción sale
  // de un efecto y se lleva por delante la conversación entera.
  useEffect(() => { abajo.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [mensajes]);

  // La caja crece con lo escrito hasta un tope y luego hace barra. Una pregunta
  // de cinco líneas en un hueco de dos se escribe a ciegas.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [texto]);

  const bloqueado = Boolean(porQueNoSePuede);

  async function mandar(t: string) {
    if (!t.trim() || bloqueado || enviando) return;
    setTexto('');
    await enviar(t);
  }

  if (!projectId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Preguntar a la IA" subtitle="Sobre los datos del CRM, en castellano." />
        <EmptyState
          icon={ChatCircleText}
          title="Elige un proyecto"
          description="Las respuestas salen de los datos de un proyecto concreto —sus prospectos, sus ventas—, así que hay que decir de cuál. Selecciónalo arriba a la izquierda."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8.5rem)] min-h-[30rem]">
      <PageHeader
        title="Preguntar a la IA"
        subtitle={`Sobre los datos de ${activeProject?.nombre || 'este proyecto'}, en castellano.`}
        actions={
          <div className="flex items-center gap-2">
            {gasto && <Gasto g={gasto} />}
            <button
              type="button"
              onClick={nueva}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-bold hover:bg-muted"
            >
              <Plus size={14} weight="bold" /> Nueva
            </button>
          </div>
        }
      />

      {/* El motivo por el que no se puede escribir, arriba y en una frase.
          Cada uno se arregla en un sitio distinto, asi que decir «no se puede»
          a secas no sirve: hay que decir CUAL de los cuatro es. */}
      {porQueNoSePuede && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-sm shadow-sm">
          <WarningCircle size={17} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{porQueNoSePuede}</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[13rem_1fr] flex-1 min-h-0">
        {/* Las conversaciones de antes. Se guardan en el servidor desde
            siempre y no habia forma de volver a ellas. */}
        <aside className="hidden xl:flex flex-col min-h-0 rounded-lg border border-border bg-card shadow-sm p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2.5 px-1">
            Anteriores
          </p>
          {!conversaciones.length ? (
            <p className="px-1 text-xs text-muted-foreground leading-relaxed">
              Todavía ninguna. Las que empieces se guardan y puedes volver a ellas.
            </p>
          ) : (
            <ul className="space-y-0.5 overflow-y-auto min-h-0 -mx-1 px-1">
              {conversaciones.map((c) => {
                const activa = c.id === conversacionId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => abrir(c.id)}
                      title={c.title || 'Sin título'}
                      className={`group w-full flex items-center gap-1.5 rounded-md px-2 py-2 text-left text-xs transition-colors ${
                        activa
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span className="truncate flex-1">{c.title || 'Sin título'}</span>
                      {!activa && (
                        <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="flex flex-col min-h-0 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
            {!mensajes.length ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 px-4 py-10 text-center">
                <div className="space-y-2 max-w-md">
                  <span className="inline-flex w-11 h-11 rounded-lg bg-primary/10 text-primary items-center justify-center">
                    <Sparkle size={22} weight="duotone" />
                  </span>
                  <h2 className="text-lg font-bold">Pregunta lo que quieras saber</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Responde con los datos de <strong className="font-semibold text-foreground">{activeProject?.nombre}</strong>.
                    Si algo no lo sabe, lo dice en vez de inventárselo.
                  </p>
                </div>
                <div className="grid gap-2 w-full max-w-lg sm:grid-cols-1">
                  {SUGERENCIAS.map(({ icono: Icono, texto: s }) => (
                    <button
                      key={s}
                      type="button"
                      disabled={bloqueado}
                      onClick={() => mandar(s)}
                      className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50 disabled:hover:bg-card"
                    >
                      <span className="w-7 h-7 shrink-0 rounded-md bg-muted text-muted-foreground flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Icono size={14} weight="duotone" />
                      </span>
                      <span className="flex-1 leading-snug">{s}</span>
                      <ArrowRight size={13} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-5 space-y-5">
                {mensajes.map((m) => <Intercambio key={m.id} m={m} />)}
                <div ref={abajo} />
              </div>
            )}
          </div>

          {/* La caja. Es un solo bloque que se ilumina entero al escribir, no un
              campo suelto con un boton al lado. */}
          <div className="border-t border-border p-3">
            <div className="rounded-lg border border-border bg-muted/40 transition-all focus-within:border-primary focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/10">
              <textarea
                ref={caja}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  // Enter manda, Mayús+Enter hace salto de línea. Es lo que la
                  // gente ya tiene en los dedos de cualquier otro chat.
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandar(texto); }
                }}
                rows={1}
                disabled={bloqueado}
                placeholder={bloqueado
                  ? 'Ahora mismo no se puede escribir — mira el aviso de arriba.'
                  : `Pregunta sobre ${activeProject?.nombre || 'este proyecto'}…`}
                className="w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-3 px-3 pb-2">
                <span className="text-[11px] text-muted-foreground">
                  <kbd className="font-sans font-semibold">Enter</kbd> envía ·{' '}
                  <kbd className="font-sans font-semibold">Mayús+Enter</kbd> salta de línea
                </span>
                {enviando ? (
                  <button
                    type="button"
                    onClick={parar}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-bold hover:bg-muted"
                  >
                    <Stop size={13} weight="fill" /> Parar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => mandar(texto)}
                    disabled={bloqueado || !texto.trim()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <PaperPlaneRight size={13} weight="fill" /> Enviar
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
