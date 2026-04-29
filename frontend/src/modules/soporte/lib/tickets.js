// Storage local de tickets de soporte. Cuando exista /api/tickets, este modulo
// se reemplaza por el cliente API. La forma de los datos esta diseñada para
// migrar sin tocar la UI.

const STORAGE_KEY = 'crm.support-tickets';

export const TICKET_STATUS = {
  open:        { label: 'Abierto',        tone: 'amber' },
  in_review:   { label: 'En revisión',    tone: 'blue' },
  resolved:    { label: 'Resuelto',       tone: 'emerald' },
  closed:      { label: 'Cerrado',        tone: 'zinc' },
};

export const TICKET_SEVERITY = {
  low:      { label: 'Baja',     tone: 'zinc' },
  medium:   { label: 'Media',    tone: 'amber' },
  high:     { label: 'Alta',     tone: 'red' },
  critical: { label: 'Crítica',  tone: 'red' },
};

export const TICKET_KIND = {
  bug:     { label: 'Bug',      icon: 'Bug' },
  feature: { label: 'Mejora',   icon: 'Lightning' },
  question:{ label: 'Pregunta', icon: 'Question' },
};

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function writeAll(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new Event('crm:tickets-changed'));
}

export function listTickets() {
  return readAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function createTicket({
  kind, severity, title, description,
  steps, expected, actual, // bugs
  whyItMatters,            // features
  url, attachments,        // comunes
  projectId, projectName,
}) {
  const id = 'tkt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  const ticket = {
    id,
    kind: kind || 'question',
    severity: severity || 'low',
    title: title?.trim() || '(sin titulo)',
    description: description?.trim() || '',
    steps: steps?.trim() || '',
    expected: expected?.trim() || '',
    actual: actual?.trim() || '',
    whyItMatters: whyItMatters?.trim() || '',
    url: url?.trim() || '',
    attachments: Array.isArray(attachments) ? attachments : [],
    status: 'open',
    projectId: projectId || null,
    projectName: projectName || null,
    createdAt: now,
    updatedAt: now,
    comments: [],
  };
  const next = [ticket, ...readAll()];
  writeAll(next);
  return ticket;
}

export function updateTicketStatus(id, status) {
  const list = readAll();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], status, updatedAt: new Date().toISOString() };
  writeAll(list);
  return list[idx];
}

export function addComment(id, body) {
  const list = readAll();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const comment = { id: Date.now(), body: body.trim(), createdAt: new Date().toISOString() };
  list[idx] = {
    ...list[idx],
    comments: [...(list[idx].comments || []), comment],
    updatedAt: new Date().toISOString(),
  };
  writeAll(list);
  return list[idx];
}

export function deleteTicket(id) {
  const next = readAll().filter((t) => t.id !== id);
  writeAll(next);
}
