import { z } from 'zod';

const INVITE_ROLES = ['KE_TOAN_TRUONG', 'KE_TOAN', 'XEM'] as const;

export const inviteEmployeeSchema = z.object({
  email: z.string().email(),
  role: z.enum(INVITE_ROLES),
});

export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;
