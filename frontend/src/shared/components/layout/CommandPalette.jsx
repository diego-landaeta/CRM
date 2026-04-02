import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import { LEADS } from '@/shared/data/mock';
import {
  MagnifyingGlass,
  SquaresFour,
  Users,
  Package,
  Megaphone,
  CurrencyEur,
  ChartLineUp,
  Gear,
  User,
  ArrowRight,
} from '@phosphor-icons/react';

const SECTIONS = [
  { label: 'Dashboard', to: '/', icon: SquaresFour },
  { label: 'Leads', to: '/leads', icon: Users },
  { label: 'Pipeline', to: '/leads/pipeline', icon: Users },
  { label: 'Productos', to: '/products', icon: Package },
  { label: 'Campanas', to: '/campaigns', icon: Megaphone },
  { label: 'Ingresos', to: '/revenue', icon: CurrencyEur },
  { label: 'Reportes', to: '/reports', icon: ChartLineUp },
  { label: 'Configuracion', to: '/settings', icon: Gear },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { activeProject } = useProjectContext();

  // Keyboard shortcut
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const leads = LEADS[activeProject.id] || [];

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { sections: SECTIONS.slice(0, 6), leads: [] };

    const matchedSections = SECTIONS.filter((s) => s.label.toLowerCase().includes(q));
    const matchedLeads = leads.filter((l) =>
      l.nombre.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)
    ).slice(0, 5);

    return { sections: matchedSections, leads: matchedLeads };
  }, [query, leads]);

  const allResults = [
    ...results.sections.map((s) => ({ type: 'section', ...s })),
    ...results.leads.map((l) => ({ type: 'lead', label: l.nombre, sublabel: l.email, to: `/leads/${l.id}`, icon: User })),
  ];

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  function handleSelect(item) {
    navigate(item.to);
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && allResults[selectedIdx]) {
      handleSelect(allResults[selectedIdx]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_40px_rgb(0_0_0/0.15)] w-full max-w-lg mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 border-b border-border">
          <MagnifyingGlass size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar leads, secciones..."
            className="w-full h-14 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted text-[10px] font-bold text-muted-foreground border border-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto p-2">
          {allResults.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron resultados para "{query}"
            </div>
          ) : (
            <>
              {results.sections.length > 0 && (
                <div className="mb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-1.5">Secciones</p>
                  {results.sections.map((s, i) => {
                    const globalIdx = i;
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.to}
                        onClick={() => handleSelect(s)}
                        onMouseEnter={() => setSelectedIdx(globalIdx)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                          selectedIdx === globalIdx ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon size={18} weight={selectedIdx === globalIdx ? 'duotone' : 'regular'} />
                        <span className="font-medium">{s.label}</span>
                        <ArrowRight size={12} className="ml-auto opacity-40" />
                      </button>
                    );
                  })}
                </div>
              )}

              {results.leads.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 py-1.5">Leads</p>
                  {results.leads.map((l, i) => {
                    const globalIdx = results.sections.length + i;
                    return (
                      <button
                        key={l.id}
                        onClick={() => handleSelect({ to: `/leads/${l.id}` })}
                        onMouseEnter={() => setSelectedIdx(globalIdx)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                          selectedIdx === globalIdx ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <User size={18} weight={selectedIdx === globalIdx ? 'duotone' : 'regular'} />
                        <div className="text-left">
                          <span className="font-medium block">{l.nombre}</span>
                          <span className="text-[11px] text-muted-foreground">{l.email}</span>
                        </div>
                        <ArrowRight size={12} className="ml-auto opacity-40" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-bold">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-bold">↵</kbd> seleccionar</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-bold">esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
