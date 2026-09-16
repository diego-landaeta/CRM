import {
  PencilSimple, DotsThreeVertical, UserCircleMinus, UserCirclePlus, CalendarBlank,
} from '@phosphor-icons/react';

interface Props {
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  /** Ausencias: solo para roles que entran en el reparto. */
  onAvailability?: () => void;
}

export default function UserActionsMenu({
  isActive, isOpen, onToggle, onClose, onEdit, onToggleActive, onAvailability,
}: Props) {
  return (
    <div className="relative inline-block">
      <button
        onClick={onToggle}
        aria-label="Acciones de usuario"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <DotsThreeVertical size={18} weight="bold" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 !m-0 z-40" onClick={onClose} />
          <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-48 bg-card rounded-md border border-border py-1.5 shadow-lg">
            <button
              role="menuitem"
              onClick={onEdit}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-normal hover:bg-muted transition-colors"
            >
              <PencilSimple size={14} /> Editar usuario
            </button>
            {onAvailability && (
              <button
                role="menuitem"
                onClick={onAvailability}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-normal hover:bg-muted transition-colors"
              >
                <CalendarBlank size={14} /> Ausencias
              </button>
            )}
            <button
              role="menuitem"
              onClick={onToggleActive}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-normal hover:bg-muted transition-colors ${isActive ? 'text-red-500' : 'text-emerald-600'}`}
            >
              {isActive
                ? <><UserCircleMinus size={14} /> Desactivar</>
                : <><UserCirclePlus size={14} /> Reactivar</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
