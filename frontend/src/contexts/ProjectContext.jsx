import { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { hexToHslTriplet } from '@/shared/lib/color';

const ProjectContext = createContext(null);

const BASE_URL = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');
const DEFAULT_FAVICON = `${BASE_URL}/favicon.jpeg`;

function setFavicon(href) {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
  // Apple touch icon tambien
  let apple = document.querySelector("link[rel='apple-touch-icon']");
  if (apple) apple.href = href;
}

// CRM-191: aplica el color primario del proyecto a las CSS vars que usan
// shadcn/Tailwind. Si theme_color es null o inválido, restaura el default
// quitando el override inline (el index.css recupera el control).
function applyThemeColor(hex) {
  const root = document.documentElement;
  const triplet = hexToHslTriplet(hex);
  if (triplet) {
    root.style.setProperty('--primary', triplet);
    root.style.setProperty('--ring', triplet);
  } else {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
  }
}

export function ProjectProvider({ children }) {
  const { activeProject, projects, switchProject } = useAuth();

  // Favicon dinamico: si el proyecto activo tiene logo, usarlo. Si no, default.
  useEffect(() => {
    // El title lo construye App.jsx (ruta + proyecto + MultiCRM) — aquí solo favicon.
    if (activeProject?.logo_url) {
      setFavicon(`${BASE_URL}/api/projects/${activeProject.id}/logo`);
    } else {
      setFavicon(DEFAULT_FAVICON);
    }
  }, [activeProject?.id, activeProject?.logo_url]);

  // Branding por proyecto (CRM-191): inyecta --primary/--ring del activeProject.
  useEffect(() => {
    applyThemeColor(activeProject?.theme_color);
    return () => applyThemeColor(null); // limpia al desmontar (logout)
  }, [activeProject?.id, activeProject?.theme_color]);

  return (
    <ProjectContext.Provider value={{
      activeProject: activeProject || { id: null, nombre: 'Sin proyecto' },
      projects: projects || [],
      switchProject,
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}
