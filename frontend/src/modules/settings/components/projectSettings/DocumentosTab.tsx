import { useCallback, useEffect, useRef, useState } from 'react';
import { FilePdf, UploadSimple, CheckCircle, WarningCircle, Download } from '@phosphor-icons/react';
import client from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';
import { lista } from '@/shared/lib/lista';

/**
 * Los documentos de la marca (#91).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PARA QUÉ SIRVEN, QUE NO ES OBVIO DESDE AQUÍ
 *
 * Van con el correo del día 1, junto al dossier del curso. El documento
 * comercial es tajante: «sin los tres, el correo no sale», y el CRM lo hace
 * cumplir — si falta alguno, el botón de enviar no deja.
 *
 * Por eso esta pantalla dice para qué sirve cada uno en vez de ser dos cajas
 * de subir archivos: quien entra aquí no tiene por qué saber que de estos dos
 * PDF depende que el equipo pueda mandar su primer correo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SON DE LA MARCA, NO DEL CURSO
 *
 * La guía del campus de una marca es la misma para sus veinte formaciones. El
 * dossier no: ese es de cada curso y se sube en su ficha. Aquí se dice también,
 * porque es la primera pregunta de quien vea que falta el dossier y no lo
 * encuentre en esta pantalla.
 */

interface Doc {
  id: number;
  tipo: string;
  filename_original: string;
  nombre_visible: string | null;
  version: number;
  created_at: string;
}

const LOS_DOS = [
  {
    tipo: 'guia_campus',
    titulo: 'Guía del campus virtual',
    para: 'Cómo entrar y moverse por el campus. Va en el correo del día 1.',
  },
  {
    tipo: 'homologaciones',
    titulo: 'Homologaciones y acreditaciones',
    para: 'Lo que respalda la titulación. Va en el mismo correo.',
  },
] as const;

export default function DocumentosTab({ project }: { project: { id: number; nombre?: string } }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await client.get(`/documentos-marca?projectId=${project.id}`);
      setDocs(lista(r?.success ? r.data : []));
    } finally { setCargando(false); }
  }, [project.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function subir(tipo: string, file: File) {
    setSubiendo(tipo);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('tipo', tipo);
      const r = await client.post(`/documentos-marca?projectId=${project.id}`, fd);
      if (r?.success) {
        toast({ title: 'Subido', description: 'Ya se puede mandar con el correo del día 1.' });
        await cargar();
      } else {
        toast({ title: 'No se pudo subir', description: r?.error, variant: 'destructive' });
      }
    } catch (e: unknown) {
      const err = e as { data?: { error?: string }; message?: string };
      toast({ title: 'No se pudo subir', description: err?.data?.error || err?.message, variant: 'destructive' });
    } finally { setSubiendo(null); }
  }

  async function descargar(id: number) {
    const r = await client.get(`/documentos-marca/${id}/enlace?projectId=${project.id}`);
    if (r?.success) window.open(r.data.url, '_blank', 'noopener');
  }

  const faltan = LOS_DOS.filter((d) => !docs.some((x) => x.tipo === d.tipo)).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Documentos de la marca</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Van con el correo del día 1 de cada prospecto, junto al dossier de su formación.
          Son los mismos para todos los cursos de {project.nombre || 'esta marca'}.
        </p>
      </div>

      {!cargando && faltan > 0 && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
          <WarningCircle size={14} className="mt-0.5 flex-shrink-0" weight="fill" />
          <span>
            Mientras falte alguno, <strong>el correo del día 1 no se puede enviar</strong> desde
            el CRM. Es la regla del documento comercial: van los tres o no sale.
          </span>
        </p>
      )}

      {cargando ? (
        <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />
      ) : (
        <ul className="space-y-3">
          {LOS_DOS.map((d) => {
            const puesto = docs.find((x) => x.tipo === d.tipo);
            return (
              <li key={d.tipo} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {puesto
                        ? <CheckCircle size={14} weight="fill" className="text-emerald-600 flex-shrink-0" />
                        : <WarningCircle size={14} weight="fill" className="text-amber-500 flex-shrink-0" />}
                      {d.titulo}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{d.para}</p>
                    {puesto && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <FilePdf size={11} />
                        <span className="truncate">{puesto.filename_original}</span>
                        <span>· versión {puesto.version}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {puesto && (
                      <button type="button" onClick={() => descargar(puesto.id)}
                        title="Ver el que está puesto"
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted">
                        <Download size={12} /> Ver
                      </button>
                    )}
                    <button type="button" onClick={() => inputs.current[d.tipo]?.click()}
                      disabled={subiendo === d.tipo}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
                      <UploadSimple size={12} />
                      {subiendo === d.tipo ? 'Subiendo…' : puesto ? 'Cambiar' : 'Subir'}
                    </button>
                    <input
                      ref={(el) => { inputs.current[d.tipo] = el; }}
                      type="file" accept="application/pdf" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) subir(d.tipo, f);
                      }}
                    />
                  </div>
                </div>
                {/* Al cambiarlo, el anterior no se borra: un correo que salió
                    hace dos meses llevaba el de entonces. */}
                {puesto && puesto.version > 1 && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Las {puesto.version - 1} versiones anteriores se conservan; los correos ya
                    enviados llevaban la suya.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        El tercer documento, el <strong>dossier</strong>, es de cada formación y se sube en su
        ficha del catálogo — no aquí, porque cambia de un curso a otro.
      </p>
    </div>
  );
}
