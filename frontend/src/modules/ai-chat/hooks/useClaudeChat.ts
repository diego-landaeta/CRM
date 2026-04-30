import { useCallback, useRef, useState } from 'react';
import { streamChatMessage } from '../api/claude-chat.api';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  streaming?: boolean;
  error?: string;
}

export interface UseClaudeChatResult {
  messages: ChatMessage[];
  streaming: boolean;
  send: (text: string) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

/**
 * Hook CRM-119: chat conversacional con streaming + historial de sesion (no persiste).
 */
export function useClaudeChat(projectId: number | null | undefined): UseClaudeChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string): Promise<void> => {
    if (!text?.trim() || !projectId || streaming) return;

    const userMsg: ChatMessage = { id: 'u_' + Date.now(), role: 'user', content: text };
    const assistantId = 'a_' + Date.now();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamChatMessage({ message: text, projectId, signal: ctrl.signal }, (ev) => {
        if (ev.type === 'delta') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + (ev.content || '') } : m));
        } else if (ev.type === 'done') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
        } else if (ev.type === 'error') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false, error: ev.error } : m));
        }
      });
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false, error: err?.message } : m));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [projectId, streaming]);

  const cancel = useCallback((): void => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback((): void => {
    if (streaming) cancel();
    setMessages([]);
  }, [streaming, cancel]);

  return { messages, streaming, send, cancel, clear };
}
