import { query } from '../../shared/config/db.js';

export async function createConversation(projectId, userId, title) {
  const { rows } = await query(
    `INSERT INTO ai_conversations (project_id, user_id, title) VALUES ($1, $2, $3) RETURNING *`,
    [projectId, userId, title || null]);
  return rows[0];
}
export async function findConversation(id) {
  const { rows } = await query(`SELECT * FROM ai_conversations WHERE id = $1`, [id]);
  return rows[0] || null;
}
export async function listMessages(conversationId) {
  const { rows } = await query(`SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`, [conversationId]);
  return rows;
}
export async function addMessage({ conversation_id, role, content, prompt_tokens, completion_tokens }) {
  const { rows } = await query(
    `INSERT INTO ai_messages (conversation_id, role, content, prompt_tokens, completion_tokens)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [conversation_id, role, content, prompt_tokens || null, completion_tokens || null]);
  await query(`UPDATE ai_conversations SET updated_at = NOW() WHERE id = $1`, [conversation_id]);
  return rows[0];
}

// Rate limit: cuenta msgs del usuario en la ultima hora
export async function countUserMessagesLastHour(userId) {
  const { rows } = await query(
    `SELECT COUNT(*) FROM ai_messages m
       JOIN ai_conversations c ON c.id = m.conversation_id
      WHERE c.user_id = $1 AND m.role = 'user' AND m.created_at > NOW() - INTERVAL '1 hour'`,
    [userId]);
  return parseInt(rows[0].count);
}
