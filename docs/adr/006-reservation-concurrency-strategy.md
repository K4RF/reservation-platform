# ADR-006: Redis 직렬화와 Optimistic Lock을 예약 생성 전략으로 채택

## 상태

Accepted

## 배경

동일 객실 재고에 동시 요청이 집중되면 재고와 예약 수가 달라지는 Overselling을
방지해야 합니다. 단일 Application Instance뿐 아니라 여러 Instance가 같은 MySQL을
사용하는 환경도 고려해야 하며, 예약의 재고 검증·차감과 예약 저장은 하나의
Transaction으로 유지되어야 합니다.

#99 비교 Probe는 MySQL 8.4와 Redis 7.4에서 재고 1개에 동시 요청 10개를 다섯 번
실행했습니다. Lock 미적용은 매번 예약 10건과 예약 재고 1개가 남아 정합성이
깨졌습니다. Pessimistic Lock, Optimistic Lock, Optimistic Retry, Redis Lock은 모두
예약 1건과 예약 재고 1개를 유지했습니다. 이 결과는 작은 로컬 Probe이며 최대 TPS나
실제 다중 Instance 처리량을 뜻하지 않습니다.

## 결정

- 예약 생성의 운영 진입점은 `ReservationCreationCoordinator` 하나로 고정합니다.
- `ReservationCreationCoordinator`는 Room 단위 `ReservationCreationLock`을 획득한
  뒤 `ReservationCreator`를 실행합니다.
- 운영 `ReservationCreationLock` 구현은 `RedisReservationCreationLock`입니다. 모든
  Instance는 같은 Redis와 `reservation:lock:room:{roomId}` Key 규칙을 공유합니다.
- Lock 내부에서는 `ReservationRetryService`가 `@Transactional`인
  `ReservationService.create`를 호출합니다. 낙관적 충돌 시 새 Transaction으로 최대
  두 번 재시도합니다.
- `RoomInventory.version`의 JPA Optimistic Lock을 최종 정합성 방어로 유지합니다.
  일정 변경·취소·관리자 재고 변경처럼 Redis 예약 생성 Lock을 거치지 않는 Writer도
  같은 Version으로 충돌을 감지합니다.
- Redis 장애 시 Pessimistic Lock으로 전환하지 않고 `503 / INVENTORY_013`으로
  fail-fast합니다. 서로 다른 조정 방식을 동시에 허용하지 않습니다.
- 비교용 No Lock, Pessimistic Lock 및 대체 전략 구현은 Production Service에 분기를
  추가하지 않고 `ReservationConcurrencyStrategyComparisonIntegrationTest` 안에만
  둡니다.

운영 호출과 Transaction 경계는 다음과 같습니다.

```text
ReservationController
→ ReservationCreationCoordinator                 (Transaction 없음)
→ ReservationCreationLock                         (Redis Lock 획득)
→ ReservationRetryService                         (Transaction 없음, 최대 3회 시도)
→ ReservationService.create                       (@Transactional)
→ Commit 또는 Rollback 완료
→ Redis Lock 해제
```

`ReservationService`는 회원·객실·정책·재고·가격·예약이라는 Domain 규칙과 하나의
Transaction에 집중합니다. Redis Key, 대기 시간, Lease, 소유권 확인과 Redis 예외
변환은 `RedisReservationCreationLock`이 담당합니다.

## 대안

| 전략 | 정합성·충돌 특성 | DB 부하 | 다중 Instance | 구현·장애 처리 |
| --- | --- | --- | --- | --- |
| Pessimistic Lock | 충돌 요청을 DB Row에서 직렬화 | 대기 중 Connection과 Row Lock 점유 | 같은 DB에서 동작 | Deadlock과 Lock Timeout 정책 필요 |
| Optimistic Lock만 사용 | Lost Update 감지, 충돌 요청 즉시 실패 | 대기는 없지만 실패 Transaction Rollback | 같은 DB에서 충돌 감지 | 단순하지만 충돌을 Domain 결과로 정규화하지 못함 |
| Optimistic Lock + Retry | 최신 재고로 재검증 | 고충돌 시 Transaction 재실행이 증폭 | 각 Instance의 Retry가 동시에 몰릴 수 있음 | 횟수·Backoff·최종 오류 정책 필요 |
| Redis Lock만 사용 | 같은 Key Writer를 Transaction 전에 직렬화 | DB 동시 진입 감소 | 같은 Redis와 Key 규칙 필요 | Redis 운영·Lease·통신 장애를 처리해야 하며 우회 Writer에 취약 |
| Redis Lock + Optimistic Retry | 사전 직렬화와 DB 최종 충돌 감지를 함께 사용 | Redis 왕복이 추가되지만 DB 경합을 앞단에서 제한 | 공유 Redis로 조정하고 DB Version으로 방어 | 구성 요소가 늘지만 책임과 실패 정책을 분리 가능 |

Pessimistic Lock은 별도 Redis 없이 정합성을 보장하지만, 경합 대기를 DB Connection과
Transaction 안에서 감당합니다. 현재 프로젝트는 Refresh Token 저장으로 Redis를 이미
운영하며 다중 Instance 예약 생성을 DB Transaction 전에 조정하려는 목적이 있으므로
마지막 대안을 선택합니다.

## 결과와 한계

Controller와 Domain Service는 Redisson API를 알지 않으며, 선택한 Lock 구현은
`ReservationCreationLock` 경계 뒤에 위치합니다. Lock이 해제되기 전에 Transaction의
Commit 또는 Rollback이 완료되고, 각 Retry는 새 Transaction과 영속성 Context에서
재고를 다시 읽습니다.

Redis는 예약 생성의 가용성 의존성이 됩니다. 고정 30초 Lease가 Transaction보다 먼저
끝나면 다른 요청이 진입할 수 있으므로 DB Version이 계속 필요하고, Lease는 운영
Transaction 시간보다 길어야 합니다. Room 단위 Key는 겹치지 않는 기간도 직렬화하며,
일정 변경·취소에는 Redis Lock이나 Retry가 적용되지 않습니다.

이번 결정은 #99의 제한된 정합성 Probe를 근거로 합니다. 다중 Instance HTTP 부하,
P95/P99, Redis Failover, Lease 만료 중 작업, Retry Backoff·Jitter는 v0.5.0 성능 및
신뢰성 검증에서 다시 측정합니다.
