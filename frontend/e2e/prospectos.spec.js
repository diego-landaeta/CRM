import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Prospectos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');
  });

  test('renderiza tabla con columnas Ultimo contacto y Proximo', async ({ page }) => {
    await expect(page.locator('th', { hasText: 'Ultimo contacto' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Proximo' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Acciones' })).toBeVisible();
  });

  test('chips de filtro rapido aparecen con contadores', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Necesitan accion hoy/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Vencidos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Hoy\b/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sin contacto/i })).toBeVisible();
  });

  test('boton Convertir abre dialog inline (no navega al detalle)', async ({ page }) => {
    const convertBtn = page.locator('button[title="Convertir a cliente"]').first();
    await convertBtn.click();
    await expect(page.getByText('Registrar Conversion')).toBeVisible({ timeout: 3_000 });
    expect(page.url()).toMatch(/\/leads(\?|$)/);  // sigue en lista, no detalle
  });

  test('boton Marcar contactado pide confirmacion', async ({ page }) => {
    const btn = page.locator('button[title="Marcar contactado"]').first();
    if (await btn.count() === 0) return; // todos ya estan contactados, skip
    await btn.click();
    await expect(page.getByText(/Vas a marcar a/i)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: /Si, marcar contactado/i })).toBeVisible();
  });

  test('Crear recordatorio abre dialog con presets de tiempo', async ({ page }) => {
    const btn = page.locator('button[title="Programar siguiente contacto"]').first();
    await btn.click();
    await expect(page.getByText('Programar siguiente contacto')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: 'Manana 10am' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'En 3 dias' })).toBeVisible();
  });

  test('Importar CSV abre dialog con upload area', async ({ page }) => {
    await page.getByRole('button', { name: /Configurar/i }).click();
    await page.getByText('Importar desde CSV').click();
    await expect(page.getByText(/Arrastra el CSV/i)).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/Descargar plantilla CSV/i)).toBeVisible();
  });
});
