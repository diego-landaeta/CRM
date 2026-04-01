# 05 - Arquitectura Frontend

> CRM MultiProyecto -- React + Vite + shadcn/ui + Tailwind CSS

---

## 1. Stack Frontend

| Tecnologia | Version / Detalle | Proposito |
|---|---|---|
| **React** | 18+ (SPA) | Libreria UI, renderizado declarativo |
| **Vite** | 5+ (`base: '/crm/'`) | Bundler y dev server (HMR ultrarapido) |
| **React Router** | v6 | Enrutamiento SPA con lazy loading y Suspense |
| **Tailwind CSS** | 3+ | Utilidades CSS con config personalizada |
| **shadcn/ui** | Ultima | Componentes accesibles (Radix UI + Tailwind), instalados individualmente via CLI |
| **Axios** | 1+ | Cliente HTTP con interceptores para refresh de token |
| **Recharts** | 2+ | Graficas del dashboard (barras, lineas, pie) |
| **lucide-react** | Ultima | Iconos SVG consistentes |
| **react-markdown** | Ultima | Renderizado de reportes generados por IA |
| **date-fns** | 3+ | Formateo y manipulacion de fechas (sin mutacion) |

### Configuracion Vite relevante

```js
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/crm/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/crm/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## 2. Sistema de Layouts

La aplicacion utiliza dos layouts principales que separan la experiencia autenticada de la no autenticada.

### 2.1 AuthLayout (no autenticado)

- Card centrada sobre fondo con gradiente.
- Se usa en: **LoginPage**, **SetPasswordPage**.
- Sin sidebar, sin navbar.

```
+--------------------------------------------------+
|                                                  |
|            +-----------------------+             |
|            |  Logo                 |             |
|            |  [email]              |             |
|            |  [password]           |             |
|            |  [Iniciar sesion]     |             |
|            +-----------------------+             |
|                                                  |
+--------------------------------------------------+
       Fondo gradiente (brand colors)
```

```jsx
// src/layouts/AuthLayout.jsx
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-6">
        <Outlet />
      </div>
    </div>
  );
}
```

### 2.2 AppLayout (autenticado)

Estructura principal con sidebar, navbar y area de contenido.

```
+--------+-------------------------------------------+
| SIDEBAR|  NAVBAR (top bar)                         |
|        |  [hamburger] [ProjectSelector] ... [bell] [avatar]
|--------|-------------------------------------------|
| Logo   |                                           |
| Nav    |            CONTENT AREA                   |
| links  |            (React Router Outlet)           |
|        |                                           |
|        |                                           |
| ...    |                                           |
|--------|                                           |
| User   |                                           |
| Logout |                                           |
+--------+-------------------------------------------+
```

#### Sidebar

- **Colapsable** en desktop (toggle entre icono-only y completo).
- **Responsive**: en movil se renderiza como `Sheet` (panel deslizante de shadcn/ui).
- Estructura:
  - **Parte superior**: Logo + nombre de la aplicacion.
  - **Navegacion**: Links filtrados por rol del usuario.
  - **Parte inferior**: Info del usuario activo + boton de logout.

**Navegacion por rol:**

| Seccion | Ruta | Roles permitidos | Fase |
|---|---|---|---|
| Dashboard | `/` | Todos | 1 |
| Leads | `/leads` | Todos | 1 |
| Conversiones | `/conversions` | Todos | 1 |
| Productos | `/products` | Todos | 1 |
| Campanas Meta | `/campaigns/meta` | SA, A | 2 |
| Campanas Google | `/campaigns/google` | SA, A | 2 |
| Trafico Organico | `/organic` | SA, A | 2 |
| Proyectos IA | `/ia-projects` | SA, A | 2 |
| Audiencias | `/audiences` | SA, A | 2 |
| Reportes | `/reports` | SA, A | 2 |
| **Admin** | | | |
| Usuarios | `/admin/users` | SA | 1 |
| Proyectos | `/admin/projects` | SA | 1 |
| Credenciales | `/admin/credentials` | SA | 1 |
| Actividad | `/admin/activity-log` | SA | 1 |
| **Chat IA** | `/chat` | Todos | 3 |

> **SA** = Super Admin, **A** = Admin

#### Navbar (top bar)

| Elemento | Comportamiento |
|---|---|
| Hamburger menu | Solo visible en mobile; abre el Sheet del sidebar |
| ProjectSelector | Dropdown visible si el usuario tiene acceso a multiples proyectos. Cambia `activeProject` en `ProjectContext` |
| Breadcrumb | Opcional, muestra la ruta actual de navegacion |
| Notification bell | Indicador de notificaciones (nuevos leads, recordatorios pendientes) |
| Avatar + dropdown | Muestra nombre/rol del usuario, enlace a perfil, opcion de logout |

#### Content Area

- Renderiza el componente de la ruta activa via `<Outlet />` de React Router.
- Padding consistente y max-width para legibilidad.

```jsx
// src/layouts/AppLayout.jsx
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar desktop */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

---

## 3. Mapa de Rutas Completo (React Router v6)

### 3.1 Tabla de rutas

```
/login                          -> LoginPage              [public]
/set-password/:token            -> SetPasswordPage         [public]

/ (AppLayout)
  /                             -> DashboardPage           [auth] -- redirige aqui tras login
  /leads                        -> LeadsListPage           [auth] -- lista + filtros + vista pipeline toggle
  /leads/:id                    -> LeadDetailPage          [auth] -- ficha completa con tabs
  /conversions                  -> ConversionsPage         [auth] -- tabla con filtros por proyecto/mes
  /conversions/:id              -> ConversionDetailPage    [auth] -- detalle + pagos
  /products                     -> ProductsPage            [auth] -- gestion productos + dossiers por proyecto
  /campaigns/meta               -> MetaCampaignsPage       [SA,A] [Fase 2]
  /campaigns/google             -> GoogleCampaignsPage     [SA,A] [Fase 2]
  /organic                      -> GSCPage                 [SA,A] [Fase 2]
  /ia-projects                  -> IAMonitorPage           [SA,A] [Fase 2]
  /audiences                    -> AudiencesPage           [SA,A] [Fase 2]
  /reports                      -> ReportsListPage         [auth] [Fase 2]
  /reports/:id                  -> ReportDetailPage        [auth] [Fase 2]
  /chat                         -> ChatPage                [auth] [Fase 3]
  /admin/users                  -> UsersAdminPage          [SA]
  /admin/users/:id              -> UserDetailPage          [SA]
  /admin/projects               -> ProjectsAdminPage       [SA]
  /admin/credentials            -> CredentialsPage         [SA]
  /admin/activity-log           -> ActivityLogPage         [SA]
  /admin/queue/:projectId       -> QueueConfigPage         [SA]
  *                             -> NotFoundPage
```

### 3.2 Implementacion de router.jsx

```jsx
// src/router.jsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import AuthLayout from '@/layouts/AuthLayout';
import AppLayout from '@/layouts/AppLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import RoleRoute from '@/components/auth/RoleRoute';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

// ---------- Lazy imports ----------

// Auth pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const SetPasswordPage = lazy(() => import('@/pages/auth/SetPasswordPage'));

// Main pages (Fase 1)
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const LeadsListPage = lazy(() => import('@/pages/leads/LeadsListPage'));
const LeadDetailPage = lazy(() => import('@/pages/leads/LeadDetailPage'));
const ConversionsPage = lazy(() => import('@/pages/conversions/ConversionsPage'));
const ConversionDetailPage = lazy(() => import('@/pages/conversions/ConversionDetailPage'));
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'));

// Fase 2 pages
const MetaCampaignsPage = lazy(() => import('@/pages/campaigns/MetaCampaignsPage'));
const GoogleCampaignsPage = lazy(() => import('@/pages/campaigns/GoogleCampaignsPage'));
const GSCPage = lazy(() => import('@/pages/organic/GSCPage'));
const IAMonitorPage = lazy(() => import('@/pages/ia/IAMonitorPage'));
const AudiencesPage = lazy(() => import('@/pages/audiences/AudiencesPage'));
const ReportsListPage = lazy(() => import('@/pages/reports/ReportsListPage'));
const ReportDetailPage = lazy(() => import('@/pages/reports/ReportDetailPage'));

// Fase 3 pages
const ChatPage = lazy(() => import('@/pages/chat/ChatPage'));

// Admin pages
const UsersAdminPage = lazy(() => import('@/pages/admin/UsersAdminPage'));
const UserDetailPage = lazy(() => import('@/pages/admin/UserDetailPage'));
const ProjectsAdminPage = lazy(() => import('@/pages/admin/ProjectsAdminPage'));
const CredentialsPage = lazy(() => import('@/pages/admin/CredentialsPage'));
const ActivityLogPage = lazy(() => import('@/pages/admin/ActivityLogPage'));
const QueueConfigPage = lazy(() => import('@/pages/admin/QueueConfigPage'));

// Error pages
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// ---------- Suspense wrapper ----------
function SuspenseWrapper({ children }) {
  return (
    <Suspense fallback={<LoadingSpinner className="min-h-screen" />}>
      {children}
    </Suspense>
  );
}

// ---------- Router ----------
const router = createBrowserRouter(
  [
    // --- Rutas publicas (AuthLayout) ---
    {
      element: <AuthLayout />,
      children: [
        {
          path: '/login',
          element: (
            <SuspenseWrapper>
              <LoginPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: '/set-password/:token',
          element: (
            <SuspenseWrapper>
              <SetPasswordPage />
            </SuspenseWrapper>
          ),
        },
      ],
    },

    // --- Rutas protegidas (AppLayout) ---
    {
      element: (
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      ),
      children: [
        // Dashboard
        {
          index: true,
          element: (
            <SuspenseWrapper>
              <DashboardPage />
            </SuspenseWrapper>
          ),
        },

        // Leads
        {
          path: 'leads',
          element: (
            <SuspenseWrapper>
              <LeadsListPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: 'leads/:id',
          element: (
            <SuspenseWrapper>
              <LeadDetailPage />
            </SuspenseWrapper>
          ),
        },

        // Conversiones
        {
          path: 'conversions',
          element: (
            <SuspenseWrapper>
              <ConversionsPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: 'conversions/:id',
          element: (
            <SuspenseWrapper>
              <ConversionDetailPage />
            </SuspenseWrapper>
          ),
        },

        // Productos
        {
          path: 'products',
          element: (
            <SuspenseWrapper>
              <ProductsPage />
            </SuspenseWrapper>
          ),
        },

        // --- Fase 2: Campanas y reportes (SA, Admin) ---
        {
          path: 'campaigns/meta',
          element: (
            <RoleRoute allowed={['super_admin', 'admin']}>
              <SuspenseWrapper>
                <MetaCampaignsPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'campaigns/google',
          element: (
            <RoleRoute allowed={['super_admin', 'admin']}>
              <SuspenseWrapper>
                <GoogleCampaignsPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'organic',
          element: (
            <RoleRoute allowed={['super_admin', 'admin']}>
              <SuspenseWrapper>
                <GSCPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'ia-projects',
          element: (
            <RoleRoute allowed={['super_admin', 'admin']}>
              <SuspenseWrapper>
                <IAMonitorPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'audiences',
          element: (
            <RoleRoute allowed={['super_admin', 'admin']}>
              <SuspenseWrapper>
                <AudiencesPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'reports',
          element: (
            <SuspenseWrapper>
              <ReportsListPage />
            </SuspenseWrapper>
          ),
        },
        {
          path: 'reports/:id',
          element: (
            <SuspenseWrapper>
              <ReportDetailPage />
            </SuspenseWrapper>
          ),
        },

        // --- Fase 3: Chat IA ---
        {
          path: 'chat',
          element: (
            <SuspenseWrapper>
              <ChatPage />
            </SuspenseWrapper>
          ),
        },

        // --- Admin (solo Super Admin) ---
        {
          path: 'admin/users',
          element: (
            <RoleRoute allowed={['super_admin']}>
              <SuspenseWrapper>
                <UsersAdminPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'admin/users/:id',
          element: (
            <RoleRoute allowed={['super_admin']}>
              <SuspenseWrapper>
                <UserDetailPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'admin/projects',
          element: (
            <RoleRoute allowed={['super_admin']}>
              <SuspenseWrapper>
                <ProjectsAdminPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'admin/credentials',
          element: (
            <RoleRoute allowed={['super_admin']}>
              <SuspenseWrapper>
                <CredentialsPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'admin/activity-log',
          element: (
            <RoleRoute allowed={['super_admin']}>
              <SuspenseWrapper>
                <ActivityLogPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },
        {
          path: 'admin/queue/:projectId',
          element: (
            <RoleRoute allowed={['super_admin']}>
              <SuspenseWrapper>
                <QueueConfigPage />
              </SuspenseWrapper>
            </RoleRoute>
          ),
        },

        // 404
        {
          path: '*',
          element: (
            <SuspenseWrapper>
              <NotFoundPage />
            </SuspenseWrapper>
          ),
        },
      ],
    },

    // Redireccion raiz
    {
      path: '*',
      element: <Navigate to="/login" replace />,
    },
  ],
  {
    basename: '/crm',
  }
);

export default router;
```

### 3.3 Guards de autenticacion y rol

```jsx
// src/components/auth/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner className="min-h-screen" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
```

```jsx
// src/components/auth/RoleRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Restringe acceso a rutas segun rol del usuario.
 * @param {string[]} allowed - Roles permitidos, ej: ['super_admin', 'admin']
 */
export default function RoleRoute({ allowed, children }) {
  const { user } = useAuth();

  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
```

---

## 4. Contexts (Estado Global)

La aplicacion usa React Context para estado global minimo. El estado local de cada pagina se maneja con `useState`/`useReducer` dentro del propio componente.

### 4.1 AuthContext

Maneja la sesion del usuario, autenticacion y refresh automatico del token.

```jsx
// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '@/api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Derivado del estado
  const isAuthenticated = !!user;
  const role = user?.role ?? null;

  /**
   * Al montar la app, intenta refrescar el token desde la cookie httpOnly.
   * Si tiene exito, el usuario queda autenticado.
   * Si falla, se redirige al login.
   */
  useEffect(() => {
    async function initAuth() {
      try {
        const { data } = await authApi.refresh();
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  /**
   * Login con email y password.
   * El backend establece la cookie httpOnly con el refresh token
   * y retorna el access token + datos del usuario.
   */
  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password);
    // El access token se guarda en memoria (variable del modulo api/client.js)
    setUser(data.user);
    return data;
  }, []);

  /**
   * Logout: limpia la sesion en backend y en el cliente.
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Si falla el logout en backend, limpiamos igual en cliente
    } finally {
      setUser(null);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  /**
   * Refresca el access token.
   * Usado por el interceptor de Axios cuando recibe un 401.
   */
  const refreshToken = useCallback(async () => {
    const { data } = await authApi.refresh();
    setUser(data.user);
    return data.accessToken;
  }, []);

  const value = {
    user,
    role,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para consumir el AuthContext.
 * Lanza error si se usa fuera del AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
```

**Estado interno:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `user` | `object \| null` | Datos del usuario autenticado (`id`, `name`, `email`, `role`, `projectIds`) |
| `isAuthenticated` | `boolean` | Derivado: `!!user` |
| `isLoading` | `boolean` | `true` mientras se verifica la sesion al montar la app |

**Acciones expuestas:**

| Accion | Parametros | Descripcion |
|---|---|---|
| `login` | `email, password` | Autentica contra el backend, almacena usuario en estado |
| `logout` | - | Limpia sesion en backend y cliente, redirige a login |
| `refreshToken` | - | Refresca access token via cookie httpOnly |

### 4.2 ProjectContext

Maneja la seleccion del proyecto activo en contextos multiproyecto.

```jsx
// src/contexts/ProjectContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as projectsApi from '@/api/projects.api';

const ProjectContext = createContext(null);

const STORAGE_KEY = 'crm_active_project';

export function ProjectProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProjectState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Carga los proyectos accesibles para el usuario autenticado.
   * Se ejecuta cuando cambia el estado de autenticacion.
   */
  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated) {
      setProjects([]);
      setActiveProjectState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data } = await projectsApi.getMyProjects();
      setProjects(data);

      // Restaurar proyecto activo desde localStorage
      const savedId = localStorage.getItem(STORAGE_KEY);
      const savedProject = data.find((p) => p.id === savedId);

      if (savedProject) {
        setActiveProjectState(savedProject);
      } else if (data.length > 0) {
        // Si no hay guardado o no es valido, usar el primero
        setActiveProjectState(data[0]);
        localStorage.setItem(STORAGE_KEY, data[0].id);
      }
    } catch (error) {
      console.error('Error cargando proyectos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /**
   * Cambia el proyecto activo y persiste en localStorage.
   */
  const setActiveProject = useCallback(
    (projectId) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setActiveProjectState(project);
        localStorage.setItem(STORAGE_KEY, projectId);
      }
    },
    [projects]
  );

  const value = {
    projects,
    activeProject,
    setActiveProject,
    isLoading,
    fetchProjects,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

/**
 * Hook para consumir el ProjectContext.
 */
export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject debe usarse dentro de un ProjectProvider');
  }
  return context;
}
```

**Estado interno:**

| Campo | Tipo | Descripcion |
|---|---|---|
| `projects` | `Project[]` | Lista de proyectos accesibles para el usuario |
| `activeProject` | `Project \| null` | Proyecto seleccionado actualmente |
| `isLoading` | `boolean` | `true` mientras se cargan los proyectos |

**Acciones expuestas:**

| Accion | Parametros | Descripcion |
|---|---|---|
| `setActiveProject` | `projectId: string` | Cambia el proyecto activo y lo persiste en localStorage |
| `fetchProjects` | - | Recarga la lista de proyectos desde el backend |

**Persistencia:** El `activeProject` se almacena en `localStorage` bajo la clave `crm_active_project` para mantener la seleccion entre sesiones del navegador.

### 4.3 Jerarquia de Providers

```jsx
// src/App.jsx
import { BrowserRouter } from 'react-router-dom';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { Toaster } from '@/components/ui/sonner';
import router from '@/router';

export default function App() {
  return (
    <>
      <AuthProvider>
        <ProjectProvider>
          <RouterProvider router={router} />
        </ProjectProvider>
      </AuthProvider>
      <Toaster position="top-right" richColors />
    </>
  );
}
```

> **Nota:** Si se usa `createBrowserRouter` (como en el ejemplo del router), la estructura de providers se ajusta para que `AuthProvider` y `ProjectProvider` envuelvan el layout raiz en vez del `RouterProvider`, ya que `createBrowserRouter` gestiona su propio contexto de routing.

---

## 5. Inventario de Componentes

### 5.1 Componentes shadcn/ui (instalar segun necesidad)

Todos se instalan individualmente via CLI: `npx shadcn-ui@latest add <componente>`

| Componente | Uso principal |
|---|---|
| `Button` | Acciones primarias, secundarias, destructivas |
| `Input` | Campos de texto en formularios |
| `Label` | Etiquetas de formularios |
| `Select` | Seleccion de opciones (proyecto, status, responsable) |
| `Textarea` | Notas, descripciones largas |
| `Checkbox` | Seleccion multiple, toggles de filtro |
| `Switch` | Activar/desactivar funcionalidades |
| `Dialog` | Modales de creacion/edicion |
| `AlertDialog` | Confirmaciones de acciones destructivas |
| `Sheet` | Sidebar mobile, paneles laterales |
| `Table` | Tablas de datos (header, body, row, cell) |
| `Badge` | Status de leads, etiquetas de canal |
| `Card` | Contenedores (header, content, footer) |
| `Tabs` | Navegacion en ficha de lead (info, interacciones, archivos) |
| `DropdownMenu` | Menu de usuario, acciones contextuales |
| `Toast / Sonner` | Notificaciones de exito/error |
| `Skeleton` | Estados de carga |
| `Avatar` | Foto/iniciales de usuario |
| `Tooltip` | Informacion contextual al hover |
| `Command` | Barra de busqueda (Cmd+K) |
| `Calendar` | Seleccion de fechas |
| `Popover` | Contenido flotante (datepicker, info extra) |
| `Separator` | Divisores visuales |
| `ScrollArea` | Areas con scroll personalizado |
| `Progress` | Barras de progreso (carga de archivos) |

### 5.2 Componentes custom compartidos (`shared/`)

| Componente | Props principales | Descripcion |
|---|---|---|
| **StatusBadge** | `status: LeadStatus` | Badge coloreado segun el status del lead. Verde = convertido, rojo = no_interesado, azul = nuevo, etc. |
| **ChannelBadge** | `channel: UtmChannel` | Badge con icono segun canal de origen. Meta = azul con icono Facebook, Google = rojo, Organico = verde, etc. |
| **LeadCard** | `lead: Lead` | Card compacta para la vista pipeline. Muestra nombre, proyecto, status, fecha y responsable asignado. |
| **TimelineItem** | `interaction: Interaction` | Item individual de la linea de tiempo. Icono segun tipo (llamada, email, whatsapp, nota), fecha relativa, contenido y usuario que registro. |
| **FilterBar** | `filters, onFilterChange` | Barra de filtros reutilizable. Incluye Select de proyecto, status, responsable, canal y DatePicker de rango de fechas. |
| **StatCard** | `label, value, trend?, icon?` | Card de metrica para el dashboard. Muestra label descriptivo, valor numerico grande, flecha de tendencia (arriba/abajo con color) e icono opcional. |
| **DataTable** | `columns, data, pagination, onSort` | Wrapper de la Table de shadcn con sorting por columna, paginacion integrada y estado de carga con Skeleton. |
| **EmptyState** | `icon, title, description, action?` | Estado vacio para listas sin resultados. Icono ilustrativo, texto descriptivo y boton de accion opcional (ej: "Crear primer lead"). |
| **ConfirmDialog** | `title, description, onConfirm` | Modal de confirmacion reutilizable para acciones destructivas o importantes. Usa AlertDialog internamente. |
| **FileUpload** | `accept, maxSize, onUpload` | Zona de drag & drop para subir archivos (PDFs, dossiers). Preview del archivo, barra de progreso y validacion de tipo/tamano. |
| **MarkdownRenderer** | `content: string` | Renderiza contenido markdown de reportes generados por Claude. Aplica estilos de tipografia consistentes con el tema. |
| **LoadingSpinner** | `size?, className?` | Spinner de carga centrado. Tamanos: `sm`, `md`, `lg`. |
| **PageHeader** | `title, description?, actions?` | Header estandar de pagina. Titulo (h1), descripcion opcional y zona de botones de accion a la derecha. |

### 5.3 Ejemplo de componente: StatusBadge

```jsx
// src/components/shared/StatusBadge.jsx
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG = {
  nuevo:           { label: 'Nuevo',           variant: 'default',     className: 'bg-blue-500 hover:bg-blue-600' },
  por_contactar:   { label: 'Por contactar',   variant: 'default',     className: 'bg-orange-500 hover:bg-orange-600' },
  contactado:      { label: 'Contactado',      variant: 'default',     className: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
  en_seguimiento:  { label: 'En seguimiento',  variant: 'default',     className: 'bg-purple-500 hover:bg-purple-600' },
  convertido:      { label: 'Convertido',      variant: 'default',     className: 'bg-green-500 hover:bg-green-600' },
  no_interesado:   { label: 'No interesado',   variant: 'destructive', className: '' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary', className: '' };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
```

---

## 6. Patron de API Layer

La capa de API sigue un patron de **cliente centralizado** con archivos de dominio individuales para cada entidad.

```
src/
  api/
    client.js           # Instancia Axios + interceptores
    auth.api.js         # Endpoints de autenticacion
    leads.api.js        # Endpoints de leads
    users.api.js        # Endpoints de usuarios
    products.api.js     # Endpoints de productos
    conversions.api.js  # Endpoints de conversiones
    dashboard.api.js    # Endpoints de metricas del dashboard
    campaigns.api.js    # Endpoints de campanas (Meta, Google)
    reports.api.js      # Endpoints de reportes IA
    admin.api.js        # Endpoints de administracion
```

### 6.1 client.js -- Instancia Axios con interceptores

```js
// src/api/client.js
import axios from 'axios';

// Access token almacenado en memoria (NO en localStorage por seguridad)
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// ---------- Instancia Axios ----------

const client = axios.create({
  baseURL: '/crm/api',
  withCredentials: true, // Envia cookies httpOnly (refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------- Request interceptor ----------
// Adjunta el access token a cada request

client.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- Response interceptor ----------
// Maneja 401: refresca el token y reintenta la request original.
// Encola requests concurrentes durante el refresh.

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Solo intentar refresh en 401, y no para la propia ruta de refresh
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === '/auth/refresh'
    ) {
      return Promise.reject(error);
    }

    // Si ya estamos refrescando, encolar esta request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    // Iniciar refresh
    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        '/crm/api/auth/refresh',
        {},
        { withCredentials: true }
      );

      const newToken = data.accessToken;
      setAccessToken(newToken);

      // Reintentar la request original
      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      // Resolver requests encoladas
      processQueue(null, newToken);

      return client(originalRequest);
    } catch (refreshError) {
      // Refresh fallo: limpiar todo y forzar logout
      processQueue(refreshError, null);
      setAccessToken(null);

      // Redirigir a login (se maneja via evento custom)
      window.dispatchEvent(new CustomEvent('auth:logout'));

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default client;
```

### 6.2 Archivos de dominio -- Ejemplos

```js
// src/api/auth.api.js
import client, { setAccessToken } from './client';

export async function login(email, password) {
  const response = await client.post('/auth/login', { email, password });
  setAccessToken(response.data.accessToken);
  return response;
}

export async function logout() {
  const response = await client.post('/auth/logout');
  setAccessToken(null);
  return response;
}

export async function refresh() {
  const response = await client.post('/auth/refresh');
  setAccessToken(response.data.accessToken);
  return response;
}

export async function setPassword(token, password) {
  return client.post('/auth/set-password', { token, password });
}
```

```js
// src/api/leads.api.js
import client from './client';

export async function getLeads(params = {}) {
  // params: { projectId, status, channel, responsableId, dateFrom, dateTo, page, limit, search }
  return client.get('/leads', { params });
}

export async function getLead(id) {
  return client.get(`/leads/${id}`);
}

export async function updateLead(id, data) {
  return client.patch(`/leads/${id}`, data);
}

export async function updateStatus(id, status) {
  return client.patch(`/leads/${id}/status`, { status });
}

export async function reassign(id, responsableId) {
  return client.patch(`/leads/${id}/reassign`, { responsableId });
}

export async function addInteraction(id, data) {
  // data: { type, notes, metadata }
  return client.post(`/leads/${id}/interactions`, data);
}

export async function addReminder(id, data) {
  // data: { dueDate, note }
  return client.post(`/leads/${id}/reminders`, data);
}

export async function getTimeline(id) {
  return client.get(`/leads/${id}/timeline`);
}
```

```js
// src/api/dashboard.api.js
import client from './client';

export async function getStats(params = {}) {
  // params: { projectId, dateFrom, dateTo }
  return client.get('/dashboard/stats', { params });
}

export async function getLeadsByChannel(params = {}) {
  return client.get('/dashboard/leads-by-channel', { params });
}

export async function getConversionFunnel(params = {}) {
  return client.get('/dashboard/funnel', { params });
}

export async function getLeadsTrend(params = {}) {
  return client.get('/dashboard/leads-trend', { params });
}
```

### 6.3 Patron de uso en componentes

```jsx
// Ejemplo de uso en una pagina
import { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import * as leadsApi from '@/api/leads.api';

export default function LeadsListPage() {
  const { activeProject } = useProject();
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeProject) return;

    async function fetchLeads() {
      setIsLoading(true);
      try {
        const { data } = await leadsApi.getLeads({
          projectId: activeProject.id,
        });
        setLeads(data.leads);
      } catch (error) {
        console.error('Error cargando leads:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeads();
  }, [activeProject]);

  // ... render
}
```

---

## 7. Paleta de Colores y Tema

### 7.1 Colores para status de leads

| Status | Color Tailwind | Hex | Uso |
|---|---|---|---|
| `nuevo` | `blue-500` | `#3B82F6` | Lead recien ingresado |
| `por_contactar` | `orange-500` | `#F97316` | Asignado pero no contactado |
| `contactado` | `yellow-500` | `#EAB308` | Primer contacto realizado |
| `en_seguimiento` | `purple-500` | `#A855F7` | En proceso de negociacion |
| `convertido` | `green-500` | `#22C55E` | Conversion exitosa |
| `no_interesado` | `red-500` | `#EF4444` | Descartado / sin interes |

### 7.2 Colores para canales de adquisicion

| Canal | Color | Hex | Referencia |
|---|---|---|---|
| `meta_ads` | Facebook Blue | `#1877F2` | Color oficial de Meta/Facebook |
| `google_ads` | Google Red | `#EA4335` | Color oficial de Google |
| `organico` | Google Green | `#34A853` | Verde asociado a organico/SEO |
| `directo` | Gray | `#6B7280` | Gris neutro para trafico directo |
| `chatgpt_ia` | OpenAI Green | `#10A37F` | Color oficial de OpenAI |
| `tiktok_ads` | TikTok Black | `#000000` | Color oficial de TikTok |
| `referido` | Purple | `#8B5CF6` | Morado para referidos |

### 7.3 Configuracion de Tailwind

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Canales de adquisicion
        channel: {
          meta:     '#1877F2',
          google:   '#EA4335',
          organic:  '#34A853',
          direct:   '#6B7280',
          openai:   '#10A37F',
          tiktok:   '#000000',
          referral: '#8B5CF6',
        },
        // shadcn/ui CSS variables
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### 7.4 Mapa visual de colores por status

```
  nuevo           por_contactar     contactado
  [===========]   [===========]     [===========]
   #3B82F6          #F97316           #EAB308
   blue-500         orange-500        yellow-500

  en_seguimiento  convertido        no_interesado
  [===========]   [===========]     [===========]
   #A855F7          #22C55E           #EF4444
   purple-500       green-500         red-500
```

---

## 8. Estrategia Responsive

### 8.1 Enfoque general

- **Desktop first** con adaptaciones responsive hacia abajo.
- Breakpoint principal: `768px` (md) para tablet, `1024px` (lg) para desktop.
- Todas las vistas deben ser funcionales en mobile, aunque la experiencia primaria es desktop.

### 8.2 Comportamiento por componente

| Componente | Desktop (lg+) | Tablet (md) | Mobile (<md) |
|---|---|---|---|
| **Sidebar** | Fijo a la izquierda, colapsable a solo iconos | Colapsado por defecto | Oculto; se abre como `Sheet` (panel deslizante) |
| **Navbar** | Completa con todos los elementos | Completa | Hamburger menu + elementos esenciales |
| **ProjectSelector** | Dropdown en navbar | Dropdown en navbar | Dropdown en navbar (compacto) |
| **DataTable** | Todas las columnas visibles | Scroll horizontal si es necesario | Scroll horizontal con indicador visual |
| **Pipeline (Kanban)** | Columnas lado a lado | Scroll horizontal | Scroll horizontal con snap scrolling |
| **Dashboard** | Grid de 2-4 columnas | Grid de 2 columnas | Stack vertical (1 columna) |
| **StatCards** | 4 en fila | 2 en fila | Stack vertical |
| **Dialog/Modal** | Centrado con max-width | Centrado con max-width | Casi full-screen (padding minimo) |
| **FilterBar** | Filtros en linea horizontal | Filtros en linea (wrap) | Filtros en sheet/popover colapsable |
| **LeadDetail** | Tabs horizontales, 2 columnas | Tabs horizontales | Tabs horizontales scrolleables, 1 columna |

### 8.3 Clases Tailwind tipicas

```jsx
{/* Dashboard grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <StatCard />
  <StatCard />
  <StatCard />
  <StatCard />
</div>

{/* Sidebar responsive */}
{/* Desktop: sidebar fijo */}
<aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
  {/* ... */}
</aside>

{/* Mobile: Sheet */}
<Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
  <SheetContent side="left" className="w-64 p-0">
    {/* Mismo contenido del sidebar */}
  </SheetContent>
</Sheet>

{/* DataTable con scroll horizontal en mobile */}
<div className="overflow-x-auto">
  <Table className="min-w-[800px]">
    {/* ... */}
  </Table>
</div>

{/* Pipeline con snap scroll en mobile */}
<div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 lg:overflow-visible">
  <div className="snap-center min-w-[280px] lg:min-w-0 lg:flex-1">
    {/* Columna del pipeline */}
  </div>
</div>
```

### 8.4 Consideraciones de rendimiento

- **Lazy loading de rutas**: Todas las paginas se cargan bajo demanda con `React.lazy()` y `Suspense`.
- **Skeleton loaders**: Se muestran esqueletos de carga en lugar de spinners genericos para mejorar la percepcion de velocidad.
- **Virtualizacion**: Para listas muy largas (>100 items), considerar `react-window` o `@tanstack/react-virtual`.
- **Debounce en filtros**: Los filtros de busqueda por texto usan debounce de 300ms para evitar requests excesivas.
- **Memoizacion**: Usar `React.memo`, `useMemo` y `useCallback` donde el profiling indique re-renders innecesarios, no de forma preventiva.

---

## Resumen de estructura de archivos del frontend

```
src/
  api/
    client.js               # Instancia Axios + interceptores
    auth.api.js              # POST /auth/login, /auth/logout, /auth/refresh
    leads.api.js             # CRUD leads, interacciones, recordatorios
    users.api.js             # CRUD usuarios
    products.api.js          # CRUD productos y dossiers
    conversions.api.js       # CRUD conversiones y pagos
    dashboard.api.js         # Metricas, funnel, tendencias
    campaigns.api.js         # Campanas Meta y Google
    reports.api.js           # Reportes IA
    admin.api.js             # Admin: credenciales, actividad, colas

  components/
    auth/
      ProtectedRoute.jsx     # Guard de autenticacion
      RoleRoute.jsx          # Guard de rol

    layout/
      Sidebar.jsx            # Sidebar con navegacion por rol
      Navbar.jsx             # Top bar con selector de proyecto
      ProjectSelector.jsx    # Dropdown de proyecto activo

    shared/
      StatusBadge.jsx        # Badge de status de lead
      ChannelBadge.jsx       # Badge de canal de adquisicion
      LeadCard.jsx           # Card para vista pipeline
      TimelineItem.jsx       # Item de timeline de interacciones
      FilterBar.jsx          # Barra de filtros reutilizable
      StatCard.jsx           # Card de metrica con tendencia
      DataTable.jsx          # Tabla con sorting y paginacion
      EmptyState.jsx         # Estado vacio ilustrado
      ConfirmDialog.jsx      # Modal de confirmacion
      FileUpload.jsx         # Zona drag & drop
      MarkdownRenderer.jsx   # Renderizado de markdown
      LoadingSpinner.jsx     # Spinner de carga
      PageHeader.jsx         # Header estandar de pagina

    ui/                      # Componentes shadcn/ui (generados por CLI)
      button.jsx
      input.jsx
      badge.jsx
      ...

  contexts/
    AuthContext.jsx           # Sesion, login, logout, refresh
    ProjectContext.jsx        # Proyecto activo, lista de proyectos

  layouts/
    AuthLayout.jsx           # Layout para login/set-password
    AppLayout.jsx            # Layout principal con sidebar + navbar

  pages/
    auth/
      LoginPage.jsx
      SetPasswordPage.jsx
    leads/
      LeadsListPage.jsx
      LeadDetailPage.jsx
    conversions/
      ConversionsPage.jsx
      ConversionDetailPage.jsx
    products/
      ProductsPage.jsx
    campaigns/
      MetaCampaignsPage.jsx
      GoogleCampaignsPage.jsx
    organic/
      GSCPage.jsx
    ia/
      IAMonitorPage.jsx
    audiences/
      AudiencesPage.jsx
    reports/
      ReportsListPage.jsx
      ReportDetailPage.jsx
    chat/
      ChatPage.jsx
    admin/
      UsersAdminPage.jsx
      UserDetailPage.jsx
      ProjectsAdminPage.jsx
      CredentialsPage.jsx
      ActivityLogPage.jsx
      QueueConfigPage.jsx
    DashboardPage.jsx
    NotFoundPage.jsx

  router.jsx                 # Definicion de rutas con lazy loading
  App.jsx                    # Entry point con providers
  main.jsx                   # Render de React al DOM
  index.css                  # Tailwind directives + CSS variables shadcn
```
