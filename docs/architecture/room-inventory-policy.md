# Daily Room Inventory Policy

## Scope

`RoomInventory`는 객실별 하루 재고를 표현합니다. 관리자는 API를 통해 재고를
생성하고, Calendar 기간을 조회하며, 전체 수량과 판매 상태를 변경할 수 있습니다.
예약 생성·취소·일정 변경 및 예약 가능 객실 조회도 이 재고를 기준으로 동작합니다.

## Data Model

| Field | Meaning |
| --- | --- |
| `room_id` | 재고가 속한 객실 |
| `inventory_date` | 객실을 사용하는 날짜 |
| `total_quantity` | 해당 날짜에 판매 가능한 전체 객실 수 |
| `reserved_quantity` | 해당 날짜에 이미 예약된 객실 수 |
| `sale_status` | 신규 판매 가능 여부인 `OPEN` 또는 `CLOSED` |
| `availableQuantity` | 저장하지 않고 `total_quantity - reserved_quantity`로 계산하는 잔여 수량 |

같은 객실과 날짜에는 재고가 하나만 존재하며
`uk_room_inventories_room_date(room_id, inventory_date)`가 이를 보장합니다. 숙박
기간은 예약과 같은 `[check-in, check-out)` 규칙을 사용하므로 체크인 날짜부터
체크아웃 전날까지의 재고를 조회합니다. 예약 한 건은 인원수와 관계없이 각 숙박일의
객실 재고 한 개를 사용하며, 인원수는 별도로 객실 수용 인원과 비교합니다.

신규 재고는 기본 `OPEN`입니다. 전체 재고 0은 수량이 없는 상태이고, 운영자의
명시적인 판매 중지는 수량과 독립적인 `CLOSED`로 표현합니다. 예약 또는 반환
수량은 한 번에 1 이상이어야 합니다. DB CHECK는 다음 불변식을 최종
보장합니다.

```text
total_quantity >= 0
reserved_quantity >= 0
reserved_quantity <= total_quantity
```

## Operations

| Operation | Rule |
| --- | --- |
| Create | `ADMIN`만 호출할 수 있고, 객실이 `ACTIVE`이며 같은 객실·날짜의 재고가 없어야 함. 기본 상태는 `OPEN` |
| Update | `ADMIN`만 호출할 수 있고, 객실이 `ACTIVE`이며 새 전체 수량이 현재 예약 수량 이상이어야 함. 전체 수량과 판매 상태를 함께 교체 |
| Calendar read | `ADMIN`만 호출할 수 있고, 양끝 날짜를 포함해 실제 생성된 재고만 날짜순으로 반환 |
| Reserve | 객실이 `ACTIVE`, 재고가 `OPEN`이고 요청 수량이 잔여 수량 이하여야 함 |
| Release | 요청 수량이 현재 예약 수량 이하여야 함 |
| Internal read | 객실 상태와 관계없이 기존 재고 조회 가능 |

운영 중지된 객실에서도 반환을 허용하는 이유는 기존 예약의 취소 등으로 이미 차감된
수량을 정상적으로 복구할 수 있어야 하기 때문입니다. 객실 비활성화가 과거 재고나
예약 이력을 삭제하지는 않습니다.

## Reservation Flow

| Flow | Inventory processing |
| --- | --- |
| Availability query | 모든 숙박일에 `OPEN` 재고 행이 있고 각 날짜의 `reserved < total`인 객실만 반환 |
| Create reservation | 모든 숙박일 재고의 존재, `OPEN` 상태와 잔여 수량을 먼저 검증한 뒤 날짜마다 1개 차감 |
| Cancel reservation | 기존 숙박일마다 예약 수량 1개 반환 후 상태를 `CANCELLED`로 변경 |
| Change schedule | 기존·신규 기간의 교집합은 판매 상태와 무관하게 유지하고, 빠지는 날짜는 반환하며 추가되는 날짜는 `OPEN`과 잔여 수량을 검증 후 차감 |

기간 중복 `Reservation` 조회는 재고가 여러 개인 객실을 표현하지 못하므로 예약 가능
여부의 기준에서 제거했습니다. `Reservation`은 회원의 예약 이력, 상태, 기간과 가격
Snapshot을 보관하고, `RoomInventory`가 판매 가능 수량을 판단합니다.

판매 상태 변경은 기존 `Reservation`이나 `reserved_quantity`를 변경하지 않습니다.
`CLOSED` 재고도 기존 예약 취소 시 정상 반환할 수 있어 이력과 수량 정합성을
유지합니다.

## Admin API

| Method | Endpoint | Contract |
| --- | --- | --- |
| `POST` | `/api/v1/rooms/{roomId}/inventories` | `inventoryDate`, `totalQuantity`로 `OPEN` 재고 생성 |
| `PUT` | `/api/v1/rooms/{roomId}/inventories/{inventoryDate}` | `totalQuantity`, `saleStatus` 전체 교체 |
| `GET` | `/api/v1/rooms/{roomId}/inventories?startDate&endDate` | 시작일·종료일 포함 Calendar 조회 |

Calendar 응답에는 조회 범위와 날짜순 재고 목록이 포함됩니다. 범위 안에 아직 재고
행이 생성되지 않은 날짜는 빈 칸을 합성하지 않고 목록에서 제외합니다.

## Transaction and Concurrency Boundary

`ReservationService`의 예약 생성·취소·일정 변경은 여러 날짜의 재고 변경과
`Reservation` 저장을 각각 하나의 Transaction에서 처리합니다. 어느 단계에서든
Runtime Exception이 발생하면 재고와 예약 변경이 함께 Rollback됩니다. 모든 날짜의
존재와 수량을 변경 전에 먼저 검증하므로 순차 요청에서는 부분 차감과 음수 잔여
재고를 만들지 않습니다.

그러나 Lock이나 원자적 조건부 UPDATE를 아직 사용하지 않으므로, 여러 Transaction이
동시에 같은 재고를 읽으면 lost update 또는 초과 예약 Race Condition이 발생할 수
있습니다.

따라서 현재 구현을 동시 요청에 안전하다고 간주하면 안 됩니다. 후속 동시성 작업에서
MySQL Lock 또는 Redis 분산 Lock 전략을 결정하고, Testcontainers 기반 동시 요청
테스트로 검증합니다.

기존 개발 DB의 확정 예약은 재고 모델 도입 전에 생성되어 날짜별 재고 차감 기록이
없을 수 있습니다. 기존 예약의 취소·일정 변경을 사용하기 전에 각 숙박일의 재고를
생성하고 `reserved_quantity`에 확정 예약 수를 반영해야 합니다. 현재 프로젝트에는
이를 자동화하는 정식 Migration 도구가 없습니다.
