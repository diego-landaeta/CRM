# Catalogo de componentes UI compartidos

Componentes en `src/shared/components/ui/`. Reusalos en vez de reinventar.

## Indice

| Componente | Uso |
|---|---|
| [PageHeader](#pageheader) | Titulo + subtitulo + acciones de cualquier pagina |
| [KpiCard](#kpicard) | Tarjeta con metrica grande (icono + label + value) |
| [EmptyState](#emptystate) | Estado vacio con icono + mensaje + CTA opcional |
| [SkeletonTable](#skeletontable) | Loading skeleton para tablas |
| [StatusBadge](#statusbadge) | Badge para status de leads (nuevo, convertido, etc) |
| [ChannelBadge](#channelbadge) | Badge para canal (google_ads, meta_ads, etc) |
| [Portal](#portal) | Render en portal raiz (para dialogs y popovers) |
| [Button](#button) | Boton primitivo (shadcn-like) |
| [Badge](#badge) | Badge generico |
| [Accordion](#accordion) | Acordeon plegable |
| [Progress](#progress) | Barra de progreso |

---

## PageHeader

Header estandar para cualquier pagina. Titulo + subtitulo + slot de acciones a la derecha.

```jsx
import PageHeader from '@/shared/components/ui/PageHeader';

<PageHeader
  title="Leads"
  subtitle="12 leads activos en Psiko Aprende"
  actions={
    <button onClick={...} className="...">
      <Plus size={14} weight="bold" /> Nuevo
    </button>
  }
/>
```

Props: `title` (string), `subtitle` (string|node), `actions` (node).

## KpiCard

Tarjeta de KPI con icono + label + value + tono opcional.

```jsx
import KpiCard from '@/shared/components/ui/KpiCard';
import { CurrencyEur } from '@phosphor-icons/react';

<KpiCard
  icon={CurrencyEur}
  label="Cobrado"
  value="12,450 €"
  tone="success"          // success | warning | destructive | default
/>
```

Tipico en grids: `<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{kpis.map(...)}</div>`.

## EmptyState

Para tablas/listas vacias.

```jsx
import EmptyState from '@/shared/components/ui/EmptyState';
import { Users } from '@phosphor-icons/react';

<EmptyState
  icon={Users}
  title="Sin leads"
  description="Aun no hay leads en este proyecto"
  action={<button onClick={...}>Crear primer lead</button>}
/>
```

Props: `icon` (Phosphor component), `title` (string), `description` (string), `action` (node optional).

## SkeletonTable

Skeleton de tabla mientras carga.

```jsx
import SkeletonTable from '@/shared/components/ui/SkeletonTable';

if (loading) return <SkeletonTable rows={5} cols={4} />;
```

## StatusBadge

Badge para status de leads. Mapping de colores incluido.

```jsx
import StatusBadge, { STATUS_LABELS } from '@/shared/components/ui/StatusBadge';

<StatusBadge status="convertido" />   // o nuevo, por_contactar, contactado, en_seguimiento, no_interesado

// Acceder labels:
STATUS_LABELS.convertido  // 'Convertido'
```

## ChannelBadge

Badge para canal con icono. Ej Google Ads → icono Google.

```jsx
import ChannelBadge from '@/shared/components/ui/ChannelBadge';

<ChannelBadge channel="google_ads" showIcon />   // 'directo', 'meta_ads', 'google_ads', 'tiktok_ads', 'organico', 'referido', 'chatgpt_ia'
```

## Portal

Renderiza children fuera del flujo del DOM (en `document.body`). Usar para dialogs, dropdowns, tooltips que deben estar por encima de todo.

```jsx
import Portal from '@/shared/components/ui/portal';

{isOpen && (
  <Portal>
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl p-6">
        {/* contenido del dialog */}
      </div>
    </div>
  </Portal>
)}
```

## Button

Primitive de boton estilo shadcn. Reemplazable por `<button className="...">` directo si solo es un boton.

```jsx
import { Button } from '@/shared/components/ui/button';
<Button variant="default|secondary|ghost|destructive|outline" size="sm|md|lg">Click</Button>
```

## Badge

Badge generico.

```jsx
import { Badge } from '@/shared/components/ui/badge';
<Badge variant="default|secondary|destructive|outline">Texto</Badge>
```

## Accordion

Acordeon plegable (Radix UI bajo el capó).

```jsx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/shared/components/ui/accordion';

<Accordion type="single" collapsible>
  <AccordionItem value="a">
    <AccordionTrigger>Titulo</AccordionTrigger>
    <AccordionContent>Contenido</AccordionContent>
  </AccordionItem>
</Accordion>
```

## Progress

Barra de progreso 0-100.

```jsx
import { Progress } from '@/shared/components/ui/progress';
<Progress value={67} />
```

---

## Convenciones para componentes nuevos en este folder

Si vas a añadir un componente UI compartido:

1. **Nombre PascalCase** (`MiComponente.jsx`)
2. **Export default** del componente
3. **Sin estado de negocio** (recibe data via props)
4. **Sin llamadas API**
5. **Documentar props** en este README (al menos: nombre, tipo, descripcion)
6. **Tipos via PropTypes o JSDoc** opcional pero recomendado
7. **Modo oscuro funcional** con modificadores `dark:`
8. **Accesibilidad basica**: aria-labels, focus visible, navegable con teclado

Ejemplo plantilla:

```jsx
// src/shared/components/ui/MiComponente.jsx
import { CaretDown } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

export default function MiComponente({ label, variant = 'default', onClick, children }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border p-3',
        variant === 'success' && 'bg-emerald-50 dark:bg-emerald-950/30',
        variant === 'warning' && 'bg-amber-50 dark:bg-amber-950/30'
      )}
    >
      {label && <p className="text-xs font-bold">{label}</p>}
      {children}
    </div>
  );
}
```
