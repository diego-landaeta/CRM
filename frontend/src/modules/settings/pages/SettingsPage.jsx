import { useState } from 'react';
import {
  Users,
  Folder,
  Key,
  Envelope,
  ShieldCheck,
  Plus,
} from '@phosphor-icons/react';

const TABS = [
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'projects', label: 'Proyectos', icon: Folder },
  { id: 'apis', label: 'APIs Externas', icon: Key },
  { id: 'email', label: 'Email (Brevo)', icon: Envelope },
  { id: 'security', label: 'Seguridad', icon: ShieldCheck },
];

const MOCK_USERS = [
  { id: 1, name: 'Manuel Casas', email: 'manuel@empresa.com', role: 'superadmin', subtitle: 'Product Owner', projects: 'Todos', status: 'activo', color: 'bg-blue-100 text-blue-700' },
  { id: 2, name: 'Diego R.', email: 'diego@empresa.com', role: 'admin', subtitle: 'Dev Fullstack', projects: 'Psiko, ISEIH', status: 'activo', color: 'bg-emerald-100 text-emerald-700' },
  { id: 3, name: 'Angel M.', email: 'angel@empresa.com', role: 'gestor', subtitle: 'Dev Fullstack', projects: 'Psiko, Fono', status: 'activo', color: 'bg-amber-100 text-amber-700' },
];

const MOCK_PROJECTS = [
  { id: 1, name: 'Psiko Aprende', domain: 'psikoaprende.com', leads: 842, status: 'activo' },
  { id: 2, name: 'ISEIH', domain: 'iseih.com', leads: 234, status: 'activo' },
  { id: 3, name: 'Fono Aprende', domain: 'fonoaprende.com', leads: 128, status: 'activo' },
  { id: 4, name: 'Psicologo IA', domain: 'psicologoia.com', leads: 56, status: 'activo' },
  { id: 5, name: 'Nutricionista IA', domain: 'nutricionistaia.com', leads: 18, status: 'borrador' },
  { id: 6, name: 'Tarot IA', domain: 'tarotia.com', leads: 6, status: 'borrador' },
];

const MOCK_APIS = [
  { name: 'Meta Marketing API', version: 'v19', status: 'conectada', lastSync: '01 abr 2026, 06:00' },
  { name: 'Google Ads API', version: 'v16', status: 'conectada', lastSync: '01 abr 2026, 06:00' },
  { name: 'Google Search Console', version: 'v1', status: 'pendiente', lastSync: 'Nunca' },
  { name: 'Stripe', version: 'v2025-01', status: 'conectada', lastSync: '01 abr 2026, 08:15' },
  { name: 'Claude AI', version: 'claude-4', status: 'conectada', lastSync: 'En tiempo real' },
  { name: 'Brevo (Transactional)', version: 'v3', status: 'conectada', lastSync: '01 abr 2026, 14:32' },
];

const ROLE_STYLES = {
  superadmin: 'bg-violet-50 text-violet-600',
  admin: 'bg-blue-50 text-blue-600',
  gestor: 'bg-muted text-muted-foreground',
};

function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function UsersTab() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold tracking-tight">Gestion de Usuarios</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">Administra los usuarios del CRM y sus roles</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
          <Plus size={14} weight="bold" /> Invitar Usuario
        </button>
      </div>
      <div className="bg-card rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Usuario</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rol</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Proyectos</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_USERS.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold ${u.color}`}>
                      {getInitials(u.name)}
                    </div>
                    <div>
                      <span className="font-semibold block">{u.name}</span>
                      <span className="text-[10px] text-muted-foreground">{u.subtitle}</span>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ROLE_STYLES[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{u.projects}</td>
                <td className="px-5 py-3.5">
                  <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectsTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">Proyectos</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Proyectos educativos y plataformas IA registradas</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_PROJECTS.map((p) => (
          <div key={p.id} className="bg-card p-5 rounded-2xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-extrabold text-xs">
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">{p.domain} &bull; {p.leads} leads</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${p.status === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApisTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">APIs Externas</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Credenciales encriptadas con AES-256-GCM</p>
      </div>
      <div className="space-y-3">
        {MOCK_APIS.map((api) => (
          <div key={api.name} className="bg-card p-5 rounded-2xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Key size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{api.name} <span className="text-muted-foreground font-normal text-xs">({api.version})</span></p>
              <p className="text-[11px] text-muted-foreground">Ultimo sync: {api.lastSync}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
              api.status === 'conectada' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {api.status}
            </span>
            <button className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-zinc-600 hover:bg-muted transition-colors">
              Configurar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">Email — Brevo</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Plantillas de email transaccional</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'Bienvenida Lead', trigger: 'Webhook nuevo lead', sent: 284, rate: '98.2%' },
          { name: 'Recordatorio Contacto', trigger: 'Cron 48h sin contacto', sent: 156, rate: '97.4%' },
          { name: 'Envio Dossier', trigger: 'Manual por gestor', sent: 89, rate: '99.1%' },
          { name: 'Confirmacion Pago', trigger: 'Stripe webhook', sent: 34, rate: '100%' },
        ].map((t) => (
          <div key={t.name} className="bg-card p-5 rounded-2xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Envelope size={16} className="text-blue-600" /></div>
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{t.trigger}</p>
              </div>
            </div>
            <div className="flex gap-4 text-[13px]">
              <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Enviados</span><p className="font-bold">{t.sent}</p></div>
              <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Entrega</span><p className="font-bold text-emerald-600">{t.rate}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">Seguridad</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Configuracion de seguridad del sistema</p>
      </div>
      <div className="space-y-3">
        {[
          { label: 'Encriptacion de credenciales API', value: 'AES-256-GCM', ok: true },
          { label: 'Hash de contrasenas', value: 'bcrypt (cost factor 12)', ok: true },
          { label: 'JWT Access Token TTL', value: '15 minutos', ok: true },
          { label: 'Refresh Token TTL', value: '30 dias (httpOnly cookie)', ok: true },
          { label: 'CORS', value: 'Por dominio de proyecto', ok: true },
          { label: 'PostgreSQL', value: 'Solo acceso local (no expuesto)', ok: true },
          { label: 'Certificado SSL', value: "Let's Encrypt (auto-renewal)", ok: true },
          { label: 'Pre-signed URLs', value: '15 min expiracion', ok: true },
        ].map((s) => (
          <div key={s.label} className="bg-card p-4 rounded-2xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <ShieldCheck size={16} className={s.ok ? 'text-emerald-600' : 'text-red-500'} weight="duotone" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">{s.value}</p>
              </div>
            </div>
            <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">OK</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_CONTENT = {
  users: UsersTab,
  projects: ProjectsTab,
  apis: ApisTab,
  email: EmailTab,
  security: SecurityTab,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('users');
  const TabContent = TAB_CONTENT[activeTab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Configuracion</h1>
        <p className="text-muted-foreground text-sm">Ajustes del sistema y gestion de usuarios</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Settings Sidebar */}
        <div className="w-full lg:w-52 flex lg:flex-col gap-1 overflow-x-auto flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full lg:w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 font-bold'
                  : 'text-muted-foreground hover:bg-muted hover:text-zinc-700'
              }`}
            >
              <tab.icon size={16} weight={activeTab === tab.id ? 'duotone' : 'regular'} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          <TabContent />
        </div>
      </div>
    </div>
  );
}
