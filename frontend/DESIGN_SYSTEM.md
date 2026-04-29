# CRM Design System

Guía visual del CRM MultiProyecto. Tokens vivos en `tailwind.config.js` y `src/index.css`. Este documento es la **convención de uso** — cuándo aplicar qué token y por qué.

> **Para el catálogo de componentes** (KpiCard, EmptyState, StatusBadge…) ver [`src/shared/components/ui/README.md`](src/shared/components/ui/README.md). Este archivo cubre el sistema de diseño base.

---

## 1. Colores

### 1.1 Tokens semánticos (CSS variables)

Definidos en `src/index.css` como HSL. **Usar siempre los tokens semánticos, nunca colores hex hardcodeados** salvo paletas específicas (status, canal, gráficas).

| Token | Light | Dark | Uso |
|---|---|---|---|
| `background` | `0 0% 98%` | `240 10% 4%` | Fondo principal de la app |
| `foreground` | `240 10% 3.9%` | `0 0% 95%` | Texto principal |
| `card` | `0 0% 100%` | `240 10% 6%` | Fondo de tarjetas, dialogs, panels |
| `card-foreground` | `240 10% 3.9%` | `0 0% 95%` | Texto sobre `card` |
| `primary` | `230 75% 55%` | `230 75% 60%` | CTAs, links, focus rings |
| `primary-foreground` | `0 0% 100%` | `0 0% 100%` | Texto sobre `primary` |
| `secondary` / `accent` | `240 5% 96%` | `240 5% 12-14%` | Hovers sutiles, fondos de chips |
| `muted` | `240 5% 96%` | `240 5% 12%` | Fondos discretos (filas alternas, skeletons) |
| `muted-foreground` | `240 4% 46%` | `240 4% 55%` | Texto secundario, labels |
| `destructive` | `0 84% 60%` | `0 72% 51%` | Errores, acciones destructivas |
| `border` / `input` | `240 6% 90%` | `240 6% 15%` | Bordes y bordes de inputs |
| `ring` | igual a `primary` | igual a `primary` | Focus ring (`ring-2 ring-primary/40`) |

**Patrón de uso en JSX:**
```jsx
<div className="bg-card text-foreground border border-border">
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
<p className="text-muted-foreground">subtítulo</p>
```

### 1.2 Paleta de status (leads)

Mapping canónico en `StatusBadge.jsx`. **No inventar nuevos status colors**, ampliar el mapping si hace falta.

| Status | Color base | Tailwind clase |
|---|---|---|
| `nuevo` | blue-600 | `bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400` |
| `por_contactar` | orange-600 | `bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400` |
| `contactado` | emerald-600 | `bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400` |
| `en_seguimiento` | amber-600 | `bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400` |
| `convertido` | violet-600 | `bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400` |
| `no_interesado` | red-600 | `bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400` |

### 1.3 Paleta de tono (success / warning / destructive)

Para badges, banners y KPIs neutros. Patrón `{color}-50 text-{color}-700 dark:bg-{color}-950/30 dark:text-{color}-300`.

| Tono | Color | Uso típico |
|---|---|---|
| `success` | emerald | Cobrado, convertido, OK |
| `warning` / `info` | amber | Pendiente, retraso, aviso |
| `destructive` | red | Error, vencido, eliminar |
| `info-alt` | blue / sky | Cerrado (no destructivo), info neutra |
| `accent-alt` | violet | Convertido, IA, premium |

### 1.4 Paleta de gráficas

Usar **directamente hex** en Recharts (los tokens HSL no se pueden interpolar en strings). Mantener consistencia con la paleta de canal:

```js
const CANAL_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#ef4444', '#94a3b8'];
const PIPELINE_COLORS = {
  nuevo: '#3b82f6',          por_contactar: '#f59e0b',
  contactado: '#10b981',     en_seguimiento: '#eab308',
  convertido: '#8b5cf6',     no_interesado: '#ef4444',
};
```

Líneas de tráfico orgánico vs pago: **orgánico verde `#10b981`**, **pago azul `#3b82f6`**, **leads violeta `#8b5cf6`**.

---

## 2. Tipografía

**Font family**: Plus Jakarta Sans (Tailwind config) con fallback a Inter (cargada en index.css). System fallbacks completos.

```js
// tailwind.config.js
fontFamily: { sans: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'] }
```

### Jerarquía

| Rol | Clase Tailwind | Cuándo |
|---|---|---|
| Page title | `text-xl font-semibold` (en `PageHeader`) | Título de página, una sola vez |
| Section title | `text-lg font-semibold` o `font-bold` | Título de sección dentro de página |
| Card heading | `font-semibold text-sm` o `text-base` | Título dentro de tarjeta |
| Body | `text-sm` | Texto general en tablas, formularios |
| Label | `text-xs font-bold uppercase text-muted-foreground` | Label encima de input, header de tabla |
| Micro | `text-[11px]` o `text-[10px]` | Metadata, fechas, contadores |
| Tabular | añadir `tabular-nums` | Cualquier número en tablas/KPIs |

**Reglas:**
- **No usar** `font-extrabold` salvo dialogs/modal headers.
- KPIs grandes: `text-2xl font-semibold tabular-nums`.
- Labels de formulario: `text-xs font-bold uppercase text-muted-foreground`.
- Truncar siempre que pueda haber overflow: `truncate min-w-0` (en flex hijo).

---

## 3. Spacing

Patrón consistente de gaps. Si dudas, usar `gap-3` y subir/bajar.

| Clase | Px | Cuándo |
|---|---|---|
| `gap-1` / `gap-1.5` | 4-6 | Iconos inline, badges con icono |
| `gap-2` | 8 | Botones de acción agrupados, filtros en barra |
| `gap-3` | 12 | KPI cards en grid, items en lista compacta |
| `gap-4` | 16 | Cards en grid principal, espacio entre sections |
| `gap-5` / `gap-6` | 20-24 | Espaciado entre bloques de página completos |

**Padding interno:**
- Cards: `p-3` (compacto), `p-4` (default), `p-5` (espacioso). Dialogs: `p-5` o `p-6`.
- Tablas: `px-4 py-2.5` (header), `px-4 py-3` (body).
- Inputs: `h-9 px-3` (default), `h-10 px-3` (cómodo).

**Vertical rhythm de página:**
```jsx
<div className="space-y-5 pb-8">
  <PageHeader ... />
  {/* secciones */}
</div>
```

---

## 4. Border radius

| Clase | Px | Cuándo |
|---|---|---|
| `rounded-sm` | 2 | (raro) |
| `rounded` / `rounded-md` | 4-6 | Inputs, botones small, tabs, badges con icono |
| `rounded-lg` | 8 | **Cards**, tarjetas KPI, contenedores principales |
| `rounded-xl` | 10 | Cards destacados, banners |
| `rounded-2xl` | 12 | **Dialogs**, modals, settings panels |
| `rounded-full` | ∞ | Avatars, dots de status, badges píldora |

**Reglas:**
- Cards: `rounded-lg`. Dialogs: `rounded-2xl`. Badges píldora: `rounded-full`.
- Coherente con `tailwind.config.js` que extiende `rounded-{xl,2xl,...}` desde `var(--radius)` (0.5rem).

---

## 5. Sombras

| Clase | Cuándo |
|---|---|
| (sin sombra) | Default — usar `border border-border` en su lugar |
| `shadow-sm` | Cards interactivas en hover, dropdowns abiertos |
| `shadow-lg` | Toasts, popovers críticos |
| `shadow-2xl` | Dialogs grandes (modals con backdrop) |

**Convención:** el CRM usa principalmente **bordes**, no sombras. Sombra solo para indicar elevación temporal (hover, dialog).

---

## 6. Estados interactivos

### Hover

```jsx
className="bg-card hover:border-foreground/20 transition-colors"   // card
className="bg-primary hover:bg-primary/90"                         // botón primario
className="hover:bg-muted/50"                                       // botón sutil
```

Siempre añadir `transition-colors` (o `transition-all duration-200` si hay más cambios).

### Focus

**Obligatorio en todo elemento interactivo** para a11y:

```jsx
className="focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
// o usando el ring del sistema:
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

### Disabled

```jsx
className="disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
```

### Loading

- **Skeletons** preferidos sobre spinners. `<SkeletonTable />` o `animate-pulse bg-muted`.
- Spinner `<CircleNotch className="animate-spin" />` solo para acciones puntuales (export PDF, generar reporte).

---

## 7. Componentes patrón

### 7.1 Page layout

Todas las páginas siguen este esqueleto:

```jsx
import PageHeader from '@/shared/components/ui/PageHeader';

export default function MyPage() {
  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Mi página"
        subtitle="Descripción breve"
        actions={<button>Acción</button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard ... />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <input ... />
        <select ... />
      </div>

      {/* Tabla + variante mobile */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">...</table>
        </div>
        <div className="md:hidden divide-y divide-border">
          {items.map(item => <Card ... />)}
        </div>
      </div>
    </div>
  );
}
```

### 7.2 Dialog modal

```jsx
import Portal from '@/shared/components/ui/portal';

{open && (
  <Portal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-extrabold">Título</h3>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded hover:bg-muted">×</button>
        </header>
        <div className="p-5 space-y-4">{/* contenido */}</div>
        <footer className="p-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-bold">Cancelar</button>
          <button onClick={onSave} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Guardar</button>
        </footer>
      </div>
    </div>
  </Portal>
)}
```

**Convenciones:**
- Z-index: `z-[60]` para dialogs estándar, `z-[70]` para popovers sobre dialogs, `z-[80]+` para toasts.
- Cierre con click en backdrop + `onClick stopPropagation` en el panel.
- `max-h-[90vh] overflow-y-auto` para evitar overflow en móviles.

### 7.3 Form pattern

Sin librería de forms — `useState` + validación inline o Zod si hay reglas complejas.

```jsx
<label className="block">
  <span className="text-xs font-bold uppercase text-muted-foreground">Etiqueta *</span>
  <input
    value={value}
    onChange={(e) => setValue(e.target.value)}
    className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
  />
  {error && <span className="text-xs text-destructive mt-1">{error}</span>}
</label>
```

### 7.4 Filter bar pattern

```jsx
<div className="flex items-center gap-2 flex-wrap">
  <input
    type="search"
    placeholder="Buscar..."
    className="h-9 px-3 rounded-md border border-border bg-card text-sm"
  />
  <select className="h-9 px-3 rounded-md border border-border bg-card text-sm">...</select>
  <button className="ml-auto h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
    Acción
  </button>
</div>
```

### 7.5 Tabla responsive

Patrón obligatorio para tablas (ver CRM-245):

```jsx
{/* Desktop */}
<div className="hidden md:block overflow-x-auto">
  <table className="w-full text-sm">
    <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground">
      <tr><th className="text-left px-4 py-2.5 font-bold">…</th></tr>
    </thead>
    <tbody>
      {rows.map(r => (
        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
          <td className="px-4 py-3">{r.name}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* Mobile */}
<div className="md:hidden space-y-2">
  {rows.map(r => (
    <div key={r.id} className="bg-card border border-border rounded-lg p-3">
      <p className="text-sm font-semibold truncate">{r.name}</p>
      {/* … grid de campos clave … */}
    </div>
  ))}
</div>
```

Si la tabla tiene 7+ columnas, usar `lg:` en lugar de `md:`.

### 7.6 KPI grid

```jsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
  <KpiCard icon={Users} label="Total" numericValue={123} format={fmtNum} />
  <KpiCard icon={CurrencyEur} label="Cobrado" numericValue={4500} format={fmtMoney} tone="success" />
</div>
```

`numericValue` + `format` activa la animación count-up. `value` (string) la desactiva.

---

## 8. Iconografía

### Phosphor Icons

```jsx
import { Users, CurrencyEur, Plus, X, CheckCircle, ChartLineUp } from '@phosphor-icons/react';
```

**Sizes estándar:**

| Size | px | Cuándo |
|---|---|---|
| 10-11 | xs | Inline en badges, micro-metadata |
| 12-14 | sm | Botones small, status badges |
| 14-16 | md | Botones default, headers de sección |
| 18-20 | lg | KPI cards, EmptyState |
| 24-32 | xl | EmptyState principal, errores |

**Weights:**
- `regular` (default): iconos decorativos, labels, inline
- `bold`: dentro de botones primarios, alertas, CTAs
- `fill`: badges activos, status que indican "completo" (CheckCircle fill)

**Reglas:**
- Mismo weight en todos los iconos del mismo cluster (no mezclar `bold` y `regular` en una toolbar).
- Iconos en botones: tamaño coherente con el texto (`size={14}` en botón con `text-sm`).

---

## 9. Dark mode

Soportado en todo el sistema vía `darkMode: ['class']` y `<html class="dark">`. Reglas:

- **Nunca** colores hex/rgb hardcodeados sin `dark:` modifier para fondos/textos.
- Para overlays semitransparentes usar `/30`, `/50`: `dark:bg-emerald-950/30`.
- Las paletas Recharts (#hex) **no** necesitan dark variant — funcionan en ambos modos.
- Probar todo cambio en `class="dark"` antes de commit.

---

## 10. Accesibilidad

Mínimos no negociables en cada componente:

1. **`aria-label`** en botones que solo tienen icono.
2. **`aria-selected`** / `role="tab"` en pestañas.
3. **`aria-live="polite"`** en alertas/toasts.
4. **Focus visible** en cada elemento clicable (`focus:ring-2 focus:ring-primary/40`).
5. **Navegación con teclado**: `tabIndex={0}` + `onKeyDown Enter` para cards clicables.
6. **Contraste** WCAG AA — los tokens semánticos cumplen, las paletas de status también.

---

## 11. Patrones a evitar

- ❌ `<button onClick>` sin `aria-label` cuando solo tiene icono.
- ❌ Colores hardcodeados (`#3b82f6`) en JSX salvo en gráficas Recharts.
- ❌ `style={{...}}` inline salvo para valores dinámicos imposibles en Tailwind.
- ❌ `fixed` sin `z-` explícito.
- ❌ Flex con hijo de texto sin `min-w-0` + `truncate` cuando puede overflowear.
- ❌ Tablas sin variante mobile (CRM-245).
- ❌ `text-extrabold` fuera de modal headers.
- ❌ Mezclar `font-bold` con `font-semibold` en el mismo bloque sin razón.

---

## 12. Cómo extender

Antes de añadir un color, espaciado o radius nuevo:

1. ¿Existe un token semántico que cubre el caso? Úsalo.
2. ¿Es un caso de paleta funcional (status, canal)? Añadirlo al mapping correspondiente.
3. Si es realmente nuevo: extender `tailwind.config.js` con un valor con nombre, **no** añadir clases sueltas en el JSX.

Para un componente nuevo: ver convenciones en [`src/shared/components/ui/README.md`](src/shared/components/ui/README.md#convenciones-para-componentes-nuevos-en-este-folder).
