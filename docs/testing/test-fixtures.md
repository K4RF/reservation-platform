# Backend Test Fixture and Database Strategy

## Purpose

Backend tests share deterministic domain fixtures without hiding persistence or
transaction boundaries. This keeps individual tests readable while preserving
the behavior assertions introduced for the MVP.

## Fixture structure

The reusable support code lives under
`backend/src/test/java/junsik/reservation/support`.

| Support | Responsibility |
| --- | --- |
| `MemberFixture` | Creates default or email/password-specific user members |
| `AccommodationFixture` | Creates default, named, indexed, or fully specified accommodations |
| `RoomFixture` | Creates default, indexed, capacity-specific, or priced rooms |
| `RoomDailyPriceFixture` | Creates a daily room price with a default or explicit room, date, and amount |
| `ReservationFixture` | Creates reservations with a default or explicit period |
| `AuthenticationTestSupport` | Creates Bearer headers from raw or generated JWTs |
| `RoomInventoryFixture` | Creates daily room inventory with default or explicit date and quantity |
| `MvpTestFixture` | Creates the SQL-backed admin and date inventory required by the end-to-end MVP flow |
| `MySqlIntegrationTestSupport` | Provides one MySQL 8.4 Testcontainer and Spring datasource connection details |

Fixture methods create entities only. A test that needs persisted data must call
the relevant repository explicitly. This makes flush timing and the database
boundary visible, which is important for constraint and future concurrency
tests.

## Test isolation

- The regular test configuration uses an isolated in-memory H2 database in
  MySQL compatibility mode and `create-drop` schema management.
- Persistence-based Spring integration tests use `@Transactional`, so each test
  method rolls its data back.
- Redis-dependent authentication tests replace `RefreshTokenStore` with a mock;
  the Redis server used for local development is not touched.
- Fixed fixture values are safe because persisted data does not cross test
  method boundaries.

## MySQL Testcontainers decision

Fast API and service integration tests remain on H2. Database constraint tests
run against an ephemeral MySQL 8.4 Testcontainer because CHECK constraints and
Spring JDBC exception translation differ from H2. Spring Boot's
`@ServiceConnection` supplies the generated JDBC connection details, so the
developer's Docker Compose database, `.env`, and volumes are never used.

The MySQL test uses `ddl-auto=create`. The container is disposable, so a delayed
schema drop is unnecessary and would race with container shutdown.

GitHub-hosted Ubuntu runners provide Docker, so the existing `./gradlew test`
CI step also runs the MySQL-backed constraint suite. A local full test therefore
requires a Docker-compatible container runtime.

## Commands

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat test --tests junsik.reservation.entity.DatabaseConstraintIntegrationTest
.\gradlew.bat test
.\gradlew.bat build
```

macOS/Linux:

```bash
cd backend
./gradlew test --tests junsik.reservation.entity.DatabaseConstraintIntegrationTest
./gradlew test
./gradlew build
```

## Concurrency test extension

Future MySQL locking and same-room concurrency tests should extend
`MySqlIntegrationTestSupport`. They should create independent members, rooms,
and reservation periods through the domain fixtures, commit setup data before
starting worker threads, and clean up through the disposable container rather
than the developer database. Thread coordination and executor lifecycle belong
in a concurrency-specific support class when Phase 2 begins.
