import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sidebar tiene todas las secciones nuevas (CRM-101..121)', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Prospectos' })).toBeVisible();
    await expect(page.getByText('Trafico organico')).toBeVisible();
    await expect(page.getByText('Dashboard IA')).toBeVisible();
    await expect(page.getByText('Reportes IA')).toBeVisible();
    // Campanas como grupo expandible
    await page.getByText('Campanas').click();
    await expect(page.getByText('Consolidado')).toBeVisible();
    await expect(page.getByText('Meta Ads')).toBeVisible();
    await expect(page.getByText('Google Ads')).toBeVisible();
  });

  test('navegacion a /campaigns/meta funciona', async ({ page }) => {
    await page.getByText('Campanas').click();
    await page.getByText('Meta Ads').click();
    await page.waitForURL(/\/campaigns\/meta/);
    await expect(page.locator('h1', { hasText: /Meta Ads/i })).toBeVisible();
  });

  test('navegacion a /seo funciona y muestra banner GSC', async ({ page }) => {
    await page.getByText('Trafico organico').click();
    await page.waitForURL(/\/seo/);
    await expect(page.getByText(/retraso de 2-3 dias/i)).toBeVisible();
  });

  test('command palette (Cmd+K) abre y busca', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder(/buscar/i)).toBeVisible();
    await page.keyboard.type('reportes');
    await expect(page.getByText('Reportes IA')).toBeVisible();
  });
});
