import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import { DotsThree } from '@phosphor-icons/react';
import { cn } from '@/shared/lib/utils';

export interface AccionDeMenu {
  label: string;
  icon?: ComponentType<IconProps>;
  onClick: () => void;
  /** Rojo y separado del resto: borrar, anular. */
  peligro?: boolean;
  title?: string;
  oculta?: boolean;
}

/**
 * «⋯»: las acciones secundarias de una ficha o de una fila (rediseño, 20/11).
 *
 * Una acción principal a la vista y el resto aquí. Antes la ficha del prospecto
 * tenía siete botones del mismo peso que aplastaban el nombre a 0 px a 1280.
 *
 * Teclado: Enter/Espacio abre, flechas recorren, Escape cierra y devuelve el
 * foco al botón. En el móvil el botón mide 44 px.
 */
export default function MenuAcciones({
  acciones, etiqueta = 'Más acciones', className, children,
}: { acciones: AccionDeMenu[]; etiqueta?: string; className?: string; children?: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const id = useId();
  const visibles = acciones.filter((a) => !a.oculta);

  useEffect(() => {
    if (!abierto) return undefined;
    lista.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    function fuera(e: MouseEvent) {
      if (boton.current?.contains(e.target as Node) || lista.current?.contains(e.target as Node)) return;
      setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...(lista.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') || [])];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const sig = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[sig]?.focus();
    }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  if (!visibles.length && !children) return null;
  return (
    <div className={cn('relative', className)} onClick={(e) => e.stopPropagation()}>
      <button
        ref={boton}
        type="button"
        aria-label={etiqueta}
        title={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-input bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8 lg:w-8"
      >
        <DotsThree size={18} weight="bold" />
      </button>
      {abierto && (
        <div
          ref={lista}
          id={id}
          role="menu"
          aria-label={etiqueta}
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[12rem] rounded-lg border border-border bg-card py-1 shadow-popover animate-in fade-in zoom-in-95 duration-100"
        >
          {visibles.map((a, i) => {
            const Icono = a.icon;
            const separar = a.peligro && i > 0 && !visibles[i - 1].peligro;
            return (
              <div key={a.label}>
                {separar && <div className="my-1 border-t border-border" />}
                <button
                  type="button"
                  role="menuitem"
                  title={a.title}
                  onClick={() => { setAbierto(false); a.onClick(); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] outline-none transition-colors lg:py-1.5',
                    a.peligro ? 'text-destructive hover:bg-destructive-soft focus:bg-destructive-soft' : 'hover:bg-muted focus:bg-muted',
                  )}
                >
                  {Icono && <Icono size={15} weight="regular" className={a.peligro ? undefined : 'text-muted-foreground'} />}
                  {a.label}
                </button>
              </div>
            );
          })}
          {children}
        </div>
      )}
    </div>
  );
}
