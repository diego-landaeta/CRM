import { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import client, { setAccessToken, setOnAuthFailure } from '@/shared/api/client';

const AuthContext = createContext(null);

// Sentinel para el modo "Todos los proyectos" (vista agregada).
export const ALL_PROJECTS_ID = -1;
const ALL_PROJECTS_PSEUDO = { id: ALL_PROJECTS_ID, nombre: 'Todos los proyectos', isAll: true, type: 'multi' };

// Dev-only bypass: fake superadmin user + proyectos seed para validar UI sin backend.
const BYPASS = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase() === 'true';
const FAKE_USER = { id: 1, userId: 1, nombre: 'Dev Bypass', email: 'dev@local', role: 'superadmin' };
const FAKE_PROJECTS = [
  { id: 1, nombre: 'Psiko Aprende', slug: 'psiko-aprende', type: 'multi' },
  { id: 2, nombre: 'ISEIH', slug: 'iseih', type: 'multi' },
  { id: 3, nombre: 'Fono Aprende', slug: 'fono-aprende', type: 'multi' },
  { id: 4, nombre: 'ICTESS', slug: 'ictess', type: 'multi' },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(BYPASS ? FAKE_USER : null);
  const [projects, setProjects] = useState(BYPASS ? FAKE_PROJECTS : []);
  const [activeProjectId, setActiveProjectId] = useState(BYPASS ? FAKE_PROJECTS[0].id : null);
  const [loading, setLoading] = useState(!BYPASS); // bypass salta el loader
  /**
   * Los permisos y la vista del usuario. Tarea #7.
   *
   * `/auth/me` los devuelve desde que se hizo el backend de roles, y aqui no se
   * guardaban: el contexto solo tenia usuario y proyectos. Por eso el menu
   * seguia recortando con `roles: ['admin']` escritos a mano, y tras entrar
   * todo el mundo aterrizaba en `/` aunque su rol tuviera otra ruta puesta.
   *
   * `/auth/login` NO los trae —solo usuario, proyectos y testigo—, asi que
   * despues de entrar hay que preguntarle a `/auth/me`.
   */
  const [permissions, setPermissions] = useState({});
  const [view, setView] = useState({});
  const initialized = useRef(false);

  // Al montar, intentar restaurar sesión con refresh token (cookie httpOnly)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function restoreSession() {
      try {
        // Intentar refresh para obtener nuevo accessToken
        const apiBase = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '') + '/api';
        const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!refreshRes.ok) {
          setLoading(false);
          return;
        }

        const refreshData = await refreshRes.json();
        if (refreshData.success && refreshData.data.accessToken) {
          setAccessToken(refreshData.data.accessToken);

          // Obtener datos del usuario
          const meRes = await client.get('/auth/me');
          if (meRes.success) {
            setUser(meRes.data.user);
            setProjects(meRes.data.projects || []);
            setPermissions(meRes.data.permissions || {});
            setView(meRes.data.view || {});
            // Restaurar proyecto activo de localStorage o usar el primero
            const savedProjectId = localStorage.getItem('crm_active_project_id');
            const savedNum = Number(savedProjectId);
            const validProjectId = savedNum === ALL_PROJECTS_ID
              ? ALL_PROJECTS_ID
              : meRes.data.projects?.find((p) => p.id === savedNum)?.id;
            setActiveProjectId(validProjectId || meRes.data.projects?.[0]?.id || null);
          }
        }
      } catch {
        // Sin sesión valida — no hacer nada
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  // Configurar callback de fallo de auth para limpiar estado
  useEffect(() => {
    setOnAuthFailure(() => {
      setUser(null);
      setProjects([]);
      setActiveProjectId(null);
      setAccessToken(null);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await client.post('/auth/login', { email, password });

    if (!res.success) {
      throw new Error(res.error || 'Error al iniciar sesión');
    }

    const { accessToken: token, user: userData, projects: userProjects, activeProjectId: apiProjectId } = res.data;

    // El testigo primero: `/auth/me` lo necesita, y `setAccessToken` escribe una
    // variable del modulo, no estado de React, asi que esta disponible ya.
    setAccessToken(token);

    // Los permisos y la vista van en `/auth/me`, no en la respuesta del login.
    let vista = {};
    try {
      const me = await client.get('/auth/me');
      if (me.success) {
        setPermissions(me.data.permissions || {});
        vista = me.data.view || {};
        setView(vista);
      }
    } catch {
      // Sin esto se entra igual, solo que al sitio de siempre y sin permisos
      // finos. Quedarse fuera por no poder leer la vista seria peor.
    }

    // El usuario AL FINAL, y esto no es cosmetico.
    //
    // `LoginPage` tiene arriba un `if (isAuthenticated) return <Navigate to=.../>`
    // que se dispara en cuanto hay usuario — antes de que su `navigate()` llegue
    // a ejecutarse. Poniendo el usuario antes de tener la vista, ese guard
    // mandaba a todo el mundo a `/` y la ruta del rol no se usaba nunca.
    setUser(userData);
    setProjects(userProjects || []);

    // Usar proyecto activo del login o el primero disponible
    const savedProjectId = localStorage.getItem('crm_active_project_id');
    const projectId = userProjects?.find((p) => p.id === Number(savedProjectId))?.id
      || apiProjectId
      || userProjects?.[0]?.id
      || null;
    setActiveProjectId(projectId);
    if (projectId) localStorage.setItem('crm_active_project_id', String(projectId));

    return { ...userData, view: vista };
  }, []);

  const logout = useCallback(async () => {
    try {
      await client.post('/auth/logout');
    } catch {
      // Ignorar errores de logout — limpiar estado igual
    }
    setAccessToken(null);
    setUser(null);
    setProjects([]);
    setActiveProjectId(null);
    setPermissions({});
    setView({});
    localStorage.removeItem('crm_active_project_id');
  }, []);

  const switchProject = useCallback((projectId) => {
    if (projectId === ALL_PROJECTS_ID) {
      setActiveProjectId(ALL_PROJECTS_ID);
      localStorage.setItem('crm_active_project_id', String(ALL_PROJECTS_ID));
      return;
    }
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setActiveProjectId(projectId);
      localStorage.setItem('crm_active_project_id', String(projectId));
    }
  }, [projects]);

  const isAuthenticated = !!user;
  const activeProject =
    activeProjectId === ALL_PROJECTS_ID
      ? ALL_PROJECTS_PSEUDO
      : projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  const isAllProjects = activeProjectId === ALL_PROJECTS_ID;

  const refreshUser = useCallback(async () => {
    try {
      const res = await client.get('/auth/me');
      if (res.success) {
        setUser(res.data.user);
        setProjects(res.data.projects || []);
        // Tambien aqui: si a alguien le cambian el rol y se refresca, sus
        // permisos y su vista tienen que venirse con el.
        setPermissions(res.data.permissions || {});
        setView(res.data.view || {});
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      projects,
      activeProject,
      activeProjectId: activeProject?.id || null,
      isAllProjects,
      isAuthenticated,
      loading,
      permissions,
      view,
      login,
      logout,
      switchProject,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
