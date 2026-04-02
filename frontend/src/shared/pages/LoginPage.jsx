import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, EyeSlash } from '@phosphor-icons/react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Completa todos los campos');
      return;
    }

    setLoading(true);
    // TODO: reemplazar con auth real cuando backend este listo
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    navigate('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-[400px] px-4">
        <div className="bg-card rounded-3xl shadow-[0_20px_25px_-5px_rgb(0_0_0/0.06),0_8px_10px_-6px_rgb(0_0_0/0.04)] border-border p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white mb-6 shadow-lg shadow-primary/20">
              <Package size={28} weight="duotone" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Bienvenido de nuevo</h1>
            <p className="text-muted-foreground text-sm mt-2">Introduce tus credenciales para acceder</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                <button type="button" className="text-[11px] font-semibold text-primary hover:text-primary/90 transition-colors">
                  Olvidaste tu contrasena?
                </button>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 px-1">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded accent-primary" />
              <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">Recordarme en este dispositivo</label>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5 font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-zinc-950 text-white rounded-xl font-semibold text-sm hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-950/10 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? 'Iniciando sesion...' : 'Iniciar Sesion'}
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
