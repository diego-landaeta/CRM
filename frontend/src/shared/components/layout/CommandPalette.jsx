import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import {
  MagnifyingGlass,
  SquaresFour,
  Users,
  UserCheck,
  Package,
  Megaphone,
  CurrencyEur,
  ChartLineUp,
  Gear,
  User,
  ArrowRight,
  FacebookLogo,
  GoogleLogo,
  Robot,
  Sparkle,
  ChartBar,
  Calculator,
  Receipt,
  Wallet,
  Coins,
  Export,
} from '@phosphor-icons/react';

const SECTIONS = [
  { label: 'Dashboard', to: '/', icon: SquaresFour },
  { label: 'Prospectos', to: '/leads', icon: Users },
  { label: 'Pipeline', to: '/leads/pipeline', icon: Users },
  { label: 'Crear audiencia', to: '/leads/audiences', icon: Export },
  { label: 'Clientes', to: '/clients', icon: UserCheck },
  { label: 'Productos', to: '/products', icon: Package },
  { label: 'Campanas — Consolidado', to: '/campaigns', icon: Megaphone },
  { label: 'Campanas — Meta Ads', to: '/campaigns/meta', icon: FacebookLogo },
  { label: 'Campanas — Google Ads', to: '/campaigns/google', icon: GoogleLogo },
  { label: 'Trafico organico (SEO)', to: '/seo', icon: MagnifyingGlass },
  { label: 'Dashboard IA', to: '/ia-dashboard', icon: Robot },
  { label: 'Reportes IA', to: '/reports-ia', icon: Sparkle },
  { label: 'Contabilidad', to: '/accounting', icon: Calculator },
  { label: 'Ingresos', to: '/accounting/income', icon: CurrencyEur },
  { label: 'Egresos', to: '/accounting/expenses', icon: Receipt },
  { label: 'Cuentas por cobrar', to: '/accounting/receivable', icon: Wallet },
  { label: 'Cuentas por pagar', to: '/accounting/payable', icon: Wallet },
  { label: 'Comisiones', to: '/commissions', icon: Coins },
  { label: 'Reportes', to: '/reports', icon: ChartBar },
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

  const [leadResults, setLeadResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const searchLeads = useCallback(async (q) => {
    if (!q || !activeProject?.id) { setLeadResults([]); return; }
    setSearching(true);
    try {
      const res = await client.get(`/leads?projectId=${activeProject.id}&search=${encodeURIComponent(q)}&limit=5`);
      setLeadResults(res.success ? (res.data || []) : []);
    } catch {
      setLeadResults([]);
    } finally {
      setSearching(false);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    const timer = setTimeout(() => searchLeads(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, searchLeads]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { sections: SECTIONS.slice(0, 8), leads: [] };
    const matchedSections = SECTIONS.filter((s) => s.label.toLowerCase().includes(q));
    return { sections: matchedSections, leads: leadResults };
  }, [query, leadResults]);

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
    <div role="dialog" aria-label="Busqueda rapida" className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative bg-card rounded-lg border border-border  w-full max-w-lg mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 border-b border-border">
          <MagnifyingGlass size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar leads, secciones..."
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            className="w-full h-14 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted text-[10px] font-medium text-muted-foreground border border-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div id="command-palette-results" role="listbox" className="max-h-[320px] overflow-y-auto p-2">
          {searching ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Buscando...</div>
          ) : allResults.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron resultados para &quot;{query}&quot;
            </div>
          ) : !searching && (
            <>
              {results.sections.length > 0 && (
                <div className="mb-1">
                  <p className="text-xs text-muted-foreground px-3 py-1.5">Secciones</p>
                  {results.sections.map((s, i) => {
                    const globalIdx = i;
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.to}
                        role="option"
                        aria-selected={selectedIdx === globalIdx}
                        onClick={() => handleSelect(s)}
                        onMouseEnter={() => setSelectedIdx(globalIdx)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-all ${
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
                  <p className="text-xs text-muted-foreground px-3 py-1.5">Prospectos</p>
                  {results.leads.map((l, i) => {
                    const globalIdx = results.sections.length + i;
                    return (
                      <button
                        key={l.id}
                        role="option"
                        aria-selected={selectedIdx === globalIdx}
                        onClick={() => handleSelect({ to: `/leads/${l.id}` })}
                        onMouseEnter={() => setSelectedIdx(globalIdx)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-all ${
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
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-medium">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-medium">↵</kbd> seleccionar</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-medium">esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
