import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MainContainer, ChatContainer, MessageList, Message, MessageInput,
  ConversationList, Conversation, Avatar, Sidebar, Search, ConversationHeader,
  MessageSeparator, InfoButton,
} from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { Prohibit, PencilSimpleLine, X, MagnifyingGlass, Microphone, Stop } from '@phosphor-icons/react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { toast } from '@/shared/hooks/useToast';
import {
  chatApi, urlMedia,
  type ChatWhatsapp, type MensajeWhatsapp, type ConexionWhatsapp,
} from '../api/whatsapp.api';
import './chat.css';

// El chat de WhatsApp dentro del CRM.
//
// La maquetacion la pone @chatscope/chat-ui-kit-react (MIT), que es un kit de
// mensajeria ya hecho: burbujas, agrupado, separadores, lista de
// conversaciones. No tiene sentido reinventar eso a mano — lo que si es nuestro
// es lo de debajo: los frenos, el cruce con leads y los adjuntos.
const CADA_MS = 5000;

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

function diaDe(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const igual = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (igual(d, hoy)) return 'Hoy';
  if (igual(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

const iniciales = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

/** Un avatar de letras: no tenemos la foto de perfil de WhatsApp. */
function Inicial({ nombre }: { nombre: string }) {
  return (
    <div className="wa-inicial" title={nombre}>{iniciales(nombre)}</div>
  );
}

/** Lo que va dentro de la burbuja cuando el mensaje trae un archivo. */
function Adjunto({ m }: { m: MensajeWhatsapp }) {
  const url = urlMedia(m.id);
  if (!m.media_url) return <em className="wa-sin-archivo">({m.tipo} — no se pudo descargar)</em>;
  if (m.tipo === 'audio') return <audio controls preload="none" src={url} className="wa-audio" />;
  if (m.tipo === 'imagen' || m.tipo === 'sticker') {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={m.nombre_archivo || 'imagen'} className="wa-imagen" />
      </a>
    );
  }
  if (m.tipo === 'video') return <video controls preload="metadata" src={url} className="wa-imagen" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="wa-doc">
      📄 {m.nombre_archivo || 'documento'}
    </a>
  );
}

const TIC = { enviado: '✓', entregado: '✓✓', leido: '✓✓', fallido: '⚠' } as const;

export default function ChatPage() {
  const { activeProject } = useProjectContext() as { activeProject: { id: number } | null };
  const projectId = activeProject?.id && activeProject.id !== -1 ? activeProject.id : null;

  const [chats, setChats] = useState<ChatWhatsapp[]>([]);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [conv, setConv] = useState<ChatWhatsapp | null>(null);
  const [mensajes, setMensajes] = useState<MensajeWhatsapp[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [conexion, setConexion] = useState<ConexionWhatsapp | null>(null);
  const [filtro, setFiltro] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [busca, setBusca] = useState('');
  const [candidatos, setCandidatos] = useState<Array<{ id: number; nombre: string; telefono: string | null; status: string }>>([]);
  const ficheroRef = useRef<HTMLInputElement>(null);
  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);

  useEffect(() => {
    const leer = () => chatApi.conexion().then((r) => setConexion(r.success ? r.data : null)).catch(() => {});
    leer();
    // La sesion se cae sola si el movil se queda sin internet. Se vigila para
    // que la gestora se entere en vez de escribir contra el vacio.
    const t = setInterval(leer, 30000);
    return () => clearInterval(t);
  }, []);

  const cargarLista = useCallback(async () => {
    const r = await chatApi.lista(projectId);
    if (r.success) setChats(r.data || []);
  }, [projectId]);

  const cargarHilo = useCallback(async (id: number) => {
    const r = await chatApi.hilo(id);
    if (!r.success) return;
    setConv(r.data.conversacion);
    setMensajes(r.data.mensajes || []);
  }, []);

  useEffect(() => {
    cargarLista();
    const t = setInterval(() => {
      cargarLista();
      if (abierto) cargarHilo(abierto);
    }, CADA_MS);
    return () => clearInterval(t);
  }, [cargarLista, cargarHilo, abierto]);

  useEffect(() => { if (abierto) cargarHilo(abierto); }, [abierto, cargarHilo]);

  useEffect(() => {
    if (!nuevoAbierto) return undefined;
    const t = setTimeout(async () => {
      const r = await chatApi.buscarProspectos(projectId, busca);
      if (r.success) setCandidatos((r.data || []).filter((l) => l.telefono));
    }, 300);
    return () => clearTimeout(t);
  }, [nuevoAbierto, busca, projectId]);

  function fallo(e: unknown) {
    // Aqui contestan los frenos: ritmo, «no me escribas» y sin consentimiento.
    // El texto del servidor se enseña tal cual: esta escrito para una gestora.
    toast({ title: 'No se ha enviado', description: (e as Error).message, variant: 'destructive' });
  }

  async function enviar(texto: string) {
    const t = texto.replace(/<[^>]*>/g, '').trim();
    if (!t || !abierto || enviando) return;
    setEnviando(true);
    try {
      const r = await chatApi.enviar(abierto, t);
      if (!r.success) throw new Error(r.error || 'No se pudo enviar');
      await cargarHilo(abierto); cargarLista();
    } catch (e) { fallo(e); } finally { setEnviando(false); }
  }

  async function mandarArchivo(f: File) {
    if (!abierto) return;
    setEnviando(true);
    try {
      const r = await chatApi.adjunto(abierto, f);
      if (!r.success) throw new Error(r.error || 'No se pudo enviar');
      await cargarHilo(abierto); cargarLista();
    } catch (e) { fallo(e); } finally { setEnviando(false); }
  }

  async function alternarGrabacion() {
    if (grabando) { grabadora.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      trozos.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) trozos.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGrabando(false);
        const blob = new Blob(trozos.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size > 800) await mandarArchivo(new File([blob], 'nota-de-voz.webm', { type: blob.type }));
      };
      mr.start(); grabadora.current = mr; setGrabando(true);
    } catch {
      toast({ title: 'Sin microfono', description: 'El navegador no dio permiso para grabar.', variant: 'destructive' });
    }
  }

  async function abrirCon(leadId: number) {
    try {
      const r = await chatApi.abrir(leadId);
      if (!r.success) throw new Error(r.error || 'No se pudo abrir');
      setNuevoAbierto(false); setBusca('');
      await cargarLista(); setAbierto(r.data.id);
    } catch (e) { fallo(e); }
  }

  async function marcarNoEscribir() {
    if (!abierto) return;
    const motivo = window.prompt('¿Por que no hay que volver a escribirle?') || '';
    const r = await chatApi.noEscribir(abierto, motivo);
    if (r.success) {
      toast({ title: 'Marcado', description: 'El CRM no volvera a escribir a este numero.' });
      cargarHilo(abierto); cargarLista();
    }
  }

  const nombreDe = (c: ChatWhatsapp) => c.lead_nombre || c.nombre_push || c.telefono;
  const visibles = filtro
    ? chats.filter((c) => `${nombreDe(c)} ${c.telefono}`.toLowerCase().includes(filtro.toLowerCase()))
    : chats;

  if (conexion && !conexion.configurado) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="font-semibold mb-1">WhatsApp no esta conectado</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{conexion.motivo}</p>
        <Link to="/whatsapp/conexion" className="text-sm text-primary hover:underline mt-3 inline-block">
          Ir a conectar el numero
        </Link>
      </div>
    );
  }

  let ultimoDia = '';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs bg-card border border-border rounded-lg px-3 py-1.5">
        <span className={`w-2 h-2 rounded-full ${conexion?.conectado ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {conexion?.conectado
          ? <span className="text-muted-foreground">
              Conectado como <strong className="text-foreground">
                {conexion.nombre || (conexion.numero ? `+${conexion.numero}` : conexion.instancia)}
              </strong>
            </span>
          : <span className="text-amber-700 dark:text-amber-400">
              Sesion desconectada — <Link to="/whatsapp/conexion" className="underline">volver a conectar</Link>
            </span>}
      </div>

      <div className="wa-marco">
        <MainContainer responsive>
          <Sidebar position="left" scrollable>
            <div className="wa-barra-lista">
              <Search placeholder="Buscar un chat" value={filtro}
                onChange={(v: string) => setFiltro(v)} onClearClick={() => setFiltro('')} />
              <button type="button" title="Escribir a un prospecto"
                onClick={() => setNuevoAbierto(true)} className="wa-btn-nuevo">
                <PencilSimpleLine size={16} weight="bold" />
              </button>
            </div>
            <ConversationList>
              {visibles.map((c) => (
                <Conversation key={c.id} name={nombreDe(c)}
                  info={c.no_escribir ? 'no escribir' : (c.ultimo_texto || c.telefono)}
                  active={abierto === c.id}
                  unreadCnt={c.no_leidos || undefined}
                  onClick={() => setAbierto(c.id)}>
                  <Avatar name={nombreDe(c)}><Inicial nombre={nombreDe(c)} /></Avatar>
                </Conversation>
              ))}
            </ConversationList>
          </Sidebar>

          {conv ? (
            <ChatContainer>
              <ConversationHeader>
                <Avatar name={nombreDe(conv)}><Inicial nombre={nombreDe(conv)} /></Avatar>
                <ConversationHeader.Content userName={nombreDe(conv)}
                  info={conv.lead_id ? `${conv.telefono} · prospecto` : `${conv.telefono} · sin prospecto`} />
                <ConversationHeader.Actions>
                  {conv.lead_id && (
                    <Link to={`/prospectos/${conv.lead_id}`} title="Ver la ficha del prospecto">
                      <InfoButton />
                    </Link>
                  )}
                  <button type="button" onClick={marcarNoEscribir} className="wa-btn-prohibir"
                    title="No volver a escribir a este numero">
                    <Prohibit size={17} />
                  </button>
                </ConversationHeader.Actions>
              </ConversationHeader>

              <MessageList>
                {mensajes.map((m, i) => {
                  const dia = diaDe(m.ts);
                  const nuevoDia = dia !== ultimoDia;
                  if (nuevoDia) ultimoDia = dia;
                  const prev = mensajes[i - 1];
                  const sig = mensajes[i + 1];
                  const mismoQuePrev = !nuevoDia && prev?.direccion === m.direccion;
                  const mismoQueSig = sig?.direccion === m.direccion && diaDe(sig.ts) === dia;
                  const posicion = mismoQuePrev && mismoQueSig ? 'normal'
                    : mismoQuePrev ? 'last' : mismoQueSig ? 'first' : 'single';
                  const mia = m.direccion === 'saliente';
                  return (
                    <div key={m.id}>
                      {nuevoDia && <MessageSeparator content={dia} />}
                      <Message model={{
                        direction: mia ? 'outgoing' : 'incoming',
                        position: posicion,
                        type: 'custom',
                      }}>
                        <Message.CustomContent>
                          {m.tipo !== 'texto' && <div className="wa-adjunto"><Adjunto m={m} /></div>}
                          {m.texto && <div className="wa-texto">{m.texto}</div>}
                          <span className={`wa-meta ${m.estado === 'leido' ? 'wa-leido' : ''}`}>
                            {hora(m.ts)}{mia && m.estado ? ` ${TIC[m.estado]}` : ''}
                          </span>
                        </Message.CustomContent>
                      </Message>
                    </div>
                  );
                })}
              </MessageList>

              {conv.no_escribir ? (
                <div className="wa-bloqueado">
                  <Prohibit size={15} weight="bold" />
                  <span>
                    Esta persona pidio que no se le escriba.
                    {conv.motivo_no_escribir ? ` (${conv.motivo_no_escribir})` : ''}
                  </span>
                </div>
              ) : (
                <MessageInput placeholder={grabando ? 'Grabando nota de voz…' : 'Escribe un mensaje'}
                  onSend={enviar} disabled={enviando} attachButton
                  onAttachClick={() => ficheroRef.current?.click()}
                  sendDisabled={enviando} />
              )}
            </ChatContainer>
          ) : (
            <ChatContainer>
              <MessageList>
                <MessageList.Content className="wa-vacio">
                  Elige una conversacion, o escribe a un prospecto con el lapiz de la izquierda.
                </MessageList.Content>
              </MessageList>
            </ChatContainer>
          )}
        </MainContainer>

        {/* El microfono va aparte: el kit no trae boton de nota de voz. */}
        {conv && !conv.no_escribir && (
          <button type="button" onClick={alternarGrabacion} disabled={enviando}
            title={grabando ? 'Parar y enviar la nota de voz' : 'Grabar una nota de voz'}
            className={`wa-btn-micro ${grabando ? 'wa-grabando' : ''}`}>
            {grabando ? <Stop size={17} weight="fill" /> : <Microphone size={18} />}
          </button>
        )}
      </div>

      <input ref={ficheroRef} type="file" className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) mandarArchivo(f); e.target.value = ''; }} />

      {/* Chat nuevo. Se elige un PROSPECTO, no se teclea un numero suelto: quien
          esta en la base dejo su telefono en un formulario nuestro, y esa es la
          diferencia entre escribir a quien lo pidio y escribir en frio. */}
      {nuevoAbierto && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => setNuevoAbierto(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-bold text-sm">Escribir a un prospecto</span>
              <button type="button" onClick={() => setNuevoAbierto(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"><X size={15} /></button>
            </div>
            <div className="p-3 border-b border-border">
              <div className="relative">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nombre, email o telefono…"
                  className="w-full pl-8 pr-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {candidatos.length === 0 && (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  Sin prospectos con telefono. Solo se puede escribir a quien dejo el suyo.
                </p>
              )}
              {candidatos.map((l) => (
                <button key={l.id} type="button" onClick={() => abrirCon(l.id)}
                  className="w-full text-left px-4 py-2 hover:bg-muted/60 border-b border-border/50">
                  <div className="text-sm font-semibold">{l.nombre}</div>
                  <div className="text-xs text-muted-foreground">{l.telefono} · {l.status}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
