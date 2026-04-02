import { useState } from 'react';
import {
  Users,
  Folder,
  Key,
  Envelope,
  ShieldCheck,
  Plus,
  X,
  PencilSimple,
  DotsThreeVertical,
  UserCircleMinus,
  UserCirclePlus,
  CaretDown,
} from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { PROJECTS } from '@/shared/data/mock';
import Portal from '@/shared/components/ui/portal';

const TABS = [
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'projects', label: 'Proyectos', icon: Folder },
  { id: 'apis', label: 'APIs Externas', icon: Key },
  { id: 'email', label: 'Email (Brevo)', icon: Envelope },
  { id: 'security', label: 'Seguridad', icon: ShieldCheck },
];

const MOCK_USERS_INITIAL = [
  { id: 1, name: 'Manuel Casas', email: 'manuel@empresa.com', role: 'superadmin', subtitle: 'Product Owner', projects: [1,2,3,4,5,6], status: 'activo', ultimo_acceso: '02 abr 2026, 09:14', color: 'bg-blue-100 text-blue-700' },
  { id: 2, name: 'Diego R.', email: 'diego@empresa.com', role: 'admin', subtitle: 'Dev Fullstack', projects: [1,2], status: 'activo', ultimo_acceso: '01 abr 2026, 18:45', color: 'bg-emerald-100 text-emerald-700' },
  { id: 3, name: 'Angel M.', email: 'angel@empresa.com', role: 'admin', subtitle: 'Dev Fullstack', projects: [1,3], status: 'activo', ultimo_acceso: '02 abr 2026, 10:37', color: 'bg-amber-100 text-amber-700' },
  { id: 4, name: 'Laura Gomez', email: 'laura@empresa.com', role: 'gestor', subtitle: 'Gestora Comercial', projects: [1], status: 'activo', ultimo_acceso: '01 abr 2026, 16:22', color: 'bg-violet-100 text-violet-700' },
  { id: 5, name: 'Carlos Vega', email: 'carlos@empresa.com', role: 'gestor', subtitle: 'Gestor Comercial', projects: [1,2], status: 'inactivo', ultimo_acceso: '15 mar 2026, 11:00', color: 'bg-rose-100 text-rose-700' },
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

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
];

const inputClass = 'w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';
const selectClass = inputClass + ' appearance-none cursor-pointer pr-9';
const selectBg = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' };

function formatProjectNames(projectIds) {
  if (!projectIds || projectIds.length === 0) return 'Ninguno';
  if (projectIds.length === PROJECTS.length) return 'Todos';
  return projectIds
    .map((id) => PROJECTS.find((p) => p.id === id)?.nombre || '')
    .filter(Boolean)
    .join(', ');
}

function UsersTab() {
  const [users, setUsers] = useState(MOCK_USERS_INITIAL);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // --- Create user form state ---
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('gestor');
  const [newProjects, setNewProjects] = useState([]);

  // --- Edit role state ---
  const [editRole, setEditRole] = useState('');
  const [editProjects, setEditProjects] = useState([]);

  function resetCreateForm() {
    setNewName('');
    setNewEmail('');
    setNewRole('gestor');
    setNewProjects([]);
  }

  function handleCreateUser(e) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const nextId = Math.max(...users.map((u) => u.id)) + 1;
    const assignedProjects = newRole === 'gestor' ? newProjects : PROJECTS.map((p) => p.id);
    const newUser = {
      id: nextId,
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      subtitle: newRole === 'admin' ? 'Administrador' : 'Gestor Comercial',
      projects: assignedProjects,
      status: 'activo',
      ultimo_acceso: 'Nunca',
      color: AVATAR_COLORS[nextId % AVATAR_COLORS.length],
    };

    setUsers((prev) => [...prev, newUser]);
    setShowCreateDialog(false);
    resetCreateForm();
    toast({ title: 'Usuario creado', description: `Se ha enviado email de bienvenida a ${newUser.email}`, variant: 'default' });
  }

  function handleToggleProject(projectId, list, setter) {
    setter(list.includes(projectId) ? list.filter((id) => id !== projectId) : [...list, projectId]);
  }

  function handleOpenEdit(user) {
    setEditingUser(user);
    setEditRole(user.role);
    setEditProjects([...user.projects]);
    setOpenMenuId(null);
  }

  function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingUser) return;
    const assignedProjects = editRole === 'gestor' ? editProjects : PROJECTS.map((p) => p.id);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingUser.id
          ? { ...u, role: editRole, projects: assignedProjects, subtitle: editRole === 'admin' ? 'Administrador' : editRole === 'superadmin' ? u.subtitle : 'Gestor Comercial' }
          : u
      )
    );
    setEditingUser(null);
    toast({ title: 'Rol actualizado', description: `${editingUser.name} ahora es ${editRole}`, variant: 'default' });
  }

  function handleToggleActive(user) {
    const newStatus = user.status === 'activo' ? 'inactivo' : 'activo';
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    );
    setOpenMenuId(null);
    toast({
      title: newStatus === 'activo' ? 'Usuario reactivado' : 'Usuario desactivado',
      description: `${user.name} ahora esta ${newStatus}`,
      variant: newStatus === 'activo' ? 'default' : 'destructive',
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold tracking-tight">Gestion de Usuarios</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">Administra los usuarios del CRM y sus roles</p>
        </div>
        <button
          onClick={() => { resetCreateForm(); setShowCreateDialog(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus size={14} weight="bold" /> Invitar Usuario
        </button>
      </div>

      {/* Users table */}
      <div className="bg-card rounded-3xl border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Usuario</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rol</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Proyectos</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ultimo acceso</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${u.status === 'inactivo' ? 'opacity-50' : ''}`}>
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
                  <td className="px-5 py-3.5 text-muted-foreground max-w-[180px] truncate" title={formatProjectNames(u.projects)}>
                    {formatProjectNames(u.projects)}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-[12px]">{u.ultimo_acceso}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      u.status === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {u.role !== 'superadmin' && (
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <DotsThreeVertical size={18} weight="bold" />
                        </button>
                        {openMenuId === u.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-card rounded-xl border border-border shadow-lg py-1.5">
                              <button
                                onClick={() => handleOpenEdit(u)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-muted transition-colors"
                              >
                                <PencilSimple size={14} /> Editar rol
                              </button>
                              <button
                                onClick={() => handleToggleActive(u)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-muted transition-colors ${
                                  u.status === 'activo' ? 'text-red-500' : 'text-emerald-600'
                                }`}
                              >
                                {u.status === 'activo' ? (
                                  <><UserCircleMinus size={14} /> Desactivar</>
                                ) : (
                                  <><UserCirclePlus size={14} /> Reactivar</>
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {users.map((u) => (
            <div key={u.id} className={`p-4 space-y-2 ${u.status === 'inactivo' ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold ${u.color}`}>
                  {getInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold block">{u.name}</span>
                  <span className="text-[10px] text-muted-foreground">{u.subtitle}</span>
                </div>
                {u.role !== 'superadmin' && (
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <DotsThreeVertical size={18} weight="bold" />
                    </button>
                    {openMenuId === u.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-card rounded-xl border border-border shadow-lg py-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-muted transition-colors"
                          >
                            <PencilSimple size={14} /> Editar rol
                          </button>
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-muted transition-colors ${
                              u.status === 'activo' ? 'text-red-500' : 'text-emerald-600'
                            }`}
                          >
                            {u.status === 'activo' ? (
                              <><UserCircleMinus size={14} /> Desactivar</>
                            ) : (
                              <><UserCirclePlus size={14} /> Reactivar</>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground">{u.email}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ROLE_STYLES[u.role]}`}>
                  {u.role}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                  u.status === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {u.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Create User Dialog ===== */}
      {showCreateDialog && (
        <Portal>
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateDialog(false)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-lg mx-4 p-4 sm:p-8 overflow-y-auto max-h-[90vh] animate-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Invitar Usuario</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Se enviara un email de bienvenida al nuevo usuario</p>
              </div>
              <button onClick={() => setShowCreateDialog(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
                <X size={18} weight="bold" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">Nombre *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre completo" className={inputClass} required />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">Email *</label>
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="correo@empresa.com" className={inputClass} required />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">Rol *</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={selectClass} style={selectBg}>
                  <option value="admin">Admin</option>
                  <option value="gestor">Gestor</option>
                </select>
              </div>

              {newRole === 'gestor' && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">Proyectos asignados</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {PROJECTS.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={newProjects.includes(p.id)}
                          onChange={() => handleToggleProject(p.id, newProjects, setNewProjects)}
                          className="rounded border-border accent-primary w-4 h-4"
                        />
                        <span className="truncate">{p.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateDialog(false)} className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Crear usuario
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* ===== Edit Role Dialog ===== */}
      {editingUser && (
        <Portal>
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-lg mx-4 p-4 sm:p-8 overflow-y-auto max-h-[90vh] animate-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Editar rol</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Cambia el rol y proyectos de {editingUser.name}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
                <X size={18} weight="bold" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold ${editingUser.color}`}>
                  {getInitials(editingUser.name)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{editingUser.name}</p>
                  <p className="text-[11px] text-muted-foreground">{editingUser.email}</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">Rol</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className={selectClass} style={selectBg}>
                  <option value="admin">Admin</option>
                  <option value="gestor">Gestor</option>
                </select>
              </div>

              {editRole === 'gestor' && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">Proyectos asignados</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {PROJECTS.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={editProjects.includes(p.id)}
                          onChange={() => handleToggleProject(p.id, editProjects, setEditProjects)}
                          className="rounded border-border accent-primary w-4 h-4"
                        />
                        <span className="truncate">{p.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
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
