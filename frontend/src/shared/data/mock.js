// ============================================================
// MOCK DATA — Datos realistas por proyecto
// Basado en: docs/01-esquema-base-datos.md, CLAUDE.md
// TODO: eliminar este archivo cuando backend este listo
// ============================================================

// --- PROYECTOS (tabla projects) ---
export const PROJECTS = [
  { id: 1, nombre: 'Psiko Aprende', slug: 'psiko-aprende', type: 'crm', domain: 'psikoaprende.com' },
  { id: 2, nombre: 'ISEIH', slug: 'iseih', type: 'crm', domain: 'iseih.com' },
  { id: 3, nombre: 'Fono Aprende', slug: 'fono-aprende', type: 'crm', domain: 'fonoaprende.com' },
  { id: 4, nombre: 'Psicologo IA', slug: 'psicologo-ia', type: 'ia', domain: 'psicologoia.com' },
  { id: 5, nombre: 'Nutricionista IA', slug: 'nutricionista-ia', type: 'ia', domain: 'nutricionistaia.com' },
  { id: 6, nombre: 'Tarot IA', slug: 'tarot-ia', type: 'ia', domain: 'tarotia.com' },
];

// --- USUARIOS (tabla users) ---
export const USERS = [
  { id: 1, nombre: 'Manuel Casas', email: 'manuel@empresa.com', role: 'superadmin', projects: [1, 2, 3, 4, 5, 6] },
  { id: 2, nombre: 'Diego R.', email: 'diego@empresa.com', role: 'admin', projects: [1, 2] },
  { id: 3, nombre: 'Angel M.', email: 'angel@empresa.com', role: 'admin', projects: [1, 3] },
  { id: 4, nombre: 'Laura Gomez', email: 'laura@empresa.com', role: 'gestor', projects: [1] },
  { id: 5, nombre: 'Carlos Vega', email: 'carlos@empresa.com', role: 'gestor', projects: [1, 2] },
];

// --- PRODUCTOS por proyecto (tabla products) ---
export const PRODUCTS = {
  1: [
    { id: 1, project_id: 1, nombre: 'Curso Psicologia Infantil', descripcion: 'Formacion intensiva en psicologia infantil y adolescente', precio: 1200, active: true, has_dossier: true, dossier_version: 2 },
    { id: 2, project_id: 1, nombre: 'Máster Neuroeducación', descripcion: 'Máster oficial en neuroeducación aplicada', precio: 2400, active: true, has_dossier: true, dossier_version: 3 },
    { id: 3, project_id: 1, nombre: 'Taller Mindfulness Educativo', descripcion: 'Taller práctico de mindfulness para docentes', precio: 350, active: true, has_dossier: false },
  ],
  2: [
    { id: 4, project_id: 2, nombre: 'Grado Superior Educación Infantil', descripcion: 'Ciclo formativo oficial de 2 años', precio: 3800, active: true, has_dossier: true, dossier_version: 4 },
    { id: 5, project_id: 2, nombre: 'Curso Atención Temprana', descripcion: 'Especialización en atención temprana 0-6 años', precio: 890, active: true, has_dossier: true, dossier_version: 1 },
  ],
  3: [
    { id: 6, project_id: 3, nombre: 'Taller Logopedia Infantil', descripcion: 'Taller práctico de logopedia para niños', precio: 650, active: true, has_dossier: true, dossier_version: 2 },
    { id: 7, project_id: 3, nombre: 'Curso Dislexia y Lectoescritura', descripcion: 'Intervención en dificultades de lectoescritura', precio: 480, active: true, has_dossier: false },
    { id: 8, project_id: 3, nombre: 'Máster Terapia Miofuncional', descripcion: 'Máster en terapia miofuncional orofacial', precio: 1950, active: false, has_dossier: true, dossier_version: 1 },
  ],
  4: [
    { id: 9, project_id: 4, nombre: 'Plan Básico', descripcion: 'Acceso a chatbot IA con 50 consultas/mes', precio: 9.99, active: true, has_dossier: false },
    { id: 10, project_id: 4, nombre: 'Plan Premium', descripcion: 'Consultas ilimitadas + seguimiento semanal', precio: 29.99, active: true, has_dossier: false },
  ],
  5: [
    { id: 11, project_id: 5, nombre: 'Plan Mensual', descripcion: 'Plan nutricional personalizado por IA', precio: 14.99, active: true, has_dossier: false },
  ],
  6: [
    { id: 12, project_id: 6, nombre: 'Lectura Completa', descripcion: 'Lectura de tarot completa con IA', precio: 4.99, active: true, has_dossier: false },
  ],
};

// --- LEADS por proyecto (tabla leads + lead_utms) ---
const LEAD_NAMES = [
  'Maria Garcia', 'Carlos Lopez', 'Ana Martinez', 'Pedro Sanchez', 'Laura Fernandez',
  'Roberto Diaz', 'Sofia Ruiz', 'Javier Moreno', 'Carmen Jimenez', 'Miguel Torres',
  'Isabel Navarro', 'Alejandro Gil', 'Patricia Vega', 'Fernando Herrero', 'Lucia Ramos',
  'Pablo Ortiz', 'Elena Serrano', 'Marcos Delgado', 'Raquel Molina', 'Adrian Castro',
];

const LEAD_DOMAINS = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'live.com'];
const ORIGENES = ['meta_ads', 'google_ads', 'organico', 'referido', 'directo'];
const ESTADOS = ['nuevo', 'por_contactar', 'contactado', 'en_seguimiento', 'convertido', 'no_interesado'];

// --- TIPOS DE INTERACCION (tabla lead_interactions) ---
const INTERACTION_TYPES = ['llamada', 'email', 'whatsapp', 'nota'];

function generateLeads(projectId, count, startId) {
  const gestores = USERS.filter((u) => u.projects.includes(projectId));
  const products = PRODUCTS[projectId] || [];
  return Array.from({ length: count }, (_, i) => {
    const nameIdx = (startId + i) % LEAD_NAMES.length;
    const name = LEAD_NAMES[nameIdx];
    const emailName = name.toLowerCase().replace(' ', '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const day = Math.max(1, 31 - i);
    const month = day > 20 ? '03' : '04';
    const fecha = `2026-${month}-${String(day).padStart(2, '0')}`;
    const estado = ESTADOS[i % ESTADOS.length];
    const gestor = gestores[i % gestores.length]?.nombre || 'Sin asignar';
    const producto = products[i % (products.length || 1)] || null;
    const isDuplicate = i === 5 || i === 11;

    // Interacciones mock (2-4 por lead)
    const numInteractions = 2 + (i % 3);
    const interacciones = Array.from({ length: numInteractions }, (_, j) => ({
      id: startId * 100 + i * 10 + j,
      tipo: INTERACTION_TYPES[j % INTERACTION_TYPES.length],
      nota: [
        'Primer contacto realizado, interesado en recibir mas informacion',
        'Enviado dossier por email, queda pendiente llamada de seguimiento',
        'Llamada de seguimiento — confirma interes, pide detalles de pago',
        'Nota interna: lead con perfil muy cualificado, priorizar',
      ][j % 4],
      fecha: `2026-${month}-${String(Math.min(28, day + j)).padStart(2, '0')}`,
      created_by: gestor,
    }));

    // Recordatorio mock (50% de leads tienen uno)
    const recordatorio = i % 2 === 0 ? {
      fecha: `2026-04-${String(5 + (i % 20)).padStart(2, '0')}`,
      nota: ['Llamar para seguimiento', 'Enviar propuesta economica', 'Confirmar fecha de inicio'][i % 3],
      completado: i % 4 === 0,
    } : null;

    return {
      id: startId + i,
      project_id: projectId,
      nombre: name,
      email: `${emailName}@${LEAD_DOMAINS[i % LEAD_DOMAINS.length]}`,
      telefono: `+34 6${String(10 + i).padStart(2, '0')} ${String(100 + i * 111).slice(0, 3)} ${String(200 + i * 222).slice(0, 3)}`,
      estado,
      origen: ORIGENES[i % ORIGENES.length],
      gestor,
      fecha,
      campana: i % 3 === 0 ? null : `Campana ${projectId}-${Math.ceil((i + 1) / 3)}`,
      utm_source: ['facebook', 'google', 'google', 'referral', 'direct'][i % 5],
      utm_medium: ['cpc', 'cpc', 'organic', 'word_of_mouth', 'none'][i % 5],
      utm_campaign: i % 3 === 0 ? null : `camp_${projectId}_${Math.ceil((i + 1) / 3)}`,
      utm_content: i % 4 === 0 ? 'video_testimonial' : null,
      landing_url: `https://${PROJECTS.find(p => p.id === projectId)?.domain || 'ejemplo.com'}/solicitud`,
      producto_interes: producto?.nombre || null,
      producto_interes_id: producto?.id || null,
      dossier_enviado: estado !== 'nuevo' && estado !== 'por_contactar' && producto?.has_dossier,
      dossier_enviado_at: estado !== 'nuevo' && estado !== 'por_contactar' ? `2026-${month}-${String(Math.min(28, day + 1)).padStart(2, '0')}` : null,
      notas: i % 3 === 0 ? 'Lead cualificado, muy interesado en la formacion' : null,
      pais: ['Espana', 'Mexico', 'Colombia', 'Argentina', 'Chile', 'Peru', 'Ecuador'][i % 7],
      fbclid: i % 5 === 0 ? `fb.1.${Date.now()}.${1000 + i * 7}` : null,
      gclid: i % 5 === 1 ? `CjwKCAjw${String.fromCharCode(65 + i)}` : null,
      lead_duplicado_de: isDuplicate ? startId : null,
      interacciones,
      recordatorio,
      dias_sin_actualizar: estado === 'en_seguimiento' ? 3 + (i % 5) : estado === 'por_contactar' ? 1 + (i % 3) : 0,
    };
  });
}

export const LEADS = {
  1: generateLeads(1, 18, 1000),
  2: generateLeads(2, 10, 2000),
  3: generateLeads(3, 8, 3000),
  4: generateLeads(4, 12, 4000),
  5: generateLeads(5, 4, 5000),
  6: generateLeads(6, 3, 6000),
};

// --- STATS por proyecto ---
export const STATS = {
  1: { total: 842, nuevo: 127, por_contactar: 64, contactado: 248, en_seguimiento: 89, convertido: 284, no_interesado: 30, ingresosMes: 12450, tasaConversion: 33.7, tasaAbandono: 3.6, cplMedio: 26.29 },
  2: { total: 234, nuevo: 45, por_contactar: 18, contactado: 60, en_seguimiento: 34, convertido: 67, no_interesado: 10, ingresosMes: 8900, tasaConversion: 28.6, tasaAbandono: 4.3, cplMedio: 42.10 },
  3: { total: 128, nuevo: 22, por_contactar: 9, contactado: 32, en_seguimiento: 18, convertido: 38, no_interesado: 9, ingresosMes: 4200, tasaConversion: 29.7, tasaAbandono: 7.0, cplMedio: 31.50 },
  4: { total: 456, nuevo: 89, por_contactar: 34, contactado: 122, en_seguimiento: 67, convertido: 134, no_interesado: 10, ingresosMes: 3420, tasaConversion: 29.4, tasaAbandono: 2.2, cplMedio: 8.50 },
  5: { total: 87, nuevo: 18, por_contactar: 7, contactado: 21, en_seguimiento: 12, convertido: 24, no_interesado: 5, ingresosMes: 890, tasaConversion: 27.6, tasaAbandono: 5.7, cplMedio: 12.30 },
  6: { total: 52, nuevo: 15, por_contactar: 5, contactado: 7, en_seguimiento: 8, convertido: 14, no_interesado: 3, ingresosMes: 340, tasaConversion: 26.9, tasaAbandono: 5.8, cplMedio: 6.20 },
};

// --- LEADS POR SEMANA (dashboard chart) ---
export const LEADS_SEMANA = {
  1: [{ semana: 'Sem 1', leads: 28 }, { semana: 'Sem 2', leads: 35 }, { semana: 'Sem 3', leads: 24 }, { semana: 'Sem 4', leads: 40 }],
  2: [{ semana: 'Sem 1', leads: 12 }, { semana: 'Sem 2', leads: 9 }, { semana: 'Sem 3', leads: 15 }, { semana: 'Sem 4', leads: 9 }],
  3: [{ semana: 'Sem 1', leads: 5 }, { semana: 'Sem 2', leads: 8 }, { semana: 'Sem 3', leads: 4 }, { semana: 'Sem 4', leads: 5 }],
  4: [{ semana: 'Sem 1', leads: 20 }, { semana: 'Sem 2', leads: 25 }, { semana: 'Sem 3', leads: 18 }, { semana: 'Sem 4', leads: 26 }],
  5: [{ semana: 'Sem 1', leads: 4 }, { semana: 'Sem 2', leads: 6 }, { semana: 'Sem 3', leads: 3 }, { semana: 'Sem 4', leads: 5 }],
  6: [{ semana: 'Sem 1', leads: 3 }, { semana: 'Sem 2', leads: 5 }, { semana: 'Sem 3', leads: 4 }, { semana: 'Sem 4', leads: 3 }],
};

// --- CAMPAÑAS por proyecto ---
export const CAMPAIGNS = {
  1: {
    meta: [
      { id: 1, name: 'Psiko — Brand Awareness Q1', dates: '01 ene — 31 mar 2026', status: 'activa', spent: 2340, leads: 89, cpl: 26.29 },
      { id: 2, name: 'Psiko — Retargeting Web', dates: '15 feb — 30 abr 2026', status: 'activa', spent: 1890, leads: 52, cpl: 36.35 },
    ],
    google: [
      { id: 3, name: 'Psiko — Search Brand', dates: '01 ene — 31 mar 2026', status: 'activa', spent: 1200, leads: 67, cpl: 17.91 },
      { id: 4, name: 'Psiko — Search Generic', dates: '01 feb — 30 abr 2026', status: 'activa', spent: 3100, leads: 45, cpl: 68.89 },
    ],
  },
  2: {
    meta: [
      { id: 5, name: 'ISEIH — Captacion Grado Superior', dates: '01 feb — 30 abr 2026', status: 'activa', spent: 1890, leads: 52, cpl: 36.35 },
      { id: 6, name: 'ISEIH — Open Day Mayo', dates: '01 abr — 15 may 2026', status: 'activa', spent: 320, leads: 8, cpl: 40.00 },
    ],
    google: [
      { id: 7, name: 'ISEIH — Display Master', dates: '01 — 31 mar 2026', status: 'finalizada', spent: 890, leads: 18, cpl: 49.44 },
    ],
  },
  3: {
    meta: [
      { id: 8, name: 'Fono — Captacion Taller Logopedia', dates: '01 — 31 mar 2026', status: 'pausada', spent: 450, leads: 12, cpl: 37.50 },
    ],
    google: [
      { id: 9, name: 'Fono — Search Dislexia', dates: '15 mar — 15 abr 2026', status: 'activa', spent: 280, leads: 9, cpl: 31.11 },
    ],
  },
  4: {
    meta: [
      { id: 10, name: 'PsicoIA — Lanzamiento App', dates: '15 mar — 15 abr 2026', status: 'activa', spent: 780, leads: 38, cpl: 20.53 },
      { id: 11, name: 'PsicoIA — Retargeting Usuarios', dates: '01 — 30 abr 2026', status: 'activa', spent: 340, leads: 51, cpl: 6.67 },
    ],
    google: [
      { id: 12, name: 'PsicoIA — Search Terapia Online', dates: '01 mar — 30 abr 2026', status: 'activa', spent: 560, leads: 34, cpl: 16.47 },
    ],
  },
  5: {
    meta: [{ id: 13, name: 'NutriIA — Beta Launch', dates: '15 mar — 15 abr 2026', status: 'activa', spent: 220, leads: 18, cpl: 12.22 }],
    google: [],
  },
  6: {
    meta: [{ id: 14, name: 'TarotIA — TikTok Cross', dates: '01 — 30 abr 2026', status: 'activa', spent: 95, leads: 15, cpl: 6.33 }],
    google: [],
  },
};

// --- INGRESOS MENSUALES por proyecto ---
export const REVENUE_MONTHLY = {
  1: [{ mes: 'Oct', v: 8200 }, { mes: 'Nov', v: 9400 }, { mes: 'Dic', v: 11800 }, { mes: 'Ene', v: 10500 }, { mes: 'Feb', v: 11200 }, { mes: 'Mar', v: 12450 }],
  2: [{ mes: 'Oct', v: 5600 }, { mes: 'Nov', v: 6200 }, { mes: 'Dic', v: 7800 }, { mes: 'Ene', v: 7100 }, { mes: 'Feb', v: 8200 }, { mes: 'Mar', v: 8900 }],
  3: [{ mes: 'Oct', v: 2100 }, { mes: 'Nov', v: 2800 }, { mes: 'Dic', v: 3200 }, { mes: 'Ene', v: 3500 }, { mes: 'Feb', v: 3800 }, { mes: 'Mar', v: 4200 }],
  4: [{ mes: 'Oct', v: 0 }, { mes: 'Nov', v: 0 }, { mes: 'Dic', v: 450 }, { mes: 'Ene', v: 1200 }, { mes: 'Feb', v: 2100 }, { mes: 'Mar', v: 3420 }],
  5: [{ mes: 'Oct', v: 0 }, { mes: 'Nov', v: 0 }, { mes: 'Dic', v: 0 }, { mes: 'Ene', v: 120 }, { mes: 'Feb', v: 450 }, { mes: 'Mar', v: 890 }],
  6: [{ mes: 'Oct', v: 0 }, { mes: 'Nov', v: 0 }, { mes: 'Dic', v: 0 }, { mes: 'Ene', v: 0 }, { mes: 'Feb', v: 80 }, { mes: 'Mar', v: 340 }],
};

// --- CONVERSIONES RECIENTES por proyecto ---
export const CONVERSIONS = {
  1: [
    { id: 1, lead: 'Sofia Ruiz', producto: 'Curso Psicologia Infantil', monto: 1200, fecha: '26 mar 2026', tipo: 'pago_completo' },
    { id: 2, lead: 'Isabel Navarro', producto: 'Master Neuroeducacion', monto: 800, fecha: '22 mar 2026', tipo: 'abono_parcial' },
    { id: 3, lead: 'Fernando Vega', producto: 'Curso Psicologia Infantil', monto: 1200, fecha: '18 mar 2026', tipo: 'pago_completo' },
    { id: 4, lead: 'Lucia Herrero', producto: 'Master Neuroeducacion', monto: 600, fecha: '15 mar 2026', tipo: 'abono_parcial' },
    { id: 5, lead: 'Pablo Ramos', producto: 'Taller Mindfulness Educativo', monto: 350, fecha: '12 mar 2026', tipo: 'pago_completo' },
  ],
  2: [
    { id: 6, lead: 'Marta Diaz', producto: 'Grado Superior Educacion Infantil', monto: 1900, fecha: '25 mar 2026', tipo: 'abono_parcial' },
    { id: 7, lead: 'Jorge Ruiz', producto: 'Curso Atencion Temprana', monto: 890, fecha: '20 mar 2026', tipo: 'pago_completo' },
  ],
  3: [
    { id: 8, lead: 'Clara Moreno', producto: 'Taller Logopedia Infantil', monto: 650, fecha: '24 mar 2026', tipo: 'pago_completo' },
    { id: 9, lead: 'Daniel Torres', producto: 'Curso Dislexia y Lectoescritura', monto: 480, fecha: '19 mar 2026', tipo: 'pago_completo' },
  ],
  4: [
    { id: 10, lead: 'Ana B.', producto: 'Plan Premium', monto: 29.99, fecha: '30 mar 2026', tipo: 'pago_completo' },
    { id: 11, lead: 'Luis M.', producto: 'Plan Premium', monto: 29.99, fecha: '28 mar 2026', tipo: 'pago_completo' },
    { id: 12, lead: 'Sara G.', producto: 'Plan Basico', monto: 9.99, fecha: '27 mar 2026', tipo: 'pago_completo' },
  ],
  5: [
    { id: 13, lead: 'Rosa P.', producto: 'Plan Mensual', monto: 14.99, fecha: '29 mar 2026', tipo: 'pago_completo' },
  ],
  6: [
    { id: 14, lead: 'Victor L.', producto: 'Lectura Completa', monto: 4.99, fecha: '31 mar 2026', tipo: 'pago_completo' },
  ],
};
