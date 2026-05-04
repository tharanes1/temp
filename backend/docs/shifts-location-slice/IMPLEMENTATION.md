# Shifts + Location/Maps Slice — Implementation Document

> **Slice:** Shift preferences/schedule + Operating zones + Demand heatmap + Reverse geocode
> **Endpoints:** `GET/PUT /api/v1/shifts/preferences` · `GET /api/v1/shifts/schedule` · `GET /api/v1/shifts/active` · `GET /api/v1/location/geocode` · `GET /api/v1/location/operating-zones` · `GET /api/v1/location/heatmap`
> **Date:** 2026-05-01

---

## 1. Feature Overview

Two related modules shipped together because both feed the home/shifts surface of the rider app.

This slice retires:
- **`@shift_presets` / `@shift_window` AsyncStorage-only persistence** — the alignment review §15 explicitly called this out as a deviation from the original spec. The server is now the source of truth; AsyncStorage is an offline cache only.
- **`useDemandData` `Math.random()` heatmap** — review §6.3 #16. Demand points now come from the live rider GeoSet via `/location/heatmap`.
- **OperatingZonesScreen hardcoded "primary zone" copy** — replaced with a server-driven zone projection that picks the zone closest to the rider.

It implements:
- **Server-authoritative shift preferences** in the existing `ShiftPreference` Prisma model (auto-seeded with sensible defaults on first read so no FE 404).
- **Schedule projection** — for each preset the rider has enabled, the next 7 days are projected with day-of-week demand levels and earnings ranges.
- **Active shift** — derived from the wall-clock + the rider's preset windows (independent from the duty toggle managed by the rider slice).
- **Operating zones** — five Bengaluru zones in `zones.config.ts` with live `activeRiders` counts overlaid from the `cravix:rider:locations` GeoSet (point-in-polygon classifier).
- **Demand heatmap** — bucket-aggregates the same GeoSet inside the requested bounds into a 16×16 grid; falls back to zone centroids when no riders are online.
- **Reverse geocode** — Redis-cached 1-hour stub keyed off PIN-code prefixes (real Google Maps / OSM integration is a follow-up; the stub gives the FE a structured response to render KYC's address-confirm step).

## 2. API Specification

### 2.1 Shifts (4 endpoints)

| Method + Path | Cache | Notes |
|---|---|---|
| `GET /shifts/preferences` | none | Auto-seeds `{morning:false, afternoon:false, night:false, start:'08:00', end:'17:00'}` on first read so FE never 404s. |
| `PUT /shifts/preferences` | n/a | Idempotent upsert. Rejects same-time start/end via Zod refine. |
| `GET /shifts/schedule` | none | Walks the next 7 days; for each enabled preset, emits an `UpcomingShiftDto` with the day-of-week demand level + earnings range. Always returns `weeklyForecast`. |
| `GET /shifts/active` | none | Wall-clock vs. preset windows (`morning 06:00–12:00`, `afternoon 12:00–17:00`, `night 17:00–23:00`). |

### 2.2 Location (3 endpoints)

| Method + Path | Cache | Notes |
|---|---|---|
| `GET /location/geocode?lat&lng` | Redis 1h (`cravix:cache:geocode:{lat}:{lng}`) | PIN-prefix-based stub today. |
| `GET /location/operating-zones?city` | Redis 3min (`cravix:cache:zones:{city}`) | Static config + live density overlay. |
| `GET /location/heatmap?city&bounds` | Redis 60s (`cravix:cache:heatmap:{city}:{bounds}`) | GeoSet-aggregated; 16×16 grid; falls back to zone centroids when GeoSet is empty. |

## 3. Frontend Integration

| Change | File | Notes |
|---|---|---|
| Typed services | `src/services/api/features/{shifts,location}.ts` (new + rewritten) | Decimal money where applicable; no paise. |
| ShiftsScreen rewired | `src/features/shifts/screens/ShiftsScreen.tsx` | GET on mount (server overwrites AsyncStorage cache); PUT on save (best-effort with local-cache fallback). New `to24h`/`format12h` helpers convert between the existing `08:00 AM` UI labels and the `HH:mm` wire format. |
| `useDemandData` rewritten | `src/features/home/hooks/useDemandData.ts` | `Math.random()` gone — now hits `/location/heatmap` with a tight bbox derived from the rider's location. 30s poll matches the previous cadence. |
| OperatingZonesScreen rewired | `src/features/home/screens/OperatingZonesScreen.tsx` | Loads `/location/operating-zones`, picks the zone closest to the rider, passes it into ZoneCard. |
| ZoneCard prop-aware | `src/features/home/components/ZoneCard.tsx` | New optional `zone` prop renders real name + demand badge + rider/order counts. Falls back to translated default copy when prop is absent (FE cold-start before fetch resolves). |

## 4. Code Walkthrough

### 4.1 GeoSet density classifier (`location/service.ts`)

```ts
const positions = await redis.geosearch(
  RedisKeys.riderLocations(),
  'FROMLONLAT', z.centerCoords.longitude, z.centerCoords.latitude,
  'BYRADIUS', radiusKm, 'km',
  'COUNT', 500, 'ASC',
);
```

The bounding-circle search overshoots the polygon; we then run a `pointInPolygon` ray-casting check on each returned id. Cheaper than maintaining a separate per-zone counter and stays accurate to the zone shape.

### 4.2 Heatmap bucket grid

The 16×16 grid trades resolution for FE rendering cost — at 80 K riders concentrated in a city's bbox, a finer grid would emit >256 points to the map and tank `react-native-maps`. The bucket weight is normalised against the max bucket so the brightest cell is always `weight: 1.0`.

### 4.3 Shift schedule projection

```ts
for (let i = 0; i < 7; i++) {
  const d = new Date(); d.setDate(d.getDate() + i);
  for (const slot of presets) {
    upcoming.push({
      date: d.toISOString().slice(0, 10),
      shift: slot,
      demandLevel: WEEKLY_FORECAST[dayName(d)],
      estimatedEarnings: ESTIMATE_BY_DEMAND[demand],
    });
  }
}
```

The day-of-week table (`WEEKLY_FORECAST`) is a simple seed; the dispatcher slice will replace it with computed historical aggregates once enough data exists.

### 4.4 Wall-clock active-shift derivation

`isInsideRange(now, SHIFT_RANGES.morning|afternoon|night)` matches the rider's local-time hour against pinned ranges. This is **independent** from the duty toggle (`cravix:rider:status:{id}`) — a rider can have an active "morning" shift configured even if they're currently offline.

## 5. Security Measures

| Measure | Implementation |
|---|---|
| All routes auth-guarded | `shiftsRouter.use(authMiddleware)`, `locationRouter.use(authMiddleware)`. |
| Geocode bbox spoofing | Lat/lng range-checked via Zod (`-90..90`, `-180..180`). |
| Heatmap GeoSet leak | Returns aggregated weights, never individual rider IDs or coords. |
| Strict schemas | `.strict()` everywhere. |
| Redis cache namespacing | Keys include `city` and `bounds` so a Bengaluru cache never shadows Mumbai. |

## 6. Files Created / Modified

**Backend (created):**
```
backend/services/api-gateway/src/modules/shifts/
├── schemas.ts, types.ts, repository.ts, service.ts, controller.ts, routes.ts
backend/services/api-gateway/src/modules/location/
├── schemas.ts, types.ts, service.ts, controller.ts, routes.ts, zones.config.ts
backend/docs/shifts-location-slice/
├── IMPLEMENTATION.md, SELF_REVIEW.md
```

**Backend (modified):**
- `services/api-gateway/src/app.ts` — mounts `/api/v1/shifts` + `/api/v1/location`.

**Frontend (created/modified):**
- `src/services/api/features/{shifts,location}.ts` — new + rewritten typed services.
- `src/features/home/hooks/useDemandData.ts` — Math.random gone; server-driven.
- `src/features/shifts/screens/ShiftsScreen.tsx` — GET/PUT preferences with offline fallback.
- `src/features/home/components/ZoneCard.tsx` — optional `zone` prop for server-driven rendering.
- `src/features/home/screens/OperatingZonesScreen.tsx` — `/location/operating-zones` + closest-zone heuristic.

## 7. Open Items Carried Forward

1. **Real reverse-geocode provider** — integrate Google Maps Geocoding API or OSM Nominatim once API keys are provisioned.
2. **Persistent `Zone` Prisma model** — replace the static config when the dispatcher slice ships.
3. **Per-zone active-orders counter** — `cravix:zone:active-orders:{id}` populated by the orders slice for true demand classification (today we proxy via rider density × 0.6).
4. **Schedule projection improvements** — replace the day-of-week seed table with computed historical aggregates.
5. **Background-location streaming** — required for shift-tracking when the app is backgrounded; deferred to a hardening pass.
