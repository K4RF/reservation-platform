# Reservation Concurrency Baseline

## 목적

이 문서는 이슈 #93의 무잠금 예약 생성, 이슈 #94의 MySQL 비관적 락, 이슈 #95의
낙관적 락 결과를 함께 기록한다. 이후 Retry·원자적 UPDATE·Redis 분산 Lock을 같은
조건에서 비교하기 위한 기준선을 제공한다.

## 확인된 현재 Transaction 구조

`ReservationService.create`는 하나의 `@Transactional` 범위에서 다음 순서로 동작한다.

```text
회원·객실·정책 조회 및 검증
→ [check-in, check-out) RoomInventory 조회
→ 모든 날짜의 잔여 재고 검증
→ 영속 상태 Entity의 reservedQuantity 증가
→ 가격·취소 정책 Snapshot 생성
→ Reservation 및 ReservationNight 저장
→ Transaction Commit 시 RoomInventory UPDATE
```

순차 요청은 앞선 Transaction의 재고 차감을 다음 요청이 읽으므로 재고 부족을
정상적으로 거절한다. 그러나 `RoomInventory` 조회에는 비관적 Lock이 없고 Entity에
`@Version`도 없으며, 재고 조건을 포함한 원자적 UPDATE도 사용하지 않는다.

## 재현 조건

`ReservationConcurrencyBaselineIntegrationTest`는 개발용 Docker Compose DB나
Volume을 사용하지 않고 기존 `MySqlIntegrationTestSupport`의 일회용 MySQL 8.4
Testcontainer를 사용한다. 기존 Member·Accommodation·Room Fixture도 재사용한다.

| 항목 | 값 |
| --- | --- |
| 객실 | 동일 Room 1개 |
| 숙박일 | `[2036-01-10, 2036-01-11)` 1박 |
| `total_quantity` | 1 |
| 초기 `reserved_quantity` | 0 |
| 동시 예약 요청 | 2 |
| 반복 횟수 | 5 |

각 요청은 별도 Thread에서 실제 `ReservationService.create`를 호출하므로 각각 독립된
Transaction을 사용한다. #93 측정에서는 `CountDownLatch`로 요청 시작을 맞추고,
테스트 전용 Repository Proxy와 `CyclicBarrier`로 두 Transaction이 실제 재고 조회를
마친 뒤에 함께 진행하게 했다. 운영 Bean과 Query는 변경하지 않았다.

재고 조회 직후의 Barrier는 스레드 Scheduling에 따라 간헐적으로 결과가 달라지는
테스트를 방지하면서, 현재 코드에 존재하는 검증과 갱신 사이의 경쟁 구간을 그대로
재현하기 위한 장치다.

## 측정 결과

2026-09-10 로컬 실행에서 5회 모두 다음 결과가 관찰됐다.

| 지표 | 기대 정합성 | 실제 결과 |
| --- | --- | --- |
| 성공 예약 수 | 1 | 2 |
| 실패 요청 수 | 1 | 0 |
| 저장된 Reservation 수 | 1 | 2 |
| 최종 `total_quantity` | 1 | 1 |
| 최종 `reserved_quantity` | 1 | 1 |
| 최종 잔여 수량 | 0 | 0 |

두 Transaction은 모두 조회 시점의 `reserved_quantity = 0`을 기준으로 성공 판단을
내린다. 이후 각각 `reserved_quantity = 1`을 저장해 최종 재고 행만 보면 CHECK
Constraint를 만족하지만, 실제로는 수용 가능한 한 개보다 많은 두 개의 예약이
확정된다. 즉 재고 값 자체가 음수가 되는 형태가 아니라 마지막 쓰기가 앞선 쓰기를
덮는 Lost Update와 예약 건수 불일치 형태의 Overselling이다.

## #94 Pessimistic Write Lock 적용

`RoomInventoryRepository.findAllForUpdateByRoomIdAndInventoryDateIn`은
`@Lock(LockModeType.PESSIMISTIC_WRITE)`를 사용한다. JPQL은 요청한 객실과 숙박일
목록만 조회하며 `inventoryDate ASC`로 정렬한다.

#94 테스트에서는 조회 완료 Barrier를 제거했다. 첫 Transaction이 Lock을 획득한 뒤
Barrier에서 두 번째 Transaction을 기다리면, 두 번째 Transaction은 같은 Row Lock을
얻지 못해 테스트 자체가 교착되기 때문이다. 동시 시작 `CountDownLatch`는 유지하고
DB Lock이 요청을 직렬화하도록 한다.

- 예약 생성과 취소는 `[check-in, check-out)` 숙박일만 한 번에 잠근다.
- 일정 변경은 이전·신규 숙박일의 합집합을 중복 제거한 뒤 오름차순으로 한 번에
  잠근다. 서로 다른 순서로 Row를 점유하는 Schedule 변경 사이의 Deadlock 가능성을
  줄이기 위한 규칙이다.
- Lock 조회부터 재고 검증·증감, Reservation 변경까지 기존 Service Transaction을
  유지한다.
- 조회용 Repository 메서드는 잠그지 않으므로 관리 Calendar와 테스트용 단순 조회는
  별도 쓰기 Transaction을 요구하지 않는다.

동일한 재고 1개와 동시 요청 2건 조건을 5회 반복한 결과는 모두 다음과 같았다.

| 지표 | #93 무잠금 | #94 비관적 락 |
| --- | --- | --- |
| 성공 예약 수 | 2 | 1 |
| 재고 부족 실패 수 | 0 | 1 |
| 저장된 Reservation 수 | 2 | 1 |
| 최종 `reserved_quantity` | 1 | 1 |
| 최종 잔여 수량 | 0 | 0 |

3박의 여러 재고 Row에서도 한 요청만 전체 날짜를 점유하고 다른 요청은
`INVENTORY_005`로 실패했다. 일정 변경과 신규 예약이 같은 마지막 재고를 경쟁하는
경우에도 해당 날짜의 확정 예약과 `reserved_quantity`는 각각 1을 유지했다. 강제
Reservation 저장 실패 시 모든 날짜의 재고 변경이 Rollback되고, 같은 Row를 다시
비관적 Lock으로 조회해 수량 0과 Lock 해제를 확인했다.

## 테스트가 고정하는 기준

이 테스트는 #93에서는 결함을 보여 주는 Characterization Test였고, #94부터는 같은
Fixture와 동시 시작 조건에서 아래 정합성을 지키는 Regression Test다.

```text
성공 예약 수 = total_quantity
실패 요청 수 = 동시 요청 수 - total_quantity
저장된 CONFIRMED Reservation 수 = total_quantity
reserved_quantity = total_quantity
available_quantity = 0
```

향후 전략 비교 시 성공·실패 수와 최종 재고뿐 아니라 같은 요청 수에서의 응답 시간,
Retry 횟수, Lock 대기·Timeout 및
Deadlock 여부도 함께 기록한다. #94 테스트는 Pessimistic Lock의 정합성을 검증하지만
대규모 요청의 Throughput이나 운영 Lock Timeout 정책까지 검증한 결과는 아니다.

## Pessimistic Lock 장단점

- 장점: 충돌을 DB에서 직렬화하므로 Application Retry 없이 마지막 재고의 정합성을
  직접 보장하며, 기존 Transaction 경계를 유지할 수 있다.
- 단점: 충돌이 많을수록 Connection과 DB Row Lock 대기가 증가해 응답 시간과
  Throughput이 악화될 수 있다. 긴 Transaction, 서로 다른 Lock 순서, DB 설정에 따른
  Timeout·Deadlock도 운영 시 고려해야 한다.
- 현재 범위: 정합성 검증에 집중한다. Lock Timeout의 API Error 매핑, 부하 측정 및
  낙관적·분산 Lock과의 성능 비교는 후속 이슈 범위다.

## #94 검증 기록 (2026-09-10)

- 동시성·Rollback 집중 테스트: 8 tests, 0 failures, 0 errors, 0 skipped.
- 전체 Backend 테스트: 227 tests, 0 failures, 0 errors, 0 skipped.
- `gradlew.bat build -x test`: 성공.
- MySQL 테스트는 Testcontainer만 사용했으며 로컬 Docker Compose DB와 Volume은
  사용하거나 변경하지 않았다.

## #95 Optimistic Lock 적용

현재 활성 전략은 `RoomInventory.version`과 JPA `@Version`을 사용하는 낙관적 락이다.
#94의 `PESSIMISTIC_WRITE` 조회는 제거했으며, 필요한 숙박일을 날짜 오름차순으로
조회하는 범위와 Service Transaction 경계는 유지했다.

```text
Transaction A: inventory(version=0) 조회 → reservedQuantity 변경
Transaction B: inventory(version=0) 조회 → reservedQuantity 변경
Transaction A: UPDATE ... SET version=1 WHERE id=? AND version=0 → 성공
Transaction B: UPDATE ... SET version=1 WHERE id=? AND version=0 → 갱신 0건
→ ObjectOptimisticLockingFailureException → B 전체 Rollback
```

#95 테스트는 #93과 같은 테스트 전용 조회 Barrier를 사용해 두 Transaction이 동일
Version을 읽도록 고정한다. 조회 자체는 Row Lock을 보유하지 않으므로 두 요청 모두
Barrier에 도달할 수 있다. #95 시점에는 Retry를 적용하지 않아 충돌한 요청이 그대로
실패했다.

| 지표 | #93 무잠금 | #94 비관적 락 | #95 낙관적 락 |
| --- | --- | --- | --- |
| 성공 예약 수 | 2 | 1 | 1 |
| 실패 수 | 0 | 재고 부족 1 | 낙관적 충돌 1 |
| 저장된 Reservation 수 | 2 | 1 | 1 |
| 최종 `reserved_quantity` | 1 | 1 | 1 |
| 최종 잔여 수량 | 0 | 0 | 0 |

3박 예약 충돌에서는 실패 Transaction의 Reservation과 모든 숙박일 재고 변경이 함께
Rollback됐다. 일정 변경과 신규 예약의 충돌에서도 대상 날짜의 확정 예약과 예약
재고는 각각 1을 유지했다. 예약 취소는 재고를 반환하면서 Version을 증가시켰고,
기존 강제 저장 실패 테스트도 재고 0을 유지했다.

### 비관적 락과의 구조적 차이

| 항목 | Pessimistic Write Lock | Optimistic Lock |
| --- | --- | --- |
| 충돌 시점 | 조회 시 Row Lock 획득 | UPDATE 시 Version 비교 |
| 대기 방식 | 선행 Transaction 종료까지 DB에서 대기 | 조회는 진행하고 후행 Commit이 실패 |
| 실패 형태 | 최신 재고 재검증 후 비즈니스 오류 | `ObjectOptimisticLockingFailureException` |
| 장점 | Retry 없이 충돌 요청 직렬화 | 조회 중 Row Lock을 오래 유지하지 않음 |
| 비용 | 충돌 시 DB Connection·Lock 대기 | 충돌 시 Transaction 작업 Rollback·Retry 필요 |

#95에서는 충돌을 정확히 감지하고 정합성을 보장하는 데 집중했다. API는 낙관적
충돌을 `409 Conflict`와 `INVENTORY_011`로 응답했고, Retry는 #96에서 추가했다.

## #95 검증 기록 (2026-09-10)

- 전체 Backend 테스트: 230 tests, 0 failures, 0 errors, 0 skipped.
- `RoomInventory` Version 기본값·NOT NULL 제약은 MySQL 8.4에서 검증했다.
- MySQL 테스트는 Testcontainer만 사용했으며 로컬 Docker Compose DB와 Volume은
  사용하거나 변경하지 않았다.

## #96 Optimistic Lock Retry 정책

예약 생성 API는 `ReservationRetryService`를 진입점으로 사용한다. Retry Service에는
Transaction을 선언하지 않고, 각 시도에서 `@Transactional`인
`ReservationService.create`를 다시 호출한다. 낙관적 락 예외가 Service 프록시 밖으로
전달될 때 실패 Transaction은 이미 Rollback됐으므로 다음 호출은 새 Transaction과
새 영속성 Context에서 Inventory를 다시 조회한다.

적용 대상이 예약 생성 한 경로와 한 예외 유형으로 제한되어 있어 별도 Spring Retry
의존성이나 Annotation 대신 명시적인 유한 반복으로 정책을 구현했다. Retry 대상과
시도 횟수가 늘거나 공통 정책이 필요해지면 Spring Retry 도입을 다시 검토한다.

| 정책 | 결정 |
| --- | --- |
| Retry 대상 | `ObjectOptimisticLockingFailureException`만 |
| 최대 시도 | 총 3회: 최초 1회 + 재시도 2회 |
| Retry 간격 | 없음 |
| 재고 소진 | Retry하지 않고 `INVENTORY_005` 반환 |
| 한도 초과 | 마지막 충돌을 `409 / INVENTORY_011`로 반환 |
| 적용 범위 | 예약 생성 API |

고정 지연은 낮은 충돌 구간에도 불필요한 응답 지연과 요청 Thread 점유를 추가하므로
이번 단계에서는 사용하지 않는다. 고충돌 부하에서 즉시 Retry가 DB 부하를 키울 수
있는지는 이후 성능 측정에서 확인하고, 필요하면 Backoff와 Jitter를 비교한다.

MySQL 동시성 테스트는 두 요청이 동일 Version을 읽도록 첫 조회 두 건에만 Barrier를
적용한다. 재고가 2개이면 충돌한 요청이 새 Transaction에서 남은 재고를 읽고 성공해
예약 2건과 예약 수량 2개가 일치한다. 재고가 1개이면 충돌한 요청의 재시도는 최신
재고 0개를 확인하고 `INVENTORY_005`로 종료한다. 단위 테스트는 첫 Retry 성공,
3회 연속 충돌 후 종료, 비대상 비즈니스 예외의 즉시 전파를 검증한다.

## #96 검증 기록 (2026-09-13)

- 전체 Backend 테스트: 235 tests, 0 failures, 0 errors, 0 skipped.
- MySQL Retry 테스트는 Testcontainer만 사용했으며 로컬 Docker Compose DB와
  Volume은 사용하거나 변경하지 않았다.

## 실행 명령

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat test --tests junsik.reservation.service.ReservationConcurrencyBaselineIntegrationTest --rerun-tasks
```

macOS/Linux:

```bash
cd backend
./gradlew test --tests junsik.reservation.service.ReservationConcurrencyBaselineIntegrationTest --rerun-tasks
```

Docker 호환 Container Runtime이 실행 중이어야 한다.
