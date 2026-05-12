import { useEffect, useState, useCallback, useRef } from 'react';
import { useProjectContext } from '@/contexts/ProjectContext';
import client from '@/shared/api/client';
import PageHeader from '@/shared/components/ui/PageHeader';
import EmptyState from '@/shared/components/ui/EmptyState';
import SkeletonTable from '@/shared/components/ui/SkeletonTable';
import { ShoppingBag, FloppyDisk, ArrowsClockwise, Eye } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';

type SourceStrategy = 'wc_only' | 'wc_plus_cpt';
type ScrapeStrategy = 'plain_text' | 'preserve_html';

interface WooCredentials {
  store_url: string;
  consumer_key: string;
  consumer_secret?: string;
  auto_sync_enabled?: boolean;
  sync_interval_minutes?: number;
  default_currency?: string;
  wp_user?: string | null;
  wp_app_password?: string | null;
  source_strategy?: SourceStrategy;
  cpt_endpoints?: string[];
  scraper_enabled?: boolean;
  scrape_strategy?: ScrapeStrategy;
  section_keywords?: Record<string, string[]>;
}

interface WooForm {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  default_currency: string;
  wp_user: string;
  wp_app_password: string;
  source_strategy: SourceStrategy;
  cpt_endpoints: string[];
  scraper_enabled: boolean;
  scrape_strategy: ScrapeStrategy;
  section_keywords: Record<string, string[]>;
}

const DEFAULT_SECTION_KEYWORDS: Record<string, string[]> = {
  presentacion: ['presentaci'],
  objetivos: ['objetivo'],
  beneficios: ['beneficio'],
  dirigido_a: ['dirigido', 'para quien', 'a quien'],
  para_que_te_prepara: ['te prepara', 'salidas profesionales'],
  por_que_estudiar: ['por que estudiar', 'por que elegir'],
  modulos: ['contenido del', 'temario del', 'programa del', 'syllabus', 'temario', 'contenido', 'modulos', 'modulo', 'unidades', 'unidad'],
  metodologia: ['metodologi'],
  faqs: ['pregunta frecuente', 'faq', 'dudas'],
  profesores: ['profesor', 'docente', 'instructor', 'claustro', 'profesorado'],
};

const CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN', 'COP', 'ARS', 'CLP', 'PEN', 'BOB', 'VES', 'BRL', 'JPY', 'CHF'];

type RunStatus = 'success' | 'error' | 'running' | string;

interface WooRun {
  id: number;
  started_at: string;
  status: RunStatus;
  total_fetched: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  error_message?: string | null;
}

interface SchemaItem { path: string; type: string; sample?: any }
interface TargetField { key: string; label: string; type: string; required?: boolean; group: string }

interface WooPreview {
  count: number;
  sample: any[];
  schema?: SchemaItem[];
  targets?: TargetField[];
  sugeridos?: Record<string, string>;
  current_mapping?: Record<string, string>;
  mapped_preview?: Record<string, any>;
}

export default function WooCommercePage() {
  const { activeProject } = useProjectContext();
  const [creds, setCreds] = useState<WooCredentials | null>(null);
  const [form, setForm] = useState<WooForm>({
    store_url: '', consumer_key: '', consumer_secret: '',
    auto_sync_enabled: false, sync_interval_minutes: 30, default_currency: 'EUR',
    wp_user: '', wp_app_password: '',
    source_strategy: 'wc_only', cpt_endpoints: [],
    scraper_enabled: false, scrape_strategy: 'plain_text',
    section_keywords: DEFAULT_SECTION_KEYWORDS,
  });
  const [testUrl, setTestUrl] = useState('');
  const [scrapePreview, setScrapePreview] = useState<any | null>(null);
  const [scrapingPreview, setScrapingPreview] = useState(false);
  const [runs, setRuns] = useState<WooRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<WooPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savingMapping, setSavingMapping] = useState(false);
  const reloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
  }, []);

  const load = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        client.get(`/woocommerce/credentials?projectId=${activeProject.id}`),
        client.get(`/woocommerce/runs?projectId=${activeProject.id}`),
      ]);
      if (c.success) {
        const data = c.data as WooCredentials | null;
        setCreds(data);
        if (data) setForm({
          store_url: data.store_url,
          consumer_key: data.consumer_key,
          consumer_secret: '',
          auto_sync_enabled: data.auto_sync_enabled || false,
          sync_interval_minutes: data.sync_interval_minutes || 30,
          default_currency: data.default_currency || 'EUR',
          wp_user: data.wp_user || '',
          wp_app_password: '',
          source_strategy: data.source_strategy || 'wc_only',
          cpt_endpoints: Array.isArray(data.cpt_endpoints) ? data.cpt_endpoints : [],
          scraper_enabled: !!data.scraper_enabled,
          scrape_strategy: data.scrape_strategy || 'plain_text',
          section_keywords: data.section_keywords || DEFAULT_SECTION_KEYWORDS,
        });
      }
      if (r.success) setRuns((r.data as WooRun[]) || []);
    } finally { setLoading(false); }
  }, [activeProject?.id]);

  useEffect(() => { load(); }, [load]);

  async function saveCreds(): Promise<void> {
    if (!activeProject?.id) return;
    try {
      await client.put('/woocommerce/credentials', { project_id: activeProject.id, ...form });
      toast({ title: 'Credenciales guardadas' });
      load();
    } catch (err: any) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }
  async function importNow(): Promise<void> {
    if (!activeProject?.id) return;
    setImporting(true);
    try {
      await client.post(`/woocommerce/runs/start?projectId=${activeProject.id}`);
      toast({ title: 'Import iniciado en background' });
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = setTimeout(load, 3000);
    } catch (err: any) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
    finally { setImporting(false); }
  }
  async function preview(): Promise<void> {
    if (!activeProject?.id) return;
    try {
      const res = await client.get(`/woocommerce/preview?projectId=${activeProject.id}`);
      if (res.success && res.data) {
        const data = res.data as WooPreview;
        setPreviewData(data);
        // Si hay mapping guardado úsalo, si no usa los sugeridos
        const initial = (data.current_mapping && Object.keys(data.current_mapping).length > 0)
          ? data.current_mapping
          : (data.sugeridos || {});
        setMapping(initial);
        toast({ title: `${data.count} productos en la tienda`, description: `Configura el mapeo abajo y guárdalo antes de importar` });
      }
    } catch (err: any) { toast({ title: 'Error', description: err?.data?.error, variant: 'destructive' }); }
  }

  async function saveMapping(): Promise<void> {
    if (!activeProject?.id) return;
    setSavingMapping(true);
    try {
      await client.put(`/woocommerce/mapping?projectId=${activeProject.id}`, { field_mapping: mapping });
      toast({ title: 'Mapeo guardado', description: 'Se aplicará en la próxima importación' });
      // Refrescar preview para ver mapped_preview con los cambios
      await preview();
    } catch (err: any) {
      toast({ title: 'Error guardando mapeo', description: err?.message || 'Error desconocido', variant: 'destructive' });
    } finally {
      setSavingMapping(false);
    }
  }

  function updateMapping(crmField: string, sourcePath: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (sourcePath) next[crmField] = sourcePath;
      else delete next[crmField];
      return next;
    });
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="WooCommerce" subtitle="Importar productos desde tu tienda" />

      <div className="bg-card border border-border rounded-2xl p-5 max-w-2xl space-y-3">
        <h3 className="font-bold">Credenciales</h3>
        <input value={form.store_url} onChange={e => setForm({ ...form, store_url: e.target.value })} placeholder="https://tu-tienda.com" className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
        <input value={form.consumer_key} onChange={e => setForm({ ...form, consumer_key: e.target.value })} placeholder="Consumer key (ck_...)" className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-mono text-xs" />
        <input value={form.consumer_secret} onChange={e => setForm({ ...form, consumer_secret: e.target.value })} type="password" placeholder={creds ? '(sin cambios — dejar vacio para mantener)' : 'Consumer secret (cs_...)'} className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-mono text-xs" />

        <label className="block text-xs">
          <span className="font-bold uppercase text-muted-foreground">Divisa por defecto</span>
          <select
            value={form.default_currency}
            onChange={e => setForm({ ...form, default_currency: e.target.value })}
            className="mt-1 w-40 h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Se aplicará a TODOS los productos importados de esta tienda. WooCommerce no expone la moneda por producto en su API estándar.
          </p>
        </label>

        <div className="pt-3 border-t border-border space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.auto_sync_enabled} onChange={e => setForm({ ...form, auto_sync_enabled: e.target.checked })} />
            <strong>Sincronización automática</strong>
          </label>
          {form.auto_sync_enabled && (
            <label className="block text-xs">
              <span className="font-bold uppercase text-muted-foreground">Cada cuantos minutos</span>
              <input type="number" min="5" max="1440" value={form.sync_interval_minutes} onChange={e => setForm({ ...form, sync_interval_minutes: Number(e.target.value) })} className="mt-1 w-32 h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm" />
            </label>
          )}
          <p className="text-xs text-muted-foreground">{form.auto_sync_enabled ? `El servidor revisa cada ${form.sync_interval_minutes} min y solo importa si cambia la cantidad de productos en WC.` : 'Sin auto-sync: deberas pulsar "Importar ahora" manualmente.'}</p>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <h4 className="text-xs font-bold uppercase text-muted-foreground">WordPress REST API (para ACF / CPTs)</h4>
          <input
            value={form.wp_user}
            onChange={e => setForm({ ...form, wp_user: e.target.value })}
            placeholder="Usuario WP admin (p.ej. SEOdiego)"
            className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm"
          />
          <input
            value={form.wp_app_password}
            onChange={e => setForm({ ...form, wp_app_password: e.target.value })}
            type="password"
            placeholder={creds?.wp_user ? '(sin cambios — dejar vacío para mantener)' : 'Application Password de WP'}
            className="w-full h-10 px-3 rounded-lg border border-border bg-muted/30 text-sm font-mono text-xs"
          />

          <label className="block text-xs">
            <span className="font-bold uppercase text-muted-foreground">Estrategia de origen</span>
            <select
              value={form.source_strategy}
              onChange={e => setForm({ ...form, source_strategy: e.target.value as SourceStrategy })}
              className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm"
            >
              <option value="wc_only">Solo WooCommerce ( /wc/v3/products )</option>
              <option value="wc_plus_cpt">WC + Custom Post Types (cursos, masters, diplomados…)</option>
            </select>
          </label>

          {form.source_strategy === 'wc_plus_cpt' && (
            <label className="block text-xs">
              <span className="font-bold uppercase text-muted-foreground">CPT endpoints (uno por línea — sin /wp/v2/)</span>
              <textarea
                value={form.cpt_endpoints.join('\n')}
                onChange={e => setForm({ ...form, cpt_endpoints: e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) })}
                placeholder={'cursos\nmasters\ndiplomados'}
                rows={4}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Se llamará a {`{store_url}`}/wp-json/wp/v2/{`{slug}`} con el WP user/App Password.</p>
            </label>
          )}
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.scraper_enabled}
              onChange={e => setForm({ ...form, scraper_enabled: e.target.checked })}
            />
            <strong>Scraper HTML del permalink</strong>
            <span className="text-[10px] text-muted-foreground">— extrae presentación, módulos, FAQs, etc. de cada producto</span>
          </label>

          {form.scraper_enabled && (
            <>
              <label className="block text-xs">
                <span className="font-bold uppercase text-muted-foreground">Formato extraído</span>
                <select
                  value={form.scrape_strategy}
                  onChange={e => setForm({ ...form, scrape_strategy: e.target.value as ScrapeStrategy })}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-muted/30 text-sm"
                >
                  <option value="plain_text">Texto plano (recomendado)</option>
                  <option value="preserve_html">Conservar HTML (formato rico)</option>
                </select>
              </label>

              <details className="text-xs">
                <summary className="cursor-pointer font-semibold">Keywords por sección (clic para editar)</summary>
                <div className="mt-2 space-y-2 max-h-80 overflow-auto p-2 bg-muted/30 rounded">
                  {Object.keys(form.section_keywords).map((key) => (
                    <div key={key} className="grid grid-cols-[140px_1fr] gap-2 items-start">
                      <label className="text-[11px] font-mono">{key}</label>
                      <input
                        value={form.section_keywords[key].join(', ')}
                        onChange={(e) => {
                          const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setForm({ ...form, section_keywords: { ...form.section_keywords, [key]: arr } });
                        }}
                        className="h-8 px-2 rounded border border-border bg-card text-[11px] font-mono"
                      />
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Los keywords se buscan en los &lt;h2&gt; del HTML público del producto (case + acento insensitive). Orden = prioridad.
                  </p>
                </div>
              </details>

              {/* Test URL */}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase mb-1">Probar scraper en una URL</p>
                <div className="flex gap-2">
                  <input
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://psikoaprende.com/master-en-..."
                    className="flex-1 h-9 px-2 rounded border border-border bg-card text-xs font-mono"
                  />
                  <button
                    onClick={async () => {
                      if (!activeProject?.id || !testUrl) return;
                      setScrapingPreview(true);
                      try {
                        // Primero guarda creds para que el endpoint lea los keywords actuales
                        await client.put('/woocommerce/credentials', { project_id: activeProject.id, ...form });
                        const res = await client.post(`/woocommerce/scrape-preview?projectId=${activeProject.id}`, { url: testUrl });
                        if (res.success) setScrapePreview(res.data);
                      } catch (err: any) {
                        toast({ title: 'Error', description: err?.data?.error || err?.message, variant: 'destructive' });
                      } finally { setScrapingPreview(false); }
                    }}
                    disabled={scrapingPreview}
                    className="h-9 px-3 rounded bg-amber-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {scrapingPreview ? '…' : 'Probar'}
                  </button>
                </div>
                {scrapePreview && (
                  <div className="mt-2 text-[11px] space-y-1 max-h-96 overflow-auto">
                    <div><strong>Título:</strong> {scrapePreview.titulo || <em>—</em>}</div>
                    {scrapePreview.meta_box && Object.keys(scrapePreview.meta_box).length > 0 && (
                      <div>
                        <strong>Meta box:</strong>
                        <ul className="ml-3 list-disc">
                          {Object.entries(scrapePreview.meta_box).map(([k, v]: [string, any]) => (
                            <li key={k}><code className="text-[10px]">{k}</code>: {v.text}{v.value != null && <> · valor=<code>{v.value}</code></>}{v.unit && <> · unidad=<code>{v.unit}</code></>}{v.iso_date && <> · ISO=<code>{v.iso_date}</code></>}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {scrapePreview.sections && Object.keys(scrapePreview.sections).length > 0 && (
                      <div>
                        <strong>Secciones extraídas:</strong>
                        <ul className="ml-3 list-disc">
                          {Object.entries(scrapePreview.sections).map(([k, v]: [string, any]) => (
                            <li key={k}>
                              <code className="text-[10px]">{k}</code> · {String(v).length} chars
                              <div className="text-muted-foreground italic text-[10px] line-clamp-2">{String(v).slice(0, 200)}…</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {scrapePreview.error && <div className="text-red-600">Error: {scrapePreview.error}</div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <button onClick={saveCreds} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold"><FloppyDisk size={14} weight="bold" /> Guardar</button>
        </div>
      </div>

      {creds && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Importar productos</h3>
            <div className="flex gap-2">
              <button onClick={preview} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-muted text-xs font-bold"><Eye size={14} /> Preview + Mapeo</button>
              <button onClick={importNow} disabled={importing} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"><ArrowsClockwise size={14} weight="bold" /> {importing ? 'Iniciando...' : 'Importar ahora'}</button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pulsa <strong>Preview + Mapeo</strong> para ver cómo viene un producto desde WC y elegir qué campo de WC va a qué campo del CRM.
          </p>
        </div>
      )}

      {/* === MAPEO CONFIGURABLE === */}
      {previewData && previewData.targets && previewData.schema && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold">Mapeo de campos WC → CRM</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {previewData.count} productos detectados · Configura qué campo de WC va a cada campo del CRM y guarda antes de importar.
              </p>
            </div>
            <button
              onClick={saveMapping}
              disabled={savingMapping}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"
            >
              <FloppyDisk size={14} weight="bold" /> {savingMapping ? 'Guardando…' : 'Guardar mapeo'}
            </button>
          </div>

          {/* Tabla de mapping agrupada */}
          <div className="space-y-4">
            {Array.from(new Set(previewData.targets.filter(t => t.type !== 'array_subfield' && t.type !== 'wildcard_object').map(t => t.group))).map((group) => (
              <div key={group}>
                <h4 className="text-[11px] font-bold uppercase text-muted-foreground mb-2">{group}</h4>
                <div className="space-y-1.5">
                  {previewData.targets!.filter(t => t.group === group && t.type !== 'array_subfield' && t.type !== 'wildcard_object').map((target) => {
                    const currentSource = mapping[target.key] || '';
                    const previewVal = previewData.mapped_preview?.[target.key];
                    return (
                      <div key={target.key} className="grid grid-cols-1 md:grid-cols-[180px_1fr_200px] gap-2 items-center text-xs">
                        <label className="font-medium flex items-center gap-1">
                          {target.label}
                          {target.required && <span className="text-red-500">*</span>}
                          <span className="text-muted-foreground font-mono ml-1">({target.key})</span>
                        </label>
                        <select
                          value={currentSource}
                          onChange={(e) => updateMapping(target.key, e.target.value)}
                          className="h-9 px-2 rounded-md border border-border bg-muted/30 text-xs"
                        >
                          <option value="">— No mapear —</option>
                          {previewData.schema!.filter(s => s.type !== 'object' && s.type !== 'array').map((s) => (
                            <option key={s.path} value={s.path}>{s.path} ({s.type})</option>
                          ))}
                        </select>
                        <div className="text-muted-foreground truncate font-mono text-[11px]" title={String(previewVal ?? '')}>
                          {previewVal !== undefined && previewVal !== null
                            ? `→ ${String(previewVal).slice(0, 60)}`
                            : <span className="italic">sin valor</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <details className="text-xs border-t pt-3">
            <summary className="cursor-pointer font-bold">Ver JSON crudo del primer producto</summary>
            <pre className="mt-2 p-3 bg-muted/40 rounded text-[10px] overflow-x-auto max-h-80">{JSON.stringify(previewData.sample[0], null, 2)}</pre>
          </details>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-bold text-sm">Historial de imports</h3></div>
        {loading ? <SkeletonTable rows={4} columns={6} className="border-0" /> : runs.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Sin imports aún" description="Configura credenciales y dispara el primero" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground"><tr>
                  <th className="text-left px-4 py-2.5 font-bold">Inicio</th>
                  <th className="text-center px-4 py-2.5 font-bold">Estado</th>
                  <th className="text-right px-4 py-2.5 font-bold">Fetched</th>
                  <th className="text-right px-4 py-2.5 font-bold">Created</th>
                  <th className="text-right px-4 py-2.5 font-bold">Updated</th>
                  <th className="text-right px-4 py-2.5 font-bold">Skipped</th>
                  <th className="text-left px-4 py-2.5 font-bold">Error</th>
                </tr></thead>
                <tbody>
                  {runs.map(r => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-xs">{new Date(r.started_at).toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'success' ? 'bg-emerald-100 text-emerald-700' : r.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.total_fetched}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{r.total_created}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-600">{r.total_updated}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.total_skipped}</td>
                      <td className="px-4 py-3 text-xs text-red-500 truncate max-w-[200px]">{r.error_message || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {runs.map(r => (
                <div key={r.id} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString('es-ES')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${r.status === 'success' ? 'bg-emerald-100 text-emerald-700' : r.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Fetched</div><div className="tabular-nums">{r.total_fetched}</div></div>
                    <div><div className="text-muted-foreground">Created</div><div className="tabular-nums text-emerald-600">{r.total_created}</div></div>
                    <div><div className="text-muted-foreground">Updated</div><div className="tabular-nums text-blue-600">{r.total_updated}</div></div>
                    <div><div className="text-muted-foreground">Skipped</div><div className="tabular-nums text-muted-foreground">{r.total_skipped}</div></div>
                  </div>
                  {r.error_message && <p className="text-[11px] text-red-500 break-words">{r.error_message}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
