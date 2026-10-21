import { useState, type FormEvent } from 'react';
import { CheckCircle, Copy, Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { moodleApi, type CampusMoodle, type ResultadoConexion } from '../api/moodle.api';

/**
 * Conectar el Moodle de un campus, aquí mismo y sin salir de la pantalla.
 *
 * A la izquierda, el formulario (dirección y token); a la derecha, cómo se consigue ese token
 * en Moodle, paso a paso, con la lista de funciones que ha de tener el servicio. Al pulsar
 * «Probar y conectar» el CRM prueba la conexión ANTES de guardarla: si no vale lo dice y no
 * guarda nada; si vale dice cuántos cursos ha encontrado y qué función le falta al token.
 */

const OPCIONAL = 'core_completion_get_course_completion_status';

const PASOS: { titulo: string; texto: string }[] = [
  { titulo: 'Entra al Moodle del campus como administrador', texto: 'Administración del sitio → Servidor → Servicios web → Servicios externos.' },
  { titulo: 'Crea un servicio nuevo y añádele estas funciones', texto: 'Márcalo como habilitado y «solo usuarios autorizados». Las funciones solo leen: ninguna crea ni cambia nada.' },
  { titulo: 'Autoriza a un usuario y crea su token', texto: 'En el mismo servicio, «Usuarios autorizados»; después Servicios web → Gestionar fichas (tokens) → Añadir.' },
  { titulo: 'Pega aquí la dirección y el token', texto: 'La dirección es la de la página de inicio del Moodle, sin nada detrás.' },
];

export default function ConectarMoodle({ campus, funciones, cambiando = false, onConectado }: {
  campus: CampusMoodle;
  funciones: string[];
  /** Ya tiene Moodle y se está cambiando el token. */
  cambiando?: boolean;
  onConectado: () => void;
}) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [verToken, setVerToken] = useState(false);
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<ResultadoConexion | null>(null);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: 'Copiado' });
    } catch {
      toast({ title: 'No se pudo copiar', description: 'Selecciónalo y cópialo a mano.', variant: 'destructive' });
    }
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setProbando(true);
    setError(null);
    try {
      const r = await moodleApi.conectar(campus.id, { url: url.trim(), token: token.trim() });
      setHecho(r.data as ResultadoConexion);
      setToken('');
    } catch (err) {
      setError((err as Error).message || 'No se pudo conectar');
    } finally { setProbando(false); }
  };

  if (hecho) {
    return (
      <div className="space-y-4" data-testid="conexion-hecha">
        <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success-soft p-4 text-success-soft-foreground">
          <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{campus.nombre} está conectado</p>
            <p className="text-sm">{hecho.cursos} {hecho.cursos === 1 ? 'curso encontrado' : 'cursos encontrados'} en su Moodle.</p>
          </div>
        </div>
        {hecho.faltan.length > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm text-warning-soft-foreground">
            <p className="font-semibold">Funciona, pero al servicio del token le falta alguna función</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              {hecho.faltan.map((f) => <li key={f.funcion}><code className="text-xs">{f.funcion}</code>: {f.consecuencia}.</li>)}
            </ul>
            <p className="mt-1.5 text-xs">Añádelas al servicio en Moodle y vuelve a conectar; no hace falta cambiar el token.</p>
          </div>
        )}
        <button type="button" onClick={onConectado} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Ver los cursos
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2" data-testid="conectar-moodle">
      <form onSubmit={enviar} className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">{cambiando ? `Cambiar el token de ${campus.nombre}` : `Conectar el Moodle de ${campus.nombre}`}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Con esto, los cursos y alumnos de este campus se ven aquí y Claude puede consultarlos. Solo se lee: no se cambia nada en Moodle.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Dirección de su Moodle</span>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://campus.ejemplo.com"
            autoComplete="off"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="block text-xs text-muted-foreground">La de su página de inicio. Si el Moodle está en una carpeta, con ella: https://dominio.com/moodle</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Token de servicio web</span>
          <div className="relative">
            <input
              type={verToken ? 'text' : 'password'}
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="32 caracteres, de «Gestionar fichas» en Moodle"
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-md border border-border bg-background px-3 pr-11 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => setVerToken((v) => !v)}
              aria-label={verToken ? 'Ocultar el token' : 'Ver el token'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted"
            >
              {verToken ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <span className="block text-xs text-muted-foreground">Se guarda cifrado en el servidor y no se vuelve a mostrar.</span>
        </label>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
            <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">No se ha guardado nada</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={probando || !url.trim() || !token.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {probando ? 'Probando la conexión…' : 'Probar y conectar'}
        </button>
      </form>

      <aside className="rounded-lg border border-border bg-muted/30 p-5" aria-label="Cómo conseguir el token">
        <h3 className="text-sm font-semibold">Cómo conseguir el token</h3>
        <ol className="mt-3 space-y-3">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-3 text-sm">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
              <div>
                <p className="font-medium">{p.titulo}</p>
                <p className="text-xs text-muted-foreground">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        {funciones.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Funciones del servicio</h4>
              <button type="button" onClick={() => copiar(funciones.join('\n'))} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Copy size={13} /> Copiar todas
              </button>
            </div>
            <ul className="mt-2 space-y-1 rounded-md border border-border bg-card p-3 font-mono text-xs">
              {funciones.map((f) => (
                <li key={f} className="flex items-center justify-between gap-2">
                  <span className="truncate">{f}</span>
                  {f === OPCIONAL && <span className="shrink-0 font-sans text-[11px] text-muted-foreground">opcional: saber quién terminó</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
