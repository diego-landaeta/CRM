import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, X, PencilSimple, DotsThreeVertical, UserCircleMinus, UserCirclePlus,
  WarningCircle, Clock,
} from '@phosphor-icons/react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import Portal from '@/shared/components/ui/portal';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import Select from '@/shared/components/ui/Select';
import { toast } from '@/shared/hooks/useToast';
import {
  ROLE_STYLES, AVATAR_COLORS, getInitials, inputClass,
} from './shared';

export default function UsersTab() {
  const { projects } = useAuth();
  const { activeProject } = useProjectContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [projectFilter, setProjectFilter] = useState('active');

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('gestor');
  const [newProjects, setNewProjects] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<{ email: string; url: string } | null>(null);

  const [editRole, setEditRole] = useState('');
  const [editProjects, setEditProjects] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // En modo "Todos los proyectos" activeProject.id es -1 (sentinel) — no
      // lo mandamos al backend (que valida >0). Tratamos como "todos".
      let projectIdParam = '';
      if (projectFilter === 'active' && activeProject?.id && activeProject.id > 0) {
        projectIdParam = `&projectId=${activeProject.id}`;
      } else if (projectFilter !== 'active' && projectFilter !== 'all') {
        projectIdParam = `&projectId=${projectFilter}`;
      }
      const res = await client.get(`/users?limit=100${projectIdParam}`);
      if (res.success) setUsers(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectFilter, activeProject?.id]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function resetCreateForm() {
    setNewName(''); setNewEmail(''); setNewRole('gestor'); setNewProjects([]);
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!newName.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' });
      return;
    }
    if (!newEmail.trim()) {
      toast({ title: 'Email requerido', variant: 'destructive' });
      return;
    }
    // Validación básica de email (HTML5 type="email" no garantiza forma)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      toast({ title: 'Email inválido', description: 'Revisa el formato del email.', variant: 'destructive' });
      return;
    }
    if (newProjects.length === 0) {
      toast({ title: 'Error', description: 'Debes asignar al menos un proyecto', variant: 'destructive' });
      return;
    }
    setCreateLoading(true);
    try {
      const res = await client.post('/users', {
        nombre: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        projectIds: newProjects,
      });
      if (res.success) {
        const token = (res.data as { setPasswordToken?: string })?.setPasswordToken;
        if (token) {
          const base = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');
          const url = `${window.location.origin}${base}/set-password?token=${token}`;
          setInviteLink({ email: newEmail.trim(), url });
          toast({ title: 'Usuario creado', description: 'Comparte el link de invitación que aparece abajo.' });
        } else {
          toast({ title: 'Usuario creado', description: `Se ha enviado email de bienvenida a ${newEmail}` });
        }
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

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditLoading(true);
    try {
      const payload: { role: string; projectIds?: number[] } = { role: editRole };
      if (editProjects.length > 0) payload.projectIds = editProjects;
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
        await client.delete(`/users/${user.id}`);
        toast({ title: 'Usuario desactivado', description: `${user.nombre || user.name} desactivado`, variant: 'destructive' });
      } else {
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
    return ids.map((id) => projects.find((p) => p.id === id)?.nombre || '').filter(Boolean).join(', ');
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
      <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
        <WarningCircle size={40} className="text-red-500 mx-auto mb-3" weight="regular" />
        <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-1">No se pudieron cargar los usuarios</p>
        <p className="text-xs text-red-500/80 dark:text-red-400/80 mb-4">{error}</p>
        <button onClick={fetchUsers} className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Gestión de Usuarios</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">Administra los usuarios del CRM y sus roles</p>
        </div>
        <button onClick={() => { resetCreateForm(); setShowCreateDialog(true); }} aria-label="Crear usuario" className="flex items-center gap-2 h-9 px-3 sm:px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus size={14} weight="bold" /> <span className="hidden sm:inline">Crear Usuario</span>
        </button>
      </div>

      {inviteLink && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs">
              <p className="font-semibold text-amber-900 dark:text-amber-200">Invitación pendiente para {inviteLink.email}</p>
              <p className="text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Si el envío por email no está activo, copia este link y pásaselo. Caduca en 24h. Al abrirlo el usuario define su propia contraseña.
              </p>
            </div>
            <button onClick={() => setInviteLink(null)} aria-label="Cerrar" className="text-amber-900/60 hover:text-amber-900 dark:text-amber-300/60">
              <X size={14} weight="bold" />
            </button>
          </div>
          <div className="flex gap-2">
            <input readOnly value={inviteLink.url} onFocus={(e) => e.currentTarget.select()} className="flex-1 h-8 px-2 rounded-md border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-black/30 text-[11px] font-mono" />
            <button
              onClick={async () => {
                try {
                  if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(inviteLink.url);
                  else {
                    const ta = document.createElement('textarea');
                    ta.value = inviteLink.url; document.body.appendChild(ta); ta.select();
                    document.execCommand('copy'); document.body.removeChild(ta);
                  }
                  toast({ title: 'Link copiado' });
                } catch { toast({ title: 'No se pudo copiar', variant: 'destructive' }); }
              }}
              className="h-8 px-3 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
            >
              Copiar
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 p-3 rounded-md border border-border bg-card">
        <span className="text-[11px] font-medium text-muted-foreground">Mostrar:</span>
        <button onClick={() => setProjectFilter('active')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${projectFilter === 'active' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
          {activeProject?.nombre || 'Proyecto activo'}
        </button>
        <button onClick={() => setProjectFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${projectFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
          Todos los proyectos
        </button>
        <Select<string>
          value={projectFilter !== 'active' && projectFilter !== 'all' ? projectFilter : ''}
          onChange={(v) => { if (v) setProjectFilter(v); }}
          options={[
            { value: '', label: 'Proyecto especifico...' },
            ...(projects || []).map((p) => ({ value: String(p.id), label: p.nombre })),
          ]}
          ariaLabel="Filtrar por proyecto especifico"
          size="sm"
          className="ml-auto max-w-[180px] w-full"
        />
        <span className="text-[11px] text-muted-foreground">{users.length} usuario{users.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="hidden xl:block">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground">Usuario</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground hidden 2xl:table-cell">Email</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground">Rol</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground">Proyectos</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground hidden 2xl:table-cell">Última conexión</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground">Estado</th>
                <th className="px-4 py-2.5 text-right text-xs text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isActive = u.active !== false;
                const userName = u.nombre || u.name || 'Sin nombre';
                return (
                  <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${!isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${AVATAR_COLORS[u.id % AVATAR_COLORS.length]}`}>
                          {getInitials(userName)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block truncate">{userName}</span>
                          <span className="text-[11px] text-muted-foreground 2xl:hidden truncate block">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden 2xl:table-cell truncate max-w-[200px]">{u.email}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_STYLES[u.role] || 'bg-muted text-muted-foreground'}`}>{u.role}</span></td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={formatProjectNames(u)}>{formatProjectNames(u)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden 2xl:table-cell">
                      {u.last_login_at ? (
                        <span className="flex items-center gap-1.5 text-[12px]">
                          <Clock size={12} weight="regular" />
                          {new Date(u.last_login_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : <span className="text-[12px] italic text-muted-foreground/60">Nunca</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${isActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400'}`}>
                        {isActive ? 'activo' : 'inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {u.role !== 'superadmin' && (
                        <UserActionsMenu
                          isActive={isActive}
                          isOpen={openMenuId === u.id}
                          onToggle={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                          onClose={() => setOpenMenuId(null)}
                          onEdit={() => handleOpenEdit(u)}
                          onToggleActive={() => handleToggleActive(u)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center">
                  <Users size={40} className="text-muted-foreground/30 mx-auto mb-3" weight="regular" />
                  <p className="text-muted-foreground text-sm">No hay usuarios registrados</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="xl:hidden divide-y">
          {users.map((u) => {
            const isActive = u.active !== false;
            const userName = u.nombre || u.name || 'Sin nombre';
            return (
              <div key={u.id} className={`p-4 space-y-2 ${!isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold ${AVATAR_COLORS[u.id % AVATAR_COLORS.length]}`}>
                    {getInitials(userName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold block">{userName}</span>
                    <span className="text-[11px] text-muted-foreground">{u.email}</span>
                  </div>
                  {u.role !== 'superadmin' && (
                    <UserActionsMenu
                      isActive={isActive}
                      isOpen={openMenuId === u.id}
                      onToggle={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                      onClose={() => setOpenMenuId(null)}
                      onEdit={() => handleOpenEdit(u)}
                      onToggleActive={() => handleToggleActive(u)}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_STYLES[u.role] || 'bg-muted text-muted-foreground'}`}>{u.role}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${isActive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400'}`}>
                    {isActive ? 'activo' : 'inactivo'}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={formatProjectNames(u)}>{formatProjectNames(u)}</span>
                  {u.last_login_at ? (
                    <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1 ml-auto">
                      <Clock size={10} weight="regular" />
                      {new Date(u.last_login_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                  ) : <span className="text-[10px] text-muted-foreground/60 italic ml-auto">Nunca</span>}
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <div className="p-12 text-center">
              <Users size={40} className="text-muted-foreground/30 mx-auto mb-3" weight="regular" />
              <p className="text-muted-foreground text-sm">No hay usuarios registrados</p>
            </div>
          )}
        </div>
      </div>

      {showCreateDialog && (
        <UserDialog
          title="Crear Usuario"
          subtitle="Se enviara un email de bienvenida al nuevo usuario"
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handleCreateUser}
          submitLabel="Crear usuario"
          loading={createLoading}
        >
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block px-1">Nombre *</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre completo" className={inputClass} required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block px-1">Email *</label>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="correo@empresa.com" className={inputClass} required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block px-1">Rol *</label>
            <Select<string>
              value={newRole}
              onChange={setNewRole}
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'gestor', label: 'Gestor' },
                { value: 'soporte', label: 'Desarrollador / Soporte' },
              ]}
              ariaLabel="Rol"
            />
          </div>
          {projects.length > 0 && (
            <ProjectSelector
              projects={projects}
              selected={newProjects}
              onToggle={(id) => handleToggleProject(id, newProjects, setNewProjects)}
              required
            />
          )}
        </UserDialog>
      )}

      {editingUser && (
        <UserDialog
          title="Editar rol"
          subtitle={`Cambia el rol y proyectos de ${editingUser.nombre || editingUser.name}`}
          onClose={() => setEditingUser(null)}
          onSubmit={handleSaveEdit}
          submitLabel="Guardar cambios"
          loading={editLoading}
        >
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ${AVATAR_COLORS[editingUser.id % AVATAR_COLORS.length]}`}>
              {getInitials(editingUser.nombre || editingUser.name)}
            </div>
            <div>
              <p className="font-semibold text-sm">{editingUser.nombre || editingUser.name}</p>
              <p className="text-[11px] text-muted-foreground">{editingUser.email}</p>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block px-1">Rol</label>
            <Select<string>
              value={editRole}
              onChange={setEditRole}
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'gestor', label: 'Gestor' },
                { value: 'soporte', label: 'Desarrollador / Soporte' },
              ]}
              ariaLabel="Rol"
            />
          </div>
          {projects.length > 0 && (
            <ProjectSelector
              projects={projects}
              selected={editProjects}
              onToggle={(id) => handleToggleProject(id, editProjects, setEditProjects)}
              required={false}
            />
          )}
        </UserDialog>
      )}
    </div>
  );
}

function UserActionsMenu({ isActive, isOpen, onToggle, onClose, onEdit, onToggleActive }) {
  return (
    <div className="relative inline-block">
      <button onClick={onToggle} aria-label="Acciones de usuario" aria-haspopup="menu" aria-expanded={isOpen} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
        <DotsThreeVertical size={18} weight="bold" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 !m-0 z-40" onClick={onClose} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-card rounded-md border border-border py-1.5">
            <button onClick={onEdit} className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-muted transition-colors">
              <PencilSimple size={14} /> Editar rol
            </button>
            <button onClick={onToggleActive} className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-muted transition-colors ${isActive ? 'text-red-500' : 'text-emerald-600'}`}>
              {isActive ? <><UserCircleMinus size={14} /> Desactivar</> : <><UserCirclePlus size={14} /> Reactivar</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ProjectSelector({ projects, selected, onToggle, required }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block px-1">
        Proyectos asignados{required && ' *'}
      </label>
      <p className="text-[11px] text-muted-foreground mb-2 px-1">
        {required ? 'Selecciona al menos un proyecto al que tendrá acceso' : 'Selecciona los proyectos a los que tendrá acceso'}
      </p>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {projects.map((p) => (
          <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer text-sm">
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} className="rounded border-border accent-primary w-4 h-4" />
            <span className="truncate">{p.nombre}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function UserDialog({ title, subtitle, children, onClose, onSubmit, submitLabel, loading }) {
  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-lg border border-border shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1)] w-full max-w-lg mx-4 p-4 sm:p-8 overflow-y-auto max-h-[90vh] animate-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted">
              <X size={18} weight="bold" />
            </button>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            {children}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="h-9 px-4 rounded-md border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors">Cancelar</button>
              <button type="submit" disabled={loading} className="h-9 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                {loading ? 'Guardando...' : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
