import { useEffect, useRef } from 'react';

/**
 * Helpers a11y para diálogos / modales / popovers.
 *
 * useEscapeKey(onClose, enabled = true)
 *   Escucha la tecla Escape a nivel global y llama a onClose.
 *
 * useFocusTrap(containerRef, enabled = true)
 *   Cuando enabled:
 *    - Guarda el elemento que tenía foco antes de abrir
 *    - Mueve foco al primer elemento focusable dentro del contenedor
 *    - Atrapa Tab/Shift+Tab dentro del contenedor
 *    - Al desactivarse (cerrar el modal), restaura foco al elemento previo
 *
 * Usar ambos juntos en cualquier modal:
 *
 *   const ref = useRef(null);
 *   useEscapeKey(onClose);
 *   useFocusTrap(ref);
 *   return <div ref={ref}>...</div>;
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useEscapeKey(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof onClose !== 'function') return;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, enabled]);
}

export function useFocusTrap(containerRef, enabled = true) {
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    previouslyFocused.current = document.activeElement;
    const container = containerRef.current;
    const focusables = container.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      // Pequeño delay para que el DOM termine de renderizar
      setTimeout(() => focusables[0].focus(), 0);
    }

    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const items = container.querySelectorAll(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // Restaurar foco al elemento previo
      if (previouslyFocused.current && typeof previouslyFocused.current.focus === 'function') {
        previouslyFocused.current.focus();
      }
    };
  }, [containerRef, enabled]);
}

/**
 * Conveniencia: combina ambos. Devuelve un ref para attachear al contenedor.
 */
export default function useDialogA11y(onClose, enabled = true) {
  const ref = useRef(null);
  useEscapeKey(onClose, enabled);
  useFocusTrap(ref, enabled);
  return ref;
}
