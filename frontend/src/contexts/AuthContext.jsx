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

    setAccessToken(token);
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

    return userData;
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
