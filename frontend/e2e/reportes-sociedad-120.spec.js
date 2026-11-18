// Reportes por sociedad: que el encabezado del selector se pueda pulsar (#120).
//
// Con la API simulada. Lo que se comprueba es lo que pidió Carlos: elegir CEDIA
// y que el CRM le pida al servidor la sociedad entera —`issuerId`— en vez de un
// proyecto suelto, y que se note en qué estado estás.
import { test, expect } from '@playwright/test';
import { ir, API_GLOB } from './helpers';

const CEDIA = 3;
const ICTESS = 5;
const VACIA = 9;

const PROYECTOS = [
  { id: 1, nombre: 'ISEIH', slug: 'iseih', type: 'crm', active: true, modules: null, sociedad_emisora_id: CEDIA, sociedad_nombre: 'CEDIA INVESTIGACIÓN Y DESARROLLO SL' },
  { id: 2, nombre: 'Psiko Aprende', slug: 'psiko', type: 'crm', active: true, modules: null, sociedad_emisora_id: CEDIA, sociedad_nombre: 'CEDIA INVESTIGACIÓN Y DESARROLLO SL' },
  { id: 3, nombre: 'Fono Aprende', slug: 'fono', type: 'crm', active: true, modules: null, sociedad_emisora_id: CEDIA, sociedad_nombre: 'CEDIA INVESTIGACIÓN Y DESARROLLO SL' },
  { id: 4, nombre: 'ISAEG', slug: 'isaeg', type: 'crm', active: true, modules: null, sociedad_emisora_id: CEDIA, sociedad_nombre: 'CEDIA INVESTIGACIÓN Y DESARROLLO SL' },
  { id: 5, nombre: 'ISSLOGG', slug: 'iss', type: 'crm', active: true, modules: null, sociedad_emisora_id: CEDIA, sociedad_nombre: 'CEDIA INVESTIGACIÓN Y DESARROLLO SL' },
  { id: 6, nombre: 'ISECD', slug: 'isecd', type: 'crm', active: true, modules: null, sociedad_emisora_id: CEDIA, sociedad_nombre: 'CEDIA INVESTIGACIÓN Y DESARROLLO SL' },
  { id: 7, nombre: 'ICTESS Uno', slug: 'ict1', type: 'crm', active: true, modules: null, sociedad_emisora_id: ICTESS, sociedad_nombre: 'ICTESS INGENIERÍA E INNOVACIÓN SL' },
  { id: 8, nombre: 'ICTESS Dos', slug: 'ict2', type: 'crm', active: true, modules: null, sociedad_emisora_id: ICTESS, sociedad_nombre: 'ICTESS INGENIERÍA E INNOVACIÓN SL' },
  { id: 9, nombre: 'Marca suelta', slug: 'suelta', type: 'crm', active: true, modules: null, sociedad_emisora_id: null, sociedad_nombre: null },
];

const USER = { id: 1, nombre: 'Manuel Casas', email: 'm@e.l', role: 'superadmin' };

const OVERVIEW = {
  leads: { total: 120, nuevo: 30, por_contactar: 20, contactado: 25, en_seguimiento: 25, convertido: 15, no_interesado: 5 },
  tasa_conversion: 12.5,
  conversions: { cobrado: 45000, por_cobrar: 12000 },
  ingresos_mensuales: [],
};

/** Deja escrito con qué ámbito se pidió cada informe. */
function espia() {
  return { peticiones: [] };
}

async function simular(page, { registro = null, proyectos = PROYECTOS } = {}) {
  const j = (b) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  await page.route(API_GLOB, (r) => {
    const url = new URL(r.request().url());
    const ruta = url.pathname.replace(/^.*\/api/, '');
    if (ruta === '/auth/refresh') return r.fulfill(j({ success: true, data: { accessToken: 't' } }));
    if (ruta === '/auth/me') {
      return r.fulfill(j({ success: true, data: { user: USER, permissions: {}, view: {}, projects: proyectos } }));
    }
    if (ruta.startsWith('/informes/')) {
      if (registro) {
        registro.peticiones.push({
          endpoint: ruta,
          issuerId: url.searchParams.get('issuerId'),
          projectId: url.searchParams.get('projectId'),
        });
      }
      if (ruta === '/informes/overview') return r.fulfill(j({ success: true, data: OVERVIEW }));
      return r.fulfill(j({ success: true, data: [] }));
    }
    return r.fulfill(j({ success: true, data: [], stats: {}, pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } }));
  });
}

const selector = (page) => page.getByRole('button', { name: /selector de proyecto/i });
const lista = (page) => page.getByRole('listbox', { name: /lista de proyectos/i });

test.describe('reportes por sociedad (#120)', () => {
  test('el encabezado de la sociedad se puede pulsar', async ({ page }) => {
    // Antes era letra muerta: se leia y no se podia elegir.
    await simular(page);
    await ir(page, '/informes');
    await selector(page).click();
    const cabecera = lista(page).getByRole('button', { name: /CEDIA INVESTIGACI/i });
    await expect(cabecera).toBeVisible();
    await expect(cabecera).toBeEnabled();
  });

  test('dice cuantos campus tiene cada sociedad', async ({ page }) => {
    await simular(page);
    await ir(page, '/informes');
    await selector(page).click();
    await expect(lista(page).getByRole('button', { name: /CEDIA INVESTIGACI/i })).toContainText('6 campus');
    await expect(lista(page).getByRole('button', { name: /ICTESS INGENIER/i })).toContainText('2 campus');
  });

  test('«Sin sociedad» no se puede pulsar: no hay nada que sumar', async ({ page }) => {
    await simular(page);
    await ir(page, '/informes');
    await selector(page).click();
    await expect(lista(page).getByRole('button', { name: /sin sociedad/i })).toHaveCount(0);
    await expect(lista(page).getByText('Sin sociedad')).toBeVisible();
  });

  test('al elegir una sociedad se pide issuerId, NO projectId', async ({ page }) => {
    // Es el corazon de la peticion de Carlos: «seleccionar CEDIA y que se
    // vuelquen todos los datos de todos los campus asociados».
    const registro = espia();
    await simular(page, { registro });
    await ir(page, '/informes');
    await selector(page).click();
    await lista(page).getByRole('button', { name: /CEDIA INVESTIGACI/i }).click();

    await expect.poll(() => registro.peticiones.some((p) => p.issuerId === String(CEDIA))).toBe(true);
    const conSociedad = registro.peticiones.filter((p) => p.issuerId === String(CEDIA));
    for (const p of conSociedad) expect(p.projectId).toBeNull();
  });

  test('la cabecera dice en que estado estas, con la cuenta a la vista', async ({ page }) => {
    await simular(page);
    await ir(page, '/informes');
    await selector(page).click();
    await lista(page).getByRole('button', { name: /CEDIA INVESTIGACI/i }).click();
    // El nombre se recorta si es largo; la cuenta no puede, que es lo que
    // distingue «CEDIA» de «CEDIA entera».
    await expect(selector(page)).toContainText('6 campus');
    await expect(selector(page)).toContainText('CEDIA');
  });

  test('el informe se titula por lo que enseña, no por otra cosa', async ({ page }) => {
    await simular(page);
    await ir(page, '/informes');
    await selector(page).click();
    await lista(page).getByRole('button', { name: /CEDIA INVESTIGACI/i }).click();
    const cabecera = page.locator('header.sticky').first();
    await expect(cabecera).not.toContainText('Todos los proyectos');
    await expect(page.locator('#main-content')).toContainText('CEDIA');
  });

  test('volver a un campus suelto sale del modo sociedad', async ({ page }) => {
    const registro = espia();
    await simular(page, { registro });
    await ir(page, '/informes');
    await selector(page).click();
    await lista(page).getByRole('button', { name: /CEDIA INVESTIGACI/i }).click();
    await expect(selector(page)).toContainText('6 campus');

    await selector(page).click();
    await lista(page).getByRole('option', { name: 'ISEIH' }).click();
    await expect(selector(page)).not.toContainText('campus');

    // Y lo que se pide vuelve a ser un proyecto, sin arrastrar la sociedad.
    await expect.poll(() => registro.peticiones.some((p) => p.projectId === '1')).toBe(true);
    const ultimas = registro.peticiones.slice(-3);
    for (const p of ultimas) expect(p.issuerId).toBeNull();
  });

  test('una sociedad sin campus lo dice, en vez de una tabla vacia', async ({ page }) => {
    // El informe sale vacio a proposito; sin decirlo parece una averia.
    const soloUno = [
      { ...PROYECTOS[0], id: 1, sociedad_emisora_id: VACIA, sociedad_nombre: 'SOCIEDAD SIN CAMPUS SL' },
    ];
    await simular(page, { proyectos: soloUno });
    await ir(page, '/informes');
    await selector(page).click();
    await lista(page).getByRole('button', { name: /SOCIEDAD SIN CAMPUS/i }).click();
    // Se le quita el unico campus: la sociedad sigue elegida y se queda sin nada.
    await page.evaluate(() => window.localStorage.setItem('crm_active_issuer_id', '999'));
    await page.reload();
    await expect(page.locator('#main-content')).toContainText(/no tiene campus asignados|elige un proyecto/i);
  });

  test('con una sociedad elegida, Reportes NO pide elegir un proyecto', async ({ page }) => {
    // Reportes exigia un proyecto concreto: con «todos» salia el aviso de
    // «elige un proyecto». Con una sociedad tiene que funcionar.
    await simular(page);
    await ir(page, '/informes');
    await selector(page).click();
    await lista(page).getByRole('button', { name: /CEDIA INVESTIGACI/i }).click();
    await expect(page.locator('#main-content')).not.toContainText(/elige un proyecto/i);
    await expect(page.locator('#main-content')).toContainText('Total prospectos');
  });
});
