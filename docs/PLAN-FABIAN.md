# F1 y F2 · plan de trabajo

Complementa `TAREAS-EQUIPO.md`: allí está el qué y el criterio de terminada.
Aquí está el estado real medido sobre el código, en qué orden se hace y qué hay
que pedirle al backend antes de poder cerrarlo.

---

## F1 · Administración de usuarios

### De dónde se partía

La pantalla no estaba a cero: hacía casi todo lo que pide el criterio. Lo que
faltaba era, sobre todo, **usar lo que el backend ya ofrecía**.

| «Terminado cuando…» | Antes | Ahora |
|---|---|---|
| Crear | ✅ | ✅ |
| Desactivar / reactivar | 🟡 un clic sin confirmación | ✅ confirma y avisa del reparto de prospectos |
| Cambiar rol | 🟡 sin `tutor` | ✅ los cuatro roles asignables |
| Asignar proyectos | 🟡 no se podían quitar todos | ✅ |
| Marcar quién recibe leads | ✅ | ✅ (verificado contra el round-robin) |
| Gestionar ausencias | 🟡 pestaña aparte | 🟡 sigue igual — **F1.B** |
| Reiniciar contraseñas | 🟡 solo a mano | 🟡 sigue igual — necesita backend |
| Sin tocar la base | 🟡 el nombre no se podía editar | ✅ el nombre sí; el email no (backend) |

### F1.A — hecho

Todo frontend, sin tocar `backend/`.

1. **Módulo propio.** `modules/users/` con `api/`, `hooks/`, `lib/` y
   `components/`. Antes eran 633 líneas dentro de `settings/UsersTab.tsx`, con
   los `client.get` escritos a pelo dentro del componente. `UsersTab.tsx` queda
   como punto de entrada de una línea.
2. **Editar el nombre.** El backend lo aceptaba desde siempre
   (`updateUserSchema`); la pantalla no lo mandaba. Cambiarle el nombre a
   alguien obligaba a entrar en la base.
3. **Rol `tutor`.** Igual: aceptado por el backend, ausente en el desplegable.
4. **Buscador, filtros y paginación.** Por nombre/email, por rol y por estado.
   Antes pedía `limit=100` fijo, sin buscador y sin paginar.
5. **«Nunca ha entrado».** Estado propio, distinto de activo/inactivo. Importa
   porque el alta manda un enlace de 24 h y **hoy el CRM no puede mandar
   correo**: quien no lo pilla se queda fuera y nadie se entera.
6. **Confirmación al desactivar.** Desactivar reparte sus prospectos entre el
   resto del equipo y le cierra la sesión. Eso no puede ser un clic sin red.
   Además el aviso posterior dice cuántos prospectos se movieron.
7. **Quitar todos los proyectos.** Desmarcarlos todos no hacía nada: el backend
   lee `projects: []` como «no tocar». Con `projectIds: []` sí los quita — es el
   formato viejo, y es la única forma de retirar el acceso sin desactivar la
   cuenta.
8. **Una copia menos.** `getInitials`, `AVATAR_COLORS` e `inputClass` pasan a
   `shared/lib/ui.ts`. `settings/shared.tsx` las re-exporta para no romper a
   nadie.

Comprobado: `typecheck` sin errores nuevos (quedan 7 previos, en archivos que no
se han tocado), `eslint` limpio, `build` correcto, y los 18 tests que fallan
fallaban antes — son de leads, conversiones, export y sidebar.

### F1.B — hecho

1. **Ausencias donde se administra a la persona.** Nuevo `AvailabilityDialog`,
   que se abre desde el menú de la fila. La lista marca en la misma columna de
   estado quién está fuera y hasta cuándo. Fuera `window.prompt()` y `confirm()`:
   el motivo se pide en un campo del propio diálogo y el borrado pasa por
   `ConfirmDialog`, que sí se ve en oscuro y en móvil.
2. **La pestaña de Disponibilidad reusa ese mismo diálogo.** Sigue siendo útil
   como vista de conjunto, pero ya no es una segunda implementación: pasó de 241
   líneas a 120.
3. **Sin permiso ≠ error.** `/settings` no filtra por rol —solo se esconde del
   menú—, así que un gestor que escriba la dirección llega. Antes veía un panel
   rojo con «Reintentar», que no arregla nada. Ahora ve que la pantalla es para
   administradores. El 403 se distingue del fallo real porque `client.js` ya
   traía el `status` en `ApiError`; solo había que dejar de tirarlo.
4. **Reiniciar la contraseña dice por qué no está.** A un admin no superadmin el
   campo no le sale —el servidor lo rechaza igual—, y ahora lo explica en vez de
   faltar sin más.

**Detalle de fechas.** Las ausencias viajan como texto `YYYY-MM-DD` en los dos
endpoints (`db.js` desactiva el parser de DATE, `setTypeParser(1082)`). Se
formatean partiendo el texto, no con `new Date`: `new Date('2026-08-19')` se lee
como UTC y en España se pinta como el 18. Un día de ausencia de menos es
exactamente el error que nadie revisa. Hay test.

### Pendiente de decidir — roles y permisos

Ni se arreglaron ni se tocaron, porque antes hay que decidir. Lo medido:

`can()` se usa **en un solo sitio de todo el CRM**: el botón de exportar de
Prospectos (`LeadsPage.tsx:612`). El sidebar y las rutas filtran por `role`
directamente. La pantalla de Roles es de solo lectura, pinta la tabla
**codificada en el frontal** en vez de la que resuelve el servidor, y avisa de
que «el backend CRM-228 no está desplegado» cuando sí lo está
(`app.js:146`).

Así que la pantalla dice tres cosas que no son ciertas, y arreglarlo del lado
del frontal afecta a un botón. La decisión —hacerla honesta o quitarla— es de
quien lleve el backend, porque sin `checkPermission` en las rutas nada de esto
se aplica de verdad.

### Lo que necesita backend

| Qué | Dónde | Por qué |
|---|---|---|
| **Los permisos no funcionan** | tres archivos, abajo | Es la advertencia de `TAREAS-EQUIPO.md`, confirmada |
| `POST /users/:id/reenviar-invitacion` | no existe | El enlace caduca a las 24 h y no hay forma de regenerarlo sin tocar la base. Enlaza con C1 |
| `gestor_colaboraciones` en el SELECT del listado | `user.model.js` · `findAll` | La columna se usa en el `WHERE` pero no se devuelve, así que quien lleva colaboraciones sale etiquetada como «gestor». Es una línea |
| Búsqueda en `GET /users` | `listUsersSchema` | Sin ella el buscador solo mira los 100 cargados. Con los usuarios de hoy sobra; la pantalla avisa si algún día no |

**El detalle de los permisos**, que son tres fallos encadenados:

1. `shared/middleware/permissions.js` — `checkPermission` está escrito y **no se
   usa en ninguna ruta**.
2. `auth.controller.js` manda `permissions` **hermano** de `user`, y
   `AuthContext.jsx` hace `setUser(data.user)`: el mapa se descarta.
3. `usePermission.ts` lee claves `leads.read`; el servidor emite `leads.view`.

Arreglar uno solo no cambia nada: hacen falta los tres.

---

## F2 · Rediseño

83 páginas, 276 componentes, 23 primitivas.

El riesgo no son las 82 pantallas: son las decisiones repetidas 82 veces. Medido
antes de empezar, así está hoy:

| Repetido | Copias | Valores distintos |
|---|---|---|
| `inputClass` | 14 | 6 |
| `getInitials` | 6 | — |
| `AVATAR_COLORS` | 5 | — |

Seis definiciones distintas de cómo se ve un campo de texto. Eso no se arregla
pantalla a pantalla.

### El orden

```
Capa 0  Inventario y decisiones     ✅ hecho (esto)
Capa 1  Tokens · index.css          ✅ hecho — estados semánticos
Capa 2  Las 23 primitivas           ▫ 1 de 6 con color propio
Capa 3  Los 4 patrones repetidos    tabla+tarjeta, diálogo, menú, vacío/carga/error
Capa 4  Las 83 pantallas, por lotes
```

### Capa 1 — hecho

Cuatro estados, cada uno con dos parejas:

```
--success / --success-foreground             relleno sólido
--success-soft / --success-soft-foreground   fondo suave
```

…y lo mismo para `warning` e `info`. **El peligro no estrena variable**: ya
existía `--destructive` y tener dos rojos es justo el problema que esto quita;
solo se le añadió la pareja suave.

Los valores se verificaron **contra la paleta real de Tailwind** y con las
razones de contraste calculadas: los 16 pares pasan AA (4,5:1) en claro y en
oscuro. Esa comprobación encontró tres errores del primer intento — un tono de
ámbar copiado con 7 grados de desvío, y dos parejas sólidas ilegibles (blanco
sobre verde claro en oscuro son 2,5:1). Corregidos.

Dos decisiones que conviene no redecidir:

- **El texto sobre fondo suave es el tono 700, no el 600** que se venía usando.
  El 600 sobre el 50 se queda en 3,4:1 y estas etiquetas son de 10px. El 700
  pasa de 4,5:1.
- **En oscuro se invierte la pareja**: fondo 950, texto 400 — que es lo que ya
  hacía a mano media aplicación, pero ahora en un solo sitio. Una clase sirve
  para los dos temas y desaparece el `dark:` repetido en cada etiqueta.

Es **aditivo con una excepción**, y conviene saberla: `--destructive` en claro
era `red-500`, que con texto blanco encima se queda en **3,8:1** y no pasa AA.
No era un sitio suelto — afectaba a **todo** `<Button variant="destructive">`
del CRM. Bajado a `red-600`, que es el valor que el tema oscuro ya tenía: pasa a
4,8:1 y de paso hay un rojo en vez de dos. Los botones destructivos quedan un
punto más oscuros.

El resto sí es aditivo: nada cambia de aspecto hasta que un componente adopta el
token.

### Capa 2 — empezada, 1 primitiva

Solo seis de las 23 primitivas llevan color propio:

| Primitiva | Usos de color suelto |
|---|---|
| ChannelBadge | 40 |
| StatusBadge | 28 |
| **ConfirmDialog** | **24 → 0** ✅ |
| BetaDisclaimer | 14 |
| NeedsProjectBanner | 8 |
| KpiCard | 4 |

`ConfirmDialog` va primero porque mapea 1:1 y ya lo usa la pantalla de Usuarios,
así que se ve funcionando. De paso salió un fallo real: el botón forzaba
`text-white`, y en oscuro el ámbar es claro — blanco sobre amarillo. Ahora el
color de texto sale del token.

Su test comprobaba la clase literal `bg-red-600`. Eso ataba el test a la paleta:
cambiar el rojo obligaba a tocar el test aunque el comportamiento fuera idéntico.
Ahora comprueba que **cada tono usa su propio token**, que es lo que se rompería
de verdad.

**Capa 1 — el hueco concreto.** `index.css` define fondo, texto, primario,
borde… pero **ningún token de éxito, aviso o peligro**. Por eso el verde va
escrito a mano como `bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600` en
cada archivo que lo necesita. Mientras no existan `--success`, `--warning` y
`--danger`, cada pantalla vuelve a inventarse el verde.

**Capa 4 — no a ciegas.** Hay 12 archivos de más de 600 líneas: `Sidebar` con
1.296, `LeadsPage` con 1.172, `ManualPage` con 1.172. Esos van al final, o se
parten antes de tocarlos.

### Cómo levantarlo

```bash
cd frontend
npm install
VITE_BASE_PATH=/testeo/ VITE_API_TARGET=https://360crm.tech npm run dev
```

Contra la API de pruebas: sin backend, sin PostgreSQL y con datos reales.

> ⚠️ **En Windows con Git Bash ese comando no funciona.** MSYS traduce
> `/testeo/` a una ruta de Windows y Vite arranca en
> `localhost:5173/Program Files/Git/testeo/`. Hay que anteponer
> `MSYS_NO_PATHCONV=1`, o usar PowerShell:
>
> ```powershell
> $env:VITE_BASE_PATH="/testeo/"; $env:VITE_API_TARGET="https://360crm.tech"; npm run dev
> ```
>
> Comprobado: con el prefijo arranca en `localhost:5173/testeo/` y el proxy
> llega a la API real (devuelve 401 JSON sin sesión, no un error de CORS).

### Lo que se respeta

Tailwind y shadcn/ui, los tokens de `index.css` en vez de colores sueltos, y que
siga funcionando en oscuro. Probar con más de un rol: lo que ve una gestora no
es lo que ve un superadministrador.

---

## Reglas que aplican a esta rama

`feat/rediseno` es **solo frontend**: el workflow `solo-frontend.yml` falla si el
diff toca `backend/`. Si hace falta algo del servidor, se pide.
