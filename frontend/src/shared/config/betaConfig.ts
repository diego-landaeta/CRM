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
  '/leads',                  // Prospectos (listado, pipeline, audiencias)
  '/clients',                // Clientes
  '/matriculas',             // Matrículas (parte de Clientes)
  '/products',               // Productos
  '/configuracion/categorias-arbol',  // Árbol de categorías (parte de Productos)
  '/woocommerce',            // WC import (parte de Productos)
  '/forms',                  // Captación: Formularios
  '/webhooks',               // Captación: Webhooks
  '/make-webhooks',          // Captación: Make
  '/notificaciones',         // Sistema básico
  '/preferences',            // Mis preferencias
  '/profile',                // Perfil
  '/settings',               // Ajustes (gestión de usuarios, proyectos, etc.)
  '/set-password',           // Flujo de bienvenida
];

export function isBetaAllowed(to?: string): boolean {
  if (!BETA_MODE) return true;
  if (!to) return false;
  if (to === '/') return true;
  return BETA_ROUTES.some((p) => p !== '/' && (to === p || to.startsWith(p + '/')));
}
