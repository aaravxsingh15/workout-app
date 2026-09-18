import { z } from 'zod';
import { EQUIPMENT, FIELD_KEYS, MUSCLE_GROUPS, TRACKING_MODES } from '@/types/domain';

export const emailSchema = z.string().trim().min(1, 'Enter your email').email('Enter a valid email');
export const passwordSchema = z.string().min(8, 'At least 8 characters');

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password') });
export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Enter your name').max(50),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, 'Give the exercise a name').max(120),
  primary_muscle: z.enum(MUSCLE_GROUPS),
  secondary_muscles: z.array(z.enum(MUSCLE_GROUPS)),
  equipment: z.enum(EQUIPMENT),
  tracking_mode: z.enum(TRACKING_MODES),
  custom_fields: z.array(z.enum(FIELD_KEYS)),
  instructions: z.string().max(4000),
  personal_notes: z.string().max(4000),
  is_unilateral: z.boolean(),
});
export type ExerciseFormValues = z.infer<typeof exerciseSchema>;

/** Parses a user-typed decimal ("62,5" or "62.5"); returns null for blank and NaN for garbage. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
}

export function parseIntStrict(text: string): number | null {
  const n = parseDecimal(text);
  if (n === null || Number.isNaN(n)) return n;
  return Math.round(n);
}

export const bodyweightSchema = z.object({
  weight: z.number().positive('Enter a weight').max(700, 'That seems too high'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  note: z.string().max(300),
});
