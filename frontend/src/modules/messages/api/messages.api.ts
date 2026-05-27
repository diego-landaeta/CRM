import client from '@/shared/api/client';

export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  title: string | null;
  lead_id: number | null;
  other_user: { id: number; nombre: string; email: string; avatar_url: string | null };
  last_message: { body: string; sender_id: number; created_at: string } | null;
  unread_count: number;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  content_type: string;
  referenced_lead_id: number | null;
  sender_nombre: string;
  sender_avatar: string | null;
  created_at: string;
}

export interface AvailableUser {
  id: number;
  nombre: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

export function getConversations(page = 1, limit = 20) {
  return client.get(`/messages/conversations?page=${page}&limit=${limit}`);
}

export function getUnreadCount() {
  return client.get('/messages/conversations/unread-count');
}

export function createConversation(participantId: number, leadId?: number) {
  return client.post('/messages/conversations', { participantId, leadId });
}

export function getMessages(conversationId: number, page = 1, limit = 50, after?: number) {
  let url = `/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`;
  if (after) url += `&after=${after}`;
  return client.get(url);
}

export function sendMessage(conversationId: number, body: string, referencedLeadId?: number) {
  return client.post(`/messages/conversations/${conversationId}/messages`, { body, referencedLeadId });
}

export function markConversationRead(conversationId: number) {
  return client.patch(`/messages/conversations/${conversationId}/read`);
}

export function postTyping(conversationId: number) {
  return client.post(`/messages/conversations/${conversationId}/typing`);
}

export function getTypingStatus(conversationId: number) {
  return client.get(`/messages/conversations/${conversationId}/typing`);
}

export function deleteMessage(msgId: number) {
  return client.delete(`/messages/messages/${msgId}`);
}

export function getOnlineUsers() {
  return client.get('/messages/users/online');
}

export function getAvailableUsers(search = '') {
  return client.get(`/messages/users/available?search=${encodeURIComponent(search)}`);
}
