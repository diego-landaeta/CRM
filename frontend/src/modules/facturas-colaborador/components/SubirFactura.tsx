import { useRef, useState } from 'react';
import { CheckCircle, Copy, FilePdf, UploadSimple, WarningCircle } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { Button } from '@/shared/components/ui/button';
import Field from '@/shared/components/ui/Field';
import FilaCampos from '@/shared/components/ui/FilaCampos';
import { inputClass } from '@/shared/lib/ui';
import { euros, type FacturaDelColaborador } from '../api/facturasColaborador.api';

/*
  La factura de un mes, tal como la ve el colaborador (#202): por su enlace
  personal o desde «Mi factura». Lo de la «Definición acordada · Diego, 01/10»
  → «Página del enlace»: quién, mes y empresa; lo acordado; «Factura a nombre
  de» con un botón para copiar los datos; el archivo, el importe (con lo
  acordado ya puesto) y el número de factura. Si el importe no coincide con lo
  acordado, se hace notar y se deja enviar.
*/

const TOPE = 10 * 1024 * 1024;
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png'];

function datosFiscales(f: FacturaDelColaborador) {
  const e = f.empresa;
  return [e.razon_social, e.nif ? `NIF ${e.nif}` : null, e.direccion, [e.cp, e.ciudad].filter(Boolean).join(' ') || null, e.pais]
    .filter(Boolean).join('\n');
}

const cuando = (iso: string) => {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `el ${dos(d.getDate())}/${dos(d.getMonth() + 1)} a las ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

export default function SubirFactura({ factura, alSubir }: {
  factura: FacturaDelColaborador;
  /** Manda el formulario; devuelve la factura ya recibida o lanza el error del servidor. */
  alSubir: (archivo: File, importe: string, numero: string) => Promise<void>;
}) {
  const f = factura;
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importe, setImporte] = useState(f.importe_acordado !== null ? String(f.importe_acordado).replace('.', ',') : '');
  const [numero, setNumero] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const importeNum = Number(importe.replace(/\./g, '').replace(',', '.'));
  const noCoincide = f.importe_acordado !== null && importe.trim() !== ''
    && Number.isFinite(importeNum) && Math.abs(importeNum - f.importe_acordado) > 0.005;

  function elegir(a: File | null | undefined) {
    setError(null);
    if (!a) return;
    if (!TIPOS.includes(a.type)) { setError('Tiene que ser un PDF o una foto JPG o PNG.'); return; }
    if (a.size > TOPE) { setError('El archivo pasa de 10 MB.'); return; }
    setArchivo(a);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(datosFiscales(f));
      toast({ title: 'Datos copiados' });
    } catch {
      toast({ title: 'No se pudieron copiar', description: 'Selecciónalos y cópialos a mano.', variant: 'destructive' });
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) { setError('Elige el archivo de tu factura.'); return; }
    if (!importe.trim()) { setError('Escribe el importe de tu factura.'); return; }
    if (!numero.trim()) { setError('Escribe el número de tu factura.'); return; }
    setEnviando(true);
    setError(null);
    try {
      // El servidor entiende «600,00» y «600.00»; los puntos de miles se quitan aquí.
      await alSubir(archivo, importe.replace(/\./g, ''), numero.trim());
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'No se pudo enviar la factura.');
    } finally {
      setEnviando(false);
    }
  }

  const cabecera = (
    <div className="flex flex-wrap items-center gap-3">
      {f.empresa.logo_url && <img src={f.empresa.logo_url} alt="" className="h-9 w-auto max-w-[120px] object-contain" />}
      <div className="min-w-0">
        <h2 className="text-seccion font-semibold">{f.colaborador} · {f.mes} · {f.empresa.razon_social}</h2>
        {f.importe_acordado !== null && (
          <p className="text-secundario text-muted-foreground">Importe acordado: <strong className="text-foreground">{euros(f.importe_acordado)}</strong></p>
        )}
      </div>
    </div>
  );

  // ── Estados en los que ya no se sube nada ──
  if (f.estado === 'recibida' && f.recibida) {
    return (
      <div className="space-y-4">
        {cabecera}
        <div className="rounded-lg bg-success-soft text-success-soft-foreground p-4 flex gap-3">
          <CheckCircle size={22} weight="fill" className="shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">Factura recibida {cuando(f.recibida.subida_at)} · {f.recibida.numero_recepcion}</p>
            <p className="text-secundario">
              {f.recibida.archivo} · {euros(f.recibida.importe)} · n.º {f.recibida.numero_factura}
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (f.estado === 'anulada') {
    return (
      <div className="space-y-4">
        {cabecera}
        <Aviso>Esta factura se anuló. Te llegará un enlace nuevo para subirla otra vez.</Aviso>
      </div>
    );
  }
  if (f.estado === 'caducado') {
    return (
      <div className="space-y-4">
        {cabecera}
        <Aviso>Este enlace ha caducado. Pide uno nuevo a administración.</Aviso>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      {cabecera}

      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-secundario text-muted-foreground">Factura a nombre de</p>
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            <Copy size={13} className="mr-1.5" /> Copiar datos
          </Button>
        </div>
        <p className="whitespace-pre-line text-sm">{datosFiscales(f)}</p>
      </div>

      <Field label="Archivo de tu factura" hint="PDF o foto (JPG, PNG), hasta 10 MB" required>
        <div
          role="button"
          tabIndex={0}
          aria-label="Elegir el archivo de la factura"
          onClick={() => entrada.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]); }}
          className={`flex items-center gap-3 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors ${
            arrastrando ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
          }`}
        >
          {archivo ? <FilePdf size={22} className="text-primary shrink-0" /> : <UploadSimple size={22} className="text-muted-foreground shrink-0" />}
          <span className="text-sm min-w-0 truncate">
            {archivo ? `${archivo.name} · ${Math.ceil(archivo.size / 1024)} KB` : 'Arrástralo aquí o pulsa para elegirlo'}
          </span>
          <input
            ref={entrada}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => elegir(e.target.files?.[0])}
          />
        </div>
      </Field>

      <FilaCampos>
        <Field label="Importe de tu factura (€)" htmlFor="factura-importe" required
          hint={noCoincide ? undefined : (f.importe_acordado !== null ? 'Ya puesto el acordado: cámbialo si tu factura dice otro' : undefined)}>
          <input id="factura-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)}
            placeholder="600,00" className={inputClass} />
        </Field>
        <Field label="Número de tu factura" htmlFor="factura-numero" required>
          <input id="factura-numero" value={numero} onChange={(e) => setNumero(e.target.value)}
            placeholder="F-2026-09" maxLength={60} className={inputClass} />
        </Field>
      </FilaCampos>

      {noCoincide && (
        <p className="rounded-md bg-warning-soft text-warning-soft-foreground px-3 py-2 text-secundario">
          El importe no coincide con lo acordado ({euros(f.importe_acordado)}). Puedes enviarla igual.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive-soft text-destructive-soft-foreground px-3 py-2 text-secundario">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {f.caduca_at && (
          <p className="text-secundario text-muted-foreground">
            El enlace es solo tuyo y caduca el {new Date(f.caduca_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}.
          </p>
        )}
        <Button type="submit" disabled={enviando} className="ml-auto">
          {enviando ? 'Enviando…' : 'Enviar factura'}
        </Button>
      </div>
    </form>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-warning-soft text-warning-soft-foreground p-4 flex gap-3">
      <WarningCircle size={22} weight="fill" className="shrink-0" />
      <p>{children}</p>
    </div>
  );
}
