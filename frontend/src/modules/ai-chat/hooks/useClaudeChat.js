import { useCallback, useRef, useState } from 'react';
import { streamChatMessage } from '../api/claude-chat.api';

/**
 * Hook CRM-119: chat conversacional con streaming + historial de sesion (no persiste).
 */
export function useClaudeChat(projectId) {
  const [messages, setMessages] = useState([]); // [{ id, role: 'user'|'assistant', content, streaming?, error? }]
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  const send = useCallback(async (text) => {
    if (!text?.trim() || !projectId || streaming) return;

    const userMsg = { id: 'u_' + Date.now(), role: 'user', content: text };
    const assistantId = 'a_' + Date.now();
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamChatMessage({ message: text, projectId, signal: ctrl.signal }, (ev) => {
        if (ev.type === 'delta') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + ev.content } : m));
        } else if (ev.type === 'done') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
        } else if (ev.type === 'error') {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false, error: ev.error } : m));
        }
      });
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false, error: err.message } : m));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [projectId, streaming]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    if (streaming) cancel();
    setMessages([]);
  }, [streaming, cancel]);

  return { messages, streaming, send, cancel, clear };
}
