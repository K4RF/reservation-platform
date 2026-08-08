# Reservation Platform
[![Backend CI](https://github.com/<username>/<repository>/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/<username>/<repository>/actions/workflows/backend-ci.yml)

대규모 트래픽 환경에서 발생할 수 있는 **예약 충돌 문제를 해결하기 위한 예약 플랫폼**입니다.

단순한 예약 CRUD 구현에 그치지 않고, 동시성 제어, 캐싱, 이벤트 기반 아키텍처, 성능 테스트, 모니터링 및 CI/CD 환경을 단계적으로 구축하는 것을 목표로 합니다.

> 현재 프로젝트 초기 설정 및 설계 단계입니다.
> 기능과 문서는 개발 진행에 따라 지속적으로 업데이트됩니다.

---

## 1. 프로젝트 목표

예약 서비스에서 발생할 수 있는 다음 문제를 직접 구현하고 개선합니다.

* 동일한 숙소 또는 객실의 중복 예약 방지
* 다수의 동시 예약 요청 처리
* 조회 트래픽 증가에 따른 API 부하 개선
* 예약 이후 후속 작업의 비동기 처리
* 장애 및 성능 지표 모니터링
* 자동화된 빌드·테스트·배포 환경 구축

### 핵심 시나리오

```text
남은 객실: 1개
동시 예약 요청: 1,000건

→ 1건만 예약 성공
→ 나머지 요청은 일관된 비즈니스 예외로 처리
```

---

## 2. 주요 기능

### 사용자 및 인증

* 회원가입
* 로그인
* JWT 기반 인증·인가
* OAuth2 소셜 로그인

### 숙소

* 숙소 등록
* 숙소 목록 조회
* 숙소 상세 조회
* 객실 및 예약 가능 일정 관리

### 예약

* 예약 생성
* 예약 조회
* 예약 취소
* 중복 예약 방지
* 동시 예약 요청 제어

### 비동기 이벤트

예약 완료 이벤트를 발행하고 후속 작업을 비동기로 처리합니다.

* 이메일 발송
* 포인트 적립
* 알림 생성
* 실패 이벤트 재처리

---
## 3. 기술 스택

### 현재 적용(Backend)

- Java 21
- Spring Boot 4.0.7
- Gradle
- Docker
- Docker Compose
- MySQL 8.4
- Redis 7.4
- GitHub Actions

### 예정

- Spring Security
- JWT
- OAuth2
- Spring Data JPA
- Kafka
- Prometheus
- Grafana
- k6
- AWS

### Database

* MySQL
* Redis

### Messaging

* Apache Kafka

### Infrastructure

* Docker
* Docker Compose
* AWS EC2
* AWS RDS
* AWS ElastiCache

### CI/CD

* GitHub Actions

### Monitoring

* Prometheus
* Grafana

### Performance Test

* k6

> 구체적인 버전과 구성은 기술 검토 및 개발 진행에 따라 확정합니다.

---

## 4. 시스템 구성

```text
Client
  │
  ▼
Spring Boot API
  │
  ├── Redis
  │    ├── Distributed Lock
  │    └── Cache
  │
  ├── MySQL
  │
  └── Kafka
       ├── Email Event Consumer
       ├── Point Event Consumer
       └── Notification Event Consumer
```

초기에는 하나의 애플리케이션 내부에서 도메인 경계를 분리한 **모듈러 모놀리스** 형태로 개발합니다.

서비스 분리가 필요한 기술적 근거가 확보되면 일부 Consumer 또는 기능을 별도 애플리케이션으로 분리하는 방안을 검토합니다.

---

## 5. 프로젝트 구조

초기 목표 구조는 다음과 같습니다.

```text
reservation-platform/
├── backend/
│   ├── src/
│   ├── build.gradle
│   └── Dockerfile
│
├── frontend/
│   └── README.md
│
├── infra/
│   ├── docker/
│   ├── prometheus/
│   └── grafana/
│
├── load-test/
│   └── k6/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── erd/
│   ├── adr/
│   ├── performance/
│   └── troubleshooting/
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   └── pull_request_template.md
│
├── docker-compose.yml
└── README.md
```

> 실제 디렉터리 구조는 구현 과정에서 변경될 수 있습니다.

---

## 6. 개발 로드맵

### Phase 0 — Project Setup

프로젝트 개발을 위한 기본 환경과 협업 규칙을 설정합니다.

* [x] GitHub Issue 및 Pull Request Template 적용
* [x] 브랜치 및 커밋 규칙 정의
* [x] 프로젝트 기본 디렉터리 구성
* [x] Spring Boot 프로젝트 생성
* [x] 로컬 개발용 Docker Compose 구성
* [x] 기본 CI Workflow 구성
* [ ] 프로젝트 문서 구조 설정

### Phase 1 — Basic Reservation

기본 예약 서비스를 구현합니다.

* [ ] 회원가입
* [ ] 로그인
* [ ] JWT 인증·인가
* [ ] OAuth2 로그인
* [ ] 숙소 등록
* [ ] 숙소 목록 및 상세 조회
* [ ] 예약 생성
* [ ] 예약 조회
* [ ] 예약 취소
* [ ] 기본 예외 처리
* [ ] API 문서화

### Phase 2 — Concurrency Control

동일 객실에 대한 동시 예약 문제를 재현하고 해결합니다.

* [ ] 동시 예약 테스트 환경 구성
* [ ] 데이터베이스 기반 동시성 제어 검토
* [ ] Redis 분산 락 적용
* [ ] Lettuce와 Redisson 방식 비교
* [ ] 락 획득 실패 및 타임아웃 처리
* [ ] 1,000건 동시 예약 테스트
* [ ] TPS, 성공률, 실패율 측정
* [ ] 적용 전후 결과 분석

### Phase 3 — Cache Optimization

조회 API의 부하를 측정하고 Redis Cache를 적용합니다.

* [ ] 조회 성능 기준값 측정
* [ ] 캐시 대상 선정
* [ ] Redis Cache 적용
* [ ] 캐시 무효화 정책 구현
* [ ] Cache Hit Ratio 측정
* [ ] 적용 전후 응답 시간 비교

### Phase 4 — Event-Driven Processing

예약 이후 후속 작업을 Kafka 이벤트로 분리합니다.

* [ ] 예약 완료 이벤트 설계
* [ ] Kafka Producer 구현
* [ ] 이메일 Consumer 구현
* [ ] 포인트 Consumer 구현
* [ ] 알림 Consumer 구현
* [ ] 이벤트 중복 처리 방지
* [ ] Retry 정책 구현
* [ ] 실패 이벤트 처리 전략 수립

### Phase 5 — Deployment and Monitoring

배포 자동화와 운영 지표 모니터링 환경을 구축합니다.

* [ ] 애플리케이션 Docker 이미지 구성
* [ ] GitHub Actions CI 구성
* [ ] GitHub Actions CD 구성
* [ ] AWS 배포 환경 구성
* [ ] Prometheus 연동
* [ ] Grafana Dashboard 구성
* [ ] API 응답 시간 측정
* [ ] CPU 및 Memory 모니터링
* [ ] DB Connection Pool 모니터링
* [ ] Cache Hit Ratio 모니터링

---

## 7. 성능 테스트

예약 API에 동시 요청을 발생시켜 다음 항목을 측정합니다.

* TPS
* 평균 응답 시간
* P95 응답 시간
* P99 응답 시간
* 성공률
* 실패율
* Error Rate
* CPU 사용률
* Memory 사용량
* DB Connection 사용량
* Cache Hit Ratio

성능 개선 작업은 다음 순서로 기록합니다.

```text
문제 정의
→ 기준 성능 측정
→ 병목 지점 분석
→ 개선 방법 적용
→ 동일 조건 재측정
→ 결과 비교
→ 한계 및 후속 과제 정리
```

테스트 결과와 분석 문서는 `docs/performance`에서 관리할 예정입니다.

---

## 8. 문서화

프로젝트의 핵심 기술 문서는 GitHub에서 함께 관리합니다.

```text
docs/
├── architecture/       # 시스템 및 애플리케이션 아키텍처
├── api/                # API 명세
├── erd/                # 데이터 모델 및 ERD
├── adr/                # 주요 기술 의사결정
├── performance/        # 성능 테스트 결과
└── troubleshooting/    # 문제 원인과 해결 과정
```

장기적인 개발일지, 작업 계획 및 회고는 Notion에서 관리하고, 포트폴리오 평가에 필요한 핵심 문서는 GitHub에 정리합니다.

---

## 9. 브랜치 전략

```text
main
└── issue/{issue-number}-{description}
```

예시:

```text
issue/1-project-initial-setup
issue/12-create-reservation-api
issue/24-apply-redis-distributed-lock
```

작업 흐름은 다음과 같습니다.

```text
Issue 생성
→ 작업 브랜치 생성
→ 구현 및 테스트
→ Pull Request 생성
→ 자체 리뷰
→ main 병합
→ Issue 종료
```

개인 프로젝트이므로 별도의 장기 유지 `develop` 브랜치는 두지 않고, 짧게 유지되는 작업 브랜치를 `main`에 병합하는 방식을 사용합니다.

---

## 10. 커밋 규칙

커밋 메시지는 다음 형식을 사용합니다.

```text
<type>: <description>
```

| Type       | 설명             |
| ---------- | -------------- |
| `feat`     | 새로운 기능         |
| `fix`      | 버그 수정          |
| `refactor` | 기능 변경 없는 코드 개선 |
| `test`     | 테스트 추가 및 수정    |
| `docs`     | 문서 변경          |
| `chore`    | 빌드, 설정 및 기타 작업 |
| `perf`     | 성능 개선          |
| `ci`       | CI/CD 설정 변경    |

예시:

```text
chore: initialize project structure
feat: implement reservation creation API
fix: prevent duplicate reservations
perf: apply Redis cache to accommodation query
docs: add concurrency test results
```

---

## 11. 현재 진행 상태

현재는 **Phase 0 — Project Setup** 단계입니다.

* [x] Repository 생성
* [x] Issue Template 적용
* [x] Pull Request Template 적용
* [x] 초기 설정 Issue 생성
* [x] 초기 설정 브랜치 생성
* [x] README 작성
* [x] Milestone 생성
* [x] Label 정리
* [x] 기본 디렉터리 생성
* [x] Spring Boot 프로젝트 초기화
* [x] 로컬 인프라 구성
* [x] CI Workflow 구성

---
## 12. 로컬 개발 환경 실행

### 사전 요구사항

로컬에서 프로젝트를 실행하려면 다음 환경이 필요합니다.

- Java 21
- Docker
- Docker Compose

### 환경 변수 설정

프로젝트 루트의 `.env.example` 파일을 복사하여 `.env` 파일을 생성합니다.

#### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

## 13. 실행 방법

프로젝트 초기 설정 완료 후 작성할 예정입니다.

```bash
# Repository clone
git clone <repository-url>

# 프로젝트 디렉터리 이동
cd reservation-platform

# 로컬 인프라 실행
docker compose up -d

# Backend 실행
cd backend
./gradlew bootRun
```

> 실제 실행 명령과 환경 변수 설정 방법은 개발 환경 구성이 완료된 후 업데이트합니다.

---

## 14. 주요 기술 과제

이 프로젝트에서 중점적으로 검증할 기술 과제는 다음과 같습니다.

1. 동시 요청 환경에서도 중복 예약을 방지할 수 있는가
2. 분산 락 적용으로 발생하는 성능 비용을 어떻게 측정할 것인가
3. 캐시 데이터와 원본 데이터의 일관성을 어떻게 관리할 것인가
4. Kafka Consumer의 중복 소비와 실패를 어떻게 처리할 것인가
5. 성능 개선이 실제 지표로 검증되는가
6. 장애 발생 시 원인을 추적할 수 있는 모니터링 환경이 갖춰졌는가

---

## 15. License

라이선스는 프로젝트 공개 범위 확정 후 추가할 예정입니다.
