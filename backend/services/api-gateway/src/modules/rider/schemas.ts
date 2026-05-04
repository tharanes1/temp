/**
 * Zod schemas for the Rider module — single validation layer (spec §15).
 *
 * Locked decisions reflected here:
 *   A5 — vehicleType ∈ {petrol, ev} AND bikeType ∈ {bike, bicycle, scooter, ev}
 *        with refinement: bikeType=bicycle ⇒ vehicleType must be null/omitted
 *   A6 — money is rupees-as-decimal (not relevant to this slice)
 */
import { z } from 'zod';

// ─── Profile ─────────────────────────────────────────────────────

export const UpdateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    profileImage: z.string().url().max(2048).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine(
        (v) => {
          const d = new Date(v);
          return !Number.isNaN(d.valueOf()) && d.getFullYear() >= 1940 && d.getFullYear() <= 2014;
        },
        { message: 'Date of birth must be between 1940 and 2014' },
      )
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ─── Status ──────────────────────────────────────────────────────

export const UpdateStatusSchema = z
  .object({
    isOnline: z.boolean(),
  })
  .strict();

export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

// ─── Vehicle (locked A5) ─────────────────────────────────────────

export const VehicleTypeEnum = z.enum(['petrol', 'ev']);
export const BikeTypeEnum = z.enum(['bike', 'bicycle', 'scooter', 'ev']);

const RegistrationRegex = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;

export const UpdateVehicleSchema = z
  .object({
    vehicleType: VehicleTypeEnum.nullable().optional(), // null permitted for bicycles
    bikeType: BikeTypeEnum.optional(),
    make: z.string().trim().max(50).optional(),
    model: z.string().trim().max(50).optional(),
    year: z
      .number()
      .int()
      .min(2010)
      .max(new Date().getFullYear() + 1)
      .optional(),
    registrationNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(RegistrationRegex, 'Format: KA01AB1234')
      .optional(),
    rcImage: z.string().url().max(2048).optional(),
    bikePhoto: z.string().url().max(2048).optional(),
    insuranceNumber: z.string().trim().max(40).optional(),
    insurancePolicy: z.string().url().max(2048).optional(),
    insuranceExpiry: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' })
  // Locked A5: bicycles have no fuel type; everything else requires one when bikeType is set.
  .refine(
    (v) => {
      if (v.bikeType === 'bicycle' && v.vehicleType !== undefined && v.vehicleType !== null) {
        return false;
      }
      return true;
    },
    {
      message: 'Bicycles must have vehicleType=null',
      path: ['vehicleType'],
    },
  )
  .refine(
    (v) => {
      if (
        v.bikeType !== undefined &&
        v.bikeType !== 'bicycle' &&
        v.vehicleType === null
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Non-bicycle vehicles require vehicleType (petrol|ev)',
      path: ['vehicleType'],
    },
  );

export type UpdateVehicleInput = z.infer<typeof UpdateVehicleSchema>;
