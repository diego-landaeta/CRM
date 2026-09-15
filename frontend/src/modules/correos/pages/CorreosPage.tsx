import { useCallback, useEffect, useState } from 'react';
import {
  EnvelopeSimple, MagnifyingGlass, X, ArrowClockwise, Warning, PaperPlaneTilt, Prohibit,
} from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Button } from '@/shared/components/ui/button';
import RangoRapido from '@/shared/components/ui/RangoRapido';
import { correosApi, type CorreoEnLista, type CorreoCompleto } from '../api/correos.api';

/**
 * La bandeja del CRM: lo que ha mandado, con su texto. Primera mitad del #146.
 *
 * Nace de una pregunta de Ángel: por qué los correos del CRM no salen en la
 * bandeja de salida del webmail. Porque Brevo los manda EN NOMBRE de la
 * dirección, no DESDE ella — no pasan por Hostinger y su carpeta de enviados no
 * se entera. Hasta ahora el único sitio donde mirarlos era el panel de Brevo,
 * fuera del CRM, teniéndolo todo apuntado en casa.
 *
 * Aquello ya está arreglado por otro lado —los correos que salen del buzón van
 * por su SMTP y se archivan en «Enviados»— pero esta pantalla sigue haciendo
 * falta: en el webmail solo está lo de ESA dirección, y aquí está todo lo que
 * manda el CRM, incluido lo que no llegó a salir.
 *
 * LO RECIBIDO NO ESTÁ TODAVÍA, y la pantalla lo dice en vez de disimularlo:
 * hace falta decidir si entra por Brevo Inbound o por IMAP contra Hostinger.
 */

const ESTADOS = [
  { clave: '', rotulo: 'Todos', icono: EnvelopeSimple },
  { clave: 'enviado', rotulo: 'Enviados', icono: PaperPlaneTilt },
  { clave: 'bloqueado', rotulo: 'Frenados', icono: Prohibit },
  { clave: 'fallido', rotulo: 'Fallidos', icono: Warning },
] as const;

const COLOR: Record<string, string> = {
  enviado: 'text-emerald-600 dark:text-emerald-400',
  bloqueado: 'text-amber-600 dark:text-amber-400',
  fallido: 'text-red-600 dark:text-red-400',
};

const cuando = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} `
    + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function CorreosPage() {
  const [filas, setFilas] = useState<CorreoEnLista[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState('');
  const [busca, setBusca] = useState('');
  const [rango, setRango] = useState({ from: '', to: '' });
  const [abierto, setAbierto] = useState<CorreoCompleto | null>(null);
  const [abriendo, setAbriendo] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await correosApi.listar({
        estado: estado || null, busca: busca || null,
        desde: rango.from || null, hasta: rango.to || null,
      });
      if (r.success) { setFilas(r.data.filas); setTotal(r.data.total); }
    } finally { setCargando(false); }
  }, [estado, busca, rango.from, rango.to]);

  // Al escribir no se pide en cada tecla: se espera a que pare.
  useEffect(() => {
    const t = setTimeout(cargar, busca ? 350 : 0);
    return () => clearTimeout(t);
  }, [cargar, busca]);

  async function abrir(c: CorreoEnLista) {
    setAbriendo(c.id);
    try {
      const r = await correosApi.uno(c.id);
      if (r.success) setAbierto(r.data);
    } finally { setAbriendo(null); }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Correos"
        subtitle="Lo que ha mandado el CRM, con su texto · los que salen del buzón quedan también en «Enviados»"
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {ESTADOS.map(({ clave, rotulo, icono: Icono }) => (
            <button
              key={clave || 'todos'}
              type="button"
              aria-pressed={estado === clave}
              onClick={() => setEstado(clave)}
              className={`h-8 px-3 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                estado === clave
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <Icono size={13} weight="bold" /> {rotulo}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-card min-w-[15rem]">
          <MagnifyingGlass size={13} className="text-muted-foreground shrink-0" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por destinatario o asunto…"
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
          />
          {busca && (
            <button type="button" onClick={() => setBusca('')} aria-label="Limpiar"
              className="text-muted-foreground hover:text-foreground">
              <X size={12} weight="bold" />
            </button>
          )}
        </div>

        <RangoRapido valor={rango} alElegir={setRango} />

        <Button variant="outline" size="sm" onClick={cargar} disabled={cargando} className="ml-auto">
          <ArrowClockwise size={13} weight="bold" className="mr-1.5" />
          {cargando ? 'Cargando…' : 'Actualizar'}
        </Button>
      </div>

      {/* Lo recibido todavía no está, y se dice. */}
      <p className="text-xs text-muted-foreground flex gap-1.5">
        <Warning size={14} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
        <span>
          Aquí solo está <strong>lo que sale</strong>. Lo recibido —las respuestas de los
          tutores, por ejemplo— llega al buzón de Hostinger y el CRM todavía no lo lee.
          Es la otra mitad del <strong>#146</strong>.
        </span>
      </p>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-sm text-muted-foreground">
          {total} {total === 1 ? 'correo' : 'correos'}
        </div>

        {filas.length === 0 ? (
          <EmptyState
            icon={EnvelopeSimple}
            title={cargando ? 'Cargando…' : 'Ningún correo con esos filtros'}
            description="Aquí aparece cada correo que el CRM manda: avisos, recordatorios, plantillas."
          />
        ) : (
          <div className="divide-y divide-border">
            {filas.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => abrir(c)}
                disabled={abriendo === c.id}
                className="w-full text-left px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-muted/40 transition-colors"
              >
                <span className={`text-xs font-semibold shrink-0 w-20 ${COLOR[c.estado] || ''}`}>
                  {c.estado === 'enviado' ? 'enviado' : c.estado === 'bloqueado' ? 'frenado' : 'falló'}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-24">
                  {cuando(c.cuando)}
                </span>
                <span className="text-sm truncate min-w-0 flex-1">
                  <span className="font-medium">{c.destinatarios}</span>
                  <span className="text-muted-foreground"> · {c.asunto}</span>
                </span>
                {c.intentos > 1 && (
                  <span className="text-[11px] text-muted-foreground shrink-0">{c.intentos} intentos</span>
                )}
                {!c.tiene_cuerpo && (
                  <span className="text-[11px] text-muted-foreground italic shrink-0" title="Anterior a que se guardara el texto">
                    sin texto
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* El correo, tal y como salió.
          `!m-0` en la capa no es adorno: es hija del `space-y-4` de arriba, y
          `space-y` le mete `margin-top: 1rem` a todo hijo que no sea el
          primero. Con `fixed inset-0` ese margen la baja 16 px y deja una
          franja sin cubrir arriba del todo — la barra blanca que no se
          oscurecía. `ConfirmDialog` y `PromptDialog` ya lo llevan por esto. */}
      {abierto && (
        <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setAbierto(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
              <div className="min-w-0">
                <h2 className="font-bold truncate">{abierto.asunto}</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {abierto.remitente ? `${abierto.remitente} → ` : ''}{abierto.destinatarios}
                  {' · '}{cuando(abierto.cuando)}
                </p>
              </div>
              <button type="button" onClick={() => setAbierto(null)}
                className="text-muted-foreground hover:text-foreground shrink-0">
                <X size={16} weight="bold" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {abierto.error && (
                <p className="text-xs text-red-600 dark:text-red-400">{abierto.error}</p>
              )}

              {abierto.cuerpo_html ? (
                /* Sobre BLANCO aunque el CRM esté oscuro: así se vio en la
                   bandeja de quien lo recibió, que es lo que se viene a mirar. */
                <div
                  className="border border-border rounded-md p-4 text-sm overflow-x-auto"
                  style={{ background: '#ffffff', color: '#18181b', colorScheme: 'light' }}
                  dangerouslySetInnerHTML={{ __html: abierto.cuerpo_html }}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  De este correo no se guardó el texto: es anterior a que el CRM empezara a hacerlo.
                </p>
              )}

              {abierto.etiquetas?.length ? (
                <div className="flex flex-wrap gap-1">
                  {abierto.etiquetas.map((e) => (
                    <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {e}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
