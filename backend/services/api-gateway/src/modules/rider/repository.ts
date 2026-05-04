/**
 * Persistence layer for the Rider module. Pure Prisma; no business logic.
 */
import { Prisma, type Vehicle, type Rider, type BikeType, type VehiclePower, type Gender } from '@prisma/client';

import { prisma } from '../../config/database.js';

export interface UpdateProfilePatch {
  name?: string;
  email?: string;
  profileImage?: string;
  gender?: Gender;
  dateOfBirth?: Date;
}

export interface UpdateVehiclePatch {
  vehicleType?: VehiclePower | null;
  bikeType?: BikeType;
  make?: string;
  model?: string;
  year?: number;
  registrationNumber?: string;
  rcImage?: string;
  bikePhoto?: string;
  insuranceNumber?: string;
  insurancePolicy?: string;
  insuranceExpiry?: Date;
}

export const riderRepository = {
  async findById(id: string): Promise<(Rider & { vehicle: Vehicle | null }) | null> {
    return prisma.rider.findUnique({
      where: { id },
      include: { vehicle: true },
    });
  },

  async findVehicle(riderId: string): Promise<Vehicle | null> {
    return prisma.vehicle.findUnique({ where: { riderId } });
  },

  async patchProfile(id: string, patch: UpdateProfilePatch): Promise<Rider> {
    const data: Prisma.RiderUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.profileImage !== undefined) data.profileImage = patch.profileImage;
    if (patch.gender !== undefined) data.gender = patch.gender;
    if (patch.dateOfBirth !== undefined) data.dateOfBirth = patch.dateOfBirth;
    return prisma.rider.update({ where: { id }, data });
  },

  /**
   * Idempotent vehicle upsert. We always upsert because a brand-new rider has
   * no Vehicle row yet — but the spec exposes PATCH semantics. Trade-off
   * accepted: PATCH on a missing resource creates one rather than 404'ing,
   * which matches the frontend's "fill in your vehicle details" UX.
   */
  async upsertVehicle(riderId: string, patch: UpdateVehiclePatch): Promise<Vehicle> {
    const create: Prisma.VehicleCreateWithoutRiderInput = {};
    const update: Prisma.VehicleUpdateInput = {};

    if (patch.vehicleType !== undefined) {
      create.vehicleType = patch.vehicleType;
      update.vehicleType = patch.vehicleType;
    }
    if (patch.bikeType !== undefined) {
      create.bikeType = patch.bikeType;
      update.bikeType = patch.bikeType;
    }
    if (patch.make !== undefined) {
      create.make = patch.make;
      update.make = patch.make;
    }
    if (patch.model !== undefined) {
      create.model = patch.model;
      update.model = patch.model;
    }
    if (patch.year !== undefined) {
      create.year = patch.year;
      update.year = patch.year;
    }
    if (patch.registrationNumber !== undefined) {
      create.registrationNumber = patch.registrationNumber;
      update.registrationNumber = patch.registrationNumber;
    }
    if (patch.rcImage !== undefined) {
      create.rcImage = patch.rcImage;
      update.rcImage = patch.rcImage;
    }
    if (patch.bikePhoto !== undefined) {
      create.bikePhoto = patch.bikePhoto;
      update.bikePhoto = patch.bikePhoto;
    }
    if (patch.insuranceNumber !== undefined) {
      create.insuranceNumber = patch.insuranceNumber;
      update.insuranceNumber = patch.insuranceNumber;
    }
    if (patch.insurancePolicy !== undefined) {
      create.insurancePolicy = patch.insurancePolicy;
      update.insurancePolicy = patch.insurancePolicy;
    }
    if (patch.insuranceExpiry !== undefined) {
      create.insuranceExpiry = patch.insuranceExpiry;
      update.insuranceExpiry = patch.insuranceExpiry;
    }

    return prisma.vehicle.upsert({
      where: { riderId },
      create: { ...create, rider: { connect: { id: riderId } } },
      update,
    });
  },
};
