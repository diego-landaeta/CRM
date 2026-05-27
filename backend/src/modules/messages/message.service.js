import { AppError } from '../../shared/utils/AppError.js';
import { getClient } from '../../shared/config/db.js';
import * as model from './message.model.js';

export async function getOrCreateDirectConversation(userId, participantId, leadId) {
  if (userId === participantId) {
    throw new AppError('No puedes crear una conversacion contigo mismo', 400, 'SELF_CONVERSATION');
  }

  const users = await model.getActiveUsers();
  const participant = users.find(u => u.id === participantId);
  if (!participant) {
    throw new AppError('Usuario no encontrado o inactivo', 404, 'USER_NOT_FOUND');
  }

  const lockKey = Math.min(userId, participantId) * 100000 + Math.max(userId, participantId);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    const { rows } = await client.query(
      `SELECT c.id FROM conversations c
       WHERE c.type = 'direct'
         AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = $1)
         AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = $2)
       LIMIT 1`,
      [userId, participantId],
    );

    if (rows[0]) {
      await client.query('COMMIT');
      return { id: rows[0].id, created: false };
    }

    const { rows: convRows } = await client.query(
      `INSERT INTO conversations (type, lead_id) VALUES ('direct', $1) RETURNING id`,
      [leadId || null],
    );
    const convId = convRows[0].id;
    await client.query(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)`, [convId, userId]);
    await client.query(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)`, [convId, participantId]);
    await client.query('COMMIT');
    return { id: convId, created: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function sendMessage(conversationId, userId, body, referencedLeadId) {
  const allowed = await model.isParticipant(conversationId, userId);
  if (!allowed) throw new AppError('No eres participante de esta conversacion', 403, 'NOT_PARTICIPANT');

  return model.insertMessage(conversationId, userId, body, referencedLeadId);
}

export async function listConversations(userId, pagination) {
  return model.getConversationsForUser(userId, pagination);
}

export async function listMessages(conversationId, userId, pagination) {
  const allowed = await model.isParticipant(conversationId, userId);
  if (!allowed) throw new AppError('No eres participante de esta conversacion', 403, 'NOT_PARTICIPANT');

  return model.getMessages(conversationId, pagination);
}

export async function markRead(conversationId, userId) {
  const allowed = await model.isParticipant(conversationId, userId);
  if (!allowed) throw new AppError('No eres participante de esta conversacion', 403, 'NOT_PARTICIPANT');

  await model.markConversationRead(conversationId, userId);
}

export async function deleteMessage(msgId, userId) {
  const msg = await model.getMessageById(msgId);
  if (!msg) throw new AppError('Mensaje no encontrado', 404, 'MSG_NOT_FOUND');
  if (msg.sender_id !== userId) throw new AppError('Solo puedes eliminar tus propios mensajes', 403, 'NOT_OWNER');
  await model.deleteMessage(msgId);
}

export async function getUnreadCount(userId) {
  return model.getTotalUnreadCount(userId);
}

export async function getAvailableUsers(search) {
  return model.getActiveUsers(search);
}
