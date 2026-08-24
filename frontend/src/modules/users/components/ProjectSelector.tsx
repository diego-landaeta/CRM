import type { Project } from '@/shared/types';
import type { ProjectAssignment } from '../api/users.api';

interface Props {
  projects: Project[];
  selected: ProjectAssignment[];
  role: string;
  onToggle: (projectId: number) => void;
  onToggleRecibeLeads: (projectId: number) => void;
  required?: boolean;
}

/**
 * Proyectos a los que accede el usuario, y en cuales entra en el reparto.
 *
 * Lo que hace de verdad el round-robin, en lead.model.js:
 *
 *     AND (u.role = 'gestor' OR (u.role IN ('admin','superadmin')
 *          AND up.recibe_leads = TRUE))
 *
 *  · gestor              — recibe siempre, el flag ni se mira
 *  · admin / superadmin  — solo si el flag esta marcado en ese proyecto
 *  · soporte / tutor     — no entran nunca en el reparto
 *
 * Por eso el interruptor solo sale para admin, y al gestor se le pinta fijo:
 * ensenar un interruptor que no cambia nada es peor que no ensenar ninguno.
 */
export default function ProjectSelector({
  projects, selected, role, onToggle, onToggleRecibeLeads, required = false,
}: Props) {
  const mostrarToggle = role === 'admin';

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block px-1">
        Proyectos asignados{required && ' *'}
      </label>
      <p className="text-[11px] text-muted-foreground mb-2 px-1">
        {required
          ? 'Selecciona al menos un proyecto al que tendrá acceso.'
          : 'Selecciona los proyectos a los que tendrá acceso.'}
        {mostrarToggle && ' Marca "Recibe leads" para incluirlo en el reparto de ese proyecto.'}
      </p>
      <div className="space-y-1.5 mt-2">
        {projects.map((p) => {
          const sel = selected.find((s) => s.projectId === p.id);
          const marcado = !!sel;
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
            >
              <label className="flex items-center gap-2 cursor-pointer text-sm flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => onToggle(p.id)}
                  className="rounded border-border accent-primary w-4 h-4 flex-shrink-0"
                />
                <span className="truncate">{p.nombre}</span>
              </label>
              {marcado && (mostrarToggle ? (
                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={!!sel?.recibeLeads}
                    onChange={() => onToggleRecibeLeads(p.id)}
                    className="rounded border-border accent-emerald-600 w-3.5 h-3.5"
                  />
                  <span>Recibe leads</span>
                </label>
              ) : role === 'gestor' ? (
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded flex-shrink-0">
                  Recibe leads
                </span>
              ) : null)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
