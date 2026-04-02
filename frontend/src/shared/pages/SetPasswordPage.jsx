import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Eye, EyeSlash, Check, X } from '@phosphor-icons/react';

const RULES = [
  { id: 'length', label: 'Minimo 8 caracteres', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'Al menos una mayuscula', test: (v) => /[A-Z]/.test(v) },
  { id: 'number', label: 'Al menos un numero', test: (v) => /\d/.test(v) },
  { id: 'match', label: 'Las contrasenas coinciden', test: (v, c) => v.length > 0 && v === c },
];

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const checks = useMemo(() =>
    RULES.map((r) => ({ ...r, passed: r.test(password, confirm) })),
    [password, confirm]
  );

  const allPassed = checks.every((c) => c.passed);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!allPassed) return;

    setLoading(true);
    setError(null);

    try {
      // TODO: llamar API real — POST /api/auth/set-password { token, password }
      await new Promise((r) => setTimeout(r, 800));
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Error al guardar la contrasena');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-[400px] px-4">
        <div className="bg-card rounded-3xl shadow-[0_20px_25px_-5px_rgb(0_0_0/0.06),0_8px_10px_-6px_rgb(0_0_0/0.04)] border border-border p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 text-white mb-6 shadow-lg shadow-emerald-500/20">
              <Package size={28} weight="duotone" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Establece tu contrasena</h1>
            <p className="text-muted-foreground text-sm mt-2">Crea una contrasena segura para acceder al CRM</p>
          </div>

          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-emerald-600" weight="bold" />
              </div>
              <h2 className="text-lg font-bold">Contrasena guardada</h2>
              <p className="text-muted-foreground text-sm mt-2">Redirigiendo al login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Password */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">
                  Nueva contrasena
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 8 caracteres"
                    className="w-full h-11 px-4 pr-11 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block px-1">
                  Confirmar contrasena
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repite la contrasena"
                    className="w-full h-11 px-4 pr-11 rounded-xl border border-border bg-muted/50 text-sm outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-card placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Validation Checklist */}
              <div className="bg-muted rounded-2xl p-4 space-y-2.5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Requisitos</p>
                {checks.map((check) => (
                  <div key={check.id} className="flex items-center gap-2.5 text-xs">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                      check.passed ? 'bg-emerald-500' : 'bg-border'
                    }`}>
                      {check.passed
                        ? <Check size={10} weight="bold" className="text-white" />
                        : <X size={10} weight="bold" className="text-muted-foreground" />
                      }
                    </div>
                    <span className={`font-medium transition-colors ${
                      check.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
                    }`}>
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5 font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={!allPassed || loading}
                className="w-full h-12 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
              >
                {loading ? 'Guardando...' : 'Guardar contrasena'}
              </button>
            </form>
          )}
        </div>

        {!token && (
          <p className="text-center text-[10px] text-amber-600 bg-amber-50 rounded-xl px-4 py-2 mt-4 font-medium">
            Token no detectado — esta pagina normalmente se accede desde el email de invitacion.
          </p>
        )}
      </div>
    </div>
  );
}
