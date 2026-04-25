# CRM Frontend — React 18 + Vite + Tailwind

SPA del CRM MultiProyecto. Servida desde `/crm` (prod) y `/testeo_crm` (staging).

## Setup

```bash
cd frontend
npm install
npm run dev          # vite dev server en localhost:5173 con base /crm
npm run build        # produccion (la ruta base se inyecta con --base)
```

**Build para staging:**
```bash
npx vite build --base=/testeo_crm/
```

**Build para produccion:**
```bash
npx vite build --base=/crm/
```

El `--base` es importante: vite prefija todas las rutas de assets con eso. Si compilas con base equivocada, los js/css no cargan.

## Variables de entorno

Ninguna obligatoria en `.env`. Vite usa `BASE_URL` que se setea con `--base` al compilar.

Para desarrollo local apuntando al backend de staging, el cliente axios usa rutas relativas `/api/...` que pasan por proxy de Vite (ver `vite.config.js`).

## Estructura

```
frontend/src/
├── App.jsx                       Router principal con lazy loading
├── main.jsx                      Entry point + providers globales
├── index.css                     Tailwind base + dark mode vars
│
├── contexts/                     Estado global compartido
│   ├── AuthContext.jsx           user, projects, accessToken, login/logout
│   ├── ProjectContext.jsx        activeProject + favicon dinamico
│   └── ThemeContext.jsx          dark/light toggle persistente
│
├── shared/                       Compartido entre todos los modulos
│   ├── api/
│   │   └── client.js             Axios-like fetch wrapper, refresh token auto
│   ├── components/
│   │   ├── layout/               AppLayout, Sidebar, ProtectedRoute, Toaster
│   │   └── ui/                   Primitivos: Button, KpiCard, EmptyState, Portal, SkeletonTable, etc
│   ├── hooks/                    useToast, useDashboard, useDebounce, etc
│   ├── lib/                      cn(), formatters, helpers
│   └── pages/                    LoginPage, DashboardPage, ProfilePage, SetPasswordPage
│
└── modules/                      Un directorio por dominio
    ├── leads/
    │   ├── api/                  Llamadas API specificas del dominio
    │   ├── components/           LeadFormDialog, ProductCombobox
    │   ├── hooks/                useLeads, useLeadDetail
    │   ├── pages/                LeadsPage, LeadsPipelinePage, LeadDetailPage
    │   └── validation/           Zod schemas
    ├── products/
    ├── conversions/
    ├── accounting/
    ├── commissions/
    ├── clients/
    ├── settings/
    │   ├── components/           ProjectSettingsDialog (tabs General/Modulos/Categorias/Campos/Webhook/APIs)
    │   └── pages/                SettingsPage (Usuarios/Proyectos/APIs/Seguridad)
    └── reports/
```

## Convenciones criticas (NO romper)

### 1. Estilos: solo Tailwind
- **NO** CSS modules, **NO** styled-components, **NO** archivos `.css` propios
- Si necesitas un patron complejo, hazlo con utility classes + `cn()`
- Modo oscuro: usa los modificadores `dark:`

### 2. Iconos: solo Phosphor Icons
- `import { Users, Folder } from '@phosphor-icons/react'`
- Tamaño tipico: `size={14|16|18|20}`
- Variantes: `weight="regular|bold|fill|duotone"`
- **NO emojis** salvo en data del usuario (ej proyecto.emoji como fallback)

### 3. API: usar `client` de `@/shared/api/client`
- `client.get('/leads')`, `client.post('/leads', data)`, `client.delete('/leads/:id')`
- Maneja refresh token automatico
- Para uploads: pasa FormData como body, el cliente lo detecta y omite Content-Type
- Errores: `try { await client.post(...) } catch (err) { err.data?.error }`

### 4. Estado global: Context (NO Redux)
- `useAuth()` para user, projects, login
- `useProjectContext()` para activeProject + switchProject
- `useTheme()` para dark mode

### 5. Forms: react-hook-form + Zod
- `useForm({ resolver: zodResolver(schema) })`
- Schemas viven en `<modulo>/validation/<nombre>.schema.js`

### 6. Routing: solo `<NavLink>` o `useNavigate()`
- **NUNCA** `<a href>` interno (rompe SPA)
- Para abrir en nueva tab: `<a href target="_blank" rel="noopener noreferrer">` (esto si esta OK)
- **NUNCA** `window.location.reload()` ni `location.href =` para navegar

### 7. Naming
- Componentes: PascalCase (`LeadFormDialog.jsx`)
- Hooks: camelCase con prefijo `use` (`useLeads.js`)
- Funciones internas: camelCase
- Constantes: UPPER_SNAKE_CASE
- Idioma codigo: ingles para identificadores, español para strings de UI

### 8. Imports
- `@/` = `/src/` (configurado en vite.config.js)
- Imports compartidos: `@/shared/...`, `@/contexts/...`
- Imports del modulo: relativos (`./components/X`, `../hooks/Y`)
- Lazy loading para paginas grandes: `lazy(() => import('...'))` con Suspense interno

### 9. Cada feature: documentar en `Claude/features/`
- Al implementar feature nueva, crea su `.md` en `Claude/features/`
- Sigue [TEMPLATE.md](../Claude/features/TEMPLATE.md)
- Actualiza el [README de features](../Claude/features/README.md)

## Stack

- **React 18.3** + **Vite 5**
- **TailwindCSS 3** + **shadcn/ui** (primitives Radix UI)
- **react-router-dom 6** con lazy loading
- **react-hook-form** + **zod** validacion
- **Recharts** para graficas
- **Phosphor Icons** iconografia
- **fetch** nativo (no axios) en `shared/api/client.js`

## Componentes UI disponibles

Ver [shared/components/ui/README.md](src/shared/components/ui/README.md) para el catalogo completo.

## Ejemplos rapidos

### Crear una pagina nueva en un modulo existente

```jsx
// frontend/src/modules/leads/pages/MiNuevaPagina.jsx
import { useEffect, useState } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Users } from '@phosphor-icons/react';

export default function MiNuevaPagina() {
  const { activeProject } = useProjectContext();
  const [data, setData] = useState([]);

  useEffect(() => {
    if (!activeProject?.id) return;
    client.get(`/leads?projectId=${activeProject.id}`).then(r => setData(r.data));
  }, [activeProject?.id]);

  return (
    <div className="space-y-6">
      <PageHeader title="Mi pagina" subtitle="Descripcion" />
      {data.length === 0 ? (
        <EmptyState icon={Users} title="Sin datos" />
      ) : (
        <div>...</div>
      )}
    </div>
  );
}
```

Luego añadir la ruta en `App.jsx`:
```jsx
const MiNuevaPagina = lazy(() => import('./modules/leads/pages/MiNuevaPagina'));
// ...
<Route path="/mi-pagina" element={<MiNuevaPagina />} />
```

Y opcionalmente en `Sidebar.jsx > NAV_ITEMS`:
```jsx
{ label: 'Mi pagina', to: '/mi-pagina', icon: Users, module: 'leads' }
```

### Dialog modal

Ver `frontend/src/shared/components/ui/portal.jsx` y ejemplos en `LeadFormDialog`, `ConversionDialog`.

### Subida de archivos

Reusa el patron de `ProfilePage.handleAvatarUpload`:
```jsx
const fd = new FormData();
fd.append('file', file);
const res = await client.post(`/users/${id}/avatar`, fd);  // client detecta FormData
```

## Cosas a vigilar

- Componentes > 400 lineas: candidatos a splittear
- `useEffect` con muchas deps: revisar memo / useCallback
- Llamadas API en bucle (N+1): usar promises paralelas con `Promise.all`
- Re-renders innecesarios: usar `React.memo` en cards de listas largas

## Donde mirar primero

- **Pattern de pagina con datos**: `modules/leads/pages/LeadsPage.jsx`
- **Pattern de dialog con formulario**: `modules/leads/components/LeadFormDialog.jsx`
- **Pattern de upload de archivo**: `shared/pages/ProfilePage.jsx > handleAvatarUpload`
- **Pattern de pagina con tabs**: `modules/settings/pages/SettingsPage.jsx`
- **Pattern de filtros + tabla**: `modules/accounting/pages/IncomePage.jsx`
- **Pattern de KPIs + graficas**: `modules/reports/pages/ReportsPage.jsx`

## Ver tambien

- [CONTRIBUTING.md](CONTRIBUTING.md) — workflow de PRs, checklist
- [../Claude/features/](../Claude/features/) — docs por feature con plan + AC
- [../CLAUDE.md](../CLAUDE.md) — guia general del repo
