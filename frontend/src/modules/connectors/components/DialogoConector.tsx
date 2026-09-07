import { useState } from 'react';
import { X, Warning, CheckCircle } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';
import { toast } from '@/shared/hooks/useToast';
import {
  conectoresApi, TIPOS, DESTINOS, CAMPOS_POR_TIPO,
  type Conector, type TipoConector, type DestinoConector,
} from '../api/connectors.api';

/**
 * Alta y cambio de un conector (#6).
 *
 * LOS SECRETOS SE ESCRIBEN, NO SE LEEN
 *
 * `consumer_secret`, la contrasena de aplicacion y el token no vuelven nunca del
 * servidor — se tapan en el controlador. Asi que al editar salen VACIOS con la
 * nota de que ya hay uno guardado: dejarlo en blanco no lo cambia.
 *
 * Rellenarlos obligaria a traer el secreto entero al navegador solo por abrir un
 * dialogo, que es justo lo que se quito.
 */

interface Props {
  /** `null` = alta. Un conector = cambio. */
  conector: Conector | null;
  projectId: number;
  onCerrar: () => void;
  onGuardado: () => void;
}

export default function DialogoConector({ conector, projectId, onCerrar, onGuardado }: Props) {
  const esAlta = conector === null;

  const [tipo, setTipo] = useState<TipoConector>(conector?.type || 'woocommerce_products');
  const [destino, setDestino] = useState<DestinoConector>(conector?.destination || 'product');
  const [etiqueta, setEtiqueta] = useState(conector?.label || '');
  // Solo lo que NO es secreto viene relleno: es lo unico que el servidor manda.
  const [campos, setCampos] = useState<Record<string, string>>({ ...(conector?.config || {}) });
  const [guardando, setGuardando] = useState(false);

  const definicion = CAMPOS_POR_TIPO[tipo] || [];
  const yaGuardado = conector?.secretos_guardados || {};

  // Al cambiar de tipo en un alta, los campos del anterior no valen.
  const cambiarTipo = (t: TipoConector) => {
    setTipo(t);
    if (esAlta) setCampos({});
  };

  const falta = definicion.some((c) => {
    if (!c.requerido) return false;
    if (c.secreto) return esAlta ? !campos[c.clave] : !(campos[c.clave] || yaGuardado[c.clave]);
    return !campos[c.clave];
  });

  async function guardar() {
    if (!etiqueta.trim()) { toast({ title: 'Ponle un nombre', variant: 'destructive' }); return; }
    setGuardando(true);
    try {
      // Los secretos en blanco NO se mandan: el servidor fusiona, así que no
      // mandarlos deja el que había. Mandar '' lo borraría.
      const config: Record<string, string> = {};
      for (const c of definicion) {
        const v = (campos[c.clave] ?? '').trim();
        if (c.secreto && !v) continue;
        if (v) config[c.clave] = v;
      }

      const r = esAlta
        ? await conectoresApi.crear({ project_id: projectId, type: tipo, label: etiqueta.trim(), destination: destino, config })
        : await conectoresApi.cambiar(conector!.id, { label: etiqueta.trim(), destination: destino, config });

      if (!r.success) throw new Error((r as { error?: string }).error || 'no se pudo guardar');
      toast({
        title: esAlta ? 'Conector creado' : 'Conector guardado',
        description: esAlta ? 'Ahora puedes probar la conexión y ver qué trae.' : undefined,
      });
      onGuardado();
    } catch (e: any) {
      toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' });
    } finally { setGuardando(false); }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60" onClick={onCerrar}>
        <div
          role="dialog" aria-modal="true" aria-label={esAlta ? 'Nuevo conector' : 'Editar conector'}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="font-semibold">{esAlta ? 'Nuevo conector' : 'Editar conector'}</h2>
            <button type="button" onClick={onCerrar} aria-label="Cerrar"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Nombre</span>
              <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}
                placeholder="Tienda de Psiko Aprende"
                className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-border bg-background" />
              <span className="text-[11px] text-muted-foreground">Para reconocerlo en la lista.</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">De dónde trae</span>
                <select value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoConector)}
                  disabled={!esAlta}
                  title={esAlta ? undefined : 'El tipo no se cambia: crea otro conector'}
                  className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-border bg-background disabled:opacity-60">
                  {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Dónde acaba</span>
                <select value={destino} onChange={(e) => setDestino(e.target.value as DestinoConector)}
                  className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-border bg-background">
                  {DESTINOS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </label>
            </div>

            <div className="space-y-3 pt-1">
              {definicion.map((c) => (
                <label key={c.clave} className="block">
                  <span className="text-xs font-medium text-muted-foreground">
                    {c.label}{c.requerido && ' *'}
                  </span>
                  <input
                    type={c.secreto ? 'password' : 'text'}
                    value={campos[c.clave] ?? ''}
                    onChange={(e) => setCampos((p) => ({ ...p, [c.clave]: e.target.value }))}
                    placeholder={c.secreto && yaGuardado[c.clave] ? '•••••••• guardado' : (c.ayuda || '')}
                    autoComplete="off"
                    className="mt-1 w-full text-sm px-3 py-2 rounded-lg border border-border bg-background font-mono" />
                  {c.secreto && yaGuardado[c.clave] ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 mt-0.5">
                      <CheckCircle size={11} weight="fill" /> Ya hay uno guardado. Déjalo vacío para no cambiarlo.
                    </span>
                  ) : c.ayuda ? (
                    <span className="text-[11px] text-muted-foreground">{c.ayuda}</span>
                  ) : null}
                </label>
              ))}
            </div>

            {/* El texto va en su propio <span>: si se deja suelto, el <strong>
                pasa a ser OTRO hijo del flex y se va a una columna aparte. */}
            <p className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted rounded-lg p-2.5">
              <Warning size={13} className="mt-0.5 shrink-0" />
              <span>
                Las claves se guardan en el servidor y no se vuelven a mostrar. Este conector
                solo <strong>lee</strong>: el CRM nunca escribe en el sitio de origen.
              </span>
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            <button type="button" onClick={onCerrar}
              className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted">
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando || falta || !etiqueta.trim()}
              title={falta ? 'Faltan campos obligatorios' : undefined}
              className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Guardando…' : esAlta ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
