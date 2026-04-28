import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, SquaresFour, Users, UserCheck, Package, Megaphone,
  MagnifyingGlass, Robot, Sparkle, Calculator, Gear, ArrowRight,
  ChartLineUp, GraduationCap, Globe, Envelope, Coins, CurrencyEur,
  Receipt, Wallet, CaretRight, Keyboard, Warning, CheckCircle, Info,
  Export, Bell, FileText, Link, WhatsappLogo, CalendarCheck,
  ArrowsDownUp, DownloadSimple, Trash, UserPlus, LockKey,
  ShieldCheck, WebhooksLogo, Tag, ToggleRight, Upload, Eye,
  MagnifyingGlass as Search, Command, Lightning,
} from '@phosphor-icons/react';

/* ─── Navigation ──────────────────────────────────────────── */
const SECTIONS = [
  { id: 'introduccion', label: 'Introducción', icon: BookOpen },
  { id: 'dashboard',    label: 'Dashboard',    icon: SquaresFour },
  { id: 'prospectos',   label: 'Prospectos',   icon: Users },
  { id: 'clientes',     label: 'Clientes',     icon: UserCheck },
  { id: 'productos',    label: 'Productos',    icon: Package },
  { id: 'matriculas',   label: 'Matrículas',   icon: GraduationCap },
  { id: 'campanas',     label: 'Campañas',     icon: Megaphone },
  { id: 'seo',          label: 'Tráfico orgánico', icon: MagnifyingGlass },
  { id: 'ia',           label: 'IA y Reportes', icon: Robot },
  { id: 'contabilidad', label: 'Contabilidad', icon: Calculator },
  { id: 'configuracion',label: 'Configuración',icon: Gear },
  { id: 'atajos',       label: 'Atajos',       icon: Keyboard },
];

/* ─── Primitives ──────────────────────────────────────────── */
function SectionAnchor({ id }) {
  return <div id={id} className="scroll-mt-4 absolute -top-4" />;
}

function SectionHeader({ id, icon: Icon, label, color = 'blue', description }) {
  const colors = {
    blue:   'from-blue-500/10 to-blue-500/0 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40',
    violet: 'from-violet-500/10 to-violet-500/0 border-violet-200 dark:border-violet-900 text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40',
    emerald:'from-emerald-500/10 to-emerald-500/0 border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40',
    amber:  'from-amber-500/10 to-amber-500/0 border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
    rose:   'from-rose-500/10 to-rose-500/0 border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40',
    sky:    'from-sky-500/10 to-sky-500/0 border-sky-200 dark:border-sky-900 text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40',
    indigo: 'from-indigo-500/10 to-indigo-500/0 border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40',
    teal:   'from-teal-500/10 to-teal-500/0 border-teal-200 dark:border-teal-900 text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/40',
    orange: 'from-orange-500/10 to-orange-500/0 border-orange-200 dark:border-orange-900 text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40',
  };
  const c = colors[color];
  const [gradFrom, , border, text, iconBg] = c.split(' ');
  return (
    <div id={id} className={`mt-10 mb-5 scroll-mt-4 rounded-xl border bg-gradient-to-r ${gradFrom} to-transparent ${border} px-5 py-4 flex items-center gap-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={20} weight="duotone" className={text} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground leading-tight">{label}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function SubHeader({ id, children }) {
  return (
    <h3 id={id} className="scroll-mt-4 text-sm font-bold text-foreground mt-6 mb-2.5 flex items-center gap-2">
      <span className="w-1 h-4 rounded-full bg-primary inline-block" />
      {children}
    </h3>
  );
}

function P({ children }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>;
}

function FeatureGrid({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-3">{children}</div>;
}

function FeatureCard({ icon: Icon, title, children, color = 'default' }) {
  const colors = {
    default: 'border-border bg-card',
    blue: 'border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20',
    green: 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20',
    violet: 'border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20',
    orange: 'border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20',
  };
  const iconColors = {
    default: 'text-primary', blue: 'text-blue-500', green: 'text-emerald-500',
    violet: 'text-violet-500', orange: 'text-orange-500',
  };
  return (
    <div className={`rounded-lg border p-3.5 ${colors[color]}`}>
      {Icon && (
        <div className="flex items-center gap-2 mb-1.5">
          <Icon size={15} weight="duotone" className={iconColors[color]} />
          <span className="text-xs font-bold text-foreground">{title}</span>
        </div>
      )}
      {!Icon && title && <p className="text-xs font-bold text-foreground mb-1">{title}</p>}
      <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function Steps({ items }) {
  return (
    <div className="my-3 space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </div>
          <div className="flex-1 pt-0.5">
            {typeof item === 'string'
              ? <p className="text-sm text-muted-foreground">{item}</p>
              : <><p className="text-sm font-semibold text-foreground">{item.title}</p><p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p></>
            }
          </div>
        </div>
      ))}
    </div>
  );
}

function Callout({ type = 'info', children }) {
  const cfg = {
    info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900', text: 'text-blue-800 dark:text-blue-300', ic: 'text-blue-500' },
    tip:  { icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900', text: 'text-emerald-800 dark:text-emerald-300', ic: 'text-emerald-500' },
    warn: { icon: Warning, bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900', text: 'text-amber-800 dark:text-amber-300', ic: 'text-amber-500' },
  };
  const c = cfg[type];
  const Icon = c.icon;
  return (
    <div className={`flex gap-3 p-3.5 rounded-lg border ${c.bg} my-3`}>
      <Icon size={15} className={`${c.ic} mt-0.5 flex-shrink-0`} weight="fill" />
      <p className={`text-xs leading-relaxed ${c.text}`}>{children}</p>
    </div>
  );
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted border border-border text-[11px] font-mono font-bold text-foreground mx-0.5">
      {children}
    </kbd>
  );
}

function StatusBadge({ label, color }) {
  const colors = {
    blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    sky:    'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    red:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    gray:   'bg-muted text-muted-foreground',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${colors[color]}`}>
      {label}
    </span>
  );
}

/* ─── Main component ──────────────────────────────────────── */
export default function ManualPage() {
  const [activeId, setActiveId] = useState('introduccion');
  const contentRef = useRef(null);

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveId(id); }
  }

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        const vis = entries.filter(e => e.isIntersecting);
        if (vis.length > 0) setActiveId(vis[0].target.id);
      },
      { rootMargin: '-8% 0px -72% 0px', threshold: 0 }
    );
    const hs = contentRef.current?.querySelectorAll('[id]') || [];
    hs.forEach(h => obs.observe(h));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex gap-8 max-w-[1180px] pb-20">

      {/* ── Sidebar ── */}
      <aside className="hidden lg:block w-48 flex-shrink-0">
        <div className="sticky top-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-3">Contenido</p>
          <nav className="space-y-0.5">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const active = activeId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] transition-all text-left ${
                    active
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon size={14} weight={active ? 'fill' : 'regular'} className="flex-shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* ── Content ── */}
      <main ref={contentRef} className="flex-1 min-w-0">

        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg flex-shrink-0">
              <BookOpen size={28} weight="duotone" className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Manual de usuario</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Guía completa de MultiCRM · Todos los módulos explicados
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: '12 módulos', icon: SquaresFour, color: 'text-blue-500' },
              { label: '3 roles de acceso', icon: ShieldCheck, color: 'text-violet-500' },
              { label: 'Multi-proyecto', icon: Globe, color: 'text-emerald-500' },
              { label: 'Atajos de teclado', icon: Keyboard, color: 'text-amber-500' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-2 border border-border/50">
                  <Icon size={14} className={item.color} weight="duotone" />
                  <span className="text-xs font-semibold text-foreground">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── INTRODUCCIÓN ── */}
        <SectionHeader id="introduccion" icon={BookOpen} label="Introducción" color="blue"
          description="¿Qué es MultiCRM y cómo está organizado?" />
        <P>
          MultiCRM es un CRM interno multi-proyecto para gestionar el ciclo completo de ventas:
          captación de prospectos, conversión, cobro y análisis de campañas. Cada usuario pertenece
          a uno o más proyectos que se seleccionan en el desplegable del menú lateral.
        </P>

        <SubHeader id="roles">Roles de acceso</SubHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
          {[
            { role: 'Superadmin', color: 'violet', desc: 'Acceso total al sistema. Crea y desactiva usuarios, ve todos los proyectos y toda la configuración.', icon: ShieldCheck },
            { role: 'Admin', color: 'blue', desc: 'Acceso operativo completo dentro de sus proyectos. Puede crear usuarios pero no gestionarlos globalmente.', icon: LockKey },
            { role: 'Gestor', color: 'gray', desc: 'Solo ve sus proyectos asignados. En prospectos, gestiona únicamente los leads asignados a él.', icon: Users },
          ].map(r => {
            const Icon = r.icon;
            const borderColors = { violet: 'border-violet-200 dark:border-violet-900', blue: 'border-blue-200 dark:border-blue-900', gray: 'border-border' };
            const bgColors = { violet: 'bg-violet-50/60 dark:bg-violet-950/20', blue: 'bg-blue-50/60 dark:bg-blue-950/20', gray: 'bg-muted/40' };
            return (
              <div key={r.role} className={`rounded-xl border p-4 ${borderColors[r.color]} ${bgColors[r.color]}`}>
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge label={r.role} color={r.color} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
              </div>
            );
          })}
        </div>
        <Callout type="tip">
          Si no ves alguna sección en el menú, tu rol no tiene acceso o el módulo está desactivado para ese proyecto.
          Un Admin puede habilitarlo en Configuración → Proyecto → Módulos.
        </Callout>

        {/* ── DASHBOARD ── */}
        <SectionHeader id="dashboard" icon={SquaresFour} label="Dashboard" color="violet"
          description="Vista general del proyecto: KPIs, tareas del día y pipeline" />
        <P>La pantalla principal con una visión de 360° del estado del proyecto en tiempo real.</P>

        <SubHeader>KPIs principales</SubHeader>
        <FeatureGrid>
          <FeatureCard icon={Users} title="Total prospectos" color="blue">
            Suma de todos los leads del proyecto activos e inactivos.
          </FeatureCard>
          <FeatureCard icon={Lightning} title="Nuevos" color="orange">
            Prospectos en estado «Nuevo» o «Por contactar» pendientes de gestión.
          </FeatureCard>
          <FeatureCard icon={CheckCircle} title="Convertidos" color="green">
            Prospectos que han llegado a estado «Convertido» con compra registrada.
          </FeatureCard>
          <FeatureCard icon={ChartLineUp} title="Tasa de conversión" color="violet">
            Porcentaje de convertidos sobre el total de prospectos del proyecto.
          </FeatureCard>
        </FeatureGrid>

        <SubHeader>Panel «Tu día de hoy»</SubHeader>
        <P>Resumen de tareas urgentes que aparece en la parte superior del dashboard:</P>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-3">
          {[
            { icon: Bell, label: 'Pendientes', desc: 'Recordatorios vencidos hoy', color: 'text-orange-500' },
            { icon: Users, label: 'Nuevos hoy', desc: 'Prospectos llegados hoy y esta semana', color: 'text-blue-500' },
            { icon: Warning, label: 'Inactivos', desc: 'Sin actividad reciente, necesitan contacto', color: 'text-amber-500' },
            { icon: Receipt, label: 'Cobros vencidos', desc: 'Pagos atrasados en cuentas por cobrar', color: 'text-red-500' },
            { icon: CurrencyEur, label: 'Ingresos hoy', desc: 'Importe cobrado en el día actual', color: 'text-emerald-500' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex gap-2.5 p-3 rounded-lg border border-border bg-card">
                <Icon size={16} className={`${item.color} flex-shrink-0 mt-0.5`} weight="duotone" />
                <div>
                  <p className="text-xs font-bold text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <Callout type="warn">
          Los recordatorios vencidos aparecen marcados en rojo. Resuélvelos antes de que se acumulen —
          haz clic en cualquiera para ir directamente a la ficha del prospecto.
        </Callout>

        {/* ── PROSPECTOS ── */}
        <SectionHeader id="prospectos" icon={Users} label="Prospectos" color="emerald"
          description="El núcleo del CRM — gestión completa del funnel de ventas" />

        <SubHeader>Lista y filtros</SubHeader>
        <FeatureGrid>
          <FeatureCard icon={Search} title="Búsqueda" color="blue">
            Filtra por nombre, email o teléfono en tiempo real.
          </FeatureCard>
          <FeatureCard icon={Tag} title="Estado" color="violet">
            Nuevo · Por contactar · Contactado · En seguimiento · Convertido · No interesado
          </FeatureCard>
          <FeatureCard icon={Megaphone} title="Canal de origen" color="orange">
            Meta Ads · Google Ads · TikTok Ads · Orgánico · ChatGPT IA · Referido · Directo
          </FeatureCard>
          <FeatureCard icon={Users} title="Responsable" color="green">
            Filtra por gestor asignado (solo Admin/Superadmin).
          </FeatureCard>
        </FeatureGrid>

        <SubHeader>Vista pipeline</SubHeader>
        <P>
          Accesible desde el botón «Pipeline» en la cabecera. Muestra columnas Kanban por estado.
          Arrastra las tarjetas para cambiar el estado — los cambios se guardan al instante.
        </P>

        <SubHeader>Ficha del prospecto</SubHeader>
        <P>Haz clic en cualquier prospecto para abrir su ficha completa con 6 paneles:</P>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 my-3">
          {[
            { icon: FileText, title: 'Datos personales', desc: 'Nombre, email, teléfono, origen, estado y responsable. Editables con el botón «Editar»', color: 'blue' },
            { icon: Tag, title: 'UTMs y campaña', desc: 'Parámetros de seguimiento del tráfico (utm_source, utm_medium, utm_campaign…)', color: 'violet' },
            { icon: ChartLineUp, title: 'Timeline', desc: 'Historial cronológico de llamadas, emails, WhatsApp y notas del equipo', color: 'emerald' },
            { icon: CalendarCheck, title: 'Recordatorios', desc: 'Seguimientos programados con fecha y nota. Aparecen en el Dashboard del día', color: 'orange' },
            { icon: CurrencyEur, title: 'Conversiones', desc: 'Productos comprados, importes, pagos parciales y estado de cobro', color: 'green' },
            { icon: Package, title: 'Dossier', desc: 'Enlace temporal del PDF del producto para enviárselo al prospecto (15 min)', color: 'default' },
          ].map(item => {
            const Icon = item.icon;
            return <FeatureCard key={item.title} icon={Icon} title={item.title} color={item.color}>{item.desc}</FeatureCard>;
          })}
        </div>

        <SubHeader>Registrar una conversión</SubHeader>
        <Steps items={[
          { title: 'Cambia el estado a «Convertido»', desc: 'O usa el botón «+ Conversión» en la sección de conversiones de la ficha' },
          { title: 'Rellena el formulario', desc: 'Producto del catálogo, importe total, método de pago y fecha de venta' },
          { title: 'Registra pagos parciales', desc: 'Desde la conversión creada, usa «+ Pago» para ir añadiendo cobros. El sistema calcula el pendiente automáticamente' },
        ]} />

        <SubHeader>Acciones masivas</SubHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
          {[
            { icon: Tag, label: 'Cambiar estado', color: 'text-blue-500' },
            { icon: UserPlus, label: 'Asignar gestor', color: 'text-violet-500' },
            { icon: DownloadSimple, label: 'Exportar CSV', color: 'text-emerald-500' },
            { icon: Trash, label: 'Eliminar', color: 'text-red-500' },
          ].map(a => {
            const Icon = a.icon;
            return (
              <div key={a.label} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Icon size={14} className={a.color} weight="duotone" />
                <span className="text-xs font-semibold text-foreground">{a.label}</span>
              </div>
            );
          })}
        </div>
        <Callout type="info">
          Selecciona prospectos con los checkboxes de la tabla. Aparece la barra de acciones en la parte inferior.
        </Callout>

        <SubHeader>Crear audiencia para Meta</SubHeader>
        <P>
          En <strong>Prospectos → Crear audiencia</strong> exporta segmentos en formato CSV compatible
          con Meta Custom Audiences. Los emails se hashean con SHA-256 antes de exportar (requisito de Meta).
          Usa los presets (No convertidos, Convertidos, Solo pagado, Orgánico) o crea un filtro personalizado.
        </P>

        {/* ── CLIENTES ── */}
        <SectionHeader id="clientes" icon={UserCheck} label="Clientes" color="sky"
          description="Prospectos convertidos con historial de compras y estado de cobro" />
        <P>
          Vista enriquecida de todos los prospectos con estado «Convertido» y al menos una compra registrada.
        </P>
        <FeatureGrid>
          <FeatureCard icon={CurrencyEur} title="Financiero" color="green">
            Total facturado, total cobrado e importe pendiente por cliente.
          </FeatureCard>
          <FeatureCard icon={Package} title="Historial de compras" color="blue">
            Todos los productos comprados con fechas y método de pago.
          </FeatureCard>
        </FeatureGrid>
        <Callout type="tip">
          Para editar datos del cliente (email, teléfono…) ve a su ficha en Prospectos.
          Los clientes se sincronizan automáticamente con el prospecto.
        </Callout>

        {/* ── PRODUCTOS ── */}
        <SectionHeader id="productos" icon={Package} label="Productos" color="amber"
          description="Catálogo del proyecto con dossiers PDF versionados" />
        <P>Cada proyecto tiene su propio catálogo de productos con precios, categorías y materiales de venta.</P>
        <FeatureGrid>
          <FeatureCard icon={Package} title="Catálogo" color="orange">
            Crea, edita o archiva productos. Asigna categorías y subcategorías para organizarlos.
          </FeatureCard>
          <FeatureCard icon={FileText} title="Precio por defecto" color="blue">
            El precio del producto se autocompletará al registrar una conversión.
          </FeatureCard>
        </FeatureGrid>

        <SubHeader>Dossiers PDF</SubHeader>
        <Steps items={[
          { title: 'Sube el PDF desde la ficha del producto', desc: 'Drag & drop o clic. Se guarda en almacenamiento privado.' },
          { title: 'El sistema guarda versiones', desc: 'Subir un nuevo PDF no elimina el anterior — el historial queda intacto.' },
          { title: 'Genera un enlace temporal desde la ficha del prospecto', desc: 'Válido 15 minutos. Cópialo y envíalo por WhatsApp o email.' },
        ]} />
        <Callout type="warn">
          Los enlaces de dossier caducan a los 15 minutos por seguridad. No los guardes en plantillas reutilizables —
          genera uno nuevo cada vez que necesites enviárselo a alguien.
        </Callout>

        {/* ── MATRÍCULAS ── */}
        <SectionHeader id="matriculas" icon={GraduationCap} label="Matrículas" color="indigo"
          description="Solicitudes de admisión para proyectos educativos" />
        <P>
          Módulo específico para gestionar el proceso de admisión de alumnos, desde la solicitud inicial hasta la validación.
        </P>
        <div className="flex flex-wrap gap-2 my-3">
          {[
            { label: 'Solicitud admisión', color: 'sky' },
            { label: 'Datos validados', color: 'indigo' },
            { label: 'Pendiente', color: 'amber' },
            { label: 'Validada', color: 'green' },
            { label: 'Rechazada', color: 'red' },
          ].map(s => <StatusBadge key={s.label} label={s.label} color={s.color} />)}
        </div>

        <SubHeader>Webhooks de admisión</SubHeader>
        <P>
          Las matrículas pueden llegar automáticamente desde formularios externos.
          En la pestaña «Webhooks de admisión» genera tokens, obtén el endpoint y configura tu formulario.
        </P>

        {/* ── CAMPAÑAS ── */}
        <SectionHeader id="campanas" icon={Megaphone} label="Campañas publicitarias" color="rose"
          description="Meta Ads + Google Ads sincronizados con datos reales del CRM" />
        <Callout type="info">
          Los datos se sincronizan automáticamente cada noche. Las APIs de Meta y Google tienen una
          latencia de 24-48h para datos consolidados — es normal ver datos del día anterior.
        </Callout>
        <FeatureGrid>
          <FeatureCard icon={Megaphone} title="Vista consolidada" color="violet">
            Gasto + clicks + prospectos CRM + CPA real unificados para Meta y Google en el período seleccionado.
          </FeatureCard>
          <FeatureCard icon={ChartLineUp} title="CPA real" color="orange">
            Coste por adquisición calculado con prospectos del CRM atribuidos por utm_campaign,
            no con conversiones de Meta/Google.
          </FeatureCard>
          <FeatureCard icon={Globe} title="Meta Ads" color="blue">
            KPIs por campaña: inversión, clicks, CPC, prospectos CRM y CPA real.
          </FeatureCard>
          <FeatureCard icon={Search} title="Google Ads" color="green">
            Igual que Meta, más tabla de keywords con clicks, impresiones, CTR y posición media.
          </FeatureCard>
        </FeatureGrid>

        {/* ── SEO ── */}
        <SectionHeader id="seo" icon={MagnifyingGlass} label="Tráfico orgánico (SEO)" color="teal"
          description="Google Search Console integrado directamente en el CRM" />
        <FeatureGrid>
          <FeatureCard icon={Search} title="Clicks e impresiones" color="blue">
            Visitas orgánicas reales desde Google y veces que el sitio apareció en resultados.
          </FeatureCard>
          <FeatureCard icon={ChartLineUp} title="CTR y posición media" color="green">
            Porcentaje de clics sobre impresiones y posición media global en los resultados.
          </FeatureCard>
          <FeatureCard icon={Tag} title="Top 20 keywords" color="violet">
            Las palabras clave con más clicks con su CTR y posición individual.
          </FeatureCard>
          <FeatureCard icon={Megaphone} title="Gráfica consolidada" color="orange">
            Evolución mensual de tráfico orgánico vs pagado vs prospectos CRM (12 meses).
          </FeatureCard>
        </FeatureGrid>
        <Callout type="warn">
          Los datos de GSC tienen un retraso de 2-3 días. La fecha de última actualización
          se muestra en el banner superior de la página.
        </Callout>

        {/* ── IA ── */}
        <SectionHeader id="ia" icon={Robot} label="IA y Reportes" color="violet"
          description="Dashboard Stripe para proyectos SaaS + reportes automáticos con Claude" />

        <SubHeader>Dashboard IA</SubHeader>
        <FeatureGrid>
          <FeatureCard icon={CurrencyEur} title="MRR" color="green">
            Ingresos mensuales recurrentes con evolución de los últimos 12 meses.
          </FeatureCard>
          <FeatureCard icon={Users} title="Suscripciones" color="blue">
            Usuarios con plan activo y churn rate mensual (tasa de cancelación).
          </FeatureCard>
        </FeatureGrid>

        <SubHeader>Reportes IA</SubHeader>
        <P>
          Genera informes mensuales de rendimiento con inteligencia artificial (Claude de Anthropic).
          El reporte analiza todos los datos del proyecto y produce un informe completo en markdown:
        </P>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
          {['Resumen ejecutivo del mes', 'Análisis de prospectos por canal y estado',
            'Rendimiento campañas vs tráfico orgánico', 'Conversiones y facturación del período',
            'Recomendaciones de mejora', 'Exportación a PDF con un clic'
          ].map(item => (
            <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" weight="fill" />
              {item}
            </div>
          ))}
        </div>

        {/* ── CONTABILIDAD ── */}
        <SectionHeader id="contabilidad" icon={Calculator} label="Contabilidad" color="emerald"
          description="Control financiero completo del proyecto" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 my-3">
          {[
            { icon: CurrencyEur, title: 'Ingresos', desc: 'Lista de conversiones con estado de cobro (facturado / cobrado / pendiente).', color: 'green' },
            { icon: Receipt, title: 'Egresos', desc: 'Gastos del proyecto con categorías, pagos parciales y filtros por fecha.', color: 'orange' },
            { icon: Wallet, title: 'Cuentas por cobrar', desc: 'Conversiones con importe pendiente. Las vencidas se destacan en rojo.', color: 'blue' },
            { icon: Receipt, title: 'Cuentas por pagar', desc: 'Egresos pendientes de pago con fecha de vencimiento y alertas.', color: 'violet' },
            { icon: Coins, title: 'Comisiones', desc: 'Cálculo automático de comisiones por ventas para cada gestor.', color: 'orange' },
            { icon: FileText, title: 'Nóminas', desc: 'Generación de períodos: salario fijo + horas extra + comisiones.', color: 'default' },
          ].map(item => {
            const Icon = item.icon;
            return <FeatureCard key={item.title} icon={Icon} title={item.title} color={item.color}>{item.desc}</FeatureCard>;
          })}
        </div>
        <Callout type="tip">
          Los registros de «Cuentas por cobrar» se crean automáticamente al registrar una conversión.
          No necesitas duplicar el trabajo — solo registra la conversión desde la ficha del prospecto.
        </Callout>

        {/* ── CONFIGURACIÓN ── */}
        <SectionHeader id="configuracion" icon={Gear} label="Configuración" color="orange"
          description="Gestión de usuarios, proyectos, módulos, API keys y webhooks" />
        <Callout type="info">Solo accesible para roles Admin y Superadmin.</Callout>

        <SubHeader>Crear un nuevo usuario</SubHeader>
        <Steps items={[
          { title: 'Rellena nombre, email y rol', desc: 'Elige Admin o Gestor. El Superadmin no se puede crear desde el panel.' },
          { title: 'Asigna proyectos', desc: 'El usuario solo verá los proyectos que le asignes.' },
          { title: 'El usuario recibe el email de bienvenida', desc: 'Brevo envía automáticamente un enlace para que establezca su contraseña. El enlace caduca en 48h.' },
        ]} />

        <SubHeader>Configuración del proyecto</SubHeader>
        <FeatureGrid>
          <FeatureCard icon={Globe} title="Identidad" color="blue">
            Nombre, emoji o logo del proyecto. El logo se muestra en el selector del sidebar.
          </FeatureCard>
          <FeatureCard icon={ToggleRight} title="Módulos activos" color="green">
            Activa o desactiva Leads, Matrículas, Contabilidad, etc. Solo aparecen en el menú los módulos habilitados.
          </FeatureCard>
          <FeatureCard icon={LockKey} title="API keys" color="violet">
            Credenciales de Meta Ads y Google Ads encriptadas con AES-256. Configurables sin tocar el código.
          </FeatureCard>
          <FeatureCard icon={Tag} title="Campos personalizados" color="orange">
            Añade campos extra a la ficha del prospecto (texto, número, fecha, lista, sí/no). Agrúpalos por sección.
          </FeatureCard>
        </FeatureGrid>

        <SubHeader>Webhook de leads</SubHeader>
        <div className="my-3 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Globe size={16} weight="duotone" className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Endpoint</p>
              <code className="text-[11px] text-muted-foreground">POST /api/leads/webhook</code>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <LockKey size={16} weight="duotone" className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Autenticación</p>
              <code className="text-[11px] text-muted-foreground">Header: X-API-Key: &lt;clave_del_proyecto&gt;</code>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText size={16} weight="duotone" className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Campos</p>
              <code className="text-[11px] text-muted-foreground">nombre, email, telefono, canal, utm_source, utm_medium, utm_campaign</code>
            </div>
          </div>
        </div>
        <Callout type="tip">
          El lead se asigna por round-robin automático al gestor con menos carga del proyecto.
          La respuesta del webhook es menor de 500ms — el email de notificación al gestor se envía de forma asíncrona.
        </Callout>

        {/* ── ATAJOS ── */}
        <SectionHeader id="atajos" icon={Keyboard} label="Atajos de teclado" color="indigo"
          description="Navega el CRM sin levantar las manos del teclado" />
        <div className="rounded-xl border border-border overflow-hidden my-3">
          {[
            { keys: ['Ctrl', 'K'], desc: 'Abre la paleta de búsqueda rápida — navega a cualquier sección o busca un prospecto por nombre o email' },
            { keys: ['Esc'], desc: 'Cierra la paleta de búsqueda o cualquier modal abierto' },
            { keys: ['↑', '↓'], desc: 'Navega por los resultados de la paleta de búsqueda' },
            { keys: ['↵'], desc: 'Selecciona el resultado resaltado y navega a esa sección o prospecto' },
          ].map((row, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
              <div className="flex items-center gap-1 flex-shrink-0 w-28">
                {row.keys.map((k, j) => (
                  <span key={j}>
                    <Kbd>{k}</Kbd>
                    {j < row.keys.length - 1 && <span className="text-[10px] text-muted-foreground mx-0.5">+</span>}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{row.desc}</p>
            </div>
          ))}
        </div>
        <Callout type="tip">
          La paleta de búsqueda (<Kbd>Ctrl</Kbd>+<Kbd>K</Kbd>) busca en tiempo real entre todas las secciones
          y los prospectos del proyecto activo. Es la forma más rápida de llegar a cualquier lugar del CRM.
        </Callout>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen size={16} weight="duotone" className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">MultiCRM v0.1.0 — Fase Beta</p>
              <p className="text-xs text-muted-foreground">¿Falta algo o hay algo incorrecto? Comunícalo al equipo de desarrollo.</p>
            </div>
          </div>
          <StatusBadge label="Beta" color="amber" />
        </div>
      </main>
    </div>
  );
}
