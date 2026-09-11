# Bitácora · Llevar el proceso comercial al CRM

Diego, 2026-09-11: «hagamos nosotros esas tareas» y «anota cada paso, cada
commit, todo, para que vayamos viendo».

El documento de referencia es `docs/proceso-comercial.pdf` (y su extracción
`proceso-comercial.txt`). Manda el PDF.

---

## Qué hay hecho y qué no (revisado el 2026-09-11)

Lo comprobé antes de empezar, no de memoria.

### Ya estaba

| Qué | Dónde |
|---|---|
| Los cinco pasos, en la base y editables por proyecto | `commercial_steps` · migración 143 |
| La agenda de cada prospecto: qué paso le toca y qué día | módulo `proceso` |
| La cola del día | `/prospectos/cola` |
| Pantalla de Proceso comercial, editable por el admin | `/prospectos/proceso` |

Los pasos están bien diferenciados entre CRMs, y lo verifiqué:

- **MultiCRM** paso 4 = «Descuento de última oportunidad»
- **ISEIE** paso 4 = «Convocatoria de becas CETLAT»

CETLAT es una alianza de ISEIE; en MultiCRM no aplica. Ya estaba corregido.

### NO estaba — es lo que vamos a hacer

1. **Las plantillas del documento.** Hay 36 en `whatsapp_templates`, pero son
   relleno genérico: «Saludo inicial», «Seguimiento», «Oferta», «Reactivar»,
   cuatro iguales por proyecto, con textos de ejemplo («tenemos una oferta
   especial hasta el viernes»). **Ninguna es del documento.** Y
   `email_templates` está **a cero**, con los tres correos del documento sin
   cargar.
2. **Los tres adjuntos obligatorios** del correo del día 1. El documento lo dice
   tres veces, incluido: «Los tres adjuntos son obligatorios. Sin los tres, el
   correo no sale». Hoy nada lo comprueba.
3. **Las plazas disponibles** en los días 1, 3, 4 y el mensual, «se comprueba
   antes de cada envío». Existen `plazas_totales` y `plazas_ocupadas_previas` en
   productos, pero no se cruzan con el proceso.
4. **Aviso de Opynio**: formación sin opiniones publicadas → avisar para que se
   cree. No existe.
5. **La llamada por centralita** de los días 2, 3 y 4 — es la tarea de Zadarma
   de Ángel. El documento ya la exige.

### Variables que entiende el CRM

`{nombre}`, `{nombreCompleto}`, `{producto}`, `{proyecto}`, `{email}`,
`{telefono}` — ver `frontend/src/modules/whatsapp/lib/plantilla.ts`.

Todo lo demás del documento (`[Asesor]`, `[importe]`, `[nº] plazas`, `[fecha]`…)
son huecos que rellena la gestora antes de enviar, que es justo lo que el
documento pide: «lo marcado en amarillo se sustituye antes de enviar».

---

## Diario

### 2026-09-11 · Revisión previa

Sin tocar código todavía. Comprobado contra las dos bases de producción:
`whatsapp_templates` (36 genéricas), `email_templates` (0),
`commercial_steps` (45 en MultiCRM = 5 × 9 proyectos; 5 en ISEIE).

### 2026-09-11 · Paso 1 — Las plantillas, cargadas

**Commit** `a498768` (ISEIH) · `5919233` (ISEIE) — *feat(proceso): las plantillas
del documento comercial, cargadas de verdad*

**Qué se hizo**

- `docs/plantillas-proceso-comercial.md` — las plantillas del PDF adaptadas a
  las variables del CRM. Es a la vez la copia para Ángel y la fuente de la
  migración.
- `backend/migrations/151_plantillas_proceso_comercial.sql` — las carga.
  Idempotente: se puede repetir sin duplicar.

**Decisiones, y por qué**

| Decisión | Motivo |
|---|---|
| Las 4 genéricas se **desactivan**, no se borran | La pantalla filtra por `active`: dejan de salir y no se pierde nada |
| El día 2 son **tres** plantillas y el día 3 **dos** | El documento: «si no cabe en la pantalla del móvil sin desplazarse, parte el mensaje» |
| Los `[corchetes]` se quedan sin rellenar | El CRM no sabe las plazas reales ni los importes del plan. Rellenarlos sería enviar cifras inventadas |
| El día 4 lo decide `commercial_steps`, no el fichero | Así la migración es **idéntica en los dos repos** y distingue CETLAT (ISEIE) de descuento (MultiCRM) con los datos |
| La del día 4 de MultiCRM **no se carga** | El documento no trae ese texto. Una plantilla inactiva sería invisible y se olvidaría; una activa con «[pendiente]» se acabaría enviando a un cliente |

**Resultado en las 4 bases**

| Base | WhatsApp | Correo | CETLAT |
|---|---|---|---|
| MultiCRM producción | 90 (9 × 10 proyectos) | 20 | 0 |
| MultiCRM /testeo | 81 (9 × 9) | 18 | 0 |
| ISEIE producción | 10 | 3 | 1 |
| ISEIE staging | 10 | 3 | 1 |

Genéricas activas que quedan: **0** en las cuatro. Y comprobado que el usuario
del CRM las lee (#71), no solo que existan.

**Algo que apareció por el camino:** ISEIE staging **no tenía la migración 143**
— la tabla `commercial_steps` no existía. Se aplicó antes de repetir la 151.
Conviene revisar qué más le falta a esa base.

**Queda pendiente de Diego:** el texto del **día 4 de MultiCRM** («Descuento de
última oportunidad»). Hace falta el porcentaje, si tiene fecha límite y con qué
nombre se presenta.

### 2026-09-11 · Paso 2 — La cola del día dice la formación y las plazas

**Commit** `060e9c0` (ISEIH) · `2d1f450` (ISEIE)

**Por qué.** El documento pide el número de plazas en **cuatro de los cinco
pasos** y es explícito: «se comprueba antes de cada envío, nunca se arrastra el
dato del mensaje anterior». La cola no lo enseñaba, así que para comprobarlo
había que salirse de la pantalla — y entonces no se comprueba.

**Qué se hizo.** Cada fila de la cola lleva ahora la formación, las plazas
libres y, si queda menos de un mes, cuánto falta para el cierre. Verde, ámbar
por debajo de cuatro, rojo sin plazas.

**El cálculo no se duplica.** `PLAZAS_JOIN` y `PLAZAS_COLS` eran constantes
privadas de `product.model.js`; salen a `products/plazas.sql.js` y las usan el
catálogo y la cola. Si cada pantalla se lo calculara aparte, dirían números
distintos de la misma convocatoria — y al cliente le llegaría el que la gestora
tuviera más a mano.

**Un fallo que ya estaba, corregido de paso.** `if (pProj) par.push(...)` era
SIEMPRE cierto —es una cadena no vacía en las dos ramas— así que con la lista de
proyectos vacía se empujaba un parámetro de más y la consulta reventaba: «bind
message supplies 2 parameters, but requires 1». No había saltado porque el
controlador siempre manda una lista con algo. Estaba en dos sitios.

**Comprobado contra producción** antes de desplegar: mismas filas que antes,
ningún campo perdido, cinco nuevos, y el caso que reventaba ahora responde.

**LO QUE DESTAPA, y es lo importante:** de **2.416 productos activos en MultiCRM
y 759 en ISEIE, NINGUNO tiene plazas configuradas**. Los campos existen desde la
migración 142 y están los 3.175 vacíos. Por eso la fila dice «sin plazas
configuradas» en ámbar en vez de callarse: el dato que el documento exige no
está, y ahora se ve. **Esto no lo arregla el código: alguien tiene que
rellenarlo.**

**Desplegado en /testeo** (MultiCRM): backend y frontend, API 200.

**ISEIE staging NO**, y conviene saber por qué: su código es del **24 de
agosto**, le faltan dos módulos enteros (`proceso` y `convocatorias`) y 23
ficheros. No es un entorno de pruebas usable y parchearlo fichero a fichero es
cómo se llegó a esto. Se le dejó `plazas.sql.js` y `product.model.js`, que son
coherentes entre sí y no rompen nada —comprobado, API 200—, pero necesita un
despliegue completo desde el repo.

### 2026-09-11 · Paso 3 — El día 4 sin CETLAT, y el enlace de opiniones

**Commit** `44d968b` (ISEIH) · `0dbfba3` (ISEIE) · migración 152

Diego: «agárralo del doc». Y tenía razón: el documento **sí** cubre el día 4. Lo
titula «Convocatoria de becas CETLAT» —que es alianza de ISEIE— pero el
contenido es el mismo en los dos casos: un porcentaje sobre el importe de la
matrícula, ofrecido como último recurso antes del cierre.

**El techo va donde lo ve la gestora, no el cliente.** El documento lo marca
«INTERNO · NO SE COMPARTE: formación nueva máx. 40 %; formación ya habilitada
hasta 70 %, reservado para quien casi no ha respondido». Así que el porcentaje
va como hueco en la plantilla y la regla queda en la **nota del paso**.

**Opynio.** Diego: «lo tienen que sacar desde la página de Opynio de ISEIE, el
CRM no te va a dar la reseña». Exacto, y eso cierra la duda que tenía: la reseña
vive fuera y no hay nada que sincronizar. Lo único que puede hacer el CRM es no
obligar a buscar la dirección cada vez — en ISEIE el enlace ya queda escrito, y
en los demás se deja el hueco, porque poner el de otra institución sería peor. Y
la nota del paso 2 recuerda pedir que se cree la opinión si esa formación no
tiene, que es lo que el documento manda y no se puede automatizar.

**Resultado.** MultiCRM: 9 plantillas y 9 correos de descuento, techo en la nota
de los 9 pasos. ISEIE: su beca intacta y el enlace de Opynio escrito. En las 4
bases.

### 2026-09-11 · Paso 4 — La plantilla que lleva imagen, y la letra pequeña

**Commit** `2e579ef` (ISEIH) · `96c952a` (ISEIE) · migración 153

Diego: «la de Opynio es como el mensaje de "mira esta reseña" y pones ahí para
insertar imagen».

**El problema.** El documento, día 2: el primer mensaje anuncia la opinión y
«(enviar la captura justo después)». El chat ya sabía mandar imágenes, pero al
elegir la plantilla se te ponía el texto y **nada te recordaba el clip** — que es
justo lo que se olvida con prisa.

**Dos campos, y no uno**, porque son dos cosas distintas:

| Campo | Para quién | Qué hace |
|---|---|---|
| `pide_adjunto` | la máquina | Al elegir la plantilla, el chat abre el selector de archivos |
| `pista` | la persona | Un aviso que **NO se envía** |

**La pista no podía ir en el cuerpo.** Lo que está en el cuerpo se manda, y un
«[adjunta la captura]» acabaría en el móvil de un cliente.

**Y de paso recupera la letra pequeña del PDF**, que hasta hoy no estaba en
ninguna parte del CRM: «funciona mejor en nota de voz», «va separado: es el que
abre conversación», «el 5 % solo en máster y diplomado», «comprueba las plazas
ANTES de enviar». Eso lo lee la gestora mientras elige, que es cuando sirve — el
PDF nadie lo tiene abierto mientras escribe.

**La reseña sigue saliendo de Opynio.** El CRM no la conoce y no se inventa
nada; lo único que hace es no dejar que se olvide.

**En las 4 bases:** MultiCRM 10 plantillas piden adjunto y 69 llevan pista;
ISEIE 1 y 7. **Desplegado en /testeo**, backend y frontend, API 200.

### 2026-09-11 · Paso 5 — El proceso en la ficha del prospecto

**Commit** `fcc64c5` (ISEIH) · `01bccbf` (ISEIE)

Diego: «en los prospectos también debería de salir: próximos pasos».

**Por qué hacía falta.** La cola del día responde *«¿a quién le toca hoy?»*. Al
abrir una ficha la pregunta es otra: *«¿por dónde voy con esta persona y qué le
toca ahora?»*. Había que acordarse, o irse a la cola y buscarla.

**Y la columna «Próximo» de la lista no servía para esto**: es el próximo
**recordatorio**, no el paso comercial. Dos cosas distintas que se veían igual.

**Qué enseña.** El paso que toca, con sus canales **en orden** y la chuleta del
documento; si viene arrastrado y cuántos días; y debajo los cinco pasos, con los
hechos tachados.

**Se marca UN solo paso como «el siguiente»**, el primero pendiente. Si alguien
lleva tres sin hacer, lo que necesita es que le llamen una vez, no tres avisos.
Y si no hay pasos planificados —alguien que ya compró, o anterior al proceso— la
tarjeta no aparece: una tarjeta vacía solo estorba.

**Desplegado en /testeo.**

**Nota de operación:** el despliegue falló dos veces con «Error reading SSH
protocol banner». La web respondía y el puerto 22 estaba abierto: era el
servidor limitando conexiones SSH después de muchísimas seguidas. Reintentando
entró. Si vuelve a pasar, es esperar, no un fallo del código.

---

### 2026-09-11 · Paso 6 — La rama de Fabián entra, y /testeo queda con las dos líneas

**Commit** `3277f1c` (ISEIH) · fusión de `origin/integracion/fabian`

Diego: «verifica y monta todo en testeo».

**Antes de tocar nada** se comprobó que /testeo estaba al día con la rama —13 de
13 ficheros del backend y el bundle con todas las cadenas nuevas— y se marcó el
punto de vuelta atrás: etiqueta `antes-fusion-fabian` en `b97fc2f`.

**Cuatro conflictos, seis bloques.** Tres se resolvieron a mi favor y el
`Sidebar.jsx` al suyo, que ahí el rediseño del menú es suyo.

**Y el hallazgo que justifica la tarde:** el lado de Fabián en
`conversion.model.js` traía un arreglo que mi rama **no tenía** —el IVA incluido
por defecto cuando nadie dice lo contrario— y venía **fuera de las marcas de
conflicto**, ya casado por git. Mi propio documento de orden decía resolver ese
fichero con `git checkout --theirs`, que se lo habría llevado por delante **por
segunda vez**: su comentario en el código ya avisaba de que una fusión anterior
se lo había deshecho. Corregido en `docs/ORDEN-FUSION-FABIAN.md`.

> **`--ours` y `--theirs` son de fichero entero, no de bloque.** En un fichero
> que dos personas han reescrito, resolver así tira trabajo que git ya había
> casado bien. Se resuelven los bloques marcados y se verifica el resto.

**El otro hallazgo.** Comparando el árbol del servidor contra la rama —310
ficheros, uno a uno, normalizando los saltos de línea— aparecieron **tres**
diferencias, no las 25 que traía la fusión: Fabián ya tenía su backend
desplegado. Y una de las tres era que /testeo tenía `conversion.validation.js`
**más viejo que las dos ramas**, sin las líneas de `issuerId`. Ese era el
«con la empresa puesta sale todo a cero» que reportó Diego: la validación se
comía el parámetro antes de que llegara al modelo.

**Comprobado en /testeo, contra la API y no solo compilando:**

| | |
|---|---|
| `/prospectos/cola` | 200, con formación y plazas |
| Ficha del prospecto | 200 · 4 pasos · «ahora le toca: Última plaza y facilidades de pago» |
| `/prospectos/proceso` | 200, los cinco pasos |
| `/finanzas/ventas` con CEDIA (7 campus) | **377 filas** de 447 — antes, cero |
| Plantillas con imagen | 9, una por proyecto |
| Vista de reparto | 433 ventas, ninguna suma distinta de 1 |

**Nota de operación:** el frontend se montó en `frontend.nuevo` y se cambió con
un `mv`, no vaciando la carpeta en caliente. La vez que lo hice al revés dejé
/testeo sin JS tres minutos.

---

## Pendiente

| Qué | De quién |
|---|---|
| **Rellenar las plazas** de los productos: hoy 0 de 3.175 | Negocio |
| Los **tres adjuntos obligatorios** del día 1 | Esperando: Diego dice «el correo se hará». Cuando exista el envío, la validación va encima |
| ~~Aviso de Opynio~~ | **Cerrado**: la reseña sale de la página de Opynio, el CRM no la conoce. Queda el enlace y el recordatorio en la nota del paso |
| La **llamada por centralita** de los días 2, 3 y 4 | Ángel (Zadarma) |
| **Sincronizar ISEIE staging** con el repo | Diego |
