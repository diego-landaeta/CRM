# Fusionar tu rama con `staging` · para Fabián

Revisado el **2026-09-11**. Diego: «revisa lo de Fabián y dale orden».

## Lo primero: tu trabajo está bien

`integracion/fabian` está **al día con el tronco** (`integracion/todo`): tus 88
commits encima y sin faltarte ni uno. Has trabajado como toca.

**El atasco no era tuyo.** `integracion/todo` lleva parado desde el 7 de
septiembre y `staging` estaba 212 commits por detrás. Y yo me salí del flujo:
trabajé en `release/reportes-empresa` y el 11/09 la subí directamente a
`staging`. Es mi parte de culpa y por eso te escribo la orden yo.

## La buena noticia: son 4 conflictos, no 83

Hicimos la fusión en seco. De los 83 ficheros que tocamos los dos, git resuelve
79 solo. Quedan **cuatro**, y tres de ellos son el mismo cambio duplicado.

## Qué hacer

```bash
git fetch origin
git checkout integracion/fabian
git merge origin/staging
```

Y resolver así, fichero por fichero:

### 1. `backend/src/modules/conversions/conversion.model.js` → **quédate con `staging`**

Tus 40 líneas ahí son el arreglo del «proyecto menos uno». **Es el mismo código
que ya está en staging** —lo escribí yo el 09/09 sobre tu línea, y en la mía
existe con otro hash—. Lo de staging son 428 líneas que lo incluyen: ventas
compartidas, el filtro por gestora vía `conversion_reparto`, la columna
`compartida` y las plazas.

```bash
git checkout --theirs backend/src/modules/conversions/conversion.model.js
```

### 2. `frontend/src/modules/accounting/pages/IncomePage.tsx` → **quédate con `staging`**

Lo mismo, y esta vez es literal: tu bloque y el de staging son **el mismo código
con el mismo comentario**, incluido el `OJO CON EL -1`. Staging tiene además los
atajos de fecha, las seis tarjetas, la lista que distingue venta de cuota, el
reparto por proyecto y los tutoriales.

### 3. `frontend/src/shared/components/layout/Sidebar.jsx` → **quédate con LO TUYO**

Aquí mandas tú: son 197 líneas nuevas y 335 quitadas — el rediseño del menú y
que el proceso comercial cuelgue de Prospectos como submenú.

Lo mío ahí es **cosmético**: renombrar «Lista» por «Lista de prospectos» y
reescribir dos comentarios. Si te gusta el nombre nuevo, lo aplicas encima; si
no, lo descartas. Tú decides.

```bash
git checkout --ours frontend/src/shared/components/layout/Sidebar.jsx
```

### 4. `frontend/src/shared/components/layout/AppLayout.jsx` → **hay que juntar**

Es el único que necesita las dos partes. La lista `CON_SOCIEDAD_OK` dice qué
pantallas se pueden ver con una sociedad elegida en vez de un proyecto. Tiene que
quedar con **las cuatro rutas**:

```js
const CON_SOCIEDAD_OK = [
  /^\/informes$/,
  /^\/ventas$/,
  /^\/finanzas\/ventas$/,
  // Facturacion: el listado ya filtra por issuer_id --la sociedad que emite la
  // factura-- y las ventas sin factura por sus campus.
  /^\/finanzas\/facturas$/,
];
```

## Después de fusionar, comprueba esto

No basta con que compile:

1. **`/prospectos/cola`** — cada fila debe decir la formación y las plazas. Hoy
   dirá «sin plazas configuradas» en ámbar: es correcto, ningún producto las
   tiene rellenas todavía.
2. **La ficha de un prospecto** — tarjeta «Proceso comercial» con el paso que le
   toca. Es nueva, del 11/09.
3. **`/prospectos/proceso`** — tu pantalla de los cinco pasos. Comprueba que
   sigue entera después del merge: los dos hemos tocado ese módulo.
4. **`/finanzas/ventas`** con una empresa elegida — las cifras deben salir, no a
   cero.
5. **El chat, plantillas** — al elegir «Día 2 · Opiniones · 1 de 3» se abre el
   selector de archivos. Es del 11/09.

## Ojo con las migraciones

Las **149 a la 153 ya están aplicadas** en las cuatro bases (producción y
staging de los dos CRMs). No las vuelvas a pasar; son idempotentes, pero no hace
falta. Lo que traen:

| | |
|---|---|
| 149 | búsqueda de tutor por formación |
| 150 | ventas compartidas (`conversion_vendedoras` + vista `conversion_reparto`) |
| 151 | las plantillas del proceso comercial |
| 152 | el día 4 sin CETLAT y el enlace de Opynio |
| 153 | plantillas que piden imagen, y su pista |

## Y cuando esté

```bash
git push origin integracion/fabian
git push origin integracion/fabian:integracion/todo
git push origin integracion/fabian:staging
```

Con eso /testeo vuelve a tener las dos líneas y el flujo recupera su orden:
`feat/*` → `integracion/*` → `integracion/todo` → `staging`.

**Faltan también los 28 commits de Ángel** que están en esa misma línea sin
llegar a staging. Si tu merge los arrastra, mejor; si no, habrá que hacer lo
mismo con los suyos.
