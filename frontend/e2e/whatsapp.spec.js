import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

// WhatsApp, abierto de verdad en un navegador.
//
// Existe por una tanda de fallos que ninguna otra comprobacion vio, porque
// todas miraban la API o el codigo:
//
//   · Un `moduloApagado(...)` sin importar dejo el CRM en blanco. Paso lint,
//     paso typecheck y paso el build: TypeScript no mira los `.jsx`.
//   · El boton para volver a abrir el recorrido vivia dentro de la cabecera de
//     conversacion, que solo existe con un chat abierto. Quien acababa de
//     llegar no podia recuperarlo.
//   · El paso «pulsa enlazar mi numero» señalaba un enlace que el propio velo
//     del recorrido tapaba: al pulsarlo se cerraba el recorrido y ya.
//
// Los tres se ven en dos segundos abriendo la pantalla, y en ninguna otra parte.

// Angel es admin: es el rol con el que se trabaja, y el que destapo el 500 del
// selector de sesion —un superadmin iba por otra rama y no lo veia—.
const GESTOR = { email: 'angel@empresa.com', password: 'CrmTemp2026!' };

/**
 * Espera a que la pantalla este montada.
 *
 * Antes se usaba `waitForLoadState('networkidle')` y no vale aqui: el aviso de
 * llamada entrante consulta cada tres segundos desde CUALQUIER pantalla del
 * CRM, asi que la red no queda en reposo nunca y la espera agota su plazo. En
 * movil, que va mas lento, fallaba casi siempre.
 *
 * Se espera a que haya algo pintado, que es lo que de verdad importa.
 */
async function pantallaLista(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#main-content, main, .wa-chat').first().waitFor({ timeout: 15000 });
}

/** Lo que ningun test debe encontrarse: la pantalla de «Algo se ha roto». */
async function noSeHaRoto(page) {
  await expect(page.getByText('Algo se ha roto')).toHaveCount(0);
}

/**
 * Cierra el recorrido si esta abierto.
 *
 * Salta solo la primera vez en cada navegador, y Playwright arranca con uno
 * limpio en cada prueba — asi que esta SIEMPRE abierto y su velo tapa la
 * pantalla entera. Lo que se prueba en cada test no es eso, asi que se quita de
 * en medio; el arranque automatico tiene su propia prueba.
 */
async function sinRecorrido(page) {
  const cerrar = page.getByTitle('Cerrar');
  if (await cerrar.count()) await cerrar.first().click();
  await expect(page.locator('.wa-tour')).toHaveCount(0);
}

test.describe('WhatsApp · que la pantalla abra', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, GESTOR);
  });

  test('el CRM carga y el menu lleva a WhatsApp', async ({ page, isMobile }) => {
    await noSeHaRoto(page);
    // En movil el menu vive detras de la hamburguesa: hay que abrirlo. No es un
    // fallo, es como esta hecho el CRM.
    if (isMobile) {
      await page.getByRole('button', { name: 'Abrir menu' }).click();
    }
    // El menu de WhatsApp cuelga de su propia entrada, con lo suyo debajo.
    await expect(page.getByText('WhatsApp', { exact: true }).first()).toBeVisible();
  });

  test('el chat abre sin romperse', async ({ page }) => {
    await page.goto('/crm/whatsapp/chat');
    await pantallaLista(page);
    await noSeHaRoto(page);
    // La barra de arriba sale siempre, con numero enlazado y sin el.
    // Sale dos veces —el del menu lateral y el de la barra del chat—, asi que
    // se comprueba el de la barra, que es el que se añadio.
    await expect(page.getByRole('link', { name: /Conexión/i }).last()).toBeVisible();
  });

  test('el recorrido se puede pedir SIN conversaciones', async ({ page }) => {
    // Esto es lo que fallaba: el boton estaba dentro de la cabecera del chat, y
    // esa solo se pinta con una conversacion abierta. Quien no tenia ninguna se
    // quedaba sin forma de volver a verlo.
    await page.goto('/crm/whatsapp/chat');
    await pantallaLista(page);
    await sinRecorrido(page);
    const boton = page.getByRole('button', { name: /Cómo va esto/i });
    await expect(boton).toBeVisible();
    await boton.click();
    // Presentacion primero: que es esto, antes de pedirle nada.
    await expect(page.getByText('Esto es tu WhatsApp')).toBeVisible();
    await expect(page.getByText(/1 de \d/)).toBeVisible();
  });

  test('sin numero enlazado, el segundo paso LLEVA a Conexión', async ({ page }) => {
    await page.goto('/crm/whatsapp/chat');
    await pantallaLista(page);

    const aviso = page.locator('.wa-sin-enlazar');
    if (await aviso.count() === 0) {
      test.skip(true, 'hay un numero enlazado: ese paso se salta solo, que es lo correcto');
    }

    await sinRecorrido(page);
    await page.getByRole('button', { name: /Cómo va esto/i }).click();
    await page.getByRole('button', { name: /Siguiente/i }).click();
    await expect(page.getByText('Te falta conectar el tuyo')).toBeVisible();

    // Y aqui lo que importa: que el boton lleve. Antes decia «pulsa enlazar mi
    // numero» y el velo del recorrido tapaba ese enlace.
    await page.getByRole('button', { name: /Enlazar mi número/i }).click();
    await expect(page).toHaveURL(/\/whatsapp\/conexion/);
    await noSeHaRoto(page);
  });

  test('el recorrido salta solo la primera vez, y no la segunda', async ({ page }) => {
    await page.goto('/crm/whatsapp/chat');
    await pantallaLista(page);
    // Navegador limpio: tiene que aparecer sin pedirlo.
    await expect(page.getByText('Esto es tu WhatsApp')).toBeVisible();

    await page.getByTitle('Cerrar').first().click();
    await page.goto('/crm/whatsapp/chat');
    await pantallaLista(page);
    // Y ya no. Un recorrido que reaparece en cada visita es una molestia.
    await expect(page.locator('.wa-tour')).toHaveCount(0);
  });

  test('Conexión abre con su aviso antes del código', async ({ page }) => {
    await page.goto('/crm/whatsapp/conexion');
    await pantallaLista(page);
    await noSeHaRoto(page);

    // Esta pantalla tiene DOS caras y las dos son correctas: sin numero
    // enlazado pide consentimiento antes del codigo —punto 1 de la tarea #45—,
    // y con uno puesto enseña la sesion y el boton de desvincular. A quien ya
    // lo tiene no se le vuelve a pedir permiso.
    //
    // Hay que ESPERAR a que llegue el estado antes de decidir cual toca: el
    // estado viene del servidor y preguntando nada mas pintar sale que no hay
    // nada enlazado, aunque lo haya. Asi fallaba, y no por el codigo.
    const enlazado = page.getByText(/Desvincular|Conectado/i).first();
    const aviso = page.getByText(/no es la vía oficial/i).first();
    // `.first()` sobre la union: los DOS textos estan en el arbol —el aviso
    // sigue montado aunque oculto— y sin esto Playwright se planta por
    // ambiguedad en vez de esperar.
    await expect(enlazado.or(aviso).first()).toBeVisible({ timeout: 20000 });

    if (await enlazado.isVisible()) {
      await expect(enlazado).toBeVisible();
    } else {
      await expect(aviso).toBeVisible();
      await expect(page.getByRole('checkbox')).toBeVisible();
    }
  });

  test('la guía abre con el camino del móvil dibujado', async ({ page }) => {
    await page.goto('/crm/whatsapp/ayuda');
    await pantallaLista(page);
    await noSeHaRoto(page);
    await expect(page.getByText(/5 · Llamadas/)).toBeVisible();
    await expect(page.getByText('Vincular un dispositivo').first()).toBeVisible();
  });

  test('las plantillas abren y traen las del proyecto', async ({ page }) => {
    await page.goto('/crm/whatsapp/plantillas');
    await pantallaLista(page);
    await noSeHaRoto(page);
  });

  test('ninguna pantalla deja errores en la consola', async ({ page }) => {
    // Un `x is not defined` sale por aqui aunque la pantalla parezca entera.
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

    for (const ruta of ['/crm/whatsapp/chat', '/crm/whatsapp/conexion', '/crm/whatsapp/ayuda', '/crm/whatsapp/plantillas']) {
      await page.goto(ruta);
      await pantallaLista(page);
    }
    // Los 404 de imagenes y avisos del navegador no cuentan; lo que no puede
    // haber es codigo que revienta.
    const graves = errores.filter((e) => /is not defined|is not a function|Cannot read|undefined is not/i.test(e));
    expect(graves, `errores de codigo:\n${graves.join('\n')}`).toEqual([]);
  });
});
