# Kafka 장애 및 Event 처리 실패 검증

이 문서는 Issue #136의 장애·복구 체크리스트와 현재 자동 테스트가 확인하는 범위를
정리합니다. 테스트는 예약 DB Transaction과 Kafka Outbox/Consumer 처리 경계를 각각
검증하며, 실제 운영 Broker를 중단하지 않습니다.

## 검증 시나리오

| 장애/복구 시나리오 | 검증 위치 | 확인 결과 |
| --- | --- | --- |
| Reservation 생성·변경·취소와 Outbox 원자성 | `BasicReservationMvpIntegrationTest`, `ReservationOutboxTransactionIntegrationTest` | 예약 상태와 재고가 정상 완료된 경우 Event Outbox 행도 같은 DB Transaction에 저장되고, 테스트 profile에서는 발행 전 `PENDING` 상태로 남습니다. Rollback 시 Outbox도 함께 Rollback됩니다. |
| Producer가 Broker 오류를 비동기 반환 | `ReservationOutboxKafkaIntegrationTest` | 발행 시도 후 상태가 `PENDING`으로 남고 오류/시도 횟수가 저장됩니다. 같은 Event를 다음 Poll에서 재시도해 Embedded Kafka ACK를 받으면 `PUBLISHED`가 됩니다. |
| Producer가 Future를 반환하기 전에 동기 오류 발생 | `ReservationOutboxPublisherTest`, `KafkaReservationEventProducerTest` | 예외가 예약 경로에 전파되지 않고 Outbox Publisher가 기록하여 해당 Event를 `PENDING`으로 보존합니다. |
| Consumer의 일시적 처리 오류 | `ReservationEventRetryDltIntegrationTest` | 같은 Record가 제한 횟수만큼 재시도되고 처리 성공 뒤 Event ID ledger가 기록됩니다. |
| Consumer 오류가 제한 횟수 내 복구되지 않음 | `ReservationEventRetryDltIntegrationTest` | Event가 원래 Key와 Payload 및 실패 Header를 보존해 같은 번호의 DLT Partition으로 이동합니다. 실패 Event의 ledger는 생성되지 않고 이후 Record 처리가 계속됩니다. |
| 재시작 후 같은 Event 재전달 | `ReservationEventConsumerIntegrationTest`, `ReservationEventIdempotencyIntegrationTest` | H2/Embedded Kafka 경로에서 Consumer 멱등 Service를 다시 구성해도 영속 Event ID가 중복 Handler 실행을 막습니다. MySQL Testcontainers 테스트는 재시작·동시성·Handler Rollback을 추가 검증합니다. Handler가 실패하면 ledger가 Rollback되어 재전달로 재시도할 수 있습니다. |
| 동일 Reservation lifecycle 순서 | `ReservationEventPartitionOrderingIntegrationTest` | 같은 Reservation의 Created, Changed, Cancelled가 한 Partition에서 연속 offset으로 발행되고 Consumer Handler 순서도 유지됩니다. |
| 실제 예약 생명주기에서 Kafka 후처리까지 | `ReservationLifecycleEventIntegrationTest` | 세 예약 Command가 각각 Commit한 Outbox Snapshot을 발행하고, 순서대로 Consumer Handler와 영속 Event ID 처리 이력에 도달합니다. 최종 예약 취소·재고 복구는 Consumer 실행 전부터 확정됩니다. |

## 범위와 한계

Broker 미가용 동작은 Integration Test에서 Producer의 완료된 실패 Future로 재현하고, 이어서
같은 Outbox 행을 Embedded Kafka로 성공 발행해 복구를 검증합니다. 이는 Outbox의 오류 처리와
복구 동작을 검증하지만 실제 Broker 프로세스를 정지·복구하는 운영 장애 실험은 아닙니다.
실제 Broker 장애의 연결 감지 시간, Kafka Client 재연결 시간, 장시간 장애 중 Outbox 적체 및
운영 복구 절차는 별도 환경에서 확인해야 합니다.

정상적인 예약 핵심 Transaction은 Kafka 전송을 동기 호출하지 않습니다. 예약 상태/재고와
Outbox Event를 하나의 Database Transaction에 기록한 뒤 Publisher가 별도로 전송하므로,
Broker 오류는 이미 Commit된 예약 응답을 되돌리지 않습니다. Outbox Publisher 장애는 Event를
`PENDING`으로 유지하고 다음 Poll에서 다시 시도합니다.

Kafka 통합 테스트의 Embedded Kafka 및 H2는 외부 Docker Compose Broker나 개발 DB를
사용하지 않습니다. MySQL 기반 Event ID ledger 재시작/동시성 테스트는 Testcontainers를
사용하므로 전체 backend 테스트에는 Docker 호환 Container Runtime이 필요합니다.

로컬에서 Kafka 통합 테스트가 실패하면 먼저 `@EmbeddedKafka`와 테스트별 고유 Consumer
Group/인메모리 DB 설정을 확인합니다. 일반 테스트가 외부 `localhost:9092`에 연결을
시도한다면 `backend/src/test/resources/application.yaml`의 Kafka 비활성화 설정이
테스트 Classpath에 적용됐는지 확인해야 합니다. 발행은 성공했는데 Consumer 확인이
실패한다면 Source/DLT Topic 이름, Reservation ID Key, JSON 역직렬화 설정과
`processed_reservation_events` 처리 이력을
순서대로 확인합니다. CI의 Redis는 별도 Service Container이고 MySQL/Redis 통합 테스트는
격리된 Testcontainers를 사용합니다. Compose Volume을 정리해 문제를 우회하지 않습니다.
