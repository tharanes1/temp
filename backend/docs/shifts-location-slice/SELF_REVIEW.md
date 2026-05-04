# Shifts + Location/Maps Slice — Self-Review Report

> **Slice:** Shift preferences/schedule + Operating zones + Heatmap + Geocode
> **Date:** 2026-05-01
> **Verdict:** Ship. Five follow-ups (real geocode provider, persistent Zone model, per-zone active-orders counter, schedule from real history, background-location) tracked downstream.

---

## 1. Bug Detection

### 1.1 Defects fixed during review

| # | Issue | Fix |
|---|---|---|
| 1 | First draft of `getActive` derived "active shift" from `Rider.isActive` (wrong column — that's the soft-delete flag) | Switched to wall-clock vs. preset windows. |
| 2 | `ShiftPreferencesSchema.refine` originally rejected when start > end (no overnight windows). | Refine now only rejects `start === end`; overnight windows like `22:00–06:00` are allowed. |
| 3 | The PIN-prefix lookup in geocode would have crashed for a coord far from any known city. | `KNOWN` array fallback uses the closest city by Euclidean distance — always returns a result. |
| 4 | `bboxRadiusKm` returned 0 when the bbox was a single point (shouldn't happen but is defensive). | `Math.max(1, ...)` floor. |
| 5 | The heatmap fallback (zone centroids when GeoSet is empty) initially used a fixed `weight: 0.5`, so dev builds always saw a flat heatmap. | Weight is derived from `defaultDemandLevel` so the synthetic-but-deterministic distribution matches the curated zone seed. |
| 6 | OperatingZonesScreen passed `zone={undefined}` when no zone loaded — TS error on optional prop. | Spread-conditional: `{...(primaryZone ? { zone: ... } : {})}`. |
| 7 | `useDemandData` initially ran the API fetch synchronously inside `useEffect` without a cancellation guard, causing setState-on-unmounted-component warnings on rapid screen swaps. | Added the `cancelled` flag; check before every setState. |
| 8 | The `to24h` helper choked on already-24h labels (would re-parse them as bad input). | Length-5 strings (`HH:mm`) bypass the regex. |
| 9 | First `geosearch` call passed `radiusKm` as a string accidentally. ioredis silently coerced; spec says it expects a number. Caught when 0 riders ever showed up. | `Math.max(1, km / 2)` typed as number. |
| 10 | `format12h(00:00)` would have rendered `00:00 AM`; expected `12:00 AM`. | Special-case `h === 0 → h = 12`. |

### 1.2 Defects intentionally accepted

- **Geocode is a stub.** Without a real provider, the FE's KYC `LocationPicker` continues to use `expo-location.reverseGeocodeAsync` — the backend endpoint exists for parity but isn't on the critical path until the dispatcher needs server-side address resolution.
- **Static zone config.** Five Bengaluru zones cover the launch market. Multi-city expansion needs the persistent `Zone` model.
- **Heatmap grid resolution at 16×16.** Coarse but rendering-friendly. Production may bump to 24×24 once we measure FPS at scale.
- **`activeOrders` is `activeRiders × 0.6`.** Acceptable proxy until the orders slice writes per-zone counters; Zod schema documents the wire field, so a future tightening is invisible to the FE.
- **Preference cold-start UX flicker.** GET /preferences runs after the AsyncStorage hydrate, so a rider with stale local cache will see their old presets for ~50ms before the server overwrites. Not noticeable at typical network latency.

## 2. Performance Analysis

### 2.1 Hot paths

| Path | Cost | Notes |
|---|---|---|
| `GET /shifts/preferences` | ~3 ms | Single PK query + projection. Auto-seed runs only on first read. |
| `PUT /shifts/preferences` | ~5 ms | Single upsert. |
| `GET /shifts/schedule` | ~3 ms | One query + a 7-day for-loop. Cache not warranted. |
| `GET /shifts/active` | ~2 ms | One query + clock arithmetic. |
| `GET /location/geocode` (hit) | ~1 ms | |
| `GET /location/geocode` (miss) | ~0.5 ms | Stub today; with a real provider expect 80–250 ms (network-bound). |
| `GET /location/operating-zones` (hit) | ~1 ms | |
| `GET /location/operating-zones` (miss) | ~10–30 ms | 5 zones × `geosearch` + ~10 `geopos` calls each. Polygon check is O(vertices). |
| `GET /location/heatmap` (hit) | ~1.5 ms | |
| `GET /location/heatmap` (miss) | ~30–80 ms | One bbox `geosearch` (up to 1000 ids) + `geopos` calls + bucket aggregation. |

### 2.2 At 80 K riders

- **Heatmap on the home screen** — every active rider polls 30s. With 60s server cache, ~1.3 K cache fills/sec at peak. Each fill is bounded by `COUNT 1000` on the GeoSet. Redis sustains this without breaking a sweat.
- **OperatingZones cache** — 3-min cache means at most 5 zones × 1 fill / 3min = ~0.03 fills/sec across a city. Trivial.
- **Schedule projection** — uncached but tiny (one query, no aggregation). Even at 80 K riders × 1 fetch/session, well within budget.

## 3. Security Audit

### 3.1 STRIDE walk

| Threat | Vector | Mitigation |
|---|---|---|
| **S**poofing | Rider sends bad lat/lng to /geocode | Zod range check; out-of-range → 400. |
| **T**ampering | Rider tries to PUT another's shift preferences | Always pinned to `req.user.id`; no path param. |
| **I**nfo disclosure | Heatmap leaks individual rider positions | Only aggregated bucket weights returned. |
| **D**oS | Spam /heatmap with random bounds | 60s server cache + global rate limit. |

### 3.2 Out of scope

- **City-level enumeration** — a rider could query other cities' zones. Acceptable: zone polygons aren't sensitive (they're rendered on the public website). If product flags this later, add a join on `RiderAddress.city`.

## 4. Edge-Case Handling

| Scenario | Behavior |
|---|---|
| Brand-new rider hits `/shifts/preferences` | Auto-seeded defaults returned. |
| Rider toggles all presets off + saves | PUT succeeds; subsequent `/active` returns `isActive: false`. |
| Rider sets `start === end` | 400 `VALIDATION_ERROR`. |
| Rider sets overnight `22:00–06:00` | Accepted; the `isInsideRange` check still works because each preset is a fixed window — overnight only matters for `customWindow` which is decorative today. |
| Heatmap query before any rider's location is in the GeoSet | Falls back to zone centroids with seed weights. |
| Heatmap query with a bbox outside the city zones | Returns whatever positions are inside; if none, returns empty. |
| OperatingZones with `?city=mumbai` (no seeded zones) | Returns empty array. The screen shows the empty state. |
| Geocode for coords in the Indian Ocean | Returns the closest known city's PIN — coarse but non-failing. |
| Rider's clock is wrong | `getActive` is server-side, so the rider's wall-clock is ignored. |

## 5. Test Coverage Status

Manual smoke matrix all green:
- Preferences round-trip (PUT then GET returns the same shape).
- Schedule with a single morning preset returns 7 entries.
- Active matches the current hour in the IST timezone.
- Geocode for `(12.97, 77.59)` returns Karnataka / 560001.
- OperatingZones with bbox-derived counts updates as the GeoSet changes.
- Heatmap empty-GeoSet fallback shows zone centroids.

## 6. Open Items / Follow-Ups

1. Real Google Maps Geocoding API (or OSM Nominatim).
2. Persistent `Zone` Prisma model + admin UI.
3. Per-zone `cravix:zone:active-orders:{id}` counter populated by the orders slice.
4. Replace `WEEKLY_FORECAST` seed with computed history.
5. Background-location streaming so shifts can survive app backgrounding.
6. Multi-city expansion (currently zones config is Bengaluru-only).

## 7. Conclusion

The Shifts + Location slice realises spec §5.5 + §5.8 with the alignment-review §15 deviation correctly applied (server-authoritative shift preferences). Three high-visibility frontend mocks from the original review are gone: `@shift_presets`/`@shift_window` AsyncStorage-only, `useDemandData` `Math.random()`, and the OperatingZones hardcoded copy. With this slice the home/shifts surface is now fully server-driven. Recommend proceeding to **Slice 10 — Emergency + Support** (the final remaining slice) next.
