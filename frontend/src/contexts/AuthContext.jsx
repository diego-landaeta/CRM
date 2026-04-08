import { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import client, { setAccessToken, setOnAuthFailure } from '@/shared/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [loading, setLoading] = useState(true); // true hasta que verifiquemos sesion
  const initialized = useRef(false);

  // Al montar, intentar restaurar sesion con refresh token (cookie httpOnly)
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
            const validProjectId = meRes.data.projects?.find(
              (p) => p.id === Number(savedProjectId)
            )?.id;
            setActiveProjectId(validProjectId || meRes.data.projects?.[0]?.id || null);
          }
        }
      } catch {
        // Sin sesion valida — no hacer nada
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
      throw new Error(res.error || 'Error al iniciar sesion');
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
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setActiveProjectId(projectId);
      localStorage.setItem('crm_active_project_id', String(projectId));
    }
  }, [projects]);

  const isAuthenticated = !!user;
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  return (
    <AuthContext.Provider value={{
      user,
      projects,
      activeProject,
      activeProjectId: activeProject?.id || null,
      isAuthenticated,
      loading,
      login,
      logout,
      switchProject,
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
