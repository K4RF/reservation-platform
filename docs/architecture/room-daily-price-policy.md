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

## Reservation Boundary

이 Issue의 범위는 날짜별 가격의 저장·관리·조회와 명시적인 기본 가격 fallback까지
입니다. 현재 예약 생성과 일정 변경의 금액 계산은 여전히 `Room.nightlyPrice`를
Snapshot으로 사용합니다. 숙박일별 가격 합산과 예약 Snapshot 정책의 연결은
Issue #63에서 별도로 다룹니다.
