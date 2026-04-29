# Contribuir al frontend

Workflow para añadir features sin romper convenciones.

## Antes de empezar

1. **Lee la feature en Jira y su `.md`** en `Claude/features/CRM-XXX-*.md`. Si no existe, creala antes de codear.
2. **Ramas:** trabaja en `feature/<jira-key>-descripcion-corta`. Ejemplo: `feature/CRM-201-leads-pop-up`.
3. **Setup:** `cd frontend && npm install && npm run dev`.

## Workflow de cada feature

### 1. Crear/actualizar el feature .md
- Plan con modelo de datos, endpoints, UI
- Marca el estado como `🚧 En progreso`
- Documenta dependencias con otras features

### 2. Si necesitas backend
- Habla con backend dev (Diego) primero
- Endpoints nuevos o cambios → coordinacion via Jira comments
- NO inventes contratos: si el endpoint no existe aun, espera o stub con mock

### 3. Implementacion frontend

**Antes de escribir codigo:**
- Localiza el modulo correcto en `src/modules/<dominio>/`
- ¿Existe ya una pagina/componente similar? Reusa el pattern
- ¿Necesitas un componente UI nuevo? Mira primero `src/shared/components/ui/README.md`
- ¿TypeScript? El repo soporta JS y TS lado a lado (`allowJs: true`). Mira la sección [TypeScript](#typescript) abajo antes de empezar un módulo nuevo.

**Mientras codeas:**
- Mantén componentes < 400 lineas. Si pasas, splittea
- Extrae logica compleja a un hook custom (`useLeads`, `useReports`)
- Schema Zod para validacion de forms en `<modulo>/validation/`
- Loading state SIEMPRE — usa `<SkeletonTable>` o `EmptyState`
- Error state SIEMPRE — toast + boton retry (con `refetch`, NO `window.location.reload()`)
- Mobile responsive: usa breakpoints `sm:`, `md:`, `lg:`, `xl:`
- Modo oscuro: usa modificadores `dark:`

### 4. Antes de commit

Checklist obligatorio:

- [ ] Lint pasa: el codigo sigue el patron de los archivos vecinos
- [ ] Sin warnings de React en consola al usar la feature
- [ ] La pagina funciona en Psiko Aprende **y** en Psicologo IA (cambio de proyecto en sidebar)
- [ ] Si la feature crea algo nuevo, los KPIs / contadores se actualizan al instante
- [ ] Probada con rol gestor (laura@) y admin (diego@), no solo superadmin
- [ ] Mobile: testeada al menos en 375px width
- [ ] No `console.log` ni codigo comentado quedando
- [ ] No `window.location.reload()` ni `<a href>` interno
- [ ] Toast de exito tras accion + toast de error tras fallo
- [ ] Si trabajaste en `.ts/.tsx`: `npm run typecheck` pasa sin errores

### 5. Commit

Formato: `<tipo>(<jira>): <descripcion>` en español, presente.

```
feat(CRM-201): popup rapido del prospecto en LeadsPage

- Nuevo componente LeadPreviewPopover
- Hook useLeadPreview con cache de 5min
- Reusable en LeadsPage tabla y LeadsPipelinePage cards

Tests manuales OK: hover en lead row muestra popover, click "Ver ficha"
navega a /leads/:id sin recargar.

Co-Authored-By: Tu Nombre <tu@email.com>
```

Tipos: `feat | fix | refactor | docs | chore | test | style`.

### 6. Pull request

- Titulo: `[CRM-XXX] descripcion corta`
- Descripcion: que hace, capturas si es UI, AC checked
- Asigna a Diego para review
- Espera CI verde antes de mergear

## Splittear componentes grandes

Si un componente pasa de **400 lineas**, splittea:

```
LeadDetailPage.jsx (orquestador)
├── components/
│   ├── LeadHeader.jsx
│   ├── LeadInteractionsPanel.jsx
│   ├── LeadConversionsPanel.jsx
│   ├── LeadDocumentsPanel.jsx
│   └── LeadActions.jsx
```

Cada sub-componente recibe los props que necesita, no todo el lead. Así son testeables y reusables.

## Crear un componente UI compartido

Si vas a reusar un componente en 2+ modulos, ponlo en `src/shared/components/ui/`:

```
src/shared/components/ui/
└── MiComponente.jsx
```

Debe ser:
- Sin estado de negocio (recibe data via props)
- Sin llamadas API
- Sin contexto especifico de un modulo
- Documentado en `src/shared/components/ui/README.md`

## Crear un hook compartido

Si vas a reusar logica con state en 2+ modulos, ponlo en `src/shared/hooks/`:

```
src/shared/hooks/useMiHook.js
```

Sigue el pattern de `useDashboard`: retorna `{ data, loading, error, refetch, ...actions }`.

## Convenciones de UI

### Espaciado
- Padding del contenedor de pagina: `space-y-6`
- Cards: `p-5 rounded-2xl border border-border bg-card`
- Spacing entre secciones: `gap-6`
- Botones: `px-4 py-2.5 rounded-xl`

### Colores semánticos
- Primary: acento azul (definido en tailwind.config)
- `text-muted-foreground` para secundario
- `bg-muted/30` para fondos sutiles
- `text-red-500` errores, `text-green-600` success, `text-amber-600` warning

### Tipografia
- Page title: `text-2xl font-extrabold tracking-tight`
- Section title: `text-base font-extrabold tracking-tight`
- Labels: `text-[11px] font-bold uppercase tracking-wider text-muted-foreground`
- Body: default (sin clase)

### Iconos en botones
```jsx
<button className="flex items-center gap-2 ...">
  <Plus size={14} weight="bold" /> Nuevo
</button>
```

## TypeScript

El repo soporta JS y TS coexistiendo (`tsconfig.json` con `allowJs: true`,
`strict: false`, `strictNullChecks: false`). Vite/esbuild transpila ambos sin
configuración extra.

**Cuándo usar TypeScript:**
- Módulos nuevos: empieza directo en `.tsx` para tener tipos desde el inicio.
- Refactors grandes: aprovecha para migrar el módulo completo.
- Bugs sutiles de tipos: si un bug se hubiera evitado con tipos, migra el archivo.

**Cuándo NO migrar todavía:**
- Cambios menores en archivos `.jsx` existentes — déjalo en JS hasta que el módulo entero se migre.
- Hooks utilitarios muy genéricos en `src/shared/hooks/` — espera al pattern del módulo piloto.

**Cómo migrar un módulo:**

1. Renombra archivos con `git mv` para preservar history:
   ```bash
   git mv src/modules/foo/pages/FooPage.jsx src/modules/foo/pages/FooPage.tsx
   ```

2. Importa los tipos compartidos desde `@/shared/types`:
   ```ts
   import type { Lead, Project, Conversion } from '@/shared/types';
   ```

3. Tipa el state principal:
   ```ts
   const [lead, setLead] = useState<Lead | null>(null);
   const [items, setItems] = useState<Conversion[]>([]);
   ```

4. Tipa props de sub-componentes con `interface`:
   ```ts
   interface LeadHeaderProps {
     lead: Lead;
     onReassign: (id: number) => void;
   }
   function LeadHeader({ lead, onReassign }: LeadHeaderProps) { ... }
   ```

5. Run `npm run typecheck` (alias de `tsc --noEmit`) y resuelve errores. Si un componente UI compartido en `.jsx` causa errores por inferencia muy estricta, añade defaults a sus props (`actions = null`, `className = ''`) — ver el patrón ya aplicado en `PageHeader.jsx` y `EmptyState.jsx`.

6. Si la migración completa de un archivo bloquea el progreso, usa `// @ts-nocheck` con un comentario que explique por qué (ej. depende de muchos componentes JSX aún sin migrar). **Esto es excepción, no regla.**

**Tipos disponibles** en `src/shared/types/index.ts`: `Lead`, `LeadStatus`, `LeadOrigen`, `Project`, `ProjectType`, `User`, `UserRole`, `Client`, `Conversion`, `ConversionEstado`, `Interaction`, `Reminder`, `Utms`, `ApiResponse<T>`. Extiende este archivo cuando aparezcan tipos nuevos compartidos por varios módulos.

**Módulo piloto:** [`src/modules/clients/`](src/modules/clients/). Sirve como referencia.

## Anti-patterns

- ❌ Mezclar logica de fetch con render: extrae a un hook
- ❌ Componentes > 400 lineas: splittea
- ❌ Pasar 10+ props: agrupa en object o usa context
- ❌ `useEffect` sin cleanup que crea suscripciones: lleva al memory leak
- ❌ `window.location.reload()`: usa `refetch` del hook
- ❌ Hardcodear URLs base: usa `import.meta.env.BASE_URL`
- ❌ Nombres genericos `Component1`, `Modal`, `Dialog`: nombra por dominio (`LeadFormDialog`)
- ❌ CSS inline: usa Tailwind classes
- ❌ Mostrar errores con `alert()`: usa toast

## Donde pedir ayuda

- Pregunta a Diego (backend lead) en el canal del proyecto
- Lee primero `Claude/features/<tu-feature>.md` y `Claude/documentacion/`
- Mira el commit history (`git log --oneline`) — ahi esta el contexto

## Checklist final antes de mergear

- [ ] El feature `.md` esta actualizado con decisiones reales y se marca ✅
- [ ] Jira issue movido a Done
- [ ] PR aprobado
- [ ] Commit con el Jira key
- [ ] Tests manuales pasan en staging
