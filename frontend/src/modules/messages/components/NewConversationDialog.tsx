import { useState, useEffect } from 'react';
import { MagnifyingGlass, UserCircle } from '@phosphor-icons/react';
import { getAvailableUsers, type AvailableUser } from '../api/messages.api';

interface Props {
  open: boolean;
  currentUserId: number;
  onSelect: (userId: number) => void;
  onClose: () => void;
}

export default function NewConversationDialog({ open, currentUserId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setLoading(true);
    getAvailableUsers('')
      .then(r => { if (r.success) setUsers(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = users
    .filter(u => u.id !== currentUserId)
    .filter(u => {
      if (!search) return true;
      const s = search.toLowerCase();
      return u.nombre.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold mb-3">Nueva conversación</h3>
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar usuario..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-muted/30 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {loading && <p className="text-xs text-muted-foreground text-center py-4">Cargando...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
          )}
          {filtered.map(u => (
            <button
              key={u.id}
              onClick={() => onSelect(u.id)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 text-left"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <UserCircle size={20} weight="fill" className="text-muted-foreground" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.nombre}</p>
                <p className="text-[11px] text-muted-foreground truncate">{u.email} · {u.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
