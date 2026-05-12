// Logos locales de proyectos (servidos desde frontend/public/projects/).
// Se usan cuando el proyecto no tiene `logo_url` en la DB.
// Algunos proyectos tienen variante distinta para tema oscuro.

const BASE = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');

const PROJECT_LOGO_MAP = {
  'psicologo-ia':     { light: `${BASE}/projects/psicologo-ia.png`,         dark: `${BASE}/projects/psicologo-ia.png` },
  'nutricionista-ia': { light: `${BASE}/projects/nutricionista-ia.webp`,    dark: `${BASE}/projects/nutricionista-ia.webp` },
  'psiko-aprende':    { light: `${BASE}/projects/psiko-aprende-light.png`,  dark: `${BASE}/projects/psiko-aprende-dark.png` },
  'tarot-ia':         { light: `${BASE}/projects/tarot-ia.png`,             dark: `${BASE}/projects/tarot-ia-dark.png` },
  'iseih':            { light: `${BASE}/projects/iseih.webp`,               dark: `${BASE}/projects/iseih.webp` },
  'fono-aprende':     { light: `${BASE}/projects/fono-aprende.webp`,        dark: `${BASE}/projects/fono-aprende.webp` },
};

export function getLocalLogo(slug, theme = 'light') {
  const entry = slug ? PROJECT_LOGO_MAP[slug] : null;
  if (!entry) return null;
  return theme === 'dark' ? entry.dark : entry.light;
}
