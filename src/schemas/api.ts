import { z } from 'zod';
import { allocationsSchema, categorySchema, stateSchema, transactionSchema } from '@/engine/Types';
import { dailyReviewSchema } from '@/engine/DailyReview';
export const dailyInput=z.object({state:stateSchema,kind:z.literal('close')});
export const dailyOutput=dailyReviewSchema;
export const auditInput = z.object({ income: z.number().positive().max(1000000), jars: allocationsSchema });
export const auditOutput = z.object({ isValid: z.boolean(), riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']), commentary: z.string().max(2000), recommendedAdjustments: allocationsSchema });
export const adviceOutput = z.object({ critique: z.string().max(2000), recoverySteps: z.array(z.string().max(500)).min(1).max(5) });
export const adviceInput = z.object({ state: stateSchema, kind: z.enum(['breach', 'postmortem']).default('breach') });
export const mockInput = z.object({ turn: z.number().int().positive(), index: z.number().int().min(0), category: categorySchema, amount: z.number().positive().max(100000) });
export const syncOutput = z.object({ balance: z.number().finite(), transactions: z.array(transactionSchema), accountName: z.string() });
export const responseSchema = <T extends z.ZodType>(data: T) => z.object({ success: z.literal(true), data, source: z.enum(['gemini', 'fallback', 'nessie', 'demo']).optional() });

export const usernameSchema = z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only.');
export const passwordSchema = z.string().min(6).max(200);
export const signupInput = z.object({ username: usernameSchema, password: passwordSchema, initialState: stateSchema });
export const loginInput = z.object({ username: usernameSchema, password: passwordSchema });
export const gameSaveInput = z.object({ state: stateSchema });
