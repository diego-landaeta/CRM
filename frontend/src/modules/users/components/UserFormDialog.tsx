import { useState } from 'react';
import { X, Key, Info, Lock } from '@phosphor-icons/react';
import type { Project, UserRole } from '@/shared/types';
import Portal from '@/shared/components/ui/portal';
import Select from '@/shared/components/ui/Select';
import { avatarColorFor, getInitials, inputClass } from '@/shared/lib/ui';
import { toast } from '@/shared/hooks/useToast';
import type { CrmUser, ProjectAssignment } from '../api/users.api';
import { ASSIGNABLE_ROLES } from '../lib/usersUi';
import ProjectSelector from './ProjectSelector';

export interface UserFormValues {
  nombre: string;
  email: string;
  role: UserRole;
  projects: ProjectAssignment[];
  whatsapp_phone: string;
  factura_manager: boolean;
  editar_fechas_factura: boolean;
}

interface Props {
  /** null = alta. Con usuario = edicion. */
  user: CrmUser | null;
  projects: Project[];
  /** El cambio de contraseña solo lo puede hacer un superadmin. */
  canResetPassword: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => void | Promise<void>;
  onResetPassword: (password: string) => Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UserFormDialog({
  user, projects, canResetPassword, loading, onClose, onSubmit, onResetPassword,
}: Props) {
  const esEdicion = !!user;

  const [nombre, setNombre] = useState(user?.nombre ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<UserRole>((user?.role as UserRole) ?? 'gestor');
  const [seleccionados, setSeleccionados] = useState<ProjectAssignment[]>(user?.projects ?? []);
  const [telefono, setTelefono] = useState(user?.whatsapp_phone ?? '');
  const [facturaManager, setFacturaManager] = useState(!!user?.factura_manager);
  const [editarFechas, setEditarFechas] = useState(!!user?.editar_fechas_factura);

  const [nuevaPass, setNuevaPass] = useState('');
  const [guardandoPass, setGuardandoPass] = useState(false);

  function alternarProyecto(projectId: number) {
    setSeleccionados((prev) => prev.some((p) => p.projectId === projectId)
      ? prev.filter((p) => p.projectId !== projectId)
      // El gestor siempre recibe; para el resto el reparto es opt-in.
      : [...prev, { projectId, recibeLeads: role === 'gestor' }]);
  }

  function alternarRecibeLeads(projectId: number) {
    setSeleccionados((prev) => prev.map((p) => p.projectId === projectId
      ? { ...p, recibeLeads: !p.recibeLeads }
      : p));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    // El backend pide 2 caracteres minimo; validarlo aqui evita el viaje.
    if (nombre.trim().length < 2) {
      toast({ title: 'Nombre demasiado corto', description: 'Mínimo 2 caracteres.', variant: 'destructive' });
      return;
    }
    if (!esEdicion) {
      if (!EMAIL_RE.test(email.trim())) {
        toast({ title: 'Email inválido', description: 'Revisa el formato del email.', variant: 'destructive' });
        return;
      }
      if (seleccionados.length === 0) {
        toast({ title: 'Falta el proyecto', description: 'Asigna al menos un proyecto.', variant: 'destructive' });
        return;
      }
    }
    onSubmit({
      nombre: nombre.trim(),
      email: email.trim(),
      role,
      projects: seleccionados,
      whatsapp_phone: telefono.trim(),
      factura_manager: facturaManager,
      // Poder cambiar fechas sin poder facturar no sirve de nada: la pantalla de
      // fechas se abre desde la factura. Si se quita lo primero, cae lo segundo.
      editar_fechas_factura: facturaManager && editarFechas,
    });
  }

  async function cambiarPassword() {
    if (nuevaPass.length < 8) {
      toast({ title: 'Contraseña muy corta', description: 'Mínimo 8 caracteres.', variant: 'destructive' });
      return;
    }
    setGuardandoPass(true);
    try {
      await onResetPassword(nuevaPass);
      setNuevaPass('');
    } finally {
      setGuardandoPass(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[70] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          className="relative bg-card rounded-lg border border-border shadow-dialog w-full max-w-lg mx-4 p-4 sm:p-8 overflow-y-auto max-h-[90vh] animate-in"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">{esEdicion ? 'Editar usuario' : 'Crear usuario'}</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                {esEdicion
                  ? 'Nombre, rol, proyectos y acceso.'
                  : 'Se le enviará un email con un enlace para poner su contraseña.'}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          <form onSubmit={enviar} className="space-y-4">
            {esEdicion && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColorFor(user!.id)}`}>
                  {getInitials(user!.nombre)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{user!.nombre}</p>
                  <p className="text-secundario text-muted-foreground truncate">{user!.email}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="user-nombre" className="text-xs text-muted-foreground mb-1.5 block px-1">Nombre *</label>
              <input
                id="user-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo"
                maxLength={200}
                className={inputClass}
                required
              />
            </div>

            {!esEdicion ? (
              <div>
                <label htmlFor="user-email" className="text-xs text-muted-foreground mb-1.5 block px-1">Email *</label>
                <input
                  id="user-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="correo@empresa.com"
                  className={inputClass}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block px-1">Email</label>
                <input value={user!.email} readOnly disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
                <p className="text-secundario text-muted-foreground mt-1 px-1 flex items-start gap-1">
                  <Info size={11} className="mt-px flex-shrink-0" />
                  El email es la identidad de la cuenta y hoy no se puede cambiar desde aquí.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block px-1">Rol *</label>
              <Select<UserRole>
                value={role}
                onChange={setRole}
                options={ASSIGNABLE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                ariaLabel="Rol"
              />
              <p className="text-secundario text-muted-foreground mt-1 px-1">
                {ASSIGNABLE_ROLES.find((r) => r.value === role)?.hint}
              </p>
            </div>

            {projects.length > 0 && (
              <ProjectSelector
                projects={projects}
                selected={seleccionados}
                role={role}
                onToggle={alternarProyecto}
                onToggleRecibeLeads={alternarRecibeLeads}
                required={!esEdicion}
              />
            )}

            {/* Facturacion. No se deriva del rol: ser «gestor» no decide quien
                factura. Vanessa lo es y no debe. Un admin puede siempre, por su
                rol, asi que para el las casillas no cambian nada y no se pintan. */}
            {(role === 'gestor' || role === 'soporte') && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs text-muted-foreground px-1">Facturación</p>
                <label className="flex items-start gap-2 cursor-pointer px-1">
                  <input
                    type="checkbox"
                    checked={facturaManager}
                    onChange={(e) => setFacturaManager(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    Puede emitir y corregir facturas
                    <span className="block text-secundario text-muted-foreground">
                      Solo las de sus propios prospectos.
                    </span>
                  </span>
                </label>
                <label className={`flex items-start gap-2 px-1 ${facturaManager ? 'cursor-pointer' : 'opacity-50'}`}>
                  <input
                    type="checkbox"
                    checked={facturaManager && editarFechas}
                    disabled={!facturaManager}
                    onChange={(e) => setEditarFechas(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    Puede cambiar las fechas de emisión y de pago
                    <span className="block text-secundario text-muted-foreground">
                      Sin tocar importes ni conceptos.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {esEdicion && (
              <div>
                <label htmlFor="user-tel" className="text-xs text-muted-foreground mb-1.5 block px-1">Teléfono (WhatsApp)</label>
                <input
                  id="user-tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+34 600 000 000"
                  maxLength={30}
                  className={inputClass}
                />
                <p className="text-secundario text-muted-foreground mt-1 px-1">
                  Se usa para el widget de WhatsApp y el contacto del gestor.
                </p>
              </div>
            )}

            {esEdicion && !canResetPassword && (
              <div className="border-t border-border pt-3 mt-1">
                <p className="text-secundario text-muted-foreground px-1 flex items-start gap-1.5">
                  <Lock size={12} className="mt-px flex-shrink-0" />
                  Reiniciar la contraseña de otra persona solo lo puede hacer un superadministrador.
                  El servidor lo rechaza aunque el campo estuviera aquí.
                </p>
              </div>
            )}

            {esEdicion && canResetPassword && (
              <div className="border-t border-border pt-3 mt-1">
                <label htmlFor="user-pass" className="text-xs font-semibold flex items-center gap-1.5 mb-1.5 px-1">
                  <Key size={12} weight="bold" /> Reiniciar contraseña
                </label>
                <div className="flex gap-2">
                  <input
                    id="user-pass"
                    type="text"
                    value={nuevaPass}
                    onChange={(e) => setNuevaPass(e.target.value)}
                    placeholder="Nueva contraseña (mín. 8)"
                    maxLength={200}
                    className={`${inputClass} font-mono`}
                  />
                  <button
                    type="button"
                    onClick={cambiarPassword}
                    disabled={guardandoPass || nuevaPass.length === 0}
                    className="h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 whitespace-nowrap"
                  >
                    {guardandoPass ? '…' : 'Cambiar'}
                  </button>
                </div>
                <p className="text-secundario text-muted-foreground mt-1 px-1">
                  Se la comunicas tú al usuario. Al cambiarla se cierran sus sesiones activas.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-md border border-border bg-card text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-9 px-4 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}
