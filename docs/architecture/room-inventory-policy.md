# Daily Room Inventory Policy

## Scope

`RoomInventory`는 객실별 하루 재고를 표현합니다. 현재 단계에서는 재고의 생성,
조회, 전체 수량 변경, 예약 수량 차감과 반환 규칙만 구현합니다. 예약 생성·취소·일정
변경 및 예약 가능 객실 조회와의 연결은 후속 Issue에서 하나의 Transaction으로
구성합니다.

## Data Model

| Field | Meaning |
| --- | --- |
| `room_id` | 재고가 속한 객실 |
| `inventory_date` | 객실을 사용하는 날짜 |
| `total_quantity` | 해당 날짜에 판매 가능한 전체 객실 수 |
| `reserved_quantity` | 해당 날짜에 이미 예약된 객실 수 |
| `availableQuantity` | 저장하지 않고 `total_quantity - reserved_quantity`로 계산하는 잔여 수량 |

같은 객실과 날짜에는 재고가 하나만 존재하며
`uk_room_inventories_room_date(room_id, inventory_date)`가 이를 보장합니다. 숙박
기간은 기존 예약과 같은 `[check-in, check-out)` 규칙을 사용하므로 후속 예약 연동
시 체크인 날짜부터 체크아웃 전날까지의 재고를 조회해야 합니다.

전체 재고 0은 판매 중지 또는 매진 상태를 표현할 수 있도록 허용합니다. 예약 또는
반환 수량은 한 번에 1 이상이어야 합니다. DB CHECK는 다음 불변식을 최종
보장합니다.

```text
total_quantity >= 0
reserved_quantity >= 0
reserved_quantity <= total_quantity
```

## Operations

| Operation | Rule |
| --- | --- |
| Create | 객실이 `ACTIVE`이고 같은 객실·날짜의 재고가 없어야 함 |
| Change total | 객실이 `ACTIVE`이고 새 전체 수량이 현재 예약 수량 이상이어야 함 |
| Reserve | 객실이 `ACTIVE`이고 요청 수량이 잔여 수량 이하여야 함 |
| Release | 요청 수량이 현재 예약 수량 이하여야 함 |
| Read | 객실 상태와 관계없이 기존 재고 조회 가능 |

운영 중지된 객실에서도 반환을 허용하는 이유는 기존 예약의 취소 등으로 이미 차감된
수량을 정상적으로 복구할 수 있어야 하기 때문입니다. 객실 비활성화가 과거 재고나
예약 이력을 삭제하지는 않습니다.

## Transaction and Concurrency Boundary

현재 `RoomInventoryService`의 각 변경 메서드는 하나의 Transaction에서
read-modify-write를 수행하므로 순차 요청에서는 음수 잔여 재고를 만들 수 없습니다.
그러나 Lock이나 원자적 조건부 UPDATE를 아직 사용하지 않으므로, 여러 Transaction이
동시에 같은 재고를 읽으면 lost update 또는 초과 예약 Race Condition이 발생할 수
있습니다.

따라서 현재 구현을 동시 요청에 안전하다고 간주하면 안 됩니다. 후속 동시성 작업에서
MySQL Lock 또는 Redis 분산 Lock 전략과 예약 처리 전체의 Transaction 경계를
결정하고, Testcontainers 기반 동시 요청 테스트로 검증합니다.
