import { useState, useEffect, useCallback } from 'react';
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
  WarningCircle,
  PlugsConnected,
  Copy,
  CheckCircle,
  Eye,
  EyeSlash,
  Clock,
} from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import client from '@/shared/api/client';
import Portal from '@/shared/components/ui/portal';

const TABS = [
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'projects', label: 'Proyectos', icon: Folder },
  { id: 'webhooks', label: 'Webhooks', icon: PlugsConnected },
  { id: 'apis', label: 'APIs Externas', icon: Key },
  { id: 'email', label: 'Email (Brevo)', icon: Envelope },
  { id: 'security', label: 'Seguridad', icon: ShieldCheck },
];

const ROLE_STYLES = {
  superadmin: 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400',
  admin: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  gestor: 'bg-muted text-muted-foreground',
};

function getInitials(name) {
  if (!name) return '??';
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

function UsersTab() {
  const { projects } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Create user form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('gestor');
  const [newProjects, setNewProjects] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);

  // Edit form
  const [editRole, setEditRole] = useState('');
  const [editProjects, setEditProjects] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/users?limit=100');
      if (res.success) {
        setUsers(res.data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function resetCreateForm() {
    setNewName('');
    setNewEmail('');
    setNewRole('gestor');
    setNewProjects([]);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    if (newProjects.length === 0) {
      toast({ title: 'Error', description: 'Debes asignar al menos un proyecto', variant: 'destructive' });
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        nombre: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        projectIds: newProjects,
      };

      const res = await client.post('/users', payload);
      if (res.success) {
        toast({ title: 'Usuario creado', description: `Se ha enviado email de bienvenida a ${newEmail}` });
        setShowCreateDialog(false);
        resetCreateForm();
        fetchUsers();
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreateLoading(false);
    }
  }

  function handleToggleProject(projectId, list, setter) {
    setter(list.includes(projectId) ? list.filter((id) => id !== projectId) : [...list, projectId]);
  }

  function handleOpenEdit(user) {
    setEditingUser(user);
    setEditRole(user.role);
    setEditProjects(user.project_ids || user.projects || []);
    setOpenMenuId(null);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingUser) return;

    setEditLoading(true);
    try {
      const payload = { role: editRole };
      if (editProjects.length > 0) {
        payload.projectIds = editProjects;
      }

      await client.patch(`/users/${editingUser.id}`, payload);
      toast({ title: 'Usuario actualizado', description: `${editingUser.nombre || editingUser.name} actualizado` });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  }

  async function handleToggleActive(user) {
    try {
      const isActive = user.active !== false;
      if (isActive) {
        // Desactivar = DELETE
        await client.delete(`/users/${user.id}`);
        toast({ title: 'Usuario desactivado', description: `${user.nombre || user.name} desactivado`, variant: 'destructive' });
      } else {
        // Reactivar = PATCH /reactivate
        await client.patch(`/users/${user.id}/reactivate`);
        toast({ title: 'Usuario reactivado', description: `${user.nombre || user.name} reactivado` });
      }
      setOpenMenuId(null);
      fetchUsers();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  const formatProjectNames = (user) => {
    const ids = user.project_ids || user.projects || [];
    if (!ids || ids.length === 0) return 'Ninguno';
    if (ids.length === projects.length) return 'Todos';
    return ids
      .map((id) => projects.find((p) => p.id === id)?.nombre || '')
      .filter(Boolean)
      .join(', ');
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="w-40 h-5 bg-muted rounded animate-pulse mb-2" />
            <div className="w-60 h-4 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-card rounded-3xl border border-border p-6 space-y-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="flex-1 h-4 bg-muted rounded" />
              <div className="w-16 h-4 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <WarningCircle size={40} className="text-red-500 mx-auto mb-3" weight="duotone" />
        <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        <button onClick={fetchUsers} className="mt-3 text-xs font-semibold text-primary hover:underline">Reintentar</button>
      </div>
    );
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
      <div className="bg-card rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Usuario</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rol</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Proyectos</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ultima conexion</th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isActive = u.active !== false;
                const userName = u.nombre || u.name || 'Sin nombre';
                return (
                  <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${!isActive ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold ${AVATAR_COLORS[u.id % AVATAR_COLORS.length]}`}>
                          {getInitials(userName)}
                        </div>
                        <span className="font-semibold">{userName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ROLE_STYLES[u.role] || 'bg-muted text-muted-foreground'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground max-w-[180px] truncate" title={formatProjectNames(u)}>
                      {formatProjectNames(u)}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {u.last_login_at ? (
                        <span className="flex items-center gap-1.5 text-[12px]">
                          <Clock size={12} weight="duotone" />
                          {new Date(u.last_login_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-[12px] italic text-muted-foreground/60">Nunca</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        isActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400'
                      }`}>
                        {isActive ? 'activo' : 'inactivo'}
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
                                    isActive ? 'text-red-500' : 'text-emerald-600'
                                  }`}
                                >
                                  {isActive ? (
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
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Users size={40} className="text-muted-foreground/30 mx-auto mb-3" weight="duotone" />
                    <p className="text-muted-foreground text-sm">No hay usuarios registrados</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {users.map((u) => {
            const isActive = u.active !== false;
            const userName = u.nombre || u.name || 'Sin nombre';
            return (
              <div key={u.id} className={`p-4 space-y-2 ${!isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold ${AVATAR_COLORS[u.id % AVATAR_COLORS.length]}`}>
                    {getInitials(userName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold block">{userName}</span>
                    <span className="text-[11px] text-muted-foreground">{u.email}</span>
                  </div>
                  {u.role !== 'superadmin' && (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                      >
                        <DotsThreeVertical size={18} weight="bold" />
                      </button>
                      {openMenuId === u.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-card rounded-xl border border-border shadow-lg py-1.5">
                            <button onClick={() => handleOpenEdit(u)} className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-muted transition-colors">
                              <PencilSimple size={14} /> Editar rol
                            </button>
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-muted transition-colors ${isActive ? 'text-red-500' : 'text-emerald-600'}`}
                            >
                              {isActive ? <><UserCircleMinus size={14} /> Desactivar</> : <><UserCirclePlus size={14} /> Reactivar</>}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${ROLE_STYLES[u.role] || 'bg-muted text-muted-foreground'}`}>
                    {u.role}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                  }`}>
                    {isActive ? 'activo' : 'inactivo'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create User Dialog */}
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

                {projects.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">Proyectos asignados *</label>
                    <p className="text-[11px] text-muted-foreground mb-2 px-1">Selecciona al menos un proyecto al que tendra acceso</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {projects.map((p) => (
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
                  <button type="submit" disabled={createLoading} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
                    {createLoading ? 'Creando...' : 'Crear usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit Role Dialog */}
      {editingUser && (
        <Portal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
            <div className="relative bg-card rounded-3xl border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-lg mx-4 p-4 sm:p-8 overflow-y-auto max-h-[90vh] animate-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Editar rol</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">Cambia el rol y proyectos de {editingUser.nombre || editingUser.name}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
                  <X size={18} weight="bold" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold ${AVATAR_COLORS[editingUser.id % AVATAR_COLORS.length]}`}>
                    {getInitials(editingUser.nombre || editingUser.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{editingUser.nombre || editingUser.name}</p>
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

                {projects.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">Proyectos asignados</label>
                    <p className="text-[11px] text-muted-foreground mb-2 px-1">Selecciona los proyectos a los que tendra acceso</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {projects.map((p) => (
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
                  <button type="submit" disabled={editLoading} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
                    {editLoading ? 'Guardando...' : 'Guardar cambios'}
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
  const { projects } = useAuth();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">Proyectos</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Proyectos educativos y plataformas IA registradas</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <div key={p.id} className="bg-card p-5 rounded-2xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 font-extrabold text-xs">
              {(p.nombre || '').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{p.nombre}</p>
              <p className="text-[11px] text-muted-foreground">{p.slug || p.domain}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              activo
            </span>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No hay proyectos configurados</p>
        )}
      </div>
    </div>
  );
}

function WebhooksTab() {
  const { projects } = useAuth();
  const [revealed, setRevealed] = useState({});
  const [copied, setCopied] = useState(null);

  // El backend devuelve la URL base relativa a /crm — construir URL completa
  const baseUrl = window.location.origin + (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '') + '/api';

  function toggleReveal(projectId) {
    setRevealed((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  }

  async function handleCopy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast({ title: 'Copiado', description: 'Texto copiado al portapapeles' });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: 'Error', description: 'No se pudo copiar', variant: 'destructive' });
    }
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-12">
        <PlugsConnected size={40} className="text-muted-foreground/30 mx-auto mb-3" weight="duotone" />
        <p className="text-sm text-muted-foreground">No hay proyectos configurados</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">Webhooks de Leads</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          URL y API key para integrar formularios externos. Cada lead recibido genera un nuevo registro y se asigna automaticamente por round-robin.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3 items-start">
        <WarningCircle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" weight="duotone" />
        <div className="text-[13px] text-amber-800 dark:text-amber-200">
          <p className="font-bold">Mantener la API key en privado</p>
          <p className="mt-0.5">Solo administradores pueden ver esta clave. Si se filtra, contacta al superadmin para regenerarla.</p>
        </div>
      </div>

      <div className="space-y-4">
        {projects.map((project) => {
          const url = `${baseUrl}/leads/webhooks/${project.slug}`;
          const apiKey = project.webhook_api_key;
          const isRevealed = !!revealed[project.id];

          return (
            <div key={project.id} className="bg-card p-5 rounded-2xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PlugsConnected size={18} className="text-primary" weight="duotone" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{project.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">{project.slug}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">URL del webhook</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={url}
                      className="flex-1 h-10 px-3 rounded-xl border border-border bg-muted/50 text-xs font-mono outline-none"
                    />
                    <button
                      onClick={() => handleCopy(url, `url-${project.id}`)}
                      className="h-10 px-3 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      {copied === `url-${project.id}` ? <CheckCircle size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
                      Copiar
                    </button>
                  </div>
                </div>

                {apiKey ? (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">X-API-Key (header)</label>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        type={isRevealed ? 'text' : 'password'}
                        value={apiKey}
                        className="flex-1 h-10 px-3 rounded-xl border border-border bg-muted/50 text-xs font-mono outline-none"
                      />
                      <button
                        onClick={() => toggleReveal(project.id)}
                        className="h-10 px-3 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
                      >
                        {isRevealed ? <EyeSlash size={14} weight="bold" /> : <Eye size={14} weight="bold" />}
                        {isRevealed ? 'Ocultar' : 'Ver'}
                      </button>
                      <button
                        onClick={() => handleCopy(apiKey, `key-${project.id}`)}
                        className="h-10 px-3 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
                      >
                        {copied === `key-${project.id}` ? <CheckCircle size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
                        Copiar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sin API key configurada para este proyecto</p>
                )}

                <details className="mt-2 group">
                  <summary className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                    Ver ejemplo de payload
                  </summary>
                  <pre className="mt-2 p-3 rounded-xl bg-zinc-900 text-zinc-100 text-[11px] font-mono overflow-x-auto">
{`POST ${url}
Content-Type: application/json
X-API-Key: ${isRevealed && apiKey ? apiKey : '***'}

{
  "nombre": "Juan Perez",
  "email": "juan@example.com",
  "telefono": "+34611111111",
  "producto_interes": "Curso Psicologia",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "verano-2026",
  "landing_url": "https://example.com/landing"
}`}
                  </pre>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApisTab() {
  const MOCK_APIS = [
    { name: 'Meta Marketing API', version: 'v19', status: 'conectada', lastSync: 'Pendiente configuracion' },
    { name: 'Google Ads API', version: 'v16', status: 'pendiente', lastSync: 'Pendiente configuracion' },
    { name: 'Google Search Console', version: 'v1', status: 'pendiente', lastSync: 'Pendiente configuracion' },
    { name: 'Stripe', version: 'v2025-01', status: 'pendiente', lastSync: 'Pendiente configuracion' },
    { name: 'Claude AI', version: 'claude-4', status: 'pendiente', lastSync: 'Pendiente configuracion' },
    { name: 'Brevo (Transactional)', version: 'v3', status: 'conectada', lastSync: 'Configurado' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">APIs Externas</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Credenciales encriptadas con AES-256-GCM</p>
      </div>
      <div className="space-y-3">
        {MOCK_APIS.map((api) => (
          <div key={api.name} className="bg-card p-5 rounded-2xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Key size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{api.name} <span className="text-muted-foreground font-normal text-xs">({api.version})</span></p>
              <p className="text-[11px] text-muted-foreground">{api.lastSync}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
              api.status === 'conectada' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
            }`}>
              {api.status}
            </span>
            <button className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-muted transition-colors">
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
        <h2 className="text-base font-extrabold tracking-tight">Email -- Brevo</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Plantillas de email transaccional</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'Bienvenida Lead', trigger: 'Webhook nuevo lead', sent: '--', rate: '--' },
          { name: 'Recordatorio Contacto', trigger: 'Cron 48h sin contacto', sent: '--', rate: '--' },
          { name: 'Bienvenida Usuario', trigger: 'POST /api/users', sent: '--', rate: '--' },
          { name: 'Confirmacion Pago', trigger: 'Stripe webhook', sent: '--', rate: '--' },
        ].map((t) => (
          <div key={t.name} className="bg-card p-5 rounded-2xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center"><Envelope size={16} className="text-blue-600 dark:text-blue-400" /></div>
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
          <div key={s.label} className="bg-card p-4 rounded-2xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.ok ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                <ShieldCheck size={16} className={s.ok ? 'text-emerald-600' : 'text-red-500'} weight="duotone" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">{s.value}</p>
              </div>
            </div>
            <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">OK</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_CONTENT = {
  users: UsersTab,
  projects: ProjectsTab,
  webhooks: WebhooksTab,
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
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
