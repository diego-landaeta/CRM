# Dónde nos quedamos · rama `feat/angel`

> 26/08/2026 · Para retomar sin releer el hilo.

---

## Lo primero al volver

**Todo subido.** Los siete commits están en `feat/angel` y por tanto en el
PR #51, a la espera de que Diego los revise.

Lo que hace falta para que funcione en un servidor está más abajo: dos
migraciones y una variable de entorno.

---

## Lo que está a medio hacer ahora mismo

**Nada.** #27, #28, #29 y la parte hecha de #70 están terminados, probados y
subidos. Lo siguiente sin empezar es #26.

## Lo que hay que decirle a Diego

### 1 · El panel de Informes declara ingresos de más

Esto es lo más importante de todo el documento.

El ticket #29 dice: *«lo cobrado sale de `conversion_payments`, **nunca** de
`conversions.importe_pagado` — ese campo declara de más: 209.930 € en ISEIE»*.

**Pero el panel usa justo ese campo.** `overview()` en `report.model.js` hace
`SUM(importe_pagado) AS cobrado`. Medido en la base de desarrollo:

| | |
|---|---|
| Lo que dice el panel | 11.440 € |
| Lo que hay de verdad en `conversion_payments` | 4.200 € |
| **De más** | **7.240 € (63 %)** |

O sea que las dos reglas del ticket se contradicen: no se puede cuadrar con el
panel Y respetar la regla del dinero, porque **el panel la incumple**.

En el reporte semanal ganó la regla del dinero: manda el número real y lo dice al
pie. Pero **el panel sigue mal**, y eso es una decisión de Diego, no nuestra.

### 2 · Dos migraciones sin aplicar

| | | Sin ella |
|---|---|---|
| **127** | `registro_de_correos` | El correo sale pero no queda registro, la pantalla de Estado sale vacía, y **la idempotencia no frena**: la clave vive en esa tabla, así que una tarea repetida vuelve a mandar |
| **131** | `avisos_por_correo` | Los avisos ni se mandan: la consulta usa esa tabla, falla, y el trabajo lo registra sin tumbar nada |

Ojo con el número: la 128 ya estaba cogida por WhatsApp. La de los avisos es la
**131**. Ya está corregido, pero se escapó una vez.

### 3 · Ocho issues terminados y todavía abiertos

**#62, #63, #64, #67, #68** (WhatsApp), **#27** (tubería de correo), **#28**
(recordatorios) y **#29** (reporte semanal). Todo subido. Falta que Diego los
revise y los cierre — los issues no los cerramos nosotros.

### 4 · Choque con `integracion/todo`

La rama de integración solo lleva **el primero** de los seis commits de WhatsApp.
Al probar la fusión, choca en cinco ficheros:

```
backend/src/modules/whatsapp/chat.model.js
backend/src/modules/whatsapp/chat.service.js
frontend/src/modules/whatsapp/api/whatsapp.api.ts
frontend/src/modules/whatsapp/pages/ChatPage.tsx
frontend/src/modules/whatsapp/pages/chat.css
```

Cuanto más espere, peor.

---

## Lo siguiente, por orden

1. **#26 · Página de estado del sistema.** Ya tiene una subfase hecha sin
   pretenderlo: el bloque de correos. Quedan Meta, Stripe, WooCommerce y las
   tareas programadas — el mismo patrón repetido.
   > Ojo: #26 pide *«sin datos sensibles, por si algún día se enseña fuera»*, y el
   > bloque de correos enseña direcciones de clientes. Hoy está tras
   > `roleGuard('admin','superadmin')`, pero si esa pantalla llega a ser pública,
   > ese bloque no puede ir. Conviene decidirlo antes de añadir más.
2. **#30 · Análisis de datos con IA** y **#44 · Sincronizar proyectos de IA**
   (compartido con Fabián — hablarlo antes de empezar).

---

## Lo que quedó abierto y no es un issue

**Los 9 tests rojos que faltan.** De 20 se arreglaron 11. Quedan:

- `ExportDialog` (6) — cambió el texto de la interfaz
- `ConversionDialog` (3) — el objeto que se manda tiene 18 campos y la prueba
  espera 6

No son mecánicos: hay que leer qué hace hoy cada componente y decidir si el
cambio fue intencionado **o si hay un fallo escondido que la prueba vigilaba**.
Lo de `ConversionDialog` huele mal: pasar de 6 campos a 18 al convertir un
prospecto es mucho cambio para que nadie lo mirara en meses. Está en **#70**.

**Duplicados por teléfono.** El issue #65 menciona un caso real de esta semana:
dos fichas del mismo número, `+56945521666` y `+945521666`, que no se detectaron
como duplicadas porque no coincidían como texto. **Eso pasa hoy**, sin usuarios
de WhatsApp de por medio, y es independiente del resto de ese ticket.

**`backend/env.production` y `env.staging`** siguen sin seguimiento y **sin
ignorar**. Un `git add -A` de cualquiera los sube.

**El número personal de Ángel en el historial de git**, en `5d091f8` y `89ad9ca`.
Quitarlo exige reescribir tres ramas y coordinarlo con todo el equipo. **No está
en `main`.**

---

## Cosas que no se pueden hacer, ya comprobadas

Para que nadie las vuelva a intentar. Las tres están documentadas en sus issues
con el código delante.

| | |
|---|---|
| **Hablar por WhatsApp desde el CRM** | Solo pagando: Wavoip (con sus servidores en medio) o la API oficial de Meta (que obliga a un número que deja de funcionar en la app normal). Gratis no hay. |
| **Hacer sonar el teléfono del otro** | `baileys@7.0.0-rc14` solo expone `rejectCall`. No hay `offerCall` — por eso el de Evolution está comentado y devuelve un `id: '123'` inventado. |
| **Abrir un chat con `@usuario`** | Evolution hace `number.replace(/\D/g,'')` al armar el destinatario: borra todo lo que no sea cifra. Se puede *leer* el usuario de quien escribe y guardarlo, pero no escribirle. |

---

## Entorno local, para levantarlo

Tres procesos, y un detalle que cuesta una hora si se olvida:

```bash
# 1 · Puente de Baileys (solo si se toca WhatsApp)
cd <scratchpad>/puente-wa && node puente.mjs        # :8099

# 2 · Backend
cd backend && PORT=3056 EMAIL_LISTA_BLANCA=@empresa.com node src/app.js

# 3 · Frontal
cd frontend && VITE_API_TARGET=http://localhost:3056 \
  node node_modules/vite/bin/vite.js --port 5173 --strictPort
```

Se entra por **`http://localhost:5173/crm/`** — por `127.0.0.1` no responde.

`backend/.env` dice `PORT=3001` pero el backend corre en **3056**, porque es a
donde el puente manda los webhooks. Sin `VITE_API_TARGET` apuntando ahí, **todo
el CRM da error 500 empezando por el login**, y parece que se cayó la base.

**Y sin `EMAIL_LISTA_BLANCA` no sale ningún correo en desarrollo.** Es el
comportamiento correcto —el freno de #27— pero conviene saberlo.

El número de WhatsApp de Ángel **está desvinculado** desde el 25/08. Para probar
el chat, las plantillas o las llamadas hace falta volver a enlazar uno.
