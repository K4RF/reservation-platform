# AGENTS.md

## Project Overview

`Reservation Platform` is a personal backend portfolio project focused on
preventing reservation conflicts under concurrent traffic.

The repository is in Phase 1 of the backend implementation. Features listed in
`README.md` include roadmap items and must not be treated as already implemented.

## Source of Truth

- Treat the source code, build files, and runtime configuration as the source of
  truth for the current implementation.
- Use `README.md` for project direction and roadmap context, but verify every
  implementation claim against the repository.
- Clearly distinguish confirmed behavior, planned work, and recommendations in
  reports and documentation.
- Do not infer requirements or implemented modules from empty directories,
  placeholder files, or roadmap text.

## Repository Structure

```text
reservation-platform/
├── backend/       # Spring Boot application and Gradle project root
├── frontend/      # Placeholder; frontend stack is not selected
├── infra/         # Placeholder directories for Docker and monitoring
├── load-test/     # Placeholder directory for k6 tests
├── docs/          # Architecture, ADR, API, ERD, and performance documents
├── .github/       # Issue and pull request templates
├── docker-compose.yml
└── README.md
```

The Gradle project root is `backend/`, not the repository root.

## Current Backend Stack

- Java 21 toolchain
- Spring Boot 4.0.7
- Gradle Wrapper 9.5.1
- Spring MVC
- Bean Validation
- Spring Data JPA
- Spring Security 7 with a stateless filter chain
- Spring Security OAuth2 JOSE for HS256 JWT creation and validation
- Spring Security OAuth2 Client with Google as the initial provider
- Spring Data Redis for Refresh Token storage and TTL management
- Springdoc OpenAPI 3.0.3 with Swagger UI and JWT Bearer authentication scheme
- MySQL Connector/J
- Lombok
- JUnit Platform and H2 for fast tests
- Testcontainers 2.0.5 with MySQL 8.4 for database constraint integration tests

Additional OAuth2 providers, Access Token blacklisting, Kafka, Prometheus,
Grafana, k6, CD, and a frontend framework are planned but are not currently
configured unless the repository is updated to include them.

## Build and Test Commands

Always use the checked-in Gradle Wrapper.

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat test
.\gradlew.bat build
.\gradlew.bat bootRun
```

macOS/Linux:

```bash
cd backend
./gradlew test
./gradlew build
./gradlew bootRun
```

Run the narrowest relevant tests while developing. Run the full `test` task
before handing off backend changes, and run `build` for backend-wide or build
configuration changes.

The full test and build tasks require a Docker-compatible container runtime for
the MySQL Testcontainers suite. Tests must not use or mutate the local Docker
Compose database or its volumes.

`docker-compose.yml` defines MySQL 8.4 and Redis 7.4 for local development.
Do not report application integration as available until the corresponding
Backend configuration and behavior are implemented and verified.

## Working Rules

- Read `README.md`, `backend/build.gradle`, and the relevant source and test files
  before making changes.
- Keep each change scoped to the requested issue or task.
- Preserve unrelated user changes in the working tree.
- Do not implement roadmap features unless the current task requires them.
- Add or update tests whenever behavior changes.
- Update documentation when commands, configuration, architecture, dependencies,
  or supported behavior change.
- Record significant architectural decisions under `docs/adr/` when requested or
  when the task explicitly includes documenting the decision.
- Prefer small, reviewable changes and avoid unrelated refactoring.
- Review the final diff before committing or handing off work.

## Generated Files and Repository Hygiene

- Do not edit or commit generated files under `backend/build/`,
  `backend/.gradle/`, or `backend/bin/`.
- Do not add IDE-specific files, operating-system metadata, logs, or temporary
  files.
- Do not create placeholder package structures unless the task requires them;
  empty directories are not preserved by Git.
- Use the existing naming and package conventions in nearby code. Do not invent a
  new architecture based only on the target structure described in `README.md`.

## Configuration and Secrets

- `backend/src/main/resources/application.yaml` configures the MySQL datasource
  from environment variables and can optionally load the repository `.env` file.
- JWT signing requires a Base64-encoded secret of at least 32 bytes through
  `JWT_SECRET`; never add a real signing secret to tracked configuration.
- Google OAuth2 login requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`;
  keep both values in the ignored `.env` file or environment variables.
- Never commit passwords, tokens, private keys, production connection strings, or
  other credentials.
- Use environment variables or explicitly ignored local configuration for secret
  values.
- Document newly required environment variables and local setup steps without
  including real secret values.

## Verification and Handoff

Before completing a change:

1. Review `git diff` and confirm that only intended files changed.
2. Run the tests relevant to the modified behavior.
3. Run the full backend test or build task when the change scope warrants it.
4. Confirm that no generated files, IDE files, or secrets were added.
5. Report what changed, what was verified, and anything that could not be
   verified.

## Current Limitations

- Member sign-up, email/password login, Google OAuth2 login, MySQL persistence,
  stateless Spring Security, and JWT Access Token issuance and authentication
  are implemented.
- Google accounts are linked to existing members by verified email; otherwise a
  new member and provider-specific social account are created.
- Accommodation creation, information updates, and `ACTIVE/INACTIVE` status
  changes are restricted to `ADMIN`; newly created accommodations are `ACTIVE`.
  Authenticated users can read details and paginated lists, search names
  case-insensitively, and sort only by the allowed `ID` or `NAME` fields.
- Room creation, information updates, and `ACTIVE/INACTIVE` status changes are
  restricted to `ADMIN`; new rooms are `ACTIVE` and creation requires a positive
  nightly price. Authenticated users can read room details and filter
  accommodation-scoped paginated lists by minimum capacity, nightly-price
  range, and status. Allowed sort fields are `ID`, `NAME`, `CAPACITY`, and
  `NIGHTLY_PRICE`.
- Authenticated members can create `CONFIRMED` room reservations and query only
  their own reservation details and paginated lists. Lists support optional
  status and inclusive check-in/check-out `From/To` filters. Allowed sort fields
  are `ID`, `CHECK_IN_DATE`, `CHECK_OUT_DATE`, and `TOTAL_AMOUNT`; the default is
  ID ascending. Reservation periods use `[check-in, check-out)` semantics and
  member identity comes from the JWT principal, not the request body.
- Reservation creation snapshots the room's nightly price and calculates the
  total amount by multiplying it by the `[check-in, check-out)` stay length.
  Later room-price changes do not alter an existing reservation's amount.
- Room capacity and reservation guest count both represent total guests without
  adult/child separation. Reservation creation requires at least one guest and
  rejects counts above room capacity. The accepted count is stored on the
  reservation; schedule changes keep it immutable and revalidate it against the
  room's current capacity.
- Reservation owners can change the dates of a `CONFIRMED` reservation. The
  update excludes the reservation itself from overlap checks and recalculates
  the total using the stored nightly-price snapshot, not the room's current
  price. `CANCELLED` reservations cannot be changed.
- Reservation owners can cancel a `CONFIRMED` reservation by changing its state
  to `CANCELLED`; physical deletion, cancellation deadlines, and refund policies
  are not implemented.
- `Reservation` owns schedule-change and cancellation state rules. Invalid
  operations on `CANCELLED` reservations raise a domain state-transition
  exception that the API maps to the existing reservation error responses.
- Reservation creation and schedule changes currently use normal
  read-before-write overlap queries inside one transaction and do not prevent
  races between concurrent requests.
- Authenticated users can query ID-ordered paginated available rooms for an
  accommodation by check-in, check-out, and guest count. The query includes only
  rooms whose room and accommodation are both `ACTIVE`, have sufficient
  capacity, and have no overlapping `CONFIRMED` reservation using
  `[check-in, check-out)` semantics. New reservations for inactive rooms or
  accommodations are rejected, while existing reservation history is retained.
- Search and filters use Spring Data JPA Specifications. Arbitrary sort fields,
  room inventory, and concurrency control are not implemented.
- Entity mappings define NOT NULL, length, enum string storage, named UNIQUE/FK,
  and CHECK constraints for required text, positive capacity, non-negative
  monetary values, and valid reservation periods. The existing reservation
  room/status/period and member indexes match the current overlap and owner
  query patterns; speculative indexes were not added.
- Hibernate `ddl-auto=update` does not backfill CHECK constraints into an
  existing database. Existing local volumes require the reviewed one-time SQL
  under `docs/erd/mysql-schema-hardening.sql`. A formal migration tool and
  `ddl-auto=validate` production policy are not implemented yet.
- Email/password and Google OAuth2 login issue Access and Refresh Tokens. Refresh
  Tokens are stored as `refresh:{memberId}` in Redis with matching TTL and are
  validated for Access Token reissue.
- Logout deletes the member's Refresh Token. Access Token blacklisting is not
  implemented, so an existing Access Token remains valid until expiration.
- Redis distributed locks, Redis caching, concurrency control, and Kafka
  integration are not implemented.
- Docker Compose defines MySQL and Redis services.
- A Backend GitHub Actions workflow runs tests and builds for `develop`.
- Swagger UI (`/swagger-ui.html`) and OpenAPI JSON (`/v3/api-docs`) are publicly
  accessible for development and API verification. Protected controller
  operations declare the `bearerAuth` JWT security requirement. Documented API
  errors use the common `ErrorResponse` schema with `application/json` content.
- API errors consistently use 400 for validation/request input, 401 for
  authentication, 403 for role/ownership denial, 404 for missing resources, 409
  for duplicate/state conflicts, and 500 for unexpected failures. Bean,
  binding, method-parameter, and constraint validation share `COMMON_001` and
  field details; malformed or unbindable requests use `COMMON_002`.
- The frontend is a placeholder with no selected technology stack.
- Test fixtures for members, accommodations, rooms, reservations, and JWT
  Bearer headers live under `backend/src/test/java/junsik/reservation/support`.
  Regular integration tests use isolated H2 transactions, while database
  constraint tests use an ephemeral MySQL 8.4 Testcontainer. The shared MySQL
  support is the extension point for Phase 2 concurrency tests.
- Automated tests cover the application context, global exception handling,
  member sign-up, login failure normalization, Google OAuth2 member mapping,
  JWT issuance, authenticated access, and accommodation registration and query
  behavior, room registration and query behavior, and reservation creation,
  period overlap, schedule changes, amount recalculation, owner-scoped queries,
  pagination, status/period filtering, allowed sorting, cancellation, database
  constraint violations, validation error details, HTTP error policy, and
  generated OpenAPI/Swagger UI error responses using H2. A
  dedicated MVP integration test connects sign-up, login, admin accommodation
  and room creation, user queries, reservation creation and schedule change,
  owner queries, and cancellation in one transaction.
