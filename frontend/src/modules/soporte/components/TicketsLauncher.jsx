import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useLocation } from 'react-router-dom';
import { toast } from '@/shared/hooks/useToast';

const ConfirmDialog = lazy(() => import('@/shared/components/ui/ConfirmDialog'));
import {
  Ticket, Plus, X, Bug, Lightning, Question, Trash, ClockCounterClockwise,
  Image as ImageIcon, ArrowLeft, PaperPlaneRight,
} from '@phosphor-icons/react';
import {
  listTickets, createTicket, updateTicketStatus, deleteTicket,
  TICKET_STATUS, TICKET_SEVERITY, TICKET_KIND,
} from '../lib/tickets';

const TONE_BG = {
  amber:   'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  blue:    'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  zinc:    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  red:     'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  violet:  'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
};

const KIND_ICON = { bug: Bug, feature: Lightning, question: Question };

// Limite: 5 imagenes por ticket, 1 MB cada una (data URLs en localStorage)
const MAX_FILES = 5;
const MAX_FILE_SIZE = 1 * 1024 * 1024;

export default function TicketsLauncher() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'create'
  const [tickets, setTickets] = useState(() => listTickets());

  useEffect(() => {
    function onChange() { setTickets(listTickets()); }
    function onOpen() { setOpen(true); setView('list'); }
    function onOpenCreate() { setOpen(true); setView('create'); }
    window.addEventListener('crm:tickets-changed', onChange);
    window.addEventListener('crm:open-tickets', onOpen);
    window.addEventListener('crm:open-ticket-create', onOpenCreate);
    return () => {
      window.removeEventListener('crm:tickets-changed', onChange);
      window.removeEventListener('crm:open-tickets', onOpen);
      window.removeEventListener('crm:open-ticket-create', onOpenCreate);
    };
  }, []);

  // Esc cierra
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const unread = tickets.filter((t) => t.status === 'open').length;

  return (
    <>
      <button
        onClick={() => { setOpen((v) => !v); setView('list'); }}
        title="Tickets de soporte"
        aria-label="Abrir panel de tickets"
        aria-expanded={open}
        className={`fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-foreground text-background scale-95'
            : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:scale-105'
        }`}
      >
        {open ? <X size={18} weight="bold" /> : <Ticket size={20} weight="regular" />}
        {!open && unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-card">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 animate-in fade-in duration-150 lg:hidden" />
          <aside
            role="dialog"
            aria-label="Panel de tickets"
            className="fixed top-0 right-0 bottom-0 z-40 w-full lg:w-[480px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20 flex-shrink-0">
              <div className="flex items-center gap-2">
                {view === 'create' && (
                  <button
                    onClick={() => setView('list')}
                    aria-label="Volver"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <ArrowLeft size={14} weight="bold" />
                  </button>
                )}
                <div>
                  <h2 className="text-sm font-semibold">{view === 'list' ? 'Tickets de soporte' : 'Nuevo ticket'}</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {view === 'list'
                      ? `${tickets.length} ${tickets.length === 1 ? 'ticket' : 'tickets'}`
                      : 'Cuentanos lo que pasa, mientras mas detalle mejor.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {view === 'list' && (
                  <button
                    onClick={() => setView('create')}
                    className="h-8 inline-flex items-center gap-1 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                  >
                    <Plus size={12} weight="bold" /> Nuevo
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
            </header>

            {view === 'list'
              ? <TicketsList tickets={tickets} onCreate={() => setView('create')} />
              : <CreateTicketForm onSubmitted={() => setView('list')} />
            }
          </aside>
        </>
      )}
    </>
  );
}

function TicketsList({ tickets, onCreate }) {
  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Ticket size={28} weight="duotone" className="text-primary" />
        </div>
        <div className="max-w-[260px]">
          <h3 className="font-semibold text-sm mb-1">Sin tickets aun</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cuando algo no funcione o quieras pedir una mejora, crea un ticket. El equipo responde por aqui.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          <Plus size={14} weight="bold" /> Crear primer ticket
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto sidebar-scroll p-3 space-y-2">
      {tickets.map((t) => <TicketCard key={t.id} ticket={t} />)}
    </div>
  );
}

function TicketCard({ ticket }) {
  const status = TICKET_STATUS[ticket.status] || TICKET_STATUS.open;
  const severity = TICKET_SEVERITY[ticket.severity] || TICKET_SEVERITY.low;
  const kind = TICKET_KIND[ticket.kind] || TICKET_KIND.question;
  const KindIcon = KIND_ICON[ticket.kind] || Question;
  const [confirmOpen, setConfirmOpen] = useState(false);

  function cycleStatus() {
    const order = ['open', 'in_review', 'resolved', 'closed'];
    const idx = order.indexOf(ticket.status);
    const next = order[(idx + 1) % order.length];
    updateTicketStatus(ticket.id, next);
    toast({ title: `Ticket → ${TICKET_STATUS[next].label}` });
  }

  function handleDelete() {
    setConfirmOpen(true);
  }

  function doDelete() {
    setConfirmOpen(false);
    deleteTicket(ticket.id);
    toast({ title: 'Ticket eliminado' });
  }

  return (
    <article className="bg-background border border-border rounded-lg p-3 hover:border-primary/30 transition-colors">
      <header className="flex items-center gap-2 mb-1.5 flex-wrap">
        <KindIcon size={14} weight="duotone" className="text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kind.label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TONE_BG[status.tone]}`}>{status.label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TONE_BG[severity.tone]}`}>{severity.label}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={cycleStatus} title="Avanzar estado" aria-label="Cambiar estado" className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted">
            <ClockCounterClockwise size={12} />
          </button>
          <button onClick={handleDelete} title="Eliminar" aria-label="Eliminar ticket" className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
            <Trash size={12} />
          </button>
        </div>
      </header>
      <p className="text-sm font-semibold leading-snug">{ticket.title}</p>
      {ticket.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">{ticket.description}</p>}
      {ticket.attachments?.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {ticket.attachments.slice(0, 4).map((a, i) => (
            <img key={i} src={a.dataUrl} alt={a.name} width={48} height={48} loading="lazy" decoding="async" className="w-12 h-12 rounded object-cover border border-border" />
          ))}
          {ticket.attachments.length > 4 && (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              +{ticket.attachments.length - 4}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground/70">
        <span>{new Date(ticket.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        {ticket.projectName && <><span>·</span><span>{ticket.projectName}</span></>}
        {ticket.url && <><span>·</span><span className="truncate max-w-[120px]" title={ticket.url}>{ticket.url}</span></>}
      </div>
      <Suspense fallback={null}>
        <ConfirmDialog
          open={confirmOpen}
          title="Eliminar ticket"
          message="¿Eliminar este ticket? No se puede recuperar."
          confirmLabel="Eliminar"
          tone="destructive"
          onConfirm={doDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      </Suspense>
    </article>
  );
}

function CreateTicketForm({ onSubmitted }) {
  const { activeProject } = useProjectContext();
  const location = useLocation();
  const [form, setForm] = useState({
    kind: 'bug',
    severity: 'medium',
    title: '',
    description: '',
    steps: '',
    expected: '',
    actual: '',
    whyItMatters: '',
    url: window.location.origin + location.pathname,
  });
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // Update URL when pathname changes
  useEffect(() => {
    setForm((f) => ({ ...f, url: window.location.origin + location.pathname }));
  }, [location.pathname]);

  function patch(diff) { setForm((f) => ({ ...f, ...diff })); }

  async function handleFiles(files) {
    const valid = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Solo imagenes', description: `${file.name} no es imagen`, variant: 'destructive' });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'Imagen muy grande', description: `${file.name}: max 1 MB`, variant: 'destructive' });
        continue;
      }
      if (attachments.length + valid.length >= MAX_FILES) {
        toast({ title: `Maximo ${MAX_FILES} imagenes`, variant: 'destructive' });
        break;
      }
      valid.push(file);
    }
    const dataUrls = await Promise.all(valid.map((f) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: f.name, dataUrl: reader.result, size: f.size });
      reader.readAsDataURL(f);
    })));
    setAttachments((a) => [...a, ...dataUrls]);
  }

  function removeAttachment(idx) {
    setAttachments((a) => a.filter((_, i) => i !== idx));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: 'Falta titulo', variant: 'destructive' });
      return;
    }
    createTicket({
      ...form,
      attachments,
      projectId: activeProject?.id,
      projectName: activeProject?.nombre,
    });
    toast({ title: 'Ticket creado', description: 'Lo recibimos. Responderemos pronto.' });
    onSubmitted?.();
  }

  return (
    <form onSubmit={submit} className="flex-1 overflow-y-auto sidebar-scroll p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KindSelector value={form.kind} onChange={(k) => patch({ kind: k })} />
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Severidad</span>
          <select
            value={form.severity}
            onChange={(e) => patch({ severity: e.target.value })}
            className="w-full h-9 px-3 rounded-md border border-border bg-muted/30 text-sm"
          >
            {Object.entries(TICKET_SEVERITY).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Titulo *</span>
        <input
          autoFocus
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={form.kind === 'bug' ? 'Ej: Boton de exportar CSV no funciona' : form.kind === 'feature' ? 'Ej: Filtrar prospectos por tags' : 'Ej: Como configuro un webhook?'}
          className="w-full h-9 px-3 rounded-md border border-border bg-muted/30 text-sm"
        />
      </label>

      {form.kind === 'bug' && (
        <>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Que sucedio?</span>
            <textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
              placeholder="Describe el problema en pocas frases."
              className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm resize-y"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Pasos para reproducir</span>
            <textarea
              value={form.steps}
              onChange={(e) => patch({ steps: e.target.value })}
              rows={3}
              placeholder={"1. Voy a /leads\n2. Hago click en exportar\n3. ..."}
              className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm font-mono resize-y"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Esperabas que...</span>
              <textarea
                value={form.expected}
                onChange={(e) => patch({ expected: e.target.value })}
                rows={2}
                placeholder="Se descargue el CSV"
                className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm resize-y"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Pero en lugar...</span>
              <textarea
                value={form.actual}
                onChange={(e) => patch({ actual: e.target.value })}
                rows={2}
                placeholder="No pasa nada / sale error rojo"
                className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm resize-y"
              />
            </label>
          </div>
        </>
      )}

      {form.kind === 'feature' && (
        <>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Tu idea</span>
            <textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
              placeholder="Describe la mejora con detalle"
              className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm resize-y"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Por que importa?</span>
            <textarea
              value={form.whyItMatters}
              onChange={(e) => patch({ whyItMatters: e.target.value })}
              rows={2}
              placeholder="Que problema resuelve / a quien beneficia"
              className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm resize-y"
            />
          </label>
        </>
      )}

      {form.kind === 'question' && (
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Tu pregunta</span>
          <textarea
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={4}
            placeholder="Pregunta lo que necesites"
            className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm resize-y"
          />
        </label>
      )}

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">URL de la pagina (auto)</span>
        <input
          value={form.url}
          onChange={(e) => patch({ url: e.target.value })}
          className="w-full h-9 px-3 rounded-md border border-border bg-muted/30 text-xs font-mono"
        />
      </label>

      {/* Imagenes */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
          Capturas <span className="font-normal normal-case">(opcional, max {MAX_FILES} · 1 MB c/u)</span>
        </span>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'
          }`}
        >
          <ImageIcon size={20} weight="regular" className="mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Arrastra imagenes o <span className="text-primary font-medium">selecciona archivos</span></p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
            className="hidden"
          />
        </div>
        {attachments.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative group">
                <img src={a.dataUrl} alt={a.name} loading="lazy" decoding="async" className="w-full h-16 object-cover rounded border border-border" />
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Quitar ${a.name}`}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition flex items-center justify-center"
                >
                  <X size={10} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border flex justify-end">
        <button type="submit" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
          <PaperPlaneRight size={14} weight="bold" /> Enviar ticket
        </button>
      </div>
    </form>
  );
}

function KindSelector({ value, onChange }) {
  const KINDS = [
    { k: 'bug', label: 'Bug', Icon: Bug, color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30' },
    { k: 'feature', label: 'Mejora', Icon: Lightning, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' },
    { k: 'question', label: 'Pregunta', Icon: Question, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' },
  ];
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Tipo</span>
      <div className="grid grid-cols-3 gap-1">
        {KINDS.map(({ k, label, Icon, color }) => {
          const active = value === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              className={`h-9 inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors ${
                active ? color + ' ring-1 ring-current' : 'bg-muted/30 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon size={12} weight={active ? 'fill' : 'regular'} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
