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

---

## Pendiente

| Qué | De quién |
|---|---|
| El texto del **día 4 de MultiCRM** («Descuento de última oportunidad») | Diego |
| **Rellenar las plazas** de los productos: hoy 0 de 3.175 | Negocio |
| Los **tres adjuntos obligatorios** del día 1 | Bloqueado: no existe el envío de ese correo desde el CRM, y Diego dijo «no enviemos NADA por correo» |
| **Aviso de Opynio** cuando una formación no tiene opiniones | Necesita decidir de dónde sale el dato: Opynio es externo |
| La **llamada por centralita** de los días 2, 3 y 4 | Ángel (Zadarma) |
| **Sincronizar ISEIE staging** con el repo | Diego |
