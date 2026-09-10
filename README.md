# Reservation Platform

[![Backend CI](https://github.com/K4RF/reservation-platform/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/K4RF/reservation-platform/actions/workflows/backend-ci.yml)

대규모 트래픽 환경에서 발생할 수 있는 **예약 충돌 문제를 해결하기 위한 예약 플랫폼**입니다.

단순한 예약 CRUD 구현에 그치지 않고, 동시성 제어, 캐싱, 이벤트 기반 아키텍처, 성능 테스트, 모니터링 및 CI/CD 환경을 단계적으로 구축하는 것을 목표로 합니다.

> **v0.1.0부터 v0.1.3 — Booking Policy & Catalog Completion까지** 기능 개발을
> 완료했으며, 다음 Backend Phase는 **v0.2.0 — Concurrency Control**입니다. Spring Boot 프로젝트,
> MySQL·Redis용 Docker Compose, Backend CI, 회원가입·이메일 로그인·Google
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
> 취소에는 MySQL Pessimistic Write Lock을 적용했습니다. 관리자는 숙소별 예약 가능 조건과 취소 정책을
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
예약 재고에는 첫 동시성 전략으로 DB 비관적 락을 적용했으며 다른 Lock 전략 비교와
비동기 이벤트는 후속 Roadmap 범위입니다.

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

### 비동기 이벤트 (예정)

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
| Persistence | Spring Data JPA Specifications, MySQL 8.4 | 회원·소셜 계정·숙소·객실·날짜별 재고·가격·예약 저장, 동적 조회 및 DB 제약조건 기반 정합성 보호 |
| Password | Spring Security Crypto | 회원 비밀번호 해시 저장 |
| Security | Spring Security 7.0.6 | Stateless 인증·인가 및 API 접근 규칙 |
| JWT | Spring Security OAuth2 JOSE | HS256 Access Token 발급·검증 |
| Social Login | Spring Security OAuth2 Client, Google | Google 계정 로그인 및 회원 연결 |
| Token Store | Spring Data Redis, Redis 7.4 | Refresh Token 저장·TTL·로그아웃 삭제 |
| API Documentation | Springdoc OpenAPI 3.0.3, Swagger UI | OpenAPI 명세 생성 및 브라우저 API 테스트 |
| Build | Gradle Wrapper 9.5.1 | 빌드 및 테스트 |
| Test | JUnit Platform, H2, Testcontainers 2.0.5, MySQL 8.4 | 단위·API 통합 테스트, 실제 DB 제약·전체 예약 Baseline·Rollback 검증 |
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

현재는 하나의 Spring Boot Application에서 Controller → Service → Entity/Repository
흐름으로 정책·재고·가격·Snapshot을 처리합니다. DTO는 도메인별 request/response
패키지로 분리되어 있습니다. 아래 그림의 Redis Lock/Cache와 Kafka는 **목표 아키텍처**입니다.
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

### 현재 인증·숙소·객실 가격·예약 API

| Method | Endpoint | 권한 | 기능 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | 공개 | Access/Refresh Token 발급 |
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
조건에는 JWT 회원 ID가 적용되므로 다른 회원의 예약은 반환되지 않습니다.

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
보장하지 않지만, 실제 예약 생성 시 재고 Row를 잠가 동시 요청의 초과 예약을 방지합니다.

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
오름차순으로 조회하고 `PESSIMISTIC_WRITE` Lock을 획득합니다. 같은 재고를 사용하는
Transaction은 앞선 Transaction 종료까지 대기한 뒤 최신 수량을 다시 검증합니다.

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

현재 Repository는 `backend/`와 `frontend/`를 함께 관리하는 Monorepo입니다.
`v*`는 Backend / Platform, `f*`는 Frontend Milestone이며 같은 Repository에서
아래 순서로 진행합니다. Frontend는 현재 placeholder이고 기술 스택은 미선정입니다.

| 영역 | Milestone | 상태 | 이전 단계에서 이어지는 과제 |
| --- | --- | --- | --- |
| Backend Functional | v0.1.0 — Basic Reservation MVP | Completed | 회원·인증·기본 예약 흐름 |
| Backend Functional | v0.1.1 — Reservation Service Enhancement | Completed | 검색·가격·일정·상태·테스트 기반 |
| Backend Functional | v0.1.2 — Reservation Domain Completion | Completed | 날짜별 재고·가격과 순차 Transaction |
| Backend Functional | v0.1.3 — Booking Policy & Catalog Completion | Completed | 숙소 정책·판매 상태·Snapshot·Catalog·현지 날짜 |
| Backend Architecture | v0.2.0 — Concurrency Control | Planned / Next | 동일 재고 동시 요청의 정합성 검증 |
| Backend Architecture | v0.3.0 — Cache & Query Optimization | Planned | SQL·실행 계획·Index 분석 후 Query/Cache 최적화 |
| Backend Architecture | v0.4.0 — Event-Driven Processing | Planned | 핵심 Transaction과 비동기 후처리 분리 |
| Frontend | f0.1.0 — Frontend Foundation | Planned | 공통 화면·Routing·API Client 기반 |
| Frontend | f0.2.0 — Authentication & User Flow | Planned | 인증 및 사용자 흐름 |
| Frontend | f0.3.0 — Accommodation Search & Booking | Planned | 검색부터 예약 생성까지 연결 |
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

### v0.2.0 진입 기준과 예정 작업

현재 Transaction은 재고 검증·증감과 예약·Snapshot 변경을 함께 처리하며, 동일
객실·숙박일 재고에는 MySQL Pessimistic Write Lock을 적용합니다. `@Version`, 조건부
원자 UPDATE와 Redis 분산 Lock은 아직 적용하지 않았습니다.

* [x] Lock 미적용 MySQL 동시 예약 Baseline
* [x] 성공·실패 수, 최종 재고와 예약 수로 Overselling 재현 여부 검증
* [x] Pessimistic Lock 적용 및 예약·일정 변경·Rollback 정합성 검증
* [ ] Optimistic Lock 및 Retry 비교
* [ ] Redis Distributed Lock, 획득 실패·Timeout 처리 검토
* [ ] 정합성·Latency·Throughput·구현/운영 복잡도 비교
* [ ] 최종 전략 선정과 v0.3.0 조회 성능 기준 확보

일부 기존 Index·실행 계획 검증은 구현되어 있지만, v0.3.0의 조회 성능 최적화와
Redis Cache는 아직 예정입니다. Kafka, k6, Prometheus, Grafana, CD 및 Production
배포도 각 후속 Milestone에서 진행합니다.

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

**v0.1.3 — Booking Policy & Catalog Completion**까지 기능 개발을 완료했습니다.
다음은 **v0.2.0 — Concurrency Control**이며 Query/Cache → Event-Driven →
Frontend(`f0.1.0`–`f0.6.0`) → Performance → Observability → Production 순서로 진행합니다.

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
* [x] 인증 회원의 객실 예약 생성 및 날짜별 재고 기반 가용성 검증
* [x] 인증 회원의 예약 단건·페이지 목록 조회 및 상태 기반 취소
* [x] Backend와 MySQL 연동
* [x] Swagger UI 및 JWT Bearer 인증 기반 API 테스트 환경 구성
* [x] 회원가입부터 예약 취소까지 MVP 종단간 통합 테스트 구성
* [x] Backend와 Redis Refresh Token 저장 연동
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
시작하며, 성공한 Callback 응답으로 서비스 JWT Access Token과 Refresh Token을 반환합니다.

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

일반 API 통합 테스트는 격리된 H2 In-Memory DB를 사용하고, Database Constraint
테스트와 전체 예약 Baseline·Transaction Rollback 테스트는 개발 DB와 동일한
MySQL 8.4 Testcontainer를 사용합니다. 전체 테스트와 빌드를 실행하려면 Docker
호환 Container Runtime이 실행 중이어야 하며, 테스트는 로컬 Docker Compose DB와
Volume을 사용하거나 변경하지 않습니다. Fixture 구성과 테스트 DB 선택 기준은
[`docs/testing/test-fixtures.md`](docs/testing/test-fixtures.md), v0.1.3의 전체 흐름과
동시성 적용 전 기준선은
[`docs/testing/reservation-domain-baseline.md`](docs/testing/reservation-domain-baseline.md)에
정리되어 있습니다. Lock 미적용 재현 결과와 Pessimistic Lock 적용 결과는
[`docs/testing/reservation-concurrency-baseline.md`](docs/testing/reservation-concurrency-baseline.md)에서
비교할 수 있습니다.

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
