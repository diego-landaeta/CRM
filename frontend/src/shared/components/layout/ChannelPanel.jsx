import { useState, useRef, useCallback } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import {
  WhatsappLogo, Envelope, Globe, X, ArrowsOut, ArrowsIn,
  ArrowSquareOut, Plus, Trash,
} from '@phosphor-icons/react';

const PRESET_CHANNELS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp Web',
    icon: WhatsappLogo,
    iconColor: 'text-green-600',
    url: 'https://web.whatsapp.com',
  },
  {
    id: 'webmail',
    label: 'Correo',
    icon: Envelope,
    iconColor: 'text-blue-600',
    url: 'https://mail.hostinger.com',
  },
];

const STORAGE_KEY = 'crm.channel-panel';

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // Migrate legacy single customUrl → customTabs array
    if (s.customUrl && !s.customTabs) {
      s.customTabs = [{ id: 'custom_0', label: 'Personalizado', url: s.customUrl }];
      delete s.customUrl;
    }
    return s;
  } catch {
    return {};
  }
}

function saveState(patch) {
  try {
    const prev = loadState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch { /* noop */ }
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
    ...customTabs.map(t => ({ ...t, icon: Globe, iconColor: 'text-muted-foreground' })),
  ];

  const active = channels.find(c => c.id === activeId) || channels[0];

  function toggle() {
    setOpen(prev => !prev);
  }

  function switchChannel(id) {
    setActiveId(id);
    saveState({ activeId: id });
    setIframeError(prev => ({ ...prev, [id]: false }));
  }

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    saveState({ expanded: next });
  }

  function handleAddCustom(e) {
    e.preventDefault();
    let url = customInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = 'https://' + url;
    const label = customLabelInput.trim() || new URL(url).hostname.replace('www.', '');
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
    const next = customTabs.filter(t => t.id !== id);
    setCustomTabs(next);
    saveState({ customTabs: next });
    if (activeId === id) {
      const fallback = channels.find(c => c.id !== id)?.id ?? 'whatsapp';
      setActiveId(fallback);
      saveState({ activeId: fallback });
    }
  }

  const handleIframeError = useCallback((id) => {
    setIframeError(prev => ({ ...prev, [id]: true }));
  }, []);

  const panelWidth = expanded ? 'w-[680px]' : 'w-[420px]';
  const panelHeight = expanded ? 'h-[80vh]' : 'h-[520px]';

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={toggle}
        title="Canales — WhatsApp, Correo, etc."
        aria-label="Abrir panel de canales"
        className={`fixed bottom-20 right-5 z-40 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-foreground text-background scale-95'
            : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:shadow-primary/10'
        }`}
      >
        {open ? <X size={18} weight="bold" /> : <WhatsappLogo size={20} weight="regular" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className={`fixed bottom-36 right-5 z-40 ${panelWidth} ${panelHeight} bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200`}
          style={{ maxWidth: 'calc(100vw - 24px)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
              {channels.map(ch => {
                const Icon = ch.icon;
                const isActive = ch.id === activeId;
                const isCustom = ch.id.startsWith('custom_');
                return (
                  <div key={ch.id} className="relative group flex-shrink-0">
                    <button
                      onClick={() => switchChannel(ch.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
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
                        title="Eliminar pestaña"
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-all"
                      >
                        <Trash size={10} weight="bold" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add custom URL button */}
              <button
                onClick={() => { setAddingCustom(true); setTimeout(() => urlInputRef.current?.focus(), 50); }}
                title="Agregar pestaña personalizada"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0 transition-colors"
              >
                <Plus size={13} weight="bold" />
              </button>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleExpand}
                title={expanded ? 'Reducir' : 'Expandir'}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {expanded ? <ArrowsIn size={14} weight="regular" /> : <ArrowsOut size={14} weight="regular" />}
              </button>
              <a
                href={active?.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en nueva pestaña"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ArrowSquareOut size={14} weight="regular" />
              </a>
              <button
                onClick={() => setOpen(false)}
                title="Cerrar"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </div>

          {/* Add custom URL form */}
          {addingCustom && (
            <form onSubmit={handleAddCustom} className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 flex-shrink-0">
              <Globe size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                ref={urlInputRef}
                type="url"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder="https://tu-panel.com"
                className="flex-1 min-w-0 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              />
              <input
                type="text"
                value={customLabelInput}
                onChange={e => setCustomLabelInput(e.target.value)}
                placeholder="Nombre"
                className="w-20 text-xs bg-transparent outline-none border-l border-border pl-2 placeholder:text-muted-foreground"
              />
              <button type="submit" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex-shrink-0">Agregar</button>
              <button type="button" onClick={() => { setAddingCustom(false); setCustomInput(''); setCustomLabelInput(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">Cancelar</button>
            </form>
          )}

          {/* iframe area */}
          <div className="flex-1 relative overflow-hidden">
            {active && (
              iframeError[active.id] ? (
                <BlockedState channel={active} />
              ) : (
                <iframe
                  key={active.id}
                  src={active.url}
                  title={active.label}
                  className="w-full h-full border-0"
                  onError={() => handleIframeError(active.id)}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                />
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BlockedState({ channel }) {
  const Icon = channel.icon;
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Icon size={22} weight="regular" className="text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-sm mb-1">{channel.label} no permite embeberse</p>
        <p className="text-xs text-muted-foreground max-w-[260px]">
          Este sitio bloquea la carga en marcos externos (X-Frame-Options). Puedes abrirlo en una nueva pestaña.
        </p>
      </div>
      <a
        href={channel.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <ArrowSquareOut size={15} weight="bold" />
        Abrir {channel.label}
      </a>
    </div>
  );
}
