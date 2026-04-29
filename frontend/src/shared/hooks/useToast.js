import { useState, useCallback } from 'react';

let toastId = 0;
let listeners = [];

function dispatch(toast) {
  toastId++;
  const id = toastId;
  const newToast = { id, ...toast };
  listeners.forEach((l) => l(newToast));
  return id;
}

export function toast({ title, description = undefined, variant = 'default', duration = 4000 }) {
  return dispatch({ title, description, variant, duration });
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addListener = useCallback(() => {
    const handler = (newToast) => {
      setToasts((prev) => [...prev, newToast]);
      if (newToast.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, newToast.duration);
      }
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addListener, dismiss };
}
