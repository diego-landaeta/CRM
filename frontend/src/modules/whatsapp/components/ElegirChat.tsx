import { useMemo, useState } from 'react';
import { X, MagnifyingGlass, UsersThree } from '@phosphor-icons/react';
import Portal from '@/shared/components/ui/portal';
import type { ChatWhatsapp } from '../api/whatsapp.api';

/**
 * A que chat reenviar (#99, punto 5).
 *
 * Se le pasan las conversaciones que la pantalla ya tiene cargadas en vez de
 * pedirlas otra vez: son las mismas, y asi el panel abre al instante. El
 * buscador filtra sobre esa lista, sin ir al servidor — quien no encuentre a
 * alguien ahi lo tiene igualmente en la lista de la izquierda.
 *
 * El chat de origen no se ofrece: reenviarse un mensaje a uno mismo no hace
 * nada util y solo confunde.
 *
 * Los colores salen de la paleta del PANEL —`--wa-panel`, `--wa-texto`…— y no
 * de la del CRM. Es la misma trampa que ya esta apuntada en `chat.css` con las
 * etiquetas: este panel tiene su propia paleta fija y es oscuro en los dos
 * temas, asi que `bg-background` y compania se ven de otro sitio. Un panel que
 * sale sobre el chat tiene que parecer del chat.
 */

export default function ElegirChat({
  chats,
  excluirId,
  nombreDe,
  enviando,
  onElegir,
  onCerrar,
}: {
  chats: ChatWhatsapp[];
  excluirId: number | null;
  nombreDe: (c: ChatWhatsapp) => string;
  enviando: boolean;
  onElegir: (c: ChatWhatsapp) => void;
  onCerrar: () => void;
}) {
  const [filtro, setFiltro] = useState('');

  const visibles = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    const cifras = t.replace(/\D/g, '');
    return chats
      .filter((c) => c.id !== excluirId)
      .filter((c) => {
        if (!t) return true;
        if (nombreDe(c).toLowerCase().includes(t)) return true;
        // El telefono, solo con cifras: buscar «+34 612» contra «34612…» no
        // casaba por el mas y los espacios.
        return Boolean(cifras) && String(c.telefono || '').replace(/\D/g, '').includes(cifras);
      });
  }, [chats, excluirId, filtro, nombreDe]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
        onClick={onCerrar}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Elegir a quién reenviar"
          onClick={(e) => e.stopPropagation()}
          className="wa-elegir w-full max-w-md max-h-[85vh] flex flex-col rounded-lg shadow-xl"
        >
          <div className="wa-elegir-cabecera flex items-start justify-between gap-3 p-4">
            <div>
              <h2 className="font-semibold">Reenviar a…</h2>
              <p className="wa-elegir-tenue text-xs mt-0.5">
                Sale como un mensaje nuevo, no como reenviado.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="wa-elegir-cerrar shrink-0 rounded focus:outline-none"
            >
              <X size={18} />
            </button>
          </div>

          <div className="wa-elegir-buscador p-3">
            <div className="relative">
              <MagnifyingGlass
                size={14}
                className="wa-elegir-tenue absolute left-2.5 top-1/2 -translate-y-1/2"
              />
              <input
                autoFocus
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar un chat"
                aria-label="Buscar un chat"
                className="wa-elegir-campo w-full h-9 pl-8 pr-3 rounded-md text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-y-auto">
            {!visibles.length ? (
              <p className="wa-elegir-tenue text-sm text-center py-8 px-4">
                {chats.length <= 1
                  ? 'No tienes otro chat al que reenviar.'
                  : 'Ningún chat con ese nombre o número.'}
              </p>
            ) : (
              <ul>
                {visibles.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => onElegir(c)}
                      className="wa-elegir-fila w-full text-left flex items-center gap-3 px-4 py-2.5
                                 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                    >
                      <span
                        className="wa-elegir-avatar w-8 h-8 rounded-full flex items-center
                                   justify-center shrink-0"
                        aria-hidden="true"
                      >
                        {c.es_grupo ? <UsersThree size={15} weight="bold" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{nombreDe(c)}</span>
                        <span className="wa-elegir-tenue block text-xs truncate">
                          {c.es_grupo ? 'Grupo' : c.telefono}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
