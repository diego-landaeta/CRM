import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Package, Eye, EyeSlash, ShieldCheck } from '@phosphor-icons/react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Esperando restauracion de sesion
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Si ya esta logueado, redirigir al dashboard
  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="w-full max-w-[420px] px-4">
        <div className="bg-card rounded-3xl shadow-[0_20px_25px_-5px_rgb(0_0_0/0.06),0_8px_10px_-6px_rgb(0_0_0/0.04)] border border-border p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white mb-6 shadow-lg shadow-primary/20">
              <Package size={28} weight="duotone" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">CRM MultiProyecto</h1>
            <p className="text-muted-foreground text-sm mt-2">Introduce tus credenciales para acceder</p>
            {/* Beta badge */}
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <ShieldCheck size={12} weight="duotone" className="text-amber-600" />
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">v0.1.0 Fase Beta</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} aria-label="Formulario de inicio de sesion" className="space-y-5">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                autoComplete="email"
                className="w-full h-11 px-4 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Contrasena
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contrasena"
                  autoComplete="current-password"
                  className="w-full h-11 px-4 pr-11 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Mostrar contrasena"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Iniciando sesion...
                </span>
              ) : (
                'Iniciar Sesion'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t text-center">
            <p className="text-xs text-muted-foreground">
              No tienes cuenta?{' '}
              <span className="text-foreground font-bold cursor-pointer underline underline-offset-2">
                Contacta con el administrador
              </span>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6">
          &copy; 2026 CRM MultiProyecto &mdash; Psiko Aprende &bull; ISEIH &bull; Fono Aprende
        </p>
      </div>
    </div>
  );
}
