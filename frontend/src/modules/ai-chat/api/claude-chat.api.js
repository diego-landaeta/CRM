// Claude AI Chat API (CRM-119)
// Backend SSE POST /api/claude/chat — fallback si falta ANTHROPIC_API_KEY

import { getAccessToken } from '@/shared/api/client';

const USE_MOCKS = false;  // Backend listo (con fallback si falta ANTHROPIC_API_KEY)

/**
 * Inicia un chat streaming con Claude.
 * @param {{ message: string, projectId: number, signal?: AbortSignal }} payload
 * @param {(event: { type: 'start'|'delta'|'done'|'error', content?: string, messageId?: string, error?: string }) => void} onEvent
 * @returns {Promise<void>}
 */
export async function streamChatMessage({ message, projectId, signal }, onEvent) {
  if (USE_MOCKS) {
    return mockStream({ message, projectId, signal }, onEvent);
  }
  // Real: usar fetch con response body reader (mas flexible que EventSource para POST + headers)
  const baseUrl = (import.meta.env.BASE_URL || '/crm/').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/claude/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ message, projectId }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    onEvent({ type: 'error', error: err.error || 'Error', code: err.code });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        onEvent(ev);
      } catch {}
    }
  }
}

function getToken() {
  return getAccessToken() || '';
}

// =============== MOCK ===============

const SAMPLE_RESPONSES = {
  resumen: `Aqui tienes el **resumen del mes en curso**:

- **Leads nuevos:** 68 (+12% vs mes anterior)
- **Conversiones:** 12 (tasa 17.6%)
- **Facturacion:** 30.000 €
- **Canal lider:** Meta Ads (28 leads, CPA 88€)

Los leads provenientes de Meta tienen el doble de tasa de conversion que los de Google Ads este mes. Recomiendo desplazar 15% del presupuesto hacia Meta.`,

  inactivos: `Tienes **8 leads sin actividad** en los ultimos 14 dias:

| Nombre | Estado | Dias inactivo | Producto |
|--------|--------|--------------:|----------|
| Maria Lopez | Contactado | 18 | Master Forensia |
| Juan Martinez | En seguimiento | 16 | Curso Clinica |
| Ana Fernandez | Por contactar | 15 | Master Distancia |
| Carlos Diaz | Contactado | 14 | Master Forensia |

**Recomendacion:** prioriza los que estan en "En seguimiento" (mayor probabilidad de cierre). Sandra puede gestionar Maria y Juan, son sus leads asignados.`,

  campanas: `**Rendimiento de campanas (ultimos 30 dias):**

- **Meta Ads** — 28 leads, 6 conversiones, **CPA 88€** ✅ optimo
- **Google Ads** — 18 leads, 3 conversiones, **CPA 132€** ⚠️ alto
- **Organico (SEO)** — 14 leads, 2 conversiones (sin coste directo)

La campana **"Master Forensia 2026"** en Meta tiene el mejor ROAS del mes (4.2x). En Google, **"Search - Consultoria"** subio el CPA un 48% por la entrada de un competidor nuevo en Madrid.

**Accion recomendada:** pausar grupo de anuncios "Display Branding" en Google (CPA 280€) y reasignar el presupuesto a la campana de Meta de mejor rendimiento.`,

  default: `Voy a analizar los datos del proyecto en este momento.

Pregunta detectada: "${'%MSG%'}"

Para darte una respuesta precisa, necesito acceder a los datos del CRM, las campanas activas y las metricas de los ultimos 30 dias. En el sistema real, este flujo orquestaria una llamada a Claude AI con el contexto del proyecto.

**Sugerencias para empezar:**
- Pulsa **Resumen del mes** para ver KPIs clave
- Pulsa **Leads sin actividad** para identificar prioridades
- Pulsa **Rendimiento campanas** para analizar Meta + Google`,
};

function getMockResponse(message) {
  const m = message.toLowerCase();
  if (/resumen|mes|kpi/i.test(m)) return SAMPLE_RESPONSES.resumen;
  if (/inactiv|sin actividad|seguimiento/i.test(m)) return SAMPLE_RESPONSES.inactivos;
  if (/campan|meta|google|ads|ROAS/i.test(m)) return SAMPLE_RESPONSES.campanas;
  return SAMPLE_RESPONSES.default.replace('%MSG%', message);
}

function mockStream({ message, signal }, onEvent) {
  return new Promise((resolve) => {
    const text = getMockResponse(message);
    const messageId = 'msg_' + Math.random().toString(36).slice(2, 9);
    onEvent({ type: 'start', messageId });

    // Streamear por chunks de palabras (~30ms cada uno)
    const tokens = text.match(/\S+\s*/g) || [];
    let i = 0;

    function emit() {
      if (signal?.aborted) {
        onEvent({ type: 'error', error: 'Cancelado' });
        return resolve();
      }
      if (i >= tokens.length) {
        onEvent({ type: 'done', messageId, usage: { promptTokens: 1200, completionTokens: tokens.length } });
        return resolve();
      }
      // Streamear de 1 a 3 tokens a la vez para naturalidad
      const chunkSize = 1 + Math.floor(Math.random() * 2);
      const chunk = tokens.slice(i, i + chunkSize).join('');
      i += chunkSize;
      onEvent({ type: 'delta', content: chunk });
      setTimeout(emit, 25 + Math.random() * 35);
    }
    emit();
  });
}
