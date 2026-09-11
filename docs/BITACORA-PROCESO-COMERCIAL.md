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
