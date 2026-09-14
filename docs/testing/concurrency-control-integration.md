# Concurrency Control Integration Baseline

## 목적

v0.2.0에서 확정한 `Redis Room Lock + RoomInventory Optimistic Lock + 제한 Retry`
운영 경로를 전체 예약 기능의 기존 테스트와 함께 검증한 기록입니다. 새 테스트를
중복해서 만들지 않고 기존 검증을 체크리스트에 연결했으며, 기존 테스트에 없던 다수
요청의 다중 숙박일 경합과 서로 다른 객실의 Lock 독립성만 추가했습니다.

## 최종 운영 경로

```text
ReservationController
→ ReservationCreationCoordinator
→ RedisReservationCreationLock (roomId 단위)
→ ReservationRetryService
→ @Transactional ReservationService.create
→ RoomInventory @Version
```

구체적인 선택 근거와 대안은
[`ADR-006`](../adr/006-reservation-concurrency-strategy.md), 동일 조건 전략 비교값은
[`Concurrency Strategy Comparison`](../performance/concurrency-strategy-comparison.md)에
기록되어 있습니다.

## 통합 검증 Matrix

| 검증 대상 | Test | 확인 내용 |
| --- | --- | --- |
| 동일 객실 직렬화 | `ReservationDistributedLockIntegrationTest.serializesConcurrentReservationsForTheSameRoom` | 첫 요청이 Lock 안에 있는 동안 두 번째 요청이 Transaction에 진입하지 않음 |
| 재고 1개·다수 요청·여러 날짜 | `ReservationDistributedLockIntegrationTest.keepsMultiNightInventoryConsistentWhenTenRequestsCompeteForOneRoom` | 3박 재고에 10개 요청 시 예약 1건만 성공하고 모든 날짜 예약 수량이 1로 일치 |
| 여러 객실 | `ReservationDistributedLockIntegrationTest.usesIndependentLocksForDifferentRooms` | 서로 다른 `roomId`가 별도 Lock으로 동시에 임계 구역에 진입하고 각각 성공 |
| Optimistic 충돌·Retry | `ReservationConcurrencyBaselineIntegrationTest` | 새 Transaction Retry, 재고 소진 변환, 여러 날짜 Rollback, 일정 변경과 생성 충돌 |
| 취소·Inventory 복구 | `ReservationConcurrencyBaselineIntegrationTest.cancellationRestoresInventoryAndIncrementsVersion` | 취소 후 수량 복구와 Version 증가 |
| 저장 실패 Rollback | `ReservationInventoryRollbackIntegrationTest` | 예약 저장 실패 시 모든 숙박일 재고 변경 Rollback |
| Lock Timeout·Lease·해제 | `ReservationDistributedLockIntegrationTest` | 대기 Timeout, 고정 Lease 만료, 작업 실패 후 소유 Lock 해제 |
| 전략별 동일 조건 비교 | `ReservationConcurrencyStrategyComparisonIntegrationTest` | No Lock, Pessimistic, Optimistic, Retry, Redis의 정합성과 기본 실행 시간 |

## 기존 기능 Regression

| 범위 | 검증 Test / 환경 |
| --- | --- |
| 순차 예약 생성·조회·일정 변경·취소 | `BasicReservationMvpIntegrationTest`, H2 |
| Booking Policy와 현지 날짜 | `BookingPolicyReservationIntegrationTest`, `AccommodationBookingPolicyTimeZoneTest`, H2 |
| Cancellation Policy와 Snapshot | `CancellationPolicySnapshotIntegrationTest`, `ReservationCancellationPolicyTest`, H2 |
| Daily Price와 숙박일별 가격 Snapshot | `RoomDailyPriceIntegrationTest`, `ReservationPriceSnapshotTest`, H2 |
| MySQL 전체 예약 흐름 | `BookingPolicyCatalogBaselineIntegrationTest`, MySQL 8.4 Testcontainer |
| DB 제약과 Transaction 차이 | `DatabaseConstraintIntegrationTest`, MySQL 8.4 Testcontainer |

H2는 빠른 API·정책 Regression에 사용하고, DB Lock, Version 충돌, Transaction
Rollback, MySQL 제약은 MySQL Testcontainer에서 검증합니다. Redisson 동작은 Redis
7.4 Testcontainer를 함께 사용하며 개발 Docker Compose DB와 Volume을 변경하지
않습니다.

## Race Condition에서 최종 전략까지

1. Lock 없는 Baseline에서 예약 10건과 예약 재고 1개가 남는 Overselling을
   재현했습니다.
2. Pessimistic Lock과 Optimistic Lock이 초과 예약을 막는 것을 검증했습니다.
3. Optimistic 충돌만 반환하지 않고 새 Transaction에서 최대 두 번 재시도하도록
   제한했습니다.
4. 같은 객실 예약 생성을 Redis에서 먼저 직렬화하고 DB Version을 최종 방어로
   유지했습니다.
5. 최종 운영 경로에서 단일·다중 숙박일, 동일·서로 다른 객실, Timeout과 Rollback을
   검증했습니다.

## Troubleshooting 검토

- Spring Context가 Redis 연결 실패로 연쇄 실패하면 CI Redis 7.4 Service의 Health
  Check와 테스트 설정의 `localhost:6380`을 먼저 확인합니다.
- `INVENTORY_012`가 증가하면 Room 단위 Key 경합과 3초 Wait Time을 확인합니다.
- `INVENTORY_013`은 DB fallback 대상이 아니라 Redis 연결·가용성 장애 조사
  대상입니다.
- `INVENTORY_011`은 세 번 연속 Optimistic 충돌이므로 Redis Lock 우회 Writer,
  30초 Lease 만료 또는 일정 변경·관리자 재고 변경과의 경합을 확인합니다.
- 현재 테스트에서 새 장애는 발견되지 않았으므로 별도 장애 Runbook은 만들지 않고,
  위 항목을 후속 운영 문서 후보로 남깁니다.

## v0.3.0 진입 Baseline

- 예약 정합성 경계는 `RoomInventory.version`, 예약 생성 조정 경계는 Room 단위 Redis
  Lock으로 고정되어 Query 최적화가 이 불변식을 바꾸지 않아야 합니다.
- 현재 조회는 Spring Data JPA Specification과 검토된 관계형 Index를 사용하며 Redis
  Cache는 적용하지 않았습니다.
- #99의 실행 시간은 단일 Key 동시성 전략 비교값이며 조회 성능 Baseline이 아닙니다.
- v0.3.0에서는 대표 Dataset 크기, 실제 SQL과 실행 계획, Query 수, 평균·P95 응답
  시간을 먼저 기록한 뒤 Index·Query·Cache 변경 전후를 비교해야 합니다.

## 검증 기록 (2026-09-14)

- `ReservationDistributedLockIntegrationTest`: 6 tests, 모두 성공
- 전체 Backend 테스트: 258 tests, 0 failures, 0 errors, 0 skipped
- 새 Dependency와 Application·Docker·GitHub Actions 실행 설정 변경 없음
- MySQL 8.4·Redis 7.4 Testcontainer만 사용했으며 로컬 Docker Compose 데이터와
  Volume은 변경하지 않음

## 실행 명령

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat test --tests junsik.reservation.service.reservation.ReservationDistributedLockIntegrationTest --rerun-tasks
.\gradlew.bat test --tests junsik.reservation.service.reservation.ReservationConcurrencyBaselineIntegrationTest --rerun-tasks
.\gradlew.bat test --tests junsik.reservation.service.reservation.ReservationInventoryRollbackIntegrationTest --rerun-tasks
.\gradlew.bat test
.\gradlew.bat build -x test
```

macOS/Linux에서는 `gradlew.bat` 대신 `./gradlew`을 사용합니다.
