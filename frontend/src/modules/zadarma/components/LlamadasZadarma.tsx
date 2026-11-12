import { useEffect, useState } from 'react';
import { Headset } from '@phosphor-icons/react';
import { ATAJOS } from '@/shared/lib/rangosDeFecha';
import { getReporte, type ReporteLlamadas, type FilaLlamadas } from '../api/zadarma.api';

/*
  «Llamadas por Zadarma», debajo de «Actividad por comercial» (#137, #203).

  Lo que cuenta la centralita, no lo que se apunta a mano: llamadas, cuántas
  se contestaron y cuánto duraron, por gestora y periodo. El recorte lo hace
  el servidor con el mismo ámbito que Actividad por comercial: una gestora
  recibe solo su fila.

  Va en su propio bloque y no como columnas de la tabla de arriba a propósito:
  esa tabla tiene trabajo abierto (#702, #703) y lo de Zadarma solo existe en
  los campus conectados. Sin ninguno conectado en el ámbito, no se pinta.
*/

type Ambito = { projectId?: number; issuerId?: number };

const ATAJOS_LLAMADAS = ['ayer', 'esta_semana', 'este_mes', 'mes_pasado']
  .map((clave) => ATAJOS.find((a) => a.clave === clave)!);

/** 3725 → «1 h 02 min»; 125 → «2 min 05 s». */
export function duracion(seg: number): string {
  if (!seg) return '0 s';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m) return `${m} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}

const gris = (n: number) => (n ? '' : ' text-muted-foreground');

function Fila({ f, total = false }: { f: Omit<FilaLlamadas, 'user_id' | 'comercial' | 'personas'> & { comercial: string }; total?: boolean }) {
  return (
    <tr className={total ? 'border-t border-border font-semibold' : 'border-b border-border/50 last:border-0'}>
      <td className="py-2 pr-3">{f.comercial}</td>
      <td className={`py-2 px-3 text-right${gris(f.llamadas)}`}>
        {f.llamadas}
        {f.llamadas > 0 && (
          <span className="block text-xs font-normal text-muted-foreground whitespace-nowrap">
            {f.salientes} salientes · {f.entrantes} entrantes
          </span>
        )}
      </td>
      <td className={`py-2 px-3 text-right${gris(f.contestadas)}`}>{f.contestadas}</td>
      <td className={`py-2 px-3 text-right${gris(f.no_contestadas)}`}>{f.no_contestadas}</td>
      <td className={`py-2 px-3 text-right whitespace-nowrap${gris(f.segundos)}`}>{duracion(f.segundos)}</td>
      <td className={`py-2 pl-3 text-right whitespace-nowrap${gris(f.media_segundos)}`}>{duracion(f.media_segundos)}</td>
    </tr>
  );
}

export default function LlamadasZadarma({ ambito }: { ambito: Ambito }) {
  const [clave, setClave] = useState('ayer');
  const [datos, setDatos] = useState<ReporteLlamadas | null>(null);
  const [fallo, setFallo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const claveAmbito = JSON.stringify(ambito);

  useEffect(() => {
    let vivo = true;
    const { from, to } = ATAJOS_LLAMADAS.find((a) => a.clave === clave)!.calcular(new Date());
    setCargando(true);
    setFallo(false);
    getReporte(ambito, from, to)
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setFallo(true); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [claveAmbito, clave]);

  // Sin Zadarma en ningún campus del ámbito (y sin llamadas de antes): nada que enseñar.
  if (!fallo && datos && !datos.conectado && !datos.filas.length) return null;
  // Hasta saberlo, tampoco: un hueco que aparece y desaparece en cada carga molesta más.
  if (!datos && !fallo) return null;

  return (
    <section className="bg-card border border-border rounded-lg p-4" aria-labelledby="llamadas-zadarma-titulo">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 id="llamadas-zadarma-titulo" className="font-semibold text-base flex items-center gap-2">
            <Headset size={16} aria-hidden="true" /> Llamadas por Zadarma
          </h2>
          <p className="text-xs text-muted-foreground">
            Las que pasan por la centralita, apuntadas solas al colgar. Contado por la extensión que llamó o cogió, con el día de Madrid.
          </p>
        </div>
        <div className="inline-flex items-center gap-1 flex-wrap" role="group" aria-label="Periodo de las llamadas">
          {ATAJOS_LLAMADAS.map((a) => (
            <button key={a.clave} type="button" onClick={() => setClave(a.clave)} aria-pressed={clave === a.clave}
              className={
                'h-8 px-2.5 rounded-md border text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 '
                + (clave === a.clave
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground')
              }>
              {a.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {fallo ? (
        <p className="text-sm text-muted-foreground">No se pudieron cargar las llamadas.</p>
      ) : !datos!.filas.length ? (
        <p className="text-sm text-muted-foreground">Ninguna llamada por Zadarma en este periodo.</p>
      ) : (
        <div className={'overflow-x-auto' + (cargando ? ' opacity-60' : '')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Comercial</th>
                <th className="py-2 px-3 font-medium text-right">Llamadas</th>
                <th className="py-2 px-3 font-medium text-right">Contestadas</th>
                <th className="py-2 px-3 font-medium text-right whitespace-nowrap">No contestadas</th>
                <th className="py-2 px-3 font-medium text-right">Duración</th>
                <th className="py-2 pl-3 font-medium text-right whitespace-nowrap">Media (contestadas)</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {datos!.filas.map((f) => <Fila key={f.user_id ?? 'sin-asignar'} f={f} />)}
            </tbody>
            {datos!.filas.length > 1 && (
              <tfoot className="tabular-nums">
                <Fila total f={{ ...datos!.equipo, comercial: 'Equipo' }} />
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
