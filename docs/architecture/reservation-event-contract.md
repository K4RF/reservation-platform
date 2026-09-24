# Reservation Event Contract

## 1. 범위

이 문서는 v0.4.0 Event-Driven Processing의 예약 생명주기 Event 계약과 Kafka 개발
환경, Transactional Outbox 발행 흐름과 Consumer의 비동기 후처리 책임을 정의합니다.

현재 예약 생성·일정 변경·취소의 핵심 Transaction은 기존처럼 MySQL에서 동기적으로
완료됩니다. 같은 Transaction이 예약 상태와 발행할 Event의 Outbox 행을 함께
Commit하고, 별도 Outbox Publisher가 이를 Kafka Topic에 전달합니다. Consumer는 세
Event를 역직렬화해 Event별 Handler로 전달하고, 현재는
내부에서 검증 가능한 구조화 Audit Log를 비동기 후처리 Stub으로 남깁니다. 외부 알림·
메일, 통계 집계와 자동 DLT 재처리는 포함되지 않습니다. Consumer는 영속 처리 이력으로
같은 Event ID의 재전달을 제거하고, 제한된 동일 Partition Retry 뒤에도 실패한 Event를
Dead Letter Topic으로 격리합니다.

## 2. 현재 동기 처리 흐름

- 생성은 `ReservationCreationCoordinator`가 Room 단위 Redis Lock을 획득한 뒤
  `ReservationRetryService`를 통해 `ReservationService.create`의 새 Transaction을 최대
  3회 시도합니다. 이 Transaction 안에서 재고 차감, 숙박일별 가격 Snapshot 구성,
  Reservation 저장이 함께 Commit됩니다.
- 일정 변경은 `ReservationService.updateSchedule`의 한 Transaction에서 기존·신규 기간
  재고를 조정하고 가격 Snapshot과 Reservation 일정을 함께 변경합니다.
- 취소는 `ReservationService.cancel`의 한 Transaction에서 수수료를 계산하고 재고를
  복구한 뒤 Reservation 상태와 취소 결과 Snapshot을 함께 변경합니다.

Event는 이 핵심 흐름을 대체하지 않습니다. `ReservationService`는 상태 변경 뒤 같은
Transaction에서 `OutboxReservationEventPublisher`를 호출합니다. Publisher는 Kafka를
직접 호출하지 않고 직렬화한 Event를 `reservation_outbox_events`에 `PENDING`으로
저장합니다. 예약 Transaction이 Rollback되면 Outbox 행도 함께 Rollback됩니다.

## 3. Topic

| 항목 | 개발 환경 값 | 근거 |
| --- | --- | --- |
| Topic | `reservation.events.v1` | 예약 Aggregate의 생명주기 Event를 하나의 Versioned Topic으로 관리 |
| Message Key | Reservation ID의 문자열 표현 | 같은 예약의 순서를 동일 Partition에서 유지 |
| Partition | `3` | 로컬에서 병렬 소비와 Key 기반 순서를 함께 검증할 수 있는 최소 개발 기준 |
| Replication Factor | `1` | 단일 Broker인 로컬 Docker Compose 전용 값 |
| Auto Creation | 비활성화 | 애플리케이션의 `NewTopic` 선언을 Topic 설정의 기준으로 사용 |

Topic 이름, Partition 수, Replication Factor는 각각
`KAFKA_RESERVATION_TOPIC`, `KAFKA_RESERVATION_TOPIC_PARTITIONS`,
`KAFKA_RESERVATION_TOPIC_REPLICATION_FACTOR`로 재정의할 수 있습니다. 운영 환경의
Broker 수와 가용성 요구에 맞춰 Replication Factor를 별도로 정해야 합니다.

## 4. 공통 Metadata

모든 Event는 Entity를 직접 직렬화하지 않고 다음 Metadata와 Event별 Payload로
구성합니다.

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `eventId` | UUID | 중복 Event를 식별할 수 있는 Event 고유 ID |
| `occurredAt` | UTC `Instant` | 비즈니스 상태 변경이 발생한 시각 |
| `aggregateType` | String | 고정값 `RESERVATION` |
| `aggregateId` | Long | Reservation PK이자 Kafka Message Key의 원본 |
| `eventType` | Enum | `RESERVATION_CREATED`, `RESERVATION_CHANGED`, `RESERVATION_CANCELLED` |
| `schemaVersion` | Integer | Payload 계약 Version, 현재 `1` |

`eventId`는 Consumer 멱등성 처리의 식별자입니다. 같은 생명주기 Event가 Outbox 재발행,
Kafka 재전달 또는 Consumer 재시작 뒤 다시 도착해도 최초 성공 처리만 Handler로
전달합니다.

## 5. Event별 Payload

### ReservationCreated

- 공개 예약번호, 회원 ID, 객실 ID
- 투숙 인원, 체크인·체크아웃 날짜
- 예약 시점 총액 Snapshot

### ReservationChanged

- 공개 예약번호, 회원 ID, 객실 ID
- 변경 전·후 체크인·체크아웃 날짜
- 변경 후 총액 Snapshot

### ReservationCancelled

- 공개 예약번호, 회원 ID, 객실 ID
- 체크인·체크아웃 날짜, 취소 시각
- 적용된 취소 수수료와 예상 환불액

Event에는 JPA 연관관계, 비밀번호, JWT, 내부 Lock Version 등 후속 처리에 필요하지
않은 Entity 상태를 포함하지 않습니다. Consumer가 필요한 값은 계약에 명시적으로
추가하고 `schemaVersion` 호환성을 검토합니다.

## 6. Producer와 Consumer 기본 설정

- Producer는 JSON으로 직렬화하고 `acks=all`, idempotence를 사용합니다.
- Consumer는 별도 Group ID를 사용하고 자동 Commit을 끕니다.
- 기본 Group ID는 `reservation-platform-reservation-post-processing-v1`입니다. 같은
  Group의 Application Instance는 Topic Partition을 나눠 처리합니다.
- Listener의 기본 Ack Mode는 Record 단위입니다.
- Consumer 처리 실패는 기본 1초 간격으로 최대 2회 재시도합니다. 최초 시도까지 합치면
  총 3회이며 `KAFKA_CONSUMER_MAX_RETRIES`, `KAFKA_CONSUMER_RETRY_BACKOFF`으로 조정합니다.
- DLT는 `reservation.events.v1.dlt`이며 원본 Topic과 같은 3개 Partition을 선언합니다.
  이름과 발행 확인 제한은 `KAFKA_RESERVATION_DLT_TOPIC`,
  `KAFKA_DLT_PUBLISH_TIMEOUT`으로 조정합니다.
- JSON 역직렬화 허용 Package는 Reservation Event Package로 제한합니다.
- 일반 Test Profile에서는 Kafka와 Outbox Scheduling을 끄므로 기존 단위·통합 테스트는
  외부 Broker에 의존하지 않습니다. Kafka 통합 테스트만 Embedded Kafka를 명시적으로
  활성화해 Outbox 발행, 실제 JSON 직렬화·역직렬화와 Listener Routing을 검증합니다.

## 7. 발행 결과와 실패 정책

1. Reservation Transaction 안에서 Entity와 분리된 Event Snapshot을 만들고 Outbox에
   `PENDING`으로 저장합니다.
2. Transaction Commit 뒤 Scheduler가 생성 시각과 ID 순으로 미발행 Event를 조회합니다.
3. `KafkaTemplate`의 Broker Acknowledgement를 제한 시간 안에 받은 경우에만
   `PUBLISHED`, `publishedAt`으로 갱신합니다.
4. 직렬화·전송·Timeout 실패는 시도 횟수, 마지막 시각과 오류를 기록하되 상태를
   `PENDING`으로 유지합니다. 다음 Polling에서 다시 처리할 수 있습니다.
5. 성공과 실패 모두 Event ID, Type, Reservation ID를 기록하며 개인정보 Payload는
   Logging하지 않습니다. Kafka 장애는 이미 Commit된 예약 API 응답을 바꾸지 않습니다.

따라서 DB Commit 성공 뒤 Kafka가 일시적으로 실패해도 발행할 Event 자체를 잃지
않습니다. 반대로 예약 Transaction이 Rollback되면 Outbox도 없어져 Kafka로 발행되지
않습니다.

## 8. Consumer와 비동기 후처리

```text
reservation.events.v1
  -> ReservationEventConsumer
  -> ReservationEventIdempotencyService
  -> processed_reservation_events UNIQUE(event_id)
  -> ReservationEventHandlerRegistry
  -> Created / Changed / Cancelled Handler
  -> ReservationEventAuditLogService
  -> 실패: DefaultErrorHandler -> 제한 Retry -> reservation.events.v1.dlt
```

- `ReservationEventConsumer`는 Kafka Record 수신, Reservation ID Message Key 검증,
  수신·성공·중복 Skip·실패 Logging과 멱등 처리 진입만 담당합니다.
- `ReservationEventIdempotencyService`는 Event ID 처리 이력을 영속 Database에서
  확인합니다. 처리 Transaction은 `processed_reservation_events` INSERT를 Flush한 뒤
  Handler를 호출하며 두 작업을 함께 Commit합니다.
- `event_id` UNIQUE 제약이 같은 Event의 동시 처리도 직렬화합니다. 먼저 성공한
  Transaction이 Commit되면 나머지 요청은 UNIQUE 충돌을 기존 처리 이력으로 확인하고
  Handler를 다시 호출하지 않습니다. 선행 처리가 실패해 Rollback되면 대기 중인 요청이
  이력을 저장하고 처리할 수 있습니다.
- `ReservationEventHandlerRegistry`는 세 Event Type별 Handler가 정확히 하나씩
  등록됐는지 Application 시작 시 검증합니다.
- 각 Handler는 구체 Event Type을 확인한 뒤 후처리 Service를 호출합니다. 현재 후처리는
  Event ID, Type, Reservation ID, 공개 예약번호만 남기는 비영속 Audit Log Stub입니다.
  회원 이메일·전화번호 같은 개인정보는 Logging하지 않습니다.
- 동일 Reservation ID가 Message Key이므로 같은 예약의 Event는 같은 Partition에
  배치되어 Kafka Partition 순서를 따릅니다.

Handler 또는 후처리 Service에서 예외가 발생하면 Consumer는 실패 식별 정보를 남기고
예외를 Listener Container에 다시 전달합니다. 처리 이력 INSERT도 같은 Transaction에서
Rollback하므로 실패한 처리를 성공으로 기록하지 않으며,
Producer가 이미 Reservation Transaction Commit 이후 Event를 전송하므로 Consumer의
성공·실패가 완료된 예약 Transaction을 Rollback하거나 API 응답을 변경하지 않습니다.

현재 후처리는 비영속 Audit Log Stub입니다. 이후 Handler가 Database를 변경할 때는 같은
Transaction에 참여해야 이력과 부수 효과가 원자적으로 Commit됩니다. 외부 API 호출처럼
Database Transaction으로 Rollback할 수 없는 부수 효과는 수신 멱등성만으로 원자성을
보장할 수 없으므로 별도 Outbox 또는 상대 시스템의 Idempotency Key가 필요합니다.

처리 이력은 Consumer 재시작 뒤에도 유지하며 자동 삭제하지 않습니다. 보존 기간은 최소
Kafka의 최대 Retention 및 운영상 Replay 가능 기간보다 길어야 합니다. 실제 Event 양과
Replay 정책이 정해지기 전에 임의 Cleanup을 추가하지 않고, Outbox 보존·Archive 정책과
함께 후속 운영 작업에서 결정합니다.

## 9. Consumer Retry와 Dead Letter Topic

현재 Consumer는 Spring Kafka `DefaultErrorHandler`와 `DeadLetterPublishingRecoverer`를
사용합니다. 별도 Retry Topic을 만들지 않고 원본 Partition에서 고정 Backoff로 재시도하므로
실패 Event가 재시도되는 동안 같은 Partition의 다음 Event는 대기합니다. Retry 횟수가
유한하므로 한 Event가 Partition을 무기한 막지는 않습니다.

- 일시적인 Database·Network Runtime Exception은 기본적으로 Retry 대상입니다.
- Kafka Key 불일치, null Event, Event Type 불일치처럼 동일 입력으로 성공할 수 없는
  `IllegalArgumentException`은 재시도하지 않고 즉시 DLT로 보냅니다.
- Spring Kafka가 기본 Fatal로 분류하는 변환·Method Resolution·Class Cast 계열 오류도
  재시도하지 않습니다. 현재 직접 Jackson Deserializer 단계에서 Consumer Record 생성
  전에 발생하는 원시 역직렬화 오류의 DLT 복원은 포함하지 않습니다.
- Retry가 소진되거나 Non-Retryable로 분류된 Record는 같은 Partition 번호의
  `reservation.events.v1.dlt`로 보냅니다. DLT 발행 실패는 성공으로 간주하지 않으며 원본
  Offset도 진행하지 않습니다.
- DLT Record는 원본 Key와 Event Payload를 유지하고 Spring Kafka 표준 Header에 원본
  Topic·Partition·Offset·Consumer Group, Exception Class·Message·Stack Trace를 기록합니다.
  애플리케이션 Log에는 Payload나 개인정보를 남기지 않고 Key와 위치, 시도 횟수,
  Exception Class만 기록합니다.

DLT를 자동 소비하거나 원본 Topic으로 자동 재발행하지 않습니다. 운영자가 원인을 수정하고
Event Schema 호환성과 부수 효과 상태를 확인한 뒤 원본 Key·Payload를 유지해 통제된 방식으로
재발행해야 합니다. 이미 정상 처리된 Event는 동일 `eventId` 처리 이력이 다시 실행되는 것을
막습니다. DLT 보존 기간, 접근 권한, 수동 Replay 도구와 원시 역직렬화 실패 처리는 실제 운영
요구가 정해진 뒤 별도 작업으로 결정합니다.

## 10. Transactional Outbox

`reservation_outbox_events`는 Event ID, Aggregate Type/ID, Event Type, Schema Version,
전체 JSON Payload, 생성 시각, 발행 상태와 시도 정보를 저장합니다. Event ID는 UNIQUE로
관리하고 `status, created_at, id` 인덱스로 미발행 배치를 조회합니다. Aggregate 행이
삭제되더라도 발행 Snapshot을 유지할 수 있도록 Reservation FK는 두지 않습니다.

한 Publisher Transaction은 `PESSIMISTIC_WRITE`로 제한된 `PENDING` 배치를 잠그고 Kafka
발행과 상태 변경을 처리합니다. 이 방식은 같은 행을 여러 Application Instance가 동시에
선택하는 것을 막습니다. 다만 Kafka Acknowledgement 이후 `PUBLISHED` DB Commit 전에
Process가 종료되거나, Client Timeout 뒤 실제 전송이 완료되면 같은 Event가 재발행될 수
있습니다. Consumer는 이 At-least-once 경계에서 재전달된 같은 `eventId`를 영속 처리
이력으로 Skip합니다.

기본 Polling 간격은 1초, 배치는 50개, Kafka 대기 제한은 5초이며 환경변수로 조정할 수
있습니다. `PUBLISHED` 행은 현재 자동 삭제하지 않습니다. 운영 검증과 장애 추적에 필요한
보존 기간, Batch Cleanup, Archive 기준은 실제 Event 양과 Consumer 멱등성 저장소 정책을
함께 측정한 뒤 후속 작업에서 결정합니다.
