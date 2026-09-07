import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatCircleText, PaperPlaneRight, Stop, Plus, WarningCircle,
  Sparkle, ClockCounterClockwise,
} from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
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
 * Y el gasto va a la vista, no escondido. Es dinero de verdad y el issue #22
 * pide avisar antes de agotarlo, no después.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SUGERENCIAS = [
  '¿Cuántos prospectos entraron este mes y de qué canal?',
  'Resume las ventas del último trimestre',
  '¿Qué prospectos llevan más tiempo sin que nadie los toque?',
];

/** El gasto del mes, en una píldora. Verde, ámbar o rojo según lo que quede. */
function Gasto({ g }: { g: { instalado: boolean; tope: number; gastado: number | null; porcentaje: number; cerca: boolean; agotado: boolean } }) {
  if (!g.instalado) {
    return (
      <span
        title="Falta aplicar la migración 143: las llamadas no se están contando y no hay tope."
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-200/60 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400"
      >
        <WarningCircle size={12} weight="fill" /> Sin tope instalado
      </span>
    );
  }
  if (g.tope === 0) {
    return <span className="text-[11px] text-muted-foreground">Sin tope · {g.gastado} USD este mes</span>;
  }
  const tono = g.agotado
    ? 'border-red-200/60 dark:border-red-800/40 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
    : g.cerca
      ? 'border-amber-200/60 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
      : 'border-border bg-card text-muted-foreground';
  return (
    <span
      title="Lo que Anthropic factura este mes. En dólares, que es como cobra."
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold tabular-nums ${tono}`}
    >
      {g.gastado ?? '—'} / {g.tope} USD
    </span>
  );
}

/** Una burbuja. La de Claude va en markdown; la del usuario, tal cual la escribió. */
function Burbuja({ m }: { m: ChatMessage }) {
  const mio = m.role === 'user';
  return (
    <div className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-md px-3 py-2 text-sm shadow-sm ${
          mio ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
        }`}
      >
        {mio ? (
          <p className="whitespace-pre-wrap">{m.content}</p>
        ) : (
          <>
            {m.content && (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-table:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            )}
            {m.streaming && (
              <span className="inline-block w-1.5 h-4 align-middle bg-muted-foreground/60 animate-pulse rounded-sm" />
            )}
            {m.error && (
              <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                <WarningCircle size={13} weight="fill" className="shrink-0 mt-px" /> {m.error}
              </p>
            )}
          </>
        )}
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

  // Seguir la respuesta según se escribe. Sin esto hay que arrastrar la barra
  // a mano mientras Claude contesta, que es justo cuando no apetece.
  //
  // Con `?.` en la función y no solo en el elemento: bajar la barra es una
  // comodidad, y si en algún sitio no existe `scrollIntoView` la excepción sale
  // de un efecto y se lleva por delante la conversación entera. Perder el
  // desplazamiento automático es un incordio; perder el chat es otra cosa.
  useEffect(() => { abajo.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [mensajes]);

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
    <div className="space-y-4">
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
        <div className="flex items-start gap-2 rounded-md border border-amber-200/60 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
          <WarningCircle size={16} weight="fill" className="text-amber-600 shrink-0 mt-0.5" />
          <span>{porQueNoSePuede}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Las conversaciones de antes. Se guardan en el servidor desde
            siempre y no habia forma de volver a ellas. */}
        <aside className="hidden lg:block">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-2">
            <ClockCounterClockwise size={13} /> Anteriores
          </p>
          {!conversaciones.length ? (
            <p className="text-[11px] text-muted-foreground">Todavía ninguna.</p>
          ) : (
            <ul className="space-y-1">
              {conversaciones.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => abrir(c.id)}
                    title={c.title || 'Sin título'}
                    className={`w-full text-left truncate rounded-md px-2 py-1.5 text-xs hover:bg-muted ${
                      c.id === conversacionId ? 'bg-muted font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {c.title || 'Sin título'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="rounded-md border border-border bg-card shadow-sm flex flex-col min-h-[52vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!mensajes.length ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 py-8 text-center">
                <Sparkle size={28} weight="duotone" className="text-muted-foreground" />
                <div>
                  <p className="font-semibold">Pregunta lo que quieras saber</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Responde con los datos de este proyecto. Si algo no lo sabe, lo dice.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 w-full max-w-md">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={bloqueado}
                      onClick={() => mandar(s)}
                      className="rounded-md border border-border bg-card px-3 py-2 text-xs text-left hover:bg-muted disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {mensajes.map((m) => <Burbuja key={m.id} m={m} />)}
                <div ref={abajo} />
              </>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  // Enter manda, Mayús+Enter hace salto de linea. Es lo que la
                  // gente ya tiene en los dedos de cualquier otro chat.
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandar(texto); }
                }}
                rows={2}
                disabled={bloqueado}
                placeholder={bloqueado ? 'Ahora mismo no se puede escribir — mira el aviso de arriba.' : 'Escribe tu pregunta… (Enter para enviar)'}
                className="flex-1 resize-none rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
              />
              {enviando ? (
                <button
                  type="button"
                  onClick={parar}
                  title="Parar la respuesta"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-bold hover:bg-muted"
                >
                  <Stop size={14} weight="fill" /> Parar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => mandar(texto)}
                  disabled={bloqueado || !texto.trim()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <PaperPlaneRight size={14} weight="fill" /> Enviar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
