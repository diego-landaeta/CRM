import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WarningCircle, UserMinus, ClockCountdown } from '@phosphor-icons/react';
import client from '@/shared/api/client';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ponerAmbito } from '@/shared/lib/ambitoInforme';
import { mesEnCurso } from '@/modules/reports/components/ComoVoy';
import { Acta, CampoActa } from '@/shared/components/ui/Acta';

/**
 * LAS CIFRAS DE HOY (#534, parte 5). Lo primero del Dashboard: cuatro cifras
 * con su nombre y su recuento, y dos alertas que llevan a Prospectos filtrado.
 *
 * Cada cifra dice qué cuenta. «Cobrado» y «Facturado» no son lo mismo (#534,
 * parte 1), así que van en tarjetas distintas y cada una con su número al lado:
 * lo cobrado con cuántos cobros, lo facturado con cuántas ventas facturadas,
 * las ventas nuevas con lo vendido.
 *
 * DE DÓNDE SALE CADA UNA, sin contar nada aquí:
 *   · Cobrado y ventas nuevas: `/informes/mi-puesto`, lo mismo que «El equipo
 *     este mes». A quien manda, el total del equipo con «Sin gestora»; a una
 *     gestora, lo suyo.
 *   · Facturado: `/ventas/facturado`, lo mismo que «Productos vendidos · Mes».
 *     Solo a quien manda, como el ranking por lo facturado.
 *   · Prospectos y las dos alertas: `/leads/stats` y `/leads/today`, que ya pide
 *     el Dashboard. Cada alerta usa en el servidor la misma condición que el
 *     filtro de la lista a la que lleva, así que la cifra y la lista cuadran.
 */

export interface CifrasDeHoyProps {
  /** De `/leads/stats` (ya normalizado). */
  stats: { sin_asignar?: number } | null;
  /** De `/leads/today`. */
  today: { nuevos_hoy?: number; nuevos_mes?: number; inactivos?: number } | null;
}

interface Cifras { cobrado: number; cobros: number; ventas: number; vendido: number }

const euros = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    .format(Number(n || 0));
const numero = (n: number) => new Intl.NumberFormat('es-ES').format(Number(n || 0));
const cuantos = (n: number, uno: string, varios: string) => `${numero(n)} ${Number(n) === 1 ? uno : varios}`;

function Tarjeta({ titulo, cifra, detalle, ayuda }: { titulo: string; cifra: string; detalle: string; ayuda: string }) {
  // Rediseño (20/11): una celda del acta de Hoy.
  return <CampoActa etiqueta={titulo} valor={cifra} detalle={detalle} title={ayuda} />;
}

function Alerta({ icono: Icono, cifra, texto, ayuda, onClick }: {
  icono: typeof WarningCircle; cifra: number; texto: string; ayuda: string; onClick: () => void;
}) {
  const hay = cifra > 0;
  // Una celda más del acta, pulsable: abre Prospectos con el filtro puesto.
  return (
    <CampoActa
      icon={Icono}
      etiqueta={texto}
      valor={numero(cifra)}
      detalle="Abrir la lista"
      tono={hay ? 'aviso' : 'neutro'}
      title={ayuda}
      onClick={onClick}
    />
  );
}

export default function CifrasDeHoy({ stats, today }: CifrasDeHoyProps) {
  const navigate = useNavigate();
  const { activeProject, activeIssuerId } = useProjectContext();
  const [mes, setMes] = useState<Cifras | null>(null);
  const [facturado, setFacturado] = useState<{ facturado: number; ventas: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    const p = ponerAmbito(new URLSearchParams(), { activeIssuerId, activeProject });
    client.get(`/informes/mi-puesto?${p.toString()}`)
      .then((r: any) => {
        if (!vivo || !r?.success) return;
        const d = r.data;
        // Quien manda: el total (con «Sin gestora»). Una gestora: lo suyo.
        const fuente = d?.total || d;
        setMes({
          cobrado: Number(fuente?.cobrado || 0),
          cobros: Number(fuente?.cobros || 0),
          ventas: Number(fuente?.ventas || 0),
          vendido: Number(fuente?.vendido || 0),
        });
        if (Array.isArray(d?.tabla)) {
          const f = ponerAmbito(new URLSearchParams(), { activeIssuerId, activeProject });
          const m = mesEnCurso();
          f.set('from', m.from); f.set('to', m.to);
          client.get(`/ventas/facturado?${f.toString()}`)
            .then((x: any) => { if (vivo && x?.success) setFacturado(x.data.total); })
            .catch(() => { /* sin la tarjeta Facturado */ });
        }
      })
      // Sin ruido: si falla, las tarjetas de dinero no salen y el resto sí.
      .catch(() => { if (vivo) setMes(null); });
    return () => { vivo = false; setFacturado(null); };
  }, [activeProject?.id, activeIssuerId]);

  return (
    <Acta etiqueta="Las cifras de hoy" min={140}>
      {mes && (
        <Tarjeta
          titulo="Cobrado"
          cifra={euros(mes.cobrado)}
          detalle={`${cuantos(mes.cobros, 'cobro', 'cobros')} · este mes`}
          ayuda="Los pagos registrados este mes, por su fecha de cobro."
        />
      )}
      {facturado && (
        <Tarjeta
          titulo="Facturado"
          cifra={euros(facturado.facturado)}
          detalle={`${cuantos(facturado.ventas, 'venta facturada', 'ventas facturadas')} · este mes`}
          ayuda="Facturas y abonos emitidos este mes, por su fecha de factura."
        />
      )}
      {mes && (
        <Tarjeta
          titulo="Ventas nuevas"
          cifra={numero(mes.ventas)}
          detalle={`${euros(mes.vendido)} vendidos · este mes`}
          ayuda="Ventas cerradas este mes, por su fecha de venta."
        />
      )}
      <Tarjeta
        titulo="Prospectos nuevos"
        cifra={numero(today?.nuevos_mes || 0)}
        detalle={`este mes · ${numero(today?.nuevos_hoy || 0)} hoy`}
        ayuda="Prospectos entrados este mes, por su fecha de solicitud."
      />
        <Alerta
          icono={UserMinus}
          cifra={Number(stats?.sin_asignar || 0)}
          texto="sin gestora"
          ayuda="Prospectos abiertos que no lleva nadie. Abre la lista con ellos."
          onClick={() => navigate('/prospectos?qf=sin-gestora')}
        />
        <Alerta
          icono={ClockCountdown}
          cifra={Number(today?.inactivos || 0)}
          texto="sin actividad"
          ayuda="Prospectos abiertos sin moverse más días que la alerta de su campus. Abre la lista con ellos."
          onClick={() => navigate('/prospectos?qf=sin-actividad')}
        />
    </Acta>
  );
}
