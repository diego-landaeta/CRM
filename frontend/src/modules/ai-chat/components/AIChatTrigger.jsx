import { useState, lazy, Suspense } from 'react';
import { ChatCircleText } from '@phosphor-icons/react';

const AIChatPanel = lazy(() => import('./AIChatPanel'));

/**
 * FAB (floating action button) global para abrir el chat con Claude AI.
 * Se monta en AppLayout y solo aparece cuando hay sesion + proyecto.
 */
export default function AIChatTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir chat con Claude AI"
        className={`fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all hover:scale-105 ${open ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <ChatCircleText size={18} weight="regular" />
        <span className="hidden sm:inline">Pregunta a Claude</span>
      </button>

      <Suspense fallback={null}>
        {open && <AIChatPanel open={open} onClose={() => setOpen(false)} />}
      </Suspense>
    </>
  );
}
