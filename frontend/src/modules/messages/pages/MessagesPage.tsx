import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/shared/hooks/useToast';
import { createConversation } from '../api/messages.api';
import useConversations from '../hooks/useConversations';
import useMessages from '../hooks/useMessages';
import ConversationList from '../components/ConversationList';
import ChatPanel from '../components/ChatPanel';
import NewConversationDialog from '../components/NewConversationDialog';

export default function MessagesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, loading, refetch } = useConversations();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const { messages, loading: msgLoading, typingUsers, send, notifyTyping, removeMessage } = useMessages(activeConvId);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;

  // Deep link: /messages?chatWith=3&leadId=45
  useEffect(() => {
    const chatWith = searchParams.get('chatWith');
    const leadId = searchParams.get('leadId');
    if (!chatWith) return;
    const participantId = Number(chatWith);
    if (!participantId || participantId === user?.id) return;

    createConversation(participantId, leadId ? Number(leadId) : undefined)
      .then(async r => {
        if (r.success) {
          await refetch();
          setActiveConvId(r.data.id);
          setMobileView('chat');
        }
      })
      .catch(() => toast({ title: 'Error al abrir conversación', variant: 'destructive' }))
      .finally(() => setSearchParams({}, { replace: true }));
  }, [searchParams, user?.id, refetch, setSearchParams]);

  const handleSelect = useCallback((id: number) => {
    setActiveConvId(id);
    setMobileView('chat');
  }, []);

  const handleBack = useCallback(() => {
    setMobileView('list');
  }, []);

  const handleSend = useCallback(async (body: string, referencedLeadId?: number) => {
    await send(body, referencedLeadId);
    refetch();
  }, [send, refetch]);

  const handleDelete = useCallback(async (msgId: number) => {
    try {
      await removeMessage(msgId);
      refetch();
    } catch {
      toast({ title: 'Error al eliminar mensaje', variant: 'destructive' });
    }
  }, [removeMessage, refetch]);

  const handleNewChat = useCallback(async (participantId: number) => {
    try {
      const r = await createConversation(participantId);
      if (r.success) {
        setShowNew(false);
        await refetch();
        setActiveConvId(r.data.id);
        setMobileView('chat');
      }
    } catch {
      toast({ title: 'Error al crear conversación', variant: 'destructive' });
    }
  }, [refetch]);

  return (
    <div className="-m-4 lg:-m-6 xl:-m-8 flex h-[calc(100vh-56px)] lg:h-screen bg-background">
      <div className={`w-[340px] border-r border-border flex-shrink-0 flex flex-col bg-card ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelect}
          onNewChat={() => setShowNew(true)}
          loading={loading}
        />
      </div>

      <div className={`flex-1 flex flex-col min-w-0 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
        <ChatPanel
          conversation={activeConv}
          messages={messages}
          loading={msgLoading}
          currentUserId={user?.id || 0}
          typingUsers={typingUsers}
          onSend={handleSend}
          onTyping={notifyTyping}
          onDelete={handleDelete}
          onBack={handleBack}
        />
      </div>

      <NewConversationDialog
        open={showNew}
        currentUserId={user?.id || 0}
        onSelect={handleNewChat}
        onClose={() => setShowNew(false)}
      />
    </div>
  );
}
