import { useEffect, useState, useCallback } from 'react';

// Templates por defecto si el proyecto aun no configura
const DEFAULT_TEMPLATES = [
  { id: 'saludo', label: 'Saludo inicial', text: 'Hola {nombre}, te escribimos desde {proyecto}. Vimos tu interés por {producto} y queremos ayudarte. ¿Tienes 2 minutos para una llamada rápida?' },
  { id: 'seguimiento', label: 'Seguimiento', text: 'Hola {nombre}, ¿pudiste revisar la información sobre {producto} que te enviamos? Quedo atenta a tus dudas.' },
  { id: 'oferta', label: 'Oferta limitada', text: 'Hola {nombre}, tenemos una oferta especial sobre {producto} hasta el viernes. ¿Te llamo para contártelo?' },
  { id: 'inactividad', label: 'Reactivar lead', text: 'Hola {nombre}, hace días que no hablamos sobre {producto}. ¿Sigue siendo de tu interés?' },
];

const STORAGE_KEY_PREFIX = 'crm.wa-templates.';

export function useWhatsappTemplates(projectId) {
  const storageKey = projectId ? `${STORAGE_KEY_PREFIX}${projectId}` : null;
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  // Cargar al cambiar proyecto
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setTemplates(JSON.parse(stored));
      else setTemplates(DEFAULT_TEMPLATES);
    } catch {
      setTemplates(DEFAULT_TEMPLATES);
    }
  }, [storageKey]);

  const save = useCallback((newTemplates) => {
    setTemplates(newTemplates);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(newTemplates)); } catch {}
    }
  }, [storageKey]);

  const reset = useCallback(() => save(DEFAULT_TEMPLATES), [save]);

  return { templates, save, reset };
}

/** Reemplaza variables en el template con los datos del lead. */
export function fillTemplate(text, { lead, projectName }) {
  return text
    .replace(/\{nombre\}/gi, lead?.nombre?.split(' ')[0] || lead?.nombre || '')
    .replace(/\{nombreCompleto\}/gi, lead?.nombre || '')
    .replace(/\{producto\}/gi, lead?.producto_nombre || lead?.producto_interes || 'nuestros servicios')
    .replace(/\{proyecto\}/gi, projectName || '')
    .replace(/\{email\}/gi, lead?.email || '')
    .replace(/\{telefono\}/gi, lead?.telefono || '');
}
