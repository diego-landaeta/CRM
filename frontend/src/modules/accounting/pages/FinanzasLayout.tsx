import { useProjectContext } from '@/contexts/ProjectContext';
import { Outlet } from 'react-router-dom';
import {
  Calculator, ChartBar, Receipt, TrendDown, GraduationCap,
  Wallet, HandCoins, CurrencyEur, PlugsConnected, WarningCircle, CreditCard,
} from '@phosphor-icons/react';
import SubNav from '@/shared/components/ui/SubNav';
import BetaDisclaimer from '@/shared/components/ui/BetaDisclaimer';

const TABS = [
  { label: 'Dashboard', to: '/finanzas', icon: ChartBar },
  // «Ventas» e «Ingresos» ERAN LA MISMA PANTALLA (#43).
  //
  // Las dos rutas montaban `IncomePage`; lo único que cambiaba era el título.
  // Dos pestañas al lado que abren lo mismo hacen dudar de si enseñan cosas
  // distintas, y se acaba comparando una cifra consigo misma. Se queda
  // «Ventas», que es lo que la pantalla lista, y `/finanzas/ingresos` redirige
  // —los enlaces guardados siguen funcionando—.
  { label: 'Ventas', to: '/finanzas/ventas', icon: Receipt },
  { label: 'Análisis de ventas', to: '/finanzas/ventas-analisis', icon: ChartBar },
  { label: 'Conversiones', to: '/finanzas/conversiones', icon: CurrencyEur },
  { label: 'Egresos', to: '/finanzas/egresos', icon: TrendDown },
  { label: 'Por cobrar', to: '/finanzas/por-cobrar', icon: Wallet },
  { label: 'Por pagar', to: '/finanzas/por-pagar', icon: Receipt },
  { label: 'Comisiones', to: '/finanzas/comisiones', icon: HandCoins },
  { label: 'Nóminas', to: '/finanzas/nominas', icon: Calculator },
  { label: 'Pendientes facturar', to: '/finanzas/pendiente-facturar', icon: WarningCircle },
  // Al lado de «pendientes de facturar» porque es su pariente: cosas cobradas
  // a las que les falta un dato para poder cerrarse (#41).
  { label: 'Sin formación', to: '/finanzas/ventas-sin-formacion', icon: GraduationCap },
  { label: 'Pagos Stripe', to: '/finanzas/pagos-stripe', icon: CreditCard },
  { label: 'Facturas', to: '/finanzas/facturas', icon: Receipt },
  { label: 'Integraciones', to: '/finanzas/integraciones', icon: PlugsConnected },
];

/**
 * Las pestañas de un proyecto IA son OTRAS (#44).
 *
 * Un proyecto IA no tiene egresos, ni nóminas, ni comisiones, ni cuentas por
 * pagar: cobra suscripciones. De las quince pestañas, once no pueden tener
 * contenido nunca — y con once vacías no se encuentran las cuatro que sí.
 *
 * Es el mismo recorte que ya hace el menú lateral. Se repite aquí porque son
 * dos barras distintas: esconder una y dejar la otra es lo que hacía que el
 * menú dijera cinco cosas y la pantalla siguiera enseñando quince.
 */
const EN_IA = new Set([
  '/finanzas',
  '/finanzas/ventas',
  '/finanzas/pagos-stripe',
  '/finanzas/facturas',
  '/finanzas/integraciones',
]);

export default function FinanzasLayout() {
  const { activeProject } = useProjectContext() as { activeProject: { type?: string } | null };
  const tabs = activeProject?.type === 'ia'
    ? TABS.filter((t) => EN_IA.has(t.to))
    : TABS;

  return (
    <div className="flex flex-col h-full">
      <SubNav tabs={tabs} sectionLabel="Finanzas" sectionIcon={Calculator} />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
