import { useEffect, useState } from 'react';
import { Copy, Check, WhatsappLogo, EnvelopeSimple, Paperclip, CaretDown } from '@phosphor-icons/react';
import { traerPlantillasDelPaso, type PlantillaDePaso, type PlantillasDelPaso as Datos } from '../api/agenda.api';

/**
 * Las plantillas del paso que toca, listas para copiar (#88).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SE COPIAN. NO HAY BOTÓN DE ENVIAR, Y ES A PROPÓSITO
 *
 * El documento comercial: «natural antes que literal; la plantilla marca el
 * orden, las palabras las pones tú». Un botón de enviar convierte diez
 * conversaciones distintas en diez mensajes idénticos, y entonces la plantilla
 * deja de servir para lo que se escribió.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOS [CORCHETES] SE VEN
 *
 * Lo que el CRM sabe ya viene puesto. Lo que queda entre corchetes es lo que
 * la gestora escribe antes de enviar —el plan de pagos, las plazas—, y se
 * pinta marcado para que no se cuele un «[importe]» en un WhatsApp. Ha pasado.
 *
 * Los mensajes van PARTIDOS como en el documento: el día 2 son tres y el día 3
 * son dos. «Si no cabe en la pantalla del móvil sin desplazarse, parte el
 * mensaje». Por eso cada uno tiene su botón y no hay un «copiarlo todo».
 */

/** Resalta lo que queda por escribir a mano. */
function ConCorchetes({ texto }: { texto: string }) {
  const trozos = texto.split(/(\[[^\]\n]{1,40}\])/g);
  return (
    <>
      {trozos.map((t, i) => (
        /^\[.+\]$/.test(t)
          ? (
            <mark key={i} className="rounded bg-amber-200 px-0.5 font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
              {t}
            </mark>
          )
          : <span key={i}>{t}</span>
      ))}
    </>
  );
}

function Plantilla({ p }: { p: PlantillaDePaso }) {
  const [copiada, setCopiada] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const texto = p.asunto ? `${p.asunto}\n\n${p.texto}` : p.texto;
  const aMano = (texto.match(/\[[^\]\n]{1,40}\]/g) || []).length;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 1800);
    } catch {
      // Sin permiso de portapapeles —o sin HTTPS— el texto sigue estando a la
      // vista para seleccionarlo a mano. Se abre, que es lo único que se puede
      // hacer por ella.
      setAbierta(true);
    }
  }

  return (
    <li className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <CaretDown
            size={11} weight="bold"
            className={`flex-shrink-0 text-muted-foreground transition-transform ${abierta ? '' : '-rotate-90'}`}
          />
          <span className="truncate text-[12px] font-medium">{p.label}</span>
          {p.pide_adjunto && (
            <span title="Va con adjunto" className="flex-shrink-0 text-muted-foreground">
              <Paperclip size={11} />
            </span>
          )}
          {aMano > 0 && (
            <span className="flex-shrink-0 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              {aMano} a mano
            </span>
          )}
        </button>
        <button
          type="button" onClick={copiar}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] font-medium hover:bg-muted"
        >
          {copiada
            ? <><Check size={11} weight="bold" className="text-emerald-600" /> Copiada</>
            : <><Copy size={11} /> Copiar</>}
        </button>
      </div>

      {abierta && (
        <div className="border-t border-border px-2.5 py-2">
          {p.asunto && (
            <p className="mb-1 text-[11px] font-semibold">
              <ConCorchetes texto={p.asunto} />
            </p>
          )}
          <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
            <ConCorchetes texto={p.texto} />
          </p>
          {p.pista && <p className="mt-1.5 text-[10px] italic text-muted-foreground">{p.pista}</p>}
        </div>
      )}
    </li>
  );
}

export default function PlantillasDelPaso({ leadId, clave }: { leadId: number; clave: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);

  useEffect(() => {
    let vivo = true;
    traerPlantillasDelPaso(leadId, clave)
      .then((r) => { if (vivo) setDatos(r); })
      .catch(() => { if (vivo) setDatos({ whatsapp: [], email: [] }); });
    return () => { vivo = false; };
  }, [leadId, clave]);

  // Un paso sin plantillas NO es un fallo: hay pasos que son una llamada. No
  // se pinta nada, ni un «no hay plantillas» que solo ocupa sitio.
  if (!datos || (datos.whatsapp.length === 0 && datos.email.length === 0)) return null;

  return (
    <div className="mt-2.5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Para copiar
      </p>
      <ul className="space-y-1">
        {datos.whatsapp.map((p) => <Plantilla key={`w${p.id}`} p={p} />)}
        {datos.email.map((p) => <Plantilla key={`e${p.id}`} p={p} />)}
      </ul>
      <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <WhatsappLogo size={10} /><EnvelopeSimple size={10} />
        Se copian para editarlas. El orden es el del proceso; las palabras, tuyas.
      </p>
    </div>
  );
}
