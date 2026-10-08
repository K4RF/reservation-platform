# Reservation Platform

[![Backend CI](https://github.com/K4RF/reservation-platform/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/K4RF/reservation-platform/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/K4RF/reservation-platform/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/K4RF/reservation-platform/actions/workflows/frontend-ci.yml)

대규모 트래픽 환경에서 발생할 수 있는 **예약 충돌 문제를 해결하기 위한 예약 플랫폼**입니다.

단순한 예약 CRUD 구현에 그치지 않고, 동시성 제어, 캐싱, 이벤트 기반 아키텍처, 성능 테스트, 모니터링 및 CI/CD 환경을 단계적으로 구축하는 것을 목표로 합니다.

> **v0.1.0부터 v0.4.0 — Event-Driven Processing까지** 기능 및 구조 검증을
> 완료했습니다. Spring Boot 프로젝트, MySQL·Redis·Kafka용 Docker Compose,
> Backend CI, 회원가입·이메일 로그인·Google
> OAuth2 로그인, JWT Access Token 기반 인증, 숙소·객실 등록 및 조회와 기본
> 예약 생성·본인 예약 조건 조회·취소 API가 구성되어 있습니다. Redis 기반 Refresh
> Token 재발급과 로그아웃, 날짜·인원 기반 예약 가능 객실 조회가 구현됐으며
> 숙소명·구조화된 도시·지역·숙소/객실 편의시설·기간·인원·가격·상태·재고를
> 조합한 숙소 통합 검색과 숙소별 객실 조건 조회도 지원합니다. 예약 생성 시 각 숙박일의 날짜별
> 가격 또는 객실 기본 가격을 합산하고 숙박일별 가격, 첫 숙박일 가격과 총액을
> Snapshot으로 저장하며, 본인 예약의 일정 변경 시 현재 가격으로 다시 계산합니다. 관리자는
> 숙소·객실 정보와 운영 상태를 관리할 수
> 있습니다. 주요 테이블의 NOT NULL·UNIQUE·FK·CHECK 제약과 현재 조회 패턴 기반
> 인덱스를 검토하고 문서화했습니다. API Validation·ErrorCode·HTTP Status와
> 공통 오류 응답 정책도 실제 Swagger 명세에 반영했습니다. H2 기반 빠른 통합
> 테스트와 MySQL 8.4 Testcontainers 기반 DB 제약 테스트 환경도 구성했습니다.
> 날짜별 객실 전체·예약 재고 모델을 예약 생성·취소·일정 변경 및 예약 가능 객실
> 조회에 연결해 순차 요청의 Transaction 정합성을 보장합니다. 관리자는 날짜별
> 객실 가격을 등록·수정할 수 있고, 인증 사용자는 특정 날짜의 적용 가격과 기본
> 가격 fallback 여부를 조회할 수 있습니다. 동일 객실·숙박일의 예약 생성·일정 변경·
> 취소에는 RoomInventory Version 기반 Optimistic Lock을 적용했고, 예약 생성 진입점은
> Room 단위 Redis Distributed Lock으로 직렬화합니다. 관리자는 숙소별 예약 가능 조건과 취소 정책을
> 관리할 수 있습니다. 신규 예약은 당시 취소 정책을 Snapshot으로 저장하므로 이후
> 숙소 정책이 바뀌어도 기존 예약의 무료·부분 수수료·취소 제한 기준은 유지됩니다.
> 관리자는 객실별 재고 Calendar에서 날짜별 전체 수량과 `OPEN/CLOSED` 판매 상태를
> 관리할 수 있으며, 판매 중지된 날짜는 예약 가능 조회와 신규 예약에서 제외됩니다.
> 예약 취소 시각과 실제 취소 수수료·예상 환불액도 예약에 Snapshot으로 보존됩니다.
> 신규 예약은 외부 공개 예약번호와 최소 대표 투숙객 정보를 보존하며, 숙소 상세에는
> 기본 체크인·체크아웃 운영시간이 포함됩니다.
> 숙소별 IANA TimeZone을 기준으로 예약 가능일·취소일·공개 예약번호의 날짜를
> 계산하며 시스템 이벤트 Timestamp는 UTC로 저장합니다.

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

회원·인증, 숙소·객실·정책·재고 관리와 예약 생성·조회·변경·취소는 구현되어 있습니다.
예약 재고에는 DB 비관적 락 검증에 이어 Optimistic Lock을 적용했으며, 예약 생성은
Room 단위 Redis Distributed Lock 안에서 최초 시도 포함 최대 3회 수행합니다. 성능
비교는 후속 Roadmap 범위입니다. 예약 생성·일정 변경·취소 Event 계약과 Kafka 개발
환경, Transactional Outbox 기반 Producer 발행과 Event별 Consumer Handler, 비동기
Audit Log Stub을 구성했습니다.

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

예약 생성·일정 변경·취소 Event 계약과 Kafka Topic을 정의했습니다. 예약 상태와
`PENDING` Outbox Event를 같은 Database Transaction에 저장하고 별도 Publisher가
Kafka 발행 성공 후 `PUBLISHED`로 갱신합니다. 하나의 Consumer Group이 세 Event를 Event별 Handler로
분기하고 Event ID 처리 이력을 MySQL에 저장해 중복 전달과 재시작 후 재전달을 Skip합니다.
일시적 Consumer 실패는 최대 2회 고정 Backoff Retry하고, 지속 실패 또는 계약 오류는
원본 Metadata와 실패 정보를 보존한 DLT로 격리합니다. 현재는 구조화 Audit Log를
비동기 후처리 Stub으로 남깁니다. 아래 외부 연동은
예정 범위입니다.

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
| Frontend | React 19.3, TypeScript 6.0, React Router 7.18.4, Vite 8.3, pnpm 11.19.0 | 회원가입·이메일/Google 로그인·로그아웃, 메모리 Access/Refresh Token, 자동 재발급 및 API Bearer Header; 예약 화면은 후속 범위 |
| Web | Spring MVC | REST API 구현 기반 |
| Validation | Bean Validation | 요청 데이터 검증 기반 |
| Persistence | Spring Data JPA Specifications, MySQL 8.4 | 회원·소셜 계정·숙소·객실·날짜별 재고·가격·예약 저장, 동적 조회 및 DB 제약조건 기반 정합성 보호 |
| Password | Spring Security Crypto | 회원 비밀번호 해시 저장 |
| Security | Spring Security 7.0.6 | Stateless 인증·인가 및 API 접근 규칙 |
| JWT | Spring Security OAuth2 JOSE | HS256 Access Token 발급·검증 |
| Social Login | Spring Security OAuth2 Client, Google | Google 계정 로그인 및 회원 연결 |
| Token Store | Spring Data Redis, Redis 7.4 | Refresh Token 저장·TTL·로그아웃 삭제 |
| Distributed Lock | Redisson 4.7.0, Redis 7.4 | Room 단위 예약 생성 직렬화, Lock 대기·고정 Lease·소유권 기반 해제 |
| Cache | Spring Cache, Spring Data Redis, Redis 7.4 | 숙소·객실 단건 Response Cache, TTL·변경 무효화·동시 Miss 병합·DB fallback |
| Messaging | Spring Kafka 4.0.6, Apache Kafka 4.3.1 | Transactional Outbox, Consumer 멱등성, 제한 Retry·DLT, Handler와 Audit Log Stub |
| API Documentation | Springdoc OpenAPI 3.0.3, Swagger UI | OpenAPI 명세 생성 및 브라우저 API 테스트 |
| Build | Gradle Wrapper 9.5.1 | 빌드 및 테스트 |
| Test | JUnit Platform, H2, Testcontainers 2.0.5, MySQL 8.4, Redis 7.4 | 단위·API 통합 테스트, 실제 DB 제약·전체 예약 Baseline·Rollback·분산 락 검증 |
| Frontend Test | Vitest 4.1.11, jsdom 26.1.0, React Testing Library 16.3.3 | Router·UI·API Client/Error·상태 테스트 |
| Local Infrastructure | Docker Compose, MySQL 8.4, Redis 7.4, Kafka 4.3.1 | 컨테이너와 헬스 체크 정의 |
| CI | GitHub Actions | `develop` 대상 Backend·Frontend 별도 테스트 및 빌드 |

> Backend는 MySQL, Redis, Kafka에 연결되도록 구성됩니다. Redis는 Refresh Token 저장,
> 예약 생성 분산 락, 숙소·객실 단건 조회 Cache에 사용합니다. Kafka는 예약 생성·일정
> 변경·취소 Event를 예약 상태와 같은 Transaction의 Outbox에 저장하고, Polling Publisher가
> 발행한 뒤 Event별 Consumer Handler를 통해 Audit Log Stub을 비동기로 실행합니다.

### 도입 예정

| 구분 | 기술 |
| --- | --- |
| Authentication | 추가 OAuth2 Provider, Access Token Blacklist 정책 |
| Monitoring | Prometheus, Grafana |
| Performance Test | k6 |
| Deployment | AWS EC2, RDS, ElastiCache |

예정 기술의 구체적인 버전과 구성은 도입 시점의 기술 검토 후 확정합니다.

---

## 4. 시스템 구성

현재는 하나의 Spring Boot Application에서 Controller → Service → Entity/Repository
흐름으로 정책·재고·가격·Snapshot을 처리합니다. DTO는 도메인별 request/response
패키지로 분리되어 있습니다. 아래 그림의 Redis Lock은 예약 생성에, Redis Cache는
숙소·객실 단건 조회에 적용됐습니다. Kafka Broker와 Event 계약, Transactional Outbox
Producer 및 기본 Consumer 후처리 흐름이 구성되어 있습니다.
현재는 Spring Boot API, 회원가입·이메일 로그인·Google OAuth2 로그인과 MySQL
저장 기능, Stateless SecurityFilterChain, JWT Access Token 발급·검증 및 인증
Filter, MySQL·Redis·Kafka 로컬 컨테이너가 구성되어 있습니다. Redis는 Refresh Token
저장·TTL 관리, Room 단위 예약 생성 Lock, 숙소·객실 단건 Response Cache에 사용하며
Kafka에는 예약 Event용 Versioned Topic, Transactional Outbox Publisher와 Event별
Consumer Handler가 구성되어 있습니다.

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
  │    └── Reservation + Outbox (same transaction)
  │
  └── Kafka
       └── Reservation Event Consumer
            ├── Event별 Handler
            ├── Audit Log Stub
            └── 외부 알림·통계 연동 (planned)
```

### 현재 인증·숙소·객실 가격·예약 API

| Method | Endpoint | 권한 | 기능 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | 공개 | Access/Refresh Token 발급 |
| `GET` | `/api/v1/auth/oauth2/google/start` | 공개 | Frontend state를 보관하고 Google 인증 시작 |
| `POST` | `/api/v1/auth/oauth2/exchange` | 공개 | 일회용 코드로 Access/Refresh Token 교환 |
| `POST` | `/api/v1/auth/reissue` | 공개 | Refresh Token으로 Access Token 재발급 |
| `POST` | `/api/v1/auth/logout` | 인증 사용자 | Redis Refresh Token 삭제 |

| Method | Endpoint | 권한 | 기능 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/accommodations` | `ADMIN` | 위치·편의시설·체크인/체크아웃 시간을 포함한 숙소 등록 |
| `PUT` | `/api/v1/accommodations/{accommodationId}` | `ADMIN` | 위치·편의시설·체크인/체크아웃 시간을 포함한 숙소 정보 수정 |
| `PATCH` | `/api/v1/accommodations/{accommodationId}/status` | `ADMIN` | 숙소 운영 상태 변경 |
| `POST`, `PUT` | `/api/v1/accommodations/{accommodationId}/booking-policy` | `ADMIN` | 숙소별 예약 가능 정책 등록·수정 |
| `POST`, `PUT` | `/api/v1/accommodations/{accommodationId}/cancellation-policy` | `ADMIN` | 숙소별 취소 정책 등록·수정 |
| `GET` | `/api/v1/accommodations/{accommodationId}` | 인증 사용자 | 숙소 단건 조회 |
| `GET` | `/api/v1/accommodations?city=서울특별시&region=강남구&accommodationAmenities=PARKING&roomAmenities=WIFI&checkInDate=2030-01-10&checkOutDate=2030-01-15&guestCount=2&minPrice=100000&maxPrice=200000&status=ACTIVE&available=true&sortBy=NAME&direction=ASC&page=0&size=20` | 인증 사용자 | 위치·편의시설·객실 조건·재고 기반 통합 검색 |
| `POST` | `/api/v1/accommodations/{accommodationId}/rooms` | `ADMIN` | 숙소 객실 등록 |
| `PUT` | `/api/v1/rooms/{roomId}` | `ADMIN` | 객실 정보 수정 |
| `PATCH` | `/api/v1/rooms/{roomId}/status` | `ADMIN` | 객실 운영 상태 변경 |
| `GET` | `/api/v1/rooms/{roomId}` | 인증 사용자 | 객실 단건 조회 |
| `GET` | `/api/v1/accommodations/{accommodationId}/rooms?minCapacity=2&minPrice=100000&maxPrice=200000&status=ACTIVE&amenities=WIFI&amenities=AIR_CONDITIONER&sortBy=NIGHTLY_PRICE&direction=ASC&page=0&size=20` | 인증 사용자 | 숙소별 객실 조건·편의시설·정렬·페이지 조회 |
| `GET` | `/api/v1/accommodations/{accommodationId}/rooms/available?checkInDate=2030-01-10&checkOutDate=2030-01-15&guestCount=2&page=0&size=20` | 인증 사용자 | 기간·인원 기준 예약 가능 객실 조회 |
| `POST` | `/api/v1/rooms/{roomId}/inventories` | `ADMIN` | 날짜별 객실 재고 등록(기본 `OPEN`) |
| `PUT` | `/api/v1/rooms/{roomId}/inventories/{inventoryDate}` | `ADMIN` | 전체 재고 수량·판매 상태 수정 |
| `GET` | `/api/v1/rooms/{roomId}/inventories?startDate=2030-07-01&endDate=2030-07-31` | `ADMIN` | 양끝 날짜를 포함하는 재고 Calendar 조회 |
| `POST` | `/api/v1/rooms/{roomId}/prices` | `ADMIN` | 날짜별 객실 가격 등록 |
| `PUT` | `/api/v1/rooms/{roomId}/prices/{stayDate}` | `ADMIN` | 날짜별 객실 가격 수정 |
| `GET` | `/api/v1/rooms/{roomId}/prices/{stayDate}` | 인증 사용자 | 날짜별 적용 가격과 기본 가격 fallback 조회 |
| `POST` | `/api/v1/reservations` | 인증 사용자 | 인증 회원의 객실 예약 생성 |
| `GET` | `/api/v1/reservations/{reservationId}` | 예약 소유자 | 본인 예약 단건 조회 |
| `GET` | `/api/v1/reservations?status=CONFIRMED&checkInFrom=2030-01-01&checkInTo=2030-12-31&checkOutFrom=2030-01-02&checkOutTo=2031-01-01&sortBy=CHECK_IN_DATE&direction=ASC&page=0&size=20` | 인증 사용자 | 본인 예약 조건·정렬·페이지 조회 |
| `GET` | `/api/v1/reservations/cursor?status=CONFIRMED&cursor=100&size=20` | 인증 사용자 | 본인 예약 ID 내림차순 Cursor 조회 (`cursor`는 첫 요청에서 생략) |
| `PATCH` | `/api/v1/reservations/{reservationId}` | 예약 소유자 | 본인 예약 체크인·체크아웃 일정 변경 |
| `PATCH` | `/api/v1/reservations/{reservationId}/cancel` | 예약 소유자 | 본인 예약 취소 |

`page`는 0부터 시작하고 `size`는 1 이상 100 이하만 허용합니다. 검색 조건을
생략하면 기존처럼 ID 오름차순 목록을 반환합니다. 숙소 정렬은 `ID`, `NAME`,
객실 정렬은 `ID`, `NAME`, `CAPACITY`, `NIGHTLY_PRICE`, 예약 정렬은 `ID`,
`CHECK_IN_DATE`, `CHECK_OUT_DATE`, `TOTAL_AMOUNT`만 허용하며 방향은 `ASC`,
`DESC`입니다. 숙소 통합 검색은 숙소명·구조화된 도시·지역·숙소 공용 편의시설·운영
상태와 활성 객실의 편의시설·수용 인원·기본 1박 가격, 기간 내 날짜별 재고 가용성을
선택적으로 조합합니다. 복수 편의시설은 모두 만족해야 하는 AND 조건이며 객실
조건은 하나의 활성 객실이 모두 만족해야 합니다.
날짜는 함께 전달해야 하며 날짜만 입력하면 `available=true`가 적용됩니다. 가격
조건은 날짜별 가격이나 숙박 총액이 아닌 객실 기본 1박 가격 기준입니다. 자세한
계약은
[`docs/architecture/accommodation-integrated-search.md`](docs/architecture/accommodation-integrated-search.md)에
정리되어 있습니다. 위치·편의시설 책임과 레거시 주소 호환 정책은
[`docs/architecture/accommodation-catalog.md`](docs/architecture/accommodation-catalog.md)에
정리되어 있습니다. 숙소별 객실 조회는 최소 수용 인원, 1박 최소·최대 가격,
`ACTIVE/INACTIVE` 상태와 객실 편의시설을 선택적으로 조합할 수 있습니다. 예약은
`CONFIRMED/CANCELLED` 상태와 체크인·체크아웃 날짜의
`From/To` 조건을 선택적으로 조합할 수 있으며 각 날짜 경계는 포함됩니다.
`From`과 `To`를 함께 전달하면 `From`은 `To` 이하여야 합니다. 모든 예약 목록
조건에는 JWT 회원 ID가 적용되므로 다른 회원의 예약은 반환되지 않습니다. 기존
예약 목록은 임의 정렬·페이지 번호·전체 건수가 필요한 화면을 위한 Offset 방식이며,
`/reservations/cursor`는 전체 Count 없이 `size + 1`건을 읽는 예약 이력 연속 조회용
Keyset 방식입니다. Cursor 조회의 정렬은 안정적인 `ID DESC`로 고정됩니다. 선택 근거와
MySQL 실행 계획은
[`Pagination Strategy`](docs/performance/pagination-strategy.md)에 정리되어 있습니다.

객실 등록 시 양수인 `nightlyPrice`가 필요하며 객실 응답에도 1박 가격이 포함됩니다.
날짜별 객실 가격도 양수만 등록할 수 있고 동일 객실·날짜는 하나만 존재합니다.
날짜별 가격이 있으면 `DAILY`, 없으면 객실 기본 가격과 `DEFAULT`를 적용 가격 조회
응답으로 반환합니다. 관리자는 판매 준비를 위해 비활성 객실에도 가격을 미리
설정할 수 있지만, 비활성 객실의 조회·예약 가능 여부는 기존 정책을 따릅니다.
예약 금액도 같은 fallback 규칙으로 모든 숙박일 가격을 합산합니다. 세부 정책은
[`docs/architecture/room-daily-price-policy.md`](docs/architecture/room-daily-price-policy.md)에
정리되어 있습니다.
숙소와 객실은 생성 시 `ACTIVE` 상태이며 관리자는 정보와 `ACTIVE/INACTIVE` 상태를
변경할 수 있습니다. `INACTIVE` 숙소 또는 객실은 예약 가능 객실 목록에서 제외되고
신규 예약 생성도 차단됩니다. 물리적으로 삭제하지 않으므로 기존 예약 이력과 예약
조회는 유지됩니다.
기존 개발 DB 객실은 Schema 갱신 시 `0.00`으로 보존됩니다. 예약 생성 시
`[checkInDate, checkOutDate)`의 숙박일마다 날짜별 가격을 적용하고, 없으면 객실
기본 가격으로 fallback합니다. `nightlyPriceSnapshot`은 계산 시점의 첫 숙박일
적용 가격이고 `totalAmount`는 모든 숙박일 가격의 합계입니다. 객실 또는 날짜별
가격이 이후 변경되어도 기존 예약 금액은 바뀌지 않습니다. 각 숙박일은
`ReservationNight`에 날짜와 적용 가격을 별도 Snapshot 행으로 저장하고 그 합계가
항상 `totalAmount`와 일치해야 합니다. 일정 변경 시 새 기간 전체를 현재 가격으로
다시 계산해 숙박일 Snapshot도 재구성합니다. 상세 결정은
[`ADR-004`](docs/adr/004-reservation-price-snapshot.md)에 정리되어 있습니다.
기존 개발 DB 예약의 금액 컬럼은 그대로 유지되며, 과거 숙박일별 가격은 정확히
복원할 수 없어 임의 Backfill하지 않습니다.

예약 가능 객실 조회는 체크인보다 체크아웃이 뒤이고 요청 인원이 1명 이상인
경우에만 수행됩니다. 특정 숙소의 `ACTIVE` 객실 중 수용 인원이 요청 인원 이상이고,
`[checkInDate, checkOutDate)`의 모든 숙박일에 `OPEN` 재고 행과 잔여 수량이 있는
객실을 반환합니다. 체크아웃 날짜의 재고는 조회·차감하지 않습니다. 관리자가 재고를
`CLOSED`로 변경해도 이미 생성된 예약과 예약 수량은 유지되며, 이후 신규 예약과
일정 변경에서 새로 점유할 날짜만 차단됩니다. 예약 가능 조회 결과는 예약 생성을
보장하지 않지만, 실제 예약 생성 시 Version 충돌을 감지해 동시 요청의 초과 예약을 방지합니다.

예약 생성 요청은 `memberId`를 받지 않고 JWT 인증 정보의 회원 ID를 사용합니다.
실제 대표 투숙객은 회원과 다를 수 있으므로 요청에서 이름·이메일·전화번호를 받고,
응답에는 내부 `reservationId`와 별도로 고객 문의·결제·알림용 공개
`reservationNumber`를 제공합니다. 공개번호 형식과 레거시 DB 적용 방식은
[`docs/erd/database-schema.md`](docs/erd/database-schema.md)에 정리되어 있습니다.
공개번호의 날짜 구간과 예약·취소 정책의 현재 날짜는 서버 기본 TimeZone이 아니라
숙소의 `timeZone`을 사용합니다. 체크인·체크아웃 시간도 해당 숙소 현지 시각이며
세부 기준은
[`Accommodation TimeZone Policy`](docs/architecture/accommodation-time-zone-policy.md)에
정리되어 있습니다.
예약 기간은 체크아웃 날짜를 점유하지 않는 `[checkInDate, checkOutDate)` 구간으로
처리하므로 기존 예약의 체크아웃 날짜와 다음 예약의 체크인 날짜가 같을 수
있습니다. 예약 생성은 모든 숙박일 재고의 존재와 잔여 수량을 검증한 뒤 날짜마다
객실 재고 한 개를 차감하며 Reservation 저장과 같은 Transaction에서 처리합니다.
예약 생성·취소는 필요한 숙박일만, 일정 변경은 이전·신규 숙박일의 합집합만 날짜
오름차순으로 조회합니다. `RoomInventory`의 `@Version`이 같은 재고를 수정하는
Transaction의 충돌을 Commit 시점에 감지합니다. 충돌은 `409 Conflict`와
`INVENTORY_011`로 응답합니다. 예약 생성은 충돌 시 새 Transaction에서 재고를 다시
조회하며 최초 시도 1회와 재시도 최대 2회까지만 수행합니다. Retry 후 재고가
소진됐다면 `INVENTORY_005`로 종료합니다. 예약 생성 전에
`reservation:lock:room:{roomId}` Redis Lock을 최대 3초 기다리고 30초의 고정
Lease와 소유 Thread 확인 후 Unlock을 사용합니다. 획득 대기 시간 초과나 대기 중단은
`409 / INVENTORY_012`, Redis 통신 장애는 `503 / INVENTORY_013`으로 응답하며
DB Lock으로 우회하지 않고 fail-fast합니다.

예약 조회와 취소는 JWT 인증 정보의 회원 ID를 기준으로 본인 예약에만 접근할 수
있습니다. `CONFIRMED` 예약의 일정 변경은 기존·신규 기간에 공통인 날짜의 차감은
유지하고, 빠지는 날짜의 재고를 반환하며 추가되는 날짜의 재고를 검증·차감합니다.
새 기간 전체의 날짜별 가격과 기본 가격 fallback을 변경 시점 기준으로 적용해
첫 숙박일 가격과 총액 Snapshot도 다시 계산합니다.
`CANCELLED` 예약의 일정은 변경할 수 없습니다. 예약 취소는 해당 숙소 TimeZone 기준
체크인까지 남은 일수와 예약 생성 당시 저장한 숙소별 취소 정책 Snapshot으로
수수료와 취소 가능 여부를 결정합니다. 숙소 정책이 없으면 기존의 7일 무료,
3~6일 30%, 1~2일 50%, 당일 이후 취소 불가 규칙을 Snapshot으로 사용합니다.
허용된 취소는 사용한 모든 숙박일 재고를 반환하고 상태를 `CANCELLED`로 변경합니다.
동일 Transaction에서 UTC 취소 시각, 실제 적용 수수료와 예상 환불액을 예약에
Snapshot으로 저장합니다. 환불액은 Payment 연동 전 예상값이며 실제 결제 취소·환불은
수행하지 않습니다. 세부 정책은
[`docs/architecture/reservation-cancellation-policy.md`](docs/architecture/reservation-cancellation-policy.md),
상태별 허용 동작과 전이 규칙은
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
│   ├── src/main/java/junsik/reservation/
│   │   ├── entity/
│   │   │   ├── accommodation/
│   │   │   ├── member/
│   │   │   ├── reservation/
│   │   │   └── room/
│   │   └── service/
│   │       ├── accommodation/
│   │       ├── auth/
│   │       ├── member/
│   │       ├── reservation/
│   │       └── room/
│   ├── src/test/
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradlew, gradlew.bat
├── frontend/
│   ├── src/                 # React 애플리케이션 진입점
│   ├── package.json
│   ├── pnpm-lock.yaml
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

`frontend`에는 React·TypeScript·Vite 실행 환경, Home/Not Found·회원가입·로그인 라우트,
공통 Layout·API Client·오류/인증 상태 기반과 테스트가 있습니다.
`infra`, `load-test`와 일부 `docs` 하위 디렉터리는 아직 placeholder 상태입니다.

---

## 6. 개발 로드맵

현재 Repository는 `backend/`와 `frontend/`를 함께 관리하는 Monorepo입니다.
`v*`는 Backend / Platform, `f*`는 Frontend Milestone입니다. 두 Track은
같은 Repository에서 별도로 관리하며 반드시 순차적으로 진행하는 것은 아닙니다.
Frontend는 React·TypeScript·Vite 기반 f0.1.0 Foundation을 완료했으며
`/signup` 회원가입과 `/login` 이메일/Google 로그인 화면, Header 로그아웃, 메모리 Access Token 기반 API 인증을
구현했습니다. Access Token 자동 재발급, Protected/Role Route와 로그인 후 원래 경로 복귀도
구현했습니다. `/reservations`는 USER/ADMIN, `/admin`은 ADMIN의 접근 확인 안내만 제공하며
실제 검색·예약·관리 화면과 새로고침 후 지속 인증 복원은 아직 없습니다.
GitHub의 `f0.1.0`은 Closed(7개 Issue 완료), `f0.2.0`은 Closed(8개 Issue 및
8개 PR 완료)입니다. 다음 Frontend Phase는 `f0.3.0`이며 `f0.3.0`~`f0.6.0`은 Open/Planned입니다.
인증 통합 테스트는 HTTP 경계를 Mock으로 대체합니다. 실제 Backend·Redis·Google을
연결한 브라우저 E2E는 별도 미검증이며 Milestone 완료와 구분합니다.

| 영역 | Milestone | 상태 | 이전 단계에서 이어지는 과제 |
| --- | --- | --- | --- |
| Backend Functional | v0.1.0 — Basic Reservation MVP | Completed | 회원·인증·기본 예약 흐름 |
| Backend Functional | v0.1.1 — Reservation Service Enhancement | Completed | 검색·가격·일정·상태·테스트 기반 |
| Backend Functional | v0.1.2 — Reservation Domain Completion | Completed | 날짜별 재고·가격과 순차 Transaction |
| Backend Functional | v0.1.3 — Booking Policy & Catalog Completion | Completed | 숙소 정책·판매 상태·Snapshot·Catalog·현지 날짜 |
| Backend Architecture | v0.2.0 — Concurrency Control | Completed | Redis Room Lock + Optimistic Version·제한 Retry 전략 확정 |
| Backend Architecture | v0.3.0 — Cache & Query Optimization | Completed | SQL·실행 계획·Index·Pagination·단건 Cache 최적화 |
| Backend Architecture | v0.4.0 — Event-Driven Processing | Completed | Kafka·Outbox·Consumer 멱등성·제한 Retry·DLT 및 예약 생명주기 통합 검증; 운영 Cleanup·외부 연동은 후속 과제 |
| Frontend | f0.1.0 — Frontend Foundation | Completed | React·TypeScript·Vite, Routing/Layout, API Client·오류/인증 상태 기반, 테스트·Frontend CI |
| Frontend | f0.2.0 — Authentication & User Flow | Completed | Signup·이메일/Google 로그인·메모리 Token Pair·single-flight 재발급·Logout·Protected/Role Route·통합 테스트; 지속 복원/Profile/E2E는 별도 과제 |
| Frontend | f0.3.0 — Accommodation Search & Booking | Next / Planned | 인증 기반 위에 검색부터 예약 생성까지 연결 |
| Frontend | f0.4.0 — Reservation Management | Planned | 예약 조회·변경·취소 UI |
| Frontend | f0.5.0 — Admin Management | Planned | 숙소·객실·정책·재고 관리 UI |
| Frontend | f0.6.0 — Frontend Integration & UX Completion | Planned | 사용자·관리자 End-to-End 검증 |
| Platform | v0.5.0 — Performance & Load Testing | Planned | 실제 사용자 Flow 기반 부하·병목 측정 |
| Platform | v0.6.0 — Observability & Reliability | Planned | 시스템 상태와 장애 징후의 지속 관측 |
| Production | v1.0.0 — Production Deployment | Planned | 검증된 Full-Stack 시스템 배포 |

### v0.1.3 완료 범위

* [x] 숙소별 최소·최대 숙박일과 최소·최대 사전 예약 **일수**
* [x] 조회·예약 생성·일정 변경의 Booking Policy 적용
* [x] 숙소별 Cancellation Policy와 예약 시점 정책 Snapshot
* [x] 관리자 재고 Calendar 및 `OPEN/CLOSED` 판매 상태
* [x] `ReservationNight` 숙박일별 가격과 취소 결과 Snapshot
* [x] 국가·도시·지역·상세 주소, 숙소/객실 편의시설과 AND 검색
* [x] 공개 예약번호, 대표 투숙객, 숙소 체크인·체크아웃 운영시간
* [x] IANA TimeZone 기반 비즈니스 날짜 및 UTC 이벤트 시각
* [x] H2 회귀 테스트와 MySQL 8.4 전체 흐름·Constraint·Rollback Baseline

예약 사이 준비 기간, 시간 단위 사전 예약 제한, 운영시간을 이용한 시각별 예약 마감은
구현 범위에 포함되지 않습니다. 운영시간과 TimeZone은 예약별 Snapshot이 아니며
예약 응답에 운영시간·TimeZone 필드를 추가하지 않습니다. 실제 결제 취소와 환불 실행도
아직 구현되지 않았습니다.

### v0.2.0 완료 범위

현재 Transaction은 재고 검증·증감과 예약·Snapshot 변경을 함께 처리하며, 동일
객실·숙박일 재고에는 JPA `@Version` 기반 Optimistic Lock을 적용합니다. 예약 생성은
Room 단위 Redis Distributed Lock으로 먼저 직렬화합니다. 조건부 원자 UPDATE는 아직
적용하지 않았습니다.

* [x] Lock 미적용 MySQL 동시 예약 Baseline
* [x] 성공·실패 수, 최종 재고와 예약 수로 Overselling 재현 여부 검증
* [x] Pessimistic Lock 적용 및 예약·일정 변경·Rollback 정합성 검증
* [x] Optimistic Lock 적용 및 Version 충돌·Rollback 검증
* [x] Optimistic Lock Retry 최대 횟수·새 Transaction 경계 및 최종 오류 정책
* [ ] v0.5.0 고충돌 환경의 Retry Backoff·Jitter 정책 비교
* [x] Redis Distributed Lock, 획득 대기·고정 Lease·안전한 Unlock·장애 응답 적용
* [x] 동일 재고·동시 요청 조건의 정합성·기본 실행 시간·복잡도 비교
* [x] Room 단위 Redis Lock + Optimistic Version·제한 Retry 전략 선정
* [x] 예약 생성 조정·Lock 구현·Retry·Transaction Domain 책임 분리 및 ADR 기록
* [x] 최종 전략의 동일 객실 다수 요청·다중 숙박일·여러 객실 통합 검증
* [x] v0.3.0 주요 조회 API Query 성능 기준 확보

주요 조회 API의 SQL·Query 수·Loading 수와 실행 시간 Baseline은
[`Read API Query Baseline`](docs/performance/read-api-query-baseline.md)에 기록했습니다.
숙소·객실 목록의 편의시설 N+1은 LAZY Collection Batch Fetch로 제거했습니다. 가용
재고를 포함한 주요 검색 실행 계획을 MySQL 8.4에서 검증하고 구조화 위치와 객실 후보
Composite Index를 적용했습니다. 상세 결과는
[`Search Query Execution Plan`](docs/performance/search-query-execution-plan.md)에
기록했습니다. 숙소·객실 단건 조회에는 Cache Aside 기반 Redis Cache를 적용했으며
대상 선정, TTL, Key 및 무효화 기준은
[`Redis Cache Strategy`](docs/performance/redis-cache-strategy.md)에 기록했습니다.
Command별 Cache 의존성과 Commit/rollback 정합성 정책은
[`Cache Invalidation Policy`](docs/architecture/cache-invalidation-policy.md)에
정리했습니다.
동시 Cache Miss와 Redis 장애·Timeout 시 Database fallback 정책은
[`Cache Resilience Policy`](docs/architecture/cache-resilience-policy.md)에
정리했습니다.
v0.3.0 Query·Index·Pagination·Cache 최적화의 동일 조건 최종 측정은
[`Query & Cache Optimization Comparison`](docs/performance/query-cache-optimization-comparison.md)에
기록했습니다.
최종 Production 조회 경로, Index·Pagination 결정, Cache 대상·Key·TTL·무효화·Fallback과
통합 회귀 테스트 Matrix는
[`Read Query and Cache Architecture`](docs/architecture/read-query-cache-architecture.md)에
정리했습니다. MySQL 8.4와 Redis 7.4를 함께 사용하는 통합 테스트로 검색·가용성·가격·
정책과 관리자 변경 이후 Database/Cache 정합성을 확인했습니다.
Kafka DLT 수동 Replay 도구, 원시 역직렬화 실패 격리, Outbox·처리 이력 Cleanup, k6,
Prometheus, Grafana, CD 및
Production 배포는 각 후속 Milestone에서 진행합니다. 예약 Event 계약과
Transactional Outbox·Producer·Consumer 전략은
[`Reservation Event Contract`](docs/architecture/reservation-event-contract.md)에
정리했습니다.

---

## 7. 성능 테스트

v0.5.0에서 Frontend와 Backend가 연결된 사용자 Flow를 대상으로 다음 항목을 측정할 예정입니다.
v0.2.0의 동시성 전략 비교 측정과 전체 서비스 부하 테스트는 별도 단계입니다.

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

테스트 결과와 분석 문서는 `docs/performance`에서 관리합니다. 현재 조회 성능 기준은
[`Read API Query Baseline`](docs/performance/read-api-query-baseline.md), 동시성 전략 비교는
[`Concurrency Strategy Comparison`](docs/performance/concurrency-strategy-comparison.md)에
기록되어 있습니다.

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
`docs/performance`에는 동시성 전략 및 조회 Query/Cache 비교 문서가 있습니다.
이는 전체 시스템 부하 테스트가 아닙니다. 문제 원인과 해결 과정은
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

**v0.4.0 — Event-Driven Processing**까지 기능 개발과 구조 검증을 완료했습니다.
Kafka 기반 예약 Event 계약, Transactional Outbox Publisher, Event ID 기반
Consumer 멱등 처리와 제한 Retry·DLT 실패 격리를
구성했습니다. 실제 예약 생성·일정 변경·취소에서 Outbox·Kafka·Consumer까지의
연속 흐름은 [`Reservation Event Contract`](docs/architecture/reservation-event-contract.md)의
통합 검증 경계에 정리했습니다. Broker/Producer 장애에서 Outbox 보존과 재발행,
Consumer Retry·DLT 및 중복 처리 방지 검증 범위는
[`Kafka Failure Scenarios`](docs/testing/kafka-failure-scenarios.md)에 정리했습니다.
운영 Broker 중단·복구 실험, DLT 수동 Replay 도구, Outbox·처리 이력 Cleanup과 외부 후처리
연동은 아직 구현되지 않았습니다. Frontend `f0.1.0` Foundation과
`f0.2.0 — Authentication & User Flow`도 완료했으며 다음 Frontend Phase는
`f0.3.0 — Accommodation Search & Booking`입니다.
Frontend와 Backend/Platform은 별도 Track입니다. 실제 사용자 Flow 기반
Performance Test는 필요한 UI 흐름과 연결된 뒤 수행할 계획이며,
Observability·Production도 계획 상태입니다.

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
* [x] MySQL·Redis·Kafka 로컬 Docker Compose 구성
* [x] CI Workflow 구성
* [x] 회원가입 및 비밀번호 해시 저장
* [x] Spring Security 및 JWT 인증 기반 구성
* [x] 이메일 로그인 및 JWT Access Token 발급
* [x] Google OAuth2 로그인 및 기존 회원 연결
* [x] 숙소 등록 및 페이지 기반 목록·단건 조회
* [x] 객실 등록 및 숙소별 페이지 목록·단건 조회
* [x] 인증 회원의 객실 예약 생성 및 날짜별 재고 기반 가용성 검증
* [x] 인증 회원의 예약 단건·페이지 목록 조회 및 상태 기반 취소
* [x] Backend와 MySQL 연동
* [x] Swagger UI 및 JWT Bearer 인증 기반 API 테스트 환경 구성
* [x] 회원가입부터 예약 취소까지 MVP 종단간 통합 테스트 구성
* [x] Backend와 Redis Refresh Token 저장 연동
* [x] 숙소·객실 단건 조회 Redis Cache 및 TTL·변경 무효화 적용
* [x] Query·Index·Pagination·Cache 최적화 전후 동일 조건 성능 비교
* [x] 최종 조회·Index·Pagination·Cache 구조 정리 및 MySQL·Redis 통합 Regression 검증
* [x] 운영 중인 객실의 기간·인원 기준 예약 가능 목록 조회
* [x] 숙소명 검색 및 객실 수용 인원·가격·상태 필터와 제한된 정렬
* [x] 예약 시점 객실 가격 Snapshot 및 숙박 일수 기반 총 금액 계산
* [x] 소유권·상태·날짜별 재고 검증을 적용한 예약 일정 변경
* [x] `CONFIRMED`·`CANCELLED` 예약 상태 전이 정책 및 도메인 예외 구성
* [x] 관리자 숙소·객실 정보 수정 및 비활성 리소스 신규 예약 차단
* [x] 본인 예약 상태·체크인·체크아웃 조건 조합 및 제한된 정렬·Pagination
* [x] 회원·숙소·객실·예약 DB 제약조건과 조회 패턴 기반 인덱스 검토
* [x] API Validation·HTTP Status·ErrorCode 및 Swagger 오류 응답 일관성 정리
* [x] 회원·숙소·객실·예약 Fixture와 공통 인증 테스트 지원 구조 구성
* [x] MySQL 8.4 Testcontainers 기반 Database Constraint 테스트 구성
* [x] 날짜별 객실 재고 Entity·Service 및 UNIQUE·CHECK 제약 구성
* [x] 예약 생성·취소·일정 변경·가용 객실 조회의 재고 Transaction 연동
* [x] 날짜별 객실 가격 Entity·관리 API 및 기본 가격 fallback 조회
* [x] 예약 생성·일정 변경의 숙박일별 가격 합산 및 금액 Snapshot 고도화
* [x] 예약 취소 정책·수수료 계산 및 재고 복구 연동
* [x] 숙소명·지역·기간·인원·가격·상태·예약 가능 여부 통합 검색
* [x] v0.1.2 전체 예약 흐름과 MySQL Transaction Rollback Baseline 검증
* [x] 숙소별 최소·최대 숙박일 및 사전 예약일 정책 관리·공통 검증
* [x] 숙소별 취소 정책 관리 및 예약 생성 시점 정책 Snapshot 보존
* [x] 관리자 재고 Calendar API 및 날짜별 `OPEN/CLOSED` 판매 상태 관리
* [x] 숙박일별 가격 행과 예약 취소 결과 Snapshot 영속화
* [x] 숙소 국가·도시·지역 구조화 및 숙소·객실 편의시설 관리·AND 검색
* [x] 외부 공개 예약번호·대표 투숙객 및 숙소 운영시간
* [x] 숙소별 IANA TimeZone 기반 날짜 정책과 UTC 취소 시각
* [x] v0.1.3 MySQL 전체 예약 흐름·Snapshot 재조회 Baseline
* [x] Lock 미적용 동시 예약 Race Condition 및 Overselling Baseline
* [x] MySQL Pessimistic Write Lock 기반 예약 재고 동시성 제어
* [x] RoomInventory Version 기반 Optimistic Lock 충돌 감지
* [x] 예약 생성 Optimistic Lock 제한 Retry 및 재고 재조회
* [x] Redisson Room 단위 Distributed Lock 기반 예약 생성 직렬화
* [x] v0.2.0 최종 동시성 전략 통합 Regression 및 Architecture Baseline 문서화
* [x] Kafka 개발 Broker·Spring Kafka 기본 설정과 예약 생명주기 Event 계약 구성
* [x] 예약 생성·일정 변경·취소 Transaction Commit 이후 Kafka Event 발행
* [x] 예약 Event Consumer Group·Event별 Handler·비동기 Audit Log Stub 구성
* [x] 예약 상태와 Event 저장 원자성을 위한 Transactional Outbox·재발행 구성
* [x] 영속 Event ID 처리 이력 기반 Consumer 중복 Skip·실패 Rollback 구성
* [x] Consumer 고정 Backoff 제한 Retry·Dead Letter Topic 실패 격리 구성
* [x] Reservation ID Key 기반 동일 예약 Event 순서 보장·다중 Partition 분산 검증
* [x] Kafka 발행 실패 시 Outbox 보존·재시도 및 Consumer Retry·DLT 시나리오 검증
* [x] 실제 예약 생성·일정 변경·취소부터 Outbox·Kafka·Consumer까지 통합 검증

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
REDIS_CONNECT_TIMEOUT=2s
REDIS_COMMAND_TIMEOUT=1s
KAFKA_PORT=9092
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CONSUMER_GROUP_ID=reservation-platform-reservation-post-processing-v1
KAFKA_CONSUMER_CONCURRENCY=3
KAFKA_RESERVATION_TOPIC=reservation.events.v1
KAFKA_RESERVATION_TOPIC_PARTITIONS=3
KAFKA_RESERVATION_TOPIC_REPLICATION_FACTOR=1
RESERVATION_KAFKA_ENABLED=true
RESERVATION_KAFKA_OUTBOX_ENABLED=true
RESERVATION_KAFKA_OUTBOX_SCHEDULING_ENABLED=true
RESERVATION_KAFKA_OUTBOX_PUBLISH_INTERVAL=1s
RESERVATION_KAFKA_OUTBOX_BATCH_SIZE=50
RESERVATION_KAFKA_OUTBOX_PUBLISH_TIMEOUT=5s
RESERVATION_CACHE_ENABLED=true
RESERVATION_DETAIL_CACHE_TTL=10m
RESERVATION_CACHE_MISS_LOCK_RETRY_INTERVAL=50ms
RESERVATION_CACHE_MISS_LOCK_TTL=5s
RESERVATION_LOCK_WAIT_TIME=3s
RESERVATION_LOCK_LEASE_TIME=30s
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
OAUTH2_FRONTEND_BASE_URL=http://localhost:5173
```

Google Cloud Console의 OAuth Client에는 로컬 Redirect URI로
`http://localhost:8080/login/oauth2/code/google`을 등록합니다. Backend 실행 후
Frontend `http://localhost:5173/login`의 Google 버튼에서 시작합니다. Backend는
Google Callback을 처리한 뒤 토큰 대신 60초짜리 일회용 코드를 Frontend
`/oauth2/callback`의 Fragment로 보내고, Frontend는 코드를 한 번 교환해 서비스 JWT
Access/Refresh Token을 받습니다. Google Client ID/Secret은 Backend에만 둡니다.

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
Kafka는 기본적으로 Host와 컨테이너의 `9092` 포트를 사용합니다. Backend는 프로젝트
루트 `.env`의 `MYSQL_PORT`, `REDIS_PORT`, `KAFKA_BOOTSTRAP_SERVERS` 값을 사용합니다.
Consumer Retry/DLT 기본값은 `KAFKA_CONSUMER_MAX_RETRIES=2`,
`KAFKA_CONSUMER_RETRY_BACKOFF=1s`,
`KAFKA_RESERVATION_DLT_TOPIC=reservation.events.v1.dlt`이며 DLT 발행 확인 제한은
`KAFKA_DLT_PUBLISH_TIMEOUT=5s`입니다. Reservation Event는 Reservation ID를 Kafka
Message Key로 사용해 동일 예약의 Event를 같은 Partition에서 순서대로 처리합니다.
기본 Listener concurrency는 3이며 `KAFKA_CONSUMER_CONCURRENCY`로 조정합니다.

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

Backend 기본 설정은 MySQL, Redis, Kafka를 사용하므로 애플리케이션 실행 전에 해당
컨테이너가 필요합니다. Backend는 프로젝트 루트의 `.env`를 로컬 설정으로
읽습니다. 다른 데이터베이스를 사용할 때는 `DB_URL`, `MYSQL_USER`,
`MYSQL_PASSWORD`를 실행 환경에서 재정의할 수 있습니다.

### Frontend 실행

Frontend는 Backend와 별도 pnpm 프로젝트입니다. Node.js 20.19 이상 또는 22.12 이상과
pnpm 11.19.0을 설치한 뒤 다음 명령을 실행합니다.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

기본 개발 주소는 `http://localhost:5173`입니다. Home/Not Found 화면은 Backend 없이
열 수 있지만 회원가입(`/signup`)과 로그인(`/login`)을 실제 제출하려면 Backend 및
개발 인프라가 필요합니다. 개발용 `/api` Proxy를 통해 Backend API를 호출합니다.
로그인 후 Access/Refresh Token은 브라우저 메모리에만 보관합니다. 보호 API 요청에
Bearer Header를 보내고 Access Token 만료·401 시 재발급 후 한 번 재시도합니다.
새로고침하면 익명 상태로 돌아갑니다. 로그아웃은 Backend에 Refresh Token 삭제를
요청한 뒤 현재 Tab의 Token을 지웁니다. 요청 실패 시에도 로컬 인증을 종료하고 서버
무효화가 확인되지 않았음을 알립니다. 기존 Access Token은 서버에서 만료 전까지 유효할
수 있습니다. 자세한 범위는
[`frontend/README.md`](frontend/README.md)에 정리했습니다.
Production 파일은 `pnpm build`로 `frontend/dist/`에 생성합니다. 환경별 API 주소와
로컬 `.env` 설정 방법은 [`frontend/README.md`](frontend/README.md)에
정리했습니다. `.env`에는 브라우저에 공개되어도 되는 값만 넣어야 합니다.
Home(`/`)와 미등록 경로의 Not Found 화면은 공통 Header/Main Layout 안에서 동작합니다.
실제 정적 호스팅에는 깊은 URL 요청을 `index.html`로 보내는 SPA Fallback이 필요합니다.

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

Frontend는 `frontend/`에서 다음 명령으로 코드 품질과 빌드를 각각 검증합니다.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Frontend GitHub Actions Workflow는 위 명령을 동일하게 실행합니다. 서식을 적용하는
`pnpm format`과 IDE 설정은
[`frontend/README.md`](frontend/README.md)에 정리했습니다.

인증 User Flow는 실제 Form·API Client·AuthProvider·Router를 HTTP 경계 Mock으로 함께
검증합니다. Token Utility·공유 타입과 f0.3.0 인증 확장 책임, 통합 테스트 범위 및 실제
Backend/Google 확인 절차는
[`Frontend Authentication User Flow`](docs/testing/frontend-authentication-flow.md)에 정리했습니다.
Mock 검증과 실제 Backend/Google·원격 CI 확인은 별도입니다.

#178 Frontend 숙소 검색·목록은 `/accommodations`에서 인증 후 사용합니다. 숙소명·도시·지역·
기간·인원·기본 1박 가격 조건과 페이지 이동, Loading/Error/Empty 상태를 제공합니다.
목록 응답에 없는 이미지/가격은 표시하지 않으며 카드에서 #180 숙소 상세 화면으로 이동합니다.
현재 Frontend HTTP Mock 검증과 실제 Backend 연동 검증은 구분합니다.
검색 계약·현재 Form 범위·수동 연결 절차는 [`frontend/README.md`](frontend/README.md)에 있습니다.

#179는 검색 조건·페이지·크기를 URL Query와 동기화합니다. 편의시설·운영 상태·예약 가능 여부·
정렬 방향을 추가로 선택할 수 있으며 검색 제출 시 Page를 초기화하고 History Navigation에서
조건을 복원합니다. 잘못된 URL 조건은 요청하지 않습니다. 새로고침 시 URL은 유지되지만
메모리 인증 방식상 재로그인이 필요하며 실제 Backend 연결 검증과 HTTP Mock 검증은 구분합니다.

#180은 숙소 상세와 객실 목록을 실제 DTO 기준으로 표시합니다. 객실 Capacity·기본 1박 가격·
편의시설·상태와 객실 페이지 이동을 제공하며 날짜별 가격·예약 가능 여부·예약 생성은 후속 범위입니다.
숙소 정책은 현재 조회 API가 없어 조회 제한만 안내합니다. 실제 Backend 연동 확인 절차와 자동 검증
경계는 [`frontend/README.md`](frontend/README.md)에 정리했습니다.

#181은 상세 화면에 날짜·인원 기반 가용 객실 조회 및 선택을 연결합니다. Backend 가용성 API를
기준으로 표시하며 날짜/인원/숙소 변경 시 결과와 선택을 초기화합니다. 재고 수량 계산·날짜별
가격/총액 조회·예약 생성은 수행하지 않습니다. HTTP Mock 검증과 실제 Backend 확인은 구분합니다.

#182는 선택 객실의 각 숙박일에 Backend 적용 요금을 조회하고 날짜별 출처와 단순 예상 합계를
예약 요약으로 표시합니다. 자체 fallback·세금·Add-on 정책은 없으며 최종 금액은 예약 생성 시
Backend가 다시 계산합니다. 일별 조회 합계는 가격 보장이나 원자적 기간 견적이 아닙니다.

#183은 가용 객실 선택에 대표 투숙객의 이름·이메일·연락처 입력과 제출 전 확인을 연결합니다.
Booking State는 Auth와 분리된 화면 메모리에만 유지하며 조건 변경·이탈·새로고침 시 폐기합니다.
실제 Backend DTO 필드만 다루고 예약 생성 API 호출은 후속 작업입니다.

#184는 예약 생성 POST와 인증된 `/reservations/{id}/complete` 결과 조회를 연결합니다.
서버 확정 금액·예약 번호를 표시하고 중복 클릭 및 불명 실패의 자동 재전송을 차단합니다.
HTTP Mock 흐름 검증과 실제 Backend 생성 확인은 별도이며 현재 내 예약 목록은 후속 범위입니다.

일반 API 통합 테스트는 격리된 H2 In-Memory DB를 사용하고, Database Constraint
테스트와 전체 예약 Baseline·Transaction Rollback 테스트는 개발 DB와 동일한
MySQL 8.4 Testcontainer를 사용합니다. 분산 락과 Cache 통합 테스트는 Redis 7.4
Testcontainer도 사용합니다. 전체 테스트와 빌드를 실행하려면 Docker
호환 Container Runtime이 실행 중이어야 하며, 테스트는 로컬 Docker Compose DB와
Volume을 사용하거나 변경하지 않습니다. Fixture 구성과 테스트 DB 선택 기준은
[`docs/testing/test-fixtures.md`](docs/testing/test-fixtures.md), v0.1.3의 전체 흐름과
동시성 적용 전 기준선은
[`docs/testing/reservation-domain-baseline.md`](docs/testing/reservation-domain-baseline.md)에
정리되어 있습니다. Lock 미적용·Pessimistic Lock·Optimistic Lock·Redis Distributed
Lock 적용 결과는
[`docs/testing/reservation-concurrency-baseline.md`](docs/testing/reservation-concurrency-baseline.md)에서
확인할 수 있습니다. 동일 조건의 전략별 정합성·기본 실행 시간 비교와 현재 전략
선정 근거는
[`Concurrency Strategy Comparison`](docs/performance/concurrency-strategy-comparison.md)에
정리되어 있습니다. 최종 Production 전략과 책임·Transaction 경계는
[`ADR-006`](docs/adr/006-reservation-concurrency-strategy.md)에 기록했습니다. 전체 예약
Flow의 동시성·Regression 검증 Matrix와 v0.3.0 진입 기준은
[`Concurrency Control Integration Baseline`](docs/testing/concurrency-control-integration.md)에서
확인할 수 있습니다.

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
