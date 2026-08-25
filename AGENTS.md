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
- JUnit Platform and H2 for tests

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
- Accommodation creation is restricted to `ADMIN`; authenticated users can read
  details and paginated lists, search names case-insensitively, and sort only by
  the allowed `ID` or `NAME` fields.
- Room creation under an accommodation is restricted to `ADMIN` and requires a
  positive nightly price. Authenticated users can read room details and filter
  accommodation-scoped paginated lists by minimum capacity, nightly-price range,
  and status. Allowed sort fields are `ID`, `NAME`, `CAPACITY`, and
  `NIGHTLY_PRICE`.
- Authenticated members can create `CONFIRMED` room reservations and query only
  their own reservation details and ID-ordered paginated lists. Reservation
  periods use `[check-in, check-out)` semantics and member identity comes from
  the JWT principal, not the request body.
- Reservation creation snapshots the room's nightly price and calculates the
  total amount by multiplying it by the `[check-in, check-out)` stay length.
  Later room-price changes do not alter an existing reservation's amount.
- Reservation owners can cancel a `CONFIRMED` reservation by changing its state
  to `CANCELLED`; physical deletion, cancellation deadlines, and refund policies
  are not implemented.
- Reservation overlap prevention currently uses a normal read-before-write query
  inside one transaction and does not prevent races between concurrent requests.
- Authenticated users can query ID-ordered paginated available rooms for an
  accommodation by check-in, check-out, and guest count. The query includes only
  `ACTIVE` rooms with sufficient capacity and excludes rooms with overlapping
  `CONFIRMED` reservations using `[check-in, check-out)` semantics.
- Room status has `ACTIVE` and `INACTIVE` values and newly created rooms default
  to `ACTIVE`. Status management APIs and inactive-room reservation blocking are
  deferred to the accommodation and room management work.
- Search and filters use Spring Data JPA Specifications. Arbitrary sort fields,
  room inventory, reservation filtering, and concurrency control are not
  implemented.
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
  operations declare the `bearerAuth` JWT security requirement.
- The frontend is a placeholder with no selected technology stack.
- Automated tests cover the application context, global exception handling,
  member sign-up, login failure normalization, Google OAuth2 member mapping,
  JWT issuance, authenticated access, and accommodation registration and query
  behavior, room registration and query behavior, and reservation creation,
  period overlap, owner-scoped queries, pagination, cancellation, and generated
  OpenAPI/Swagger UI access using H2. A dedicated MVP integration test connects
  sign-up, login, admin accommodation and room creation, user queries,
  reservation creation, owner queries, and cancellation in one transaction.
