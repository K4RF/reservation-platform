# Reservation Platform

[![Backend CI](https://github.com/K4RF/reservation-platform/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/K4RF/reservation-platform/actions/workflows/backend-ci.yml)

대규모 트래픽 환경에서 발생할 수 있는 **예약 충돌 문제를 해결하기 위한 예약 플랫폼**입니다.

단순한 예약 CRUD 구현에 그치지 않고, 동시성 제어, 캐싱, 이벤트 기반 아키텍처, 성능 테스트, 모니터링 및 CI/CD 환경을 단계적으로 구축하는 것을 목표로 합니다.

> 현재 **Phase 1 — Basic Reservation** 단계입니다. Spring Boot 프로젝트,
> MySQL·Redis용 Docker Compose, Backend CI, 회원가입·이메일 로그인·Google
> OAuth2 로그인, JWT Access Token 기반 인증, 숙소·객실 등록 및 조회와 기본
> 예약 생성·본인 예약 조건 조회·취소 API가 구성되어 있습니다. Redis 기반 Refresh
> Token 재발급과 로그아웃, 날짜·인원 기반 예약 가능 객실 조회가 구현됐으며
> 숙소명 검색과 객실 조건 조회도 지원합니다. 예약 생성 시 객실의 1박 가격을
> Snapshot으로 저장하고 숙박 일수에 따른 총 예약 금액을 계산하며, 본인 예약의
> 일정 변경도 지원합니다. 관리자는 숙소·객실 정보와 운영 상태를 관리할 수
> 있습니다. 주요 테이블의 NOT NULL·UNIQUE·FK·CHECK 제약과 현재 조회 패턴 기반
> 인덱스를 검토하고 문서화했습니다. API Validation·ErrorCode·HTTP Status와
> 공통 오류 응답 정책도 실제 Swagger 명세에 반영했습니다. 동시성 제어는 아직
> 구현되지 않았습니다.

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

아래 항목은 프로젝트에서 단계적으로 구현할 **예정 기능**입니다.

### 사용자 및 인증

* 회원가입
* 로그인
* JWT 기반 인증·인가
* OAuth2 소셜 로그인

### 숙소

* 숙소 등록
* 숙소 목록 조회
* 숙소 상세 조회
* 객실 등록 및 조회
* 객실 재고 및 예약 가능 일정 관리

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

### 현재 적용

| 구분 | 기술 및 버전 | 현재 범위 |
| --- | --- | --- |
| Backend | Java 21, Spring Boot 4.0.7 | 애플리케이션 기본 실행 환경 |
| Web | Spring MVC | REST API 구현 기반 |
| Validation | Bean Validation | 요청 데이터 검증 기반 |
| Persistence | Spring Data JPA Specifications, MySQL 8.4 | 회원·소셜 계정·숙소·객실·예약 저장, 동적 조회 및 DB 제약조건 기반 정합성 보호 |
| Password | Spring Security Crypto | 회원 비밀번호 해시 저장 |
| Security | Spring Security 7.0.6 | Stateless 인증·인가 및 API 접근 규칙 |
| JWT | Spring Security OAuth2 JOSE | HS256 Access Token 발급·검증 |
| Social Login | Spring Security OAuth2 Client, Google | Google 계정 로그인 및 회원 연결 |
| Token Store | Spring Data Redis, Redis 7.4 | Refresh Token 저장·TTL·로그아웃 삭제 |
| API Documentation | Springdoc OpenAPI 3.0.3, Swagger UI | OpenAPI 명세 생성 및 브라우저 API 테스트 |
| Build | Gradle Wrapper 9.5.1 | 빌드 및 테스트 |
| Test | JUnit Platform, H2 | 단위 및 통합 테스트 |
| Local Infrastructure | Docker Compose, MySQL 8.4, Redis 7.4 | 컨테이너와 헬스 체크 정의 |
| CI | GitHub Actions | `develop` 대상 Backend 테스트 및 빌드 |

> Backend는 MySQL과 Redis에 연결됩니다. Redis는 현재 Refresh Token 저장에만
> 사용하며 분산 락과 Cache는 아직 적용하지 않았습니다.

### 도입 예정

| 구분 | 기술 |
| --- | --- |
| Authentication | 추가 OAuth2 Provider, Access Token Blacklist 정책 |
| Cache and Lock | Redis, Lettuce 또는 Redisson 검토 |
| Messaging | Apache Kafka |
| Monitoring | Prometheus, Grafana |
| Performance Test | k6 |
| Deployment | AWS EC2, RDS, ElastiCache |

예정 기술의 구체적인 버전과 구성은 도입 시점의 기술 검토 후 확정합니다.

---

## 4. 시스템 구성

아래 구성은 프로젝트가 단계적으로 구현하려는 **목표 아키텍처**입니다.
현재는 Spring Boot API, 회원가입·이메일 로그인·Google OAuth2 로그인과 MySQL
저장 기능, Stateless SecurityFilterChain, JWT Access Token 발급·검증 및 인증
Filter, MySQL·Redis 로컬 컨테이너가 구성되어 있습니다. Redis는 Refresh Token
저장과 TTL 관리에 사용하며 분산 락·Cache 활용과 Kafka 연동은 도입 예정입니다.

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

### 현재 인증·숙소·객실·예약 API

| Method | Endpoint | 권한 | 기능 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | 공개 | Access/Refresh Token 발급 |
| `POST` | `/api/v1/auth/reissue` | 공개 | Refresh Token으로 Access Token 재발급 |
| `POST` | `/api/v1/auth/logout` | 인증 사용자 | Redis Refresh Token 삭제 |

| Method | Endpoint | 권한 | 기능 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/accommodations` | `ADMIN` | 숙소 등록 |
| `PUT` | `/api/v1/accommodations/{accommodationId}` | `ADMIN` | 숙소 정보 수정 |
| `PATCH` | `/api/v1/accommodations/{accommodationId}/status` | `ADMIN` | 숙소 운영 상태 변경 |
| `GET` | `/api/v1/accommodations/{accommodationId}` | 인증 사용자 | 숙소 단건 조회 |
| `GET` | `/api/v1/accommodations?name=hotel&sortBy=NAME&direction=ASC&page=0&size=20` | 인증 사용자 | 숙소명 검색·정렬·페이지 조회 |
| `POST` | `/api/v1/accommodations/{accommodationId}/rooms` | `ADMIN` | 숙소 객실 등록 |
| `PUT` | `/api/v1/rooms/{roomId}` | `ADMIN` | 객실 정보 수정 |
| `PATCH` | `/api/v1/rooms/{roomId}/status` | `ADMIN` | 객실 운영 상태 변경 |
| `GET` | `/api/v1/rooms/{roomId}` | 인증 사용자 | 객실 단건 조회 |
| `GET` | `/api/v1/accommodations/{accommodationId}/rooms?minCapacity=2&minPrice=100000&maxPrice=200000&status=ACTIVE&sortBy=NIGHTLY_PRICE&direction=ASC&page=0&size=20` | 인증 사용자 | 숙소별 객실 조건·정렬·페이지 조회 |
| `GET` | `/api/v1/accommodations/{accommodationId}/rooms/available?checkInDate=2030-01-10&checkOutDate=2030-01-15&guestCount=2&page=0&size=20` | 인증 사용자 | 기간·인원 기준 예약 가능 객실 조회 |
| `POST` | `/api/v1/reservations` | 인증 사용자 | 인증 회원의 객실 예약 생성 |
| `GET` | `/api/v1/reservations/{reservationId}` | 예약 소유자 | 본인 예약 단건 조회 |
| `GET` | `/api/v1/reservations?status=CONFIRMED&checkInFrom=2030-01-01&checkInTo=2030-12-31&checkOutFrom=2030-01-02&checkOutTo=2031-01-01&sortBy=CHECK_IN_DATE&direction=ASC&page=0&size=20` | 인증 사용자 | 본인 예약 조건·정렬·페이지 조회 |
| `PATCH` | `/api/v1/reservations/{reservationId}` | 예약 소유자 | 본인 예약 체크인·체크아웃 일정 변경 |
| `PATCH` | `/api/v1/reservations/{reservationId}/cancel` | 예약 소유자 | 본인 예약 취소 |

`page`는 0부터 시작하고 `size`는 1 이상 100 이하만 허용합니다. 검색 조건을
생략하면 기존처럼 ID 오름차순 목록을 반환합니다. 숙소 정렬은 `ID`, `NAME`,
객실 정렬은 `ID`, `NAME`, `CAPACITY`, `NIGHTLY_PRICE`, 예약 정렬은 `ID`,
`CHECK_IN_DATE`, `CHECK_OUT_DATE`, `TOTAL_AMOUNT`만 허용하며 방향은 `ASC`,
`DESC`입니다. 숙소명은 대소문자를 구분하지 않는 부분 일치 검색입니다. 객실은
최소 수용 인원, 1박 최소·최대 가격, `ACTIVE/INACTIVE` 상태를 선택적으로 조합할
수 있습니다. 예약은 `CONFIRMED/CANCELLED` 상태와 체크인·체크아웃 날짜의
`From/To` 조건을 선택적으로 조합할 수 있으며 각 날짜 경계는 포함됩니다.
`From`과 `To`를 함께 전달하면 `From`은 `To` 이하여야 합니다. 모든 예약 목록
조건에는 JWT 회원 ID가 적용되므로 다른 회원의 예약은 반환되지 않습니다.

객실 등록 시 양수인 `nightlyPrice`가 필요하며 객실 응답에도 1박 가격이 포함됩니다.
숙소와 객실은 생성 시 `ACTIVE` 상태이며 관리자는 정보와 `ACTIVE/INACTIVE` 상태를
변경할 수 있습니다. `INACTIVE` 숙소 또는 객실은 예약 가능 객실 목록에서 제외되고
신규 예약 생성도 차단됩니다. 물리적으로 삭제하지 않으므로 기존 예약 이력과 예약
조회는 유지됩니다.
기존 개발 DB 객실은 Schema 갱신 시 `0.00`으로 보존됩니다. 예약 생성 시점의
객실 가격은 `nightlyPriceSnapshot`에 복사하고, `[checkInDate, checkOutDate)`의
숙박 일수는 `stayNights`로 계산합니다. `totalAmount`는
`nightlyPriceSnapshot × stayNights`이며, 이후 객실 가격이 변경되어도 기존 예약
금액은 바뀌지 않습니다. 기존 개발 DB 예약의 새 금액 컬럼은 `0.00`으로 보존됩니다.

예약 가능 객실 조회는 체크인보다 체크아웃이 뒤이고 요청 인원이 1명 이상인
경우에만 수행됩니다. 특정 숙소의 `ACTIVE` 객실 중 수용 인원이 요청 인원 이상이고,
요청 기간과 겹치는 `CONFIRMED` 예약이 없는 객실을 반환합니다. `CANCELLED` 예약은
가용성을 막지 않으며 기간은 `[checkInDate, checkOutDate)`로 비교합니다. 조회와 실제
예약 생성 사이의 Race Condition은 아직 방지하지 않습니다.

예약 생성 요청은 `memberId`를 받지 않고 JWT 인증 정보의 회원 ID를 사용합니다.
예약 기간은 체크아웃 날짜를 점유하지 않는 `[checkInDate, checkOutDate)` 구간으로
처리하므로 기존 예약의 체크아웃 날짜와 다음 예약의 체크인 날짜가 같을 수
있습니다. 현재 중복 검증은 `CONFIRMED` 예약을 일반 조회한 뒤 저장하는 방식이며,
동시 요청 Race Condition과 DB·Redis Lock은 Phase 2에서 다룹니다.

예약 조회와 취소는 JWT 인증 정보의 회원 ID를 기준으로 본인 예약에만 접근할 수
있습니다. `CONFIRMED` 예약의 일정 변경은 현재 예약 자신을 제외한 동일 객실의
기간 중복을 검사하며, 변경된 숙박 일수와 예약 시점 가격 Snapshot으로 총액을
다시 계산합니다. `CANCELLED` 예약의 일정은 변경할 수 없습니다. 예약 취소는
데이터를 삭제하지 않고 `CONFIRMED` 상태를 `CANCELLED`로 변경하며, 이미 취소된
예약은 다시 취소할 수 없습니다. 세부 취소 가능 시간과 환불 정책은 현재 MVP
범위에 포함되지 않습니다. 상태별 허용 동작과 전이 규칙은
[`docs/architecture/reservation-status-policy.md`](docs/architecture/reservation-status-policy.md)에
정리되어 있습니다.

초기에는 하나의 애플리케이션 내부에서 도메인 경계를 분리한 **모듈러 모놀리스** 형태로 개발합니다.

서비스 분리가 필요한 기술적 근거가 확보되면 일부 Consumer 또는 기능을 별도 애플리케이션으로 분리하는 방안을 검토합니다.

---

## 5. 프로젝트 구조

현재 Git에서 관리하는 주요 구조는 다음과 같습니다.

```text
reservation-platform/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│       └── backend-ci.yml
├── backend/
│   ├── src/main/
│   ├── src/test/
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradlew, gradlew.bat
├── frontend/
│   └── README.md
├── infra/
│   ├── docker/
│   ├── prometheus/
│   └── grafana/
├── load-test/
│   └── k6/
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── erd/
│   ├── adr/
│   ├── testing/
│   └── performance/
├── .env_sample
├── AGENTS.md
├── docker-compose.yml
└── README.md
```

`frontend`, `infra`, `load-test`와 일부 `docs` 하위 디렉터리는 현재
placeholder 상태이며, 관련 구현이 시작될 때 구체적인 파일이 추가됩니다.

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
* [x] 프로젝트 문서 구조 설정
* [x] 최상위 README 작성

### Phase 1 — Basic Reservation

기본 예약 서비스를 구현합니다.

* [x] 회원가입
* [x] JWT 인증 기반 구성
* [x] 로그인 및 JWT 발급 API
* [x] OAuth2 로그인
* [x] 숙소 등록
* [x] 숙소 목록 및 상세 조회
* [x] 객실 등록 및 숙소별 목록·상세 조회
* [x] 예약 생성
* [x] 예약 조회
* [x] 예약 취소
* [x] 날짜·인원 기준 예약 가능 객실 조회
* [x] 숙소명 검색 및 객실 조건·정렬 조회
* [x] 객실 1박 가격 및 예약 가격 Snapshot·총 금액 계산
* [x] 본인 예약 일정 변경 및 금액 재계산
* [x] 예약 상태별 허용 동작 및 도메인 상태 전이 규칙
* [x] 숙소·객실 정보 수정 및 운영 상태 관리
* [x] 본인 예약 상태·기간 조건 조회 및 제한된 정렬·Pagination
* [x] 주요 테이블 제약조건·인덱스 검토 및 DB 정합성 강화
* [x] 공통 예외 처리와 API Validation·Error Response 정책 정리
* [x] Swagger/OpenAPI 기반 API 문서화
* [x] Basic Reservation MVP 종단간 통합 테스트

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
* [x] GitHub Actions CI 구성
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
└── performance/        # 성능 테스트 결과
```

현재 `architecture`와 `adr`에는 문서 작성 원칙이 정리되어 있으며, 실제 Entity와
Schema의 관계·제약조건·인덱스는
[`docs/erd/database-schema.md`](docs/erd/database-schema.md)에 정리되어 있습니다.
API 오류 응답 계약과 전체 ErrorCode는
[`docs/api/error-response.md`](docs/api/error-response.md)에 정리되어 있습니다.
`performance`는 placeholder 상태입니다. 문제 원인과 해결 과정은
필요 시 `docs/troubleshooting`을 추가하여 관리할 예정입니다.

장기적인 개발일지, 작업 계획 및 회고는 Notion에서 관리하고, 포트폴리오 평가에 필요한 핵심 문서는 GitHub에 정리합니다.

---

## 9. 브랜치 전략

```text
develop
└── feature/#{issue-number}-{description}
```

예시:

```text
feature/#7-README
feature/#12-create-reservation-api
feature/#24-apply-redis-distributed-lock
```

작업 흐름은 다음과 같습니다.

```text
Issue 생성
→ 작업 브랜치 생성
→ 구현 및 테스트
→ Pull Request 생성
→ CI 및 자체 리뷰
→ develop 병합
→ Issue 종료
```

현재 기본 브랜치는 `develop`입니다. Issue 단위의 짧은 작업 브랜치를 생성하고,
Pull Request를 통해 `develop`에 병합합니다.

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

현재는 **Phase 1 — Basic Reservation** 단계입니다.

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
* [x] MySQL·Redis 로컬 Docker Compose 구성
* [x] CI Workflow 구성
* [x] 회원가입 및 비밀번호 해시 저장
* [x] Spring Security 및 JWT 인증 기반 구성
* [x] 이메일 로그인 및 JWT Access Token 발급
* [x] Google OAuth2 로그인 및 기존 회원 연결
* [x] 숙소 등록 및 페이지 기반 목록·단건 조회
* [x] 객실 등록 및 숙소별 페이지 목록·단건 조회
* [x] 인증 회원의 객실 예약 생성 및 일반 조회 기반 기간 중복 검증
* [x] 인증 회원의 예약 단건·페이지 목록 조회 및 상태 기반 취소
* [x] Backend와 MySQL 연동
* [x] Swagger UI 및 JWT Bearer 인증 기반 API 테스트 환경 구성
* [x] 회원가입부터 예약 취소까지 MVP 종단간 통합 테스트 구성
* [x] Backend와 Redis Refresh Token 저장 연동
* [x] 운영 중인 객실의 기간·인원 기준 예약 가능 목록 조회
* [x] 숙소명 검색 및 객실 수용 인원·가격·상태 필터와 제한된 정렬
* [x] 예약 시점 객실 가격 Snapshot 및 숙박 일수 기반 총 금액 계산
* [x] 소유권·상태·기간 중복 검증을 적용한 예약 일정 변경
* [x] `CONFIRMED`·`CANCELLED` 예약 상태 전이 정책 및 도메인 예외 구성
* [x] 관리자 숙소·객실 정보 수정 및 비활성 리소스 신규 예약 차단
* [x] 본인 예약 상태·체크인·체크아웃 조건 조합 및 제한된 정렬·Pagination
* [x] 회원·숙소·객실·예약 DB 제약조건과 조회 패턴 기반 인덱스 검토
* [x] API Validation·HTTP Status·ErrorCode 및 Swagger 오류 응답 일관성 정리

---

## 12. 로컬 개발 환경 실행

### 사전 요구사항

로컬에서 프로젝트를 실행하려면 다음 환경이 필요합니다.

- Java 21
- Docker
- Docker Compose

### 환경 변수 설정

프로젝트 루트의 `.env_sample` 파일을 복사하여 `.env` 파일을 생성합니다.

#### Windows PowerShell

```powershell
Copy-Item .env_sample .env
```

#### macOS/Linux

```bash
cp .env_sample .env
```

`.env`의 비밀번호와 포트 값을 로컬 환경에 맞게 변경합니다. 실제 비밀값이
포함된 `.env` 파일은 Git에 커밋하지 않습니다.

JWT 서명용 Secret은 32바이트 이상의 난수를 Base64로 인코딩해
`JWT_SECRET`에 설정합니다. `.env_sample`의 placeholder를 그대로 사용하면
애플리케이션이 시작되지 않습니다.

Windows PowerShell:

```powershell
$jwtBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($jwtBytes)
[Convert]::ToBase64String($jwtBytes)
```

macOS/Linux:

```bash
openssl rand -base64 32
```

관련 환경변수는 다음과 같습니다.

```dotenv
JWT_SECRET=<base64-encoded-secret>
JWT_ISSUER=reservation-platform
JWT_ACCESS_TOKEN_EXPIRATION=30m
JWT_REFRESH_TOKEN_EXPIRATION=14d
REDIS_HOST=localhost
REDIS_PORT=6380
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

Google Cloud Console의 OAuth Client에는 로컬 Redirect URI로
`http://localhost:8080/login/oauth2/code/google`을 등록합니다. Backend 실행 후
`http://localhost:8080/oauth2/authorization/google`로 접속하면 Google 로그인을
시작하며, 성공한 Callback 응답으로 서비스 JWT Access Token을 반환합니다.

Google이 검증한 이메일과 동일한 기존 회원이 있으면 해당 회원에 Google 계정을
연결하며 기존 비밀번호 로그인은 유지합니다. 동일 이메일 회원이 없으면 `USER`
역할의 신규 회원과 Google 소셜 계정을 생성합니다.

### 저장소 준비

```bash
git clone https://github.com/K4RF/reservation-platform.git
cd reservation-platform
```

### 로컬 인프라 실행

Docker MySQL은 Host의 `3307` 포트를 컨테이너의 `3306` 포트에 연결합니다.
Backend는 프로젝트 루트 `.env`의 `MYSQL_PORT`와 동일한 포트를 사용합니다.

```bash
docker compose up -d
docker compose ps
```

종료할 때는 다음 명령을 사용합니다.

```bash
docker compose down
```

MySQL 데이터 볼륨까지 삭제하려면 `docker compose down -v`를 사용할 수
있습니다. 이 명령은 로컬 MySQL 데이터를 삭제하므로 필요한 경우에만
실행합니다.

### Backend 실행

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat bootRun
```

macOS/Linux:

```bash
cd backend
./gradlew bootRun
```

Backend 기본 설정은 MySQL을 사용하므로 애플리케이션 실행 전에 MySQL
컨테이너가 필요합니다. Backend는 프로젝트 루트의 `.env`를 로컬 설정으로
읽습니다. 다른 데이터베이스를 사용할 때는 `DB_URL`, `MYSQL_USER`,
`MYSQL_PASSWORD`를 실행 환경에서 재정의할 수 있습니다.

### Swagger UI 및 OpenAPI

Backend 실행 후 다음 주소에서 API 명세를 확인할 수 있습니다.

| 구분 | 접근 주소 |
| --- | --- |
| Swagger UI | `http://localhost:8080/swagger-ui.html` |
| OpenAPI JSON | `http://localhost:8080/v3/api-docs` |

Swagger UI의 `Authorize` 버튼에서 로그인 API로 발급받은 JWT Access Token을
입력하면 Bearer 인증이 필요한 숙소·객실·예약 API를 직접 호출할 수 있습니다.
`Bearer ` 접두사는 Swagger UI가 자동으로 추가하므로 토큰 값만 입력합니다.

Swagger UI와 OpenAPI Endpoint는 현재 인증 없이 접근할 수 있습니다. 개발 및
API 검증 용도이며, 운영 환경 공개 여부와 환경별 비활성화 정책은 배포 단계에서
별도로 결정합니다.

## 13. 테스트 및 빌드

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat test
.\gradlew.bat build
```

macOS/Linux:

```bash
cd backend
./gradlew test
./gradlew build
```

GitHub Actions의 `Backend CI`는 `develop` 브랜치의 Backend 관련 push와
Pull Request에서 동일한 테스트 및 빌드를 수행합니다.

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
