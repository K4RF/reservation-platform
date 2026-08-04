# AGENTS.md

## Project Overview

This repository contains `Reservation Platform`, a personal backend portfolio project.

The project focuses on solving reservation conflicts under concurrent traffic and demonstrating:

- Spring Boot REST API development
- MySQL and JPA data modeling
- transaction management
- concurrency control
- Redis distributed locking and caching
- Kafka-based event processing
- Docker and GitHub Actions
- monitoring with Prometheus and Grafana
- load testing with k6

## Repository Structure

```text
reservation-platform/
├── backend/       # Spring Boot backend application
├── frontend/      # Frontend application or placeholder
├── infra/         # Docker, monitoring, and deployment configuration
├── load-test/     # k6 load-test scripts and results
├── docs/          # Architecture, API, ADR, performance, troubleshooting
├── .github/       # Issue, PR, and workflow configuration
└── README.md