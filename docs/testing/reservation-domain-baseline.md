# Booking Policy & Catalog Completion Baseline

## 목적

`BookingPolicyCatalogBaselineIntegrationTest`는 기존 v0.1.2 Baseline을 확장하여 v0.1.3의 핵심 도메인
규칙이 실제 MySQL 8.4와 전체 HTTP 요청 흐름에서 함께 동작하는 기준선을
검증합니다. 각 오류 경계와 세부 계산을 다시 복제하지 않고 기존 단위·기능별 통합
테스트를 유지하며, 이 테스트는 기능 사이의 연결과 최종 상태를 담당합니다.

## 검증 시나리오

동일 UTC 시각 `2035-06-08T03:00:00Z`의 고정 Clock으로 전체 흐름을
`Asia/Tokyo`와 `America/New_York`에서 각각 실행합니다. 실제 DateProvider와
예약번호 생성기를 사용하며 현지 날짜는 각각 6월 8일, 6월 7일입니다.
일정 변경 후 취소까지 남은 날짜는 각각 3일, 4일이며 둘 다 저장된 30% 구간입니다.
조회 전에 flush/clear하여 숙박일 및 정책 Snapshot을 DB에서 다시 읽습니다.

v0.1.3에서는 다음 검증을 기존 MySQL 흐름에 추가했습니다.

- 숙소 Booking Policy(2~5박) 및 Cancellation Policy를 관리 API로 생성
- 위치·숙소/객실 복수 편의시설·기간·가격 조건을 함께 검색
- 운영시간과 TimeZone 조회, 재고 생성·판매 중지·Calendar 조회 및 CLOSED 예약 거부
- 공개 예약번호 형식, 대표 투숙객, 숙박일별 가격 Snapshot 조회
- 예약 후 숙소 수수료를 80/90%로 수정해도 일정 변경·취소 시 기존 30/50% 유지
- UTC 취소 시각, 수수료·환불 Snapshot 조회 및 날짜별 재고 복구

Booking Policy 거절과 일정 변경 실패 전 재고 보존은 기존
`BookingPolicyReservationIntegrationTest`, 저장 실패의 실제 Transaction Rollback은
`ReservationInventoryRollbackIntegrationTest`가 담당합니다. 기존 세부 테스트를 유지합니다.

```text
사용자 회원가입·로그인 / 관리자 로그인
→ 관리자 숙소·객실·날짜별 가격 생성
→ 날짜별 객실 재고 준비
→ 숙소 통합 검색과 예약 가능 객실 조회
→ 날짜별 가격과 기본 가격 fallback 조회
→ 객실 최대 수용 인원으로 예약 생성
→ 날짜별 가격 합계·가격 Snapshot·재고 차감 확인
→ 본인 예약 단건·조건 목록 조회
→ 예약 일정 변경
→ 새 기간 가격 재계산과 겹침/해제/추가 재고 확인
→ 체크인 3일 전 취소와 30% 수수료 확인
→ CANCELLED 상태와 전체 재고 복구 확인
```

Baseline의 고정 가격과 예상 결과는 다음과 같습니다.

| 단계 | 숙박 기간 | 적용 가격 | Snapshot | 총액 |
| --- | --- | --- | --- | --- |
| 예약 생성 | `[2035-06-10, 2035-06-13)` | 120,000 + 140,000 + 100,000 | 120,000 | 360,000 |
| 일정 변경 | `[2035-06-11, 2035-06-15)` | 140,000 + 100,000 + 100,000 + 100,000 | 140,000 | 440,000 |
| 취소 | 체크인 3일 전 | 30% 수수료 | 수수료 132,000 | 예상 환불 308,000 |

객실 수용 인원과 예약 인원은 모두 4명으로 두어 경계값을 포함합니다. 객실 재고는
날짜마다 한 개이며 예약 후 1, 일정 변경에서 제외된 날짜는 0, 추가된 날짜는 1,
취소 후 전체 날짜가 0인지 JDBC로 직접 확인합니다.

## 기존 테스트와의 역할 분리

| 검증 범위 | 담당 테스트 |
| --- | --- |
| MySQL 기반 v0.1.3 전체 성공 흐름 | `BookingPolicyCatalogBaselineIntegrationTest` |
| 빠른 기본 회원·숙소·객실·예약 연결 | `BasicReservationMvpIntegrationTest` |
| 인원·재고·기간·가격·상태별 성공/실패 경계 | `ReservationIntegrationTest` |
| 숙소 복합 조건과 결과 없음·Pagination·정렬 | `AccommodationIntegratedSearchIntegrationTest` |
| 취소 수수료 구간과 반올림 | `ReservationCancellationPolicyTest`, `ReservationIntegrationTest` |
| 예약 저장 실패 시 재고 Transaction Rollback | `ReservationInventoryRollbackIntegrationTest` |
| MySQL FK·UNIQUE·CHECK와 검색 실행 계획 | `DatabaseConstraintIntegrationTest` |

`ReservationInventoryRollbackIntegrationTest`도 MySQL Testcontainer를 사용합니다.
예약 저장을 강제로 실패시킨 뒤 같은 Transaction에서 먼저 변경된 모든 날짜별
재고가 0으로 복원되는지 확인합니다.

## 데이터베이스와 테스트 격리

- 일반 단위·API 통합 테스트는 H2 MySQL 호환 모드를 사용합니다.
- DB 고유 동작과 Baseline·Rollback 테스트는 일회용 MySQL 8.4 Testcontainer를
  사용합니다.
- `MySqlIntegrationTestSupport`가 테스트 JVM에서 컨테이너 하나를 시작하고 JDBC
  URL·사용자·비밀번호·MySQL 드라이버를 동적 속성으로 제공합니다.
- MySQL 테스트 클래스는 같은 컨테이너를 공유하되 Spring Context 시작 시
  `ddl-auto=create`로 Schema를 다시 만들고, 테스트 데이터는 Transaction Rollback
  또는 명시적인 정리로 격리합니다.
- 개발자 Docker Compose MySQL, `.env`, 기존 데이터와 Volume은 사용하지 않습니다.

## v0.2.0 동시성 기준선

현재 Baseline이 보장하는 범위는 단일 요청 또는 순차 요청입니다.

- 예약 생성·일정 변경·취소의 Reservation과 여러 날짜 재고 변경은 하나의 DB
  Transaction에서 성공하거나 함께 Rollback됩니다.
- 재고 감소 전 `reserved_quantity < total_quantity`를 확인하지만 조회한 재고 행에
  비관적 Lock을 걸지 않습니다.
- Entity에 `@Version`이 없고 재고 갱신 Query에도 조건부 원자 연산이 없습니다.
- Redis는 Refresh Token 저장에만 쓰이며 예약 경로에는 분산 Lock이 없습니다.
- 따라서 같은 객실·날짜·마지막 재고를 여러 Transaction이 동시에 읽으면 둘 다
  성공 판단을 내릴 수 있는 Race Condition 가능성이 남아 있습니다.

v0.2.0에서는 동일한 Fixture와 MySQL 지원을 사용해 마지막 재고 한 개에 동시 요청을
보내고, 성공 수·실패 수·최종 `reserved_quantity`를 먼저 측정합니다. 그 결과를
DB Lock과 Redis 분산 Lock 적용 전 Baseline으로 사용합니다. 이 문서는 현재 구현이
동시성에 안전하다는 의미가 아닙니다.

## API와 ERD 일치 확인

- OpenAPI 통합 테스트는 숙소 통합 검색, 객실 가용성, 날짜별 가격, 예약 생성·조회·
  일정 변경·취소 요청과 응답 Schema를 확인합니다.
- `docs/erd/database-schema.md`의 Member, Accommodation, Room, RoomInventory,
  RoomDailyPrice, Reservation 관계와 Snapshot·재고 제약은 현재 Entity 매핑과
  일치합니다.
- 숙박일별 `reservation_nights`, 취소 결과, 대표 투숙객, 공개 예약번호와 숙소
  TimeZone은 현재 Entity/Schema에 반영되어 있습니다. 결제 취소·환불과 동시성
  Lock은 후속 범위입니다.

## 실행 명령

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat test --tests junsik.reservation.BookingPolicyCatalogBaselineIntegrationTest
.\gradlew.bat test --tests junsik.reservation.service.ReservationInventoryRollbackIntegrationTest
.\gradlew.bat clean test
.\gradlew.bat build
```

macOS/Linux:

```bash
cd backend
./gradlew test --tests junsik.reservation.BookingPolicyCatalogBaselineIntegrationTest
./gradlew test --tests junsik.reservation.service.ReservationInventoryRollbackIntegrationTest
./gradlew clean test
./gradlew build
```

MySQL 기반 테스트를 포함하므로 전체 실행에는 Docker 호환 Container Runtime이
필요합니다.

Backend GitHub Actions는 PR과 `develop`에서 `./gradlew test` 후
`./gradlew build -x test`를 실행하므로 로컬 검증과 같은 테스트 범위를 사용합니다.
실제 원격 CI 결과는 이 브랜치를 Push하고 PR을 생성한 뒤 확인해야 합니다.

## #83 검증 기록 (2026-09-10)

- `gradlew.bat test build`: 220 tests, 0 failures, 0 errors, 0 skipped.
- 기존 OpenAPI/Swagger, MySQL Constraint 및 Rollback 테스트를 포함합니다.
- 원격 CI: 이번 브랜치는 아직 Push하지 않았으므로 이번 커밋의 실행 결과는 미확인입니다.
- Notion [예약 생성 명세](https://app.notion.com/p/3c33bbc0582a813a92aed9abf4412c80)는
  직접 읽어 대조한 결과 현재 구현과 불일치합니다. 요청의 필수 `representativeGuest`,
  응답의 `reservationNumber`, `nights`, `cancellationPolicySnapshot`, 취소 결과 필드가
  빠져 있고 Booking Policy 오류와 `INVENTORY_009`도 반영이 필요합니다.
  Notion 전체 명세의 일치나 동기화 완료를 의미하지 않습니다.
- 기존 ERD 문서에는 숙박일 Snapshot, 대표 투숙객, 공개번호, 취소 결과와 숙소
  TimeZone이 반영되어 있습니다. DB 제약 검증은 일회용 MySQL 8.4에서 수행했습니다.
