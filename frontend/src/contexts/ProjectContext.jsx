import { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { hexToHslTriplet } from '@/shared/lib/color';

const ProjectContext = createContext(null);

const BASE_URL = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');
const DEFAULT_FAVICON = `${BASE_URL}/favicon.svg`;

// El favicon del proyecto activo.
//
// Tres cosas que hacian que desapareciera y que aqui se evitan:
//
// 1 · Apuntaba a /api/projects/:id/logo. El navegador pide el favicon SIN
//     cabeceras de sesion, asi que esa direccion nunca le va a contestar: pide
//     autenticacion. Hoy da igual: el icono es fijo, el del CRM.
// 2 · Si la imagen no cargaba —404, borrada, sin internet— el navegador se
//     quedaba sin icono. Ahora se prueba ANTES y solo se cambia si carga.
// 3 · El <link> del index declara type="image/svg+xml"; al meterle un PNG, el
//     tipo dejaba de cuadrar. Se quita al cambiarlo.
// El icono que trae el index.html, guardado antes de tocar nada. Es el que se
// repone cuando no hay logo o cuando el del proyecto no carga: viene con su
// ruta ya resuelta por el navegador, asi que funciona en /crm, en /testeo y en
// /staging sin tener que adivinar la base.
const ICONO_ORIGINAL = document.querySelector("link[rel='icon']")?.href || null;

function ponerFavicon(href) {
  for (const sel of ["link[rel='icon']", "link[rel='apple-touch-icon']"]) {
    const link = document.querySelector(sel);
    if (!link) continue;
    link.removeAttribute('type');
    link.removeAttribute('sizes');
    link.href = href;
  }
}

// Solo cambia el icono si la imagen carga de verdad. Si falla, se queda el del
// CRM: es preferible el icono de siempre a una pestaña en blanco.
function setFavicon(href, porDefecto) {
  const respaldo = ICONO_ORIGINAL || porDefecto;
  if (!href) { ponerFavicon(respaldo); return; }
  const img = new Image();
  img.onload = () => ponerFavicon(href);
  img.onerror = () => ponerFavicon(respaldo);
  img.src = href;
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
  const { activeProject, projects, switchProject, isAllProjects } = useAuth();

  // El icono de la pestaña es SIEMPRE el del CRM.
  //
  // Antes cambiaba al logo de la marca activa, y con nueve marcas y varias
  // pestañas abiertas dejaba de saberse cual era el CRM: parecian nueve
  // aplicaciones distintas. El icono identifica la herramienta; la marca en la
  // que trabajas la dice el menu, que es donde se mira.
  useEffect(() => {
    setFavicon(DEFAULT_FAVICON, DEFAULT_FAVICON);
  }, []);

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
      isAllProjects: !!isAllProjects,
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
