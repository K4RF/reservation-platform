# Read Query and Cache Architecture

## Purpose

This document closes the v0.3.0 Query and Cache optimization phase. It records
the final production read paths, Database indexes, Pagination choices, Redis
Cache boundary, consistency rules, and regression evidence. Performance probes
remain under `docs/performance`; they are evidence, not an alternative runtime
path.

## Source of Truth

MySQL is the source of truth for accommodation, room, inventory, price, policy,
and reservation data. Redis stores only reconstructable detail response
snapshots. A Redis miss, timeout, or connection failure must not change the
business result returned from MySQL.

```text
List / Search / Availability / Price / Policy
    -> Service read-only transaction
    -> JPA Repository or Specification
    -> MySQL

Accommodation / Room detail
    -> Redis detail response cache
       -> hit: return immutable response snapshot
       -> miss: query MySQL and cache the response
       -> cache-only failure: query MySQL and return the result
```

Reservation creation's Room-scoped Redisson lock is a concurrency-control
boundary and is not part of this read cache.

## Final Query Paths

| Read operation | Final implementation | Cache |
| --- | --- | --- |
| Accommodation detail | `AccommodationRepository.findById` | `accommodation-detail` |
| Accommodation search | `AccommodationSpecifications.withFilters` and `findAll` | None |
| Room detail | `RoomRepository.findById` | `room-detail` |
| Accommodation room list | `RoomSpecifications.withFilters` and `findAll` | None |
| Available rooms | `RoomRepository.findAvailableRooms` | None |
| Effective daily price | Daily-price lookup, then room base-price fallback | None |
| Booking/cancellation policy | Policy repository lookup | None |
| Reservation list | `ReservationSpecifications` Offset page or ID Cursor query | None |

The unused derived `RoomRepository.findAllByAccommodationId` query was removed.
The filtered Specification is the only production room-list path. The temporary
baseline indexes created by `SearchQueryExecutionPlanIntegrationTest` exist only
inside its disposable MySQL Testcontainer and are retained to reproduce the
before/after plan comparison.

Accommodation and room amenities stay LAZY. Hibernate collection batch loading
with `@BatchSize(100)` removes result-count-proportional collection queries
without widening every root query through a collection fetch join. Availability
continues to use `[check-in, check-out)` inventory rows and booking-policy
conditions; daily-price overrides do not alter the base-price search filter.

## Final Index Set

| Index | Purpose |
| --- | --- |
| `idx_accommodations_city_region_status_id` | City/region/status filtering and stable ID order |
| `idx_accommodations_region` | Region-only accommodation filtering |
| `idx_rooms_accommodation_status_id` | Accommodation-scoped active-room filtering and ID order |
| `uk_room_inventories_room_date` | Room/date uniqueness and inventory range lookup |
| `uk_room_daily_prices_room_date` | Room/date uniqueness and effective-price lookup |
| `idx_reservations_member_id` | Owner-scoped ID Offset and Cursor pagination |

The composite indexes replace their older left-prefix-only equivalents. UNIQUE
indexes already support booking/cancellation policy, amenity, daily-price,
inventory, reservation-night, social-account, email, and reservation-number
lookups, so duplicate secondary indexes are not added. `%keyword%` accommodation
name search does not receive a speculative B-tree index.

Existing development volumes use the reviewed one-time scripts under
`docs/erd/`. The application still uses `ddl-auto=update`; formal versioned
migrations and production `validate` remain separate work.

## Pagination Decision

- General accommodation, room, and filtered reservation screens keep Offset
  pages because they expose total counts and arbitrary page navigation.
- Sequential owner reservation history also exposes an ID Cursor endpoint.
- Cursor order is `id DESC`; the composite `(member_id, id)` index bounds work by
  page size and avoids a Count query.
- Arbitrary sort fields are rejected through the existing enums rather than
  being interpolated into Query text.

## Cache Contract

### Included

- Accommodation detail response by accommodation ID
- Room detail response by room ID

These reads are frequent, stable enough for a bounded TTL, and reconstructable
from MySQL.

### Excluded

- Search and paginated lists
- Availability and inventory calendar
- Effective price and policy reads
- Reservation reads and every command

Their key cardinality or update sensitivity is higher, and correctness depends
on current Database state. They therefore read MySQL on every request.

### Key and TTL

```text
reservation:cache:accommodation-detail::{accommodationId}
reservation:cache:room-detail::{roomId}
```

Both caches use `RESERVATION_DETAIL_CACHE_TTL`, default `10m`. Null results are
not cached. Unknown cache names cannot be created at runtime. A locking Redis
Cache Writer coalesces concurrent misses for the same key; its retry interval
and lock TTL are configured separately from value TTL.

### Invalidation and Failure

- Accommodation information/status changes evict only its detail key.
- Room information/status changes evict only its detail key.
- Transaction-aware eviction is published after commit. Rollback retains the
  prior cache entry because the Database value also remains unchanged.
- Inventory, price, and policy commands do not evict detail keys because those
  response schemas do not contain those values.
- Cache read/write/evict/clear connection failures and command timeouts are
  handled as cache-only failures. The original MySQL query remains authoritative.
- Redis recovery permits the next miss to repopulate the cache. Redis failure is
  not silently ignored for the separate reservation distributed lock, where
  failure must stop reservation creation.

## Regression Evidence

| Concern | Evidence |
| --- | --- |
| Combined search, room filters, availability, price, policy and admin changes with real MySQL/Redis | `QueryCacheArchitectureIntegrationTest` |
| Search combinations | `AccommodationIntegratedSearchIntegrationTest` |
| Room list and details | `RoomIntegrationTest` |
| Availability and booking policy | `AvailableRoomIntegrationTest`, `BookingPolicyReservationIntegrationTest` |
| Daily/default effective price | `RoomDailyPriceIntegrationTest` |
| Cache hit, miss, TTL and same-key miss coalescing | `RedisDetailCacheIntegrationTest` |
| Commit/rollback invalidation | `RedisCacheInvalidationIntegrationTest` |
| Redis connection/timeout fallback and recovery | `RedisCacheFallbackIntegrationTest` |
| MySQL index selection | `SearchQueryExecutionPlanIntegrationTest` |
| Offset/Count/Cursor plans | `PaginationQueryPerformanceIntegrationTest` |
| v0.2.0 concurrency behavior | MySQL concurrency, Retry, and Redisson integration suites |

`QueryCacheArchitectureIntegrationTest` deliberately uses disposable MySQL 8.4
and Redis 7.4 containers together. It verifies that cached detail responses are
evicted after committed admin changes while uncached inventory, policy, price,
search, and availability reads immediately observe MySQL changes.

## Phase Boundary and Follow-up Notes

v0.3.0 is complete when the full Backend test and build tasks pass with the
above final paths. No Kafka producer, consumer, outbox, asynchronous event, k6
scenario, Prometheus metric, or Grafana dashboard is introduced by this phase.

Candidate Tech Notes are the Specification subquery trade-off, LAZY collection
batch loading, Offset versus Cursor pagination, and transaction-aware cache
eviction. Troubleshooting material should start from Redis fallback versus
distributed-lock fail-fast behavior, existing-volume index migrations, and
Testcontainers runtime requirements. v0.4.0 can now design event-driven
post-processing without changing this Database/Cache ownership boundary.
