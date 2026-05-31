# Claude — Carpeta de handoff

Esta carpeta contiene **todo lo que necesita saber un dev o una IA** que llega por primera vez a este repo.

## 📖 Leé en este orden

1. **[HANDOFF.md](./HANDOFF.md)** — entry point: stack, infra, credenciales (placeholders), deploy, convenciones, pitfalls
2. **[MODULES.md](./MODULES.md)** — tabla módulo por módulo (33 backend + 35 frontend): qué hace, files clave, endpoints, gotchas
3. **[CURRENT-STATE.md](./CURRENT-STATE.md)** — snapshot operativo (cifras DB, integraciones activas, qué está deployado)
4. **[CHANGELOG.md](./CHANGELOG.md)** — log cronológico de commits importantes
5. **[RECENT-WORK-2026-05.md](./RECENT-WORK-2026-05.md)** — resumen del trabajo de mayo 2026 en lenguaje funcional

## 📁 Archivos de memoria persistente (Claude Code memory)

| Tipo | Qué contiene |
|---|---|
| `user_*.md` | Perfil del usuario (Diego), preferencias |
| `feedback_*.md` | Correcciones/decisiones que no debo repetir |
| `project_*.md` | Estado del proyecto, sesiones de trabajo, backlog, pendientes |
| `reference_*.md` | Credenciales/paths/URLs externos (sanitizados — valores reales en 1Password) |

## 📂 Subcarpetas heredadas

- `bugs/` — bugs reportados históricos
- `database/` — SQL exportado (schemas + datos seed) — ver `feedback_db_tracking.md` para uso
- `documentacion/` — documentación temprana del proyecto
- `fase-1/`, `fase-2/`, `fase-3/` — planes de las fases iniciales (referencia histórica)
- `features/` — docs por feature (crear sólo cuando se retoma una feature, no placeholders muertos — ver `feedback_features_docs.md`)

## 🧭 Archivos sueltos importantes

- `BACKEND-PENDIENTE.md` — pendientes de backend (puede estar desactualizado, contrastar con CHANGELOG.md)
- `PLAN-TRABAJO.md` — plan general inicial
- `MANUAL-USUARIO.md` — manual de usuario del CRM
- `REVISAR.md` — items a revisar antes de cerrar fase
- `vps-72.60.90.135-handoff.md` — handoff específico del **segundo VPS** (donde vive CRM-ISEIE, no este repo)

## ⚠️ Reglas para mantener la carpeta sana

1. **Cuando termines un trabajo:** actualizá `CHANGELOG.md` con tus commits + `CURRENT-STATE.md` si cambió cifras/módulos
2. **Cuando descubras un pitfall nuevo:** agregalo a `HANDOFF.md` sección "Pitfalls conocidos" para que el próximo no lo sufra
3. **Credenciales:** NUNCA en plano. Usar placeholder `<<NOMBRE_KEY>>` y referenciar 1Password/Bitwarden
4. **Memoria persistente** (`user_*`, `feedback_*`, `project_*`): formato YAML frontmatter + cuerpo. Ver ejemplos.

## 🤝 Cuando pasás trabajo a otro dev/IA

Decile literalmente: "Leé `Claude/HANDOFF.md` y `Claude/MODULES.md` antes de tocar nada". Eso es 80% del contexto.
