import { test, expect } from '@playwright/test';
import { TEST_USER } from './helpers';

// E2E necesita dev server limpio sin sesion previa.
// Correr con: npm run test:e2e (asegurate que no hay localStorage de sesion previa)
test.describe('Auth', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('login con credenciales validas redirige al dashboard', async ({ page }) => {
    await page.goto('/crm/login');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'CRM MultiProyecto' })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/empresa/i).fill(TEST_USER.email);
    await page.getByPlaceholder(/contrasena/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /iniciar sesion/i }).click();
    await page.waitForURL(/\/crm\/?$/, { timeout: 10_000 });
    await expect(page.locator('h1', { hasText: /Dashboard/i })).toBeVisible();
  });

  test('login con credenciales invalidas muestra error', async ({ page }) => {
    await page.goto('/crm/login');
    await page.getByPlaceholder(/empresa/i).fill('fake@empresa.com');
    await page.getByPlaceholder(/contrasena/i).fill('wrong');
    await page.getByRole('button', { name: /iniciar sesion/i }).click();
    await expect(page.locator('text=/credenciales/i').first()).toBeVisible({ timeout: 5_000 });
  });

  test('rutas protegidas redirigen a login si no hay sesion', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/crm/leads');
    await page.waitForURL(/\/login/, { timeout: 5_000 });
  });
});
