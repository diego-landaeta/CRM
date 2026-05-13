import { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ProjectContext = createContext(null);

const BASE_URL = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');
const DEFAULT_FAVICON = `${BASE_URL}/favicon.svg`;

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
