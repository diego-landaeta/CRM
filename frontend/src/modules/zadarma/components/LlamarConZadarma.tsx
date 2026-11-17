import { useState } from 'react';
import { PhoneOutgoing } from '@phosphor-icons/react';
import { toast } from '@/shared/hooks/useToast';
import { llamar } from '../api/zadarma.api';
import { useZadarma } from '../hooks/useZadarma';

/**
 * «Llamar con Zadarma» (#137).
 *
 * La llamada sale por la centralita, no por el móvil: Zadarma llama primero a
 * la extensión de quien pulsa y, cuando descuelga, al prospecto. Así queda
 * grabada y contada, y al colgar se apunta sola en la ficha (el aviso de
 * Zadarma), sin que nadie tenga que escribir nada.
 *
 * Sin Zadarma en el campus no se pinta: el botón de siempre (móvil) sigue al
 * lado. Conectado pero sin extensión para esta persona, se pinta y lo explica
 * al pulsarlo, en vez de esconderse sin que nadie sepa por qué.
 */
export default function LlamarConZadarma({
  leadId,
  projectId,
  variante = 'compacto',
  onHecho,
}: {
  leadId: number;
  projectId: number | null | undefined;
  /** `compacto`: el botón pequeño de la ficha. `ancho`: el del diálogo «Llamar». */
  variante?: 'compacto' | 'ancho';
  onHecho?: () => void;
}) {
  const campus = useZadarma(projectId);
  const [llamando, setLlamando] = useState(false);

  if (!campus) return null;
  const sinExtension = !campus.extension;
  const titulo = sinExtension
    ? 'No tienes extensión de Zadarma en este campus. Pídesela a un admin (Integraciones › Zadarma).'
    : `Zadarma llama primero a tu extensión ${campus.extension} y después al prospecto`;

  async function pulsar() {
    if (sinExtension) {
      toast({ title: 'Sin extensión de Zadarma', description: titulo, variant: 'destructive' });
      return;
    }
    setLlamando(true);
    try {
      const r = await llamar(leadId);
      toast({
        title: 'Llamando con Zadarma',
        description: `Descuelga tu extensión ${r.extension}: al cogerla, Zadarma llama a ${r.numero}. Al colgar se apunta sola en la ficha.`,
      });
      onHecho?.();
    } catch (e: unknown) {
      const err = e as { data?: { error?: string }; message?: string };
      // Un error que se queda: dice qué pasó y la gestora decide (puede llamar desde el móvil).
      toast({ title: 'No se pudo llamar con Zadarma', description: err?.data?.error || err?.message || 'Error de red', variant: 'destructive' });
    } finally { setLlamando(false); }
  }

  if (variante === 'ancho') {
    return (
      <button type="button" onClick={pulsar} disabled={llamando} title={titulo}
        aria-label="Llamar con Zadarma"
        className={`h-9 px-4 rounded-md text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60
                    ${sinExtension
                      ? 'border border-border text-muted-foreground hover:bg-muted'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
        <PhoneOutgoing size={15} weight="bold" aria-hidden="true" />
        {llamando ? 'Llamando…' : 'Llamar con Zadarma'}
      </button>
    );
  }

  return (
    <button type="button" onClick={pulsar} disabled={llamando} title={titulo}
      aria-label="Llamar con Zadarma"
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-md border text-xs
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60
                  ${sinExtension
                    ? 'border-border text-muted-foreground/70 hover:bg-muted'
                    : 'border-primary/40 text-primary hover:bg-primary/10'}`}>
      <PhoneOutgoing size={12} weight="bold" aria-hidden="true" />
      {llamando ? 'Llamando…' : 'Zadarma'}
    </button>
  );
}
