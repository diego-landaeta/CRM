import { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext(null);

// En testeo (SuiteDash) forzamos SIEMPRE modo claro: el reskin es claro y, si
// quedara la clase `.dark`, las utilidades `dark:` de Tailwind (badges, tablas…)
// pintarían colores oscuros sobre tarjetas blancas = ilegible. Prod (/crm/) no
// se ve afectada y conserva el toggle claro/oscuro.
const FORCE_LIGHT = import.meta.env.DEV
  || (import.meta.env.BASE_URL || '').startsWith('/testeo/')
  || (import.meta.env.BASE_URL || '').startsWith('/testeo2/');

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (FORCE_LIGHT) return 'light';
    const saved = localStorage.getItem('crm_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(FORCE_LIGHT ? 'light' : theme);
    if (!FORCE_LIGHT) localStorage.setItem('crm_theme', theme);
  }, [theme]);

  function toggleTheme() {
    if (FORCE_LIGHT) return; // toggle deshabilitado en el preview SuiteDash
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
