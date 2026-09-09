# Accommodation Booking Policy

## Scope

숙소마다 하나의 선택적 예약 정책을 등록할 수 있습니다. 정책이 없는 숙소는 기존
예약 규칙만 적용하여 기존 데이터와 API 동작을 유지합니다. 정책이 있으면 다음 네
경계값을 모두 포함 범위로 적용합니다.

| Field | Meaning |
| --- | --- |
| `minStayNights` | 허용하는 최소 숙박일 |
| `maxStayNights` | 허용하는 최대 숙박일 |
| `minAdvanceBookingDays` | 체크인 전에 확보해야 하는 최소 일수. `0`은 당일 예약 허용 |
| `maxAdvanceBookingDays` | 오늘부터 체크인까지 예약을 접수하는 최대 일수 |

관리자는 `POST /api/v1/accommodations/{accommodationId}/booking-policy`로 정책을
등록하고, 같은 경로의 `PUT`으로 기존 정책을 수정합니다. 한 숙소에는 한 정책만
허용하며 두 API 모두 `ADMIN` 역할이 필요합니다.

## Date and Boundary Semantics

예약 API가 시간을 받지 않고 `LocalDate`만 받으므로 최소 사전 예약 기준은 시간이
아닌 달력 일수로 정의합니다. 현재 날짜는 기존 예약 취소 정책과 같은
`ReservationDateProvider`가 현재 UTC `Instant`를 각 숙소의 IANA ZoneId 날짜로
변환합니다. 서버 기본 TimeZone이나 단일 고정 Zone은 사용하지 않습니다.

- 숙박 기간은 기존과 같은 `[check-in, check-out)`입니다.
- 최소·최대 숙박일과 최소·최대 사전 예약일의 경계값은 모두 허용합니다.
- 예를 들어 오늘이 1월 1일이고 `minAdvanceBookingDays=1`이면 1월 2일 체크인이
  가장 빠른 예약입니다.
- 체크인·체크아웃과 정책 날짜의 기준은
  [`Accommodation TimeZone Policy`](accommodation-time-zone-policy.md)를 따릅니다.

## Consistent Enforcement

`AccommodationBookingPolicyService`가 정책 조회와 기간 검증의 단일 진입점입니다.
숙소별 예약 가능 객실 조회, 예약 생성, 예약 일정 변경이 이 검증을 공통으로
호출합니다. 정책 위반은 재고를 조회하거나 변경하기 전에 거절하므로 실패한 일정
변경이 기존 재고를 건드리지 않습니다.

숙소 통합 검색은 Pagination을 유지하기 위해 동일한 포함 경계값을 JPA
Specification의 상관 Subquery 조건으로 적용합니다. `available=true`에서는 정책,
숙소·객실 운영 상태, 수용 인원 및 모든 숙박일 재고를 전부 만족해야 합니다.
`available=false`는 이 결합 조건을 만족하지 않는 숙소를 반환합니다. 실제 예약
생성 시에는 조회 이후 상태 변경 가능성을 고려해 정책과 재고를 다시 검증합니다.

## Deferred Preparation Buffer

예약 사이 준비 기간은 이번 구현에 포함하지 않습니다. 현재 재고는 개별 객실
호실이 아니라 같은 객실 유형의 판매 수량을 날짜별로 집계합니다. 어느 물리적
호실이 직전 예약에 사용됐는지 알 수 없기 때문에 인접 날짜 재고를 일괄 차감하면
판매 가능한 다른 호실까지 잘못 막을 수 있습니다. 준비 기간을 도입하려면 객실
단위 할당 또는 준비용 재고 차감과 예약의 연결·취소 복구 모델을 먼저 결정해야
합니다. 날짜별 예외 및 계절 정책도 Issue #75 범위 밖입니다.
