import * as service from './message.service.js';
import {
  createConversationSchema,
  sendMessageSchema,
  listQuerySchema,
  messagesQuerySchema,
} from './message.validation.js';

// Estado efímero en memoria — typing indicators y presencia online
const typingState = new Map(); // convId -> Map<userId, timestamp>
const onlineState = new Map(); // userId -> timestamp

const TYPING_TTL = 4_000;
const ONLINE_TTL = 60_000;

export async function listConversations(req, res, next) {
  try {
    const { page, limit } = listQuerySchema.parse(req.query);
    onlineState.set(req.user.userId, Date.now());
    const result = await service.listConversations(req.user.userId, { page, limit });
    const totalPages = Math.ceil(result.total / limit);
    res.json({
      success: true,
      data: result.conversations,
      pagination: { total: result.total, page, limit, totalPages },
    });
  } catch (err) { next(err); }
}

export async function unreadCount(req, res, next) {
  try {
    onlineState.set(req.user.userId, Date.now());
    const count = await service.getUnreadCount(req.user.userId);
    res.json({ success: true, data: { count } });
  } catch (err) { next(err); }
}

export async function createConversation(req, res, next) {
  try {
    const { participantId, leadId } = createConversationSchema.parse(req.body);
    const result = await service.getOrCreateDirectConversation(req.user.userId, participantId, leadId);
    res.status(result.created ? 201 : 200).json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function listMessages(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const { page, limit, after } = messagesQuerySchema.parse(req.query);
    onlineState.set(req.user.userId, Date.now());
    const result = await service.listMessages(conversationId, req.user.userId, { page, limit, after });
    const totalPages = Math.ceil(result.total / limit);
    res.json({
      success: true,
      data: result.messages,
      pagination: { total: result.total, page, limit, totalPages },
    });
  } catch (err) { next(err); }
}

export async function sendMessage(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const { body, referencedLeadId } = sendMessageSchema.parse(req.body);
    const message = await service.sendMessage(conversationId, req.user.userId, body, referencedLeadId);
    // Limpiar typing al enviar
    const convTyping = typingState.get(conversationId);
    if (convTyping) convTyping.delete(req.user.userId);
    res.status(201).json({ success: true, data: message });
  } catch (err) { next(err); }
}

export async function markRead(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    await service.markRead(conversationId, req.user.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function typing(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const userId = req.user.userId;
    if (!typingState.has(conversationId)) typingState.set(conversationId, new Map());
    typingState.get(conversationId).set(userId, Date.now());
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function getTyping(req, res, next) {
  try {
    const conversationId = Number(req.params.id);
    const userId = req.user.userId;
    const now = Date.now();
    const convTyping = typingState.get(conversationId);
    const typingUsers = [];
    if (convTyping) {
      for (const [uid, ts] of convTyping) {
        if (uid !== userId && now - ts < TYPING_TTL) typingUsers.push(uid);
        else if (now - ts >= TYPING_TTL) convTyping.delete(uid);
      }
    }
    res.json({ success: true, data: { typing: typingUsers } });
  } catch (err) { next(err); }
}

export async function deleteMessage(req, res, next) {
  try {
    const msgId = Number(req.params.msgId);
    await service.deleteMessage(msgId, req.user.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

export async function availableUsers(req, res, next) {
  try {
    const search = req.query.search || '';
    const users = await service.getAvailableUsers(search);
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
}

export async function onlineUsers(req, res, next) {
  try {
    const now = Date.now();
    const online = [];
    for (const [uid, ts] of onlineState) {
      if (now - ts < ONLINE_TTL) online.push(uid);
      else onlineState.delete(uid);
    }
    res.json({ success: true, data: { online } });
  } catch (err) { next(err); }
}
