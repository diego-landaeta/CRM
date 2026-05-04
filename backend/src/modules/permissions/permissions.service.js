import * as model from './permissions.model.js';
import { SYSTEM_ROLE_DEFAULTS, ALL_RESOURCES } from './permissions.defaults.js';

// Resuelve si un usuario tiene permiso para resource.action
// Orden de prioridad: superadmin → override personal → custom_role.permissions → SYSTEM_ROLE_DEFAULTS
export async function resolvePermission(userId, role, customRoleId, resource, action) {
  if (role === 'superadmin') return true;

  const key = `${resource}.${action}`;

  // 1. Override personal (máxima prioridad)
  const overrides = await model.getOverridesByUser(userId);
  const override = overrides.find(o => o.resource === resource && o.action === action);
  if (override !== undefined) return override.allowed;

  // 2. Rol custom
  if (customRoleId) {
    const customRole = await model.findCustomRoleById(customRoleId);
    if (customRole && key in customRole.permissions) {
      return customRole.permissions[key];
    }
    // Si el custom role no define este permiso, cae al base_role
    const baseRole = customRole?.base_role || 'gestor';
    return SYSTEM_ROLE_DEFAULTS[baseRole]?.[key] ?? false;
  }

  // 3. Rol fijo del sistema
  return SYSTEM_ROLE_DEFAULTS[role]?.[key] ?? false;
}

// Calcula el mapa completo de permisos para un usuario (para devolver en /auth/me)
export async function buildPermissionsMap(userId, role, customRoleId) {
  if (role === 'superadmin') {
    const all = {};
    for (const [resource, actions] of Object.entries(ALL_RESOURCES)) {
      for (const action of actions) all[`${resource}.${action}`] = true;
    }
    return all;
  }

  // Base: defaults del rol fijo (o del base_role del custom role)
  let baseRole = role;
  let customPermissions = {};

  if (customRoleId) {
    const customRole = await model.findCustomRoleById(customRoleId);
    if (customRole) {
      baseRole = customRole.base_role || 'gestor';
      customPermissions = customRole.permissions || {};
    }
  }

  const base = { ...(SYSTEM_ROLE_DEFAULTS[baseRole] || SYSTEM_ROLE_DEFAULTS.gestor) };

  // Aplicar overrides del custom role
  const merged = { ...base, ...customPermissions };

  // Aplicar overrides personales del usuario (máxima prioridad)
  const overrides = await model.getOverridesByUser(userId);
  for (const { resource, action, allowed } of overrides) {
    merged[`${resource}.${action}`] = allowed;
  }

  return merged;
}

export async function listCustomRoles() {
  return model.findAllCustomRoles();
}

export async function createCustomRole(data) {
  return model.createCustomRole(data);
}

export async function updateCustomRole(id, data) {
  return model.updateCustomRole(id, data);
}

export async function deleteCustomRole(id) {
  return model.deleteCustomRole(id);
}

export async function getUserPermissions(userId) {
  return model.getOverridesByUser(userId);
}

export async function saveUserPermissions(userId, overrides) {
  return model.saveOverridesForUser(userId, overrides);
}

export function getSystemDefaults() {
  return {
    resources: ALL_RESOURCES,
    roles: {
      superadmin: '(acceso total)',
      admin: SYSTEM_ROLE_DEFAULTS.admin,
      gestor: SYSTEM_ROLE_DEFAULTS.gestor,
      soporte: SYSTEM_ROLE_DEFAULTS.soporte,
    },
  };
}
