import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash, Download } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { documentsApi, type CrmDocument } from '../api/documents.api';
import { useProjectContext } from '@/contexts/ProjectContext';

const inp = 'w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all';

interface ModuloField {
  nombre: string;
}

interface CertificateFormValues {
  alumno_nombre: string;
  alumno_dni: string;
  curso_nombre: string;
  horas_total: string;
  modalidad: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_expedicion: string;
  ciudad: string;
  pais: string;
  director_nombre: string;
  resp_nombre: string;
  modulos: ModuloField[];
}

interface CertificateFormProps {
  onGenerated?: (doc: CrmDocument) => void;
}

export default function CertificateForm({ onGenerated }: CertificateFormProps) {
  const { activeProject } = useProjectContext();
  const [loading, setLoading] = useState(false);

  const { register, control, handleSubmit } = useForm<CertificateFormValues>({
    defaultValues: {
      alumno_nombre: '',
      alumno_dni: '',
      curso_nombre: '',
      horas_total: '',
      modalidad: 'Online',
      fecha_inicio: '',
      fecha_fin: '',
      fecha_expedicion: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
      ciudad: 'Valencia',
      pais: 'España',
      director_nombre: 'Carlos Saiz',
      resp_nombre: 'Mireia Jareño',
      modulos: [{ nombre: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'modulos' });

  async function onSubmit(data: CertificateFormValues): Promise<void> {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const payload = {
        ...data,
        modulos: data.modulos.map(m => m.nombre).filter(Boolean),
      };
      const res = await documentsApi.generate(activeProject.id, 'certificate', payload);
      if (res.success && res.data) {
        toast({ title: 'Certificado generado', description: `Nº ${res.data.number}` });
        onGenerated?.(res.data);
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Alumno */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-4">Datos del alumno</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Nombre completo *</label>
            <input {...register('alumno_nombre', { required: true })} className={inp} placeholder="Nombre Apellido Apellido"/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">DNI/NIE *</label>
            <input {...register('alumno_dni', { required: true })} className={inp} placeholder="12345678A"/>
          </div>
        </div>
      </div>

      {/* Curso */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-4">Datos del curso</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Nombre del diplomado/curso *</label>
            <input {...register('curso_nombre', { required: true })} className={inp} placeholder="Diplomado en Psicoterapia Integrativa"/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Horas totales</label>
            <input {...register('horas_total')} className={inp} placeholder="750"/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Modalidad</label>
            <input {...register('modalidad')} className={inp}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha inicio</label>
            <input {...register('fecha_inicio')} className={inp} placeholder="23 de Noviembre de 2025"/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha fin</label>
            <input {...register('fecha_fin')} className={inp} placeholder="20 de Abril de 2026"/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fecha expedición</label>
            <input {...register('fecha_expedicion')} className={inp}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ciudad</label>
            <input {...register('ciudad')} className={inp}/>
          </div>
        </div>
      </div>

      {/* Firmantes */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-4">Firmantes</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Director</label>
            <input {...register('director_nombre')} className={inp}/>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Responsable de Formación</label>
            <input {...register('resp_nombre')} className={inp}/>
          </div>
        </div>
      </div>

      {/* Módulos */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-4">Plan de estudios — Módulos</h3>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-16 shrink-0">Módulo {i + 1}</span>
              <input {...register(`modulos.${i}.nombre`)} className={inp} placeholder={`Nombre del módulo ${i + 1}`}/>
              <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                <Trash size={14}/>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => append({ nombre: '' })}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1">
            <Plus size={13}/> Añadir módulo
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
          <Download size={16}/>
          {loading ? 'Generando PDF...' : 'Generar Certificado PDF'}
        </button>
      </div>
    </form>
  );
}
