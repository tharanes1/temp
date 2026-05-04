# Cravix Rider — Backend

Distributed Express 5.x + Socket.IO + BullMQ stack serving the Cravix Rider mobile app at 80K concurrent riders. See `BACKEND_REQUIREMENTS.md` (in the parent folder) for the architectural baseline and `BACKEND_ALIGNMENT_REVIEW.md` §0 for the locked deviations from spec.

## Layout

```
backend/
├── packages/                 # shared workspace libraries
│   ├── shared-config/        # zod-validated env loader
│   ├── shared-types/         # API contracts shared with the frontend
│   ├── shared-errors/        # AppError hierarchy
│   ├── shared-logger/        # Winston structured logger
│   └── shared-redis/         # ioredis singleton + Socket.IO adapter helper
├── services/
│   ├── api-gateway/          # public REST on port 3000
│   ├── socket-gateway/       # Socket.IO on port 5000 (added in slice 4)
│   └── workers/              # BullMQ workers (added in slice 4)
├── prisma/
│   └── schema.prisma         # spec §9 + locked decisions
├── infra/
│   ├── docker/               # Dockerfiles
│   ├── nginx/                # nginx.conf with ip_hash + WS upgrade
│   └── pgbouncer/
├── docs/                     # ADRs + per-slice IMPLEMENTATION/SELF_REVIEW
└── docker-compose.yml        # local dev: nginx, postgres, pgbouncer, redis
```

## Locked decisions (vs spec)

| | Decision |
|---|---|
| OTP length | 4 digits |
| Access token | 3 minutes |
| Refresh token | 2 days, single device, one-time-use rotation, reuse-detection |
| KYC documents | aadhaarFront, aadhaarBack, panCard, drivingLicense, selfie |
| Categories | two-axis: `{freelancer, fulltime}` × `{student, professional, disabled}` |
| Vehicle | `vehicleType ∈ {petrol, ev}` AND `bikeType ∈ {bike, bicycle, scooter, ev}` |
| Currency | API returns rupees as decimals (`4250.34`); DB stores `Decimal(12,2)` |

## Run

```bash
# 1. Bring up Postgres, PgBouncer, Redis, Nginx
pnpm docker:up

# 2. Generate Prisma client + apply migrations
pnpm prisma:generate
pnpm prisma:migrate

# 3. Start the API gateway (hot reload)
pnpm dev
# → http://localhost:3000/health
```
