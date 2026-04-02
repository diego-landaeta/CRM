import { createContext, useState, useContext, useCallback } from 'react';
import { USERS } from '@/shared/data/mock';

// TODO: reemplazar con auth real (JWT + refresh token) cuando backend este listo

const AuthContext = createContext(null);

const STORAGE_KEY = 'crm_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(async (email, password) => {
    // Mock: buscar usuario por email, simular delay
    await new Promise((r) => setTimeout(r, 600));

    const found = USERS.find((u) => u.email === email);
    if (!found) {
      throw new Error('Credenciales incorrectas');
    }

    // Mock: cualquier password funciona si el email existe
    const sessionUser = {
      id: found.id,
      nombre: found.nombre,
      email: found.email,
      role: found.role,
      projects: found.projects,
    };

    setUser(sessionUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    return sessionUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
