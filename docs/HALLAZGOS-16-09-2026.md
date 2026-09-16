# Hallazgos del 16/09/2026

Cosas encontradas de paso, trabajando el **#130** y el **#37**. Ninguna se
buscaba: todas salieron al tirar del hilo de otra cosa.

**Casi ninguna es de Ángel.** La columna «quién» está para eso — para saber a
quién preguntar antes de tocar nada, no para señalar. Lo que lleva 🔴 afecta a
datos personales y no debería esperar a la próxima reunión.

| | Qué | Issue | Quién |
|---|---|---|---|
| 🔴 1 | Documentos de identidad accesibles sin contraseña | #109 (cerrado) | esos2dev-oss · 25/04 |
| 🟠 2 | Matrículas: el listado no recortaba por rol | #109 (cerrado) | esos2dev-oss · 25/04 |
| 🟠 3 | Bundle `reports` que ninguna migración activa | #130 · sin issue | esos2dev-oss · 25/04 |
| 🟡 4 | `/registro` y `/correos` fuera de la lista beta | #111 · #146 | esos2dev-oss · 20/08 |
| 🟡 5 | No hay `.env.production`: el modo beta lo decide la máquina | #24 | — |
| 🟡 6 | `CRM_BASE_URL` sin documentar, y siete correos dependen | #37 | nadie la añadió |
| 🟡 7 | `webhook_mode`: el servidor lo entiende, la pantalla no existe | #18 (cerrado) | esos2dev-oss · 09/05 |
| ⚪ 8 | El #139 ya está hecho en `staging` | #139 | — |
| ⚪ 9 | 230 commits en `staging` sin desplegar | #24 | — |
| ⚪ 10 | Una prueba falla en cualquier instalación limpia | sin issue | — |
| 🟠 11 | Tres pantallas de «Ventas», y la mejor sin enlazar | #100 · #43 | esos2dev-oss · 04/08 |
| 🟠 12 | Cuatro cuentas distintas de la tasa de cierre | #39 | esos2dev-oss |
| 🟡 13 | `es_mensualidad`: una columna que nadie escribe, y cinco sitios que la leen | #100 | esos2dev-oss |

---

## 🔴 1 · Los DNI escaneados se descargan sin contraseña

**Lo peor de la lista, y lo único que yo abriría hoy mismo.**

`backend/src/modules/matriculas/matricula.routes.js:8`

    // Doc download es publico (la URL ya es no-guessable)
    router.get('/:id/doc/:tipo', ctrl.getDoc);

Está registrada **antes** de `router.use(verifyToken)`, así que no pide nada. Y
el comentario no es cierto. La URL que se guarda es, en `matricula.controller.js:141`:

    const url = "/api/matriculas/" + m.id + "/doc/" + tipo + "?v=" + Date.now();

Un **entero correlativo** y una de tres palabras: `dni`, `titulo`, `firma`. El
`?v=` es un rompecachés con la fecha, y el manejador ni lo lee.

**Lo curioso es que la no-adivinabilidad sí se diseñó.** Dos líneas más arriba,
la clave del fichero lleva seis bytes aleatorios:

    const key = "matriculas/" + m.project_id + "/m-" + m.id + "-" + tipo + "-" + crypto.randomBytes(6).toString("hex") + "." + ext;

Pero luego se expone por una ruta que resuelve esa clave a partir del id. El
azar quedó del lado de dentro, donde no protege de nadie.

Comprobado contra el servidor, sin sesión:

    GET /api/matriculas/1          ->  401   (esta sí pide sesión)
    GET /api/matriculas/1/doc/dni  ->  404   (esta NO: entró al manejador)

El 404 es porque la base local está vacía. Donde haya matrículas, un bucle de
`id = 1, 2, 3…` las descarga.

Contradice la regla escrita en el propio `CLAUDE.md`: *«Pre-signed URLs: 15
minutos de expiración, solo usuarios autenticados»*.

**Por qué se hizo así, que condiciona el arreglo.** El frontal las pinta con un
enlace normal (`MatriculaDetail.tsx:96`):

    <a href={m.dni_doc_url} target="_blank">Ver documento</a>

Una navegación del navegador **no manda cabecera `Authorization`**, así que
poner `verifyToken` a secas deja el enlace roto. Y `generatePresignedUrl`, que
ya existe, no vale tal cual: es de R2 y esto guarda en disco local.

La salida que encaja con lo que ya hace el CRM es un **token corto firmado en la
propia URL**, con los 15 minutos de siempre. No es una línea: toca autenticación
y hay que decidirlo.

**Sin hacer.** Es lo primero que preguntaría.

## 🟠 2 · Una gestora veía las matrículas de todas — esto sí está arreglado

Mismo módulo. `findAll` no filtraba por responsable y el controlador no
recortaba por rol: una gestora pedía `/api/matriculas` y recibía las de **todo
el proyecto**, con nombre, correo, teléfono y DNI de gente que no lleva ella.

**Es el #109, que se cerró.** Aquel ticket lo decía con todas las letras:

> «No basta con mirar el listado: hay que repasar **todas las puertas** por las
> que se llega a un lead o a su historial.»

Matrículas era una puerta y quedó sin repasar. Salió porque el **#40** pide un
filtro «por gestora» — y añadirlo sin cerrar esto era regalarle el buscador que
le faltaba para leer las ajenas.

**Hecho hoy:** recorte por rol en el listado, los cuatro contadores de la
cabecera recortando igual (si no, una gestora leería «40» sobre cinco filas), y
`exigirQueSeaSuya` en los manejadores por `:id`, al estilo del
`exigirQueSeaSuyo` de los leads.

**Merece repasar si quedan más puertas del #109.** Encontré una sin buscarla.

## 🟠 3 · Un bundle que ninguna migración enciende

`/api/informes` devolvía **404 entero**. En el arranque sale como:

    Modulo SKIP (bundle inactivo): /api/informes

El bundle `reports` existe en `backend/src/bundles/manifest.js:56`, pero el
`DEFAULT` de `030_installation_bundles.sql:10` lista ocho y **`reports` no está
entre ellos**. Ninguna migración posterior lo añade — comprobado sobre las 167.

Con él apagado se caen **la pantalla de Reportes entera**, el panel de asesoras,
el detalle de métricas y el bloque «Ayer y hoy» del dashboard — que es el
**punto 3 del #130**, dado por entregado. Y falla **en silencio**: ese bloque
está escrito para no tumbar el dashboard si no puede contar, así que no deja
rastro en pantalla.

**No sé si producción lo tiene encendido**; puede haberse activado a mano desde
el panel de instalación y desde aquí no se ve. Lo que sí es seguro es que
**cualquier instalación nueva nace sin él**.

## 🟡 4 · El #146 y el #111 no salen en el menú

`frontend/src/shared/config/betaConfig.ts` tiene una lista blanca fija,
`BETA_ROUTES`. Lo que no esté en ella se pinta gris con la etiqueta
**PRÓXIMAMENTE** y sin enlace.

**`/registro` y `/correos` no están.** Son el **#111** y el **#146**, este
último terminado ayer. El código está, la ruta está, el servidor responde — pero
por el menú no se llega.

Las doce rutas fuera de la lista: `/testeo2`, `/suite-dash`, `/dev/components`,
`/campanas`, `/campanas/seo`, `/google-ads`, `/chat-ia`, `/mensajes`,
`/soporte`, `/registro`, `/correos`, `/status`. De ellas `/google-ads` lleva
además un `comingSoon: true` explícito, o sea que esa sí es a propósito.

Son dos líneas — pero antes hay que resolver el punto 5.

## 🟡 5 · Qué se ve en producción depende de qué máquina compila

No existe `frontend/.env.production`, y el script es un `vite build` pelado.
Vite carga `.env.local` **en todos los modos**, así que una máquina con ese
fichero compila en modo beta y otra sin él no.

    .env.local     BETA_MODE=true     <- la máquina de Ángel
    .env.staging   BETA_MODE=false
    .env.testeo2   BETA_MODE=false

El build que hice hoy salió **sin** modo beta. Eso no tranquiliza: significa que
el resultado cambia según dónde se lance, y nadie lo está mirando.

## 🟡 6 · Siete correos con enlaces que pueden apuntar a `localhost`

`CRM_BASE_URL` **no estaba en `.env.example` ni en `.env`**. La usan siete
sitios, todos con el mismo respaldo `|| 'http://localhost:5173/crm'`:

recuperar contraseña (#37) · alta de usuario · recordatorios · resumen del día ·
avisos de leads · plantillas de correo · aviso al tutor.

Si no está puesta en el servidor, todos esos enlaces salen muertos **sin dar
error**: el correo se manda, se entrega, y quien lo abre ve una página que no
carga. Para el #37 es fatal — ese enlace es la única forma de volver a entrar.

**Documentada hoy** en `.env.example`, con las siete dependencias y el aviso de
la barra final. **Falta comprobar que esté puesta en producción.**

## 🟡 7 · `webhook_mode`: el servidor lo entiende, la pantalla no existe

La migración 047 añade `webhook_mode` (`json` / `email` / `both`, por defecto
`both`) y el controlador lo respeta. **En el frontal no aparece en ningún
fichero** — ni aquí, ni en `staging`, ni en `main`, ni en producción, ni en
CRM-ISEIE. Comprobado en los cinco.

El **#18**, que era el ticket del frontal, se cerró el 21/08 con *«Hecho. El
selector está en WebhookDetailPage»*. Lo que hay ahí es un `ListenModePanel`,
que es otra cosa: captura un payload de muestra.

En la práctica: sin selector nadie puede poner un webhook en `json` ni en
`email`, así que todos se quedan en `both` y el campo no hace nada. **Nadie está
roto.** La réplica de ISEIE (#33) se cerró el 16/09 sin comentario, lo que se
lee igual de bien como «esto ya no se quiere».

Un detalle por si se retoma: el criterio de aceptación del #33 pedía **400**
cuando el modo no coincide, y este repo contesta **200** y lo apunta como
`wrong_mode` —a propósito, «para no romper UX del form externo»—. Son criterios
distintos.

## ⚪ 8 · El #139 ya está hecho

`RangoRapido.tsx` tiene los cuatro atajos con la semántica de periodo cerrado
que pedía el ticket, y llegaron a Reportes en `b86101bc`, que está en `staging`.
**Cerrable.**

## ⚪ 9 · 230 commits sin desplegar

Tras la limpieza de Diego del 16/09, `main` coincide **exactamente** con
producción (0 ficheros de diferencia) y no queda ninguna PR abierta. El hueco
vivo es `staging → main`: **230 commits**. Ahí dentro están el #145, #146, #101,
#67 y el #130.

## ⚪ 10 · Una prueba que falla en cualquier instalación limpia

`backend/tests/huecosDeLasPlantillas.test.js` exige que existan plantillas con
`project_id NOT NULL`. Los seeds crean **cero**, así que sale roja en toda base
recién levantada. O el dato entra en los seeds, o la prueba se salta cuando no
hay con qué comparar — una prueba que siempre falla deja de leerse, y con ella
las que fallan de verdad.

---

## Aparte: una clave en texto plano

En `frontend/.env.local` hay una **clave de API de Brevo**. Comprobado: **no**
está en el bundle —lo que aparece en `dist` es el ejemplo `xkeysib-...` de la
pantalla de credenciales—, está en `.gitignore` y nunca se ha commiteado. **No
está publicada.**

Aun así conviene **rotarla** y sacarla de ahí: es un fichero de entorno de
*frontend*, y basta que alguien le ponga delante `VITE_` para que el siguiente
build la meta en el JavaScript público sin avisar. Su sitio es `backend/.env`,
donde ya existe `BREVO_API_KEY`, o el panel de Claves y variables.


## 🟠 11 · Tres pantallas de «Ventas», y la mejor sin enlazar

```
/finanzas/ventas           IncomePage con otro título
/finanzas/ventas-analisis  SalesAnalysisPage — de Fabián (#136)
/ventas                    SalesPage — seis componentes que no veía nadie
```

Lo primero que hay que saber: **«Ventas» e «Ingresos» son el mismo componente.**

```jsx
<Route path="ventas"   element={<IncomePage title="Ventas" ... />} />
<Route path="ingresos" element={<IncomePage />} />
```

Y `SalesPage` se construyó el 04/08 bajo un commit llamado **«refactor(ventas):
una pantalla de ventas y nada mas»**, con resumen, evolución, desglose
matrícula/cuota, países, clientes y cursos vendidos. El menú apuntaba a la otra
desde el 16/07 y **no se repuntó nunca**: `git log -S "to: '/ventas'"` sobre el
Sidebar no devuelve ni un commit. El refactor se quedó a un paso del final, y
mientras tanto `IncomePage` fue absorbiendo funciones de ventas —registrar,
metas, tabla de gestores, top de productos— hasta duplicarla.

**Esto ya está decidido y sin ejecutar.** El #43, subfase 2: *«El menú de
Finanzas — plan aprobado y sin ejecutar: fusionar Ventas e Ingresos, y
Conversiones como pestaña de Análisis»*.

**Hecho:** enlazada como «Panel de ventas» para que deje de estar escondida.
Dónde va de verdad, y si las tres se fusionan, lo decide Diego.

## 🟠 12 · Cuatro cuentas distintas de «cuántos compraron»

| Dónde | Qué cuenta | Daba |
|---|---|---|
| `tasaDeCierre` | ventas con cobro, posteriores a la entrada | 10 % |
| `seguimientoYTiempos` | conversiones a secas | 15 % |
| `overview.tasa_conversion` | leads con `status = 'convertido'` | 15 % |
| `/ventas/serie` | ventas del periodo / leads del periodo | 15 % |

Las tres primeras se unificaron o se quitaron (#39). **La cuarta sigue**, y es
la que pinta «Tasa de cierre» en la gráfica de Evolución del panel de ventas —
o sea que ahora se ve un 15 % a un clic del 10 % de Reportes.

Su comentario en el código dice *«La MISMA definicion de tasa que los
informes»*, y no lo es: cuenta las ventas por SU fecha, no las de la gente que
entró en el periodo. No se tocó porque cambia la gráfica de comparación entre
periodos y eso merece ir con el resto del #39, no de tapadillo.

## 🟡 13 · `es_mensualidad`: una columna que nadie escribe

`getTopProducts` era el único sitio del módulo de ventas **sin**
`NOT es_mensualidad`. Con una cuota de 150 € sobre una venta de 2.500 €, el
ranking la contaba como venta nueva:

```
ANTES    Master Neuroeducacion   ventas=2   facturado=2650
DESPUÉS  Master Neuroeducacion   ventas=1   facturado=2500
```

**Pero esa fila la inserté yo.** Al seguir mirando apareció este comentario en
`conversion.model.js:500`, de quien resolvió el punto 1 del #100 antes:

> «no se podía hacer por `es_mensualidad`: esa columna está a **false en las 491
> ventas**, nadie la marca nunca»

Verificado en el código: **nada la escribe.** No hay INSERT, ni UPDATE, ni
casilla en la interfaz. Se lee en cinco sitios y no se pone en ninguno.

Así que la guarda queda puesta por coherencia con el resto del módulo —y para
el día que alguien empiece a marcarlas— pero **no arregla nada vivo**, y así lo
dejé corregido en el #100.

Lo que sí merece decidirse: o se empieza a marcar, o se quita la columna y los
cinco filtros que la leen. Hoy es un campo que cinco consultas consultan y cero
escriben, y eso se lee como una protección que no protege.

El camino que sí funciona ya está hecho: `cobrosDelPeriodo` separa por el PRIMER
cobro de cada venta —matrícula contra cuota— sin depender de esa columna.

---

# Pendientes anotados, sin issue todavía

## Las etiquetas de WhatsApp tienen que poder plegarse

Ángel, 16/09: *«las etiquetas de WhatsApp deben poder ser desplegables o
plegables, ya que si tienen varias se verá saturado»*.

Hoy se pintan todas a la vez —en la lista de chats, en la cabecera de la
conversación y en la ficha del prospecto (#128 · #138)—. Con dos o tres se lee
bien; con ocho, la fila de etiquetas tapa lo que importa, que es de quién es el
chat y qué dice el último mensaje.

Lo que hace falta es enseñar unas pocas y plegar el resto tras un «+N» que se
pueda abrir. Dónde más aprieta, por orden:

1. **la lista de chats** — es la más estrecha y la que más se mira;
2. **la cabecera del chat**;
3. **la ficha del prospecto**, que tiene más sitio y aguanta más.

Dos cosas a decidir al hacerlo: **cuántas se ven sin desplegar** (y si eso
depende del ancho o es un número fijo), y **cuáles** — la última puesta, las
más usadas, o el orden que traiga WhatsApp.

Va con el #128, que es donde vive todo lo de etiquetas.
