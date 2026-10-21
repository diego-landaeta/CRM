import { useMemo } from 'react';
import { CheckCircle, MinusCircle, GraduationCap, ChatCircleText } from '@phosphor-icons/react';
import type { McpHerramienta, McpMoodleCampus } from '../api/mcp.api';

/**
 * «Consultas disponibles» de Conexión → MCP: lo que Claude puede preguntarle al
 * CRM, agrupado por apartado (campus y prospectos, ventas, tutores, catálogo,
 * Moodle, informes) en vez de una lista plana de veinte. El apartado de Moodle
 * (#335) además dice en qué campus hay un Moodle conectado y da ejemplos de
 * preguntas.
 */

/** La primera frase de la descripción: lo que hace la consulta, en una línea. */
const resumen = (descripcion: string) => `${descripcion.split('. ')[0].replace(/\.$/, '')}.`;

const GRUPO_MOODLE = 'Moodle de los campus';

const EJEMPLOS_MOODLE = [
  '¿Qué cursos tenemos activos en Psiko?',
  '¿Cuántos alumnos hay en el curso de Inteligencia Emocional?',
  '¿Tienen recursos externos los cursos de la categoría Fono Aprende?',
  '¿Qué tiene el módulo 3 del curso de Psiconeuroinmunología?',
];

function Consulta({ h }: { h: McpHerramienta }) {
  return (
    <li className="text-sm leading-snug">
      <span className="font-semibold">{h.titulo}</span>
      <span className="block text-muted-foreground">{resumen(h.descripcion)}</span>
    </li>
  );
}

function BloqueMoodle({ consultas, campus, puedeAdministrar }: { consultas: McpHerramienta[]; campus: McpMoodleCampus[]; puedeAdministrar: boolean }) {
  const conectados = campus.filter((c) => c.configurado);
  const sinConectar = campus.filter((c) => !c.configurado);
  return (
    <section
      data-testid="consultas-moodle"
      className="md:col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4"
    >
      <header className="flex items-center gap-2">
        <GraduationCap size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold text-sm">{GRUPO_MOODLE}</h3>
        <span className="text-xs text-muted-foreground">{consultas.length} consultas · solo lectura</span>
      </header>

      <ul className="grid md:grid-cols-2 gap-x-6 gap-y-3">
        {consultas.map((h) => <Consulta key={h.nombre} h={h} />)}
      </ul>

      <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-border">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campus con Moodle conectado</h4>
          {campus.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes campus asignados.</p>
          ) : (
            <>
              {conectados.length > 0 && (
                <ul className="flex flex-wrap gap-2" data-testid="campus-moodle">
                  {conectados.map((c) => (
                    <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-2.5 py-1 text-xs font-medium text-success-soft-foreground">
                      <CheckCircle size={14} weight="fill" /> {c.nombre}
                    </li>
                  ))}
                </ul>
              )}
              {sinConectar.length > 0 && (
                <details className="text-xs text-muted-foreground" data-testid="campus-moodle-sin-conectar">
                  <summary className="cursor-pointer select-none inline-flex items-center gap-1.5">
                    <MinusCircle size={14} /> {sinConectar.length} campus sin conectar
                  </summary>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {sinConectar.map((c) => (
                      <li key={c.id} className="rounded-full border border-border bg-card px-2 py-0.5">{c.nombre}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">
            {conectados.length
              ? 'Un campus «sin conectar» responde «sin Moodle configurado»: no es un cero.'
              : 'Ningún campus tiene Moodle conectado: Claude contestará «sin Moodle configurado».'}
            {puedeAdministrar && ' Cada campus se conecta con un token de solo lectura en Configuración → Claves (super admin).'}
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pregúntale a Claude</h4>
          <ul className="space-y-1.5">
            {EJEMPLOS_MOODLE.map((e) => (
              <li key={e} className="flex items-start gap-1.5 text-sm">
                <ChatCircleText size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>«{e}»</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function ConsultasDisponibles({ herramientas, moodle, puedeAdministrar }: {
  herramientas: McpHerramienta[];
  moodle: McpMoodleCampus[];
  puedeAdministrar: boolean;
}) {
  // Los apartados, en el orden en que aparece su primera consulta.
  const grupos = useMemo(() => {
    const mapa = new Map<string, McpHerramienta[]>();
    for (const h of herramientas) {
      const g = h.grupo || 'Otras';
      mapa.set(g, [...(mapa.get(g) ?? []), h]);
    }
    return [...mapa.entries()];
  }, [herramientas]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3" data-testid="consultas-disponibles">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-sm">Consultas disponibles</h2>
        <span className="text-xs text-muted-foreground">{herramientas.length} consultas en {grupos.length} apartados</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {grupos.map(([nombre, consultas]) => (nombre === GRUPO_MOODLE ? (
          <BloqueMoodle key={nombre} consultas={consultas} campus={moodle} puedeAdministrar={puedeAdministrar} />
        ) : (
          <section key={nombre} className="rounded-lg border border-border p-3 space-y-2">
            <header className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">{nombre}</h3>
              <span className="text-xs text-muted-foreground">{consultas.length}</span>
            </header>
            <ul className="space-y-2">
              {consultas.map((h) => <Consulta key={h.nombre} h={h} />)}
            </ul>
          </section>
        )))}
      </div>
    </div>
  );
}
