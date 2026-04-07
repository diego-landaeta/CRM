import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/shared/hooks/useToast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  Sun,
  Moon,
  ShieldCheck,
  Folder,
} from '@phosphor-icons/react';
// Proyectos ahora vienen del AuthContext via ProjectContext

const profileSchema = z.object({
  nombre: z.string().min(2, 'Minimo 2 caracteres'),
  email: z.string().email('Email no valido'),
});

const passwordSchema = z.object({
  current: z.string().min(1, 'Requerido'),
  nueva: z.string().min(8, 'Minimo 8 caracteres'),
  confirmar: z.string().min(1, 'Requerido'),
}).refine((d) => d.nueva === d.confirmar, { message: 'Las contrasenas no coinciden', path: ['confirmar'] });

const inputClass = 'w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground';

function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 px-1">{error}</p>}
    </div>
  );
}

const ROLE_LABELS = { superadmin: 'Superadmin', admin: 'Admin', gestor: 'Gestor' };

export default function ProfilePage() {
  const { user } = useAuth();
  const { projects: allProjects } = useProjectContext();
  const { theme, toggleTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  const userProjects = allProjects || [];

  const initials = user?.nombre?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '??';

  // Profile form
  const {
    register: regProfile,
    handleSubmit: handleProfile,
    formState: { errors: errProfile, isSubmitting: subProfile },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { nombre: user?.nombre || '', email: user?.email || '' },
  });

  // Password form
  const {
    register: regPass,
    handleSubmit: handlePass,
    reset: resetPass,
    formState: { errors: errPass, isSubmitting: subPass },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: '', nueva: '', confirmar: '' },
  });

  async function onSaveProfile(data) {
    await new Promise((r) => setTimeout(r, 500));
    toast({ title: 'Perfil actualizado', description: 'Los cambios se han guardado' });
  }

  async function onChangePassword(data) {
    await new Promise((r) => setTimeout(r, 500));
    resetPass();
    toast({ title: 'Contrasena actualizada', description: 'Tu contrasena se ha cambiado correctamente' });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground text-sm">Gestiona tu informacion personal y seguridad</p>
      </div>

      {/* Avatar + Info */}
      <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-xl font-extrabold">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-bold">{user?.nombre}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary flex items-center gap-1">
                <ShieldCheck size={12} weight="duotone" /> {ROLE_LABELS[user?.role] || user?.role}
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Folder size={12} /> {userProjects.length} proyecto{userProjects.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Projects list */}
        {userProjects.length > 0 && (
          <div className="mt-5 pt-4 border-t">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Proyectos asignados</p>
            <div className="flex flex-wrap gap-2">
              {userProjects.map((p) => (
                <span key={p.id} className="px-3 py-1.5 rounded-xl bg-muted text-[12px] font-medium">
                  {p.emoji} {p.nombre}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit profile */}
      <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
        <div className="flex items-center gap-2 mb-5">
          <User size={18} weight="duotone" className="text-primary" />
          <h3 className="font-bold">Informacion Personal</h3>
        </div>
        <form onSubmit={handleProfile(onSaveProfile)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre *" error={errProfile.nombre?.message}>
              <input {...regProfile('nombre')} className={inputClass} />
            </Field>
            <Field label="Email *" error={errProfile.email?.message}>
              <input {...regProfile('email')} type="email" className={inputClass} />
            </Field>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={subProfile} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
              {subProfile ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={18} weight="duotone" className="text-primary" />
          <h3 className="font-bold">Cambiar Contrasena</h3>
        </div>
        <form onSubmit={handlePass(onChangePassword)} className="space-y-4">
          <Field label="Contrasena actual *" error={errPass.current?.message}>
            <input {...regPass('current')} type="password" placeholder="Tu contrasena actual" className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nueva contrasena *" error={errPass.nueva?.message}>
              <div className="relative">
                <input {...regPass('nueva')} type={showPassword ? 'text' : 'password'} placeholder="Minimo 8 caracteres" className={inputClass + ' pr-11'} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <Field label="Confirmar *" error={errPass.confirmar?.message}>
              <input {...regPass('confirmar')} type="password" placeholder="Repite la contrasena" className={inputClass} />
            </Field>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={subPass} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50">
              {subPass ? 'Cambiando...' : 'Cambiar contrasena'}
            </button>
          </div>
        </form>
      </div>

      {/* Preferences */}
      <div className="bg-card p-6 rounded-3xl border border-border shadow-[0_1px_2px_0_rgb(0_0_0/0.05)]">
        <h3 className="font-bold mb-4">Preferencias</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon size={18} weight="duotone" className="text-primary" /> : <Sun size={18} weight="duotone" className="text-primary" />}
            <div>
              <p className="text-sm font-medium">Tema de la interfaz</p>
              <p className="text-[12px] text-muted-foreground">{theme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado'}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            {theme === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
          </button>
        </div>
      </div>
    </div>
  );
}
