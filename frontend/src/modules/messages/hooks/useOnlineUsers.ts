import { useState, useEffect, useRef, useCallback } from 'react';
import { getOnlineUsers } from '../api/messages.api';

const POLL_INTERVAL = 20_000;

export default function useOnlineUsers() {
  const [online, setOnline] = useState<Set<number>>(new Set());
  const timer = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(() => {
    getOnlineUsers()
      .then(r => { if (r.success) setOnline(new Set(r.data.online)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch();
    timer.current = setInterval(fetch, POLL_INTERVAL);
    return () => clearInterval(timer.current);
  }, [fetch]);

  return online;
}
