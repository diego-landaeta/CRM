import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    // El origen A SECAS, sin el /crm.
    //
    // Estaba puesto como `http://localhost:5173/crm` y los tests hacen
    // `goto('/login')`. Una ruta que empieza por barra reemplaza el camino
    // entero, asi que se pedia `/login` — y Vite sirve el CRM bajo `/crm/`, o
    // sea 404. Los tres tests que ya habia llevaban cayendo por eso.
    //
    // Con el origen solo, las rutas de los tests llevan `/crm/...` y significan
    // lo que parece que significan.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: process.env.CI ? {
    command: 'npm run dev',
    url: 'http://localhost:5173/crm/',
    reuseExistingServer: false,
    timeout: 60_000,
  } : undefined,
});
