import PageHeader from '@/shared/components/ui/PageHeader';
import { Bell, BellRinging, EnvelopeSimple, DeviceMobile, Lightning, CheckCircle, Clock } from '@phosphor-icons/react';

const ROADMAP = [
  {
    title: 'Centro de notificaciones',
    desc: 'Todas las notificaciones agrupadas, con filtros por tipo y proyecto, y botón "Marcar todas leídas".',
    icon: Bell,
    state: 'soon',
  },
  {
    title: 'Notificaciones in-app en tiempo real',
    desc: 'Triggers automáticos cuando se asigna un lead, vence un recordatorio o llega un pago.',
    icon: Lightning,
    state: 'soon',
  },
  {
    title: 'Notificaciones por email (Brevo)',
    desc: 'Resumen diario o instantáneo según la preferencia del usuario.',
    icon: EnvelopeSimple,
    state: 'planned',
  },
  {
    title: 'Push notifications (PWA)',
    desc: 'Avisos en escritorio y móvil aunque la app esté cerrada — usa el service worker existente.',
    icon: DeviceMobile,
    state: 'planned',
  },
];

const STATE_BADGE = {
  soon:    { label: 'Próximamente', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  planned: { label: 'Planificado',  class: 'bg-muted text-muted-foreground' },
  done:    { label: 'Listo',        class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
};

export default function NotificacionesPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Centro de notificaciones"
        subtitle="Todas tus alertas y actualizaciones, en un solo sitio"
      />

      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border rounded-2xl p-6 flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <BellRinging size={28} weight="duotone" className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base">En construcción</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 uppercase tracking-wide">
              Pronto
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            Mientras tanto, la <strong>campana en la barra superior</strong> ya muestra recordatorios vencidos,
            cobros atrasados y leads nuevos derivados de los datos actuales.
          </p>
        </div>
      </div>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-3 px-1">
          Roadmap
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROADMAP.map((item) => {
            const Icon = item.icon;
            const badge = STATE_BADGE[item.state];
            return (
              <article
                key={item.title}
                className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon size={18} weight="duotone" className="text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h4 className="font-semibold text-sm">{item.title}</h4>
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-muted/40 border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Clock size={18} weight="regular" className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Mientras llega...</p>
            <p>
              Si necesitas alertas urgentes, configura un <a href="/crm/email-sequences" className="text-primary font-medium hover:underline">flujo de email</a> o
              revisa periódicamente la campana <Bell size={12} weight="bold" className="inline mx-0.5" /> en la barra superior. La página <a href="/crm/" className="text-primary font-medium hover:underline">Dashboard</a> también
              muestra los pendientes del día y los insights más relevantes.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
