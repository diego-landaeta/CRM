import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, VideoCamera, X, BellRinging } from '@phosphor-icons/react';
import client from '@/shared/api/client';

/**
 * «Te estan llamando por WhatsApp».
 *
 * Se monta una vez en AppLayout, asi que avisa desde CUALQUIER pantalla del CRM
 * — que es de lo que se trata: la llamada se pierde justamente cuando la gestora
 * esta en Prospectos o en Facturacion y el movil esta en el bolso.
 *
 * Lo que NO hace, y se dice claro en el cartel: coger la llamada. Por esta via
 * WhatsApp no da canal de audio, la voz vive en la aplicacion del movil y va
 * cifrada punto a punto. El aviso sirve para que le de tiempo a sacar el
 * telefono, no para descolgar aqui. Prometer un boton de contestar seria
 * mentir, y ademas la gestora perderia la llamada buscandolo.
 */

// Cada cuanto se pregunta. Solo con WhatsApp enlazado: la mayoria del CRM no lo
// tiene, y preguntar cada tres segundos por una sesion que no existe es tirar
// peticiones toda la jornada por nada.
const CADA_ENLAZADA_MS = 3000;
const CADA_SIN_ENLAZAR_MS = 60000;

type Sonando = {
  id: string;
  telefono: string;
  nombre: string | null;
  conversacionId: number;
  esVideo: boolean;
  esGrupo: boolean;
  segundos: number;
};

export default function AvisoDeLlamada() {
  const navigate = useNavigate();
  const [llamada, setLlamada] = useState<Sonando | null>(null);
  const [enlazada, setEnlazada] = useState(false);
  // La que se ha cerrado a mano. Sin esto, la siguiente vuelta la vuelve a
  // pintar dos segundos despues y no hay forma de quitarla de en medio.
  const descartada = useRef<string | null>(null);
  // Si el navegador ya tiene permiso, se avisa tambien fuera del CRM. NO se
  // pide al entrar: un permiso que salta solo en la primera pantalla se deniega
  // por reflejo, y entonces ya no se puede volver a pedir nunca.
  const avisado = useRef<string | null>(null);

  const preguntar = useCallback(async () => {
    try {
      const r = await client.get('/whatsapp/sonando');
      if (!r.success) return;
      setEnlazada(Boolean(r.data?.enlazada));
      const actual: Sonando | null = r.data?.sonando ?? null;
      if (!actual) { setLlamada(null); return; }
      // La que ya se ha cerrado a mano no vuelve. Sin esto la siguiente vuelta
      // la pinta otra vez tres segundos despues.
      if (descartada.current === actual.id) return;
      setLlamada(actual);
    } catch {
      // Que falle una vuelta no significa nada: puede ser el token
      // renovandose. Se calla y se reintenta a la siguiente.
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    let temporizador: ReturnType<typeof setTimeout>;

    const vuelta = async () => {
      // Con la pestaña de fondo no se pregunta: el navegador ya frena los
      // temporizadores y ademas no hay nadie mirando el cartel.
      if (!document.hidden) await preguntar();
      if (!vivo) return;
      temporizador = setTimeout(vuelta, enlazada ? CADA_ENLAZADA_MS : CADA_SIN_ENLAZAR_MS);
    };
    vuelta();

    // Al volver a la pestaña se pregunta ya, sin esperar a la siguiente vuelta:
    // puede llevar sonando veinte segundos.
    const alVolver = () => { if (!document.hidden) preguntar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [preguntar, enlazada]);

  // El aviso del sistema, solo si YA hay permiso. Una por llamada.
  useEffect(() => {
    if (!llamada) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (avisado.current === llamada.id) return;
    avisado.current = llamada.id;
    try {
      new Notification('Te estan llamando por WhatsApp', {
        body: `${llamada.nombre || llamada.telefono} · cogelo en el movil`,
        tag: llamada.id,   // que no se apilen si el navegador repite
      });
    } catch { /* si el navegador no deja, el cartel sigue estando */ }
  }, [llamada]);

  if (!llamada) return null;

  // El `+` solo si falta. Se guarda ya normalizado con prefijo —lo pone
  // normalizePhone al crear la conversacion—, asi que ponerselo a ciegas daba
  // «++34622222222» en el cartel.
  const tel = String(llamada.telefono || '');
  const quien = llamada.nombre || (tel.startsWith('+') ? tel : `+${tel}`);
  const Icono = llamada.esVideo ? VideoCamera : PhoneCall;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed z-[60] bottom-4 right-4 left-4 sm:left-auto sm:w-[340px]
                 rounded-lg border border-emerald-300 dark:border-emerald-800
                 bg-emerald-50 dark:bg-emerald-950/90 shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        {/* La campanita late: si el aviso no se mueve, con la vista en otra
            parte de la pantalla no se ve en los treinta segundos que dura. */}
        <span className="relative shrink-0 mt-0.5">
          <Icono size={22} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
          <BellRinging
            size={12} weight="fill"
            className="absolute -top-1 -right-1 text-emerald-600 dark:text-emerald-400 animate-pulse"
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-emerald-950 dark:text-emerald-100">
            {llamada.esVideo ? 'Videollamada' : 'Llamada'} de WhatsApp
          </p>
          <p className="text-sm text-emerald-900 dark:text-emerald-200 truncate">{quien}</p>
          {/* Lo importante, y por eso va en negrita: aqui no se coge. */}
          <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-1 leading-relaxed">
            <strong>Cogela en tu movil</strong> — desde el CRM no se puede hablar.
            Si no llegas, quedara apuntada como perdida.
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={() => {
                descartada.current = llamada.id;
                setLlamada(null);
                navigate(`/whatsapp/chat?conv=${llamada.conversacionId}`);
              }}
              className="h-8 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700
                         text-white text-xs font-semibold"
            >
              Ver la conversacion
            </button>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
              sonando {llamada.segundos}s
            </span>
          </div>

          {/* Pedir permiso aqui y no al entrar: esto es un clic de la persona,
              que es cuando un navegador deja preguntar sin quemar el permiso. */}
          {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
            <button
              type="button"
              onClick={() => { Notification.requestPermission().catch(() => {}); }}
              className="text-[11px] underline text-emerald-700 dark:text-emerald-400 mt-2 block"
            >
              Avisarme aunque no tenga el CRM delante
            </button>
          )}
        </div>

        <button
          type="button"
          aria-label="Quitar el aviso"
          onClick={() => { descartada.current = llamada.id; setLlamada(null); }}
          className="shrink-0 text-emerald-700 dark:text-emerald-400 hover:opacity-70"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
