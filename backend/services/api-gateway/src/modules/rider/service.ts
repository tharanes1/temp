/**
 * Rider service. Implements spec §5.2:
 *   • GET    /rider/profile   — Redis-cached 60s
 *   • PATCH  /rider/profile   — invalidates cache
 *   • GET    /rider/status    — Redis-only read (never Postgres) per spec §13 #2
 *   • PATCH  /rider/status    — Redis hash + emit "rider:going-online|offline" (Socket slice will subscribe)
 *   • GET    /rider/vehicle
 *   • PATCH  /rider/vehicle   — locked A5 vehicle+bike split
 */
import { NotFoundError } from '@cravix/shared-errors';
import { logger } from '@cravix/shared-logger';
import { redis, RedisKeys } from '@cravix/shared-redis';
import type { BikeType, VehiclePower, Gender } from '@prisma/client';

import { riderRepository, type UpdateProfilePatch, type UpdateVehiclePatch } from './repository.js';
import type { UpdateProfileInput, UpdateStatusInput, UpdateVehicleInput } from './schemas.js';
import type { RiderProfileDto, RiderStatusDto, VehicleDto } from './types.js';

const PROFILE_CACHE_TTL = 60; // seconds (spec §5.2)
const STATUS_TTL_SECONDS = 4 * 60 * 60; // spec §8 — rider:status:{id} TTL 4h

// ─── Status helpers (Redis is the source of truth) ───────────────

async function readStatus(riderId: string): Promise<RiderStatusDto> {
  const raw = await redis.hgetall(RedisKeys.riderStatus(riderId));
  if (!raw || Object.keys(raw).length === 0) {
    return { isOnline: false, since: null, lastSeen: null };
  }
  const isOnlineNum = Number.parseInt(raw.isOnline ?? '0', 10);
  const sinceMs = raw.since ? Number.parseInt(raw.since, 10) : 0;
  const lastSeenMs = raw.lastSeen ? Number.parseInt(raw.lastSeen, 10) : 0;
  return {
    isOnline: isOnlineNum === 1,
    since: sinceMs > 0 ? new Date(sinceMs).toISOString() : null,
    lastSeen: lastSeenMs > 0 ? new Date(lastSeenMs).toISOString() : null,
  };
}

async function writeStatus(riderId: string, isOnline: boolean): Promise<RiderStatusDto> {
  const now = Date.now();
  const key = RedisKeys.riderStatus(riderId);
  if (isOnline) {
    await redis
      .multi()
      .hset(key, { isOnline: '1', since: String(now), lastSeen: String(now) })
      .expire(key, STATUS_TTL_SECONDS)
      .exec();
  } else {
    // Going offline: keep the hash for "last seen" telemetry but flip the bit.
    await redis
      .multi()
      .hset(key, { isOnline: '0', lastSeen: String(now) })
      .expire(key, STATUS_TTL_SECONDS)
      // Drop the live-location key so the assignment engine can no longer pick this rider.
      .del(RedisKeys.riderLocation(riderId))
      .exec();
  }
  return readStatus(riderId);
}

// ─── Projection helpers ──────────────────────────────────────────

const ProfileGenderToWire: Record<Gender, 'male' | 'female' | 'other'> = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
};

const VehiclePowerToWire: Record<VehiclePower, 'petrol' | 'ev'> = {
  PETROL: 'petrol',
  EV: 'ev',
};

const BikeTypeToWire: Record<BikeType, 'bike' | 'bicycle' | 'scooter' | 'ev'> = {
  BIKE: 'bike',
  BICYCLE: 'bicycle',
  SCOOTER: 'scooter',
  EV: 'ev',
};

const KycStatusToWire = (s: string): RiderProfileDto['kycStatus'] =>
  s.toLowerCase() as RiderProfileDto['kycStatus'];

function projectVehicle(v: import('@prisma/client').Vehicle | null): VehicleDto {
  return {
    vehicleType: v?.vehicleType ? VehiclePowerToWire[v.vehicleType] : null,
    bikeType: v?.bikeType ? BikeTypeToWire[v.bikeType] : null,
    make: v?.make ?? null,
    model: v?.model ?? null,
    year: v?.year ?? null,
    registrationNumber: v?.registrationNumber ?? null,
    rcImage: v?.rcImage ?? null,
    bikePhoto: v?.bikePhoto ?? null,
    insuranceNumber: v?.insuranceNumber ?? null,
    insurancePolicy: v?.insurancePolicy ?? null,
    insuranceExpiry: v?.insuranceExpiry ? v.insuranceExpiry.toISOString().slice(0, 10) : null,
  };
}

// ─── Public API ──────────────────────────────────────────────────

export const riderService = {
  /**
   * GET /rider/profile — cache-aside (60s).  Status comes from Redis even
   * inside the cache so the cached payload stays mostly stable while isOnline
   * stays live (we re-merge on every read).
   */
  async getProfile(riderId: string): Promise<RiderProfileDto> {
    const cacheKey = RedisKeys.cacheRiderProfile(riderId);
    let cached = await redis.get(cacheKey);
    if (!cached) {
      const rider = await riderRepository.findById(riderId);
      if (!rider) throw new NotFoundError('Rider not found');
      const dto: Omit<RiderProfileDto, 'isOnline' | 'kycStatus'> & {
        isOnline: false;
        kycStatus: RiderProfileDto['kycStatus'];
      } = {
        id: rider.id,
        phone: rider.phone,
        name: rider.name,
        email: rider.email,
        profileImage: rider.profileImage,
        gender: rider.gender ? ProfileGenderToWire[rider.gender] : null,
        dateOfBirth: rider.dateOfBirth ? rider.dateOfBirth.toISOString().slice(0, 10) : null,
        isOnline: false,
        rating: rider.rating.toNumber(),
        totalDeliveries: rider.totalDeliveries,
        vehicleType: rider.vehicle?.vehicleType ? VehiclePowerToWire[rider.vehicle.vehicleType] : null,
        bikeType: rider.vehicle?.bikeType ? BikeTypeToWire[rider.vehicle.bikeType] : null,
        kycStatus: KycStatusToWire(rider.kycStatus),
        joiningDate: rider.createdAt.toISOString(),
      };
      cached = JSON.stringify(dto);
      await redis.set(cacheKey, cached, 'EX', PROFILE_CACHE_TTL);
    }

    const baseProjection = JSON.parse(cached) as RiderProfileDto;
    // Merge the live online status — never let the 60s cache hide isOnline updates.
    const status = await readStatus(riderId);
    return { ...baseProjection, isOnline: status.isOnline };
  },

  async updateProfile(riderId: string, input: UpdateProfileInput): Promise<RiderProfileDto> {
    const patch: UpdateProfilePatch = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.email !== undefined) patch.email = input.email;
    if (input.profileImage !== undefined) patch.profileImage = input.profileImage;
    if (input.gender !== undefined) {
      patch.gender = input.gender.toUpperCase() as Gender;
    }
    if (input.dateOfBirth !== undefined) {
      patch.dateOfBirth = new Date(input.dateOfBirth);
    }
    await riderRepository.patchProfile(riderId, patch);
    await redis.del(RedisKeys.cacheRiderProfile(riderId));
    return this.getProfile(riderId);
  },

  async getStatus(riderId: string): Promise<RiderStatusDto> {
    return readStatus(riderId);
  },

  async updateStatus(riderId: string, input: UpdateStatusInput): Promise<RiderStatusDto> {
    const next = await writeStatus(riderId, input.isOnline);
    // Spec §6 — emit rider:going-online | rider:going-offline to admin namespace
    // via Socket.IO Redis adapter. The publish is a no-op until the socket-gateway
    // subscribes; this preserves wire compatibility today and avoids a dangling
    // dependency on the next slice.
    try {
      await redis.publish(
        'cravix:events:rider:status',
        JSON.stringify({ riderId, isOnline: input.isOnline, at: Date.now() }),
      );
    } catch (e) {
      logger.warn('rider:status publish failed', { err: (e as Error).message, riderId });
    }
    return next;
  },

  async getVehicle(riderId: string): Promise<VehicleDto> {
    const v = await riderRepository.findVehicle(riderId);
    return projectVehicle(v);
  },

  async updateVehicle(riderId: string, input: UpdateVehicleInput): Promise<VehicleDto> {
    const patch: UpdateVehiclePatch = {};
    if (input.vehicleType !== undefined) {
      patch.vehicleType = input.vehicleType === null ? null : (input.vehicleType.toUpperCase() as VehiclePower);
    }
    if (input.bikeType !== undefined) {
      patch.bikeType = input.bikeType.toUpperCase() as BikeType;
      // Bicycles cannot have a vehicleType — Zod refinement enforces this on
      // input, but if the patch only changes bikeType to 'bicycle' we must
      // also null the existing vehicleType to keep the DB CHECK constraint happy.
      if (patch.bikeType === 'BICYCLE' && patch.vehicleType === undefined) {
        patch.vehicleType = null;
      }
    }
    if (input.make !== undefined) patch.make = input.make;
    if (input.model !== undefined) patch.model = input.model;
    if (input.year !== undefined) patch.year = input.year;
    if (input.registrationNumber !== undefined) patch.registrationNumber = input.registrationNumber;
    if (input.rcImage !== undefined) patch.rcImage = input.rcImage;
    if (input.bikePhoto !== undefined) patch.bikePhoto = input.bikePhoto;
    if (input.insuranceNumber !== undefined) patch.insuranceNumber = input.insuranceNumber;
    if (input.insurancePolicy !== undefined) patch.insurancePolicy = input.insurancePolicy;
    if (input.insuranceExpiry !== undefined) patch.insuranceExpiry = new Date(input.insuranceExpiry);

    const updated = await riderRepository.upsertVehicle(riderId, patch);
    // Vehicle changes can affect the cached profile (vehicleType + bikeType mirror).
    await redis.del(RedisKeys.cacheRiderProfile(riderId));
    return projectVehicle(updated);
  },
};
