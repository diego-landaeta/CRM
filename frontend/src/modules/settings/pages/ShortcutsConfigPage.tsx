import PageHeader from '@/shared/components/ui/PageHeader';
import { Lightning, Keyboard, MagnifyingGlass, Plus, ArrowSquareOut } from '@phosphor-icons/react';

const PLANNED = [
  {
    icon: Plus,
    title: 'Botón flotante (FAB)',
    desc: 'Acciones rápidas contextuales según la página: + Lead en /leads, + Conversión en /clients, etc.',
  },
  {
    icon: Keyboard,
    title: 'Atajos de teclado personalizables',
    desc: 'Asigna combinaciones a tus acciones más usadas (G + L para ir a leads, N para nuevo prospecto).',
  },
  {
    icon: Lightning,
    title: 'Macros de texto',
    desc: 'Snippets reutilizables para WhatsApp y email — escribe ":bienvenida" y se expande la plantilla.',
  },
];

const EXISTING_SHORTCUTS = [
  { key: ['Ctrl', 'K'], action: 'Abrir buscador / palette' },
  { key: ['Esc'], action: 'Cerrar diálogo o panel' },
  { key: ['Enter'], action: 'Confirmar acción seleccionada' },
];

export default function ShortcutsConfigPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Atajos rápidos"
        subtitle="Personaliza el botón flotante y los atajos de teclado"
      />

      <div className="bg-gradient-to-br from-amber-100/40 via-orange-100/30 to-transparent dark:from-amber-950/20 dark:via-orange-950/20 border border-border rounded-2xl p-6 flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Lightning size={28} weight="duotone" className="text-amber-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base">Pendiente CRM-235</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 uppercase tracking-wide">
              En backlog
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            Mientras tanto puedes abrir el <strong>command palette</strong> con <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-card">Cmd K</kbd> y
            navegar rápido a cualquier sección del CRM.
          </p>
        </div>
      </div>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-3 px-1">
          Atajos disponibles hoy
        </h3>
        <ul className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {EXISTING_SHORTCUTS.map((s) => (
            <li key={s.action} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm">{s.action}</span>
              <span className="flex items-center gap-1">
                {s.key.map((k, i) => (
                  <kbd key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted">
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-3 px-1">
          En el roadmap
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANNED.map((p) => {
            const Icon = p.icon;
            return (
              <article
                key={p.title}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon size={18} weight="duotone" className="text-muted-foreground" />
                </div>
                <h4 className="font-semibold text-sm">{p.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-muted/40 border border-border rounded-xl p-5 flex items-start gap-3">
        <MagnifyingGlass size={18} weight="regular" className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">Tip</p>
          <p>
            El command palette (<kbd className="text-[10px] font-mono px-1 py-0.5 rounded border border-border bg-card">Cmd K</kbd>) ya
            te lleva a cualquier sección en 2 teclas. Pruébalo escribiendo un nombre como &quot;leads&quot;, &quot;cobros&quot; o &quot;reportes&quot;.
          </p>
        </div>
      </section>
    </div>
  );
}
