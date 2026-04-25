import * as model from './chat.model.js';
import { query } from '../../shared/config/db.js';
import { AppError } from '../../shared/utils/AppError.js';
import { getDecryptedValue } from '../credentials/credentials.model.js';
import { logger } from '../../shared/utils/logger.js';

const RATE_LIMIT = parseInt(process.env.CHAT_MAX_MESSAGES_PER_HOUR || '20');

async function getAnthropicKey(projectId = null) {
  try {
    if (projectId) {
      const v = await getDecryptedValue('anthropic', projectId);
      if (v) return v;
    }
    const g = await getDecryptedValue('anthropic', null);
    if (g) return g;
  } catch {}
  return process.env.ANTHROPIC_API_KEY || null;
}

async function buildSystemContext(projectId) {
  if (!projectId) return 'Eres un asistente CRM. Responde de forma concisa.';
  const { rows: pjRows } = await query(`SELECT nombre, type FROM projects WHERE id = $1`, [projectId]);
  const { rows: leadsRows } = await query(
    `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as ultimos30
       FROM leads WHERE project_id = $1`, [projectId]);
  const { rows: convRows } = await query(
    `SELECT COUNT(*) as total, COALESCE(SUM(importe_total),0) as facturado
       FROM conversions WHERE project_id = $1 AND fecha_conversion > NOW() - INTERVAL '30 days'`, [projectId]);
  const pj = pjRows[0] || {};
  return `Eres un analista CRM para el proyecto "${pj.nombre}" (tipo: ${pj.type}).
Datos rapidos (ultimos 30 dias):
- Leads totales en BD: ${leadsRows[0]?.total || 0}, nuevos ultimos 30d: ${leadsRows[0]?.ultimos30 || 0}
- Conversiones ultimos 30d: ${convRows[0]?.total || 0}, facturado: €${Number(convRows[0]?.facturado || 0).toFixed(2)}

Responde siempre en español, conciso, con datos concretos. Cuando el usuario pida un dato que no tienes, dilo abiertamente y sugiere donde mirar en el CRM.`;
}

// SSE wrapper helpers
function sseInit(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}
function sseSend(res, type, data) {
  res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

export async function chat(req, res, next) {
  try {
    const { message, projectId, conversationId } = req.body || {};
    if (!message) throw new AppError('message requerido', 400, 'VALIDATION_ERROR');

    // Rate limit
    const used = await model.countUserMessagesLastHour(req.user.id);
    if (used >= RATE_LIMIT) {
      throw new AppError(`Limite ${RATE_LIMIT} msg/hora alcanzado`, 429, 'RATE_LIMITED');
    }

    // Conversation
    let conv;
    if (conversationId) conv = await model.findConversation(conversationId);
    if (!conv) conv = await model.createConversation(projectId || null, req.user.id, message.slice(0, 80));
    await model.addMessage({ conversation_id: conv.id, role: 'user', content: message });

    sseInit(res);
    sseSend(res, 'start', { messageId: conv.id });

    const apiKey = await getAnthropicKey(projectId);
    if (!apiKey) {
      const fallback = '⚠️ El chat IA no esta disponible aun. Falta configurar `ANTHROPIC_API_KEY` en Settings > APIs (proyecto) o en variables de entorno del servidor.';
      sseSend(res, 'delta', { content: fallback });
      await model.addMessage({ conversation_id: conv.id, role: 'assistant', content: fallback });
      sseSend(res, 'done', { messageId: conv.id, warning: 'NO_API_KEY' });
      res.end();
      return;
    }

    // Llamar Anthropic con stream
    const system = await buildSystemContext(projectId);
    const history = await model.listMessages(conv.id);
    const messages = history.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));

    let fullContent = '';
    let inputTokens = 0; let outputTokens = 0;

    try {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5',
          max_tokens: 2048,
          system,
          messages,
          stream: true,
        }),
      });
      if (!upstream.ok) {
        const body = await upstream.text();
        throw new Error(`Anthropic ${upstream.status}: ${body.slice(0, 200)}`);
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === 'content_block_delta' && evt.delta?.text) {
              fullContent += evt.delta.text;
              sseSend(res, 'delta', { content: evt.delta.text });
            } else if (evt.type === 'message_delta' && evt.usage) {
              outputTokens = evt.usage.output_tokens || 0;
            } else if (evt.type === 'message_start' && evt.message?.usage) {
              inputTokens = evt.message.usage.input_tokens || 0;
            }
          } catch {}
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Claude SSE error');
      sseSend(res, 'delta', { content: `\n\n[Error consultando Claude: ${err.message}]` });
      sseSend(res, 'done', { messageId: conv.id, error: true });
      res.end();
      return;
    }

    await model.addMessage({
      conversation_id: conv.id,
      role: 'assistant',
      content: fullContent,
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
    });
    sseSend(res, 'done', {
      messageId: conv.id,
      usage: { promptTokens: inputTokens, completionTokens: outputTokens },
    });
    res.end();
  } catch (err) { next(err); }
}

export async function listConversations(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT * FROM ai_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 30`,
      [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function getMessages(req, res, next) {
  try {
    const conv = await model.findConversation(req.params.conversationId);
    if (!conv || conv.user_id !== req.user.id) throw new AppError('No encontrada', 404, 'NOT_FOUND');
    const messages = await model.listMessages(conv.id);
    res.json({ success: true, data: { conversation: conv, messages } });
  } catch (err) { next(err); }
}

export async function status(req, res, next) {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId) : null;
    const apiKey = await getAnthropicKey(projectId);
    res.json({
      success: true,
      data: {
        api_configured: !!apiKey,
        rate_limit_per_hour: RATE_LIMIT,
        used_last_hour: await model.countUserMessagesLastHour(req.user.id),
        warning: apiKey ? null : 'ANTHROPIC_API_KEY no configurada. Configura en Settings > APIs.',
      },
    });
  } catch (err) { next(err); }
}
