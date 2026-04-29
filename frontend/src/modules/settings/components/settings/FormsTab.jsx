import { Suspense, lazy } from 'react';

const FormsPageEmbed = lazy(() => import('@/modules/forms/pages/FormsPage'));

export default function FormsTab() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>}>
      <FormsPageEmbed />
    </Suspense>
  );
}
