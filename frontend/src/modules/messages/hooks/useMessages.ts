import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getMessages,
  sendMessage as sendMessageApi,
  markConversationRead,
  getTypingStatus,
  postTyping,
  deleteMessage as deleteMessageApi,
  type Message,
} from '../api/messages.api';

const POLL_INTERVAL = 3_000;
const TYPING_DEBOUNCE = 2_000;

const notifSound = typeof Audio !== 'undefined' ? new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2UoZuTiIB5eX6Kl6SjoZqShXx5fISSmKKinpiOhX17f4qWoaShmJCHfnx/iZWfoaGZkYh/fH+Jl6GjopmRh359gImXoaOimZKIf31/iZeho6KZkod+fX+Jl6GjopmSh359f4mXoaOimZKHfn1/iZehoqGZkYd+fICJl6GjopmSiH5+gImXoaOimZKIf31/ipaho6KZkoh+fYCJl6GjopmSiH59f4qWoaOimZKIfn2AiZeho6KZkoh+fYCKlqGjopmSiH5+gIqXoaOimZKHfn2AipehoqGZkoh+fn+Jl6GjopmRh359gImXoaKhmZGHfn2AiZaho6KZkYd+fYCJl6GioZmRh35+gImXoaKimZGHfn1/iZeho6KZkYd+fICJl6GiopmRh359gImXoaKimZGHfn5/iZehoqGZkYd+fYCJl6GioZmRh35+gImXoQ==') : null;

export default function useMessages(conversationId: number | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const lastId = useRef(0);
  const lastTypingSent = useRef(0);
  const prevCount = useRef(0);

  const fetchAll = useCallback(() => {
    if (!conversationId) return;
    setLoading(true);
    getMessages(conversationId, 1, 100)
      .then(r => {
        if (r.success) {
          setMessages(r.data);
          setTotal(r.pagination?.total ?? r.data.length);
          prevCount.current = r.data.length;
          if (r.data.length > 0) lastId.current = r.data[r.data.length - 1].id;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  const pollNew = useCallback(() => {
    if (!conversationId) return;

    if (lastId.current) {
      getMessages(conversationId, 1, 50, lastId.current)
        .then(r => {
          if (r.success && r.data.length > 0) {
            setMessages(prev => [...prev, ...r.data]);
            setTotal(t => t + r.data.length);
            lastId.current = r.data[r.data.length - 1].id;
            if (notifSound && r.data.some((m: Message) => m.sender_id !== 0)) {
              notifSound.play().catch(() => {});
            }
            markConversationRead(conversationId).catch(() => {});
          }
        })
        .catch(() => {});
    }

    getTypingStatus(conversationId)
      .then(r => { if (r.success) setTypingUsers(r.data.typing); })
      .catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) { setMessages([]); setTypingUsers([]); return; }

    lastId.current = 0;
    prevCount.current = 0;
    fetchAll();
    markConversationRead(conversationId).catch(() => {});

    timer.current = setInterval(pollNew, POLL_INTERVAL);
    return () => clearInterval(timer.current);
  }, [conversationId, fetchAll, pollNew]);

  const send = useCallback(async (body: string, referencedLeadId?: number) => {
    if (!conversationId) return;
    const r = await sendMessageApi(conversationId, body, referencedLeadId);
    if (r.success) {
      setMessages(prev => [...prev, r.data]);
      setTotal(t => t + 1);
      lastId.current = r.data.id;
    }
    return r;
  }, [conversationId]);

  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_DEBOUNCE) return;
    lastTypingSent.current = now;
    postTyping(conversationId).catch(() => {});
  }, [conversationId]);

  const removeMessage = useCallback(async (msgId: number) => {
    const r = await deleteMessageApi(msgId);
    if (r.success) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setTotal(t => t - 1);
    }
    return r;
  }, []);

  return { messages, loading, total, typingUsers, send, notifyTyping, removeMessage, refetch: fetchAll };
}
