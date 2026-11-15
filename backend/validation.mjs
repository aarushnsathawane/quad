import { z } from 'zod';
const text = (max) => z.string().trim().max(max);
export const emailSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(254) })
  .strict();
export const verifySchema = emailSchema
  .extend({ code: z.string().regex(/^\d{6}$/), termsAccepted: z.literal(true) })
  .strict();
export const profileSchema = z
  .object({
    firstName: text(40).min(1),
    lastName: text(40).min(1),
    major: text(100).min(1),
    year: z.number().int().min(2020).max(2045).nullable(),
    bio: text(240),
    avatar: z.number().int().min(0).max(12),
    interests: z.array(text(40).min(1)).max(8),
    clubs: z.array(text(100).min(1)).max(6),
    experiences: z
      .array(
        z
          .object({
            title: text(80).min(1),
            organization: text(80),
            when: text(40),
            description: text(240),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
export const visibilitySchema = z
  .object({
    audience: z.enum(['nobody', 'connections', 'university']),
    minutes: z.number().int().min(1).max(1440).nullable(),
    position: z
      .object({ lat: z.number().min(40.47).max(40.54), lng: z.number().min(-74.49).max(-74.41) })
      .strict()
      .optional(),
  })
  .strict();
export const eventSchema = z
  .object({
    title: text(80).min(3),
    campus: z.enum(['college', 'busch', 'livingston', 'cook']),
    venue: text(120).min(2),
    startsAt: z.number().int(),
    endsAt: z.number().int(),
    kind: z.enum(['public', 'invite']),
    category: text(30).min(1),
    description: text(1000),
    invitees: z.array(z.string().uuid()).max(100).default([]),
  })
  .strict();
export const messageSchema = z
  .object({ text: text(1000).min(1), clientId: z.string().uuid() })
  .strict();
export const reportSchema = z
  .object({
    personId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),
    reason: text(80).min(1),
    details: text(1000),
  })
  .strict()
  .refine((v) => !!v.personId !== !!v.eventId, 'Report one person or one event');
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw Object.assign(new Error(result.error.issues[0]?.message || 'Invalid input'), {
      statusCode: 400,
    });
  return result.data;
}
export const emptyProfile = () => ({
  firstName: '',
  lastName: '',
  major: 'Undeclared',
  year: null,
  bio: '',
  avatar: 0,
  interests: [],
  clubs: [],
  experiences: [],
});
