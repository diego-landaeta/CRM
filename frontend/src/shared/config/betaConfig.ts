// ============================================================
// BETA 1.0.1 — Allowlist de rutas visibles
// ============================================================
// En producción solo deben funcionar:
//   - Prospectos
//   - Captación (Webhooks + Forms + Mailhook)
//   - Clientes
//   - Productos
//
// El resto del sidebar se muestra deshabilitado con badge "Próximamente".
// Se activa con VITE_BETA_MODE=true (lo pone el build de producción).
// ============================================================

export const BETA_VERSION = '1.0.1';

export const BETA_MODE: boolean = String(import.meta.env.VITE_BETA_MODE || '').toLowerCase() === 'true';

// Rutas (prefijos `to=`) que están operativas en BETA 1.0.1.
// Cualquier `to` que empiece por uno de estos prefijos se considera activo.
export const BETA_ROUTES: readonly string[] = [
  '/',                       // Dashboard
  '/prospectos',             // Prospectos (listado, pipeline, audiencias)
  '/clientes',               // Clientes + Matrículas
  '/finanzas',               // Finanzas completo: dashboard, ventas, ingresos, conversiones,
                             // egresos, por-cobrar, por-pagar, comisiones, nóminas, integraciones
  '/ventas',                  // Ventas (ruta alternativa)
  '/meta-ads',               // Meta Ads (metricas + ROI manual)
  '/informes',                // Análisis › Reportes (overview + descargables prospectos/ventas)
  '/productos',              // Productos (catálogo, árbol, pendientes, woocommerce)
  '/captacion',              // Captación: Formularios, Webhooks, Make
  '/whatsapp',               // WhatsApp: cola, plantillas y el panel del equipo
  '/tutores',                // Tutores: alta, colaboraciones y comisiones
  '/mis-cursos',             // La pantalla del propio tutor
  '/secuencias-email',         // Email de seguimiento
  '/documentos',              // Documentos comerciales
  '/solicitudes-cambio',     // RFC — Solicitud de Cambio (todos los roles)
  '/soporte',                // Soporte: ya tiene backend (#38)
  '/notificaciones',         // Sistema básico
  // Terminadas y escondidas: sus issues estan CERRADOS y las pantallas
  // funcionan con datos de verdad, pero nadie las añadio aqui, asi que en
  // produccion salian como «Proximamente» y no se podian abrir. Es lo mismo
  // que le paso al panel de ventas, que estuvo seis semanas sin que lo viera
  // nadie.
  '/correos',                // La bandeja del CRM (#146, cerrado el 16/09)
  '/registro',               // Todo lo que ha pasado (#111, cerrado el 15/09)
  '/manual',                 // Manual de usuario
  '/preferencias',            // Mis preferencias
  '/perfil',                // Perfil
  '/configuracion',               // Ajustes (gestión de usuarios, proyectos, etc.)
  '/set-password',           // Flujo de bienvenida
];

export function isBetaAllowed(to?: string): boolean {
  if (!BETA_MODE) return true;
  if (!to) return false;
  if (to === '/') return true;
  return BETA_ROUTES.some((p) => p !== '/' && (to === p || to.startsWith(p + '/')));
}
