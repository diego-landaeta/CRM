import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, Books, GraduationCap, PlugsConnected } from '@phosphor-icons/react';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import KpiCard from '@/shared/components/ui/KpiCard';
import Card from '@/shared/components/ui/Card';
import { toast } from '@/shared/hooks/useToast';
import { moodleApi, type CampusMoodle } from '../api/moodle.api';
import ListaDeCampus from '../components/ListaDeCampus';

/**
 * Conexión → Moodle (#335): los campus y si cada uno tiene su Moodle conectado.
 *
 * Es solo la puerta de entrada: cada fila lleva a la pantalla del campus
 * (`/conexion/moodle/:id`), donde están sus cursos. Los campus y los cursos son cosas
 * distintas y cada una tiene su pantalla.
 */
export default function MoodlePage() {
  const [campus, setCampus] = useState<CampusMoodle[] | null>(null);
  const [actualizando, setActualizando] = useState(false);

  const cargar = useCallback(async (refrescar = false) => {
    setActualizando(true);
    try {
      const r = await moodleApi.campus({ refrescar });
      setCampus((r.data as { campus: CampusMoodle[] }).campus);
    } catch (e) {
      setCampus([]);
      toast({ title: 'No se pudo cargar Moodle', description: (e as Error).message, variant: 'destructive' });
    } finally { setActualizando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cifras = useMemo(() => {
    const conectados = (campus ?? []).filter((c) => c.configurado);
    return {
      campus: campus?.length ?? 0,
      conectados: conectados.length,
      activos: conectados.reduce((n, c) => n + (c.cursos?.activos ?? 0), 0),
      total: conectados.reduce((n, c) => n + (c.cursos?.total ?? 0), 0),
    };
  }, [campus]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Moodle"
        subtitle="El Moodle de cada campus · solo lectura"
        actions={(
          <button
            type="button"
            onClick={() => cargar(true)}
            disabled={actualizando}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <ArrowsClockwise size={15} weight="bold" className={actualizando ? 'animate-spin' : undefined} /> Actualizar
          </button>
        )}
      />

      {campus === null ? (
        <SkeletonTable rows={5} columns={4} />
      ) : campus.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No tienes campus asignados" description="Cuando tengas un campus, aquí verás su Moodle." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard icon={PlugsConnected} label="Campus con Moodle conectado" value={`${cifras.conectados} de ${cifras.campus}`} />
            <KpiCard icon={GraduationCap} label="Cursos activos" value={String(cifras.activos)} />
            <KpiCard icon={Books} label="Cursos en total" value={String(cifras.total)} />
          </div>
          <Card padding="none" overflowHidden>
            <ListaDeCampus campus={campus} />
          </Card>
        </>
      )}
    </div>
  );
}
