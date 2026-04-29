import { useState } from 'react';
import {
  Users, CurrencyEur, ChartLineUp, TrendUp, Plus, X, Sparkle, FilePdf, WarningCircle,
  Heart, Star, Lock, Bell,
} from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import KpiCard from '@/shared/components/ui/KpiCard';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable, { SkeletonCard } from '@/shared/components/ui/SkeletonTable';
import StatusBadge, { STATUS_KEYS } from '@/shared/components/ui/StatusBadge';
import ChannelBadge, { CHANNEL_LABELS } from '@/shared/components/ui/ChannelBadge';
import ConfirmDialog from '@/shared/components/ui/ConfirmDialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/shared/components/ui/accordion';
import { toast } from '@/shared/hooks/useToast';

const fmtMoney = (n) => `${Math.round(n).toLocaleString('es-ES')} €`;
const fmtNum = (n) => Math.round(n).toLocaleString('es-ES');

function Section({ title, description, children }) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="bg-card border border-border rounded-lg p-4">{children}</div>
    </section>
  );
}

function Demo({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}

export default function DevComponentsPage() {
  const [progress, setProgress] = useState(67);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Catálogo de componentes UI"
        subtitle="Preview visual de los primitivos compartidos. Solo accesible en development."
        actions={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <WarningCircle size={12} weight="bold" /> DEV ONLY
          </span>
        }
      />

      <Section title="PageHeader" description="Cabecera estándar de página (este es un ejemplo en uso aquí mismo).">
        <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">{`<PageHeader title="..." subtitle="..." actions={<button>...</button>} />`}</pre>
      </Section>

      <Section title="KpiCard" description="Tarjeta de KPI con icono, label y valor (animado o estático).">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={Users} label="Total prospectos" numericValue={1234} format={fmtNum} />
          <KpiCard
            icon={CurrencyEur}
            label="Cobrado"
            numericValue={45230}
            format={fmtMoney}
            iconBg="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
            badge="+12%"
            trend="up"
          />
          <KpiCard
            icon={ChartLineUp}
            label="CTR"
            value="3.42%"
            iconBg="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            badge="-0.3%"
            trend="down"
            badgeColor="bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
          />
          <KpiCard
            icon={TrendUp}
            label="Conversiones"
            numericValue={89}
            format={fmtNum}
            iconBg="bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400"
          />
        </div>
      </Section>

      <Section title="StatusBadge" description="Badge canónico para los 6 status de leads. Mapping en StatusBadge.jsx.">
        <div className="flex flex-wrap gap-2">
          {STATUS_KEYS.map((s) => (
            <StatusBadge key={s} status={s} showIcon />
          ))}
        </div>
      </Section>

      <Section title="ChannelBadge" description="Badge para canal de procedencia con icono.">
        <div className="flex flex-wrap gap-2">
          {Object.keys(CHANNEL_LABELS).map((c) => (
            <ChannelBadge key={c} channel={c} showIcon />
          ))}
        </div>
      </Section>

      <Section title="EmptyState" description="Estado vacío para tablas/listas.">
        <EmptyState
          icon={Users}
          title="Sin prospectos"
          description="Aún no hay prospectos en este proyecto. Crea el primero para empezar."
          action={
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-bold">
              <Plus size={14} weight="bold" /> Crear primer prospecto
            </button>
          }
        />
      </Section>

      <Section title="SkeletonTable + SkeletonCard" description="Loaders mientras se traen datos.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Demo label="SkeletonTable rows=4 columns=4">
            <SkeletonTable rows={4} columns={4} />
          </Demo>
          <Demo label="SkeletonCard ×2">
            <div className="grid grid-cols-2 gap-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </Demo>
        </div>
      </Section>

      <Section title="Button (shadcn-like)" description="Primitive de botón con variants y sizes.">
        <div className="space-y-3">
          <Demo label="Variants">
            <div className="flex flex-wrap gap-2">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Demo>
          <Demo label="Sizes">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Like"><Heart size={16} /></Button>
            </div>
          </Demo>
          <Demo label="Con icono">
            <div className="flex flex-wrap gap-2">
              <Button><Plus size={14} weight="bold" className="mr-1.5" /> Nuevo</Button>
              <Button variant="destructive"><X size={14} weight="bold" className="mr-1.5" /> Eliminar</Button>
              <Button variant="outline"><Sparkle size={14} weight="bold" className="mr-1.5" /> Generar IA</Button>
              <Button variant="secondary"><FilePdf size={14} weight="bold" className="mr-1.5" /> Exportar</Button>
            </div>
          </Demo>
        </div>
      </Section>

      <Section title="Badge" description="Badge genérico (shadcn).">
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Accordion" description="Plegable Radix UI.">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>¿Qué es esta página?</AccordionTrigger>
            <AccordionContent>
              Catálogo visual de los componentes UI compartidos. Solo accesible cuando <code>import.meta.env.DEV</code> es <code>true</code>.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>¿Cómo añado un componente nuevo aquí?</AccordionTrigger>
            <AccordionContent>
              Importa el componente, mete una <code>&lt;Section&gt;</code> con sus variantes y un snippet de uso. Mira los existentes como plantilla.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>¿Por qué no aparece en producción?</AccordionTrigger>
            <AccordionContent>
              La ruta está condicionada a <code>import.meta.env.DEV</code> en <code>App.jsx</code>. En el build de producción Vite la elimina del bundle vía dead-code elimination.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title="Progress" description="Barra 0-100.">
        <div className="space-y-3">
          <Progress value={progress} />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setProgress((p) => Math.max(0, p - 10))}>-10</Button>
            <span className="text-sm tabular-nums w-10 text-center">{progress}%</span>
            <Button variant="outline" size="sm" onClick={() => setProgress((p) => Math.min(100, p + 10))}>+10</Button>
          </div>
        </div>
      </Section>

      <Section title="Toast" description="Notificación temporal (vía hook useToast).">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => toast({ title: 'Guardado', description: 'Cambios aplicados correctamente.' })}>
            <Bell size={14} weight="bold" className="mr-1.5" /> Default
          </Button>
          <Button
            variant="outline"
            onClick={() => toast({ title: 'Atención', description: 'El servidor tardó más de lo esperado.', variant: 'warning' })}
          >
            Warning
          </Button>
          <Button
            variant="destructive"
            onClick={() => toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' })}
          >
            Destructive
          </Button>
        </div>
      </Section>

      <Section title="Field (label + input)" description="Patrón canónico de formulario.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted-foreground">Nombre *</span>
            <input
              defaultValue="Juan Pérez"
              className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted-foreground">Email *</span>
            <input
              type="email"
              defaultValue="juan@example.com"
              className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted-foreground">Status</span>
            <select className="mt-1 w-full h-9 px-3 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              {STATUS_KEYS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted-foreground">Notas</span>
            <textarea
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              defaultValue="Lead frío, retomar en 2 semanas"
            />
          </label>
        </div>
      </Section>

      <Section title="Dialog modal" description="Patrón Portal + overlay + card. Confirmación destructiva con ConfirmDialog.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDemoModalOpen(true)}>
            Abrir modal demo
          </Button>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            <X size={14} weight="bold" className="mr-1.5" /> Eliminar (con confirmación)
          </Button>
        </div>

        {demoModalOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setDemoModalOpen(false)}
          >
            <div
              className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between p-5 border-b border-border">
                <h3 className="font-extrabold flex items-center gap-2"><Star size={18} weight="fill" className="text-amber-500" /> Modal de demo</h3>
                <button onClick={() => setDemoModalOpen(false)} aria-label="Cerrar" className="p-1.5 rounded hover:bg-muted">×</button>
              </header>
              <div className="p-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Este modal sigue el patrón documentado en <code>DESIGN_SYSTEM.md §7.2</code>: Portal + overlay con
                  <code>z-[60]</code>, click afuera para cerrar, <code>stopPropagation</code> en el panel,
                  <code>max-h-[90vh]</code> para overflow en móviles.
                </p>
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                  <Lock size={16} weight="bold" className="text-muted-foreground" />
                  <span className="text-xs">No se persiste nada al cerrar este modal.</span>
                </div>
              </div>
              <footer className="p-4 border-t border-border flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setDemoModalOpen(false)}>Cancelar</Button>
                <Button onClick={() => setDemoModalOpen(false)}>OK</Button>
              </footer>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          title="¿Eliminar este registro?"
          message="Esta acción no se puede deshacer."
          confirmLabel="Sí, eliminar"
          tone="destructive"
          onConfirm={() => {
            toast({ title: 'Eliminado', description: '(simulado)' });
            setConfirmOpen(false);
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      </Section>
    </div>
  );
}
