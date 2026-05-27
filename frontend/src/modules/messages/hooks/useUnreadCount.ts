import { useState, useEffect, useRef, useCallback } from 'react';
import { getUnreadCount } from '../api/messages.api';

const POLL_INTERVAL = 30_000;

export default function useUnreadCount() {
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(() => {
    getUnreadCount()
      .then(r => { if (r.success) setCount(r.data.count); })
      .catch(() => {});
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

  return { count, refetch: fetch };
}
