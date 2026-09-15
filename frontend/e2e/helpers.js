// Helpers compartidos entre tests E2E

export const TEST_USER = {
  email: 'manuel@empresa.com',
  password: 'CrmTemp2026!',
};

/** Hace login y deja la app en /crm/ */
export async function login(page, user = TEST_USER) {
  await page.goto('/crm/login');
  await page.waitForLoadState('networkidle');
  // Esperar a que el form este renderizado (Suspense lazy load)
  await page.getByPlaceholder('nombre@empresa.com').waitFor({ timeout: 10_000 });
  await page.getByPlaceholder('nombre@empresa.com').fill(user.email);
  await page.getByPlaceholder('Tu contraseña').fill(user.password);
  // Con tilde: el boton dice «Iniciar sesión». Sin ella no coincide y el test
  // se quedaba treinta segundos esperando a pulsar algo que no existe.
  await page.getByRole('button', { name: /iniciar sesi[oó]n/i }).click();
  await page.waitForURL(/\/crm\/?$/, { timeout: 10_000 });
}

/**
 * Cambia el proyecto activo via el dropdown custom del sidebar.
 * Antes era un <select> nativo; ahora es un boton + popover (Portal).
 */
export async function switchProject(page, projectId) {
  // Abrir el picker
  await page.getByRole('button', { name: /selector de proyecto/i }).click();
  // Esperar que el listbox aparezca
  const listbox = page.getByRole('listbox', { name: /lista de proyectos/i });
  await listbox.waitFor({ state: 'visible', timeout: 3000 });
  // Click en el option correspondiente
  await listbox.getByRole('option').nth(Number(projectId) - 1).click();
  await page.waitForTimeout(300);
}
