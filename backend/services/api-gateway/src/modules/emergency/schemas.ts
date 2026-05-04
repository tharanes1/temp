/**
 * Zod schemas for /api/v1/emergency/*.
 */
import { PhoneSchema } from '@cravix/shared-types';
import { z } from 'zod';

export const RelationshipEnum = z.enum(['spouse', 'parent', 'sibling', 'friend', 'other']);
export type Relationship = z.infer<typeof RelationshipEnum>;

export const CreateContactSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: PhoneSchema,
    relationship: RelationshipEnum,
    isPrimary: z.boolean().default(false),
  })
  .strict();
export type CreateContactInput = z.infer<typeof CreateContactSchema>;

export const UpdateContactSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: PhoneSchema.optional(),
    relationship: RelationshipEnum.optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;

export const ContactIdParam = z
  .object({ contactId: z.string().min(1).max(64) })
  .strict();

const BloodGroupEnum = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

export const UpdateMedicalSchema = z
  .object({
    bloodGroup: BloodGroupEnum.nullable().optional(),
    allergies: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    medicalConditions: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    medications: z.string().trim().max(600).nullable().optional(),
    insurancePolicyNumber: z.string().trim().max(40).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
export type UpdateMedicalInput = z.infer<typeof UpdateMedicalSchema>;

export const SosTriggerSchema = z
  .object({
    latitude: z.number().gte(-90).lte(90),
    longitude: z.number().gte(-180).lte(180),
    type: z.enum(['accident', 'medical', 'safety', 'other']),
    note: z.string().trim().max(400).optional(),
  })
  .strict();
export type SosTriggerInput = z.infer<typeof SosTriggerSchema>;
