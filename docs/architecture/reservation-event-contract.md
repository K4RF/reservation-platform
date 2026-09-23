# Reservation Event Contract

## 1. 범위

이 문서는 v0.4.0 Event-Driven Processing의 예약 생명주기 Event 계약과 Kafka 개발
환경, 기본 Producer 발행 흐름을 정의합니다.

현재 예약 생성·일정 변경·취소의 핵심 Transaction은 기존처럼 MySQL에서 동기적으로
완료됩니다. Kafka Producer는 Commit된 예약 상태 변화를 후속 처리용 Topic에
전달합니다. Consumer, 애플리케이션 수준 재시도, DLQ, 알림·메일 같은 후속 비즈니스
처리는 포함되지 않습니다. Database Commit과 Event 저장의 원자성은 아직 보장하지
않으며, 다음 구현 단계에서 Transactional Outbox 같은 전달 보장 전략을 결정해야 합니다.

## 2. 현재 동기 처리 흐름

- 생성은 `ReservationCreationCoordinator`가 Room 단위 Redis Lock을 획득한 뒤
  `ReservationRetryService`를 통해 `ReservationService.create`의 새 Transaction을 최대
  3회 시도합니다. 이 Transaction 안에서 재고 차감, 숙박일별 가격 Snapshot 구성,
  Reservation 저장이 함께 Commit됩니다.
- 일정 변경은 `ReservationService.updateSchedule`의 한 Transaction에서 기존·신규 기간
  재고를 조정하고 가격 Snapshot과 Reservation 일정을 함께 변경합니다.
- 취소는 `ReservationService.cancel`의 한 Transaction에서 수수료를 계산하고 재고를
  복구한 뒤 Reservation 상태와 취소 결과 Snapshot을 함께 변경합니다.

Event는 이 핵심 흐름을 대체하지 않습니다. `ReservationService`는 상태 변경 뒤
`ReservationEventPublisher`에 Event를 전달하고, Spring의 Transaction Event가 Commit
성공을 확인한 뒤 `KafkaReservationEventProducer`를 호출합니다. Rollback된 Transaction의
Event는 Kafka로 전송하지 않습니다.

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
- Listener의 기본 Ack Mode는 Record 단위입니다.
- JSON 역직렬화 허용 Package는 Reservation Event Package로 제한합니다.
- 일반 Test Profile에서는 Kafka Topic 생성을 끄므로 GitHub Actions에 별도 Kafka
  Service가 없어도 기존 단위·통합 테스트가 외부 Broker에 의존하지 않습니다.

## 7. 발행 결과와 실패 정책

1. Reservation Transaction 안에서 Entity와 분리된 Event Snapshot을 생성합니다.
2. Transaction Commit 성공 후 `KafkaTemplate`로 `reservation.events.v1`에 비동기
   전송합니다.
3. 전송 성공 시 Event ID, Event Type, Reservation ID, Topic, Partition, Offset을
   기록합니다. Payload의 개인정보는 Logging하지 않습니다.
4. 동기·비동기 전송 실패는 동일한 식별 정보와 예외를 Error로 기록합니다. 이미
   Commit된 예약 API 응답을 Kafka 장애 때문에 실패로 바꾸지는 않습니다.

현재 구조는 Database Commit 직후 Process가 종료되거나 Kafka 전송이 실패하면 Event를
잃을 수 있습니다. Producer 실패를 단순히 무시한다는 의미가 아니라, 로그로 장애를
관찰하는 임시 정책입니다. Outbox 저장·재발행, Consumer 멱등성, Retry 및 DLQ가 구현되기
전에는 At-least-once 전달을 보장하지 않습니다.
