# Auditoría del área Finanzas — CRM ISEIE y CRM ISEIH

**Fecha:** 28 de julio de 2026
**Alcance:** los 12 módulos del menú Finanzas en ambos CRMs
**Método:** revisión de código (frontend, backend y migraciones) contrastada con datos reales de producción
**Estado:** ningún cambio aplicado — este documento es solo el diagnóstico

---

## 1. Resumen ejecutivo

De los 12 módulos de Finanzas, **solo uno está bien resuelto**: Facturación. Es el único con
paginación real y un juego de filtros completo, y debe servir de patrón para el resto.

Los cuatro problemas de mayor impacto son:

1. **Egresos está roto en ISEIE** — la página crashea al abrirse. En ISEIH funciona.
2. **Las métricas de producto son falsas** — "servicio académico" aparece como el producto
   más vendido, y en ISEIH pueden aparecer incluso nombres de clientes como productos.
3. **El Dashboard de Finanzas no muestra datos** a buena parte de los usuarios.
4. **Varios totales que se muestran son incorrectos**, no solo incompletos: se calculan
   sobre páginas truncadas de 20, 50, 100 o 200 filas.

El punto 4 es el más delicado del conjunto: **hay cifras en pantalla que no son ciertas**,
y a simple vista no hay forma de saberlo.

---

## 2. Estado comparado de los dos CRMs

| Hallazgo | ISEIE | ISEIH |
|---|---|---|
| Egresos crashea | **Sí** | No (funciona) |
| "Servicio académico" como top producto | Sí | Sí |
| Nombres de clientes como producto | No detectado | **Sí** |
| Dashboard vacío | Sí | Sí |
| Totales sobre datos truncados | Sí | **Sí, peor** (Egresos: 20 filas) |
| Fechas ocultan deudas sin vencimiento | Sí | Sí |
| IVA 21 % inventado | Sí | Sí |
| Enlaces a rutas inexistentes | Sí (`/finanzas/*`) | Sí (`/accounting/*`) |
| Comprobantes de egresos no se abren | — | **Sí** |
| Gating por `installation_bundles` | No aplica | **Sí aplica** |

**Nota de paridad:** en contabilidad, **ISEIH va por delante de ISEIE**. Aquí la paridad se
resuelve portando de ISEIH hacia ISEIE, al revés de lo habitual.

---

## 3. Problemas críticos

### 3.1 Egresos crashea en ISEIE

**Qué pasa:** la página no llega a montarse.

`ExpensesPage.tsx:2,421` importa `MANUAL_CATEGORIES`, `AUTO_CATEGORIES` y
`accountingApi.uploadComprobante`, que **no existen** en el `accounting.api.ts` de ISEIE
(68 líneas). El de ISEIH sí los tiene (116 líneas). Al resolver a `undefined`, la
construcción `ALL_CATEGORIAS = [...undefined]` lanza un TypeError.

El backend también está atrasado: no existe la ruta `POST /accounting/expenses/upload-comprobante`,
y `expense.validation.js:3` no acepta las categorías `comision_pasarela_pago`,
`comision_gestor` ni `nomina` → error 400 al guardar.

**Solución:** portar de ISEIH a ISEIE:
- `accounting.api.ts` completo (categorías, `uploadComprobante`, campos `comprobante_*`)
- Rutas `accounting.routes.js:21-22` (subir y descargar comprobante)
- Controller `accounting.controller.js:100-147` + borrado de fichero en `deleteExpense`
- `expense.validation.js:4-15` (categorías nuevas + forma del comprobante)
- `accounting.model.js:7-32,76-80`
- Migración `082_epic_b_expenses_extensions.sql` — **corregir su atomicidad antes** (ver 5.3)

---

### 3.2 Las métricas de producto son falsas

**Qué pasa:** el ranking de productos más vendidos agrupa por el campo de **texto libre**
`conversions.producto_contratado`, no por el producto del catálogo.

Como toda factura automática escribe el concepto fijo
`"Producto/servicio: servicio académico, <programa>"` (`invoices.model.js:610,732`), ese
texto se lleva el primer puesto del ranking.

Dos daños distintos:
- **`sales.service.js:181,190`** — hace `COALESCE(p.nombre, c.producto_contratado, …)` pero
  incluye el texto libre en el `GROUP BY`, así que **un mismo curso se fragmenta en varias
  filas** según cómo esté escrito.
- **`report.model.js:71,79`** — agrupa **solo** por el texto libre, sin ningún respaldo del catálogo.

**Agravante exclusivo de ISEIH:** `sales.service.js:106` rellena `producto_contratado` con
**el nombre del lead** cuando no hay producto. Si el lookup del catálogo no resuelve
(`conversion.service.js:32-52` deja el id en NULL si es ambiguo), el ranking acaba mostrando
**nombres de personas como productos**.

**Dónde se ve:** Ingresos, Ventas, Dashboard principal y Reportes.

**Solución:** agrupar por `producto_contratado_id` → `products.nombre`, con un cubo
"Sin catalogar" para los NULL. El patrón correcto ya existe en `invoices.model.js:577-583`
(`nombrePrograma`), escrito precisamente porque *"el texto libre a veces trae mal cargado el nombre"*.

**Ojo con el orden:** la migración 080 intentó rellenar `producto_contratado_id` cruzando por
nombre, pero **nunca casa** con textos que empiezan por "Producto/servicio: …". Habrá que
medir cuántas ventas tienen el id relleno antes de cambiar el agrupamiento, o el ranking
quedará casi entero en "Sin catalogar".

---

### 3.3 El Dashboard de Finanzas no muestra datos

Tres causas concurrentes, por orden de probabilidad:

1. **Permisos.** `accounting.routes.js:10` y `report.routes.js:7` exigen `admin` o
   `superadmin`. Cualquier otro rol recibe un 403, y `AccountingDashboardPage.tsx:85`
   hace `if (!data) return null` → **pantalla en blanco, sin ningún mensaje de error**.
2. **Origen de los datos.** Los ingresos y la gráfica de evolución salen exclusivamente de
   `conversion_payments` (`accounting.model.js:97,155`). Si un cobro se registró como cuota
   sin generar su pago, **no cuenta**.
3. **Rango por defecto.** Del 1 de enero del año en curso a hoy
   (`AccountingDashboardPage.tsx:34-35`): lo anterior no aparece.

**Descartado:** no es el gating por bundles. En ISEIE no aplica (`bundles/manifest.js:6-9`).
En ISEIH sí aplica, pero afectaría con un 404, no con una pantalla vacía.

**Solución:** mostrar el error en vez de una pantalla muda, revisar el roleGuard (¿debe un
gestor ver el dashboard?), y decidir si los ingresos deben leerse también de las cuotas.

---

### 3.4 Totales calculados sobre datos truncados

Las cifras mostradas **no son correctas**:

| Dónde | Límite | Consecuencia |
|---|---|---|
| Ingresos (`IncomePage.tsx:62-66`) | 100 filas | KPIs infravalorados |
| Ventas (`SalesPage.jsx:98`) | 200 filas | totales de la vista falsos |
| Dashboard, "Total pendiente" (`accounting.model.js:146`) | `LIMIT 50` | cifra truncada si hay más de 50 impagos |
| Egresos ISEIH (`expense.validation.js:43`) | **20 por defecto** | "Total" sobre 20 filas |

En Egresos de ISEIH el desajuste es visible: **el CSV exportado y la pantalla no cuadran**,
porque el export sí pagina y la pantalla no.

**Solución:** que los totales vengan calculados del backend sobre el conjunto completo, no
sumados en el navegador sobre la página cargada.

---

## 4. Problemas importantes

### 4.1 Filtrar por fechas oculta deudas
`accounting.model.js:218-221` (ISEIE) / `:239-242,280` (ISEIH): en Cuentas por cobrar los
filtros de fecha se aplican sobre `vence`, que admite nulos. Al poner un rango, **las deudas
sin fecha de compromiso desaparecen sin avisar**.

### 4.2 IVA del 21 % inventado
`IncomePage.tsx:66`: si falta `iva_importe` estima un 21 %. Pero los servicios académicos se
facturan **exentos** (`invoices.model.js:726` fuerza IVA 0), con lo cual `iva_importe` es 0,
se considera "vacío" y **se inventa un IVA que no existe**.

### 4.3 Comprobantes de egresos inaccesibles (solo ISEIH)
El enlace del comprobante (`ExpensesPage.tsx:251,302,530`) es una navegación normal del
navegador hacia una ruta protegida con `Authorization: Bearer`. El navegador no envía esa
cabecera → **401 siempre**. Los comprobantes se suben pero no se pueden ver.

### 4.4 Enlaces a rutas que no existen
- **ISEIE:** `FinanzasLayout.tsx:10-22` apunta a `/finanzas/*`, que no existe en su `App.jsx` → 404.
- **ISEIH:** el buscador rápido (`CommandPalette.jsx:59-64`), las acciones rápidas
  (`AppLayout.jsx:69-70,80`) y las notificaciones (`NotificationsBell.jsx:92`) apuntan a
  `/accounting/*`, que ahí no existe.

### 4.5 El menú no conoce los bundles (solo ISEIH)
`Sidebar.jsx:199,203` filtra por roles y módulos del proyecto, pero **nunca por
`active_bundles`**. Con un bundle apagado las pestañas se siguen viendo y las páginas revientan
con 404 en vez de ocultarse. Además `app.js:159-161` cae a "registrar todo" si la consulta de
bundles falla — degradación silenciosa.

### 4.6 Faltan filtros de fecha
En Ventas, Ingresos, Conversiones, Egresos, Cuentas por pagar y Pendientes de facturar.
En Egresos es especialmente absurdo: **el backend ya los soporta** (`accounting.model.js:36-37`),
solo falta la interfaz.

---

## 5. Problemas menores

1. `accounting.api.ts:30-42` — el tipo no refleja la respuesta real del backend.
2. `accounting.api.ts:4-5` — categorías desalineadas con el ENUM de `005_expenses.sql`.
3. **Migración 082 no atómica** — hace `COMMIT` en la línea 13 antes del `ALTER TYPE` y abre
   un `BEGIN` nuevo. Si falla el segundo bloque quedan los valores del enum sin sus columnas.
   **Corregir antes de portarla a ISEIE.**
4. `accounting.model.js:144,158,167` — manipulan SQL con `.replace()`; hay un `replace('$1','$1')`
   que no hace nada.
5. `invoices.model.js:324` — interpola `limit`/`offset` en el SQL en vez de parametrizarlos.
6. `IncomePage.tsx:59` — el filtro de curso usa el texto libre (mismo defecto que 3.2).
7. Cuentas por cobrar devuelve **todas** las filas sin límite (`accounting.model.js:258`).
8. Dashboard: la tarjeta de cuentas por cobrar **ignora el rango de fechas** que sí aplican
   los demás KPIs → no cuadra con el resto de la pantalla.

---

## 6. Filtros y paginación por módulo

| Módulo | Fechas | Proyecto | Gestora | Estado | Búsqueda | Paginación |
|---|---|---|---|---|---|---|
| Dashboard | Sí | contexto | No | — | — | — |
| Ventas | **No** | contexto | Sí | Sí | Sí | **No** (200) |
| Ingresos | **No** | contexto | Sí | No | No | **No** (100) |
| Conversiones | **No** | contexto | No | No | No | **No** (100) |
| Egresos | **No** | contexto | — | — | No | **No** (20) |
| Cuentas por cobrar | Sí | Sí | Sí | vencidas | No | **No** (todo) |
| Cuentas por pagar | **No** | contexto | — | Sí | No | **No** |
| Comisiones | parcial | contexto | Sí | No | No | **No** |
| Nóminas | año/mes | Sí | No | No | No | **No** |
| Pendientes de facturar | **No** | contexto | No | No | No | **No** (100) |
| **Facturación** | **Sí** | **Sí** | emisora | **Sí** | **Sí** | **Sí** |
| Pagos Stripe | Sí | contexto | — | Sí | Sí | **No** (100) |

---

## 7. Lo que sí está bien

- **Facturación** — único módulo con paginación real y filtros completos: búsqueda por
  número, nombre, NIF y código; sociedad emisora; proyecto; estado; fechas; y pestañas por
  tipo. **Es el patrón a replicar en el resto de Finanzas.**
- **Cuentas por cobrar** — el mejor juego de filtros del área (proyecto, gestora, fechas,
  solo vencidas, vista lista y calendario). Le falta paginación.
- **Pagos Stripe** — buenos filtros, sin paginación.
- No se encontró ningún uso de `req.user.id` en lugar de `req.user.userId` en toda el área.

---

## 8. Plan de trabajo propuesto

| Orden | Trabajo | Por qué primero |
|---|---|---|
| 1 | Arreglar Egresos en ISEIE portando desde ISEIH | Hay una pantalla que no abre |
| 2 | Ranking de productos por catálogo | Las métricas de negocio son falsas |
| 3 | Dashboard de Finanzas | Módulo principal sin datos |
| 4 | Paginación y totales reales | Hay cifras incorrectas en pantalla |
| 5 | Filtros que faltan | Usabilidad diaria |

Cada bloque, en los dos CRMs, con simulación previa antes de tocar datos.

**Estimación:** entre 3 y 5 sesiones de trabajo para dejar Finanzas cerrado en ambos.

---

## 9. Advertencia de método

Varias de las cifras que hoy se muestran en Finanzas **son incorrectas**, no solo
incompletas. Conviene no tomar decisiones de negocio con los totales de Ingresos, Ventas,
Egresos ni con la tarjeta de "Total pendiente" del Dashboard **hasta corregir el punto 3.4**.

Los datos de **Facturación** sí son fiables: ese módulo pagina y totaliza correctamente.
