import { z } from 'zod';

export const createConversationSchema = z.object({
  participantId: z.number().int().positive(),
  leadId: z.number().int().positive().optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  referencedLeadId: z.number().int().positive().optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const messagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  after: z.coerce.number().int().positive().optional(),
});
