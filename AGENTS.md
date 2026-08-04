# AGENTS.md

## Project Overview

`Reservation Platform` is a personal backend portfolio project focused on
preventing reservation conflicts under concurrent traffic.

The repository is currently in the initial Spring Boot setup phase. Features
listed in `README.md` include roadmap items and must not be treated as already
implemented.

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
- Lombok
- JUnit Platform

Spring Data JPA, Spring Security, JWT, OAuth2, MySQL, Redis, Kafka,
Prometheus, Grafana, k6, CI/CD, and a frontend framework are planned but are
not currently configured unless the repository is updated to include them.

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

`docker-compose.yml` currently defines no services. Do not report local
infrastructure as available until services are actually configured and verified.

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

- `backend/src/main/resources/application.yaml` currently contains only the
  application name.
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

- No domain APIs, persistence components, authentication, concurrency control,
  Redis, or Kafka integration are implemented.
- Docker Compose defines no services.
- No GitHub Actions workflow is present.
- The frontend is a placeholder with no selected technology stack.
- The only automated test currently verifies that the Spring application context
  loads.
