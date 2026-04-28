import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash, Download } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { documentsApi } from '../api/documents.api';
import { useProjectContext } from '@/contexts/ProjectContext';

const inp = 'w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all';

const EMISOR_DEFAULT = {
  emisor_nombre: 'MIREIA JAREÑO MORAGA',
  emisor_nif: 'ES53762128L',
  emisor_direccion: 'C/Músico Mariano Puig Yago, 45\nTorrente, Valencia (46900)',
  emisor_telefono: '644 10 59 19',
};

export default function InvoiceForm({ onGenerated }) {
  const { activeProject } = useProjectContext();
  const [loading, setLoading] = useState(false);
  const { register, control, handleSubmit, watch } = useForm({
    defaultValues: {
      ...EMISOR_DEFAULT,
      fecha: new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'2-digit' }).replace(/\//g,'-'),
      iva_pct: 21,
      cliente_nombre: '',
      cliente_dni: '',
      cliente_direccion: '',
      notas: '',
      lineas: [{ descripcion: '', cantidad: 1, precio: '' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lineas' });
  const lineas = watch('lineas');
  const ivaPct = parseFloat(watch('iva_pct')) || 21;
  const subtotal = lineas.reduce((s, l) => s + (parseFloat(l.precio || 0) * parseInt(l.cantidad || 1)), 0);
  const iva = subtotal * (ivaPct / 100);
  const total = subtotal + iva;
  const fmt = n => n.toFixed(2) + ' €';

  async function onSubmit(data) {
    setLoading(true);
    try {
      const res = await documentsApi.generate(activeProject.id, 'invoice', data);
      if (res.success) {
        toast({ title: 'Factura generada', description: `Nº ${res.data.number}` });
        onGenerated?.(res.data);
      }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Emisor */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-4">Datos del emisor</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground mb-1 block">Nombre / Razón social</label>
            <input {...register('emisor_nombre')} className={inp}/></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">NIF</label>
            <input {...register('emisor_nif')} className={inp}/></div>
          <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Dirección</label>
            <textarea {...register('emisor_direccion')} rows={2} className={inp + ' h-auto py-2'}/></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Teléfono</label>
            <input {...register('emisor_telefono')} className={inp}/></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Fecha</label>
            <input {...register('fecha')} className={inp}/></div>
        </div>
      </div>

      {/* Cliente */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-4">Datos del cliente</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Nombre o Razón Social</label>
            <input {...register('cliente_nombre')} className={inp}/></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">DNI/NIF</label>
            <input {...register('cliente_dni')} className={inp}/></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Dirección</label>
            <input {...register('cliente_direccion')} className={inp}/></div>
        </div>
      </div>

      {/* Líneas */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-4">Conceptos</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-1">
            <span className="col-span-6">Descripción</span>
            <span className="col-span-2 text-center">Cantidad</span>
            <span className="col-span-3 text-center">Precio (€)</span>
            <span className="col-span-1"/>
          </div>
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 gap-2 items-center">
              <input {...register(`lineas.${i}.descripcion`)} className={inp + ' col-span-6'} placeholder="Descripción del servicio"/>
              <input {...register(`lineas.${i}.cantidad`)} type="number" min="1" className={inp + ' col-span-2 text-center'} defaultValue={1}/>
              <input {...register(`lineas.${i}.precio`)} type="number" step="0.01" className={inp + ' col-span-3 text-center'} placeholder="0,00"/>
              <button type="button" onClick={() => remove(i)} className="col-span-1 flex justify-center text-muted-foreground hover:text-red-500 transition-colors">
                <Trash size={14}/>
              </button>
            </div>
          ))}
          <button type="button" onClick={() => append({ descripcion: '', cantidad: 1, precio: '' })}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-2">
            <Plus size={13}/> Añadir línea
          </button>
        </div>

        {/* Totales */}
        <div className="mt-5 flex justify-end">
          <div className="w-64 border border-border rounded-md overflow-hidden text-sm">
            <div className="flex justify-between px-4 py-2 border-b border-border">
              <span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-2 border-b border-border items-center gap-2">
              <span className="text-muted-foreground">IVA</span>
              <div className="flex items-center gap-1">
                <input {...register('iva_pct')} type="number" className="w-12 h-7 text-center border border-border rounded text-xs bg-muted/50"/>
                <span className="text-xs">%</span>
                <span className="ml-2">{fmt(iva)}</span>
              </div>
            </div>
            <div className="flex justify-between px-4 py-2.5 font-bold">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-semibold text-sm mb-3">Notas / Datos bancarios</h3>
        <textarea {...register('notas')} rows={3} className={inp + ' h-auto py-2'} placeholder="IBAN, forma de pago, notas adicionales..."/>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
          <Download size={16}/>
          {loading ? 'Generando PDF...' : 'Generar Factura PDF'}
        </button>
      </div>
    </form>
  );
}
