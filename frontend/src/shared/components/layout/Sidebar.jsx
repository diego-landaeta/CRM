import { NavLink } from 'react-router-dom';
import {
  SquaresFour,
  Users,
  Package,
  Megaphone,
  CurrencyEur,
  ChartLineUp,
  Gear,
  SignOut,
  CaretDown,
} from '@phosphor-icons/react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { cn } from '@/shared/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: SquaresFour },
  { label: 'Leads', to: '/leads', icon: Users },
  { label: 'Productos', to: '/products', icon: Package },
  { label: 'Campanas', to: '/campaigns', icon: Megaphone },
  { label: 'Ingresos', to: '/revenue', icon: CurrencyEur },
  { label: 'Reportes', to: '/reports', icon: ChartLineUp },
];

const SYSTEM_ITEMS = [
  { label: 'Configuracion', to: '/settings', icon: Gear },
];

function NavItem({ to, icon: Icon, label, badge }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all',
          isActive
            ? 'bg-zinc-100 text-zinc-950 font-bold'
            : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
        )
      }
    >
      <Icon size={18} weight="regular" />
      {label}
      {badge && (
        <span className="ml-auto text-[10px] font-bold bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { activeProject, switchProject, projects } = useProjectContext();

  return (
    <aside className="w-64 border-r bg-white h-screen fixed left-0 top-0 flex flex-col p-4 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[#4361ee] flex items-center justify-center text-white shadow-sm">
          <Package size={16} weight="bold" />
        </div>
        <span className="font-extrabold text-sm tracking-tight">MultiCRM</span>
      </div>

      {/* Project Selector */}
      <div className="mb-6 px-1">
        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-1.5 block">
          Proyecto
        </label>
        <div className="relative">
          <select
            value={activeProject.id}
            onChange={(e) => switchProject(Number(e.target.value))}
            className="w-full h-9 px-3 pr-8 rounded-lg border border-zinc-200 text-sm font-semibold bg-zinc-50 outline-none cursor-pointer appearance-none focus:border-[#4361ee] focus:ring-2 focus:ring-[#4361ee]/10 transition-all"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <CaretDown size={12} weight="bold" className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5">
        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-3 mb-2">Principal</p>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-3 mb-2 mt-6">Sistema</p>
        {SYSTEM_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* User */}
      <div className="mt-auto pt-4 border-t">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-extrabold text-xs">
            AM
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-950 truncate tracking-tight">Angel M.</p>
            <p className="text-[10px] text-zinc-400">Gestor</p>
          </div>
          <button className="text-zinc-400 hover:text-zinc-950 transition-colors p-1">
            <SignOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
