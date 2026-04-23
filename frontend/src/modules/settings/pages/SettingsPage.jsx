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
import PageHeader from '@/shared/components/ui/PageHeader';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';

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
        <div>
          <div className="w-40 h-5 bg-muted rounded animate-pulse mb-2" />
          <div className="w-60 h-4 bg-muted rounded animate-pulse" />
        </div>
        <SkeletonTable rows={5} columns={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
        <WarningCircle size={40} className="text-red-500 mx-auto mb-3" weight="duotone" />
        <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-1">No se pudieron cargar los usuarios</p>
        <p className="text-xs text-red-500/80 dark:text-red-400/80 mb-4">{error}</p>
        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2"
        >
          Reintentar
        </button>
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
          <Plus size={14} weight="bold" /> Crear Usuario
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
                  <h2 className="text-lg font-extrabold tracking-tight">Crear Usuario</h2>
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
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fieldsProject, setFieldsProject] = useState(null);

  const canCreate = user?.role === 'superadmin';

  async function load() {
    setLoading(true);
    try {
      const res = await client.get('/projects');
      if (res.success) setProjects(res.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold tracking-tight">Proyectos</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">Psiko, ISEIH, Fono Aprende + plataformas IA</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditing(null); setDialogOpen(true); }} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
            <Plus size={14} weight="bold" /> Nuevo proyecto
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonTable rows={3} cols={1} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="bg-card p-5 rounded-2xl border border-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 font-extrabold text-xs">
                {(p.nombre || '').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{p.nombre}</p>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${p.type === 'ia' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{p.type}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">/{p.slug}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Alerta inactividad: {p.dias_alerta_inactividad} dias</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {p.active ? 'activo' : 'inactivo'}
                </span>
                {canCreate && (
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => setFieldsProject(p)} className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80">Campos</button>
                    <button onClick={() => { setEditing(p); setDialogOpen(true); }} className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80">Editar</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No hay proyectos</p>
          )}
        </div>
      )}

      <ProjectDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        existing={editing}
        onSaved={load}
      />

      {fieldsProject && (
        <FieldDefsDialog
          project={fieldsProject}
          onClose={() => setFieldsProject(null)}
        />
      )}
    </div>
  );
}

function ProjectDialog({ open, onClose, existing, onSaved }) {
  const [form, setForm] = useState({
    nombre: '', slug: '', type: 'crm', dias_alerta_inactividad: 3,
    meta_account_id: '', google_account_id: '', gsc_property: '', emoji: '', active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (existing) {
        setForm({
          nombre: existing.nombre || '',
          slug: existing.slug || '',
          type: existing.type || 'crm',
          dias_alerta_inactividad: existing.dias_alerta_inactividad || 3,
          meta_account_id: existing.meta_account_id || '',
          google_account_id: existing.google_account_id || '',
          gsc_property: existing.gsc_property || '',
          emoji: existing.emoji || '',
          active: existing.active !== false,
        });
      } else {
        setForm({ nombre: '', slug: '', type: 'crm', dias_alerta_inactividad: 3, meta_account_id: '', google_account_id: '', gsc_property: '', emoji: '', active: true });
      }
    }
  }, [open, existing]);

  if (!open) return null;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre,
        type: form.type,
        dias_alerta_inactividad: Number(form.dias_alerta_inactividad),
        emoji: form.emoji || null,
        meta_account_id: form.meta_account_id || null,
        google_account_id: form.google_account_id || null,
        gsc_property: form.gsc_property || null,
      };
      if (existing) {
        payload.active = form.active;
        await client.patch(`/projects/${existing.id}`, payload);
        toast({ title: 'Proyecto actualizado' });
      } else {
        payload.slug = form.slug;
        await client.post('/projects', payload);
        toast({ title: 'Proyecto creado' });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  const inputClass = 'w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">{existing ? 'Editar' : 'Nuevo'} proyecto</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={18} /></button>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputClass} required />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Slug *</label>
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className={inputClass + ' font-mono'} disabled={!!existing} placeholder="psiko-aprende" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputClass}>
                  <option value="crm">CRM (leads)</option>
                  <option value="ia">IA (monitor pagos)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Alerta inactividad (dias)</label>
                <input type="number" min="1" max="365" value={form.dias_alerta_inactividad} onChange={e => setForm({ ...form, dias_alerta_inactividad: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Meta Account ID (opcional)</label>
              <input value={form.meta_account_id} onChange={e => setForm({ ...form, meta_account_id: e.target.value })} className={inputClass} placeholder="act_1234567890" />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Google Ads Account ID (opcional)</label>
              <input value={form.google_account_id} onChange={e => setForm({ ...form, google_account_id: e.target.value })} className={inputClass} placeholder="123-456-7890" />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">GSC Property URL (opcional)</label>
              <input value={form.gsc_property} onChange={e => setForm({ ...form, gsc_property: e.target.value })} className={inputClass} placeholder="sc-domain:psikoaprende.com" />
            </div>

            {existing && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                Activo
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Guardando...' : (existing ? 'Guardar' : 'Crear proyecto')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

function FieldDefsDialog({ project, onClose }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newField, setNewField] = useState({ field_key: '', label: '', type: 'text', required: false });

  async function load() {
    setLoading(true);
    try {
      const res = await client.get(`/field-definitions/project/${project.id}`);
      if (res.success) setFields(res.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [project.id]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newField.field_key || !newField.label) return;
    try {
      await client.post('/field-definitions', {
        project_id: project.id,
        field_key: newField.field_key,
        label: newField.label,
        type: newField.type,
        required: newField.required,
        orden: fields.length,
      });
      toast({ title: 'Campo agregado' });
      setNewField({ field_key: '', label: '', type: 'text', required: false });
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar este campo? Los datos existentes en leads se mantienen pero ya no se veran.')) return;
    try {
      await client.delete(`/field-definitions/${id}`);
      toast({ title: 'Campo eliminado' });
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    }
  }

  const inputClass = 'w-full h-9 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary';

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">Campos personalizados</h2>
              <p className="text-xs text-muted-foreground">{project.nombre} - hasta ~15 campos recomendados</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={18} /></button>
          </div>

          <div className="mb-4 p-4 bg-muted/30 rounded-xl">
            <p className="text-[11px] font-bold uppercase text-muted-foreground mb-2">Agregar campo nuevo</p>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2">
              <input value={newField.field_key} onChange={e => setNewField({ ...newField, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="clave (snake_case)" className={inputClass + ' font-mono text-xs'} required />
              <input value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })} placeholder="Etiqueta (ej: Titulacion actual)" className={inputClass} required />
              <select value={newField.type} onChange={e => setNewField({ ...newField, type: e.target.value })} className={inputClass}>
                <option value="text">Texto corto</option>
                <option value="textarea">Texto largo</option>
                <option value="number">Numero</option>
                <option value="date">Fecha</option>
                <option value="select">Seleccion</option>
                <option value="boolean">Si/No</option>
              </select>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={newField.required} onChange={e => setNewField({ ...newField, required: e.target.checked })} />
                  Requerido
                </label>
                <button type="submit" className="ml-auto px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90">Agregar</button>
              </div>
            </form>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Este proyecto aun no tiene campos custom. Los leads solo tendran los campos base.</p>
          ) : (
            <div className="space-y-2">
              {fields.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{f.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{f.field_key}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-muted">{f.type}</span>
                      {f.required && <span className="text-[9px] font-bold text-red-500">REQ</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(f.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Portal>
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

const SERVICES_CATALOG = [
  { service: 'brevo', name: 'Brevo (Email transaccional)', description: 'API Key para envio de emails', placeholder: 'xkeysib-...', global: true },
  { service: 'meta', name: 'Meta Marketing API', description: 'Token larga duracion + account_id', placeholder: 'EAAD...', global: false },
  { service: 'google_ads', name: 'Google Ads API', description: 'Developer Token + OAuth2', placeholder: 'developer-token', global: false },
  { service: 'gsc', name: 'Google Search Console', description: 'OAuth2 + property URL', placeholder: 'refresh_token', global: false },
  { service: 'stripe', name: 'Stripe (Restricted Key)', description: 'Solo lectura - suscripciones', placeholder: 'rk_live_...', global: false },
  { service: 'claude', name: 'Claude AI (Anthropic)', description: 'Para reportes y chat IA', placeholder: 'sk-ant-...', global: true },
];

function ApisTab() {
  const { projects } = useAuth();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogService, setDialogService] = useState(null);
  const [dialogProjectId, setDialogProjectId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await client.get('/credentials');
      if (res.success) setCredentials(res.data);
    } catch (err) {
      if (err.status !== 403) toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function getCredFor(service, projectId) {
    return credentials.find(c => c.service === service && c.project_id === projectId);
  }

  async function handleTest(id) {
    try {
      const res = await client.post(`/credentials/${id}/test`);
      toast({ title: 'Test', description: res.data?.message || 'OK' });
      await load();
    } catch (err) {
      toast({ title: 'Test fallo', description: err?.data?.error || err.message, variant: 'destructive' });
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar esta credencial?')) return;
    try {
      await client.delete(`/credentials/${id}`);
      toast({ title: 'Credencial eliminada' });
      await load();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-extrabold tracking-tight">APIs Externas</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Credenciales encriptadas con AES-256-GCM. Solo superadmin.</p>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={1} />
      ) : (
        <div className="space-y-3">
          {SERVICES_CATALOG.map((svc) => {
            if (svc.global) {
              const cred = getCredFor(svc.service, null);
              return (
                <CredentialCard
                  key={svc.service}
                  service={svc}
                  projectId={null}
                  projectName="Global (todos los proyectos)"
                  credential={cred}
                  onConfigure={() => { setDialogService(svc); setDialogProjectId(null); }}
                  onTest={() => cred && handleTest(cred.id)}
                  onDelete={() => cred && handleDelete(cred.id)}
                />
              );
            }
            // Por proyecto
            return (
              <div key={svc.service} className="bg-card p-5 rounded-2xl border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Key size={18} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{svc.name}</p>
                    <p className="text-[11px] text-muted-foreground">{svc.description} - por proyecto</p>
                  </div>
                </div>
                <div className="space-y-2 ml-13">
                  {projects.map((proj) => {
                    const cred = getCredFor(svc.service, proj.id);
                    return (
                      <div key={proj.id} className="flex items-center gap-3 text-[13px] p-2 rounded-lg bg-muted/30">
                        <span className="flex-1 font-medium">{proj.nombre}</span>
                        {cred ? (
                          <>
                            <span className="font-mono text-[10px] text-muted-foreground">{cred.masked_value}</span>
                            <button onClick={() => handleTest(cred.id)} className="px-2 py-1 rounded bg-blue-50 text-blue-600 text-[10px] font-bold dark:bg-blue-950/30 dark:text-blue-400">Test</button>
                            <button onClick={() => { setDialogService(svc); setDialogProjectId(proj.id); }} className="px-2 py-1 rounded border border-border text-[10px] font-bold">Editar</button>
                            <button onClick={() => handleDelete(cred.id)} className="p-1 rounded hover:bg-red-50 text-red-500"><X size={12} /></button>
                          </>
                        ) : (
                          <button onClick={() => { setDialogService(svc); setDialogProjectId(proj.id); }} className="px-3 py-1 rounded-lg bg-primary text-white text-[11px] font-bold">Configurar</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CredentialDialog
        open={!!dialogService}
        onClose={() => { setDialogService(null); setDialogProjectId(null); }}
        service={dialogService}
        projectId={dialogProjectId}
        existing={dialogService ? getCredFor(dialogService.service, dialogProjectId) : null}
        onSaved={load}
      />
    </div>
  );
}

function CredentialCard({ service, projectId, projectName, credential, onConfigure, onTest, onDelete }) {
  return (
    <div className="bg-card p-5 rounded-2xl border border-border flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
        <Key size={18} className="text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm">{service.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {service.description} - {projectName}
          {credential && <> - <span className="font-mono">{credential.masked_value}</span></>}
        </p>
      </div>
      {credential ? (
        <>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
            credential.last_test_result === 'ok'
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
          }`}>
            {credential.last_test_result || 'sin probar'}
          </span>
          <button onClick={onTest} className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-xs font-semibold">Test</button>
          <button onClick={onConfigure} className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-muted">Editar</button>
          <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><X size={14} /></button>
        </>
      ) : (
        <>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">sin configurar</span>
          <button onClick={onConfigure} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90">Configurar</button>
        </>
      )}
    </div>
  );
}

function CredentialDialog({ open, onClose, service, projectId, existing, onSaved }) {
  const [value, setValue] = useState('');
  const [metadata, setMetadata] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setMetadata(existing?.metadata ? JSON.stringify(existing.metadata, null, 2) : '');
    }
  }, [open, existing]);

  if (!open || !service) return null;

  async function handleSave(e) {
    e.preventDefault();
    if (!value) return;
    setSaving(true);
    try {
      let parsedMeta = null;
      if (metadata.trim()) {
        try { parsedMeta = JSON.parse(metadata); }
        catch { toast({ title: 'Metadata JSON invalido', variant: 'destructive' }); setSaving(false); return; }
      }
      await client.post('/credentials', {
        project_id: projectId,
        service: service.service,
        value,
        metadata: parsedMeta,
      });
      toast({ title: 'Credencial guardada', description: `${service.name} configurado` });
      onSaved?.();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full h-10 px-3 rounded-lg border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">{existing ? 'Editar' : 'Configurar'} {service.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X size={18} /></button>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">API Key / Token *</label>
              <input type="password" value={value} onChange={e => setValue(e.target.value)} placeholder={service.placeholder} className={inputClass + ' font-mono'} required autoFocus />
              <p className="text-[10px] text-muted-foreground mt-1">Se cifra con AES-256-GCM antes de guardar</p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground mb-1 block">Metadata (JSON opcional)</label>
              <textarea value={metadata} onChange={e => setMetadata(e.target.value)} placeholder='{"account_id": "12345", "refresh_token": "..."}' rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-muted/50 text-xs outline-none font-mono resize-none focus:border-primary" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
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
      <PageHeader title="Configuracion" subtitle="Ajustes del sistema y gestion de usuarios" />

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
