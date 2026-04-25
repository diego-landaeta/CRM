// Helpers compartidos entre tests E2E

export const TEST_USER = {
  email: 'manuel@empresa.com',
  password: 'CrmTemp2026!',
};

/** Hace login y deja la app en /crm/ */
export async function login(page, user = TEST_USER) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  // Esperar a que el form este renderizado (Suspense lazy load)
  await page.getByPlaceholder('nombre@empresa.com').waitFor({ timeout: 10_000 });
  await page.getByPlaceholder('nombre@empresa.com').fill(user.email);
  await page.getByPlaceholder('Tu contrasena').fill(user.password);
  await page.getByRole('button', { name: /iniciar sesion/i }).click();
  await page.waitForURL(/\/crm\/?$/, { timeout: 10_000 });
}

/** Cambia el proyecto activo via el select del sidebar */
export async function switchProject(page, projectId) {
  const select = page.locator('select').first();
  await select.selectOption(String(projectId));
  await page.waitForTimeout(500);
}
