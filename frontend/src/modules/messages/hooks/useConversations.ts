import { useState, useEffect, useRef, useCallback } from 'react';
import { getConversations, type Conversation } from '../api/messages.api';

const POLL_INTERVAL = 15_000;

export default function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(() => {
    getConversations(1, 50)
      .then(r => { if (r.success) setConversations(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch();
    timer.current = setInterval(fetch, POLL_INTERVAL);

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timer.current);
      } else {
        fetch();
        timer.current = setInterval(fetch, POLL_INTERVAL);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetch]);

  return { conversations, loading, refetch: fetch };
}
