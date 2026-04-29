// Logos locales de proyectos (servidos desde frontend/public/projects/).
// Se usan cuando el proyecto no tiene `logo_url` en la DB.
// Algunos proyectos tienen variante distinta para tema oscuro.

export const PROJECT_LOGO_MAP = {
  'psicologo-ia':     { light: '/crm/projects/psicologo-ia.png',          dark: '/crm/projects/psicologo-ia.png' },
  'nutricionista-ia': { light: '/crm/projects/nutricionista-ia.webp',     dark: '/crm/projects/nutricionista-ia.webp' },
  'psiko-aprende':    { light: '/crm/projects/psiko-aprende-light.png',   dark: '/crm/projects/psiko-aprende-dark.png' },
  'tarot-ia':         { light: '/crm/projects/tarot-ia.png',              dark: '/crm/projects/tarot-ia-dark.png' },
  'iseih':            { light: '/crm/projects/iseih.webp',                dark: '/crm/projects/iseih.webp' },
  'fono-aprende':     { light: '/crm/projects/fono-aprende.webp',         dark: '/crm/projects/fono-aprende.webp' },
};

export function hasLocalLogo(slug) {
  return !!(slug && PROJECT_LOGO_MAP[slug]);
}

export function getLocalLogo(slug, theme = 'light') {
  const entry = slug ? PROJECT_LOGO_MAP[slug] : null;
  if (!entry) return null;
  return theme === 'dark' ? entry.dark : entry.light;
}
