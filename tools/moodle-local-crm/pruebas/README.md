# Probar el plugin y el CRM en local, con Docker

Un Moodle 4.5 de pruebas con datos inventados (tutoras, alumnos, un curso con tareas y
entregas) para probar de punta a punta el chat directo, «Mi campus», corregir desde el CRM,
el repaso y la actualización automática. **Solo local**: las contraseñas de aquí son de este
Moodle de pruebas y no sirven en ningún otro sitio.

> Los campus reales están en **Moodle 5.x**. Este entorno es 4.5: lo que funcione aquí hay
> que confirmarlo también en un Moodle 5 antes de instalarlo en un campus.

## 1. Levantar el Moodle

```bash
docker compose -f tools/moodle-local-crm/pruebas/docker-compose.yml up -d
```

Tarda unos minutos la primera vez. Queda en http://localhost:8085 (usuario `admin`,
contraseña `AdminLocal-679!`).

**Los comandos de Moodle, siempre como el usuario del servidor web (`daemon`)**. Si se lanza
alguno como root, Moodle deja carpetas que luego no puede escribir («Invalid permissions
detected when trying to create a directory»); se arregla con
`docker exec <moodle> chown -R daemon:daemon /bitnami/moodledata`.

## 2. Los datos de prueba

```bash
M=$(docker compose -f tools/moodle-local-crm/pruebas/docker-compose.yml ps -q moodle)
docker cp tools/moodle-local-crm/pruebas/. $M:/tmp/pruebas/
for s in preparar alumna2 tareas entrega-archivo; do
  docker exec $M su -s /bin/sh daemon -c "php /tmp/pruebas/$s.php"
done
```

Crea el curso `CRM679` con la tutora **tutora679** (Laura), los alumnos **alumno679**
(Pedro) y **alumna679b** (María), dos tareas y una entrega con PDF. Contraseña de todos:
`Local-679-pass!`. Para más casos:

| Script | Qué añade |
|---|---|
| `casos-limite.php` | Tareas con escala, con flujo de calificación y en grupo; un .html y un .svg en una entrega |
| `segunda-tutora.php` | Carmen (coord679) como segunda profesora del curso y Sofía, tutora de otro curso |
| `curso-contenido.php` | Temas y actividades variadas (página, enlace, cuestionario, foro, PDF, tema oculto) |
| `grupos-separados.php poner\|quitar` | Grupos separados con la tutora solo en el Grupo A |
| `mensaje-cli.php <de> <para> "<texto>"` | Un mensaje privado como si se escribiera en el campus |
| `conectar-cli.php <código>` / `desconectar-cli.php` | Conectar o desconectar el campus sin pasar por la página |

## 3. El CRM local apuntando a ese Moodle

En `backend/.env` (además de lo de siempre):

```bash
# La dirección con la que el Moodle del contenedor llega al CRM de tu equipo.
API_PUBLIC_BASE_URL=http://host.docker.internal:3001/api
# Deja conectar un Moodle por http y en la red interna. Solo en local.
MOODLE_PERMITIR_RED_LOCAL=true
# Para probar la actualización automática (clave de PRUEBAS, fuera del repo):
#   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out privada.pem
#   openssl pkey -in privada.pem -pubout -out publica.pem   → pegar en crm/classes/claves.php
PLUGIN_FIRMA_CLAVE_ARCHIVO=/ruta/a/privada.pem
```

En el CRM, crea las tutoras con los mismos correos que en Moodle (`tutora679@example.com`…)
y asígnales el campus en su ficha (Tutores › la tutora › Campus › Comprobar).

## 4. Instalar y conectar el plugin

1. `cd tools/moodle-local-crm && bash empaquetar.sh` → `local_crm-<versión>.zip`.
2. En Moodle: Administración › Extensiones › Instalar complementos › el ZIP.
3. En el CRM: Integraciones › el campus › Campus (Moodle) › **Conectar campus** → copia el código.
4. En Moodle: Extensiones locales › **Conectar con el CRM** → pega el código.

## 5. Qué probar

- **Chat directo:** como alumno, la actividad Chat del curso › «Entrar al chat» → su conversación
  privada con la tutora. Escribe y mira que llega a Consultas en el CRM.
- **Responder desde el CRM** y ver que llega a Moodle a nombre de la tutora (sin duplicados).
- **Relevo:** marca a Laura «No disponible» en su ficha del CRM → el alumno, al entrar al chat,
  va con Carmen; su mensaje entra en la MISMA consulta y pasa a Carmen (con el aviso de relevo).
- **Notas internas** y **respuestas guardadas / del campus** (Consultas › Respuestas del campus).
- **Mi campus** de la tutora: por corregir, dudas, alumnos sin entrar, «Ver el curso completo».
- **Corregir desde el CRM:** nota y comentario (aparecen en Moodle a su nombre); las tareas con
  escala o en grupo mandan a Moodle; un .html o .svg entregado se descarga, no se abre.
- **CRM caído:** con el backend parado, un alumno escribe → al arrancar, Moodle reintenta y llega.
- **Aviso perdido y repaso:** borra el aviso pendiente
  (`DELETE FROM mdl_task_adhoc WHERE classname LIKE '%avisar_crm%'`) y espera al repaso de 15
  minutos (o `MOODLE_SINCRONIZACION_TICK_MS` más bajo): el mensaje aparece y no se duplica.
- **Actualización automática:** sube `version`/`release` en `crm/version.php`,
  `cd backend && npm run plugin:publicar`, y en Moodle
  `php admin/cli/scheduled_task.php --execute='\local_crm\task\actualizar_plugin'` (como `daemon`).
  Con el manifiesto alterado a mano, debe decir «no trae una firma válida» y no instalar nada.
