import { Plus, MagnifyingGlass, ChatCircleText } from '@phosphor-icons/react';
import { useState } from 'react';
import type { Conversation } from '../api/messages.api';
import useOnlineUsers from '../hooks/useOnlineUsers';
import ConversationItem from './ConversationItem';

interface Props {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  loading: boolean;
}

export default function ConversationList({ conversations, activeId, onSelect, onNewChat, loading }: Props) {
  const [search, setSearch] = useState('');
  const onlineUsers = useOnlineUsers();

  const filtered = search
    ? conversations.filter(c => c.other_user?.nombre?.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3.5 flex items-center justify-between">
        <h2 className="text-base font-bold">Chats</h2>
        <button
          onClick={onNewChat}
          title="Nueva conversación"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Plus size={20} weight="bold" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar o iniciar un chat"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/50 border-0 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs mt-3">Cargando chats...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ChatCircleText size={40} weight="thin" />
            <p className="text-xs mt-2">{search ? 'Sin resultados' : 'Sin conversaciones'}</p>
            {!search && (
              <button onClick={onNewChat} className="text-xs text-primary font-medium mt-2 hover:underline">
                Iniciar una conversación
              </button>
            )}
          </div>
        )}
        {filtered.map(c => (
          <ConversationItem
            key={c.id}
            conversation={c}
            active={c.id === activeId}
            isOnline={c.other_user ? onlineUsers.has(c.other_user.id) : false}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </div>
    </div>
  );
}
