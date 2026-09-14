# Concurrency Strategy Comparison

## 목적과 범위

이 문서는 같은 객실 재고에 동시 예약이 집중될 때 다음 전략의 데이터 정합성과
기본 처리 특성을 비교합니다.

- Lock 미적용
- MySQL Pessimistic Lock
- JPA Optimistic Lock에 대응하는 Version 조건 갱신
- Optimistic Lock + 제한 Retry
- Redis Distributed Lock

이 비교는 전략 선택을 위한 작은 동시성 Probe입니다. 최대 TPS, 장시간 안정성,
Network 분리, Redis Failover, Application 다중 Instance의 실제 처리량은 측정하지
않으며 해당 범위는 v0.5.0 Performance & Load Testing에서 검증합니다.

## 공통 Scenario

`ReservationConcurrencyStrategyComparisonIntegrationTest`가 MySQL 8.4와 Redis 7.4
Testcontainer에서 다음 조건을 다섯 전략에 동일하게 적용합니다.

| 조건 | 값 |
| --- | --- |
| 재고 | 한 객실·한 날짜, 전체 수량 1개 |
| 동시 요청 | 10개 |
| 시작 방식 | 모든 Worker 준비 후 하나의 Latch로 동시 시작 |
| 반복 | 5회 |
| 성공 기준 | 재고 점유와 비교용 예약 행 저장 완료 |
| Overselling 기준 | 저장 예약 수 또는 예약 재고가 전체 수량 초과 |
| 측정 구간 | 시작 Latch 해제부터 모든 Worker 결과 회수까지 |

비교용 Table과 행은 Testcontainer 내부에만 생성합니다. 실제 Application Entity를
전략별로 변형하지 않기 위해 재고 수량·Version·예약 성공 수만 표현하는 Probe를
사용합니다. 실제 예약 Domain의 Snapshot, 정책, Transaction Rollback은 기존
`ReservationConcurrencyBaselineIntegrationTest`와
`ReservationDistributedLockIntegrationTest`가 별도로 검증합니다.

## 실행 결과

2026-09-14 Windows Docker Desktop에서 5회 실행한 결과입니다. 시간은 환경과
Warm-up에 민감하므로 절대 성능 보장이 아니라 같은 실행 내 기본 비교값입니다.

| 전략 | 성공 | 실패 | 저장 예약 | 최종 예약 재고 | Retry | Lock 실패 | Overselling | 실행 시간 중앙값 (범위) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Lock 미적용 | 10 | 0 | 10 | 1 | 0 | 0 | 발생 | 91.3ms (88.5–130.1ms) |
| Pessimistic Lock | 1 | 9 | 1 | 1 | 0 | 0 | 없음 | 28.0ms (27.2–40.2ms) |
| Optimistic Lock | 1 | 9 | 1 | 1 | 0 | 0 | 없음 | 29.2ms (27.7–32.7ms) |
| Optimistic + Retry | 1 | 9 | 1 | 1 | 9 | 0 | 없음 | 33.5ms (32.3–39.5ms) |
| Redis Distributed Lock | 1 | 9 | 1 | 1 | 0 | 0 | 없음 | 149.9ms (143.3–292.2ms) |

실패 원인은 Pessimistic Lock과 Redis Lock에서는 직렬화 후 확인한 재고 부족 9건,
Optimistic Lock에서는 Version 충돌 9건입니다. Optimistic + Retry는 첫 Version 충돌
9건을 새 Transaction에서 각각 한 번 재시도하고, 최신 재고가 소진된 것을 확인해
재고 부족으로 종료했습니다. Redis Lock의 획득 실패는 0건이었습니다.

## 전략별 해석

| 전략 | 장점 | 단점 | Database 의존성 | 다중 Instance 관점 |
| --- | --- | --- | --- | --- |
| Lock 미적용 | 구현과 처리 경로가 단순 | Lost Update로 예약 수와 재고가 불일치 | 낮지만 정합성 보장 없음 | Instance가 늘수록 Race 범위 확대 |
| Pessimistic Lock | DB가 순서를 강제하고 충돌 결과가 명확 | Lock 대기 중 DB Connection 점유, Deadlock·Timeout 고려 필요 | MySQL Lock 동작에 직접 의존 | 같은 DB를 쓰면 조정 가능하나 DB 부하 집중 |
| Optimistic Lock | 대기 Lock 없이 DB가 Lost Update 감지 | 충돌률이 높으면 Rollback과 실패 증가 | Version 조건 갱신에 의존 | 같은 DB를 쓰는 Instance 전체에서 충돌 감지 |
| Optimistic + Retry | 일시 충돌 뒤 최신 재고로 정상 판정 가능 | 고충돌 시 Transaction 재실행 비용 증폭 | Version과 새 Transaction 경계에 의존 | Application별 Retry가 동시에 증폭될 수 있음 |
| Redis Distributed Lock | DB Transaction 진입 전 다중 Instance 요청 직렬화 | Redis 왕복·운영 의존성, Lease와 장애 정책 필요 | 조정은 Redis, 최종 저장은 DB | 같은 Redis Key 규칙을 공유하면 Instance 간 조정 가능 |

Micro 결과에서 Redis가 가장 느렸다는 사실만으로 일반적인 처리량 우열을 결론 내릴
수 없습니다. 로컬 Container 왕복, Client Connection, 10개 요청의 극단적인 단일
Key 경합이 모두 포함됐고 표본도 5회뿐입니다. 반대로 Pessimistic Lock의 짧은 시간도
장시간 Transaction에서의 DB Connection 점유 비용을 대표하지 않습니다.

## 현재 전략 선택

현재 예약 생성은 Room 단위 Redis Lock으로 동일 객실 요청이 DB Transaction에
동시에 진입하는 빈도를 낮추고, 안쪽에서는 `RoomInventory.version`과 최대 2회
Retry를 최종 정합성 방어로 유지합니다.

선택 근거는 다음과 같습니다.

1. 무락 방식은 동일 조건에서 명확한 Overselling을 만들었습니다.
2. Pessimistic Lock은 정합성을 보장하지만 대기 중 DB Connection을 점유합니다.
3. Optimistic Lock만 사용하면 단일 잔여 재고 경합에서 요청 9개가 Version 충돌로
   종료됩니다.
4. 제한 Retry는 최신 재고를 다시 읽어 충돌을 재고 부족이라는 Domain 결과로
   정규화하지만, 고충돌 환경에서는 비용이 증가합니다.
5. Redis Lock은 현재 Probe에서 Lock 실패 없이 DB 진입을 직렬화했습니다. Redis가
   실패하면 DB Lock으로 우회하지 않고 `503 / INVENTORY_013`으로 fail-fast합니다.

이 조합도 모든 Writer가 같은 Lock Key 규칙을 사용해야 하는 Advisory Lock입니다.
일정 변경·취소·관리자 재고 갱신에는 Redis Lock이 적용되지 않으므로 DB Version은
계속 필요합니다.

이 결과를 바탕으로 확정한 운영 구조, 대안별 비용과 Transaction 경계는
[`ADR-006`](../adr/006-reservation-concurrency-strategy.md)에 기록했습니다. 비교용
다섯 전략은 이 Testcontainer Probe 안에만 있으며 Production 호출 경로에는 런타임
전략 분기가 없습니다.

## 재현 방법

Windows PowerShell:

```powershell
cd backend
.\gradlew.bat test --tests junsik.reservation.service.ReservationConcurrencyStrategyComparisonIntegrationTest --rerun-tasks
```

macOS/Linux:

```bash
cd backend
./gradlew test --tests junsik.reservation.service.ReservationConcurrencyStrategyComparisonIntegrationTest --rerun-tasks
```

Test 결과 XML의 `Concurrency strategy comparison` 로그에 각 반복의 성공·실패,
저장 예약, 최종 재고, Retry, Lock 실패와 실행 시간이 남습니다.

## 검증 기록

- 비교 테스트 5회: 모든 회차 성공
- 전체 Backend 테스트: 256 tests, 0 failures, 0 errors, 0 skipped
- GitHub Actions와 같은 `./gradlew test`, `./gradlew build -x test` 단계 성공
- 새 Dependency와 Application 실행 설정 변경 없음
- 비교 테스트는 기존 singleton MySQL 8.4·Redis 7.4 Testcontainer 지원을 재사용하며,
  GitHub Actions의 Redis 7.4 Service와 포트 구성을 변경하지 않음

## v0.5.0 후속 측정

- 충분한 Warm-up과 반복 횟수
- Application 다중 Instance
- 실제 HTTP 예약 Flow와 JWT 인증 비용
- 동시 요청 수와 잔여 재고 비율 변화
- 평균·P95·P99 Latency, Throughput, Error Rate
- DB Connection Pool, CPU, Memory, Redis 지표
- Redis 지연·중단·Failover와 Lease 만료
- Retry Backoff·Jitter 유무 비교
