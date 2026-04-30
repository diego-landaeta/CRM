// Helpers de formato y avatar para LeadsPage. Extraídos de la página
// para facilitar su test unitario y aliviar el archivo principal.

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
];

export function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function getAvatarColor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

export function formatRelative(dateStr, { future = false } = {}) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = future ? d - now : now - d;
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays < 0) return future ? `hace ${-diffDays}d` : null;
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return future ? 'mañana' : 'ayer';
  if (diffDays < 7) return future ? `en ${diffDays}d` : `hace ${diffDays}d`;
  if (diffDays < 30) return future ? `en ${Math.round(diffDays / 7)} sem` : `hace ${Math.round(diffDays / 7)} sem`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

export function cleanPhone(phone) {
  return (phone || '').replace(/[^\d]/g, '');
}

const STATUS_LABELS_ES = {
  nuevo: 'Nuevo',
  por_contactar: 'Por contactar',
  contactado: 'Contactado',
  en_seguimiento: 'En seguimiento',
  convertido: 'Convertido',
  no_interesado: 'No interesado',
};

export function exportLeadsCSV(leads, filename) {
  const rows = [
    ['Nombre', 'Email', 'Teléfono', 'Estado', 'Canal', 'Responsable', 'Producto interés', 'Notas', 'Creado', 'Último contacto', 'Próximo recordatorio'],
    ...leads.map((l) => [
      l.nombre || '',
      l.email || '',
      l.telefono || '',
      STATUS_LABELS_ES[l.estado] || l.estado || '',
      l.canal || '',
      l.responsable_nombre || '',
      l.producto_interes || '',
      l.notas || '',
      l.created_at ? new Date(l.created_at).toLocaleDateString('es-ES') : '',
      l.last_interaction_at ? new Date(l.last_interaction_at).toLocaleDateString('es-ES') : '',
      l.next_reminder_at ? new Date(l.next_reminder_at).toLocaleDateString('es-ES') : '',
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
