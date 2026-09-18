import { useEffect, useState } from 'react';
import { X, EnvelopeSimple, PaperPlaneTilt, FileText } from '@phosphor-icons/react';
import { leadEmailsApi, type AdjuntosDelDiaUno } from '../api/lead-emails.api';
import Select from '@/shared/components/ui/Select';
import { toast } from '@/shared/hooks/useToast';
import { emailTemplatesApi, type EmailTemplate } from '@/modules/email-templates/api/templates.api';
import { useProjectContext } from '@/contexts/ProjectContext';
import { lista } from '@/shared/lib/lista';

interface LeadEmailDialogProps {
  open: boolean;
  leadId: number;
  leadName?: string | null;
  leadEmail?: string | null;
  onClose: () => void;
  onSent?: () => void;
}

export default function LeadEmailDialog({
  open, leadId, leadName, leadEmail, onClose, onSent,
}: LeadEmailDialogProps) {
  const { activeProject } = useProjectContext();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  // CRM-185 fase 2: plantillas. Se cargan al abrir; al elegir una se renderiza
  // server-side con los datos del lead y se prefilla asunto/cuerpo.
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [renderingTemplate, setRenderingTemplate] = useState(false);

  /**
   * Los tres documentos del correo del día 1 (#91).
   *
   * «Sin los tres, el correo no sale». Se miran al elegir la plantilla del
   * paso 1, ANTES de escribir: enterarse al pulsar enviar, con el correo ya
   * redactado, es la peor forma de enterarse.
   */
  const [delDiaUno, setDelDiaUno] = useState<AdjuntosDelDiaUno | null>(null);
  const [pasoDeLaPlantilla, setPasoDeLaPlantilla] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSubject('');
      setBody('');
      setSending(false);
      setSelectedTemplateId('');
      setDelDiaUno(null);
      setPasoDeLaPlantilla(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !activeProject?.id) return;
    let cancelled = false;
    emailTemplatesApi.list(activeProject.id, false)
      .then(res => { if (!cancelled && res.success && res.data) setTemplates(lista(res.data)); })
      .catch(() => { /* silencioso, seccion opcional */ });
    return () => { cancelled = true; };
  }, [open, activeProject?.id]);

  async function applyTemplate(templateId: number) {
    if (!activeProject?.id) return;
    setRenderingTemplate(true);
    // De qué paso es la plantilla elegida. Lo dice ella, no se adivina aquí:
    // un correo suelto a alguien que ya va por el día 4 no lleva los tres.
    const paso = templates.find((t) => t.id === templateId)?.paso_clave || null;
    setPasoDeLaPlantilla(paso);
    setDelDiaUno(null);
    if (paso === 'paso_1') {
      leadEmailsApi.adjuntosDelDiaUno(leadId)
        .then((r) => { if (r.success) setDelDiaUno(r.data); })
        .catch(() => { /* si no se puede mirar, lo dirá el servidor al enviar */ });
    }
    try {
      const res = await emailTemplatesApi.render(templateId, activeProject.id, leadId);
      if (res.success && res.data) {
        setSubject(res.data.subject);
        setBody(res.data.body_html);
      }
    } catch {
      toast({ title: 'Error aplicando plantilla', variant: 'destructive' });
    } finally { setRenderingTemplate(false); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function send(): Promise<void> {
    if (!subject.trim() || !body.trim()) {
      toast({ title: 'Faltan campos', description: 'Asunto y cuerpo son obligatorios', variant: 'destructive' });
      return;
    }
    if (!leadEmail) {
      toast({ title: 'Sin email', description: 'El lead no tiene email registrado', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      // El backend espera HTML — convertimos saltos de linea a <br/> para que
      // el usuario pueda escribir prosa sin pensar en HTML. Si pega HTML lo
      // respetamos (heuristica: si ya tiene tags lo dejamos tal cual).
      const looksLikeHtml = /<\w+[^>]*>/.test(body);
      const body_html = looksLikeHtml ? body : body.replace(/\n/g, '<br/>');
      const body_text = looksLikeHtml ? body.replace(/<[^>]+>/g, '') : body;

      const res = await leadEmailsApi.send(leadId, {
        subject: subject.trim(), body_html, body_text,
        paso: pasoDeLaPlantilla || undefined,
      });
      if (res.success) {
        toast({ title: 'Email enviado', description: leadEmail });
        onSent?.();
        onClose();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 !m-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-email-title"
        className="bg-card rounded-xl border border-border shadow-dialog w-full max-w-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <EnvelopeSimple size={16} weight="duotone" className="text-primary shrink-0" />
            <div className="min-w-0">
              <h2 id="lead-email-title" className="font-semibold text-sm">Enviar email</h2>
              <p className="text-[11px] text-muted-foreground truncate">
                {leadName ? `${leadName} · ` : ''}{leadEmail || 'Sin email'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {!leadEmail && (
            <div className="bg-warning-soft border border-warning/30/50 rounded-md p-3 text-xs text-warning">
              Este prospecto no tiene email. Edita la ficha y añade uno antes de enviar.
            </div>
          )}
          {templates.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <FileText size={11} /> Usar plantilla
              </label>
              <Select<number | ''>
                value={selectedTemplateId}
                onChange={(v) => {
                  setSelectedTemplateId(v);
                  if (v !== '') applyTemplate(v);
                }}
                options={[
                  { value: '' as const, label: '— Seleccionar plantilla —' },
                  ...templates.map(t => ({ value: t.id as number, label: t.name })),
                ]}
                ariaLabel="Plantilla de email"
                disabled={renderingTemplate || sending || !leadEmail}
              />
              {renderingTemplate && (
                <p className="text-[10px] text-muted-foreground mt-1">Aplicando plantilla…</p>
              )}

              {/* LOS TRES DEL DÍA 1 (#91). El documento comercial: «sin los
                  tres, el correo no sale». Se enseñan los tres, no solo los
                  que faltan: una lista de faltantes obliga a adivinar si lo
                  demás está o es que nadie lo ha mirado. */}
              {delDiaUno && (
                <div className={`mt-2 rounded-md border p-2 text-[11px] ${
                  delDiaUno.completo
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20'
                    : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
                }`}>
                  <p className="font-semibold mb-1">
                    {delDiaUno.completo
                      ? 'Este correo va con los tres documentos'
                      : 'Faltan documentos: este correo no puede salir'}
                  </p>
                  <ul className="space-y-0.5">
                    {delDiaUno.piezas.map((p) => (
                      <li key={p.tipo} className="flex items-center gap-1.5">
                        <span aria-hidden="true">{p.esta ? '✓' : '×'}</span>
                        <span className={p.esta ? '' : 'font-medium'}>{p.como}</span>
                        <span className="sr-only">{p.esta ? 'incluido' : 'falta'}</span>
                      </li>
                    ))}
                  </ul>
                  {!delDiaUno.completo && (
                    <p className="mt-1 text-muted-foreground">
                      El dossier se sube en la ficha de la formación; la guía del campus y las
                      homologaciones, en los documentos de la marca.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={500}
              placeholder="Asunto del email"
              autoFocus
              disabled={sending || !leadEmail}
              className="w-full h-9 px-3 rounded-md border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mensaje</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              maxLength={50000}
              placeholder="Hola...&#10;&#10;Saltos de línea se respetan automáticamente. Puedes pegar HTML si quieres formato más rico."
              disabled={sending || !leadEmail}
              className="w-full px-3 py-2 rounded-md border border-border bg-muted/50 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 font-mono leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
              {body.length} / 50000
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !leadEmail || !subject.trim() || !body.trim()
              /* Con la plantilla del día 1 y algún documento sin subir, no se
                 manda. El servidor lo rechaza igual — esto es para no dejar
                 escribir el correo entero y avisar al final. */
              || (pasoDeLaPlantilla === 'paso_1' && delDiaUno !== null && !delDiaUno.completo)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <PaperPlaneTilt size={14} weight="bold" />
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
