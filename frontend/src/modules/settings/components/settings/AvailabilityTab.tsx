import { useEffect, useState, useCallback } from 'react';
import { CalendarBlank, Plus, Trash, CheckCircle, XCircle, Clock } from '@phosphor-icons/react';
import client from '@/shared/api/client';
import { toast } from '@/shared/hooks/useToast';
import { getInitials, AVATAR_COLORS } from './shared';

interface AvailUser {
  id: number;
  nombre: string;
  email: string;
  role: string;
  active: boolean;
  is_available: boolean;
  unavailable_reason: string | null;
  unavailable_since: string | null;
  bloque_activo: { id: number; fecha_inicio: string; fecha_fin: string; motivo: string | null } | null;
  bloques_futuros: number;
}

interface Block {
  id: number;
  user_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  created_at: string;
  activo: boolean;
}

function avatarColorFor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function AvailabilityTab() {
  const [users, setUsers] = useState<AvailUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [openUserId, setOpenUserId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [newBlock, setNewBlock] = useState({ fecha_inicio: '', fecha_fin: '', motivo: '' });
  const [savingBlock, setSavingBlock] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/users/availability');
      if (res.success) setUsers(res.data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function toggleAvailable(u: AvailUser) {
    let motivo: string | null = null;
    if (u.is_available) {
      motivo = window.prompt(`Marcar a ${u.nombre} como NO disponible. Motivo (opcional):`, u.unavailable_reason || '') ?? null;
      if (motivo === null) return; // cancelado
    }
    try {
      const res = await client.patch(`/users/${u.id}/availability`, { is_available: !u.is_available, motivo: motivo || null });
      if (res.success) {
        toast({ title: u.is_available ? 'Marcado no disponible' : 'Marcado disponible', description: u.nombre });
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.data?.error || err?.message, variant: 'destructive' });
    }
  }

  async function openBlocks(userId: number) {
    if (openUserId === userId) {
      setOpenUserId(null);
      setBlocks([]);
      return;
    }
    setOpenUserId(userId);
    setBlocksLoading(true);
    try {
      const res = await client.get(`/users/${userId}/availability-blocks`);
      if (res.success) setBlocks(res.data || []);
    } finally {
      setBlocksLoading(false);
    }
  }

  async function addBlock() {
    if (!openUserId || !newBlock.fecha_inicio || !newBlock.fecha_fin) return;
    setSavingBlock(true);
    try {
      const res = await client.post(`/users/${openUserId}/availability-blocks`, {
        fecha_inicio: newBlock.fecha_inicio,
        fecha_fin: newBlock.fecha_fin,
        motivo: newBlock.motivo || null,
      });
      if (res.success) {
        toast({ title: 'Bloque añadido' });
        setNewBlock({ fecha_inicio: '', fecha_fin: '', motivo: '' });
        const r = await client.get(`/users/${openUserId}/availability-blocks`);
        if (r.success) setBlocks(r.data || []);
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.data?.error || err?.message, variant: 'destructive' });
    } finally {
      setSavingBlock(false);
    }
  }

  async function deleteBlock(blockId: number) {
    if (!confirm('¿Eliminar este bloque de ausencia?')) return;
    try {
      const res = await client.delete(`/users/availability-blocks/${blockId}`);
      if (res.success) {
        toast({ title: 'Bloque eliminado' });
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.data?.error || err?.message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-md p-3 text-xs flex items-start gap-2">
        <CalendarBlank size={16} className="text-violet-600 flex-shrink-0 mt-0.5" weight="duotone" />
        <div>
          <p className="font-semibold text-foreground">Disponibilidad para round-robin</p>
          <p className="text-muted-foreground">
            Los gestores marcados <strong>no disponibles</strong> o con un <strong>bloque activo hoy</strong> son saltados al asignar nuevos prospectos.
            El reparto sigue funcionando con el resto del equipo.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y">
          {users.map((u) => {
            const isOpen = openUserId === u.id;
            const blockedNow = !!u.bloque_activo;
            return (
              <div key={u.id}>
                <div className={`p-4 flex items-center gap-3 ${!u.active ? 'opacity-60' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${avatarColorFor(u.id)}`}>
                    {getInitials(u.nombre)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{u.nombre}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{u.role}</span>
                      {!u.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">Inactivo</span>}
                      {blockedNow && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 inline-flex items-center gap-1">
                          <Clock size={10} weight="bold" />
                          Bloque activo hasta {u.bloque_activo!.fecha_fin}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {!u.is_available && u.unavailable_reason && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">Motivo: {u.unavailable_reason}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleAvailable(u)}
                    title={u.is_available ? 'Marcar no disponible' : 'Marcar disponible'}
                    className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      u.is_available
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
                    }`}
                  >
                    {u.is_available ? <><CheckCircle size={14} weight="duotone" /> Disponible</> : <><XCircle size={14} weight="duotone" /> No disponible</>}
                  </button>

                  <button
                    type="button"
                    onClick={() => openBlocks(u.id)}
                    className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-muted"
                  >
                    <CalendarBlank size={14} />
                    Bloques
                    {u.bloques_futuros > 0 && (
                      <span className="text-[10px] font-bold bg-primary/15 text-primary rounded-full px-1.5">{u.bloques_futuros}</span>
                    )}
                  </button>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 bg-muted/20">
                    <div className="rounded-md border border-border bg-card p-3 mb-3">
                      <p className="text-xs font-semibold mb-2">Programar nueva ausencia</p>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input type="date" value={newBlock.fecha_inicio} onChange={(e) => setNewBlock({ ...newBlock, fecha_inicio: e.target.value })}
                          className="h-9 px-3 rounded-md border border-border bg-card text-sm" />
                        <input type="date" value={newBlock.fecha_fin} onChange={(e) => setNewBlock({ ...newBlock, fecha_fin: e.target.value })}
                          className="h-9 px-3 rounded-md border border-border bg-card text-sm" />
                        <input type="text" placeholder="Motivo (opcional)" value={newBlock.motivo} onChange={(e) => setNewBlock({ ...newBlock, motivo: e.target.value })}
                          className="h-9 px-3 rounded-md border border-border bg-card text-sm sm:col-span-1" />
                        <button type="button" onClick={addBlock} disabled={savingBlock || !newBlock.fecha_inicio || !newBlock.fecha_fin}
                          className="h-9 px-3 rounded-md bg-primary text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-primary/90 disabled:opacity-50">
                          <Plus size={12} weight="bold" /> Añadir
                        </button>
                      </div>
                    </div>

                    {blocksLoading ? (
                      <p className="text-xs text-muted-foreground">Cargando bloques…</p>
                    ) : blocks.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin bloques programados</p>
                    ) : (
                      <div className="space-y-1.5">
                        {blocks.map((b) => (
                          <div key={b.id} className={`flex items-center gap-3 p-2 rounded-md text-xs ${b.activo ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800' : 'bg-card border border-border'}`}>
                            <span className="font-mono">{b.fecha_inicio} → {b.fecha_fin}</span>
                            {b.activo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 font-bold">ACTIVO HOY</span>}
                            <span className="flex-1 text-muted-foreground truncate">{b.motivo || '—'}</span>
                            <button onClick={() => deleteBlock(b.id)} title="Eliminar"
                              className="text-muted-foreground hover:text-red-600 p-1"><Trash size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
