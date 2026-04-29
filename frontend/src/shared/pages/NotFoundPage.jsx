import { useNavigate, Link } from 'react-router-dom';
import { Compass, ArrowLeft, House, MagnifyingGlass } from '@phosphor-icons/react';

const QUICK_LINKS = [
  { to: '/', label: 'Dashboard', icon: House },
  { to: '/leads', label: 'Prospectos', icon: Compass },
  { to: '/clients', label: 'Clientes', icon: Compass },
  { to: '/products', label: 'Productos', icon: Compass },
];

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
          <Compass size={28} weight="regular" className="text-muted-foreground" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Error 404</p>
        <h1 className="text-2xl font-semibold mb-2">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          La ruta que buscas no existe o se ha movido. Puedes volver atrás, ir al dashboard o usar la búsqueda rápida.
        </p>

        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors"
          >
            <ArrowLeft size={14} weight="bold" /> Volver atrás
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('crm:open-palette'))}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <MagnifyingGlass size={14} weight="bold" /> Buscar (⌘K)
          </button>
        </div>

        <div className="border-t border-border pt-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-3">Atajos</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LINKS.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors text-foreground"
                >
                  <Icon size={14} weight="regular" className="text-muted-foreground" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
