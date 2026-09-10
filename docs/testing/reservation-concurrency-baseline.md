# Reservation Concurrency Baseline

## 목적

이 문서는 이슈 #93에서 확인한 무잠금 예약 생성의 동시성 특성을 기록한다.
문제를 해결하는 Lock은 아직 적용하지 않고, 이후 비관적 Lock·낙관적 Lock·원자적
UPDATE·Redis 분산 Lock을 같은 조건에서 비교하기 위한 기준선을 제공한다.

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
Transaction을 사용한다. `CountDownLatch`로 요청 시작을 맞추고, 테스트 전용
Repository Proxy와 `CyclicBarrier`로 두 Transaction이 실제 재고 조회를 마친 뒤에
함께 진행하게 한다. 운영 Bean과 Query는 변경하지 않으며 테스트 종료 후 주입한
Proxy를 원래 Repository로 복구한다.

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

## 테스트가 고정하는 기준

이 테스트는 현재 결함을 의도적으로 보여 주는 Characterization Test다. Lock 전략을
적용하는 후속 이슈에서는 같은 Fixture와 동시 시작 조건을 유지하되 기대 결과를 아래와
같이 바꾸어 전후 차이를 비교한다.

```text
성공 예약 수 = total_quantity
실패 요청 수 = 동시 요청 수 - total_quantity
저장된 CONFIRMED Reservation 수 = total_quantity
reserved_quantity = total_quantity
available_quantity = 0
```

비교 시 성공·실패 수와 최종 재고뿐 아니라 같은 요청 수에서의 응답 시간, Retry 횟수,
Lock 대기·Timeout 및 Deadlock 여부도 함께 기록한다. 이 #93 Baseline 결과는 현재
구현이 동시성에 안전하다는 의미가 아니다.

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
