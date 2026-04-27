import PageHeader from '@/shared/components/ui/PageHeader';
import { Headset, EnvelopeSimple, ArrowRight } from '@phosphor-icons/react';

export default function SoportePage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Soporte"
        subtitle="Canal de atención y resolución de incidencias"
      />

      <div className="max-w-xl mx-auto mt-8">
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Headset size={32} weight="duotone" className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Soporte via Brevo — Próximamente</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Pronto podrás contactar con el equipo de soporte directamente desde el CRM.
              El canal estará integrado con Brevo para gestión de tickets y seguimiento de incidencias.
            </p>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border text-left">
            <EnvelopeSimple size={20} className="text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Soporte provisional</p>
              <p className="text-sm font-medium truncate">soporte@iseih.com</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tiempo de respuesta habitual: 24-48h laborables
          </p>
        </div>
      </div>
    </div>
  );
}
