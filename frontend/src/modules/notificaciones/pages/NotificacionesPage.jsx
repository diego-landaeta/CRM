import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import { Bell } from '@phosphor-icons/react';

export default function NotificacionesPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Notificaciones"
        subtitle="Gestión de notificaciones push"
      />
      <div className="mt-8">
        <EmptyState
          icon={Bell}
          title="Notificaciones push — En desarrollo"
          description="Próximamente podrás configurar y enviar notificaciones push a los usuarios del CRM. Pendiente de implementación."
        />
      </div>
    </div>
  );
}
