import { useEffect, useRef, useState } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import {
  WhatsappLogo, Envelope, Globe, X, ArrowsOut, ArrowsIn,
  ArrowSquareOut, Plus, Trash, ShieldWarning,
} from '@phosphor-icons/react';

// `iframeable: false` = el sitio bloquea ser embebido (X-Frame-Options / CSP).
// Para esos canales mostramos un fallback dentro del mismo drawer en vez del iframe.
const PRESET_CHANNELS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp Web',
    icon: WhatsappLogo,
    iconColor: 'text-green-600',
    url: 'https://web.whatsapp.com',
    iframeable: false,
  },
  {
    id: 'webmail',
    label: 'Correo (Hostinger)',
    icon: Envelope,
    iconColor: 'text-blue-600',
    url: 'https://mail.hostinger.com',
    iframeable: false,
  },
];

const STORAGE_KEY = 'crm.channel-panel';

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (s.customUrl && !s.customTabs) {
      s.customTabs = [{ id: 'custom_0', label: 'Personalizado', url: s.customUrl }];
      delete s.customUrl;
    }
    return s;
  } catch { return {}; }
}

function saveState(patch) {
  try {
    const prev = loadState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {}
}

function openInPopup(url) {
  const w = 1000, h = 720;
  const left = Math.max((window.outerWidth - w) / 2, 0);
  const top = Math.max((window.outerHeight - h) / 2, 0);
  const features = `popup=yes,width=${w},height=${h},left=${left},top=${top}`;
  const handle = window.open(url, `crm-channel-${url}`, features);
  if (handle) handle.focus();
  return handle;
}

export default function ChannelPanel() {
  const { activeProject } = useProjectContext();
  const stored = loadState();

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(stored.expanded ?? false);
  const [activeId, setActiveId] = useState(stored.activeId ?? 'whatsapp');
  const [customTabs, setCustomTabs] = useState(stored.customTabs ?? []);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [iframeError, setIframeError] = useState({});
  const urlInputRef = useRef(null);

  const projectUrl = activeProject?.webhook_url || null;
  const channels = [
    ...PRESET_CHANNELS,
    ...(projectUrl ? [{ id: 'project', label: activeProject.nombre, icon: Globe, iconColor: 'text-violet-600', url: projectUrl }] : []),
    ...customTabs.map((t) => ({ ...t, icon: Globe, iconColor: 'text-muted-foreground' })),
  ];

  const active = channels.find((c) => c.id === activeId) || channels[0];

  // Esc cierra el drawer
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape' && !addingCustom) setOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, addingCustom]);

  function switchChannel(id) {
    setActiveId(id);
    saveState({ activeId: id });
    setIframeError((p) => ({ ...p, [id]: false }));
  }

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    saveState({ expanded: next });
  }

  function handleAddCustom(e) {
    e.preventDefault();
    let url = customInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = 'https://' + url;
    let label = customLabelInput.trim();
    if (!label) {
      try { label = new URL(url).hostname.replace('www.', ''); }
      catch { label = 'Personalizado'; }
    }
    const id = 'custom_' + Date.now();
    const next = [...customTabs, { id, label, url }];
    setCustomTabs(next);
    saveState({ customTabs: next });
    setActiveId(id);
    saveState({ activeId: id });
    setAddingCustom(false);
    setCustomInput('');
    setCustomLabelInput('');
  }

  function handleRemoveCustom(e, id) {
    e.stopPropagation();
    const next = customTabs.filter((t) => t.id !== id);
    setCustomTabs(next);
    saveState({ customTabs: next });
    if (activeId === id) {
      const fallback = next[0]?.id || 'whatsapp';
      setActiveId(fallback);
      saveState({ activeId: fallback });
    }
  }

  // Drawer width: contraido (~480) o expandido (~720)
  const drawerWidth = expanded ? 'lg:w-[720px]' : 'lg:w-[480px]';

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Canales — WhatsApp, Correo, etc."
        aria-label="Abrir panel de canales"
        aria-expanded={open}
        className={`fixed bottom-20 right-5 z-40 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-foreground text-background scale-95'
            : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:scale-105'
        }`}
      >
        {open ? <X size={18} weight="bold" /> : <WhatsappLogo size={20} weight="regular" />}
      </button>

      {/* Drawer lateral derecho */}
      {open && (
        <>
          {/* Backdrop sutil — no bloquea el sidebar de la izquierda */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 animate-in fade-in duration-150 lg:hidden"
          />

          <aside
            role="dialog"
            aria-label={`Canales — ${active?.label || ''}`}
            className={`fixed top-0 right-0 bottom-0 z-40 w-full ${drawerWidth} bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200`}
          >
            {/* Header con tabs */}
            <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 flex-shrink-0">
              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto sidebar-scroll">
                {channels.map((ch) => {
                  const Icon = ch.icon;
                  const isActive = ch.id === activeId;
                  const isCustom = ch.id.startsWith('custom_');
                  return (
                    <div key={ch.id} className="relative group flex-shrink-0">
                      <button
                        onClick={() => switchChannel(ch.id)}
                        className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                          isActive
                            ? 'bg-background border border-border shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        } ${isCustom ? 'pr-6' : ''}`}
                      >
                        <Icon size={13} weight="regular" className={isActive ? ch.iconColor : ''} />
                        {ch.label}
                      </button>
                      {isCustom && (
                        <button
                          onClick={(e) => handleRemoveCustom(e, ch.id)}
                          title="Eliminar pestana"
                          aria-label={`Eliminar ${ch.label}`}
                          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-all"
                        >
                          <Trash size={10} weight="bold" />
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={() => { setAddingCustom(true); setTimeout(() => urlInputRef.current?.focus(), 50); }}
                  title="Agregar canal personalizado"
                  aria-label="Agregar canal"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0 transition-colors"
                >
                  <Plus size={13} weight="bold" />
                </button>
              </div>

              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={toggleExpanded}
                  title={expanded ? 'Reducir' : 'Expandir'}
                  aria-label={expanded ? 'Reducir drawer' : 'Expandir drawer'}
                  className="h-8 w-8 hidden lg:inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {expanded ? <ArrowsIn size={14} weight="regular" /> : <ArrowsOut size={14} weight="regular" />}
                </button>
                <a
                  href={active?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir en pestana nueva"
                  aria-label="Abrir en pestana nueva"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ArrowSquareOut size={14} weight="regular" />
                </a>
                <button
                  onClick={() => setOpen(false)}
                  title="Cerrar"
                  aria-label="Cerrar panel"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
            </header>

            {/* Form anadir canal personalizado */}
            {addingCustom && (
              <form onSubmit={handleAddCustom} className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 flex-shrink-0">
                <Globe size={14} className="text-muted-foreground flex-shrink-0" />
                <input
                  ref={urlInputRef}
                  type="url"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="https://tu-canal.com"
                  className="flex-1 min-w-0 h-8 px-2 text-xs bg-card border border-border rounded outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={customLabelInput}
                  onChange={(e) => setCustomLabelInput(e.target.value)}
                  placeholder="Nombre"
                  className="w-24 h-8 px-2 text-xs bg-card border border-border rounded outline-none focus:border-primary"
                />
                <button type="submit" className="h-8 px-3 rounded text-xs font-medium bg-primary text-primary-foreground">Agregar</button>
                <button type="button" onClick={() => { setAddingCustom(false); setCustomInput(''); setCustomLabelInput(''); }} className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
              </form>
            )}

            {/* Content area: iframe o fallback */}
            <div className="flex-1 relative overflow-hidden bg-muted/10">
              {active && (
                active.iframeable === false || iframeError[active.id] ? (
                  <BlockedState channel={active} />
                ) : (
                  <iframe
                    key={active.id}
                    src={active.url}
                    title={active.label}
                    className="w-full h-full border-0"
                    onError={() => setIframeError((p) => ({ ...p, [active.id]: true }))}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  />
                )
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function BlockedState({ channel }) {
  const Icon = channel.icon;
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 p-6 text-center">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${channel.iconColor || 'text-muted-foreground'} bg-muted/40`}>
        <Icon size={32} weight="duotone" />
      </div>
      <div className="max-w-sm space-y-2">
        <h3 className="font-semibold">{channel.label}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Este servicio no permite cargarse dentro de otra pagina por seguridad. Abrelo en una ventana al lado del CRM y trabaja con ambos en paralelo.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 w-full max-w-xs">
        <button
          type="button"
          onClick={() => openInPopup(channel.url)}
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowSquareOut size={15} weight="bold" />
          Abrir en ventana
        </button>
        <a
          href={channel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          Abrir en pestana del navegador
        </a>
      </div>
      <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-[11px] max-w-sm">
        <ShieldWarning size={14} weight="bold" className="flex-shrink-0 mt-0.5" />
        <span>Limitacion del navegador (X-Frame-Options) — no es algo que el CRM pueda evitar.</span>
      </div>
    </div>
  );
}
