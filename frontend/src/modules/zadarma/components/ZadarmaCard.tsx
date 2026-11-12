import { useCallback, useEffect, useState } from 'react';
import {
  Headset, CheckCircle, WarningCircle, Eye, EyeSlash, FloppyDisk, PlugsConnected, Trash, Copy, Check,
} from '@phosphor-icons/react';
import client, { API_BASE_URL } from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';
import { getEstado, getExtensiones, guardarExtensiones, type ExtensionDePersona } from '../api/zadarma.api';

/**
 * Zadarma en Integraciones (#137), con el mismo trato que Stripe: la clave y el
 * secreto se guardan cifrados en la base y nunca vuelven en claro; «Probar
 * conexión» pide el saldo, que es de solo lectura.
 *
 * Debajo, lo que hace falta para que funcione de verdad: la URL que hay que
 * pegar en el panel de Zadarma (avisos de fin de llamada) y la extensión de
 * cada persona del campus. Sin extensión, esa persona ve el botón pero no puede
 * llamar (y se le dice).
 */

interface EstadoIntegracion {
  has_secret: boolean;
  secret_preview: string | null;
  config_public: Record<string, string>;
  last_test_status: 'success' | 'error' | null;
  last_test_message: string | null;
  last_test_at: string | null;
}

const urlDelAviso = () => `${window.location.origin}${API_BASE_URL}/zadarma/webhook`;

const ROL: Record<string, string> = {
  gestor: 'Gestora', admin: 'Admin', project_manager: 'Project manager', soporte: 'Soporte', superadmin: 'Superadmin',
};

const fmt = (d: string | null) => (d
  ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Nunca');

function Estado({ data }: { data: EstadoIntegracion | null }) {
  if (!data?.has_secret) {
    return <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground">Sin configurar</span>;
  }
  if (data.last_test_status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-success-soft text-success-soft-foreground">
        <CheckCircle size={10} weight="fill" aria-hidden="true" /> Conectado
      </span>
    );
  }
  if (data.last_test_status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-destructive-soft text-destructive-soft-foreground">
        <WarningCircle size={10} weight="fill" aria-hidden="true" /> Error
      </span>
    );
  }
  return <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-info-soft text-info-soft-foreground">Guardado · sin probar</span>;
}

function CampoSecreto({ id, etiqueta, valor, setValor, actual, placeholder }: {
  id: string; etiqueta: string; valor: string; setValor: (v: string) => void; actual?: string | null; placeholder: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold text-muted-foreground mb-1 block">
        {etiqueta}
        {actual && (
          <span className="font-normal text-muted-foreground/80 ml-1">
            (actual: <code className="bg-muted px-1 rounded text-[10px]">{actual}</code> — vacío para no cambiar)
          </span>
        )}
      </label>
      <div className="relative">
        <input id={id} type={ver ? 'text' : 'password'} value={valor} autoComplete="off"
          onChange={(e) => setValor(e.target.value)} placeholder={actual ? 'Sin cambios' : placeholder}
          className="w-full h-10 pl-3 pr-10 rounded-md border border-border bg-card text-sm font-mono" />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar' : 'Mostrar'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {ver ? <EyeSlash size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function Extensiones({ projectId }: { projectId: number }) {
  const [personas, setPersonas] = useState<ExtensionDePersona[] | null>(null);
  const [editadas, setEditadas] = useState<Record<number, string>>({});
  const [fallo, setFallo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setFallo(false);
    try {
      const lista = await getExtensiones(projectId);
      setPersonas(lista);
      setEditadas(Object.fromEntries(lista.map((p) => [p.user_id, p.extension || ''])));
    } catch { setFallo(true); }
  }, [projectId]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiadas = (personas || []).filter((p) => (editadas[p.user_id] ?? '') !== (p.extension || ''));

  async function guardar() {
    setGuardando(true);
    try {
      const lista = await guardarExtensiones(projectId, cambiadas.map((p) => ({
        user_id: p.user_id, extension: (editadas[p.user_id] || '').trim() || null,
      })));
      setPersonas(lista);
      setEditadas(Object.fromEntries(lista.map((p) => [p.user_id, p.extension || ''])));
      toast({ title: 'Extensiones guardadas' });
    } catch (e: unknown) {
      const err = e as { data?: { error?: string }; message?: string };
      toast({ title: 'No se guardaron las extensiones', description: err?.data?.error || err?.message, variant: 'destructive' });
    } finally { setGuardando(false); }
  }

  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold">Extensión de cada persona</h4>
        <p className="text-xs text-muted-foreground">
          La extensión interna de la centralita con la que llama cada una en este campus (100, 101…).
          Zadarma la llama primero y, al descolgar, llama al prospecto.
        </p>
      </div>
      {fallo ? (
        <p className="text-xs text-destructive">
          No se pudieron cargar. <button type="button" onClick={cargar} className="underline">Reintentar</button>
        </p>
      ) : !personas ? (
        <div className="h-16 bg-muted/50 rounded-md animate-pulse" />
      ) : !personas.length ? (
        <p className="text-xs text-muted-foreground">Nadie tiene este campus asignado todavía (Usuarios › la ficha de cada persona).</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Persona</th>
                <th className="px-3 py-2 text-left font-medium w-32">Extensión</th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.user_id} className="border-t border-border/60">
                  <td className="px-3 py-1.5">
                    <span className="block">{p.nombre}</span>
                    <span className="block text-xs text-muted-foreground">{ROL[p.role] || p.role}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <input inputMode="numeric" value={editadas[p.user_id] ?? ''} aria-label={`Extensión de ${p.nombre}`}
                      onChange={(e) => setEditadas((x) => ({ ...x, [p.user_id]: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                      placeholder="—"
                      className="w-24 h-9 px-2 rounded-md border border-border bg-card text-sm font-mono tabular-nums" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {personas && personas.length > 0 && (
        <button type="button" onClick={guardar} disabled={guardando || !cambiadas.length}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-semibold hover:bg-muted disabled:opacity-50">
          <FloppyDisk size={14} weight="bold" aria-hidden="true" />
          {guardando ? 'Guardando…' : cambiadas.length ? `Guardar extensiones (${cambiadas.length})` : 'Guardar extensiones'}
        </button>
      )}
    </div>
  );
}

export default function ZadarmaCard({ projectId }: { projectId: number }) {
  const [data, setData] = useState<EstadoIntegracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [clave, setClave] = useState('');
  const [secreto, setSecreto] = useState('');
  const [zona, setZona] = useState('Europe/Madrid');
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await client.get<EstadoIntegracion>(`/integrations/zadarma?projectId=${projectId}`);
      if (r.success) {
        setData(r.data || null);
        if (r.data?.config_public?.zona_horaria) setZona(r.data.config_public.zona_horaria);
      }
    } catch { /* la tarjeta queda «Sin configurar» */ } finally { setCargando(false); }
  }, [projectId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    setGuardando(true);
    try {
      const body: Record<string, unknown> = {
        projectId, provider: 'zadarma', active: true, config_public: { zona_horaria: zona.trim() || 'Europe/Madrid' },
      };
      if (clave.trim()) body.api_key = clave.trim();
      if (secreto.trim()) body.api_secret = secreto.trim();
      const r = await client.put<EstadoIntegracion>('/integrations', body);
      if (r.success) {
        setData(r.data || null);
        setClave(''); setSecreto('');
        getEstado({ refrescar: true });
        toast({ title: 'Zadarma guardado', description: 'Clave y secreto cifrados. Pulsa «Probar conexión».' });
      }
    } catch (e: unknown) {
      const err = e as { data?: { error?: string }; message?: string };
      toast({ title: 'Error', description: err?.data?.error || err?.message, variant: 'destructive' });
    } finally { setGuardando(false); }
  }

  async function probar() {
    setProbando(true);
    try {
      const r = await client.post<{ ok: boolean; message: string }>(`/integrations/zadarma/test?projectId=${projectId}`);
      toast(r.success
        ? { title: 'Conexión OK', description: r.data?.message }
        : { title: 'La prueba falló', description: r.data?.message || 'Error desconocido', variant: 'destructive' });
      await cargar();
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } };
      toast({ title: 'La prueba falló', description: err?.data?.error || 'Error de red', variant: 'destructive' });
    } finally { setProbando(false); }
  }

  async function borrar() {
    if (!window.confirm('¿Quitar Zadarma de este campus? Dejará de verse el botón de llamar.')) return;
    try {
      await client.delete(`/integrations/zadarma?projectId=${projectId}`);
      setData(null); setClave(''); setSecreto('');
      getEstado({ refrescar: true });
      toast({ title: 'Zadarma quitado' });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(urlDelAviso()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* se puede seleccionar a mano */ }
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-info-soft text-info-soft-foreground flex items-center justify-center flex-shrink-0">
          <Headset size={22} weight="duotone" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base">Zadarma (centralita)</h3>
          <p className="text-xs text-muted-foreground">
            Llamar desde el CRM por la centralita y que cada llamada se apunte sola en la ficha, con su duración.
          </p>
        </div>
        <Estado data={data} />
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          La clave y el secreto están en el panel de Zadarma, en <strong className="text-foreground">Ajustes › Integraciones y API</strong>.
          Se guardan cifrados; aquí solo se ve el principio y el final.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CampoSecreto id="zadarma-clave" etiqueta="Clave (Key)" valor={clave} setValor={setClave}
            actual={data?.has_secret ? data.secret_preview : null} placeholder="La «Key» de la API" />
          <CampoSecreto id="zadarma-secreto" etiqueta="Secreto (Secret)" valor={secreto} setValor={setSecreto}
            actual={data?.config_public?.zadarma_secret_preview || null} placeholder="El «Secret» de la API" />
        </div>
        <div className="max-w-xs">
          <label htmlFor="zadarma-zona" className="text-[11px] font-semibold text-muted-foreground mb-1 block">Zona horaria de la cuenta</label>
          <input id="zadarma-zona" value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Europe/Madrid"
            className="w-full h-10 px-3 rounded-md border border-border bg-card text-sm" />
          <p className="text-[11px] text-muted-foreground mt-1">Zadarma manda la hora de cada llamada en la de la cuenta.</p>
        </div>

        {data?.last_test_at && (
          <div className={`text-xs p-2 rounded-md ${data.last_test_status === 'success'
            ? 'bg-success-soft text-success-soft-foreground' : 'bg-destructive-soft text-destructive-soft-foreground'}`}>
            <strong>Última prueba:</strong> {fmt(data.last_test_at)} · {data.last_test_message || '(sin mensaje)'}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <button type="button" onClick={guardar} disabled={guardando}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            <FloppyDisk size={14} weight="bold" aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={probar} disabled={probando || !data?.has_secret}
            title={!data?.has_secret ? 'Guarda primero la clave y el secreto' : 'Probar la conexión con Zadarma'}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-semibold hover:bg-muted disabled:opacity-50">
            <PlugsConnected size={14} weight="bold" aria-hidden="true" /> {probando ? 'Probando…' : 'Probar conexión'}
          </button>
          {data?.has_secret && (
            <button type="button" onClick={borrar}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-destructive/30 bg-card text-sm font-semibold text-destructive hover:bg-destructive-soft sm:ml-auto">
              <Trash size={14} weight="bold" aria-hidden="true" /> Quitar
            </button>
          )}
        </div>

        {data?.has_secret && (
          <>
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
              <p className="text-xs font-semibold">Avisos de llamada (en el panel de Zadarma)</p>
              <p className="text-xs text-muted-foreground">
                En <strong className="text-foreground">Ajustes › Integraciones y API › Notificaciones</strong>, pega esta
                dirección y marca el fin de llamada entrante (NOTIFY_END) y saliente (NOTIFY_OUT_END). Zadarma la
                comprueba al guardarla.
              </p>
              <div className="flex items-center gap-2 min-w-0">
                <code className="flex-1 min-w-0 truncate text-[11px] bg-card border border-border rounded px-2 py-1.5 select-all">{urlDelAviso()}</code>
                <button type="button" onClick={copiar} aria-label="Copiar la dirección"
                  className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {copiado ? <Check size={14} weight="bold" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <Extensiones projectId={projectId} />
          </>
        )}
      </div>
      {cargando && <div className="px-5 py-3 text-xs text-muted-foreground border-t border-border">Cargando…</div>}
    </div>
  );
}
