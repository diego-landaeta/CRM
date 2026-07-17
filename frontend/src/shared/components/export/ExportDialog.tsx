import { useEffect, useMemo, useState } from 'react';
import { X, FileXls, FileCsv, FileCode, ArrowUp, ArrowDown, FloppyDisk, Trash, DownloadSimple } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';
import { toast } from '@/shared/hooks/useToast';
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  runExport,
  type ExportColumn,
  type ExportColumnConfig,
  type ExportFormat,
  type ExportTemplate,
} from '@/shared/lib/export';

interface Props<T> {
  open: boolean;
  onClose: () => void;
  context: string;
  filename: string;
  title?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  /** Bloque opcional de "alcance" (p.ej. selector de proyectos + con/sin filtros)
   *  que se muestra arriba del todo. Lo controla el padre. */
  scope?: React.ReactNode;
  defaultFormat?: ExportFormat;
}

function defaultConfig<T>(columns: ExportColumn<T>[]): ExportColumnConfig[] {
  return columns.map((c) => ({ key: c.key, label: c.label, included: true }));
}

const FORMAT_META: Record<ExportFormat, { label: string; icon: typeof FileXls; ext: string }> = {
  xlsx: { label: 'Excel (XLSX)', icon: FileXls, ext: '.xlsx' },
  csv: { label: 'CSV', icon: FileCsv, ext: '.csv' },
  json: { label: 'JSON', icon: FileCode, ext: '.json' },
};

export default function ExportDialog<T>({
  open, onClose, context, filename, title,
  columns, rows, defaultFormat = 'xlsx', scope,
}: Props<T>) {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [config, setConfig] = useState<ExportColumnConfig[]>(() => defaultConfig(columns));
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [tplName, setTplName] = useState('');

  // Refrescar plantillas al abrir y resetear estado.
  useEffect(() => {
    if (!open) return;
    setFormat(defaultFormat);
    setConfig(defaultConfig(columns));
    setTemplates(listTemplates(context));
    setShowSaveTpl(false);
    setTplName('');
  }, [open, context, defaultFormat, columns]);

  // Bloquear el scroll del fondo mientras el diálogo está abierto (evita que la
  // rueda del ratón mueva la tabla de detrás cuando llegas al final de la lista).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const includedCount = useMemo(() => config.filter((c) => c.included).length, [config]);

  function toggle(idx: number) {
    setConfig((prev) => prev.map((c, i) => i === idx ? { ...c, included: !c.included } : c));
  }
  function rename(idx: number, label: string) {
    setConfig((prev) => prev.map((c, i) => i === idx ? { ...c, label } : c));
  }
  function move(idx: number, dir: -1 | 1) {
    setConfig((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function selectAll(included: boolean) {
    setConfig((prev) => prev.map((c) => ({ ...c, included })));
  }

  function applyTemplate(tpl: ExportTemplate) {
    const byKey = new Map(tpl.columns.map((c) => [c.key, c]));
    // Mantener solo claves que aún existen en `columns`; añadir las nuevas al final.
    const known = new Set(columns.map((c) => c.key));
    const fromTpl = tpl.columns.filter((c) => known.has(c.key));
    const seen = new Set(fromTpl.map((c) => c.key));
    const extras = columns
      .filter((c) => !seen.has(c.key))
      .map<ExportColumnConfig>((c) => ({ key: c.key, label: c.label, included: false }));
    setConfig([...fromTpl.map((c) => ({ ...c, label: byKey.get(c.key)?.label || c.label })), ...extras]);
    setFormat(tpl.format);
    toast({ title: 'Plantilla aplicada', description: tpl.name });
  }

  function handleSaveTemplate() {
    const name = tplName.trim();
    if (!name) {
      toast({ title: 'Pon un nombre a la plantilla', variant: 'destructive' });
      return;
    }
    const tpl = saveTemplate({ name, context, format, columns: config });
    setTemplates(listTemplates(context));
    setShowSaveTpl(false);
    setTplName('');
    toast({ title: 'Plantilla guardada', description: tpl.name });
  }

  function handleDeleteTemplate(id: string) {
    deleteTemplate(id);
    setTemplates(listTemplates(context));
  }

  async function handleExport() {
    if (includedCount === 0) {
      toast({ title: 'Selecciona al menos una columna', variant: 'destructive' });
      return;
    }
    if (rows.length === 0) {
      toast({ title: 'Sin datos para exportar', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await runExport({
        context,
        filename,
        format,
        columns,
        config,
        rows,
      });
      toast({ title: `${rows.length} filas exportadas`, description: `${filename}${FORMAT_META[format].ext}` });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      toast({ title: 'Error al exportar', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 !m-0 z-[80] flex items-center justify-center sm:p-4">
        <div className="fixed inset-0 !m-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div role="dialog" aria-modal="true" aria-label={title || 'Exportar'}
          className="relative bg-card sm:rounded-lg border border-border w-full max-w-2xl flex flex-col max-h-[90vh]">
          <header className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <DownloadSimple size={18} weight="regular" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{title || 'Exportar'}</h2>
                <p className="text-xs text-muted-foreground"><strong className="text-foreground">{rows.length.toLocaleString('es-ES')}</strong> filas · {includedCount}/{columns.length} columnas · listo para Excel</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0">
              <X size={16} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
            {/* Alcance (proyectos / con-sin filtros) — lo aporta el padre */}
            {scope}

            {/* Formato */}
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-2">Formato</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.keys(FORMAT_META) as ExportFormat[]).map((f) => {
                  const meta = FORMAT_META[f];
                  const Icon = meta.icon;
                  const active = format === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`h-12 rounded-md border px-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card hover:bg-muted'
                      }`}
                    >
                      <Icon size={18} weight={active ? 'fill' : 'regular'} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Plantillas */}
            {templates.length > 0 && (
              <section>
                <p className="text-xs font-medium text-muted-foreground mb-2">Plantillas guardadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 pr-1">
                      <button
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="px-2.5 py-1 text-xs font-medium hover:underline"
                      >
                        {tpl.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar plantilla ${tpl.name}`}
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="p-1 rounded text-muted-foreground hover:text-red-600"
                      >
                        <Trash size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Columnas */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div><p className="text-xs font-medium text-foreground">Columnas del archivo</p><p className="text-[11px] text-muted-foreground">Marca las que quieres · arrastra con ↑↓ para ordenar</p></div>
                <div className="flex gap-1.5 text-[11px]">
                  <button type="button" onClick={() => selectAll(true)} className="text-primary hover:underline">Todas</button>
                  <span className="text-muted-foreground/60">·</span>
                  <button type="button" onClick={() => selectAll(false)} className="text-muted-foreground hover:underline">Ninguna</button>
                </div>
              </div>
              <div className="border border-border rounded-md divide-y divide-border max-h-72 overflow-y-auto overscroll-contain">
                {config.map((c, idx) => (
                  <div key={c.key} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30">
                    <input
                      type="checkbox"
                      checked={c.included}
                      onChange={() => toggle(idx)}
                      aria-label={`Incluir columna ${c.label}`}
                      className="rounded border-border"
                    />
                    <input
                      type="text"
                      value={c.label}
                      onChange={(e) => rename(idx, e.target.value)}
                      disabled={!c.included}
                      aria-label={`Etiqueta de columna ${c.key}`}
                      className="flex-1 h-8 px-2 rounded border border-transparent bg-transparent text-sm focus:border-border focus:bg-card outline-none disabled:opacity-50"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground w-32 truncate hidden sm:inline" title={c.key}>{c.key}</span>
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Subir" className="p-0.5 rounded hover:bg-muted disabled:opacity-20">
                        <ArrowUp size={11} />
                      </button>
                      <button type="button" onClick={() => move(idx, 1)} disabled={idx === config.length - 1} aria-label="Bajar" className="p-0.5 rounded hover:bg-muted disabled:opacity-20">
                        <ArrowDown size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Guardar plantilla */}
            <section>
              {!showSaveTpl ? (
                <button
                  type="button"
                  onClick={() => setShowSaveTpl(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <FloppyDisk size={12} weight="bold" /> Guardar configuración como plantilla
                </button>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md border border-border">
                  <input
                    autoFocus
                    type="text"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); }}
                    placeholder="Nombre de la plantilla"
                    className="flex-1 h-9 px-3 rounded-md border border-border bg-card text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSaveTpl(false); setTplName(''); }}
                    className="h-9 px-3 rounded-md border border-border bg-card text-xs font-medium hover:bg-muted"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </section>
          </div>

          <footer className="flex justify-end gap-2 p-4 border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || includedCount === 0 || rows.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              <DownloadSimple size={14} weight="bold" />
              {loading ? 'Exportando…' : `Exportar ${FORMAT_META[format].label}`}
            </button>
          </footer>
        </div>
      </div>
    </Portal>
  );
}
