# Reservation Status Policy

## Scope

현재 구현된 기능에 필요한 최소 상태만 유지합니다. 결제 대기, 결제 완료, 숙박
완료와 같은 아직 존재하지 않는 기능의 상태는 미리 추가하지 않습니다.

## States and Allowed Operations

| Current status | Change schedule | Cancel | Result |
| --- | --- | --- | --- |
| `CONFIRMED` | Allowed | Allowed | 일정 변경은 `CONFIRMED` 유지, 취소는 `CANCELLED`로 전이 |
| `CANCELLED` | Rejected | Rejected | 상태와 예약 일정 유지 |

예약은 생성 시 `CONFIRMED` 상태로 시작합니다. 일정 변경은 상태 전이가 아니며,
예약 시점의 1박 가격 Snapshot을 유지한 채 변경된 숙박 일수로 총액만 다시
계산합니다.

## Domain Ownership

`Reservation` Entity가 일정 변경과 취소 가능 여부 및 상태 변경을 관리합니다.
허용되지 않는 동작에는 `InvalidReservationStateTransitionException`을 발생시켜
상태와 요청 동작을 함께 전달합니다. Service는 상태 값을 직접 검사하거나
변경하지 않습니다.

API 계층에서는 도메인 예외의 동작을 기존 오류 응답으로 변환합니다.

| Invalid operation | HTTP status | Error code |
| --- | --- | --- |
| `CANCELLED` 예약 재취소 | `409 Conflict` | `RESERVATION_005` |
| `CANCELLED` 예약 일정 변경 | `409 Conflict` | `RESERVATION_006` |

동시 예약 생성·일정 변경의 Race Condition은 이 정책의 범위가 아니며 Phase 2에서
처리합니다.
