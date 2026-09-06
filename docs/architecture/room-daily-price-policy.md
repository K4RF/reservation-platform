# Daily Room Price Policy

날짜별 객실 가격은 객실의 기본 1박 가격을 특정 숙박일에만 덮어쓰기 위한
모델입니다. 주말·성수기 규칙을 자동 계산하지 않고 관리자가 날짜별 금액을
명시적으로 등록하거나 수정합니다.

## Price Resolution

특정 객실과 숙박일의 적용 가격은 다음 순서로 결정합니다.

1. `room_daily_prices`에 `(room_id, stay_date)` 행이 있으면 해당
   `nightly_price`를 사용하고 응답의 `source`는 `DAILY`입니다.
2. 날짜별 행이 없으면 `rooms.nightly_price`를 사용하고 응답의 `source`는
   `DEFAULT`입니다. 이 경우 `roomDailyPriceId`는 `null`입니다.

날짜별 가격과 객실 기본 가격은 모두 `BigDecimal`로 처리합니다. 날짜별 가격은
API와 Domain에서 0보다 커야 하며, DB에는 `DECIMAL(12,2)`와 양수 CHECK를
적용합니다. 같은 객실과 날짜에는 하나의 가격만 존재할 수 있습니다.

## Access and Lifecycle

- 관리자는 날짜별 가격을 등록하고 기존 가격을 수정할 수 있습니다.
- 인증 사용자는 특정 날짜의 적용 가격을 조회할 수 있습니다.
- 등록은 같은 객실·날짜가 이미 존재하면 충돌로 처리합니다.
- 수정은 해당 날짜별 가격이 없으면 리소스 미존재로 처리합니다.
- 관리자는 판매 준비를 위해 `INACTIVE` 객실에도 가격을 미리 설정할 수 있습니다.
  다만 비활성 객실·숙소는 기존 정책대로 예약 가능 조회에서 제외되고 신규 예약도
  차단됩니다.

## Reservation Integration

예약 생성과 일정 변경은 `[check-in, check-out)`의 모든 숙박일 가격을 한 번의
기간 조회로 가져옵니다. 날짜별 행은 해당 금액을 사용하고, 누락된 날짜는 객실
기본 가격으로 fallback한 뒤 합산합니다. 예약 이후 원본 가격 변경은 기존 예약
금액에 영향을 주지 않으며, 일정 변경은 새 기간 전체를 변경 시점 가격으로 다시
계산합니다. Snapshot 저장 수준은
[`ADR-004`](../adr/004-reservation-price-snapshot.md)에 정리되어 있습니다.
