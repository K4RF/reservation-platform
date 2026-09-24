# Reservation Event Contract

## 1. 범위

이 문서는 v0.4.0 Event-Driven Processing의 예약 생명주기 Event 계약과 Kafka 개발
환경, Transactional Outbox 발행 흐름과 Consumer의 비동기 후처리 책임을 정의합니다.

현재 예약 생성·일정 변경·취소의 핵심 Transaction은 기존처럼 MySQL에서 동기적으로
완료됩니다. 같은 Transaction이 예약 상태와 발행할 Event의 Outbox 행을 함께
Commit하고, 별도 Outbox Publisher가 이를 Kafka Topic에 전달합니다. Consumer는 세
Event를 역직렬화해 Event별 Handler로 전달하고, 현재는
내부에서 검증 가능한 구조화 Audit Log를 비동기 후처리 Stub으로 남깁니다. 외부 알림·
메일, 통계 집계, Consumer Retry Topic과 DLQ는 포함되지 않습니다.

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

`eventId`는 향후 Consumer 멱등성 처리의 식별자로 사용할 수 있지만, 이번 범위에는
처리 이력 저장이나 중복 제거 구현이 포함되지 않습니다.

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
  -> ReservationEventHandlerRegistry
  -> Created / Changed / Cancelled Handler
  -> ReservationEventAuditLogService
```

- `ReservationEventConsumer`는 Kafka Record 수신, Reservation ID Message Key 검증,
  수신·성공·실패 Logging과 Handler Dispatch만 담당합니다.
- `ReservationEventHandlerRegistry`는 세 Event Type별 Handler가 정확히 하나씩
  등록됐는지 Application 시작 시 검증합니다.
- 각 Handler는 구체 Event Type을 확인한 뒤 후처리 Service를 호출합니다. 현재 후처리는
  Event ID, Type, Reservation ID, 공개 예약번호만 남기는 비영속 Audit Log Stub입니다.
  회원 이메일·전화번호 같은 개인정보는 Logging하지 않습니다.
- 동일 Reservation ID가 Message Key이므로 같은 예약의 Event는 같은 Partition에
  배치되어 Kafka Partition 순서를 따릅니다.

Handler 또는 후처리 Service에서 예외가 발생하면 Consumer는 실패 식별 정보를 남기고
예외를 Listener Container에 다시 전달합니다. 실패한 처리를 성공으로 기록하지 않으며,
Producer가 이미 Reservation Transaction Commit 이후 Event를 전송하므로 Consumer의
성공·실패가 완료된 예약 Transaction을 Rollback하거나 API 응답을 변경하지 않습니다.

현재 별도 Error Handler, Retry Topic, DLQ, 중복 소비 방지 저장소, 영속 Audit 저장소는
없습니다. 따라서 기본 Container 오류 처리 외의 재처리·격리·멱등성 보장은 후속 범위이며,
외부 알림을 연결하기 전 해당 정책을 먼저 확정해야 합니다.

## 9. Transactional Outbox

`reservation_outbox_events`는 Event ID, Aggregate Type/ID, Event Type, Schema Version,
전체 JSON Payload, 생성 시각, 발행 상태와 시도 정보를 저장합니다. Event ID는 UNIQUE로
관리하고 `status, created_at, id` 인덱스로 미발행 배치를 조회합니다. Aggregate 행이
삭제되더라도 발행 Snapshot을 유지할 수 있도록 Reservation FK는 두지 않습니다.

한 Publisher Transaction은 `PESSIMISTIC_WRITE`로 제한된 `PENDING` 배치를 잠그고 Kafka
발행과 상태 변경을 처리합니다. 이 방식은 같은 행을 여러 Application Instance가 동시에
선택하는 것을 막습니다. 다만 Kafka Acknowledgement 이후 `PUBLISHED` DB Commit 전에
Process가 종료되거나, Client Timeout 뒤 실제 전송이 완료되면 같은 Event가 재발행될 수
있습니다. 이는 Outbox만으로 제거할 수 없는 At-least-once 경계이므로 Consumer는 향후
`eventId` 기반 멱등 처리를 구현해야 합니다.

기본 Polling 간격은 1초, 배치는 50개, Kafka 대기 제한은 5초이며 환경변수로 조정할 수
있습니다. `PUBLISHED` 행은 현재 자동 삭제하지 않습니다. 운영 검증과 장애 추적에 필요한
보존 기간, Batch Cleanup, Archive 기준은 실제 Event 양과 Consumer 멱등성 저장소 정책을
함께 측정한 뒤 후속 작업에서 결정합니다.
